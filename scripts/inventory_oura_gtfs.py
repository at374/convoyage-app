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
        agency_rows = list(read_rows(archive, "agency.txt"))
        if not agency_rows:
            raise ValueError("Missing GTFS agencies")
        agencies = {a.get("agency_id", ""): a.get("agency_name", "") for a in agency_rows}
        if len(agencies) != len(agency_rows):
            raise ValueError("Duplicate GTFS agency_id")
        routes = list(read_rows(archive, "routes.txt"))
        # GTFS permits omitting agency_id on routes only when exactly one agency exists.
        counts = Counter(r.get("agency_id") or next(iter(agencies)) if len(agencies) == 1
                         else r.get("agency_id", "") for r in routes)
        if not routes or not agencies:
            raise ValueError("Missing GTFS agencies or routes")
        if any(agency_id not in agencies for agency_id in counts):
            raise ValueError("Routes reference unknown agency_id")
        route_ids = [r.get("route_id", "") for r in routes]
        if any(not rid for rid in route_ids) or len(set(route_ids)) != len(route_ids):
            raise ValueError("Missing or duplicate GTFS route_id")
        route_trip_counts = Counter(t.get("route_id", "") for t in read_rows(archive, "trips.txt"))
        if any(rid not in set(route_ids) for rid in route_trip_counts):
            raise ValueError("Trips reference unknown route_id")
        stop_count = sum(1 for _ in read_rows(archive, "stops.txt"))
        trip_count = sum(route_trip_counts.values())
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
            "routes": [{"id": r["route_id"], "agencyId": (r.get("agency_id") or next(iter(agencies))),
                        "shortName": r.get("route_short_name", ""), "longName": r.get("route_long_name", ""),
                        "tripCount": route_trip_counts[r["route_id"]]}
                       for r in sorted(routes, key=lambda r: r["route_id"])],
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
