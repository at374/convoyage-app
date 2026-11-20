# Préparation du robot DriiveMe sur Cloud Run (aucun déploiement automatique)

Le dossier `server/driiveme-sync-deploy/` contient un service Node (`driiveme-sync.cjs`, image
`mcr.microsoft.com/playwright:v1.49.0-jammy`) qui reprend, pour DriiveMe, le même principe que
`server/hiflow-sync-deploy/` : connexion avec un vrai navigateur (identifiants lus chiffrés dans
Supabase Vault via `lire_identifiant_plateforme`), lecture passive des réponses que le site envoie déjà
à son propre navigateur, écriture dans `missions` et `sources_etat`.

## Différence avec le robot Hiflow : lecture par lots
DriiveMe se lit par département (101) et par côté (départ / arrivée), soit ~202 recherches —
trop long pour un seul appel HTTP. Le service lit un **lot** (`DRIIVEME_LOT`, 4 par défaut) à
chaque appel et garde sa position dans la table `plateforme_curseurs` (créée par la migration
`plateforme_curseurs_driiveme`, 20/11/2026). Pour une couverture nationale en continu, Cloud
Scheduler doit donc appeler `/sync` **toutes les ~5 minutes** (202 ÷ 4 ≈ 51 appels pour un tour
complet, ≈ 4h15 par rotation complète à ce rythme — ajustable avec `DRIIVEME_LOT`).

## Limites connues de cette première version (à faire évoluer ensuite si besoin)
- Pas de lecture des fiches détail (créneaux horaires exacts, adresse précise, véhicule) : seules
  les informations de la liste (ville, département, prix, dates du jour, distance) sont envoyées.
- Pas de lecture de « Mes réservations » DriiveMe (missions acceptées).
- Pas de purge « plus_vue » (une lecture par lots ne voit jamais la France entière d'un coup : on
  ne peut pas conclure qu'une mission a disparu). Les missions ne sont donc qu'ajoutées / mises à
  jour pour l'instant, jamais retirées automatiquement par ce robot.

## Configuration cible à approuver
- Projet GCP : `convoyage-ultra` ; région : `europe-west9` (Paris) — mêmes choix que le relais transports.
- Cloud Run : facturation à la requête, **minimum 0**, **maximum 1** instance (un seul compte à
  synchroniser ; plus d'instances ferait tourner deux navigateurs en parallèle sur le même curseur).
- Variables d'environnement : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret Cloud Run),
  `DRIIVEME_SYNC_SECRET` (secret partagé avec Cloud Scheduler), `DRIIVEME_USER_ID`, `DRIIVEME_LOT` (optionnel).
- Déclenchement par Cloud Scheduler (POST `/sync`, en-tête `X-Sync-Secret`), toutes les 5 minutes —
  comme `hiflow-sync` mais à un rythme plus fréquent du fait de la rotation par lots.
- Endpoint de santé `/health` (process uniquement, pas la disponibilité de DriiveMe).
- Aucun changement des bases Supabase hors la table `plateforme_curseurs` déjà créée.

## Vérifications obligatoires avant mise en service
1. Laurent doit d'abord enregistrer son e-mail et mot de passe DriiveMe dans **Réglages → Mes
   plateformes → Lecture automatique DriiveMe** (coche DriiveMe, puis remplit le bloc) : sans
   identifiant dans `plateforme_identifiants`, le service échoue proprement (erreur explicite) et
   n'écrit rien sur `sources_etat` d'autre qu'un échec.
2. Valider le projet, la facturation, les crédits restants, les quotas, le coût prévisionnel Cloud
   Run + Artifact Registry + Cloud Build + Cloud Scheduler + trafic sortant. Min=0 ne garantit pas
   un coût nul ; un appel toutes les 5 minutes, 24h/24, est plus fréquent que Hiflow (10 min).
3. Construire et démarrer localement le conteneur ; tester `/health` et un appel `/sync` manuel
   (avec un compte DriiveMe réel) pour confirmer que la connexion, la recherche de ville et la
   pagination fonctionnent sur le vrai site (sélecteurs CSS susceptibles de changer).
4. Vérifier que les pauses (6 s entre départements, 2,5 s entre pages) restent suffisantes pour ne
   pas déclencher les protections Cloudflare de DriiveMe (403/429) : ce service s'arrête et retente
   plus tard en cas de blocage, mais un rythme trop agressif pourrait quand même faire suspendre le
   compte — à surveiller particulièrement les premiers jours.
5. Faire approuver l'URL de déploiement, les paramètres de coût, le nombre maximal d'instances et
   la fréquence Cloud Scheduler.
6. Après autorisation explicite seulement : déployer, configurer le secret et le planificateur,
   puis surveiller les premiers cycles (logs Cloud Run + `sources_etat` + pastille de l'application).
7. Garder un retour arrière simple (suppression du planificateur et du service si nécessaire ; la
   lecture manuelle depuis le téléphone, déjà en place, continue de fonctionner sans ce robot).

Ce document est une préparation technique : **aucune commande de déploiement ni ressource
facturable n'est créée.**
