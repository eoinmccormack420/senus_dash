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

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import NotFound

from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from django.conf import settings
from django.contrib.auth.models import User
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .models import FinancialPeriod
from .serializers import (
    PeriodListSerializer,
    PeriodDetailSerializer,
    AIInsightSerializer,
)


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
    checks the email against GOOGLE_ALLOWED_EMAILS — a valid Google login
    alone is not sufficient, since this dashboard serves unreleased
    financial data to a small fixed set of reviewers, not the public.
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
        if not idinfo.get("email_verified") or email not in settings.GOOGLE_ALLOWED_EMAILS:
            return Response({"detail": "This Google account is not authorized."}, status=403)

        user, _created = User.objects.get_or_create(username=email, defaults={"email": email})
        token, _created = Token.objects.get_or_create(user=user)
        return Response({
            "token": token.key,
            "username": user.username,
        })
