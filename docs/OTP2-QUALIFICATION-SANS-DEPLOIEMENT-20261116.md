# OTP2 AURA–Suisse — protocole de qualification sans déploiement (16 novembre 2026)

## État vérifié
- Branche : `feature/transports-aura-suisse`.
- `transport-otp-adapter.js` reconnaît **déjà** `plan.itineraries` et `planConnection.edges[].node`, avec `startTime/endTime` et `departure.scheduledTime/arrival.scheduledTime`.
- `tests/transport-otp-adapter.test.cjs` contient des tests pour les deux formes. **Présence des tests ≠ résultat CI vérifié dans cette note**.
- `transport-otp-client.js` exige activation explicite, endpoint HTTPS, requête GraphQL et fonction fetch injectée ; pas de serveur OTP2 configuré par défaut.

## Constat Google Cloud issu des captures utilisateur
- Projet `convoyage-ultra`, service existant `convoyage-transports-pilote`, région `europe-west9`.
- Service existant : 512 Mio, 1 vCPU, min 0, max 2, facturation à la requête, délai 60 s, concurrence 1.
- Budget avec plafond Cloud Run créé : `Convoyage Ultra - Protection OTP2`, **5 €/mois**, alertes 50/80/100 %. Le plafond **s'applique au projet/service Cloud Run**, pas uniquement à un futur OTP2 ; le service pilote peut être suspendu. Dépassement possible car coupure non instantanée. Les coûts d'autres services ne sont pas plafonnés.
- Capture de facturation : crédits d'essai 258,64 € et 59 jours restants au 16 novembre 2026. Le coût affiché du projet sur le rapport filtré était 0,00 € ; ne pas déduire que les ressources futures seront gratuites.
- Aucune autorisation de déploiement ou de dépense nouvelle.

## Étape A : inventaire des données avant construction
Créer un manifeste pour **chaque** archive GTFS et extrait OSM : URL officielle, organisme, licence, date de récupération, taille, SHA256, date de validité `calendar.txt`/`calendar_dates.txt`, nombre d'arrêts et fuseau horaire. Ne pas inventer d'URL ni d'accès. Contrôler que les données couvrent les correspondances frontalières, sans prétendre que le réseau complet est couvert par un seul flux.

## Étape B : construction locale reproductible
- Choisir une version **précise** d'OTP2 après vérification de sa documentation et de la disponibilité de son image officielle.
- Préparer le graphe hors Cloud Run, en mesurant RAM maximale, durée et taille de `graph.obj`. Vérifier la compatibilité OSM/GTFS avec cette version.
- Ne pas publier une image ou un graphe contenant des données dont la licence interdit la redistribution.
- **Ne pas** créer Cloud Build, Cloud Storage, Artifact Registry ou Cloud Run Jobs sans autorisation : ces services peuvent générer des coûts hors plafond Cloud Run.

## Étape C : validation de l'API
- Interroger le schéma GraphQL réel et conserver une fixture JSON anonymisée pour chaque variante utilisée.
- Vérifier la correspondance des champs, la gestion des horaires et fuseaux, des modes et des géométries.
- Exécuter `node --test tests/transport-otp-adapter.test.cjs tests/transport-otp-client.test.cjs tests/transport-otp-hub.test.cjs`.
- Tester les axes Annecy–Genève, Annemasse–Genève, Ambérieu–Lyon, Chambéry–Saint-Julien-en-Genevois et Archamps–Genève sur plusieurs dates.
- Les horaires GTFS ne prouvent pas la disponibilité temps réel ; OTP2 ne fournit pas les prix commerciaux dynamiques SNCF/BlaBlaCar/FlixBus.

## Étape D : décision d'hébergement
- Mesurer mémoire de service, temps de chargement du graphe et temps de réponse.
- Évaluer l'effet des démarrages à froid avec min 0 et du timeout de démarrage ; comparer avec les contraintes Cloud Run.
- Établir un devis **par service** (Cloud Run, stockage, build, registre, transfert), avec estimation du pire cas et risque de suspension du service pilote à 5 €.
- Préférer une isolation de facturation/projet ou une stratégie de test qui n'expose pas le pilote à l'interruption ; **ne rien changer sans accord utilisateur**.
- Ne créer `convoyage-otp2` qu'après approbation explicite d'une configuration et d'un budget.

## Transmission à Claude
Le correctif `planConnection` est **déjà présent** sur la branche ; éviter de le réappliquer. Priorité : inventaire de sources officielles et fixtures GraphQL de la version OTP2 réelle. Rapporter les mesures avant de proposer un déploiement.
