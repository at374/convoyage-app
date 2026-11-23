# Collecteur national GTFS — Convoyage Ultra

## Objet et périmètre
Le collecteur `scripts/collect-national-gtfs.cjs` réutilise `transport-catalogue.js`, `transport-gtfs-loader.js` et `transport-gtfs-index.js`. Il découvre les ressources GTFS publiées dans le catalogue PAN, télécharge et vérifie les ZIP, puis produit un manifeste JSON/CSV. Le flux GTFS est un horaire théorique : il ne garantit ni disponibilité réelle, ni billet achetable, ni tarif à jour.

## Démarrage prudent
Sur la branche `feature/transports-aura-suisse`, utiliser **Actions → Collecte GTFS nationale (PAN) → Run workflow**, puis saisir `limit=5`. Le workflow lance d'abord `node --test tests/**/*.test.cjs`. Un essai limité produit `docs/gtfs-national-sample/` sur le runner, sans committer le manifeste national. Les ZIP validés sont envoyés dans la Release `gtfs-national` ; aucun ZIP national n'est ajouté à Git.

**Ne pas lancer `limit=0` tant qu'un premier essai réel, les tests, le stockage et les quotas ne sont pas vérifiés.** La planification `schedule` GitHub ne se déclenche que si le workflow existe sur la branche par défaut ; elle ne constitue donc pas à elle seule une automatisation active sur la branche de travail.

## Intégrité et réexécution
Avant de réutiliser une entrée `unchanged`, le workflow énumère les noms des archives réellement présentes dans la Release. Si une archive manque, elle est retéléchargée puis validée. La comparaison de dates `updatedAt` ne vaut pas vérification du contenu distant ; le SHA-256 est calculé pour les fichiers effectivement téléchargés. Un fichier conservé sans nouveau téléchargement garde son SHA antérieur, mais son intégrité n'est pas recontrôlée par lecture de l'archive hébergée.

## Classification : précautions indispensables
Les catégories `regular`, `school`, `demandResponsive`, `unknown` sont **heuristiques**. Les mentions scolaires et certains indicateurs TAD sont reconnus, mais l'absence de ces mentions ne prouve pas une ligne régulière. Par sécurité, les autres lignes restent `unknown`. Le compteur de lignes `regular` peut donc rester nul même lorsque le réseau transporte des voyageurs. Ne pas supprimer automatiquement les lignes `unknown` sans vérification complémentaire.

Les flux multi-opérateurs ou régionaux sont signalés comme suspects d'agrégation, sans découpage garanti par opérateur. Les GTFS ne constituent pas une source fiable des tarifs SNCF, BlaBlaCar ou FlixBus en temps réel.

## Critères avant élargissement national
1. Suite complète des tests verte sur GitHub Actions.
2. Essai `limit=5` terminé et journaux examinés, avec ZIP vérifiés dans la Release.
3. Vérification des quotas et des contraintes de stockage GitHub ; aucun service payant sans accord.
4. Vérification que les archives déjà publiées ne sont pas perdues lors d'une relance.
5. Vérification de la fraîcheur réelle des services à 30 jours et du contenu `agency.txt` avant de déclarer un réseau exploitable.

## Limites connues
- La collecte est une **acquisition et validation structurelle**, pas une certification complète de chaque trajet, tarif ou service.
- La classification scolaire/TAD n'est pas garantie à 100 %.
- Les archives ZIP64 et certains flux GTFS de très grande taille peuvent être rejetés par les limites actuelles du chargeur.
- La disponibilité d'une archive dans la Release est contrôlée par son nom ; son contenu n'est pas retéléchargé pour vérifier son SHA à chaque exécution.
- La planification et la collecte nationale complète ne sont pas encore validées en production.

## GTFS-Flex et dédoublonnage (audit local du 23 novembre 2026)

L'audit local de 22 archives ZIP a identifié **20 empreintes SHA-256 distinctes** :
18 archives distinctes avec trajets réguliers actifs sur la fenêtre étudiée,
et deux archives GTFS-Flex de transport à la demande (AXO TAD et Le Bus TAD).
Deux copies locales (Hobus et Ficibus) possèdent exactement la même empreinte
SHA-256 que leur archive d'origine ; elles ne doivent pas compter comme deux réseaux.

Les archives `PT_TAD_OFFER_AXO_gtfs_20261122_1351.zip` et
`PT_TAD_OFFER_LEBUS_gtfs_20261122_1351.zip` contiennent
`booking_rules.txt`, `location_groups.txt` et
`location_group_stops.txt`. Leur `stop_times.txt` utilise des colonnes
`start_pickup_drop_off_window` / `end_pickup_drop_off_window` et
`location_group_id` à la place d'horaires fixes par `stop_id`.

**Ne pas classer ces flux comme invalides** sous prétexte que le détecteur
de courses régulières ne trouve pas deux arrêts à heures fixes.
Ils nécessitent un traitement GTFS-Flex spécifique : plages de réservation,
zones et règles de prise en charge, et confirmation par l'opérateur.
**Ne pas convertir les fenêtres de réservation en heures de départ garanties.**

Les archives locales ne prouvent ni la disponibilité actuelle d'une URL
de téléchargement ni la disponibilité commerciale d'un billet. Aucun tarif
de transport n'a été vérifié dans cet audit. La rentabilité d'une mission
reste masquée jusqu'à obtention du prix total réellement confirmé.
