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
