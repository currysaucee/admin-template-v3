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


def _policy_key(value: Any) -> str:
    compact = re.sub(r"[^A-Z0-9]", "", str(value or "").upper())
    return next((policy for policy in ARISTA_IDLE_TIMEOUT_POLICIES if policy in compact), "")


def build_arista_reversion_plan(policy_id: Any, current_config: Any) -> dict[str, Any] | None:
    """Build the explicitly supported rollback plan from scan evidence.

    These rules intentionally remain policy-specific. The scanner contract for
    AS015 and AS016 is known, while an unknown policy must never receive an
    inferred network rollback command.
    """
    policy_key = _policy_key(policy_id)
    if not policy_key:
        return None

    source_config = str(current_config or "").replace("\\n", "\n").strip()
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
