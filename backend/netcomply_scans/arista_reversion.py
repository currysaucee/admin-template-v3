from __future__ import annotations

import re
from typing import Any


ARISTA_IDLE_TIMEOUT_POLICIES = {
    "AS015": {
        "context": "management console",
        "title": "Restore management console idle timeout",
    },
    "AS016": {
        "context": "management ssh",
        "title": "Restore management SSH idle timeout",
    },
}

ARISTA_PRESENCE_POLICIES = {
    "AS031": {
        "command": "logging console",
        "title": "Restore console logging",
    },
}


def _policy_key(value: Any) -> str:
    compact = re.sub(r"[^A-Z0-9]", "", str(value or "").upper())
    return next((policy for policy in (*ARISTA_IDLE_TIMEOUT_POLICIES, *ARISTA_PRESENCE_POLICIES) if policy in compact), "")


def build_arista_reversion_plan(policy_id: Any, current_config: Any) -> dict[str, Any] | None:
    """Build the explicitly supported rollback plan from scan evidence.

    These rules intentionally remain policy-specific. The scanner contract for
    AS015 and AS016 is known, while an unknown policy must never receive an
    inferred network rollback command.
    """
    policy_key = _policy_key(policy_id)
    if not policy_key:
        return None

    source_config = str(current_config or "").replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\t", "\t").strip()
    if policy_key in ARISTA_PRESENCE_POLICIES:
        policy = ARISTA_PRESENCE_POLICIES[policy_key]
        prefix = str(policy["command"]).lower()
        original_line = next(
            (
                line.strip()
                for line in source_config.splitlines()
                if line.strip().lower() == prefix or line.strip().lower().startswith(f"{prefix} ")
            ),
            "",
        )
        if not original_line:
            return {
                "available": False,
                "policyId": policy_key,
                "title": policy["title"],
                "summary": "The scan did not capture the forbidden console-logging line, so it cannot be restored safely.",
                "commands": [],
                "sourceConfig": source_config,
            }
        return {
            "available": True,
            "policyId": policy_key,
            "title": policy["title"],
            "summary": f"Restore the console-logging command captured before remediation: {original_line}.",
            "commands": [original_line],
            "sourceConfig": source_config,
        }

    policy = ARISTA_IDLE_TIMEOUT_POLICIES[policy_key]
    timeout_match = re.search(r"\bidle-timeout\s+(\d+)\b", source_config, flags=re.IGNORECASE)
    if not timeout_match:
        return {
            "available": False,
            "policyId": policy_key,
            "title": policy["title"],
            "summary": "The scan did not include an idle-timeout value, so a safe rollback command could not be derived.",
            "commands": [],
            "sourceConfig": source_config,
        }

    timeout = timeout_match.group(1)
    return {
        "available": True,
        "policyId": policy_key,
        "title": policy["title"],
        "summary": f"Restore the device-specific value captured by the latest scan: idle-timeout {timeout}.",
        "commands": [policy["context"], f"idle-timeout {timeout}"],
        "sourceConfig": source_config,
    }
