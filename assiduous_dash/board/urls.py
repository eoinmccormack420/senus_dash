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

from .views import FinancialPeriodViewSet, LoginView

router = DefaultRouter()
router.register(r"periods", FinancialPeriodViewSet, basename="period")

urlpatterns = router.urls + [
    path("auth/login/", LoginView.as_view(), name="login"),
]
