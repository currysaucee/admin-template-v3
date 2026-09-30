#!/usr/bin/env python3
"""Compare complete before/after F5 TMOS configuration dumps.

Place this script beside ``before.txt`` and ``after.txt``, then run:

    python slb_tmos_config_compare.py

The comparison is lossless: it checks the complete file and reports every
added, removed, or modified top-level TMOS object. Modified objects include a
unified line diff so unexpected changes are visible to the reviewer.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TmosObject:
    key: str
    lines: tuple[str, ...]
    occurrence: int

    @property
    def display_name(self) -> str:
        return self.key if self.occurrence == 1 else f"{self.key} [occurrence {self.occurrence}]"


def brace_delta(line: str) -> int:
    """Count structural braces while ignoring quoted text and comments."""
    delta = 0
    quoted = False
    escaped = False
    for character in line:
        if escaped:
            escaped = False
            continue
        if character == "\\" and quoted:
            escaped = True
            continue
        if character == '"':
            quoted = not quoted
            continue
        if character == "#" and not quoted:
            break
        if not quoted:
            if character == "{":
                delta += 1
            elif character == "}":
                delta -= 1
    return delta


def object_header(line: str) -> str | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "{" not in stripped:
        return None
    header, separator, remainder = stripped.partition("{")
    if not separator or not header.strip() or brace_delta(remainder) < -1:
        return None
    return header.strip()


def parse_tmos_objects(text: str) -> tuple[list[TmosObject], tuple[str, ...]]:
    """Split a TMOS dump into top-level brace-delimited objects and other lines."""
    lines = text.splitlines()
    objects: list[TmosObject] = []
    outside_lines: list[str] = []
    occurrences: Counter[str] = Counter()
    current_key: str | None = None
    current_lines: list[str] = []
    depth = 0

    for line in lines:
        if current_key is None:
            header = object_header(line)
            line_delta = brace_delta(line)
            if header is not None and line_delta > 0:
                current_key = header
                current_lines = [line]
                depth = line_delta
                continue
            outside_lines.append(line)
            continue

        current_lines.append(line)
        depth += brace_delta(line)
        if depth <= 0:
            occurrences[current_key] += 1
            objects.append(TmosObject(current_key, tuple(current_lines), occurrences[current_key]))
            current_key = None
            current_lines = []
            depth = 0

    if current_key is not None:
        raise ValueError(f"Unclosed TMOS object: {current_key}")
    return objects, tuple(outside_lines)


def indexed_objects(objects: list[TmosObject]) -> dict[tuple[str, int], TmosObject]:
    return {(item.key, item.occurrence): item for item in objects}


def unified_diff(before: tuple[str, ...], after: tuple[str, ...], label: str) -> list[str]:
    return list(
        difflib.unified_diff(
            before,
            after,
            fromfile=f"before:{label}",
            tofile=f"after:{label}",
            lineterm="",
        )
    )


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compare(before_text: str, after_text: str) -> tuple[bool, list[str]]:
    before_objects, before_outside = parse_tmos_objects(before_text)
    after_objects, after_outside = parse_tmos_objects(after_text)
    before_index = indexed_objects(before_objects)
    after_index = indexed_objects(after_objects)

    before_keys = set(before_index)
    after_keys = set(after_index)
    added_keys = sorted(after_keys - before_keys)
    removed_keys = sorted(before_keys - after_keys)
    common_keys = sorted(before_keys & after_keys)
    modified_keys = [key for key in common_keys if before_index[key].lines != after_index[key].lines]
    outside_changed = before_outside != after_outside
    exact_change = before_text != after_text

    report = [
        "F5 TMOS configuration comparison",
        "=" * 34,
        f"Before SHA-256: {sha256(before_text)}",
        f"After SHA-256:  {sha256(after_text)}",
        f"Before objects: {len(before_objects)}",
        f"After objects:  {len(after_objects)}",
        "",
        f"Added objects:    {len(added_keys)}",
        f"Removed objects:  {len(removed_keys)}",
        f"Modified objects: {len(modified_keys)}",
        f"Other text changed: {'yes' if outside_changed else 'no'}",
    ]

    if not exact_change:
        report.extend(["", "RESULT: No changes detected. Files are identical."])
        return False, report

    if added_keys:
        report.extend(["", "ADDED OBJECTS", "-------------"])
        for key in added_keys:
            item = after_index[key]
            report.append(f"+ {item.display_name}")
            report.extend(f"  {line}" for line in item.lines)

    if removed_keys:
        report.extend(["", "REMOVED OBJECTS", "---------------"])
        for key in removed_keys:
            item = before_index[key]
            report.append(f"- {item.display_name}")
            report.extend(f"  {line}" for line in item.lines)

    if modified_keys:
        report.extend(["", "MODIFIED OBJECTS", "----------------"])
        for key in modified_keys:
            before_item = before_index[key]
            after_item = after_index[key]
            report.extend(["", f"~ {before_item.display_name}"])
            report.extend(unified_diff(before_item.lines, after_item.lines, before_item.display_name))

    if outside_changed:
        report.extend(["", "CHANGES OUTSIDE PARSED OBJECTS", "------------------------------"])
        report.extend(unified_diff(before_outside, after_outside, "document-text"))

    if exact_change and not (added_keys or removed_keys or modified_keys or outside_changed):
        report.extend([
            "",
            "RAW FILE CHANGE",
            "---------------",
            "The parsed content is equal, but the raw files differ (for example, newline encoding).",
        ])

    report.extend(["", "RESULT: Changes detected. Review every section above."])
    return True, report


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def arguments() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Compare complete before/after F5 TMOS configuration dumps.")
    parser.add_argument("--before", type=Path, default=script_dir / "before.txt", help="Before dump (default: before.txt beside this script).")
    parser.add_argument("--after", type=Path, default=script_dir / "after.txt", help="After dump (default: after.txt beside this script).")
    parser.add_argument("--report", type=Path, help="Optionally save the printed report to this file.")
    return parser.parse_args()


def main() -> int:
    args = arguments()
    missing = [str(path) for path in (args.before, args.after) if not path.is_file()]
    if missing:
        print(f"ERROR: Missing input file(s): {', '.join(missing)}", file=sys.stderr)
        return 2

    try:
        changed, report_lines = compare(read_text(args.before), read_text(args.after))
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    report = "\n".join(report_lines)
    print(report)
    if args.report:
        args.report.write_text(f"{report}\n", encoding="utf-8")
        print(f"\nReport saved to {args.report}")
    return 1 if changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
