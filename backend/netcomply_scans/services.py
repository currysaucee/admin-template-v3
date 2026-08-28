from __future__ import annotations

import json
import re
import ssl
import zipfile
from datetime import datetime, timezone as datetime_timezone
from pathlib import Path
from typing import Any
from xml.etree import ElementTree
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import dateparse, timezone

from .models import (
    ComplianceScanActualConfig,
    ComplianceScanBatch,
    ComplianceScanDevice,
    ComplianceScanFinding,
    DeploymentQueueItem,
    HCCRequestRecord,
    PolicySettingRecord,
    RemediationTemplateRecord,
    TemplateRequestRecord,
)


FALSE_STRINGS = {"false", "non-compliant", "non compliant", "failed", "fail", "no", "0"}
TRUE_STRINGS = {"true", "compliant", "passed", "pass", "yes", "1"}


HCC_CLEANUP_TABLES = [
    {
        "key": "scan_actual_configs",
        "label": "Scan actual configs",
        "tableName": ComplianceScanActualConfig._meta.db_table,
        "model": ComplianceScanActualConfig,
        "category": "Daily scan data",
        "defaultSelected": True,
    },
    {
        "key": "scan_findings",
        "label": "Scan findings",
        "tableName": ComplianceScanFinding._meta.db_table,
        "model": ComplianceScanFinding,
        "category": "Daily scan data",
        "defaultSelected": True,
    },
    {
        "key": "scan_devices",
        "label": "Scan devices",
        "tableName": ComplianceScanDevice._meta.db_table,
        "model": ComplianceScanDevice,
        "category": "Daily scan data",
        "defaultSelected": True,
    },
    {
        "key": "scan_batches",
        "label": "Scan batches",
        "tableName": ComplianceScanBatch._meta.db_table,
        "model": ComplianceScanBatch,
        "category": "Daily scan data",
        "defaultSelected": True,
    },
    {
        "key": "deployment_queue",
        "label": "Deployment queue",
        "tableName": DeploymentQueueItem._meta.db_table,
        "model": DeploymentQueueItem,
        "category": "Runtime workflow data",
        "defaultSelected": False,
    },
    {
        "key": "hcc_requests",
        "label": "HCC requests",
        "tableName": HCCRequestRecord._meta.db_table,
        "model": HCCRequestRecord,
        "category": "Runtime workflow data",
        "defaultSelected": False,
    },
    {
        "key": "template_requests",
        "label": "Template requests",
        "tableName": TemplateRequestRecord._meta.db_table,
        "model": TemplateRequestRecord,
        "category": "Admin data",
        "defaultSelected": False,
    },
    {
        "key": "remediation_templates",
        "label": "Remediation templates",
        "tableName": RemediationTemplateRecord._meta.db_table,
        "model": RemediationTemplateRecord,
        "category": "Admin data",
        "defaultSelected": False,
    },
    {
        "key": "policy_settings",
        "label": "Policy settings",
        "tableName": PolicySettingRecord._meta.db_table,
        "model": PolicySettingRecord,
        "category": "Admin data",
        "defaultSelected": False,
    },
]


def scan_db_alias() -> str:
    return getattr(settings, "HCC_SCAN_DB_ALIAS", "default")


def api_datetime(value: datetime | None = None) -> str:
    current = value or timezone.now()
    if timezone.is_naive(current):
        current = timezone.make_aware(current, timezone.get_current_timezone())
    return current.astimezone(datetime_timezone.utc).isoformat().replace("+00:00", "Z")


def scan_tmp_dir() -> Path:
    configured_dir = getattr(settings, "HCC_SCAN_TMP_DIR", None)
    if configured_dir:
        return Path(configured_dir)
    return Path(getattr(settings, "BASE_DIR", Path.cwd())) / "tmp" / "hcc-scans"


def snapshot_dir() -> Path:
    configured_dir = getattr(settings, "HCC_CONFIG_SNAPSHOT_DIR", None)
    if configured_dir:
        return Path(configured_dir)
    return Path(getattr(settings, "BASE_DIR", Path.cwd())) / "tmp" / "hcc-config-snapshots"


def deployment_worker_heartbeat_dir() -> Path:
    configured_dir = getattr(settings, "HCC_DEPLOYMENT_WORKER_HEARTBEAT_DIR", None)
    if configured_dir:
        return Path(configured_dir)
    return Path(getattr(settings, "BASE_DIR", Path.cwd())) / "tmp" / "hcc-deployment-workers"


def safe_snapshot_filename(hostname: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_.-]+", "-", hostname.strip()).strip("-").lower()
    return f"{normalized or 'device'}.txt"


def find_device_snapshot(hostname: str) -> tuple[str, str] | None:
    filename = safe_snapshot_filename(hostname)
    directory = snapshot_dir()
    candidate = directory / filename
    if candidate.is_file():
        return f"/api/HCCFix/scan/config-snapshots/{filename}", filename

    if not directory.exists():
        return None

    for snapshot_file in directory.glob("*.txt"):
        if snapshot_file.name.lower() == filename.lower():
            return f"/api/HCCFix/scan/config-snapshots/{snapshot_file.name}", snapshot_file.name
    return None


def resolve_snapshot_file(filename: str) -> Path | None:
    safe_filename = Path(filename).name
    directory = snapshot_dir().resolve()
    candidate = (directory / safe_filename).resolve()
    if directory not in candidate.parents and candidate != directory:
        return None
    if candidate.is_file():
        return candidate
    return None


