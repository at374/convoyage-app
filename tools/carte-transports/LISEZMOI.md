# Carte quotidienne des transports
1. `python3 -I tools/carte-transports/scan.py /tmp/scan.json` (depuis la racine du dépôt) lit data/gtfs/*.zip et calcule position, arrêts et fin de calendrier de chaque réseau.
2. Remplacer dans `gabarit.html` : `__DATA__` (contenu de scan.json, sans les champs err), `__ERR__` (liste de textes d'alertes), `__WF__` (liste [nom, dernier passage, "OK"/"ÉCHEC"]) et `__DATE__` (date ET heure de Paris, ex. « 20/11/2026 à 19:05 »).
3. Publier le résultat en .html sur l'artefact https://claude.ai/artifact/4CxVof3REi14ps6EazjoV8 (action publish avec url).

## Règle (demandée par Laurent le 20/11/2026)
La carte doit être republiée À CHAQUE CHANGEMENT du module Transports (moteurs, makeProviders, scripts GTFS, workflows de données, tri/affichage des trajets), pas seulement chaque jour. Après un tel commit : relancer scan.py, remplir le gabarit et republier sur le même artefact. scan.py marque chaque réseau « moteur » (branché ou non à transport-mission-hub.js).
