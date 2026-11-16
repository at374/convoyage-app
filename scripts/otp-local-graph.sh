#!/usr/bin/env bash
# Construction locale OTP2 2.10.0, aucune ressource Cloud.
# Usage: bash scripts/otp-local-graph.sh <repertoire-GTFS-OSM> [build|serve]
set -euo pipefail
if [[ $# -lt 1 || $# -gt 2 ]]; then echo "Usage: $0 <dossier> [build|serve]" >&2; exit 2; fi
command -v docker >/dev/null || { echo "Docker est requis" >&2; exit 2; }
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
  for zip in "${gtfs[@]}"; do
    if command -v unzip >/dev/null; then unzip -tq "$zip" >/dev/null || { echo "ZIP GTFS corrompu : $zip" >&2; exit 2; }; fi
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