def pick(obj: dict[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        if key in obj and obj[key] not in (None, ""):
            return obj[key]
    lowered = {str(key).lower(): value for key, value in obj.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value not in (None, ""):
            return value
    return default


def normalize_policy_id(value: Any) -> str:
    if isinstance(value, str):
        text = value.strip()
        match = re.search(r"([A-Za-z]{1,8})[-_\s]?(\d{1,4})", text)
        if match:
            return f"{match.group(1).upper()}{int(match.group(2)):03d}"
        return text.upper()
    return str(value).strip().upper()


def looks_like_policy_id(value: Any) -> bool:
    return bool(re.match(r"^[A-Za-z]{1,8}[-_\s]?\d{1,4}$", str(value).strip()))


def is_non_compliant(device: dict[str, Any]) -> bool:
    value = pick(device, "complyStatus", "complianceStatus", "isCompliant", "compliant", "status", default=None)
    if isinstance(value, bool):
        return value is False
    if isinstance(value, (int, float)):
        return value == 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in FALSE_STRINGS:
            return True
        if normalized in TRUE_STRINGS:
            return False
    return False


def payload_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        string_values = collect_payload_strings(value)
        if string_values:
            return "\n".join(string_values)
        return "\n".join(str(item) for item in value if item not in (None, ""))
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def collect_payload_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if isinstance(value, list):
        strings: list[str] = []
        for item in value:
            strings.extend(collect_payload_strings(item))
        return strings
    return []


def iter_payload_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        return
    if isinstance(value, list):
        for item in value:
            yield from iter_payload_dicts(item)


def normalize_keyed_payload(raw_value: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in iter_payload_dicts(raw_value):
        if isinstance(item, dict):
            keyed_policy_rows = [
                {"policy_id": normalize_policy_id(policy_id), "payload": payload_text(payload), "raw": {policy_id: payload}}
                for policy_id, payload in item.items()
                if looks_like_policy_id(policy_id)
            ]
            if keyed_policy_rows:
                rows.extend(keyed_policy_rows)
                continue

            policy_id = normalize_policy_id(pick(item, "id", "policyId", "policyNumber", "settingNumber", "identifier"))
            payload = pick(item, "payload", "expectedValue", "agreedSetting", "settingPayload", "expected", "rule", "description", "actualConfig", "config", default="")
            if policy_id:
                rows.append({"policy_id": policy_id, "payload": payload_text(payload), "raw": item})
    return rows


def dedupe_policy_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        policy_id = normalize_policy_id(row.get("policy_id"))
        if not policy_id:
            continue
        payload = str(row.get("payload") or "").strip()
        existing = grouped.setdefault(policy_id, {"policy_id": policy_id, "payloads": [], "raw_items": []})
        if payload and payload not in existing["payloads"]:
            existing["payloads"].append(payload)
        raw = row.get("raw")
        if raw not in existing["raw_items"]:
            existing["raw_items"].append(raw)

    deduped = []
    for item in grouped.values():
        raw_items = item["raw_items"]
        deduped.append({
            "policy_id": item["policy_id"],
            "payload": "\n\n".join(item["payloads"]),
            "raw": raw_items[0] if len(raw_items) == 1 else {"items": raw_items},
        })
    return deduped


def write_latest_payload(payload: list[dict[str, Any]], tmp_dir: Path, consumed_at: datetime | None = None) -> Path:
    tmp_dir.mkdir(parents=True, exist_ok=True)

    consumed_at = consumed_at or timezone.now()
    output_path = tmp_dir / "latest_compliance_scan.json"
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    (tmp_dir / "latest_consumed.json").write_text(
        json.dumps({"consumedAt": api_datetime(consumed_at), "payloadPath": str(output_path)}, indent=2),
        encoding="utf-8",
    )
    return output_path


def coerce_scan_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict) and isinstance(payload.get("devices"), list):
        return [item for item in payload["devices"] if isinstance(item, dict)]
    raise ValueError("Expected scan API response to be a JSON array of device scan objects")


def fetch_external_scan_payload() -> list[dict[str, Any]]:
    api_url = getattr(settings, "HCC_SCAN_API_URL", "")
    if not api_url:
        raise ValueError("HCC_SCAN_API_URL is not configured")

    method = str(getattr(settings, "HCC_SCAN_API_METHOD", "GET")).upper()
    request_payload = getattr(settings, "HCC_SCAN_API_PAYLOAD", None)
    timeout = int(getattr(settings, "HCC_SCAN_API_TIMEOUT", 60))
    headers = {
        "Accept": "application/json",
        **getattr(settings, "HCC_SCAN_API_HEADERS", {}),
    }
    token = getattr(settings, "HCC_SCAN_API_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = None
    if method != "GET" and request_payload is not None:
        data = json.dumps(request_payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    ssl_context = None
    if not bool(getattr(settings, "HCC_SCAN_API_VERIFY_SSL", True)):
        ssl_context = ssl._create_unverified_context()

    request = Request(api_url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout, context=ssl_context) as response:
            response_body = response.read().decode("utf-8-sig")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Scan API returned HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Unable to reach scan API: {exc.reason}") from exc

    return coerce_scan_payload(json.loads(response_body))


def run_daily_scan_import() -> dict[str, Any]:
    payload = fetch_external_scan_payload()
    latest_path = write_latest_payload(payload, scan_tmp_dir())
    batch = import_scan_payload(
        payload,
        latest_path,
        source=str(getattr(settings, "HCC_SCAN_SOURCE", "external-api")),
    )
    return {
        "batchId": batch.id,
        "source": batch.source,
        "payloadPath": str(latest_path),
        "deviceCount": batch.device_count,
        "nonCompliantDeviceCount": batch.non_compliant_device_count,
        "consumedAt": api_datetime(batch.consumed_at),
        "databaseAlias": scan_db_alias(),
    }


def default_mock_scan_payload_path() -> Path:
    return scan_tmp_dir() / "mock_scan_payload.json"


def import_scan_file(payload_path: Path | str, source: str = "file-import", consumed_at: datetime | None = None) -> dict[str, Any]:
    source_path = Path(payload_path)
    if not source_path.exists():
        raise FileNotFoundError(f"{source_path} does not exist")

    payload = coerce_scan_payload(json.loads(source_path.read_text(encoding="utf-8-sig")))
    consumed_at = consumed_at or timezone.now()
    latest_path = write_latest_payload(payload, scan_tmp_dir(), consumed_at=consumed_at)
    batch = import_scan_payload(payload, latest_path, source=source, consumed_at=consumed_at)
    return {
        "batchId": batch.id,
        "source": batch.source,
        "sourcePath": str(source_path),
        "payloadPath": str(latest_path),
        "deviceCount": batch.device_count,
        "nonCompliantDeviceCount": batch.non_compliant_device_count,
        "consumedAt": api_datetime(batch.consumed_at),
        "databaseAlias": scan_db_alias(),
    }


def run_mock_scan_import(payload_path: Path | str | None = None) -> dict[str, Any]:
    return import_scan_file(payload_path or default_mock_scan_payload_path(), source="mock-file")


def import_scan_payload(payload: list[dict[str, Any]], raw_payload_path: Path | str, source: str = "external-api", consumed_at: datetime | None = None) -> ComplianceScanBatch:
    consumed_at = consumed_at or timezone.now()
    db_alias = scan_db_alias()
    batch = ComplianceScanBatch.objects.using(db_alias).create(
        source=source,
        consumed_at=consumed_at,
        raw_payload_path=str(raw_payload_path),
        device_count=len(payload),
        non_compliant_device_count=sum(1 for item in payload if isinstance(item, dict) and is_non_compliant(item)),
    )
    policy_settings = {
        normalize_policy_id(value): policy_setting_payload(record)
        for record in PolicySettingRecord.objects.using(db_alias).all()
        for value in (record.setting_number, (record.payload or {}).get("id"), (record.payload or {}).get("settingNumber"))
        if value
    }

    for raw_device in payload:
        if not isinstance(raw_device, dict) or not is_non_compliant(raw_device):
            continue

        hostname = str(pick(raw_device, "hostname", "hostName", "device", "deviceName", "name")).strip()
        hardware_type = str(pick(raw_device, "hardwareType", "deviceType", "type", "platform")).strip()
        management_ip = str(pick(raw_device, "managementIp", "managementIP", "mgmtIp", "mgmtIP", "ipAddress", "ip")).strip()
        site = str(pick(raw_device, "site", "location", "siteCode")).strip()
        if not (hostname and hardware_type and management_ip and site):
            continue

        device = ComplianceScanDevice.objects.using(db_alias).create(
            batch=batch,
            hostname=hostname,
            hardware_type=hardware_type,
            management_ip=management_ip,
            site=site,
            role=str(pick(raw_device, "role", default="")),
            comply_status=False,
            raw_payload=raw_device,
        )

        for finding in dedupe_policy_rows(normalize_keyed_payload(pick(raw_device, "findings", "policies", "violations", "exceptions", default=[]))):
            policy_setting = policy_settings.get(normalize_policy_id(finding["policy_id"]), {})
            ComplianceScanFinding.objects.using(db_alias).create(
                device=device,
                policy_id=finding["policy_id"],
                policy_title=str(policy_setting.get("title") or ""),
                policy_type=str(policy_setting.get("standard") or ""),
                policy_description=str(policy_setting.get("description") or ""),
                expected_config=str(policy_setting.get("settingPayload") or finding["payload"]),
                finding_payload=finding["payload"],
                raw_payload=finding["raw"],
            )

        for config in dedupe_policy_rows(normalize_keyed_payload(pick(raw_device, "actualConfig", "actualConfigs", "configSnapshot", "runningConfig", "rawConfig", "configuration", default=[]))):
            ComplianceScanActualConfig.objects.using(db_alias).create(
                device=device,
                policy_id=config["policy_id"],
                current_config=config["payload"],
                config_payload=config["payload"],
                raw_payload=config["raw"],
            )

    return batch


def cleanup_duplicate_scan_policy_rows(dry_run: bool = True) -> dict[str, Any]:
    db_alias = scan_db_alias()
    summary: dict[str, Any] = {"databaseAlias": db_alias, "dryRun": dry_run, "findingRowsDeleted": 0, "actualConfigRowsDeleted": 0}

    for model, deleted_key, payload_field in (
        (ComplianceScanFinding, "findingRowsDeleted", "finding_payload"),
        (ComplianceScanActualConfig, "actualConfigRowsDeleted", "config_payload"),
    ):
        seen: dict[tuple[Any, str, str], int] = {}
        duplicate_ids: list[int] = []
        rows = model.objects.using(db_alias).order_by("device_id", "policy_id", "id").values("id", "device_id", "policy_id", payload_field, "raw_payload")
        for row in rows:
            key = (
                row["device_id"],
                normalize_policy_id(row["policy_id"]),
                str(row.get(payload_field) or "").strip(),
            )
            if key in seen:
                duplicate_ids.append(row["id"])
            else:
                seen[key] = row["id"]

        summary[deleted_key] = len(duplicate_ids)
        if duplicate_ids and not dry_run:
            model.objects.using(db_alias).filter(id__in=duplicate_ids).delete()

    return summary


def list_hcc_cleanup_tables() -> dict[str, Any]:
    db_alias = scan_db_alias()
    tables = []
    for table in HCC_CLEANUP_TABLES:
        row_count = table["model"].objects.using(db_alias).count()
        tables.append({
            "key": table["key"],
            "label": table["label"],
            "tableName": table["tableName"],
            "category": table["category"],
            "defaultSelected": table["defaultSelected"],
            "rowCount": row_count,
        })
    return {"databaseAlias": db_alias, "tables": tables}


def clear_hcc_tables(table_keys: list[str]) -> dict[str, Any]:
    db_alias = scan_db_alias()
    requested = {str(key).strip() for key in table_keys if str(key).strip()}
    allowed_by_key = {table["key"]: table for table in HCC_CLEANUP_TABLES}
    allowed_by_name = {table["tableName"]: table for table in HCC_CLEANUP_TABLES}
    selected = []
    invalid = []

    for key in requested:
        table = allowed_by_key.get(key) or allowed_by_name.get(key)
        if table:
            selected.append(table["key"])
        else:
            invalid.append(key)

    selected_keys = set(selected)
    cleared = []
    with transaction.atomic(using=db_alias):
        for table in HCC_CLEANUP_TABLES:
            if table["key"] not in selected_keys:
                continue
            queryset = table["model"].objects.using(db_alias).all()
            before_count = queryset.count()
            deleted_count, _ = queryset.delete()
            after_count = table["model"].objects.using(db_alias).count()
            cleared.append({
                "key": table["key"],
                "label": table["label"],
                "tableName": table["tableName"],
                "beforeCount": before_count,
                "deletedCount": deleted_count,
                "afterCount": after_count,
            })

    return {
        "databaseAlias": db_alias,
        "requested": list(requested),
        "invalid": invalid,
        "cleared": cleared,
        "tables": list_hcc_cleanup_tables()["tables"],
    }


def latest_devices_for_frontend() -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    if not ComplianceScanBatch.objects.using(db_alias).exists():
        return []

    devices: list[dict[str, Any]] = []
    seen_hostnames: set[str] = set()
    policy_settings: dict[str, dict[str, Any]] = {}
    for record in PolicySettingRecord.objects.using(db_alias).order_by("id"):
        payload = policy_setting_payload(record)
        for value in (payload.get("id"), payload.get("settingNumber")):
            normalized = normalize_policy_id(value)
            if normalized:
                policy_settings[normalized] = payload

    device_rows = ComplianceScanDevice.objects.using(db_alias).select_related("batch").prefetch_related("findings", "actual_configs").order_by("-batch__consumed_at", "-id")
    for device in device_rows:
        hostname_key = device.hostname.strip().lower()
        if hostname_key in seen_hostnames:
            continue
        seen_hostnames.add(hostname_key)

        config_by_policy = {normalize_policy_id(config.policy_id): config.config_payload for config in device.actual_configs.all()}
        snapshot = find_device_snapshot(device.hostname)
        config_snapshot_path, config_snapshot_filename = snapshot if snapshot else ("", "")
        findings = []
        for finding in device.findings.all():
            policy_id = normalize_policy_id(finding.policy_id)
            policy_setting = policy_settings.get(policy_id, {})
            title = policy_setting.get("title") or finding.policy_title or finding.policy_id
            description = policy_setting.get("description") or finding.policy_description or policy_setting.get("standard") or ""
            expected_value = policy_setting.get("settingPayload") or finding.expected_config or finding.finding_payload
            findings.append({
                "id": policy_id,
                "templateKey": policy_id,
                "title": title,
                "standard": policy_setting.get("standard") or finding.policy_type or "Imported compliance scan",
                "description": description,
                "reason": "",
                "currentValue": config_by_policy.get(policy_id, ""),
                "expectedValue": expected_value,
                "detectedAt": api_datetime(device.batch.consumed_at),
            })

        devices.append({
            "id": f"{device.hostname.lower().replace(' ', '-')}-{device.id}",
            "hostname": device.hostname,
            "role": device.role or "switch",
            "hardwareType": device.hardware_type,
            "managementIp": device.management_ip,
            "site": device.site,
            "lastScanned": api_datetime(device.batch.consumed_at),
            "complianceStatus": "Non-Compliant",
            "configSnapshotPath": config_snapshot_path,
            "configSnapshotFilename": config_snapshot_filename,
            "findings": findings,
        })
    return devices


def policy_setting_payload(record: PolicySettingRecord) -> dict[str, Any]:
    payload = record.payload or {}
    return {
        **payload,
        "id": payload.get("id") or record.setting_number,
        "settingNumber": payload.get("settingNumber") or record.setting_number,
        "title": payload.get("title") or record.title,
        "settingPayload": payload.get("settingPayload") or record.setting_payload,
        "standard": payload.get("standard") or record.standard,
        "description": payload.get("description") or record.description,
        "updatedBy": payload.get("updatedBy") or record.updated_by,
        "createdAt": payload.get("createdAt") or api_datetime(record.created_at),
        "updatedAt": payload.get("updatedAt") or api_datetime(record.updated_at),
    }


def policy_setting_fields(payload: dict[str, Any]) -> dict[str, Any]:
    setting_number = str(payload.get("settingNumber") or payload.get("id") or "").strip()
    return {
        "setting_number": setting_number,
        "title": str(payload.get("title") or setting_number),
        "setting_payload": str(payload.get("settingPayload") or ""),
        "standard": str(payload.get("standard") or ""),
        "description": str(payload.get("description") or ""),
        "updated_by": str(payload.get("updatedBy") or ""),
        "payload": {**payload, "id": str(payload.get("id") or setting_number), "settingNumber": setting_number},
    }


def list_policy_settings_for_frontend() -> list[dict[str, Any]]:
    return [policy_setting_payload(record) for record in PolicySettingRecord.objects.using(scan_db_alias()).order_by("setting_number", "id")]


def replace_policy_settings(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    PolicySettingRecord.objects.using(db_alias).all().delete()
    PolicySettingRecord.objects.using(db_alias).bulk_create([PolicySettingRecord(**policy_setting_fields(payload)) for payload in payloads if str(payload.get("id") or payload.get("settingNumber") or "").strip()])
    return list_policy_settings_for_frontend()


def upsert_policy_settings(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    for payload in payloads:
        setting_id = str(payload.get("id") or payload.get("settingNumber") or "").strip()
        if not setting_id:
            continue
        fields = policy_setting_fields({**payload, "id": setting_id, "settingNumber": str(payload.get("settingNumber") or setting_id)})
        record = PolicySettingRecord.objects.using(db_alias).filter(Q(setting_number=fields["setting_number"]) | Q(payload__id=setting_id) | Q(payload__settingNumber=setting_id)).first()
        if record:
            for key, value in fields.items():
                setattr(record, key, value)
            record.save(using=db_alias)
        else:
            PolicySettingRecord.objects.using(db_alias).create(**fields)
    return list_policy_settings_for_frontend()


def delete_policy_settings(setting_ids: list[str]) -> list[dict[str, Any]]:
    normalized_ids = [str(setting_id).strip() for setting_id in setting_ids if str(setting_id).strip()]
    if normalized_ids:
        PolicySettingRecord.objects.using(scan_db_alias()).filter(Q(setting_number__in=normalized_ids) | Q(payload__id__in=normalized_ids) | Q(payload__settingNumber__in=normalized_ids)).delete()
    return list_policy_settings_for_frontend()


def derive_policy_type(title: str, expected_config: str) -> str:
    text = f"{title} {expected_config}".lower()
    if re.search(r"password|secret|credential|username", text):
        return "Password Policy"
    if re.search(r"telnet|http|https|service|port|daemon", text):
        return "Unused / Insecure Services"
    if re.search(r"tacacs|aaa|authentication|authorization|accounting", text):
        return "Authentication Services"
    if "snmp" in text:
        return "SNMP"
    if re.search(r"syslog|logging|log ", text):
        return "Logging"
    if re.search(r"ntp|time", text):
        return "Time Synchronization"
    if "banner" in text:
        return "Banner"
    if re.search(r"acl|access-list|access group|access-group|control-plane", text):
        return "Access Control"
    if re.search(r"ospf|vrf|routing|route", text):
        return "Routing"
    return "General Policy"


def extract_policy_settings_from_docx(file_obj: Any) -> list[dict[str, Any]]:
    with zipfile.ZipFile(file_obj) as docx_file:
        document_xml = docx_file.read("word/document.xml")

    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    root = ElementTree.fromstring(document_xml)
    lines: list[str] = []
    for paragraph in root.findall(".//w:p", namespace):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace)).strip()
        if text:
            lines.append(re.sub(r"\s+", " ", text))

    policies: list[dict[str, Any]] = []
    policy_pattern = re.compile(r"\b([A-Za-z]{1,5})[-_\s]?(\d{1,4})\b")
    for index, line in enumerate(lines):
        match = policy_pattern.search(line)
        if not match:
            continue
        setting_number = f"{match.group(1).upper()}{int(match.group(2)):03d}"
        title = line.replace(match.group(0), "").strip(" :-") or setting_number
        context_lines = lines[index + 1:index + 5]
        expected_lines = [item for item in context_lines if re.search(r"must|exist|configured|disabled|enabled|below line", item, re.IGNORECASE)]
        expected_config = "\n".join(expected_lines) or "\n".join(context_lines[:2])
        policies.append({
            "id": setting_number,
            "settingNumber": setting_number,
            "title": title,
            "settingPayload": expected_config,
            "standard": derive_policy_type(title, expected_config),
            "description": "",
            "createdAt": api_datetime(timezone.now()),
        })

    deduped: dict[str, dict[str, Any]] = {}
    for policy in policies:
        deduped[policy["id"]] = policy
    return list(deduped.values())


def template_payload(record: RemediationTemplateRecord) -> dict[str, Any]:
    payload = record.payload or {}
    return {
        **payload,
        "key": payload.get("key") or record.template_key,
        "policySettingId": payload.get("policySettingId") or record.policy_setting_id,
        "findingName": payload.get("findingName") or record.finding_name,
        "agreedSetting": payload.get("agreedSetting") or record.agreed_setting,
        "standard": payload.get("standard") or record.standard,
        "hardwareTypes": payload.get("hardwareTypes") or record.hardware_types,
        "implementationCommands": payload.get("implementationCommands") or record.implementation_commands,
        "failureBehaviour": payload.get("failureBehaviour") or record.failure_behaviour,
        "approvalStatus": payload.get("approvalStatus") or record.approval_status,
        "updatedAt": payload.get("updatedAt") or api_datetime(record.updated_at),
    }


def template_fields(payload: dict[str, Any], fallback_key: str) -> dict[str, Any]:
    template_key = str(payload.get("key") or fallback_key)
    return {
        "template_key": template_key,
        "policy_setting_id": str(payload.get("policySettingId") or ""),
        "finding_name": str(payload.get("findingName") or ""),
        "agreed_setting": str(payload.get("agreedSetting") or ""),
        "standard": str(payload.get("standard") or ""),
        "hardware_types": payload.get("hardwareTypes") if isinstance(payload.get("hardwareTypes"), list) else [],
        "implementation_commands": payload.get("implementationCommands") if isinstance(payload.get("implementationCommands"), list) else [],
        "failure_behaviour": str(payload.get("failureBehaviour") or ""),
        "approval_status": str(payload.get("approvalStatus") or "Pending Approval"),
        "payload": {**payload, "key": template_key},
    }


def list_templates_for_frontend() -> list[dict[str, Any]]:
    return [template_payload(record) for record in RemediationTemplateRecord.objects.using(scan_db_alias()).order_by("-updated_at", "-id")]


def replace_templates(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    RemediationTemplateRecord.objects.using(db_alias).all().delete()
    RemediationTemplateRecord.objects.using(db_alias).bulk_create([
        RemediationTemplateRecord(**template_fields(payload, f"template-{index}"))
        for index, payload in enumerate(payloads, start=1)
    ])
    return list_templates_for_frontend()


def template_request_payload(record: TemplateRequestRecord) -> dict[str, Any]:
    payload = record.payload or {}
    return {
        **payload,
        "id": payload.get("id") or record.request_id,
        "templateKey": payload.get("templateKey") or record.template_key,
        "findingName": payload.get("findingName") or record.finding_name,
        "hardwareType": payload.get("hardwareType") or record.hardware_type,
        "policySettingTitle": payload.get("policySettingTitle") or record.policy_setting_title,
        "requestor": payload.get("requestor") or record.requestor,
        "submitterComment": payload.get("submitterComment") or record.submitter_comment,
        "status": payload.get("status") or record.status,
        "reviewer": payload.get("reviewer") or record.reviewer,
        "reviewNote": payload.get("reviewNote") or record.review_note,
        "submittedAt": payload.get("submittedAt") or api_datetime(record.created_at),
    }


def template_request_fields(payload: dict[str, Any], fallback_id: str) -> dict[str, Any]:
    request_id = str(payload.get("id") or fallback_id)
    return {
        "request_id": request_id,
        "template_key": str(payload.get("templateKey") or ""),
        "finding_name": str(payload.get("findingName") or ""),
        "hardware_type": str(payload.get("hardwareType") or ""),
        "policy_setting_title": str(payload.get("policySettingTitle") or ""),
        "requestor": str(payload.get("requestor") or ""),
        "submitter_comment": str(payload.get("submitterComment") or ""),
        "status": str(payload.get("status") or "Pending Approval"),
        "reviewer": str(payload.get("reviewer") or ""),
        "review_note": str(payload.get("reviewNote") or ""),
        "payload": {**payload, "id": request_id},
    }


def list_template_requests_for_frontend() -> list[dict[str, Any]]:
    return [template_request_payload(record) for record in TemplateRequestRecord.objects.using(scan_db_alias()).order_by("-updated_at", "-id")]


def replace_template_requests(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    TemplateRequestRecord.objects.using(db_alias).all().delete()
    TemplateRequestRecord.objects.using(db_alias).bulk_create([
        TemplateRequestRecord(**template_request_fields(payload, f"request-{index}"))
        for index, payload in enumerate(payloads, start=1)
    ])
    return list_template_requests_for_frontend()


def hcc_request_payload(record: HCCRequestRecord) -> dict[str, Any]:
    payload = record.payload or {}
    implementation_time = getattr(record, "implementation_time", None)
    return {
        **payload,
        "id": payload.get("id") or record.request_id,
        "crNumber": payload.get("crNumber") or record.external_change_id,
        "requestor": payload.get("requestor") or record.requestor,
        "requestorRole": payload.get("requestorRole") or record.requestor_role,
        "plannedStart": payload.get("plannedStart") or format_implementation_time(implementation_time) or record.implementation_date,
        "plannedEnd": payload.get("plannedEnd") or "",
        "status": payload.get("status") or record.status,
        "implementationPlan": payload.get("implementationPlan") or record.implementation_plan,
        "backoutPlan": payload.get("backoutPlan") or record.backout_plan,
        "createdAt": payload.get("createdAt") or api_datetime(record.created_at),
    }


def parse_implementation_time(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value or "").strip()
        parsed = dateparse.parse_datetime(text) or dateparse.parse_date(text)
        if parsed and not isinstance(parsed, datetime):
            parsed = datetime.combine(parsed, datetime.min.time())
        if not parsed:
            for pattern in ("%d %b %Y, %H:%M", "%d %b %Y, %I:%M %p", "%b %d, %Y, %H:%M", "%b %d, %Y, %I:%M %p", "%b %d, %Y %I:%M %p"):
                try:
                    parsed = datetime.strptime(text, pattern)
                    break
                except ValueError:
                    continue
    if not parsed:
        parsed = timezone.now()
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def format_implementation_time(value: Any) -> str:
    if not isinstance(value, datetime):
        return ""
    return api_datetime(value)


def hcc_request_fields(payload: dict[str, Any], fallback_id: str) -> dict[str, Any]:
    request_id = str(payload.get("id") or fallback_id)
    devices = payload.get("devices") if isinstance(payload.get("devices"), list) else []
    finding_count = sum(len(device.get("findings", [])) for device in devices if isinstance(device, dict))
    fields = {
        "request_id": request_id,
        "external_change_id": str(payload.get("crNumber") or ""),
        "requestor": str(payload.get("requestor") or ""),
        "requestor_role": str(payload.get("requestorRole") or ""),
        "implementation_date": str(payload.get("plannedStart") or ""),
        "status": str(payload.get("status") or "Pending Approval"),
        "device_count": len(devices),
        "finding_count": finding_count,
        "implementation_plan": str(payload.get("implementationPlan") or ""),
        "backout_plan": str(payload.get("backoutPlan") or ""),
        "payload": {**payload, "id": request_id},
    }
    if any(field.name == "implementation_time" for field in HCCRequestRecord._meta.fields):
        fields["implementation_time"] = parse_implementation_time(payload.get("implementationTime") or payload.get("plannedStart"))
    return fields


def list_tickets_for_frontend() -> list[dict[str, Any]]:
    return [hcc_request_payload(record) for record in HCCRequestRecord.objects.using(scan_db_alias()).order_by("-updated_at", "-id")]


def replace_tickets(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    HCCRequestRecord.objects.using(db_alias).all().delete()
    HCCRequestRecord.objects.using(db_alias).bulk_create([
        HCCRequestRecord(**hcc_request_fields(payload, f"request-{index}"))
        for index, payload in enumerate(payloads, start=1)
    ])
    return list_tickets_for_frontend()


def upsert_ticket(payload: dict[str, Any]) -> dict[str, Any]:
    request_id = str(payload.get("id") or "")
    if not request_id:
        raise ValueError("Request payload requires id")
    fields = hcc_request_fields(payload, request_id)
    HCCRequestRecord.objects.using(scan_db_alias()).update_or_create(request_id=request_id, defaults=fields)
    return hcc_request_payload(HCCRequestRecord.objects.using(scan_db_alias()).get(request_id=request_id))


def set_ticket_status(ticket_id: str, status: str) -> dict[str, Any]:
    db_alias = scan_db_alias()
    hcc_request = HCCRequestRecord.objects.using(db_alias).filter(request_id=ticket_id).first()
    if not hcc_request:
        raise ValueError(f"Request {ticket_id} was not found")
    hcc_request.status = status
    hcc_request.payload = {**hcc_request.payload, "status": status}
    hcc_request.save(using=db_alias)
    return hcc_request_payload(hcc_request)


def update_hcc_request_payload_status(request_id: str, payload: dict[str, Any], status: str) -> None:
    HCCRequestRecord.objects.using(scan_db_alias()).filter(request_id=request_id).update(
        status=status,
        payload={**payload, "status": status},
    )


def serialize_deployment_queue_item(item: DeploymentQueueItem) -> dict[str, Any]:
    device_count = len(item.execution_plan.get("devices", [])) if isinstance(item.execution_plan, dict) else 0
    policy_count = sum(
        len(device.get("findings", []))
        for device in item.execution_plan.get("devices", [])
        if isinstance(device, dict)
    ) if isinstance(item.execution_plan, dict) else 0
    return {
        "queueId": item.queue_id,
        "ticketId": item.ticket_id,
        "status": item.status,
        "priority": item.priority,
        "queuedBy": item.ticket_payload.get("queuedBy", ""),
        "deviceCount": device_count,
        "policyCount": policy_count,
        "queuedAt": api_datetime(item.queued_at),
        "availableAt": api_datetime(item.available_at),
        "lockedAt": api_datetime(item.locked_at) if item.locked_at else "",
        "lockedBy": item.locked_by,
        "startedAt": api_datetime(item.started_at) if item.started_at else "",
        "completedAt": api_datetime(item.completed_at) if item.completed_at else "",
        "attemptCount": item.attempt_count,
        "lastError": item.last_error,
        "ticket": item.ticket_payload,
        "executionPlan": item.execution_plan,
        "result": item.result_payload,
    }


def list_deployment_queue_for_frontend() -> list[dict[str, Any]]:
    status_order = {"Queued": 0, "Processing": 1, "Failed": 2, "Skipped": 2, "Complete": 2}
    items = [
        serialize_deployment_queue_item(item)
        for item in DeploymentQueueItem.objects.using(scan_db_alias()).order_by("priority", "queued_at", "id")[:200]
    ]
    return sorted(items, key=lambda item: (status_order.get(str(item.get("status")), 3), item.get("priority", 100), item.get("queuedAt", "")))


def list_deployment_worker_heartbeats() -> list[dict[str, Any]]:
    directory = deployment_worker_heartbeat_dir()
    if not directory.exists():
        return []

    workers: list[dict[str, Any]] = []
    for heartbeat_file in directory.glob("*.json"):
        try:
            payload = json.loads(heartbeat_file.read_text(encoding="utf-8"))
        except Exception:
            payload = {"workerId": heartbeat_file.stem, "status": "Unreadable", "lastSeenAt": ""}
        workers.append({
            "workerId": str(payload.get("workerId") or heartbeat_file.stem),
            "status": str(payload.get("status") or "Unknown"),
            "lastSeenAt": str(payload.get("lastSeenAt") or ""),
            "detail": str(payload.get("detail") or ""),
            "processedCount": int(payload.get("processedCount") or 0),
            "lastQueueId": str(payload.get("lastQueueId") or ""),
        })
    return sorted(workers, key=lambda worker: worker.get("workerId", ""))


def enqueue_ticket_for_deployment(ticket_id: str, actor: str = "Current User") -> dict[str, Any]:
    db_alias = scan_db_alias()
    hcc_request = HCCRequestRecord.objects.using(db_alias).filter(request_id=ticket_id).first()
    if not hcc_request:
        raise ValueError(f"Request {ticket_id} was not found")

    existing = DeploymentQueueItem.objects.using(db_alias).filter(ticket_id=ticket_id, status__in=["Queued", "Processing"]).order_by("-queued_at").first()
    if existing:
        return serialize_deployment_queue_item(existing)

    now = timezone.now()
    queue_id = f"DQ-{now.strftime('%Y%m%d%H%M%S')}-{ticket_id}"
    ticket_payload = {**hcc_request_payload(hcc_request), "status": "Queued", "queuedBy": actor}
    execution_plan = build_deployment_execution_plan(ticket_payload)
    hcc_request.status = "Queued"
    hcc_request.payload = ticket_payload
    hcc_request.save(using=db_alias)
    item = DeploymentQueueItem.objects.using(db_alias).create(
        queue_id=queue_id,
        ticket_id=ticket_id,
        ticket_payload=ticket_payload,
        execution_plan=execution_plan,
        status="Queued",
        queued_at=now,
        available_at=now,
    )
    return serialize_deployment_queue_item(item)


def find_latest_device_for_ticket(ticket_device: dict[str, Any], latest_devices: list[dict[str, Any]]) -> dict[str, Any] | None:
    device_id = str(ticket_device.get("deviceId") or "").strip()
    hostname = str(ticket_device.get("hostname") or "").strip().lower()
    return next(
        (
            device for device in latest_devices
            if str(device.get("id") or "") == device_id or str(device.get("hostname") or "").strip().lower() == hostname
        ),
        None,
    )


def list_approved_templates() -> list[dict[str, Any]]:
    return [
        record.payload
        for record in RemediationTemplateRecord.objects.using(scan_db_alias()).all()
        if record.payload.get("approvalStatus") == "Approved"
    ]


def template_matches_queue_finding(template: dict[str, Any], ticket_device: dict[str, Any], finding: dict[str, Any]) -> bool:
    hardware_type = str(ticket_device.get("hardwareType") or "")
    if hardware_type not in template.get("hardwareTypes", []):
        return False
    finding_refs = {
        normalize_policy_id(finding.get("id")),
        normalize_policy_id(finding.get("templateKey")),
    }
    template_refs = {
        normalize_policy_id(template.get("key")),
        normalize_policy_id(template.get("policySettingId")),
    }
    return bool(finding_refs.intersection(template_refs))


def resolve_queue_template(ticket_device: dict[str, Any], finding: dict[str, Any], templates: list[dict[str, Any]]) -> dict[str, Any] | None:
    return next((template for template in templates if template_matches_queue_finding(template, ticket_device, finding)), None)


def build_deployment_execution_plan(ticket_payload: dict[str, Any]) -> dict[str, Any]:
    latest_devices = latest_devices_for_frontend()
    templates = list_approved_templates()
    planned_devices: list[dict[str, Any]] = []

    for ticket_device in ticket_payload.get("devices", []):
        latest_device = find_latest_device_for_ticket(ticket_device, latest_devices)
        latest_finding_refs = {
            normalize_policy_id(ref)
            for finding in (latest_device.get("findings", []) if latest_device else [])
            for ref in (finding.get("id"), finding.get("templateKey"))
            if ref
        }
        planned_findings: list[dict[str, Any]] = []
        for finding in ticket_device.get("findings", []):
            finding_ref = normalize_policy_id(finding.get("id") or finding.get("templateKey"))
            template = resolve_queue_template(ticket_device, finding, templates)
            commands = template.get("implementationCommands", []) if template else []
            if not latest_device:
                status = "Skipped"
                reason = "Device is not present in the latest non-compliance scan."
            elif finding_ref not in latest_finding_refs:
                status = "Skipped"
                reason = "Policy is no longer detected as non-compliant in the latest scan."
            elif not commands:
                status = "Skipped"
                reason = "No approved executable template is available for this policy and hardware type."
            else:
                status = "Pending Execution"
                reason = "Policy is still non-compliant and commands are ready for the executor."
            planned_findings.append({
                "policyId": finding_ref,
                "title": finding.get("title") or finding_ref,
                "status": status,
                "reason": reason,
                "implementationCommands": commands,
            })
        planned_devices.append({
            "hostname": ticket_device.get("hostname"),
            "managementIp": ticket_device.get("managementIp"),
            "hardwareType": ticket_device.get("hardwareType"),
            "findings": planned_findings,
        })

    return {"ticketId": ticket_payload.get("id"), "devices": planned_devices}


def call_deployment_executor(plan: dict[str, Any]) -> dict[str, Any]:
    executor_url = getattr(settings, "HCC_DEPLOYMENT_EXECUTOR_URL", "")
    if not executor_url:
        return {"mode": "dry-run", "detail": "No executor URL configured.", "plan": plan}

    execution_plan = {
        **plan,
        "devices": [
            {
                **device,
                "findings": [
                    finding
                    for finding in device.get("findings", [])
                    if finding.get("status") == "Pending Execution"
                ],
            }
            for device in plan.get("devices", [])
        ],
    }
    body = json.dumps(execution_plan).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    headers.update(getattr(settings, "HCC_DEPLOYMENT_EXECUTOR_HEADERS", {}))
    request = Request(executor_url, data=body, headers=headers, method="POST")
    with urlopen(request, timeout=getattr(settings, "HCC_DEPLOYMENT_EXECUTOR_TIMEOUT", 60)) as response:
        response_body = response.read().decode("utf-8")
    return json.loads(response_body) if response_body else {"detail": "Executor returned an empty response."}


def expected_execution_command_count(plan: dict[str, Any]) -> int:
    return sum(
        len(finding.get("implementationCommands", []))
        for device in plan.get("devices", [])
        for finding in device.get("findings", [])
        if finding.get("status") == "Pending Execution"
    )


def validate_executor_result(result: dict[str, Any], expected_command_count: int) -> None:
    mode = str(result.get("mode") or "").lower()
    if expected_command_count > 0 and mode in {"dry-run", "simulate"}:
        raise RuntimeError("Deployment executor did not run commands. Configure the executor URL and enable local execution for this test.")

    results = result.get("results")
    if expected_command_count > 0 and not isinstance(results, list):
        raise RuntimeError("Deployment executor did not return per-command results.")

    if isinstance(results, list) and len(results) < expected_command_count:
        raise RuntimeError(f"Deployment executor returned {len(results)} command result(s), expected {expected_command_count}.")

    failed_results = [
        row for row in (results or [])
        if str(row.get("status") or "").lower() != "executed" or int(row.get("returnCode") or 0) != 0
    ]
    if failed_results:
        first_failure = failed_results[0]
        raise RuntimeError(str(first_failure.get("stderr") or first_failure.get("stdout") or first_failure.get("command") or "A command failed."))


def claim_next_deployment_queue_item(worker_id: str) -> DeploymentQueueItem | None:
    db_alias = scan_db_alias()
    with transaction.atomic(using=db_alias):
        queryset = DeploymentQueueItem.objects.using(db_alias).select_for_update(skip_locked=True).filter(
            status="Queued",
            available_at__lte=timezone.now(),
        ).order_by("priority", "queued_at", "id")
        item = queryset.first()
        if not item:
            return None
        item.status = "Processing"
        item.locked_by = worker_id
        item.locked_at = timezone.now()
        item.started_at = timezone.now()
        item.attempt_count += 1
        item.save(using=db_alias)
        update_hcc_request_payload_status(item.ticket_id, item.ticket_payload, "In Progress")
        return item


def process_next_deployment_queue_item(worker_id: str = "netcomply-worker") -> dict[str, Any]:
    db_alias = scan_db_alias()
    item = claim_next_deployment_queue_item(worker_id)
    if not item:
        return {"claimed": False, "detail": "No queued deployment item is available."}

    try:
        plan = item.execution_plan or build_deployment_execution_plan(item.ticket_payload)
        all_findings = [finding for device in plan["devices"] for finding in device["findings"]]
        executable_count = sum(1 for finding in all_findings if finding["status"] == "Pending Execution")
        result = call_deployment_executor(plan)
        validate_executor_result(result, expected_execution_command_count(plan))
        item.status = "Skipped" if all_findings and executable_count == 0 else "Complete"
        item.result_payload = result
        item.completed_at = timezone.now()
        item.last_error = ""
        item.save(using=db_alias)
        final_status = "Complete" if item.status == "Complete" else "Skipped"
        update_hcc_request_payload_status(item.ticket_id, item.ticket_payload, final_status)
        return {"claimed": True, "queueItem": serialize_deployment_queue_item(item)}
    except Exception as exc:
        item.status = "Failed"
        item.last_error = str(exc)
        item.completed_at = timezone.now()
        item.save(using=db_alias)
        update_hcc_request_payload_status(item.ticket_id, item.ticket_payload, "Failed")
        return {"claimed": True, "queueItem": serialize_deployment_queue_item(item)}
