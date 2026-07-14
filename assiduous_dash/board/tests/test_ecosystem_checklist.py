"""
Tests for the Irish Ecosystem Checklist: the seed data migration
(0015_seed_ecosystem_checklist), EcosystemChecklistItemViewSet's mixed
permissions (any authenticated user can GET, only admin can PATCH), and
that key/title/description stay fixed regardless of who's PATCHing.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.models import EcosystemChecklistItem


@pytest.mark.django_db
class TestSeedData:
    def test_three_items_seeded_with_expected_keys(self):
        keys = set(EcosystemChecklistItem.objects.values_list("key", flat=True))

        assert keys == {"hpsu_status", "euronext_access", "novaucd_engagement"}

    def test_seeded_items_default_to_not_started(self):
        assert all(
            item.status == "not_started" for item in EcosystemChecklistItem.objects.all()
        )


@pytest.mark.django_db
class TestEcosystemChecklistViewSetPermissions:
    def test_any_authenticated_user_can_list(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/ecosystem-checklist/")

        assert response.status_code == 200
        assert len(response.data) == 3

    def test_anonymous_user_cannot_list(self):
        client = APIClient()

        response = client.get("/api/ecosystem-checklist/")

        assert response.status_code == 401

    def test_non_admin_cannot_patch(self):
        item = EcosystemChecklistItem.objects.get(key="hpsu_status")
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch(f"/api/ecosystem-checklist/{item.id}/", {"status": "complete"}, format="json")

        assert response.status_code == 403

    def test_admin_can_patch_status_and_notes(self):
        item = EcosystemChecklistItem.objects.get(key="hpsu_status")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.patch(
            f"/api/ecosystem-checklist/{item.id}/",
            {"status": "in_progress", "notes": "Application submitted."},
            format="json",
        )

        assert response.status_code == 200
        item.refresh_from_db()
        assert item.status == "in_progress"
        assert item.notes == "Application submitted."
        assert item.updated_by == admin

    def test_key_and_title_are_not_mutable(self):
        item = EcosystemChecklistItem.objects.get(key="hpsu_status")
        original_title = item.title
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.patch(
            f"/api/ecosystem-checklist/{item.id}/",
            {"key": "hacked", "title": "Hacked Title"},
            format="json",
        )

        assert response.status_code == 200
        item.refresh_from_db()
        assert item.key == "hpsu_status"
        assert item.title == original_title
