#!/usr/bin/env python3
"""Build date-scoped SIBRA GTFS data for Agenda from an official GTFS zip.

Usage: python tools/build-sibra-day.py gtfs-sibra.zip 2026-10-28
Never marks transport as confirmed; source schedules are theoretical.
"""
import csv
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from datetime import date

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python tools/build-sibra-day.py GTFS.zip YYYY-MM-DD")
    source, requested = sys.argv[1:]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", requested):
        raise SystemExit("Invalid date")
    day = date.fromisoformat(requested)
    compact = day.strftime("%Y%m%d")
    with zipfile.ZipFile(source) as archive:
        def records(name):
            with archive.open(name) as stream:
                yield from csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig"))
        active = set()
        for row in records("calendar.txt"):
            if row["start_date"] <= compact <= row["end_date"] and row[day.strftime("%A").lower()] == "1":
                active.add(row["service_id"])
        for row in records("calendar_dates.txt"):
            if row["date"] != compact:
                continue
            if row["exception_type"] == "1":
                active.add(row["service_id"])
            elif row["exception_type"] == "2":
                active.discard(row["service_id"])
        trips = [[r["trip_id"], r["route_id"], r.get("trip_headsign", "")] for r in records("trips.txt") if r["service_id"] in active]
        trip_ids = {t[0] for t in trips}
        times = [[r["trip_id"], r["stop_id"], int(r["stop_sequence"]), r["arrival_time"], r["departure_time"]]
                 for r in records("stop_times.txt") if r["trip_id"] in trip_ids]
        stops = [[r["stop_id"], r["stop_name"], float(r["stop_lat"]), float(r["stop_lon"])]
                 for r in records("stops.txt") if r.get("stop_lat") and r.get("stop_lon")]
        routes = [[r["route_id"], r.get("route_short_name", ""), r.get("route_long_name", "")]
                  for r in records("routes.txt")]
    payload = {"date": requested, "source": Path(source).name, "transportConfirmed": False,
               "realtime": False, "stops": stops, "routes": routes, "trips": trips, "stop_times": times}
    output = Path("data/sibra") / ("sibra-" + requested + ".json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{output}: {len(trips)} trips, {len(times)} stop times, {len(stops)} stops")

if __name__ == "__main__":
    main()
