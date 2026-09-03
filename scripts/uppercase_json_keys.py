from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def uppercase_keys(value: Any) -> Any:
    if isinstance(value, list):
        return [uppercase_keys(item) for item in value]

    if isinstance(value, dict):
        return {str(key).upper(): uppercase_keys(item) for key, item in value.items()}

    return value


def main() -> None:
    parser = argparse.ArgumentParser(description="Uppercase all JSON object keys in a JSON file.")
    parser.add_argument("input_json", type=Path, help="Input JSON file. Expected to be an array of objects.")
    parser.add_argument("-o", "--output", type=Path, help="Output JSON file. Defaults to overwriting input when omitted.")
    parser.add_argument("--indent", type=int, default=2, help="JSON indentation. Use 0 for compact JSON.")
    args = parser.parse_args()

    if not args.input_json.exists():
        raise FileNotFoundError(f"Input JSON does not exist: {args.input_json}")

    payload = json.loads(args.input_json.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, list):
        raise ValueError("Expected the top-level JSON value to be an array.")

    output_path = args.output or args.input_json
    converted = uppercase_keys(payload)
    json_text = json.dumps(converted, indent=None if args.indent == 0 else args.indent, ensure_ascii=False)
    output_path.write_text(json_text + "\n", encoding="utf-8")
    print(f"Wrote uppercase-key JSON to {output_path}")


if __name__ == "__main__":
    main()
