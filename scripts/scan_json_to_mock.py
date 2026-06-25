#!/usr/bin/env python3
"""
Convert a compliance scan JSON file into local NetComply mock data.

The generated files are intended for local demo use:
  - local-mock-data/importedDevices.ts
  - public/config-snapshots/<hostname>.txt

Devices are included only when:
  - compliance status is false / non-compliant
  - hostname, hardware type, management IP, and site can be resolved
  - findings are present
  - an actual config snapshot is present or a snapshot file path is provided

Input shapes can vary. The script accepts either a top-level array or an object
containing a common device array key such as devices, results, records, or items.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any


def find_project_root(start: Path) -> Path:
    for candidate in (start, *start.parents):
        if (candidate / "package.json").exists() and (candidate / "src").exists() and (candidate / "public").exists():
            return candidate
    return start


PROJECT_ROOT = find_project_root(Path(__file__).resolve().parent)
DEFAULT_OUTPUT = PROJECT_ROOT / "local-mock-data" / "importedDevices.ts"
DEFAULT_SNAPSHOT_DIR = PROJECT_ROOT / "public" / "config-snapshots"
DEVICE_ARRAY_KEYS = ("devices", "results", "records", "items", "data")
FALSE_STRINGS = {"false", "non-compliant", "non compliant", "failed", "fail", "no", "0"}
TRUE_STRINGS = {"true", "compliant", "passed", "pass", "yes", "1"}


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
                payload = str(item[only_key])
                title = policy_id
                current_value = ""
            else:
                policy_id = normalize_policy_id(pick(item, "id", "policyId", "policyNumber", "settingNumber", "identifier"))
                payload = str(pick(item, "expectedValue", "agreedSetting", "settingPayload", "payload", "expected", "rule", "description", default=policy_id))
                title = str(pick(item, "title", "findingName", "name", default=policy_id))
                current_value = str(pick(item, "currentValue", "actualValue", "current", "actual", default=""))
        else:
            continue

        if not policy_id:
            continue
        findings.append({
            "id": policy_id,
            "title": title or policy_id,
            "expectedValue": payload or policy_id,
            "currentValue": current_value,
        })
    return findings


def safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "-", value.strip()).strip("-").lower()
    return cleaned or "device"


def ts_string(value: Any) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def config_to_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return str(value)


def write_snapshot(device: dict[str, Any], hostname: str, snapshot_dir: Path) -> tuple[str, str] | None:
    config_text = pick(device, "actualConfig", "configSnapshot", "runningConfig", "rawConfig", "configuration", default="")
    config_path = pick(device, "actualConfigPath", "configSnapshotPath", "snapshotPath", default="")

    if config_text:
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{safe_filename(hostname)}.txt"
        path = snapshot_dir / filename
        path.write_text(config_to_text(config_text).replace("\r\n", "\n"), encoding="utf-8")
        return f"/config-snapshots/{filename}", filename

    if config_path:
        filename = Path(str(config_path)).name or f"{safe_filename(hostname)}.txt"
        return str(config_path), filename

    return None


def render_ts(devices: list[dict[str, Any]], scanned_at: str) -> str:
    chunks = [
        'import type { Device, PolicySetting } from "../src/types";',
        "",
        "// Generated by scripts/scan_json_to_mock.py. Local demo data only.",
        f"const scannedAt = {ts_string(scanned_at)};",
        "",
        "function normalizePolicyReference(value: string) {",
        "  const text = value.trim();",
        "  const match = text.match(/^([A-Za-z]{1,4})[-_\\s]?0*(\\d{1,4})$/);",
        "  if (match) return `${match[1].toUpperCase()}${Number(match[2]).toString().padStart(3, \"0\")}`;",
        "  return text.toUpperCase();",
        "}",
        "",
        "function enrichFinding(finding: Device[\"findings\"][number], policySettings: PolicySetting[]) {",
        "  const policyRef = normalizePolicyReference(finding.id || finding.templateKey);",
        "  const setting = policySettings.find((item) =>",
        "    [item.id, item.settingNumber].map((value) => normalizePolicyReference(value)).includes(policyRef)",
        "  );",
        "  if (!setting) return undefined;",
        "  return {",
        "    ...finding,",
        "    templateKey: setting.settingNumber,",
        "    title: setting.title,",
        "    standard: setting.standard,",
        "    reason: setting.description,",
        "    expectedValue: setting.settingPayload,",
        "  };",
        "}",
        "",
        "export const rawImportedDevices: Device[] = [",
    ]

    for index, device in enumerate(devices, start=1):
        hostname = str(device["hostname"])
        findings = device["findings"]
        chunks.extend([
            "  {",
            f"    id: {ts_string(device['id'])},",
            f"    hostname: {ts_string(hostname)},",
            f"    role: {ts_string(device.get('role', 'switch'))},",
            f"    hardwareType: {ts_string(device['hardwareType'])},",
            f"    managementIp: {ts_string(device['managementIp'])},",
            f"    site: {ts_string(device['site'])},",
            "    lastScanned: scannedAt,",
            '    complianceStatus: "Non-Compliant",',
            f"    configSnapshotPath: {ts_string(device['configSnapshotPath'])},",
            f"    configSnapshotFilename: {ts_string(device['configSnapshotFilename'])},",
            "    findings: [",
        ])
        for finding in findings:
            chunks.extend([
                "      {",
                f"        id: {ts_string(finding['id'])},",
                f"        templateKey: {ts_string(finding['id'])},",
                f"        title: {ts_string(finding['title'])},",
                '        standard: "Imported compliance scan",',
                '        reason: "Imported from compliance scan payload.",',
                f"        currentValue: {ts_string(finding['currentValue'])},",
                f"        expectedValue: {ts_string(finding['expectedValue'])},",
                "        detectedAt: scannedAt,",
                "      },",
            ])
        chunks.extend([
            "    ],",
            "  },",
        ])
    chunks.extend([
        "];",
        "",
        "export function hydrateImportedDevices(policySettings: PolicySetting[]) {",
        "  return rawImportedDevices",
        "    .map((device) => ({",
        "      ...device,",
        "      findings: device.findings",
        "        .map((finding) => enrichFinding(finding, policySettings))",
        "        .filter((finding): finding is Device[\"findings\"][number] => Boolean(finding)),",
        "    }))",
        "    .filter((device) => device.findings.length > 0);",
        "}",
        "",
        "export const importedDevices = rawImportedDevices;",
        "",
    ])
    return "\n".join(chunks)


def record_skip(skipped_reasons: dict[str, int], reason: str) -> None:
    skipped_reasons[reason] = skipped_reasons.get(reason, 0) + 1


def convert(input_path: Path, output_path: Path, snapshot_dir: Path) -> tuple[int, int, dict[str, int]]:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    raw_devices = extract_devices(payload)
    imported: list[dict[str, Any]] = []
    skipped = 0
    skipped_reasons: dict[str, int] = {}

    for raw in raw_devices:
        if not is_non_compliant(raw):
            skipped += 1
            record_skip(skipped_reasons, "compliance status is not false/non-compliant")
            continue

        hostname = str(pick(raw, "hostname", "hostName", "device", "deviceName", "name")).strip()
        hardware_type = str(pick(raw, "hardwareType", "deviceType", "type", "platform")).strip()
        management_ip = str(pick(raw, "managementIp", "managementIP", "mgmtIp", "mgmtIP", "ipAddress", "ip")).strip()
        site = str(pick(raw, "site", "location", "siteCode")).strip()
        findings = normalize_findings(pick(raw, "findings", "policies", "violations", "exceptions", default=[]))
        snapshot = write_snapshot(raw, hostname, snapshot_dir) if hostname else None

        if not (hostname and hardware_type and management_ip and site and findings and snapshot):
            skipped += 1
            if not hostname:
                record_skip(skipped_reasons, "missing hostname")
            elif not hardware_type:
                record_skip(skipped_reasons, "missing hardware type")
            elif not management_ip:
                record_skip(skipped_reasons, "missing management IP")
            elif not site:
                record_skip(skipped_reasons, "missing site")
            elif not findings:
                record_skip(skipped_reasons, "missing findings")
            elif not snapshot:
                record_skip(skipped_reasons, "missing actual config or snapshot path")
            continue

        snapshot_path, snapshot_filename = snapshot
        imported.append({
            "id": safe_filename(hostname),
            "hostname": hostname,
            "role": pick(raw, "role", default="switch"),
            "hardwareType": hardware_type,
            "managementIp": management_ip,
            "site": site,
            "configSnapshotPath": snapshot_path,
            "configSnapshotFilename": snapshot_filename,
            "findings": findings,
        })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    scanned_at = datetime.now().strftime("%b %d, %Y %I:%M %p")
    output_path.write_text(render_ts(imported, scanned_at), encoding="utf-8")
    return len(imported), skipped, skipped_reasons


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert compliance scan JSON to local NetComply mock data.")
    parser.add_argument("input_json", type=Path, help="Path to compliance scan JSON.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Generated TypeScript output path. Defaults to the frontend project's local-mock-data folder.")
    parser.add_argument("--snapshot-dir", type=Path, default=DEFAULT_SNAPSHOT_DIR, help="Where embedded actual configs are written. Defaults to the frontend project's public/config-snapshots folder.")
    args = parser.parse_args()

    input_path = args.input_json.resolve()
    output_path = args.output if args.output.is_absolute() else (Path.cwd() / args.output).resolve()
    snapshot_dir = args.snapshot_dir if args.snapshot_dir.is_absolute() else (Path.cwd() / args.snapshot_dir).resolve()

    print(f"Project root: {PROJECT_ROOT}")
    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print(f"Snapshot dir: {snapshot_dir}")

    imported, skipped, skipped_reasons = convert(input_path, output_path, snapshot_dir)
    print(f"Imported {imported} non-compliant device(s); skipped {skipped}.")
    if skipped_reasons:
        print("Skipped reason(s):")
        for reason, count in sorted(skipped_reasons.items()):
            print(f"  - {reason}: {count}")
    print(f"Wrote {output_path}")
    print(f"Wrote config snapshots to {snapshot_dir}")


if __name__ == "__main__":
    main()
