# Mise en route du calculateur régional (Agenda)

Le module régional dans l'Agenda nécessite **un serveur OpenTripPlanner (OTP) 2 réellement accessible**. Les scripts et les tests du dépôt ne constituent pas un déploiement.

## Entrées nécessaires

1. Un JAR exécutable OTP 2 compatible avec Java 21, provenant d'une version identifiée et vérifiée.
2. Un fichier GTFS Oùra validé par le workflow GitHub `Audit regional GTFS Oura` (artefact `oura-regional-gtfs-validated`). Vérifier la date de validité des services dans `calendar.txt` et `calendar_dates.txt` avant utilisation.
3. Un extrait OpenStreetMap `.osm.pbf` couvrant **toutes** les lignes et les trajets piétons pertinents, y compris les zones frontalières si les itinéraires doivent y passer.
4. Une machine Linux avec suffisamment de RAM et d'espace disque pour le graphe régional ; Java 21 et `flock`.

## Construction locale (non déployée)

```bash
export OTP_JAR=/chemin/otp.jar
export OURA_GTFS=/chemin/oura-regional.gtfs.zip
export OSM_PBF=/chemin/region.osm.pbf
export OTP_WORKDIR=/srv/convoyage/otp-aura
export OTP_JAVA_OPTS=-Xmx8G
bash scripts/regional-otp/run.sh build
bash scripts/regional-otp/run.sh serve
```

Le script garde l'ancien graphe si la nouvelle construction échoue. Il refuse le remplacement tant qu'un serveur démarré avec ce même script tient le verrou. Un serveur OTP démarré autrement n'est **pas** couvert par ce verrou.

## Validation avant activation de l'Agenda

- Vérifier le démarrage réel d'OTP, son endpoint GraphQL et la **compatibilité exacte du schéma** avec `regional-routing.js`. Le nom `planConnection` et les champs utilisés n'ont pas été validés sur un serveur actif.
- Tester un trajet daté Annecy → Albertville, puis un trajet retour avec correspondances et accès piéton aux arrêts. Comparer horaires et arrêts aux données officielles.
- Vérifier que le certificat HTTPS, CORS, les limites de requêtes, le temps de réponse et la disponibilité du serveur sont adaptés à l'application.
- Renseigner `window.CP_REGIONAL_ROUTING_URL` uniquement après ces vérifications. Ne pas annoncer de transport « confirmé » si l'itinéraire n'a pas été vérifié à la date demandée.
- Garder la synchronisation des missions, les paramètres des plateformes et les styles inchangés.

## Situation

La construction et les tests simulés sont présents dans le dépôt, **mais aucun hébergement ni endpoint public n'est fourni ici**. L'application ne peut donc pas encore afficher des résultats OTP réels via cet adaptateur.
