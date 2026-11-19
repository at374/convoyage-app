# Robot Hiflow automatique (Cloud Run) — déploiement

Même principe que le serveur OTP2 : un service Cloud Run réveillé par Cloud Scheduler,
qui se connecte à Hiflow avec un vrai navigateur (Playwright) et met à jour Supabase.
Il réutilise le code déjà éprouvé du robot Android (`net-core.js` / `sync-core.js`,
copiés dans `server/hiflow-vendor/`).

## 1. Préalable : enregistrer tes identifiants Hiflow

Dans l'application Convoyage Ultra → Réglages → Connecter ma plateforme → Hiflow,
saisis ton e-mail et ton mot de passe. Ils sont chiffrés côté Supabase (Vault) ;
ni moi ni l'application ne peuvent les relire en clair — seul le robot le peut,
au moment de se connecter.

## 2. Secrets (une seule fois, dans Cloud Shell)

```bash
PROJECT=<ton-projet-gcp>
gcloud config set project "$PROJECT"

# Clé service_role Supabase (Project Settings → API → service_role) — jamais côté client/app.
echo -n "COLLE_LA_CLE_SERVICE_ROLE" | gcloud secrets create hiflow-sync-service-key --data-file=-

# Secret partagé pour que seul Cloud Scheduler puisse déclencher le robot.
openssl rand -hex 24 | gcloud secrets create hiflow-sync-secret --data-file=-
```

## 3. Build + déploiement du service

Depuis le dossier `server/hiflow-sync-deploy` du dépôt `convoyage-app` (ce dossier est autonome :
`Dockerfile`, `package.json`, le code du robot et le code repris du robot Android) :

```bash
cd server/hiflow-sync-deploy
gcloud run deploy hiflow-sync \
  --source . \
  --region europe-west1 \
  --no-allow-unauthenticated \
  --memory 1Gi --cpu 1 --timeout 900 --concurrency 1 --max-instances 1 \
  --set-env-vars SUPABASE_URL=https://ozjouxdjhgoprsbefhjq.supabase.co,HIFLOW_USER_ID=<uuid-de-ton-compte> \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=hiflow-sync-service-key:latest,HIFLOW_SYNC_SECRET=hiflow-sync-secret:latest
```

(`<uuid-de-ton-compte>` : ton `auth.users.id` Supabase — visible dans Authentication → Users.)

`--no-allow-unauthenticated` : le service n'est pas public ; seul Cloud Scheduler
(avec son propre compte de service) pourra l'appeler.

## 4. Cloud Scheduler (toutes les 10 minutes)

```bash
URL=$(gcloud run services describe hiflow-sync --region europe-west1 --format='value(status.url)')
SECRET=$(gcloud secrets versions access latest --secret=hiflow-sync-secret)

gcloud scheduler jobs create http hiflow-sync-10min \
  --location europe-west1 \
  --schedule "*/10 * * * *" \
  --uri "$URL/sync" \
  --http-method POST \
  --headers "X-Sync-Secret=$SECRET" \
  --oidc-service-account-email <PROJECT_NUMBER>-compute@developer.gserviceaccount.com \
  --oidc-token-audience "$URL" \
  --attempt-deadline 540s
```

## 5. Vérification

```bash
curl -s -X POST "$URL/sync" -H "X-Sync-Secret: $SECRET"
```

Doit renvoyer `{"statut":"ok","nb_missions":...,"regions_ok":17,"regions_total":17}`.
En cas de souci, `gcloud run services logs read hiflow-sync --region europe-west1`.

## 6. Coût

Comme OTP2 : à la demande, pas de serveur qui tourne en continu. ~144 exécutions/jour
de quelques minutes chacune, largement dans le niveau gratuit Cloud Run.

## Points de sécurité déjà en place

- Le mot de passe Hiflow n'est jamais stocké en clair (Supabase Vault), jamais dans ce dépôt,
  jamais relu par l'application — seule la fonction `lire_identifiant_plateforme` (appelable
  uniquement par `service_role`) peut le déchiffrer.
- Le robot ne devine jamais le format exact des appels Hiflow : il remplit le formulaire visible
  comme un humain, puis lit passivement les réponses JSON que le site envoie déjà à son propre
  navigateur (même méthode que le robot Android, déjà en production).
- `--no-allow-unauthenticated` + secret partagé : personne d'autre que Cloud Scheduler ne peut
  déclencher une synchronisation.
