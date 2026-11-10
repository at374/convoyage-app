#!/usr/bin/env python3
"""Read-only inventory of a locally downloaded official OURA GTFS archive.

Never labels fares, service dates or connections as verified.
Usage: python scripts/inventory_oura_gtfs.py official-oura.zip --source-url https://...
"""
import argparse
import csv
import hashlib
import io
import json
import sys
import zipfile
from collections import Counter


def read_rows(archive, filename):
    paths = [name for name in archive.namelist() if name.rsplit("/", 1)[-1] == filename]
    if len(paths) != 1:
        raise ValueError(f"Expected exactly one {filename}, found {len(paths)}")
    with archive.open(paths[0]) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))


def inventory(path, source_url):
    if not source_url.startswith("https://"):
        raise ValueError("Source URL must use HTTPS")
    with open(path, "rb") as stream:
        sha = hashlib.file_digest(stream, "sha256").hexdigest()
    with zipfile.ZipFile(path) as archive:
        agencies = {a["agency_id"]: a.get("agency_name", "") for a in read_rows(archive, "agency.txt")}
        routes = list(read_rows(archive, "routes.txt"))
        counts = Counter(r.get("agency_id", "") for r in routes)
        if not routes or not agencies:
            raise ValueError("Missing GTFS agencies or routes")
        if any(agency_id not in agencies for agency_id in counts):
            raise ValueError("Routes reference unknown agency_id")
        stop_count = sum(1 for _ in read_rows(archive, "stops.txt"))
        trip_count = sum(1 for _ in read_rows(archive, "trips.txt"))
        if not stop_count or not trip_count:
            raise ValueError("Missing stops or trips")
        files = {name.rsplit("/", 1)[-1] for name in archive.namelist()}
        return {
            "sourceUrl": source_url, "sourceSha256": sha,
            "archiveOnly": True, "serviceConfirmed": False, "fareVerified": False,
            "routeCount": len(routes), "stopCount": stop_count, "tripCount": trip_count,
            "hasCalendar": "calendar.txt" in files,
            "hasCalendarExceptions": "calendar_dates.txt" in files,
            "hasTransfers": "transfers.txt" in files,
            "hasFareFiles": any(n in files for n in
                ("fare_attributes.txt", "fare_rules.txt", "fare_products.txt", "fare_media.txt")),
            "agencies": [{"id": aid, "name": name, "routeCount": counts[aid]}
                         for aid, name in sorted(agencies.items(), key=lambda p: (p[1], p[0]))],
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gtfs_zip")
    parser.add_argument("--source-url", required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(inventory(args.gtfs_zip, args.source_url), ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as exc:
        print(f"OURA inventory failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
