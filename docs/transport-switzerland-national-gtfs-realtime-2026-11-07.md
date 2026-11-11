# Suisse — couverture horaires et temps réel, contrôle du 7 novembre 2026

## Sources officielles

La plateforme Open Data Mobilité Suisse publie le GTFS statique national pour l'année horaire 2026 et 2027 :

- GTFS 2026 : https://data.opentransportdata.swiss/de/dataset/timetable-2026-gtfs2020
- GTFS 2027 : https://data.opentransportdata.swiss/dataset/timetable-2027-gtfs2020
- documentation : https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/

Le GTFS statique 2026 couvre l'année du 14 décembre 2025 au 12 décembre 2026. Il ne doit donc pas être utilisé après cette date sans bascule vers le jeu 2027.

Le flux officiel GTFS-RT apporte les retards et modifications, mais son accès exige une clé API, un User-Agent, les redirections HTTP et se limite à deux requêtes par minute par clé :

- documentation : https://opentransportdata.swiss/en/cookbook/realtime-prediction-cookbook/gtfs-rt/
- endpoint : https://api.opentransportdata.swiss/la/gtfs-rt

Les identifiants de trajet peuvent changer à chaque version statique ; un temps réel ne peut être associé qu'au GTFS dont la version correspond.

## État Convoyage Ultra

Le module suisse actuel consulte `transport.opendata.ch`, qui déclare exploiter les GTFS suisses et basculer vers le jeu qui correspond au temps réel. Il fournit des propositions horaires vers Lausanne, mais ne fournit aucun prix et ses résultats ne sont pas marqués « confirmés ».

Aucune clé officielle n’est enregistrée ou activée et aucune requête payante n’est créée. Il serait dangereux de remplacer ce chemin par GTFS-RT officiel sans gestion de clé, limite de débit, version de flux et cache.

## Décision

- **Source nationale suisse découverte et qualifiée** : GTFS actuel et prochain millésime ; flux temps réel et alertes disponibles avec clé.
- **Non raccordé directement** : blocage d’accès par clé et limitation, aucun coût ni contact engagé.
- **Prix** : le flux horaire ne prouve aucun tarif. Un devis CFF/Léman Pass ou du transporteur, frais et daté, est nécessaire pour chaque trajet où le prix compte.
- **Pas de modification de service** : auth, Supabase, synchronisation des missions, déploiement et fusion restent inchangés.
