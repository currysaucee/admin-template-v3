from __future__ import annotations

import re
from typing import Any


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
    policy = re.sub(r"[^A-Z0-9]", "", str(policy_id or "").upper())
    return any(marker in hardware for marker in ("arista", "eos", "dcs-")) or any(policy.startswith(value) for value in ("AS015", "AS016"))


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
