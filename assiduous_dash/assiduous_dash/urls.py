"""
URL configuration for assiduous_dash project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.http import FileResponse, Http404
from django.urls import path, include, re_path


def serve_frontend(request):
    """
    Serves the React build's index.html for every non-API, non-admin
    route (single-service deployment — see WHITENOISE_ROOT in
    settings.py for how the JS/CSS/etc. assets index.html references
    get served). A plain FileResponse is enough since index.html isn't
    a Django template — it's Vite's static build output, unmodified.
    """
    index_path = settings.FRONTEND_DIST_DIR / "index.html"
    if not index_path.exists():
        raise Http404(
            "Frontend build not found at "
            f"{index_path} — did `npm run build` run in senus-dashboard/?"
        )
    return FileResponse(open(index_path, "rb"))


urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/", include("board.urls")),
    # Catch-all MUST be last: anything not matched above (i.e. not
    # /admin/ or /api/) falls through to the React app.
    re_path(r"^.*$", serve_frontend),
]
