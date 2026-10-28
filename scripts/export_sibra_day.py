#!/usr/bin/env python3
"""Convert a SIBRA GTFS ZIP into date-scoped JSON consumed by sibra-feed.js.

Usage: python3 scripts/export_sibra_day.py gtfs-sibra.zip 2026-10-28
Only theoretical schedules; never real-time confirmation.
"""
import csv
import datetime as dt
import io
import json
import pathlib
import sys
import zipfile


def rows(archive, filename):
    matches = [n for n in archive.namelist() if n.rsplit("/", 1)[-1] == filename]
    if not matches:
        return []
    with archive.open(matches[0]) as stream:
        return list(csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig")))


def active_services(archive, date):
    compact = date.strftime("%Y%m%d")
    weekday = date.strftime("%A").lower()
    active = set()
    for row in rows(archive, "calendar.txt"):
        if row.get("start_date", "") <= compact <= row.get("end_date", "") and row.get(weekday) == "1":
            active.add(row["service_id"])
    for row in rows(archive, "calendar_dates.txt"):
        if row.get("date") == compact:
            if row.get("exception_type") == "1":
                active.add(row["service_id"])
            elif row.get("exception_type") == "2":
                active.discard(row["service_id"])
    return active


def export(zip_path, date, destination):
    with zipfile.ZipFile(zip_path) as archive:
        active = active_services(archive, date)
        trips = [r for r in rows(archive, "trips.txt") if r.get("service_id") in active]
        trip_ids = {r["trip_id"] for r in trips}
        times = [r for r in rows(archive, "stop_times.txt") if r.get("trip_id") in trip_ids]
        stop_ids = {r["stop_id"] for r in times}
        stops = [r for r in rows(archive, "stops.txt") if r.get("stop_id") in stop_ids]
        route_ids = {r["route_id"] for r in trips}
        routes = [r for r in rows(archive, "routes.txt") if r.get("route_id") in route_ids]
        if not trips or not times or not stops or not routes:
            raise ValueError("No complete GTFS service for this date; refusing empty output")
        known_stops = {r["stop_id"] for r in stops}
        known_routes = {r["route_id"] for r in routes}
        if stop_ids - known_stops or route_ids - known_routes:
            raise ValueError("GTFS has unresolved stop or route references")
        payload = {
            "date": date.isoformat(), "transportConfirmed": False, "realtime": False,
            "stops": [[r["stop_id"], r.get("stop_name", ""), float(r["stop_lat"]), float(r["stop_lon"])] for r in stops],
            "routes": [[r["route_id"], r.get("route_short_name", ""), r.get("route_long_name", "")] for r in routes],
            "trips": [[r["trip_id"], r["route_id"], r.get("trip_headsign", "")] for r in trips],
            "stop_times": [[r["trip_id"], r["stop_id"], int(r["stop_sequence"]),
                            r["arrival_time"], r["departure_time"]] for r in times],
        }
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{date}: {len(trips)} trips, {len(times)} stop times -> {destination}")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit("Usage: export_sibra_day.py gtfs-sibra.zip YYYY-MM-DD [output.json]")
    day = dt.date.fromisoformat(sys.argv[2])
    output = pathlib.Path(sys.argv[3]) if len(sys.argv) == 4 else pathlib.Path("data/sibra") / f"sibra-{day}.json"
    export(pathlib.Path(sys.argv[1]), day, output)
