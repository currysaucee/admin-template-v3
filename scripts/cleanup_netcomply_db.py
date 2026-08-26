"""
Standalone cleanup utility for NetComply SQLite tables.

This script does not import Django settings or .env files. Edit DB_PATH,
APPLY_CHANGES, and TABLE_CLEANUP below, then run:

    python scripts/cleanup_netcomply_db.py
"""

from __future__ import annotations

import sqlite3
from pathlib import Path


DB_PATH = Path(r"C:\code\netcomply-v3-clean-20260605001016\tmp\netcomply_scans.sqlite")
APPLY_CHANGES = False

TABLE_CLEANUP = {
    # Daily scan data. Usually safe to clear when you want a fresh import.
    "netcomply_compliance_scan_actual_config": True,
    "netcomply_compliance_scan_finding": True,
    "netcomply_compliance_scan_device": True,
    "netcomply_compliance_scan_batch": True,

    # Runtime workflow data. Keep False unless you want to reset the workflow.
    "netcomply_hcc_request": False,
    "netcomply_deployment_queue": False,

    # Admin/reference data. Usually keep these.
    "netcomply_policy_setting": False,
    "netcomply_remediation_template": False,
    "netcomply_template_request": False,
}

DELETE_ORDER = [
    "netcomply_compliance_scan_actual_config",
    "netcomply_compliance_scan_finding",
    "netcomply_compliance_scan_device",
    "netcomply_compliance_scan_batch",
    "netcomply_deployment_queue",
    "netcomply_hcc_request",
    "netcomply_template_request",
    "netcomply_remediation_template",
    "netcomply_policy_setting",
]


def table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", (table_name,))
    return cursor.fetchone() is not None


def table_count(cursor: sqlite3.Cursor, table_name: str) -> int:
    cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
    return int(cursor.fetchone()[0])


def reset_sqlite_sequence(cursor: sqlite3.Cursor, table_name: str) -> None:
    if table_exists(cursor, "sqlite_sequence"):
        cursor.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table_name,))


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")

    print(f"Database: {DB_PATH}")
    print(f"Apply changes: {APPLY_CHANGES}")
    print("")

    connection = sqlite3.connect(DB_PATH)
    try:
        cursor = connection.cursor()
        for table_name in DELETE_ORDER:
            should_clean = TABLE_CLEANUP.get(table_name, False)
            if not table_exists(cursor, table_name):
                print(f"Missing  {table_name}")
                continue

            before_count = table_count(cursor, table_name)
            if should_clean:
                print(f"Clean    {table_name}: {before_count} row(s)")
                if APPLY_CHANGES:
                    cursor.execute(f'DELETE FROM "{table_name}"')
                    reset_sqlite_sequence(cursor, table_name)
            else:
                print(f"Keep     {table_name}: {before_count} row(s)")

        if APPLY_CHANGES:
            connection.commit()
            print("")
            print("Cleanup applied.")
        else:
            connection.rollback()
            print("")
            print("Dry run only. Set APPLY_CHANGES = True to delete selected tables.")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
