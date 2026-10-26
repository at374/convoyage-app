#!/usr/bin/env python3
"""Télécharge un GTFS officiel et lance l'audit sans toucher à l'application.

Exemple :
python3 scripts/recuperer_gtfs.py --url 'URL_DIRECTE_DU_ZIP' --reseau sibra --destination donnees-gtfs
La source doit être un lien ZIP direct provenant d'un producteur ou du PAN.
"""
import argparse
import hashlib
import json
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

MAX_SIZE = 100 * 1024 * 1024


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--reseau", required=True)
    parser.add_argument("--destination", type=Path, default=Path("donnees-gtfs"))
    args = parser.parse_args()
    parsed = urllib.parse.urlparse(args.url)
    if parsed.scheme != "https" or not parsed.hostname:
        parser.error("URL HTTPS obligatoire")
    if not (parsed.hostname == "transport.data.gouv.fr" or
            parsed.hostname.endswith(".transport.data.gouv.fr") or
            parsed.hostname.endswith(".data.gouv.fr")):
        parser.error("Domaine non autorisé : utiliser une source officielle du PAN")
    name = "".join(c for c in args.reseau.lower() if c.isalnum() or c in "-_")
    if not name:
        parser.error("Nom de réseau invalide")
    args.destination.mkdir(parents=True, exist_ok=True)
    archive = args.destination / (name + ".zip")
    temp = args.destination / (name + ".zip.part")
    req = urllib.request.Request(args.url, headers={"User-Agent": "ConvoyageUltra-GTFS-Audit/1.0"})
    digest = hashlib.sha256()
    size = 0
    try:
        with urllib.request.urlopen(req, timeout=35) as response, temp.open("wb") as out:
            final = urllib.parse.urlparse(response.geturl())
            if final.scheme != "https":
                raise ValueError("Redirection vers une URL non HTTPS")
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_SIZE:
                    raise ValueError("Archive supérieure à 100 Mo")
                digest.update(chunk)
                out.write(chunk)
        with zipfile.ZipFile(temp) as z:
            members = z.infolist()
            if len(members) > 100:
                raise ValueError("Archive GTFS avec trop de fichiers")
            if sum(m.file_size for m in members) > 750 * 1024 * 1024:
                raise ValueError("Archive GTFS décompressée supérieure à 750 Mo")
            names = [Path(m.filename).name.lower() for m in members if not m.is_dir()]
            if len(names) != len(set(names)):
                raise ValueError("Archive GTFS contenant des fichiers dupliqués")
            if not {"stops.txt", "routes.txt", "trips.txt", "stop_times.txt"} <= set(names):
                raise ValueError("Fichiers GTFS obligatoires absents")
            if not ({"calendar.txt", "calendar_dates.txt"} & set(names)):
                raise ValueError("Calendrier GTFS absent")
            if z.testzip() is not None:
                raise ValueError("Archive ZIP corrompue")
        temp.replace(archive)
    except Exception as exc:
        temp.unlink(missing_ok=True)
        print("Téléchargement non validé :", exc, file=sys.stderr)
        return 2
    metadata = {
        "reseau": name, "source": args.url,
        "date_telechargement_utc": datetime.now(timezone.utc).isoformat(),
        "taille_octets": size, "sha256": digest.hexdigest(),
        "archive": str(archive), "publication_application": False,
    }
    (args.destination / (name + ".provenance.json")).write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit = Path(__file__).with_name("auditer_gtfs.py")
    return subprocess.call([sys.executable, str(audit), str(archive),
                            "--source", args.url, "--rapport",
                            str(args.destination / (name + ".audit.json"))])


if __name__ == "__main__":
    sys.exit(main())
