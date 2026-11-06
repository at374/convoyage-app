#!/usr/bin/env python3
"""Inspect published GTFS fare tables; never certify a fare or journey from them.

Input: PAN inventory from docs/transport-pan-inventory-2026-11-05.json or
another JSON object with datasets[].resources[]. No credentials are required.
Archives stay in memory and are not extracted. Downloads are sequential/bounded.
"""
import argparse
import csv
import datetime
import hashlib
import io
import json
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

FARE_TABLES = {
    "fare_attributes.txt": {"fare_id", "price", "currency_type", "payment_method", "transfers"},
    "fare_rules.txt": {"fare_id"},
    "fare_products.txt": {"fare_product_id", "amount", "currency"},
    "fare_leg_rules.txt": {"fare_product_id"},
    "fare_transfer_rules.txt": set(),
    "fare_media.txt": {"fare_media_id", "fare_media_type"},
    "rider_categories.txt": {"rider_category_id", "rider_category_name"},
    "areas.txt": {"area_id"},
    "stop_areas.txt": {"area_id", "stop_id"},
    "networks.txt": {"network_id"},
    "route_networks.txt": {"network_id", "route_id"},
    "timeframes.txt": {"timeframe_group_id", "service_id"},
}
MAX_TABLE_BYTES = 8 * 1024 * 1024
MAX_ROWS = 100000


def inspect_archive(data):
    """Inventory only: missing files, rules and validity are not inferred."""
    result = {"archiveBytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
              "fareVerified": False, "tables": [], "warnings": []}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > 1000:
            raise ValueError("archive entry limit exceeded")
        candidates = {}
        for entry in entries:
            name = entry.filename.rsplit("/", 1)[-1].lower()
            if name in FARE_TABLES and not entry.is_dir():
                candidates.setdefault(name, []).append(entry)
        for name, matches in sorted(candidates.items()):
            table = {"name": name}
            if len(matches) != 1:
                table["status"] = "ambiguous_duplicate"
                result["tables"].append(table)
                continue
            entry = matches[0]
            if entry.file_size > MAX_TABLE_BYTES or entry.flag_bits & 1:
                table["status"] = "too_large_or_encrypted"
                result["tables"].append(table)
                continue
            # Read bounded bytes, even if ZIP size declarations are incorrect.
            with archive.open(entry) as handle:
                raw = handle.read(MAX_TABLE_BYTES + 1)
            if len(raw) > MAX_TABLE_BYTES:
                raise ValueError("expanded fare table limit exceeded")
            reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig"), newline=""))
            columns = reader.fieldnames or []
            missing = sorted(FARE_TABLES[name] - set(columns))
            rows = 0
            currencies = set()
            for row in reader:
                rows += 1
                if rows > MAX_ROWS:
                    raise ValueError("fare row limit exceeded")
                currency = row.get("currency_type") or row.get("currency")
                if currency:
                    currencies.add(currency)
            table.update(status="missing_columns" if missing else "schema_present_not_validated",
                         columns=columns, missingColumns=missing, rows=rows,
                         currencies=sorted(currencies))
            result["tables"].append(table)
        names = set(candidates)
        result["fareFormat"] = ("v1_and_v2" if "fare_attributes.txt" in names and "fare_products.txt" in names
                                else "v1" if "fare_attributes.txt" in names
                                else "v2" if "fare_products.txt" in names else "no_price_table")
        if not names:
            result["warnings"].append("No recognised fare tables in this archive; official tariffs may exist elsewhere.")
        result["warnings"].append("Table presence is not validation of amounts, rules, dates, subscriptions or full journey cost.")
    return result


def download(url, max_bytes):
    if urllib.parse.urlsplit(url).scheme != "https":
        raise ValueError("HTTPS source required")
    request = urllib.request.Request(url, headers={"User-Agent": "ConvoyageUltra-FareSourceAudit/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        if urllib.parse.urlsplit(response.url).scheme != "https":
            raise ValueError("insecure redirect")
        declared = response.headers.get("Content-Length")
        if declared and int(declared) > max_bytes:
            raise ValueError("archive exceeds download limit")
        data = response.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise ValueError("archive exceeds download limit")
        return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inventory", type=Path)
    parser.add_argument("--network", action="append", required=True,
                        help="Case-insensitive title substring; repeat for several networks")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--max-download-mib", type=int, default=20)
    parser.add_argument("--max-resources", type=int, default=5)
    args = parser.parse_args()
    if not 1 <= args.max_download_mib <= 100 or not 1 <= args.max_resources <= 50:
        parser.error("download limit must be 1–100 MiB and resources 1–50")
    inventory = json.loads(args.inventory.read_text())
    resources = []
    seen = set()
    for dataset in inventory["datasets"]:
        if not any(term.casefold() in dataset["name"].casefold() for term in args.network):
            continue
        for resource in dataset["resources"]:
            if resource["format"].upper() == "GTFS" and resource["url"] not in seen:
                seen.add(resource["url"])
                resources.append((dataset, resource))
    if not resources:
        parser.error("no matching GTFS resource")
    report = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "purpose": "Source discovery only; no fares certified or connected to the application.",
              "matchingResourceCount": len(resources),
              "skippedByResourceLimit": max(0, len(resources) - args.max_resources), "results": []}
    for dataset, resource in resources[:args.max_resources]:
        row = {"network": dataset["name"], "sourcePage": dataset["sourcePage"],
               "resourceId": resource["id"], "url": resource["url"]}
        try:
            row.update(inspect_archive(download(resource["url"], args.max_download_mib * 1024 * 1024)))
            row["status"] = "archive_inspected"
        except (OSError, ValueError, RuntimeError, zipfile.BadZipFile, csv.Error) as error:
            row.update(status="inspection_failed", error=str(error), fareVerified=False)
        report["results"].append(row)
        print(row["network"] + ": " + row["status"] + " / " + row.get("fareFormat", row.get("error", "")), flush=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
