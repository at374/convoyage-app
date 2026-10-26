#!/usr/bin/env python3
"""Audit hors ligne d'une archive GTFS officielle avant intégration.

Usage: python3 scripts/auditer_gtfs.py chemin/vers/reseau.zip --source URL_OFFICIELLE
N'effectue aucun téléchargement et ne modifie pas les fichiers de l'application.
"""
import argparse
import csv
import io
import json
import re
import sys
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path

REQUIRED = {
    "stops.txt": {"stop_id", "stop_name"},
    "routes.txt": {"route_id", "route_type"},
    "trips.txt": {"trip_id", "route_id", "service_id"},
    "stop_times.txt": {"trip_id", "stop_id", "stop_sequence", "arrival_time", "departure_time"},
}
CALENDAR_DAYS = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
DATE_PATTERN = re.compile(r"^\d{8}$")


def date_ok(value):
    if not DATE_PATTERN.fullmatch(value or ""):
        return False
    try:
        datetime.strptime(value, "%Y%m%d")
        return True
    except ValueError:
        return False


def audit(path, source):
    errors = []
    warnings = []
    counts = {}
    ids = {}
    with zipfile.ZipFile(path) as archive:
        entries = {}
        for name in archive.namelist():
            if name.endswith("/"):
                continue
            basename = Path(name).name.lower()
            if basename in entries:
                errors.append("Nom de fichier GTFS dupliqué : " + basename)
            entries[basename] = name

        for name in REQUIRED:
            if name not in entries:
                errors.append("Fichier obligatoire absent : " + name)
        if not ({"calendar.txt", "calendar_dates.txt"} & entries.keys()):
            errors.append("Calendrier absent : calendar.txt ou calendar_dates.txt requis")

        tables = {}
        for name in set(REQUIRED) | {"calendar.txt", "calendar_dates.txt", "agency.txt", "feed_info.txt"}:
            if name not in entries:
                continue
            with archive.open(entries[name]) as handle:
                reader = csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig", newline=""))
                columns = set(reader.fieldnames or [])
                missing = REQUIRED.get(name, set()) - columns
                if missing:
                    errors.append(name + " : colonnes absentes : " + ", ".join(sorted(missing)))
                if name == "calendar.txt" and not ({"service_id", "start_date", "end_date"} | CALENDAR_DAYS) <= columns:
                    errors.append("calendar.txt : colonnes obligatoires absentes")
                if name == "calendar_dates.txt" and not {"service_id", "date", "exception_type"} <= columns:
                    errors.append("calendar_dates.txt : colonnes obligatoires absentes")
                rows = list(reader)
                tables[name] = rows
                counts[name] = len(rows)

        for name, column in (("stops.txt", "stop_id"), ("routes.txt", "route_id"), ("trips.txt", "trip_id")):
            values = [row.get(column, "") for row in tables.get(name, [])]
            duplicates = sum(v > 1 for v in Counter(values).values())
            if duplicates:
                errors.append(f"{name} : {duplicates} identifiants dupliqués")
            if "" in values:
                errors.append(name + " : identifiants vides")
            ids[name] = set(values)

        services = {r.get("service_id") for name in ("calendar.txt", "calendar_dates.txt")
                    for r in tables.get(name, [])}
        for trip in tables.get("trips.txt", []):
            if trip.get("route_id") not in ids.get("routes.txt", set()):
                errors.append("Course avec route inconnue : " + str(trip.get("trip_id")))
            if trip.get("service_id") not in services:
                errors.append("Course avec service inconnu : " + str(trip.get("trip_id")))
        passages_par_course = {}
        for stop_time in tables.get("stop_times.txt", []):
            trip_id = stop_time.get("trip_id")
            if trip_id not in ids.get("trips.txt", set()):
                errors.append("Passage avec course inconnue")
            if stop_time.get("stop_id") not in ids.get("stops.txt", set()):
                errors.append("Passage avec arrêt inconnu")
            sequence = stop_time.get("stop_sequence", "")
            if not sequence.isdigit() or int(sequence) < 1:
                errors.append("Numéro de passage invalide : " + str(trip_id))
            else:
                passages_par_course.setdefault(trip_id, []).append((int(sequence), stop_time))
        for trip_id, passages in passages_par_course.items():
            if len({seq for seq, _ in passages}) != len(passages):
                errors.append("Séquences d'arrêts dupliquées : " + str(trip_id))
            precedent = None
            for _, passage in sorted(passages):
                arrivee = passage.get("arrival_time", "")
                depart = passage.get("departure_time", "")
                def secondes(valeur):
                    morceaux = valeur.split(":")
                    if len(morceaux) != 3 or not all(x.isdigit() for x in morceaux):
                        return None
                    h, m, s = map(int, morceaux)
                    return h * 3600 + m * 60 + s if h < 48 and m < 60 and s < 60 else None
                a, d = secondes(arrivee), secondes(depart)
                if (arrivee and a is None) or (depart and d is None):
                    errors.append("Horaire invalide : " + str(trip_id))
                if a is not None and d is not None and d < a:
                    errors.append("Départ avant arrivée : " + str(trip_id))
                if precedent is not None and a is not None and a < precedent:
                    errors.append("Horaires décroissants : " + str(trip_id))
                if d is not None:
                    precedent = d
        for row in tables.get("calendar.txt", []):
            if not date_ok(row.get("start_date")) or not date_ok(row.get("end_date")):
                errors.append("Date de calendrier invalide")
        for row in tables.get("calendar_dates.txt", []):
            if not date_ok(row.get("date")) or row.get("exception_type") not in {"1", "2"}:
                errors.append("Exception de calendrier invalide")

        if "feed_info.txt" not in entries:
            warnings.append("feed_info.txt absent : validité du flux à confirmer à la source")
        else:
            for row in tables.get("feed_info.txt", []):
                if row.get("feed_end_date") and date_ok(row["feed_end_date"]):
                    if row["feed_end_date"] < datetime.now().strftime("%Y%m%d"):
                        warnings.append("Flux expiré selon feed_end_date")
        return {
            "source_declaree": source or None,
            "archive": str(path),
            "valide_structurellement": not errors,
            "validation_horaires_reels": False,
            "comptages": counts,
            "erreurs_total": len(errors),
            "erreurs": errors[:100],
            "avertissements": warnings,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--source", default="", help="Adresse officielle de provenance (déclarative)")
    parser.add_argument("--rapport", type=Path, help="Chemin facultatif du rapport JSON")
    args = parser.parse_args()
    try:
        result = audit(args.archive, args.source)
    except (OSError, zipfile.BadZipFile, UnicodeError, csv.Error) as exc:
        print(json.dumps({"erreur": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    report = json.dumps(result, ensure_ascii=False, indent=2)
    print(report)
    if args.rapport:
        args.rapport.write_text(report + "\n", encoding="utf-8")
    return 0 if result["valide_structurellement"] else 1


if __name__ == "__main__":
    sys.exit(main())
