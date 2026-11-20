# Carte quotidienne des transports
1. `python3 -I tools/carte-transports/scan.py /tmp/scan.json` (depuis la racine du dépôt) lit data/gtfs/*.zip et calcule position, arrêts et fin de calendrier de chaque réseau.
2. Remplacer dans `gabarit.html` : `__DATA__` (contenu de scan.json, sans les champs err), `__ERR__` (liste de textes d'alertes), `__WF__` (liste [nom, dernier passage, "OK"/"ÉCHEC"]) et `__DATE__`.
3. Publier le résultat en .html sur l'artefact https://claude.ai/artifact/4CxVof3REi14ps6EazjoV8 (action publish avec url).
