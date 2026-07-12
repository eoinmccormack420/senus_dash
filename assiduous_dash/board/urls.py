"""
URL routing for the Senus Board Report app.

Save as: <yourapp>/urls.py, then include it in your project's root
urls.py, e.g.:

    # project/urls.py
    from django.urls import path, include

    urlpatterns = [
        ...
        path("api/", include("yourapp.urls")),
    ]
"""

from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    FinancialPeriodViewSet,
    LoginView,
    GoogleLoginView,
    MeView,
    AllowedGoogleEmailViewSet,
    RegenerateInsightsView,
    UserPreferencesView,
    ExtractionAttemptViewSet,
    NotificationStatusView,
    TestSlackNotificationView,
    TestTeamsNotificationView,
    TestEmailNotificationView,
    ConnectGmailView,
    DisconnectGmailView,
)

router = DefaultRouter()
router.register(r"periods", FinancialPeriodViewSet, basename="period")
router.register(r"admin/allowed-emails", AllowedGoogleEmailViewSet, basename="allowed-email")
router.register(r"extraction-attempts", ExtractionAttemptViewSet, basename="extraction-attempt")

urlpatterns = router.urls + [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/google/", GoogleLoginView.as_view(), name="google-login"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("admin/regenerate-insights/", RegenerateInsightsView.as_view(), name="regenerate-insights"),
    path("preferences/", UserPreferencesView.as_view(), name="preferences"),
    path("notifications/status/", NotificationStatusView.as_view(), name="notifications-status"),
    path("notifications/test-slack/", TestSlackNotificationView.as_view(), name="notifications-test-slack"),
    path("notifications/test-teams/", TestTeamsNotificationView.as_view(), name="notifications-test-teams"),
    path("notifications/test-email/", TestEmailNotificationView.as_view(), name="notifications-test-email"),
    path("notifications/connect-gmail/", ConnectGmailView.as_view(), name="notifications-connect-gmail"),
    path("notifications/disconnect-gmail/", DisconnectGmailView.as_view(), name="notifications-disconnect-gmail"),
]
