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
# Prevent two concurrent graph builds from replacing each other's data.
if [[ "$mode" == build ]]; then
  command -v flock >/dev/null || { echo "flock is required for safe builds" >&2; exit 1; }
  exec 9>"$work/.build.lock"
  if ! flock -n 9; then
    echo "A regional graph build is already running" >&2
    exit 1
  fi
fi
if [[ "$mode" == build ]]; then
  # Never overwrite the last valid graph or inputs until the new build succeeds.
  candidate="$(mktemp -d "${work%/}.candidate.XXXXXX")"
  cleanup_candidate() { rm -rf "$candidate"; }
  trap cleanup_candidate EXIT
  cp "$OURA_GTFS" "$candidate/oura-regional.gtfs.zip"
  cp "$OSM_PBF" "$candidate/region.osm.pbf"
  echo "Building candidate graph in $candidate (requires substantial memory and disk space)"
  java ${OTP_JAVA_OPTS:--Xmx8G} -jar "$OTP_JAR" --build --save "$candidate"
  if [[ ! -s "$candidate/graph.obj" ]]; then
    echo "OTP did not create graph.obj; existing graph remains untouched" >&2
    exit 1
  fi
  # Stage a complete new dataset and graph together; preserve the previous
  # generation until all candidate files are present.
  # Refuse to swap the graph while a local router holds the shared lock.
  exec 8>"$work/.serve.lock"
  if ! flock -n -x 8; then
    echo "Cannot replace graph while regional router is serving" >&2
    exit 1
  fi
  previous="$(mktemp -d "${work%/}.previous.XXXXXX")"
  for name in graph.obj oura-regional.gtfs.zip region.osm.pbf; do
    if [[ -e "$work/$name" ]]; then mv "$work/$name" "$previous/$name"; fi
  done
  rollback() {
    for name in graph.obj oura-regional.gtfs.zip region.osm.pbf; do
      rm -f "$work/$name"
      if [[ -e "$previous/$name" ]]; then mv "$previous/$name" "$work/$name"; fi
    done
  }
  trap rollback ERR INT TERM
  for name in graph.obj oura-regional.gtfs.zip region.osm.pbf; do
    mv "$candidate/$name" "$work/$name"
  done
  trap - ERR INT TERM
  rm -rf "$previous"
  echo "Graph created. Run this script with 'serve' to start the router."
else
  command -v flock >/dev/null || { echo "flock is required for safe serving" >&2; exit 1; }
  exec 8>"$work/.serve.lock"
  if ! flock -n -s 8; then
    echo "Cannot start router while graph is being replaced" >&2
    exit 1
  fi
  [[ -s "$work/graph.obj" ]] || { echo "Graph missing; run build first" >&2; exit 1; }
  echo "Starting OTP locally; verify its GraphQL endpoint and schema before configuring the app."
  java ${OTP_JAVA_OPTS:--Xmx8G} -jar "$OTP_JAR" --load --serve "$work"
fi
