from __future__ import annotations

import re
from typing import Any


ARISTA_POLICY_RULES = {
    "AS015": {"mode": "stanza_value", "context": "management console", "command": "idle-timeout"},
    "AS016": {"mode": "stanza_value", "context": "management ssh", "command": "idle-timeout"},
    "AS031": {"mode": "forbidden_line", "command": "logging console"},
}


def policy_key(value: Any) -> str:
    compact = re.sub(r"[^A-Z0-9]", "", str(value or "").upper())
    return next((policy for policy in ARISTA_POLICY_RULES if compact.startswith(policy)), "")


def readable_config(value: Any) -> str:
    """Render scanner-escaped whitespace as the device CLI would display it."""
    return (
        str(value or "")
        .replace("\\r\\n", "\n")
        .replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .strip()
    )


def normalized_config_lines(value: Any) -> list[str]:
    return [
        re.sub(r"\s+", " ", line.strip()).lower()
        for line in readable_config(value).splitlines()
        if line.strip() and line.strip() != "!"
    ]


def config_evidence_equal(left: Any, right: Any) -> bool:
    return normalized_config_lines(left) == normalized_config_lines(right)


def is_arista_context(hardware_type: Any, policy_id: Any = "") -> bool:
    hardware = str(hardware_type or "").lower()
    return any(marker in hardware for marker in ("arista", "eos", "dcs-")) or bool(policy_key(policy_id))


def matching_command_lines(config: Any, command: str) -> list[str]:
    prefix = re.sub(r"\s+", " ", command.strip()).lower()
    return [
        line.strip()
        for line in readable_config(config).splitlines()
        if re.sub(r"\s+", " ", line.strip()).lower() == prefix
        or re.sub(r"\s+", " ", line.strip()).lower().startswith(f"{prefix} ")
    ]


def arista_scan_state_equal(policy_id: Any, ticket_config: Any, latest_config: Any) -> bool:
    rule = ARISTA_POLICY_RULES.get(policy_key(policy_id), {})
    if rule.get("mode") == "forbidden_line":
        command = str(rule["command"])
        return bool(matching_command_lines(ticket_config, command)) == bool(matching_command_lines(latest_config, command))
    return config_evidence_equal(ticket_config, latest_config)


def arista_stanza_match(ticket_config: Any, running_config: Any) -> dict[str, Any]:
    """Match a ticket-time Arista stanza inside a full `show running-config` dump.

    EOS separates top-level stanzas with `!`. The scan evidence can contain only
    the stanza header and the policy line, while the live stanza can contain
    additional child commands. We therefore require the same header and every
    captured child line, without requiring the whole live block to be identical.
    """
    expected = normalized_config_lines(ticket_config)
    if not expected:
        return {
            "matches": False,
            "reason": "The request does not contain ticket-time Arista configuration evidence.",
            "expected": readable_config(ticket_config),
            "matchedStanza": "",
        }

    blocks = re.split(r"(?m)^\s*!\s*$", readable_config(running_config))
    expected_header, expected_children = expected[0], expected[1:]
    for block in blocks:
        lines = normalized_config_lines(block)
        if not lines or lines[0] != expected_header:
            continue
        if all(child in lines[1:] for child in expected_children):
            return {
                "matches": True,
                "reason": "Live Arista configuration matches the setting captured when the request was created.",
                "expected": readable_config(ticket_config),
                "matchedStanza": block.strip(),
            }

    return {
        "matches": False,
        "reason": "Live Arista configuration no longer matches the setting captured when the request was created.",
        "expected": readable_config(ticket_config),
        "matchedStanza": "",
    }


def arista_policy_state_match(policy_id: Any, ticket_config: Any, running_config: Any) -> dict[str, Any]:
    key = policy_key(policy_id)
    rule = ARISTA_POLICY_RULES.get(key, {})
    if rule.get("mode") != "forbidden_line":
        return arista_stanza_match(ticket_config, running_config)

    command = str(rule["command"])
    captured_lines = matching_command_lines(ticket_config, command)
    live_lines = matching_command_lines(running_config, command)
    if not captured_lines:
        return {
            "matches": False,
            "reason": f"The request does not contain ticket-time evidence for forbidden command '{command}'.",
            "expected": readable_config(ticket_config),
            "matchedStanza": "",
            "presenceMode": "forbidden_line",
            "present": bool(live_lines),
        }
    if live_lines:
        return {
            "matches": True,
            "reason": f"Forbidden command '{command}' is still present, matching the non-compliant ticket-time state.",
            "expected": "\n".join(captured_lines),
            "matchedStanza": "\n".join(live_lines),
            "presenceMode": "forbidden_line",
            "present": True,
        }
    return {
        "matches": False,
        "reason": f"Forbidden command '{command}' is no longer present; the device state changed after the request was created.",
        "expected": "\n".join(captured_lines),
        "matchedStanza": "",
        "presenceMode": "forbidden_line",
        "present": False,
    }
