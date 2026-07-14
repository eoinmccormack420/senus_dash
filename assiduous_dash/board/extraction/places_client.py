"""
Google Places API (New) client for the "Nearby Startup Incubators" card
on /readiness — replaces the old manually-entered Ecosystem Checklist
on that page with real, live, Google-sourced results.

Save as: board/extraction/places_client.py
"""

import json
import urllib.error
import urllib.request

from django.conf import settings
from django.utils import timezone

from board.models import IncubatorSettings, NearbyIncubator

SEARCH_TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText"

# Keeps the request in the cheaper Places API (New) SKU tier by only
# asking Google for the fields this card actually displays.
FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.websiteUri,places.rating,places.googleMapsUri"
)

DEFAULT_QUERY = "startup incubator accelerator innovation hub"


def search_incubators(query: str, location: str, max_results: int = 10) -> list[dict]:
    """
    POSTs a text search to Places API (New) and returns a list of
    plain dicts: {place_id, name, address, website, rating, maps_url}.
    Raises RuntimeError with Google's own error body on failure, same
    HTTPError-wrapping convention as gmail_oauth.exchange_code_for_tokens.
    """
    if not settings.GOOGLE_PLACES_API_KEY:
        raise RuntimeError("Google Places is not configured on the server (missing GOOGLE_PLACES_API_KEY).")

    body = json.dumps({"textQuery": f"{query} near {location}", "maxResultCount": max_results}).encode("utf-8")
    request = urllib.request.Request(
        SEARCH_TEXT_ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": FIELD_MASK,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Google Places rejected the search: {detail}") from exc
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Couldn't reach Google Places: {exc}") from exc

    results = []
    for place in payload.get("places", []):
        results.append(
            {
                "place_id": place.get("id", ""),
                "name": place.get("displayName", {}).get("text", ""),
                "address": place.get("formattedAddress", ""),
                "website": place.get("websiteUri", ""),
                "rating": place.get("rating"),
                "maps_url": place.get("googleMapsUri", ""),
            }
        )
    return results


def refresh_nearby_incubators(location: str) -> dict:
    """
    Searches for incubators near `location`, replaces all cached
    NearbyIncubator rows wholesale (a fresh search result set naturally
    supersedes the prior one, no diffing needed), and updates
    IncubatorSettings. Runs synchronously — a single fast API call,
    unlike Drive sync's multi-minute background-thread case.
    """
    settings_row = IncubatorSettings.get_solo()
    try:
        results = search_incubators(DEFAULT_QUERY, location, max_results=5)
    except RuntimeError as exc:
        settings_row.last_refresh_error = str(exc)
        settings_row.save(update_fields=["last_refresh_error"])
        raise

    NearbyIncubator.objects.all().delete()
    NearbyIncubator.objects.bulk_create(
        [
            NearbyIncubator(
                place_id=result["place_id"],
                name=result["name"],
                address=result["address"],
                website=result["website"],
                rating=result["rating"],
                maps_url=result["maps_url"],
            )
            for result in results
            if result["place_id"]
        ]
    )

    settings_row.last_refreshed_at = timezone.now()
    settings_row.last_refresh_error = ""
    settings_row.save(update_fields=["last_refreshed_at", "last_refresh_error"])

    return {"processed": len(results)}
