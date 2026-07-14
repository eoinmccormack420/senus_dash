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
    GenerateAdvisoryGoalsView,
    GenerateFundingRoadmapView,
    AdvisoryGoalViewSet,
    EcosystemChecklistItemViewSet,
    ReportSpecViewSet,
    UserPreferencesView,
    ExtractionAttemptViewSet,
    NotificationStatusView,
    TestSlackNotificationView,
    TestTeamsNotificationView,
    TestEmailNotificationView,
    ConnectGmailView,
    DisconnectGmailView,
    BoardAlertSettingsView,
    DriveSettingsView,
    SyncDriveNowView,
    ConnectDriveView,
    DisconnectDriveView,
    DriveFoldersView,
    IncubatorsView,
    RefreshIncubatorsView,
)

router = DefaultRouter()
router.register(r"periods", FinancialPeriodViewSet, basename="period")
router.register(r"admin/allowed-emails", AllowedGoogleEmailViewSet, basename="allowed-email")
router.register(r"extraction-attempts", ExtractionAttemptViewSet, basename="extraction-attempt")
router.register(r"advisory-goals", AdvisoryGoalViewSet, basename="advisory-goal")
router.register(r"ecosystem-checklist", EcosystemChecklistItemViewSet, basename="ecosystem-checklist-item")
router.register(r"report-specs", ReportSpecViewSet, basename="report-spec")

urlpatterns = router.urls + [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/google/", GoogleLoginView.as_view(), name="google-login"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("admin/regenerate-insights/", RegenerateInsightsView.as_view(), name="regenerate-insights"),
    path("admin/generate-goals/", GenerateAdvisoryGoalsView.as_view(), name="generate-goals"),
    path("admin/generate-roadmap/", GenerateFundingRoadmapView.as_view(), name="generate-roadmap"),
    path("preferences/", UserPreferencesView.as_view(), name="preferences"),
    path("notifications/status/", NotificationStatusView.as_view(), name="notifications-status"),
    path("notifications/test-slack/", TestSlackNotificationView.as_view(), name="notifications-test-slack"),
    path("notifications/test-teams/", TestTeamsNotificationView.as_view(), name="notifications-test-teams"),
    path("notifications/test-email/", TestEmailNotificationView.as_view(), name="notifications-test-email"),
    path("notifications/connect-gmail/", ConnectGmailView.as_view(), name="notifications-connect-gmail"),
    path("notifications/disconnect-gmail/", DisconnectGmailView.as_view(), name="notifications-disconnect-gmail"),
    path("board-alerts/settings/", BoardAlertSettingsView.as_view(), name="board-alerts-settings"),
    path("drive/settings/", DriveSettingsView.as_view(), name="drive-settings"),
    path("drive/sync/", SyncDriveNowView.as_view(), name="drive-sync"),
    path("drive/connect/", ConnectDriveView.as_view(), name="drive-connect"),
    path("drive/disconnect/", DisconnectDriveView.as_view(), name="drive-disconnect"),
    path("drive/folders/", DriveFoldersView.as_view(), name="drive-folders"),
    path("incubators/", IncubatorsView.as_view(), name="incubators"),
    path("incubators/refresh/", RefreshIncubatorsView.as_view(), name="incubators-refresh"),
]
