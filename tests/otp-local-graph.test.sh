#!/usr/bin/env bash
# Tests locaux du lanceur OTP2 sans téléchargement d'image ni démarrage Docker.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/otp-local-graph.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/feeds"
cat > "$TMP/bin/docker" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$OTP_TEST_LOG"
EOF
chmod +x "$TMP/bin/docker"
export PATH="$TMP/bin:$PATH"
export OTP_TEST_LOG="$TMP/docker.log"
command -v zip >/dev/null || { echo "zip requis pour ce test" >&2; exit 2; }
command -v unzip >/dev/null || { echo "unzip requis pour ce test" >&2; exit 2; }
mkdir -p "$TMP/gtfs"
for f in agency.txt stops.txt routes.txt trips.txt stop_times.txt; do
  printf 'id,name\\n1,Test\\n' > "$TMP/gtfs/$f"
done
(cd "$TMP/gtfs" && zip -q "$TMP/feeds/GTFS_FP2026_20261111.zip" ./*.txt)
printf 'osm' > "$TMP/feeds/aura.osm.pbf"
bash -n "$SCRIPT"
bash "$SCRIPT" "$TMP/feeds" build
grep -q -- '--build --save' "$OTP_TEST_LOG"
grep -q -- '--memory=12g --cpus=2' "$OTP_TEST_LOG"
printf 'graph' > "$TMP/feeds/graph.obj"
bash "$SCRIPT" "$TMP/feeds" serve
grep -q -- '127.0.0.1:8080:8080' "$OTP_TEST_LOG"
grep -q -- '--load --serve' "$OTP_TEST_LOG"
if bash "$SCRIPT" "$TMP/feeds" wrong 2>/dev/null; then echo 'Mode invalide accepté' >&2; exit 1; fi
printf 'bad' > "$TMP/feeds/not-gtfs.zip"
if bash "$SCRIPT" "$TMP/feeds" build >/dev/null 2>&1; then
  echo 'Archive non GTFS acceptée' >&2; exit 1
fi
rm "$TMP/feeds/not-gtfs.zip"
printf 'corrompu' > "$TMP/feeds/corrupt.zip"
if bash "$SCRIPT" "$TMP/feeds" build >/dev/null 2>&1; then
  echo 'ZIP corrompu accepté' >&2; exit 1
fi
rm "$TMP/feeds/corrupt.zip"
: > "$TMP/feeds/aura.osm.pbf"
if bash "$SCRIPT" "$TMP/feeds" build >/dev/null 2>&1; then
  echo 'OSM vide accepté' >&2; exit 1
fi
echo 'OK : ZIP GTFS, rejet archive non GTFS, ZIP corrompu, OSM vide, build/serve, port local'
