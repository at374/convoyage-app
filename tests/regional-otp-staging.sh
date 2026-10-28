#!/usr/bin/env bash
# Regression test for OTP build staging. Uses a fake java binary: no network.
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/work"
printf 'jar' > "$tmp/otp.jar"
printf 'new-gtfs' > "$tmp/oura.zip"
printf 'new-osm' > "$tmp/region.pbf"
printf 'old-graph' > "$tmp/work/graph.obj"
printf 'old-gtfs' > "$tmp/work/oura-regional.gtfs.zip"
printf 'old-osm' > "$tmp/work/region.osm.pbf"
cat > "$tmp/bin/java" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
for last; do :; done
if [[ "${MOCK_BUILD_FAIL:-}" == yes ]]; then exit 23; fi
if [[ "$*" == *--build* ]]; then printf 'new-graph' > "$last/graph.obj"; fi
MOCK
chmod +x "$tmp/bin/java"
export PATH="$tmp/bin:$PATH" OTP_JAR="$tmp/otp.jar" OURA_GTFS="$tmp/oura.zip" OSM_PBF="$tmp/region.pbf" OTP_WORKDIR="$tmp/work"
if MOCK_BUILD_FAIL=yes bash "$repo/scripts/regional-otp/run.sh" build; then
  echo "Build should have failed" >&2
  exit 1
fi
[[ "$(cat "$tmp/work/graph.obj")" == old-graph ]]
[[ "$(cat "$tmp/work/oura-regional.gtfs.zip")" == old-gtfs ]]
[[ "$(cat "$tmp/work/region.osm.pbf")" == old-osm ]]
bash "$repo/scripts/regional-otp/run.sh" build
[[ "$(cat "$tmp/work/graph.obj")" == new-graph ]]
[[ "$(cat "$tmp/work/oura-regional.gtfs.zip")" == new-gtfs ]]
[[ "$(cat "$tmp/work/region.osm.pbf")" == new-osm ]]
echo "OTP staging and rollback regression tests passed"

# A second build must refuse to run while the lock is held.
(
  flock -x 9
  sleep 2
) 9>"$tmp/work/.build.lock" &
lock_pid=$!
sleep 0.3
if bash "$repo/scripts/regional-otp/run.sh" build; then
  echo "Concurrent build unexpectedly acquired the lock" >&2
  kill "$lock_pid" 2>/dev/null || true
  exit 1
fi
wait "$lock_pid"
[[ "$(cat "$tmp/work/graph.obj")" == new-graph ]]
echo "Concurrent build protection passed"
