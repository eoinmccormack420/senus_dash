from django.db import migrations

# The three named Irish startup-ecosystem benchmarks from the original
# product brief. key is the stable identifier the frontend/tests key off
# of — title/description text can be edited later without touching that.
SEED_ITEMS = [
    {
        "key": "hpsu_status",
        "order": 1,
        "title": "Enterprise Ireland HPSU Status",
        "description": (
            "Meets Enterprise Ireland's High-Potential Start-Up criteria — an "
            "innovative, Irish-based business capable of creating 10+ jobs and "
            "reaching €1m+ in export sales within 3-4 years."
        ),
    },
    {
        "key": "euronext_access",
        "order": 2,
        "title": "Euronext Market Access",
        "description": (
            "Financial reporting meets the transparency and governance "
            "standards required for Euronext Growth market access."
        ),
    },
    {
        "key": "novaucd_engagement",
        "order": 3,
        "title": "NovaUCD Innovation Network",
        "description": (
            "Actively engaged with NovaUCD, UCD's innovation and "
            "technology-transfer hub in Dublin."
        ),
    },
]


def seed_items(apps, schema_editor):
    EcosystemChecklistItem = apps.get_model("board", "EcosystemChecklistItem")
    for item in SEED_ITEMS:
        EcosystemChecklistItem.objects.get_or_create(key=item["key"], defaults=item)


def remove_seeded_items(apps, schema_editor):
    EcosystemChecklistItem = apps.get_model("board", "EcosystemChecklistItem")
    EcosystemChecklistItem.objects.filter(key__in=[i["key"] for i in SEED_ITEMS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("board", "0014_ecosystemchecklistitem"),
    ]

    operations = [
        migrations.RunPython(seed_items, remove_seeded_items),
    ]
