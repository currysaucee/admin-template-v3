from __future__ import annotations

import json
import re
import ssl
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from .models import (
    ComplianceScanActualConfig,
    ComplianceScanBatch,
    ComplianceScanDevice,
    ComplianceScanFinding,
    PolicySettingRecord,
    RemediationTemplateRecord,
    RemediationTicketRecord,
    TemplateRequestRecord,
)


FALSE_STRINGS = {"false", "non-compliant", "non compliant", "failed", "fail", "no", "0"}
TRUE_STRINGS = {"true", "compliant", "passed", "pass", "yes", "1"}


def scan_db_alias() -> str:
    return getattr(settings, "NETCOMPLY_SCAN_DB_ALIAS", "default")


def scan_tmp_dir() -> Path:
    configured_dir = getattr(settings, "NETCOMPLY_SCAN_TMP_DIR", None)
    if configured_dir:
        return Path(configured_dir)
    return Path(getattr(settings, "BASE_DIR", Path.cwd())) / "tmp" / "netcomply-scans"


def snapshot_dir() -> Path:
    configured_dir = getattr(settings, "NETCOMPLY_CONFIG_SNAPSHOT_DIR", None)
    if configured_dir:
        return Path(configured_dir)
    return Path(getattr(settings, "BASE_DIR", Path.cwd())) / "tmp" / "netcomply-config-snapshots"


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
        match = re.search(r"([A-Za-z]{1,4})[-_\s]?(\d{1,4})", text)
        if match:
            return f"{match.group(1).upper()}{int(match.group(2)):03d}"
        return text.upper()
    return str(value).strip().upper()


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
        string_values = [item.strip() for item in value if isinstance(item, str) and item.strip()]
        if string_values:
            return "\n".join(string_values)
        return "\n".join(str(item) for item in value if item not in (None, ""))
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def normalize_keyed_payload(raw_value: Any) -> list[dict[str, Any]]:
    if isinstance(raw_value, dict):
        iterable = [{key: value} for key, value in raw_value.items()]
    elif isinstance(raw_value, list):
        iterable = raw_value
    else:
        iterable = []

    rows: list[dict[str, Any]] = []
    for item in iterable:
        if isinstance(item, dict) and len(item) == 1:
            policy_id, payload = next(iter(item.items()))
            rows.append({"policy_id": normalize_policy_id(policy_id), "payload": payload_text(payload), "raw": item})
        elif isinstance(item, dict):
            policy_id = normalize_policy_id(pick(item, "id", "policyId", "policyNumber", "settingNumber", "identifier"))
            payload = pick(item, "payload", "expectedValue", "agreedSetting", "settingPayload", "expected", "rule", "description", "actualConfig", "config", default="")
            if policy_id:
                rows.append({"policy_id": policy_id, "payload": payload_text(payload), "raw": item})
    return rows


