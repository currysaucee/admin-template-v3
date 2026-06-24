#!/usr/bin/env python3
"""
Extract one non-compliant finding example per policy from a compliance scan JSON.

The output is a CSV with one row per unique policy found, including the device
metadata, finding payload/current value, and the full actual config snapshot
captured for that device.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any


DEVICE_ARRAY_KEYS = ("devices", "results", "records", "items", "data")
FALSE_STRINGS = {"false", "non-compliant", "non compliant", "failed", "fail", "no", "0"}
TRUE_STRINGS = {"true", "compliant", "passed", "pass", "yes", "1"}
CONFIG_KEYS = ("actualConfig", "configSnapshot", "runningConfig", "rawConfig", "configuration")
CONFIG_PATH_KEYS = ("actualConfigPath", "configSnapshotPath", "snapshotPath")


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


def extract_devices(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in DEVICE_ARRAY_KEYS:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def normalize_policy_id(value: Any) -> str:
    if isinstance(value, str):
        text = value.strip()
        match = re.search(r"([A-Za-z]{1,4})[-_\s]?(\d{1,4})", text)
        if match:
            return f"{match.group(1).upper()}{int(match.group(2)):03d}"
        return text.upper()
    return str(value).strip().upper()


def stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def normalize_findings(raw_findings: Any) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    if isinstance(raw_findings, dict):
        raw_iterable = [{key: value} for key, value in raw_findings.items()]
    elif isinstance(raw_findings, list):
        raw_iterable = raw_findings
    else:
        raw_iterable = []

    for item in raw_iterable:
        if isinstance(item, str):
            policy_id = normalize_policy_id(item)
            payload = item
            title = policy_id
            current_value = ""
        elif isinstance(item, dict):
            if len(item) == 1 and not any(key in item for key in ("id", "policyId", "policyNumber", "settingNumber")):
                only_key = next(iter(item))
                policy_id = normalize_policy_id(only_key)
                payload = stringify(item[only_key])
                title = policy_id
                current_value = ""
            else:
                policy_id = normalize_policy_id(pick(item, "id", "policyId", "policyNumber", "settingNumber", "identifier"))
                payload = stringify(pick(item, "expectedValue", "agreedSetting", "settingPayload", "payload", "expected", "rule", "description", default=policy_id))
                title = stringify(pick(item, "title", "findingName", "name", default=policy_id))
                current_value = stringify(pick(item, "currentValue", "actualValue", "current", "actual", default=""))
        else:
            continue

        if policy_id:
            findings.append({
                "policyId": policy_id,
                "title": title or policy_id,
                "findingPayload": payload or policy_id,
                "currentValue": current_value,
            })
    return findings


def read_config(device: dict[str, Any], base_dir: Path) -> tuple[str, str]:
    config_text = pick(device, *CONFIG_KEYS, default="")
    if config_text:
        return stringify(config_text).replace("\r\n", "\n"), "embedded"

    config_path = pick(device, *CONFIG_PATH_KEYS, default="")
    if not config_path:
        return "", ""

    path = Path(str(config_path))
    candidates = [path]
    if not path.is_absolute():
        candidates.extend([base_dir / path, base_dir / "public" / str(config_path).lstrip("/\\")])

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n"), str(candidate)

    return "", str(config_path)


def extract_examples(input_path: Path) -> list[dict[str, str]]:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    devices = extract_devices(payload)
    examples: dict[str, dict[str, str]] = {}

    for device in devices:
        if not is_non_compliant(device):
            continue

        hostname = stringify(pick(device, "hostname", "hostName", "device", "deviceName", "name")).strip()
        hardware_type = stringify(pick(device, "hardwareType", "deviceType", "type", "platform")).strip()
        management_ip = stringify(pick(device, "managementIp", "managementIP", "mgmtIp", "mgmtIP", "ipAddress", "ip")).strip()
        site = stringify(pick(device, "site", "location", "siteCode")).strip()
        role = stringify(pick(device, "role", default="")).strip()
        actual_config, config_source = read_config(device, input_path.parent)
        findings = normalize_findings(pick(device, "findings", "policies", "violations", "exceptions", default=[]))

        if not actual_config:
            continue

        for finding in findings:
            policy_id = finding["policyId"]
            if policy_id in examples:
                continue
            examples[policy_id] = {
                "policyId": policy_id,
                "findingTitle": finding["title"],
                "findingPayload": finding["findingPayload"],
                "currentValue": finding["currentValue"],
                "hostname": hostname,
                "hardwareType": hardware_type,
                "managementIp": management_ip,
                "site": site,
                "role": role,
                "configSource": config_source,
                "actualConfig": actual_config,
            }

    return [examples[key] for key in sorted(examples)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract one finding/config example per non-compliant policy.")
    parser.add_argument("input_json", type=Path, help="Path to compliance scan JSON.")
    parser.add_argument("--output", type=Path, default=Path("policy-finding-examples.csv"), help="CSV output path.")
    args = parser.parse_args()

    input_path = args.input_json.resolve()
    output_path = args.output if args.output.is_absolute() else (Path.cwd() / args.output).resolve()
    rows = extract_examples(input_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "policyId",
        "findingTitle",
        "findingPayload",
        "currentValue",
        "hostname",
        "hardwareType",
        "managementIp",
        "site",
        "role",
        "configSource",
        "actualConfig",
    ]
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} policy example row(s) to {output_path}")


if __name__ == "__main__":
    main()
