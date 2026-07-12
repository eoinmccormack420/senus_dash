"""
DRF views for the Senus Board Report app.

Save as: <yourapp>/views.py

Endpoints this gives you (once wired into urls.py):
    GET /api/periods/                -> list of periods (lightweight)
    GET /api/periods/<id>/           -> full aggregate detail for one period
    GET /api/periods/<id>/insights/  -> just the AI insights for a period
    GET /api/periods/latest/         -> full detail for the most recent period

Read-only on purpose — data enters the system via the seed command and
the (future) Gemini extraction pipeline, not via the dashboard API.
"""

import os

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import NotFound

from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.views import APIView

from django.conf import settings
from django.contrib.auth.models import User
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .models import (
    FinancialPeriod,
    AllowedGoogleEmail,
    UserPreferences,
    ExtractionAttempt,
    NotificationSettings,
)
from .serializers import (
    PeriodListSerializer,
    PeriodDetailSerializer,
    AIInsightSerializer,
    AllowedGoogleEmailSerializer,
    UserPreferencesSerializer,
    ExtractionAttemptSerializer,
    ExtractionAttemptListSerializer,
    NotificationSettingsSerializer,
)
from .extraction.commentary import generate_insights_for_period
from .extraction.pipeline import promote_attempt
from .extraction.email_notifications import notify_insight_subscribers, send_test_email
from .extraction.notifications import send_test_slack_message
from .extraction.teams_notifications import send_test_teams_message
from .extraction.gmail_oauth import exchange_code_for_tokens, get_email_from_id_token, GmailOAuthError


class FinancialPeriodViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FinancialPeriod.objects.all().order_by("end_date")

    def get_serializer_class(self):
        if self.action == "list":
            return PeriodListSerializer
        return PeriodDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "retrieve":
            # select_related/prefetch to avoid N+1 queries on the
            # aggregate detail endpoint
            qs = qs.select_related(
                "pl_statement", "balance_sheet", "cash_flow", "business_metrics"
            ).prefetch_related("ai_insights")
        return qs

    @action(detail=True, methods=["get"])
    def insights(self, request, pk=None):
        period = self.get_object()
        serializer = AIInsightSerializer(period.ai_insights.all(), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def latest(self, request):
        period = (
            FinancialPeriod.objects.select_related(
                "pl_statement", "balance_sheet", "cash_flow", "business_metrics"
            )
            .prefetch_related("ai_insights")
            .order_by("-end_date")
            .first()
        )
        if period is None:
            raise NotFound("No financial periods have been seeded yet.")
        serializer = PeriodDetailSerializer(period)
        return Response(serializer.data)
    


class LoginView(ObtainAuthToken):
    """
    POST { "username": "...", "password": "..." } -> { "token": "..." }
    This is the one endpoint that must stay open (AllowAny) — everything
    else on the API requires the token from this response.
    """
    permission_classes = [AllowAny]
 
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _created = Token.objects.get_or_create(user=user)
        return Response({
            "token": token.key,
            "username": user.username,
        })


class GoogleLoginView(APIView):
    """
    POST { "credential": "<Google ID token from Google Identity Services>" }
    -> { "token": "...", "username": "..." }

    Verifies the ID token was issued by Google for our OAuth client, then
    checks the email against the AllowedGoogleEmail allowlist — a valid
    Google login alone is not sufficient, since this dashboard serves
    unreleased financial data to a small fixed set of reviewers, not the
    public. Manage the allowlist from the settings menu (admin only) or
    Django admin.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        credential = request.data.get("credential")
        if not credential:
            return Response({"detail": "Missing credential."}, status=400)
        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return Response({"detail": "Google sign-in is not configured."}, status=503)

        try:
            idinfo = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID
            )
        except ValueError:
            return Response({"detail": "Invalid Google credential."}, status=401)

        email = (idinfo.get("email") or "").lower()
        if not idinfo.get("email_verified") or not AllowedGoogleEmail.objects.filter(email__iexact=email).exists():
            return Response({"detail": "This Google account is not authorized."}, status=403)

        user, _created = User.objects.get_or_create(username=email, defaults={"email": email})
        token, _created = Token.objects.get_or_create(user=user)
        return Response({
            "token": token.key,
            "username": user.username,
        })


class MeView(APIView):
    """
    GET -> { "username": "...", "email": "...", "is_staff": bool }
    Recovers the signed-in user's identity for a token that's already in
    localStorage (e.g. after a page reload) — no permission_classes
    override needed, this inherits the project default (IsAuthenticated
    via TokenAuthentication), same as FinancialPeriodViewSet. is_staff
    tells the frontend whether to show the admin sections of the
    settings menu (allowed-emails management, regenerate insights).
    """
    def get(self, request, *args, **kwargs):
        return Response({
            "username": request.user.username,
            "email": request.user.email,
            "is_staff": request.user.is_staff,
        })


class AllowedGoogleEmailViewSet(viewsets.ModelViewSet):
    """
    Admin-only CRUD for who's allowed to sign in via Google — lets the
    allowlist be managed from the settings menu instead of editing the
    old GOOGLE_ALLOWED_EMAILS env var by hand.
    """
    queryset = AllowedGoogleEmail.objects.all()
    serializer_class = AllowedGoogleEmailSerializer
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def perform_create(self, serializer):
        serializer.save(added_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.email.lower() == (request.user.email or "").lower():
            return Response({"detail": "You can't remove your own access."}, status=400)
        return super().destroy(request, *args, **kwargs)


class RegenerateInsightsView(APIView):
    """
    POST -> regenerates AI commentary for the latest period, admin only.
    Wraps the same generate_insights_for_period() the CLI management
    command uses (see board/extraction/commentary.py) — already
    respects the source-data-hash cache, so re-running this when
    nothing's changed doesn't burn Gemini quota.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        period = FinancialPeriod.objects.order_by("-end_date").first()
        if period is None:
            return Response({"detail": "No financial periods have been seeded yet."}, status=404)
        results = generate_insights_for_period(period)
        notify_insight_subscribers(period, results)
        return Response({"period": period.label, "results": results})


class NotificationStatusView(APIView):
    """
    GET   -> which outbound notification channels are currently active
             (slack/teams/email booleans), plus the admin-configured
             Slack/Teams webhook URLs and SMTP settings (empty/false
             where only an env var is providing it — that case can't be
             edited here, only on the deployment platform). smtp_password
             is write_only on the serializer, so it's never echoed back —
             only smtp_password_set (bool) says whether one is stored.
    PATCH { "slack_webhook_url": "...", "teams_webhook_url": "...",
            "smtp_host": "...", "smtp_port": 587, "smtp_username": "...",
            "smtp_password": "...", "smtp_use_tls": true, "from_email": "..." }
             -> sets or clears (pass "") any of these fields, so wiring
             up Slack/Teams/Email no longer requires editing Railway
             env vars — mirrors AllowedGoogleEmail's role for
             GOOGLE_ALLOWED_EMAILS. Admin only.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        return Response(self._payload(NotificationSettings.get_solo()))

    def patch(self, request, *args, **kwargs):
        settings_row = NotificationSettings.get_solo()
        serializer = NotificationSettingsSerializer(settings_row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self._payload(settings_row))

    @staticmethod
    def _payload(settings_row: NotificationSettings) -> dict:
        email_active = bool(settings_row.gmail_refresh_token) or bool(settings_row.smtp_host) or (
            settings.EMAIL_BACKEND != "django.core.mail.backends.console.EmailBackend"
        )
        return {
            "slack": bool(settings_row.slack_webhook_url or os.environ.get("SLACK_WEBHOOK_URL")),
            "teams": bool(settings_row.teams_webhook_url or os.environ.get("TEAMS_WEBHOOK_URL")),
            "email": email_active,
            "slack_webhook_url": settings_row.slack_webhook_url,
            "teams_webhook_url": settings_row.teams_webhook_url,
            "smtp_host": settings_row.smtp_host,
            "smtp_port": settings_row.smtp_port,
            "smtp_username": settings_row.smtp_username,
            "smtp_password_set": bool(settings_row.smtp_password),
            "smtp_use_tls": settings_row.smtp_use_tls,
            "from_email": settings_row.from_email,
            "gmail_connected_email": settings_row.gmail_connected_email,
        }


class TestSlackNotificationView(APIView):
    """POST -> sends a test message to the configured Slack webhook, admin only. Returns {"success": bool}."""
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        return Response({"success": send_test_slack_message()})


class TestTeamsNotificationView(APIView):
    """POST -> sends a test Adaptive Card to the configured Teams webhook, admin only. Returns {"success": bool}."""
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        return Response({"success": send_test_teams_message()})


class TestEmailNotificationView(APIView):
    """
    POST -> sends a test email to the requesting admin's own address
    (never an arbitrary address supplied by the client), admin only.
    Returns {"success": bool, "sent_to": str}.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        if not request.user.email:
            return Response({"detail": "Your account has no email address on file."}, status=400)
        success = send_test_email(request.user.email)
        return Response({"success": success, "sent_to": request.user.email})


class ConnectGmailView(APIView):
    """
    POST { "code": "<authorization code from google.accounts.oauth2.initCodeClient>" }
    -> exchanges the code for a refresh token (requires
    GOOGLE_OAUTH_CLIENT_SECRET) and stores it on NotificationSettings,
    so outbound notification emails send via the Gmail API as this
    Google account instead of needing SMTP credentials. Admin only.
    Returns the same payload as NotificationStatusView.GET.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        code = request.data.get("code")
        if not code:
            return Response({"detail": "Missing code."}, status=400)

        try:
            tokens = exchange_code_for_tokens(code)
            refresh_token = tokens.get("refresh_token")
            if not refresh_token:
                return Response(
                    {"detail": "Google didn't return a refresh token. Try disconnecting and reconnecting."},
                    status=400,
                )
            email = get_email_from_id_token(tokens["id_token"])
        except GmailOAuthError as exc:
            return Response({"detail": str(exc)}, status=400)

        settings_row = NotificationSettings.get_solo()
        settings_row.gmail_refresh_token = refresh_token
        settings_row.gmail_connected_email = email
        settings_row.save()
        return Response(NotificationStatusView._payload(settings_row))


class DisconnectGmailView(APIView):
    """POST -> clears the connected Gmail account, admin only. Returns the same payload as NotificationStatusView.GET."""
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        settings_row = NotificationSettings.get_solo()
        settings_row.gmail_refresh_token = ""
        settings_row.gmail_connected_email = ""
        settings_row.save()
        return Response(NotificationStatusView._payload(settings_row))


class UserPreferencesView(APIView):
    """
    GET/PATCH { "notify_on_new_insights": bool } — every signed-in user
    manages their own preferences, no admin gate. Subscribers get a
    summary email when RegenerateInsightsView produces new commentary
    (see extraction/email_notifications.py).
    """
    def get(self, request, *args, **kwargs):
        prefs, _created = UserPreferences.objects.get_or_create(user=request.user)
        return Response(UserPreferencesSerializer(prefs).data)

    def patch(self, request, *args, **kwargs):
        prefs, _created = UserPreferences.objects.get_or_create(user=request.user)
        serializer = UserPreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ExtractionAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """
    AI Governance Center — admin-only. Lets an admin inspect and
    approve/reject Gemini extraction attempts from the app instead of
    Django admin's ExtractionAttemptAdmin. Read-only at the ViewSet
    level (list/retrieve); approve/reject are the only mutations, and
    both delegate to promote_attempt() (board/extraction/pipeline.py)
    so there's exactly one code path that ever writes into live
    statement data — same function Django admin's "promote_selected"
    action already uses.

    ?period=<id> and ?status=<status> filter the list.
    """
    queryset = ExtractionAttempt.objects.select_related("period").all()
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.action == "list":
            return ExtractionAttemptListSerializer
        return ExtractionAttemptSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        period_id = self.request.query_params.get("period")
        status_param = self.request.query_params.get("status")
        if period_id:
            qs = qs.filter(period_id=period_id)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        attempt = self.get_object()
        # promote_attempt() requires verified=True to already be set —
        # it's the human-approval gate, not something it flips itself.
        attempt.verified = True
        attempt.save()
        try:
            promote_attempt(attempt)
        except ValueError as exc:
            # e.g. status isn't cross_check_pass/schema_valid — the
            # same guard promote_attempt() already enforces, surfaced
            # here rather than re-implemented.
            return Response({"detail": str(exc)}, status=400)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"Promotion failed: {exc}"}, status=400)
        return Response(ExtractionAttemptSerializer(attempt).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        attempt = self.get_object()
        attempt.verified = False
        attempt.save()
        return Response(ExtractionAttemptSerializer(attempt).data)
