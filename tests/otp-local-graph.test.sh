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
touch "$TMP/feeds/GTFS_FP2026_20261111.zip" "$TMP/feeds/aura.osm.pbf"
# Empêche la vérification ZIP de la fixture vide en masquant unzip via un PATH contrôlé.
# La fixture n'est pas une vraie archive : ce test contrôle seulement les arguments Docker.
cat > "$TMP/bin/unzip" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TMP/bin/unzip"
bash -n "$SCRIPT"
bash "$SCRIPT" "$TMP/feeds" build
grep -q -- '--build --save' "$OTP_TEST_LOG"
grep -q -- '--memory=12g --cpus=2' "$OTP_TEST_LOG"
: > "$TMP/feeds/graph.obj"
printf 'graph' > "$TMP/feeds/graph.obj"
bash "$SCRIPT" "$TMP/feeds" serve
grep -q -- '127.0.0.1:8080:8080' "$OTP_TEST_LOG"
grep -q -- '--load --serve' "$OTP_TEST_LOG"
if bash "$SCRIPT" "$TMP/feeds" wrong 2>/dev/null; then echo 'Mode invalide accepté' >&2; exit 1; fi
echo 'OK : syntaxe, ZIP nommé sans gtfs, paramètres build/serve, port local, mode invalide'
