#!/usr/bin/env bash
# Prepare and run a local OpenTripPlanner 2 routing server for the regional Agenda.
# Prerequisites: Java 21, an OTP 2 executable jar, an OSM .pbf covering the
# GTFS geographic extent, and the validated Oura GTFS artifact from GitHub Actions.
# Does not deploy anything publicly or change the app's mission synchronization.
set -euo pipefail

usage() {
  echo "Usage: OTP_JAR=/path/otp.jar OURA_GTFS=/path/oura-regional.gtfs.zip OSM_PBF=/path/region.osm.pbf $0 [build|serve]" >&2
  exit 2
}
mode="${1:-}"
[[ "$mode" == build || "$mode" == serve ]] || usage
: "${OTP_JAR:?Set OTP_JAR to an OpenTripPlanner 2 executable jar}"
[[ -s "$OTP_JAR" ]] || { echo "Missing OTP jar: $OTP_JAR" >&2; exit 1; }
if [[ "$mode" == build ]]; then
  : "${OURA_GTFS:?Set OURA_GTFS to the validated Oura GTFS archive}"
  : "${OSM_PBF:?Set OSM_PBF to a suitable OpenStreetMap extract}"
  for file in "$OURA_GTFS" "$OSM_PBF"; do
    [[ -s "$file" ]] || { echo "Missing or empty file: $file" >&2; exit 1; }
  done
fi
command -v java >/dev/null || { echo "Java not installed" >&2; exit 1; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="${OTP_WORKDIR:-$root/.local/otp-aura}"
mkdir -p "$work"
if [[ "$mode" == build ]]; then
  if [[ "$OURA_GTFS" != "$work/oura-regional.gtfs.zip" ]]; then
    cp "$OURA_GTFS" "$work/oura-regional.gtfs.zip"
  fi
  if [[ "$OSM_PBF" != "$work/region.osm.pbf" ]]; then
    cp "$OSM_PBF" "$work/region.osm.pbf"
  fi
  # Do not reuse a stale graph when the transit or street inputs change.
  rm -f "$work/graph.obj"
  echo "Building graph in $work (requires substantial memory and disk space)"
  java ${OTP_JAVA_OPTS:--Xmx8G} -jar "$OTP_JAR" --build --save "$work"
  [[ -s "$work/graph.obj" ]] || { echo "OTP did not create graph.obj" >&2; exit 1; }
  echo "Graph created. Run this script with 'serve' to start the router."
else
  [[ -s "$work/graph.obj" ]] || { echo "Graph missing; run build first" >&2; exit 1; }
  echo "Starting OTP locally; verify its GraphQL endpoint and schema before configuring the app."
  java ${OTP_JAVA_OPTS:--Xmx8G} -jar "$OTP_JAR" --load --serve "$work"
fi
