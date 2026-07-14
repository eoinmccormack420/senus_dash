"""
Tests for the "Nearby Startup Incubators" card on /readiness:
places_client.search_incubators (mocked at urllib.request.urlopen, same
convention as test_notifications.py/test_gmail_oauth.py's webhook/token
calls — no real Places API calls in tests), refresh_nearby_incubators's
replace-wholesale caching behavior, and IncubatorsView/RefreshIncubatorsView
permission gating.
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.extraction.places_client import refresh_nearby_incubators, search_incubators
from board.models import IncubatorSettings, NearbyIncubator


def fake_places_response(places):
    response = MagicMock()
    response.read.return_value = json.dumps({"places": places}).encode("utf-8")
    response.__enter__.return_value = response
    return response


@pytest.mark.django_db
class TestSearchIncubators:
    def test_requires_api_key(self, settings):
        settings.GOOGLE_PLACES_API_KEY = ""

        with pytest.raises(RuntimeError, match="not configured"):
            search_incubators("startup incubator", "Dublin, Ireland")

    def test_parses_results(self, settings, monkeypatch):
        settings.GOOGLE_PLACES_API_KEY = "fake-key"
        monkeypatch.setattr(
            "board.extraction.places_client.urllib.request.urlopen",
            lambda request, timeout=10: fake_places_response(
                [
                    {
                        "id": "place1",
                        "displayName": {"text": "NDRC"},
                        "formattedAddress": "Dublin 2",
                        "websiteUri": "https://ndrc.ie",
                        "rating": 4.5,
                        "googleMapsUri": "https://maps.google.com/?cid=1",
                    }
                ]
            ),
        )

        results = search_incubators("startup incubator", "Dublin, Ireland")

        assert results == [
            {
                "place_id": "place1",
                "name": "NDRC",
                "address": "Dublin 2",
                "website": "https://ndrc.ie",
                "rating": 4.5,
                "maps_url": "https://maps.google.com/?cid=1",
            }
        ]

    def test_http_error_is_wrapped(self, settings, monkeypatch):
        import urllib.error

        settings.GOOGLE_PLACES_API_KEY = "fake-key"

        def raise_http_error(request, timeout=10):
            error = urllib.error.HTTPError("url", 400, "Bad Request", {}, MagicMock())
            error.read = lambda: b'{"error": "bad request"}'
            raise error

        monkeypatch.setattr("board.extraction.places_client.urllib.request.urlopen", raise_http_error)

        with pytest.raises(RuntimeError, match="rejected the search"):
            search_incubators("startup incubator", "Dublin, Ireland")


@pytest.mark.django_db
class TestRefreshNearbyIncubators:
    def test_replaces_cached_incubators_wholesale(self, monkeypatch):
        NearbyIncubator.objects.create(place_id="stale", name="Old Incubator")
        monkeypatch.setattr(
            "board.extraction.places_client.search_incubators",
            lambda query, location, max_results=10: [
                {
                    "place_id": "place1",
                    "name": "NDRC",
                    "address": "Dublin 2",
                    "website": "https://ndrc.ie",
                    "rating": 4.5,
                    "maps_url": "https://maps.google.com/?cid=1",
                }
            ],
        )

        result = refresh_nearby_incubators("Dublin, Ireland")

        assert result == {"processed": 1}
        assert not NearbyIncubator.objects.filter(place_id="stale").exists()
        incubator = NearbyIncubator.objects.get(place_id="place1")
        assert incubator.name == "NDRC"
        settings_row = IncubatorSettings.get_solo()
        assert settings_row.last_refreshed_at is not None
        assert settings_row.last_refresh_error == ""

    def test_requests_at_most_five_results(self, monkeypatch):
        mock_search = MagicMock(return_value=[])
        monkeypatch.setattr("board.extraction.places_client.search_incubators", mock_search)

        refresh_nearby_incubators("Dublin, Ireland")

        mock_search.assert_called_once_with(
            "startup incubator accelerator innovation hub", "Dublin, Ireland", max_results=5
        )

    def test_error_is_recorded_and_reraised(self, monkeypatch):
        monkeypatch.setattr(
            "board.extraction.places_client.search_incubators",
            MagicMock(side_effect=RuntimeError("Places is down")),
        )

        with pytest.raises(RuntimeError, match="Places is down"):
            refresh_nearby_incubators("Dublin, Ireland")

        assert IncubatorSettings.get_solo().last_refresh_error == "Places is down"


@pytest.mark.django_db
class TestIncubatorsView:
    def test_requires_authentication(self):
        client = APIClient()

        response = client.get("/api/incubators/")

        assert response.status_code == 401

    def test_any_authenticated_user_can_read(self):
        NearbyIncubator.objects.create(place_id="place1", name="NDRC", rating=4.5)
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/incubators/")

        assert response.status_code == 200
        assert response.data["incubators"][0]["name"] == "NDRC"


@pytest.mark.django_db
class TestRefreshIncubatorsView:
    def test_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/incubators/refresh/", {}, format="json")

        assert response.status_code == 403

    def test_admin_refresh_persists_location_override(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.refresh_nearby_incubators") as mock_refresh:
            response = client.post("/api/incubators/refresh/", {"location": "Cork, Ireland"}, format="json")

        assert response.status_code == 200
        mock_refresh.assert_called_once_with("Cork, Ireland")
        assert IncubatorSettings.get_solo().search_location == "Cork, Ireland"

    def test_places_error_reported_as_400(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.refresh_nearby_incubators", side_effect=RuntimeError("Places is down")):
            response = client.post("/api/incubators/refresh/", {}, format="json")

        assert response.status_code == 400
        assert response.data["detail"] == "Places is down"
