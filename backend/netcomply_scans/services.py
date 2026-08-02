from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from django.conf import settings
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
            rows.append({"policy_id": normalize_policy_id(policy_id), "payload": "" if payload is None else str(payload), "raw": item})
        elif isinstance(item, dict):
            policy_id = normalize_policy_id(pick(item, "id", "policyId", "policyNumber", "settingNumber", "identifier"))
            payload = pick(item, "payload", "expectedValue", "agreedSetting", "settingPayload", "expected", "rule", "description", "actualConfig", "config", default="")
            if policy_id:
                rows.append({"policy_id": policy_id, "payload": "" if payload is None else str(payload), "raw": item})
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


def import_scan_payload(payload: list[dict[str, Any]], raw_payload_path: Path | str, source: str = "external-api") -> ComplianceScanBatch:
    consumed_at = timezone.now()
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
    batch = ComplianceScanBatch.objects.using(db_alias).order_by("-consumed_at").first()
    if not batch:
        return []

    devices: list[dict[str, Any]] = []
    device_rows = ComplianceScanDevice.objects.using(db_alias).filter(batch=batch).prefetch_related("findings", "actual_configs")
    for device in device_rows:
        config_by_policy = {config.policy_id: config.config_payload for config in device.actual_configs.all()}
        devices.append({
            "id": f"{device.hostname.lower().replace(' ', '-')}-{device.id}",
            "hostname": device.hostname,
            "role": device.role or "switch",
            "hardwareType": device.hardware_type,
            "managementIp": device.management_ip,
            "site": device.site,
            "lastScanned": batch.consumed_at.strftime("%b %d, %Y %I:%M %p"),
            "complianceStatus": "Non-Compliant",
            "findings": [
                {
                    "id": finding.policy_id,
                    "templateKey": finding.policy_id,
                    "title": finding.policy_id,
                    "standard": "Imported compliance scan",
                    "reason": "",
                    "currentValue": config_by_policy.get(finding.policy_id, ""),
                    "expectedValue": finding.finding_payload,
                    "detectedAt": batch.consumed_at.strftime("%b %d, %Y %I:%M %p"),
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
