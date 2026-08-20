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
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import (
    ComplianceScanActualConfig,
    ComplianceScanBatch,
    ComplianceScanDevice,
    ComplianceScanFinding,
    DeploymentQueueItem,
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


def deployment_worker_heartbeat_dir() -> Path:
    configured_dir = getattr(settings, "NETCOMPLY_DEPLOYMENT_WORKER_HEARTBEAT_DIR", None)
    if configured_dir:
        return Path(configured_dir)
    return Path(getattr(settings, "BASE_DIR", Path.cwd())) / "tmp" / "netcomply-deployment-workers"


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


def looks_like_policy_id(value: Any) -> bool:
    return bool(re.match(r"^[A-Za-z]{1,5}[-_\s]?\d{1,4}$", str(value).strip()))


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


def set_ticket_status(ticket_id: str, status: str) -> dict[str, Any]:
    db_alias = scan_db_alias()
    ticket = RemediationTicketRecord.objects.using(db_alias).filter(ticket_id=ticket_id).first()
    if not ticket:
        raise ValueError(f"Ticket {ticket_id} was not found")
    ticket.payload = {**ticket.payload, "status": status}
    ticket.save(using=db_alias)
    return ticket.payload


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
        "queuedAt": item.queued_at.isoformat(),
        "availableAt": item.available_at.isoformat(),
        "lockedAt": item.locked_at.isoformat() if item.locked_at else "",
        "lockedBy": item.locked_by,
        "startedAt": item.started_at.isoformat() if item.started_at else "",
        "completedAt": item.completed_at.isoformat() if item.completed_at else "",
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
    ticket = RemediationTicketRecord.objects.using(db_alias).filter(ticket_id=ticket_id).first()
    if not ticket:
        raise ValueError(f"Ticket {ticket_id} was not found")

    existing = DeploymentQueueItem.objects.using(db_alias).filter(ticket_id=ticket_id, status__in=["Queued", "Processing"]).order_by("-queued_at").first()
    if existing:
        return serialize_deployment_queue_item(existing)

    now = timezone.now()
    queue_id = f"DQ-{now.strftime('%Y%m%d%H%M%S')}-{ticket_id}"
    ticket_payload = {**ticket.payload, "status": "Queued", "queuedBy": actor}
    execution_plan = build_deployment_execution_plan(ticket_payload)
    ticket.payload = ticket_payload
    ticket.save(using=db_alias)
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
    executor_url = getattr(settings, "NETCOMPLY_DEPLOYMENT_EXECUTOR_URL", "")
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
    headers.update(getattr(settings, "NETCOMPLY_DEPLOYMENT_EXECUTOR_HEADERS", {}))
    request = Request(executor_url, data=body, headers=headers, method="POST")
    with urlopen(request, timeout=getattr(settings, "NETCOMPLY_DEPLOYMENT_EXECUTOR_TIMEOUT", 60)) as response:
        response_body = response.read().decode("utf-8")
    return json.loads(response_body) if response_body else {"detail": "Executor returned an empty response."}


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
        RemediationTicketRecord.objects.using(db_alias).filter(ticket_id=item.ticket_id).update(payload={**item.ticket_payload, "status": "In Progress"})
        return item


def process_next_deployment_queue_item(worker_id: str = "netcomply-worker") -> dict[str, Any]:
    db_alias = scan_db_alias()
    item = claim_next_deployment_queue_item(worker_id)
    if not item:
        return {"claimed": False, "detail": "No queued deployment item is available."}

    try:
        plan = item.execution_plan or build_deployment_execution_plan(item.ticket_payload)
        result = call_deployment_executor(plan)
        all_findings = [finding for device in plan["devices"] for finding in device["findings"]]
        executable_count = sum(1 for finding in all_findings if finding["status"] == "Pending Execution")
        item.status = "Skipped" if all_findings and executable_count == 0 else "Complete"
        item.result_payload = result
        item.completed_at = timezone.now()
        item.last_error = ""
        item.save(using=db_alias)
        final_status = "Complete" if item.status == "Complete" else "Skipped"
        RemediationTicketRecord.objects.using(db_alias).filter(ticket_id=item.ticket_id).update(payload={**item.ticket_payload, "status": final_status})
        return {"claimed": True, "queueItem": serialize_deployment_queue_item(item)}
    except Exception as exc:
        item.status = "Failed"
        item.last_error = str(exc)
        item.completed_at = timezone.now()
        item.save(using=db_alias)
        RemediationTicketRecord.objects.using(db_alias).filter(ticket_id=item.ticket_id).update(payload={**item.ticket_payload, "status": "Failed"})
        return {"claimed": True, "queueItem": serialize_deployment_queue_item(item)}
