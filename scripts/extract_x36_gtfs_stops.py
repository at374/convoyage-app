#!/usr/bin/env python3
"""Extract X36 stop candidates from a locally supplied official GTFS ZIP.

Read-only. Never invents stop-to-fare mappings or claims verified journey prices.
Usage: python scripts/extract_x36_gtfs_stops.py official.zip --source-url URL --checked-on YYYY-MM-DD
"""
import argparse
import csv
import io
import json
import hashlib
import re
import sys
import zipfile
from collections import defaultdict
from datetime import date


def rows(archive, filename):
    matches = [name for name in archive.namelist() if name.split("/")[-1] == filename]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one {filename} in GTFS ZIP")
    with archive.open(matches[0]) as source:
        yield from csv.DictReader(io.TextIOWrapper(source, encoding="utf-8-sig"))


def extract(path, source_url, checked_on):
    if not source_url.startswith("https://"):
        raise ValueError("Official feed source URL must use HTTPS")
    if date.fromisoformat(checked_on).isoformat() != checked_on:
        raise ValueError("Invalid audit date")
    with open(path, 'rb') as stream:
        checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
    with zipfile.ZipFile(path) as archive:
        route_ids = {r["route_id"] for r in rows(archive, "routes.txt")
                     if r.get("route_short_name", "").strip().upper() == "X36"}
        if not route_ids:
            raise ValueError("X36 route not found in supplied GTFS")
        trip_ids = {r["trip_id"] for r in rows(archive, "trips.txt")
                    if r.get("route_id") in route_ids}
        if not trip_ids:
            raise ValueError("No X36 trips in supplied GTFS")
        stop_trip_count = defaultdict(set)
        trip_stop_sequences = defaultdict(list)
        for item in rows(archive, "stop_times.txt"):
            if item.get("trip_id") in trip_ids:
                stop_trip_count[item["stop_id"]].add(item["trip_id"])
                trip_stop_sequences[item["trip_id"]].append((int(item["stop_sequence"]), item["stop_id"]))
        if not stop_trip_count:
            raise ValueError("No X36 stop_times in supplied GTFS")
        stops = []
        for item in rows(archive, "stops.txt"):
            if item.get("stop_id") not in stop_trip_count:
                continue
            try:
                lat, lon = float(item["stop_lat"]), float(item["stop_lon"])
            except (ValueError, TypeError, KeyError):
                continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            stops.append({"id": item["stop_id"], "gtfsName": item.get("stop_name", ""),
                          "lat": lat, "lon": lon,
                          "tripCount": len(stop_trip_count[item["stop_id"]])})
        if not stops:
            raise ValueError("No valid X36 stop coordinates in supplied GTFS")
        stops.sort(key=lambda item: (item["gtfsName"], item["id"]))
        valid_ids = {stop["id"] for stop in stops}
        patterns = defaultdict(int)
        for sequence in trip_stop_sequences.values():
            ordered = tuple(stop_id for _, stop_id in sorted(sequence) if stop_id in valid_ids)
            if len(ordered) >= 2:
                patterns[ordered] += 1
        if not patterns:
            raise ValueError("No valid ordered X36 stop patterns in supplied GTFS")
        stop_patterns = [{"stopIds": list(ids), "tripCount": count}
                         for ids, count in sorted(patterns.items(), key=lambda item: (-item[1], item[0]))]
        return {"line": "X36", "networkId": "cars-region-express",
                "sourceType": "official_gtfs", "sourceUrl": source_url,
                "sourceSha256": checksum,
                "checkedOn": checked_on, "routeCount": len(route_ids),
                "tripCount": len(trip_ids), "stopCount": len(stops),
                "candidatesOnly": True, "stopMappingVerified": False,
                "journeyFareVerified": False, "stopPatterns": stop_patterns, "stops": stops}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gtfs_zip")
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--checked-on", required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(extract(args.gtfs_zip, args.source_url, args.checked_on),
                         ensure_ascii=False, indent=2))
    except (ValueError, KeyError, zipfile.BadZipFile) as exc:
        print(f"GTFS audit failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
