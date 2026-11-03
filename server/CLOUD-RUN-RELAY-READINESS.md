# Préparation du relais transports sur Cloud Run (aucun déploiement automatique)

Le conteneur `server/Dockerfile.transport-realtime` expose le relais BlaBlaCar Bus sur le port 8080. Son endpoint `/health` teste uniquement le processus, **pas** la disponibilité de l'opérateur.

## Configuration cible à approuver
- Projet GCP : `convoyage-ultra` ; région : `europe-west9` (Paris).
- Cloud Run : facturation à la requête, **minimum 0**, **maximum 2** instances.
- Image construite depuis le dépôt et stockée dans Artifact Registry uniquement après accord.
- Variable `TRANSPORT_ALLOWED_ORIGINS` : origines HTTPS exactes de l'application autorisées, séparées par des virgules. Ne pas utiliser `*`.
- `PORT=8080`, service sans secret utilisateur ; endpoint de santé `/health`.
- Accès public éventuel à l'URL Cloud Run à examiner : le relais ne demande pas d'authentification. CORS limite les navigateurs, **pas** les clients HTTP non-navigateurs. Le relais dispose d'une limite de requêtes par instance ; prévoir un contrôle de coût et d'abus en amont.
- Aucun changement des bases Supabase, de l'authentification ni de la synchronisation des missions.

## Vérifications obligatoires avant mise en service
1. Valider le projet, la facturation, les crédits restants, les quotas, le coût prévisionnel Cloud Run + Artifact Registry + Cloud Build + trafic sortant. Min=0 ne garantit pas un coût nul.
2. Vérifier la disponibilité réelle du flux amont, la légitimité des accès et les conditions d'utilisation.
3. Construire et démarrer localement le conteneur ; vérifier `/health`, CORS, erreurs HTTP, cache, expiration et limitation de requêtes.
4. Faire approuver l'URL de déploiement, les paramètres de coût, le nombre maximal d'instances et les éventuelles limites de dépenses. Une alerte budgétaire **ne coupe pas automatiquement** le service.
5. Après autorisation explicite seulement : déployer, contrôler HTTPS et CORS depuis le domaine exact de l'application, configurer l'URL du relais côté client, puis tester sur Android.
6. Garder un retour arrière simple (ancienne configuration client, suppression du service si nécessaire).

Ce document est une préparation technique : **aucune commande de déploiement ni ressource facturable n'est créée**.
