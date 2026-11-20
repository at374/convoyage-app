# Déploiement Cloud Run — DriiveMe (à exécuter toi-même)

Je n'ai pas d'accès gcloud ni de sortie réseau vers les API Google Cloud depuis ce bac à
sable (aucun compte authentifié, et le proxy sortant bloque `cloudresourcemanager.googleapis.com`
et consorts) : je ne peux pas lancer ce déploiement moi-même. Voici les commandes exactes,
reprenant la configuration validée dans `CLOUD-RUN-DRIIVEME-READINESS.md`. À lancer depuis un
terminal où tu es authentifié (`gcloud auth login`) avec accès au projet `convoyage-ultra`.

## 1. Construire et pousser l'image

```bash
cd server/driiveme-sync-deploy
gcloud config set project convoyage-ultra
gcloud builds submit --tag europe-west9-docker.pkg.dev/convoyage-ultra/cloud-run-source-deploy/driiveme-sync
```

(Si le dépôt Artifact Registry `cloud-run-source-deploy` n'existe pas encore dans `europe-west9`,
`gcloud builds submit` avec `--tag` le crée automatiquement au premier appel.)

## 2. Créer les secrets (une seule fois)

```bash
echo -n "LA_CLE_SERVICE_ROLE_SUPABASE" | gcloud secrets create driiveme-supabase-key --data-file=-
echo -n "UN_SECRET_ALEATOIRE_LONG" | gcloud secrets create driiveme-sync-secret --data-file=-
```

(Génère le secret partagé avec Cloud Scheduler toi-même, par ex. `openssl rand -hex 32`.)

## 3. Déployer le service Cloud Run

```bash
gcloud run deploy driiveme-sync \
  --image europe-west9-docker.pkg.dev/convoyage-ultra/cloud-run-source-deploy/driiveme-sync \
  --region europe-west9 \
  --platform managed \
  --no-allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars SUPABASE_URL=https://ozjouxdjhgoprsbefhjq.supabase.co,DRIIVEME_USER_ID=3ffcc9a2-ca38-49b7-aec1-6fc0893244a5,DRIIVEME_LOT=4 \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=driiveme-supabase-key:latest,DRIIVEME_SYNC_SECRET=driiveme-sync-secret:latest
```

Note l'URL renvoyée (`https://driiveme-sync-xxxxx-ew.a.run.app`).

## 4. Tester un cycle manuel avant d'automatiser

```bash
curl -X POST "URL_DU_SERVICE/sync" -H "X-Sync-Secret: UN_SECRET_ALEATOIRE_LONG"
```

Vérifie ensuite dans Supabase (`select * from sources_etat where platform='DriiveMe'` et
`select * from missions where platform='DriiveMe' order by first_seen_at desc limit 20`) que
la lecture a bien eu lieu, avant de passer à l'automatisation.

## 5. Planifier (Cloud Scheduler, toutes les 5 minutes)

```bash
gcloud scheduler jobs create http driiveme-sync-5min \
  --location europe-west9 \
  --schedule "*/5 * * * *" \
  --uri "URL_DU_SERVICE/sync" \
  --http-method POST \
  --headers "X-Sync-Secret=UN_SECRET_ALEATOIRE_LONG" \
  --attempt-deadline 300s
```

## Retour arrière

```bash
gcloud scheduler jobs delete driiveme-sync-5min --location europe-west9
gcloud run services delete driiveme-sync --region europe-west9
```

La lecture manuelle DriiveMe depuis le téléphone continue de fonctionner sans ce robot pendant
et après ces étapes.