def write_latest_payload(payload: list[dict[str, Any]], tmp_dir: Path, consumed_at: datetime | None = None) -> Path:
    tmp_dir.mkdir(parents=True, exist_ok=True)
    for old_file in tmp_dir.glob("latest_compliance_scan_*.json"):
        old_file.unlink()

    consumed_at = consumed_at or timezone.now()
    filename = f"latest_compliance_scan_{consumed_at.strftime('%Y%m%dT%H%M%S')}.json"
    output_path = tmp_dir / filename
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    (tmp_dir / "latest_consumed.json").write_text(
        json.dumps({"consumedAt": consumed_at.isoformat(), "payloadPath": str(output_path)}, indent=2),
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
    api_url = getattr(settings, "NETCOMPLY_SCAN_API_URL", "")
    if not api_url:
        raise ValueError("NETCOMPLY_SCAN_API_URL is not configured")

    method = str(getattr(settings, "NETCOMPLY_SCAN_API_METHOD", "GET")).upper()
    request_payload = getattr(settings, "NETCOMPLY_SCAN_API_PAYLOAD", None)
    timeout = int(getattr(settings, "NETCOMPLY_SCAN_API_TIMEOUT", 60))
    headers = {
        "Accept": "application/json",
        **getattr(settings, "NETCOMPLY_SCAN_API_HEADERS", {}),
    }
    token = getattr(settings, "NETCOMPLY_SCAN_API_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = None
    if method != "GET" and request_payload is not None:
        data = json.dumps(request_payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    ssl_context = None
    if not bool(getattr(settings, "NETCOMPLY_SCAN_API_VERIFY_SSL", True)):
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
        source=str(getattr(settings, "NETCOMPLY_SCAN_SOURCE", "external-api")),
    )
    return {
        "batchId": batch.id,
        "source": batch.source,
        "payloadPath": str(latest_path),
        "deviceCount": batch.device_count,
        "nonCompliantDeviceCount": batch.non_compliant_device_count,
        "consumedAt": batch.consumed_at.isoformat(),
        "databaseAlias": scan_db_alias(),
    }


def default_mock_scan_payload_path() -> Path:
    return Path(getattr(settings, "NETCOMPLY_MOCK_SCAN_PAYLOAD_PATH", scan_tmp_dir() / "mock_scan_payload.json"))


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
        "consumedAt": batch.consumed_at.isoformat(),
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

        for finding in normalize_keyed_payload(pick(raw_device, "findings", "policies", "violations", "exceptions", default=[])):
            ComplianceScanFinding.objects.using(db_alias).create(
                device=device,
                policy_id=finding["policy_id"],
                finding_payload=finding["payload"],
                raw_payload=finding["raw"],
            )

        for config in normalize_keyed_payload(pick(raw_device, "actualConfig", "actualConfigs", "configSnapshot", "runningConfig", "rawConfig", "configuration", default=[])):
            ComplianceScanActualConfig.objects.using(db_alias).create(
                device=device,
                policy_id=config["policy_id"],
                config_payload=config["payload"],
                raw_payload=config["raw"],
            )

    return batch


def latest_devices_for_frontend() -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    if not ComplianceScanBatch.objects.using(db_alias).exists():
        return []

    devices: list[dict[str, Any]] = []
    seen_hostnames: set[str] = set()
    device_rows = ComplianceScanDevice.objects.using(db_alias).select_related("batch").prefetch_related("findings", "actual_configs").order_by("-batch__consumed_at", "-id")
    for device in device_rows:
        hostname_key = device.hostname.strip().lower()
        if hostname_key in seen_hostnames:
            continue
        seen_hostnames.add(hostname_key)

        config_by_policy = {config.policy_id: config.config_payload for config in device.actual_configs.all()}
        snapshot = find_device_snapshot(device.hostname)
        config_snapshot_path, config_snapshot_filename = snapshot if snapshot else ("", "")
        devices.append({
            "id": f"{device.hostname.lower().replace(' ', '-')}-{device.id}",
            "hostname": device.hostname,
            "role": device.role or "switch",
            "hardwareType": device.hardware_type,
            "managementIp": device.management_ip,
            "site": device.site,
            "lastScanned": device.batch.consumed_at.strftime("%b %d, %Y %I:%M %p"),
            "complianceStatus": "Non-Compliant",
            "configSnapshotPath": config_snapshot_path,
            "configSnapshotFilename": config_snapshot_filename,
            "findings": [
                {
                    "id": finding.policy_id,
                    "templateKey": finding.policy_id,
                    "title": finding.policy_id,
                    "standard": "Imported compliance scan",
                    "reason": "",
                    "currentValue": config_by_policy.get(finding.policy_id, ""),
                    "expectedValue": finding.finding_payload,
                    "detectedAt": device.batch.consumed_at.strftime("%b %d, %Y %I:%M %p"),
                }
                for finding in device.findings.all()
            ],
        })
    return devices


def list_policy_settings_for_frontend() -> list[dict[str, Any]]:
    return [record.payload for record in PolicySettingRecord.objects.using(scan_db_alias()).order_by("id")]


def replace_policy_settings(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    PolicySettingRecord.objects.using(db_alias).all().delete()
    PolicySettingRecord.objects.using(db_alias).bulk_create([PolicySettingRecord(payload=payload) for payload in payloads])
    return list_policy_settings_for_frontend()


def upsert_policy_settings(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    for payload in payloads:
        setting_id = str(payload.get("id") or payload.get("settingNumber") or "").strip()
        if not setting_id:
            continue
        payload = {**payload, "id": setting_id, "settingNumber": str(payload.get("settingNumber") or setting_id)}
        record = PolicySettingRecord.objects.using(db_alias).filter(Q(payload__id=setting_id) | Q(payload__settingNumber=setting_id)).first()
        if record:
            record.payload = payload
            record.save(using=db_alias)
        else:
            PolicySettingRecord.objects.using(db_alias).create(payload=payload)
    return list_policy_settings_for_frontend()


def delete_policy_settings(setting_ids: list[str]) -> list[dict[str, Any]]:
    normalized_ids = [str(setting_id).strip() for setting_id in setting_ids if str(setting_id).strip()]
    if normalized_ids:
        PolicySettingRecord.objects.using(scan_db_alias()).filter(Q(payload__id__in=normalized_ids) | Q(payload__settingNumber__in=normalized_ids)).delete()
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
            "createdAt": timezone.now().strftime("%b %d, %Y %I:%M %p"),
        })

    deduped: dict[str, dict[str, Any]] = {}
    for policy in policies:
        deduped[policy["id"]] = policy
    return list(deduped.values())


def list_templates_for_frontend() -> list[dict[str, Any]]:
    return [record.payload for record in RemediationTemplateRecord.objects.using(scan_db_alias()).order_by("-updated_at", "-id")]


def replace_templates(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    RemediationTemplateRecord.objects.using(db_alias).all().delete()
    RemediationTemplateRecord.objects.using(db_alias).bulk_create([
        RemediationTemplateRecord(template_key=str(payload.get("key") or f"template-{index}"), payload=payload)
        for index, payload in enumerate(payloads, start=1)
    ])
    return list_templates_for_frontend()


def list_template_requests_for_frontend() -> list[dict[str, Any]]:
    return [record.payload for record in TemplateRequestRecord.objects.using(scan_db_alias()).order_by("-updated_at", "-id")]


def replace_template_requests(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    TemplateRequestRecord.objects.using(db_alias).all().delete()
    TemplateRequestRecord.objects.using(db_alias).bulk_create([
        TemplateRequestRecord(request_id=str(payload.get("id") or f"request-{index}"), payload=payload)
        for index, payload in enumerate(payloads, start=1)
    ])
    return list_template_requests_for_frontend()


def list_tickets_for_frontend() -> list[dict[str, Any]]:
    return [record.payload for record in RemediationTicketRecord.objects.using(scan_db_alias()).order_by("-updated_at", "-id")]


def replace_tickets(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_alias = scan_db_alias()
    RemediationTicketRecord.objects.using(db_alias).all().delete()
    RemediationTicketRecord.objects.using(db_alias).bulk_create([
        RemediationTicketRecord(ticket_id=str(payload.get("id") or f"ticket-{index}"), payload=payload)
        for index, payload in enumerate(payloads, start=1)
    ])
    return list_tickets_for_frontend()


def upsert_ticket(payload: dict[str, Any]) -> dict[str, Any]:
    ticket_id = str(payload.get("id") or "")
    if not ticket_id:
        raise ValueError("Ticket payload requires id")
    RemediationTicketRecord.objects.using(scan_db_alias()).update_or_create(ticket_id=ticket_id, defaults={"payload": payload})
    return payload
