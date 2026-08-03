from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand


# Copy this file into:
#   hcc/management/commands/preload_policy_settings.py
# Then update the model import in get_policy_setting_model() if your app path is different.
#
# Add local seed rows here when needed. Keep committed version empty.
POLICY_SETTINGS: list[dict[str, Any]] = []


def get_policy_setting_model():
    try:
        from hcc.models import PolicySettingRecord

        return PolicySettingRecord
    except ImportError:
        from backend.netcomply_scans.models import PolicySettingRecord

        return PolicySettingRecord


class Command(BaseCommand):
    help = "Preload policy settings into the NetComply scan database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default=getattr(settings, "NETCOMPLY_SCAN_DB_ALIAS", "default"),
            help="Database alias to write to.",
        )
        parser.add_argument(
            "--keep-existing",
            action="store_true",
            help="Append rows instead of clearing existing policy settings first.",
        )

    def handle(self, *args, **options):
        db_alias = options["database"]
        PolicySettingRecord = get_policy_setting_model()
        queryset = PolicySettingRecord.objects.using(db_alias)

        if not options["keep_existing"]:
            queryset.all().delete()

        if POLICY_SETTINGS:
            queryset.bulk_create([PolicySettingRecord(payload=row) for row in POLICY_SETTINGS])

        self.stdout.write(
            self.style.SUCCESS(f"Inserted {len(POLICY_SETTINGS)} policy setting(s) into {db_alias}.")
        )
