#!/usr/bin/env bash
# Convoyage Ultra — déploie le serveur OTP2 « à la demande » sur Cloud Run (nouveau service distinct).
# À lancer par le propriétaire du projet dans Google Cloud Shell. Ne touche JAMAIS à convoyage-transports-pilote.
# Facturation à la demande : 0 instance au repos, 1 instance au maximum, 2 vCPU / 8 Gio, tas Java 6 Go (mesuré).
# Usage : bash scripts/otp-reel/deployer-cloud-run.sh            (déployer)
#         bash scripts/otp-reel/deployer-cloud-run.sh supprimer  (tout retirer : service + image)
set -euo pipefail
PROJECT="convoyage-ultra"
REGION="europe-west9"
SERVICE="convoyage-otp2"
REPO="otp2"
OTP_IMAGE="docker.io/opentripplanner/opentripplanner:2.10.0"
GRAPH_URL="${GRAPH_URL:-https://github.com/at374/convoyage-app/releases/download/otp2-graphe/graph.obj}"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REPO/$SERVICE:$(date -u +%Y%m%d-%H%M)"
[[ "$SERVICE" != "convoyage-transports-pilote" ]] || { echo "Service protégé" >&2; exit 2; }
command -v gcloud >/dev/null || { echo "gcloud requis (Google Cloud Shell)" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker requis (Google Cloud Shell)" >&2; exit 2; }
gcloud config set project "$PROJECT" >/dev/null
if [[ "${1:-}" == "supprimer" ]]; then
  read -r -p "Supprimer le service $SERVICE et ses images ? Tapez OUI : " answer
  [[ "$answer" == "OUI" ]] || { echo "Annulé."; exit 0; }
  gcloud run services delete "$SERVICE" --region "$REGION" --quiet || true
  gcloud artifacts repositories delete "$REPO" --location "$REGION" --quiet || true
  echo "Service et images supprimés. convoyage-transports-pilote n'a pas été touché."
  exit 0
fi
cat <<TXT
Création du service Cloud Run « $SERVICE » (projet $PROJECT, région $REGION) :
  - 2 vCPU, 8 Gio, 0 instance au repos, 1 instance au maximum, facturation à la demande
  - accès HTTPS public (nécessaire pour l'application), 60 s maximum par requête
  - image stockée dans Artifact Registry (environ 1 Go, quelques centimes par mois)
  - le service existant convoyage-transports-pilote n'est pas modifié
Coût : environ 0,25 à 0,35 \$ par heure de calcul réel, après le quota gratuit mensuel.
TXT
read -r -p "Continuer ? Tapez OUI : " answer
[[ "$answer" == "OUI" ]] || { echo "Annulé, rien n'a été créé."; exit 0; }
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Le disque personnel de Cloud Shell (5 Go) peut être plein : Docker écrit sa configuration dans le dossier temporaire.
export DOCKER_CONFIG="$work/docker-config" BUILDX_CONFIG="$work/buildx"
mkdir -p "$DOCKER_CONFIG" "$BUILDX_CONFIG"
echo "Téléchargement du graphe construit et validé par GitHub Actions…"
curl -fL --retry 3 -o "$work/graph.obj" "$GRAPH_URL"
[[ "$(stat -c %s "$work/graph.obj")" -gt 100000000 ]] || { echo "Graphe anormalement petit" >&2; exit 1; }
if curl -fsL -o "$work/graph.sha256" "$GRAPH_URL.sha256"; then
  (cd "$work" && echo "$(cut -d' ' -f1 graph.sha256)  graph.obj" | sha256sum -c -)
fi
cat > "$work/Dockerfile" <<DOCKER
FROM $OTP_IMAGE
COPY graph.obj /var/opentripplanner/graph.obj
DOCKER
gcloud services enable artifactregistry.googleapis.com run.googleapis.com --quiet
gcloud artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO" --repository-format docker --location "$REGION" --description "Serveur OTP2 Convoyage Ultra"
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
mkdir -p "$work/image" && mv "$work/graph.obj" "$work/Dockerfile" "$work/image/"
docker build -t "$IMAGE" "$work/image"
pushed=''
for attempt in 1 2 3 4; do
  if docker push "$IMAGE"; then pushed=1; break; fi
  echo "Envoi de l'image interrompu (essai $attempt), nouvelle tentative dans 15 s…"; sleep 15
done
[[ -n "$pushed" ]] || { echo "Envoi de l'image impossible : relancer la commande plus tard." >&2; exit 1; }
gcloud run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" \
  --cpu 2 --memory 8Gi --min-instances 0 --max-instances 1 --concurrency 20 --timeout 60 \
  --cpu-boost --execution-environment gen2 --port 8080 --allow-unauthenticated \
  --set-env-vars JAVA_TOOL_OPTIONS=-Xmx6g --args=--load,--serve
url="$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')"
echo "Service créé : $url"
echo "Essai réel (le premier appel réveille le serveur, patienter)…"
start=$(date +%s)
curl -fsS -m 300 -X POST -H 'content-type: application/json' -d '{"query":"{__typename}"}' "$url/otp/gtfs/v1" && echo
echo "Réponse obtenue en $(( $(date +%s) - start )) s."
echo "Adresse à transmettre à Claude : $url/otp/gtfs/v1"
