from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Callable


# Edit only this block when the CSV headers change.
# Left side = fixed JSON output field.
# Right side = column name from the first row of your CSV.
COLUMN_MAPPING = {
    "HOSTNAME": "hostname",
    "IPADDRESS": "ip_address",
    "NETWORK_ZONE": "network_zone",
    "ENVIRONMENT": "environment",
    "APPLICATION_CODE": "application_code",
    "LOB": "lob",
    "LOCATION": "location",
    "STATUS": "status",
}


# These fields are always emitted with this value unless you change it here.
FIXED_VALUES = {
    "DISTILLED": True,
}


# Fixed output shape. The script will not emit any key outside this list.
OUTPUT_FIELDS = [
    "DISTILLED",
    "HOSTNAME",
    "IPADDRESS",
    "NETWORK_ZONE",
    "ENVIRONMENT",
    "APPLICATION_CODE",
    "LOB",
    "LOCATION",
    "STATUS",
]


# Optional per-field cleanup/normalization.
FIELD_TRANSFORMS: dict[str, Callable[[str], str]] = {
    "HOSTNAME": lambda value: value.strip(),
    "IPADDRESS": lambda value: value.strip(),
    "NETWORK_ZONE": lambda value: value.strip().upper(),
    "ENVIRONMENT": lambda value: value.strip().upper(),
    "APPLICATION_CODE": lambda value: value.strip().upper(),
    "LOB": lambda value: value.strip().upper(),
    "LOCATION": lambda value: value.strip().upper(),
    "STATUS": lambda value: value.strip() or "Active",
}


def normalize_header(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def normalize_row_keys(row: dict[str, str]) -> dict[str, str]:
    return {normalize_header(key): value for key, value in row.items() if key is not None}


def read_csv_rows(input_path: Path) -> list[dict[str, str]]:
    sample = input_path.read_text(encoding="utf-8-sig")[:4096]
    dialect = csv.Sniffer().sniff(sample) if sample.strip() else csv.excel
    with input_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file, dialect=dialect)
        return [normalize_row_keys(row) for row in reader]


def build_output_row(source_row: dict[str, str]) -> dict[str, object]:
    output: dict[str, object] = {}

    for field in OUTPUT_FIELDS:
        if field in FIXED_VALUES:
            output[field] = FIXED_VALUES[field]
            continue

        source_column = normalize_header(COLUMN_MAPPING[field])
        raw_value = source_row.get(source_column, "")
        transform = FIELD_TRANSFORMS.get(field, lambda value: value.strip())
        output[field] = transform(raw_value)

    return output


def convert_csv_to_inventory_json(input_path: Path) -> list[dict[str, object]]:
    rows = read_csv_rows(input_path)
    return [build_output_row(row) for row in rows]


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert a CSV inventory extract into the fixed inventory JSON shape.")
    parser.add_argument("input_csv", type=Path, help="Path to the CSV file. First row must contain column names.")
    parser.add_argument("-o", "--output", type=Path, default=Path("inventory_server_list.json"), help="Output JSON path.")
    parser.add_argument("--indent", type=int, default=2, help="JSON indentation. Use 0 for compact JSON.")
    args = parser.parse_args()

    if not args.input_csv.exists():
        raise FileNotFoundError(f"Input CSV does not exist: {args.input_csv}")

    payload = convert_csv_to_inventory_json(args.input_csv)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(payload, indent=None if args.indent == 0 else args.indent)
    args.output.write_text(json_text + "\n", encoding="utf-8")
    print(f"Wrote {len(payload)} row(s) to {args.output}")


if __name__ == "__main__":
    main()
