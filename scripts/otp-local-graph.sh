#!/usr/bin/env bash
# Construction locale OTP2 2.10.0, aucune ressource Cloud.
# Usage: bash scripts/otp-local-graph.sh <repertoire-GTFS-OSM> [build|serve]
set -euo pipefail
if [[ $# -lt 1 || $# -gt 2 ]]; then echo "Usage: $0 <dossier> [build|serve]" >&2; exit 2; fi
command -v docker >/dev/null || { echo "Docker est requis" >&2; exit 2; }
[[ -d "$1" ]] || { echo "Dossier introuvable : $1" >&2; exit 2; }
DIR="$(cd "$1" && pwd)"
MODE="${2:-build}"
IMAGE="docker.io/opentripplanner/opentripplanner:2.10.0"
if [[ "$MODE" == "build" ]]; then
  shopt -s nullglob
  gtfs=("$DIR"/*.zip)
  osm=("$DIR"/*.osm.pbf)
  if (( ${#gtfs[@]} == 0 || ${#osm[@]} == 0 )); then
    echo "Requis : au moins un fichier .zip GTFS et un *.osm.pbf dans $DIR" >&2
    exit 2
  fi
  command -v unzip >/dev/null || { echo "unzip requis pour vérifier les archives GTFS" >&2; exit 2; }
  for file in "${osm[@]}"; do
    [[ -s "$file" ]] || { echo "Extrait OSM vide : $file" >&2; exit 2; }
  done
  for zip in "${gtfs[@]}"; do
    [[ -s "$zip" ]] || { echo "Archive GTFS vide : $zip" >&2; exit 2; }
    unzip -tq "$zip" >/dev/null || { echo "ZIP GTFS corrompu : $zip" >&2; exit 2; }
    listing="$(unzip -Z -1 "$zip")"
    for required in agency.txt stops.txt routes.txt trips.txt stop_times.txt; do
      if ! printf '%s\n' "$listing" | grep -Eq "(^|/)$required$"; then
        echo "Archive non GTFS : $zip (manque $required)" >&2; exit 2
      fi
    done
  done
  echo "Construction locale du graphe : $IMAGE"
  docker run --rm --memory=12g --cpus=2 -e JAVA_TOOL_OPTIONS="-Xmx9g" \
    -v "$DIR:/var/opentripplanner" "$IMAGE" --build --save
elif [[ "$MODE" == "serve" ]]; then
  [[ -s "$DIR/graph.obj" ]] || { echo "graph.obj absent ou vide" >&2; exit 2; }
  echo "Serveur OTP2 local uniquement : http://127.0.0.1:8080"
  docker run --rm --memory=8g --cpus=2 -e JAVA_TOOL_OPTIONS="-Xmx6g" \
    -p 127.0.0.1:8080:8080 -v "$DIR:/var/opentripplanner" "$IMAGE" --load --serve
else
  echo "Mode invalide : build ou serve" >&2; exit 2
fi
