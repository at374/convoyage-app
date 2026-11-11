# Accélération AURA + Genève + frontière suisse — plan parallèle (10/11/2026)

## Objectif de pilotage
Réduire les délais en traitant simultanément les lots indépendants, sans attendre qu'un réseau soit « parfait » pour commencer le suivant. Ce plan ne prétend pas que les tâches sont déjà exécutées. Il ne change ni les missions, ni l'authentification, ni Supabase, ni le déploiement.

## Règle de sortie commune
Un trajet est « confirmé » uniquement si l'opérateur, la ligne, le sens, les arrêts, les horaires à la date demandée et l'approche piétonne sont vérifiés. Un prix est « confirmé » uniquement si le tarif officiel couvre le trajet, le produit, la date et le profil concernés. Sinon afficher « prix inconnu/non confirmé » et/ou « transport non confirmé ». Ne jamais déduire un prix du GTFS.

## Lots à mener en parallèle

| Lot | Sources/données déjà repérées | Action immédiate | Sortie attendue |
|---|---|---|---|
| A — Ain / Cars Région | GTFS Ain (31 lignes, 483 courses théoriques le 9 et 16/11/2026), X37/X38 matrice tarifaire contrôlée | Rapprocher chaque identifiant d'arrêt GTFS aux 20 libellés tarifaires ; traiter X36 séparément ; lier la date de service | matrice arrêt↔tarif par sens, tarifs et courses confirmées |
| B — Haute-Savoie | PDF Cars Région, Y13/Y03/Y04/Y81–Y94 ; Y62/Y63 Aravis ; X36 | Extraire les fiches par ligne en parallèle, commencer par lignes sans matrice vérifiée ; vérifier calendriers et arrêts GPS | tableau ligne / exploitant / GTFS / horaires / tarifs / écarts |
| C — Proxim iTi / Faucigny | pages horaires opérateur, Bus CheckIn, lignes 180/380/480 et déviation Marignier Gare du 4/11 au 11/12/2026 | relever les horaires datés et arrêts provisoires ; documenter quelles courses nécessitent réservation ; ne pas dépendre du GTFS PAN inactif | itinéraires date-spécifiques, coordonnées provisoires vérifiées, conditions et prix |
| D — Savoie | Synchro, Cars Région Savoie, Alpbus, Transdev, Faure, Loyet, Doucy Bus, Trans-Alpes | traiter les sources tarifaires et flux GTFS par opérateur, sans transférer un tarif d'une famille à une autre | couverture lignes, courses, barèmes et exceptions |
| E — Isère / Drôme / Ardèche / Loire / Haute-Loire / Puy-de-Dôme / Cantal / Allier | agrégat Oùra + documents officiels déjà repérés dans le dépôt | extraction et rapprochement par département en parallèle ; isoler les lignes sans GTFS actif | inventaire opérateur et manquants par département |
| F — Genève / TPG | sources TPG, lignes transfrontalières 271/272/274 et conditions Leman Pass | vérifier arrêts actifs, déviations, horaires par date, tarifs zone et règles de correspondance | trajets transfrontaliers et prix confirmés, par produit et zone |
| G — Suisse nationale / frontalière | GTFS SKI 2026 et GTFS 2027 (13/12/2026–11/12/2027), calculateur tiers existant | préparer sélection du millésime selon date ; garder prix null tant que tarif officiel/devis absent ; OJP seulement avec clé autorisée | horaires frontaliers selon date, sources, limites et tarifs non supposés |
| H — correspondances / marche | arrêts GTFS et adresses exactes des missions | vérifier géométrie piétonne réelle et temps de marche ; aucune distance à vol d'oiseau comme itinéraire | segments piétons, marge et faisabilité datée |

## Ordre d'exécution accéléré
1. Lancer les lots A, B, C, D, F et G en parallèle pour collecter les sources et identifier les manquants ; E suit par département, sans attendre la fin de la Haute-Savoie.
2. Réutiliser l'agrégat Oùra pour découvrir les lignes, mais conserver les flux individuels et sources opérateur comme autorité pour la qualité et les tarifs.
3. Fusionner les résultats dans une seule matrice de suivi, avec statut séparé : source trouvée / données téléchargées / horaires datés vérifiés / arrêts GPS vérifiés / trajet calculable / prix officiel vérifié / raccordé / testé Android.
4. Traiter les blocages à part (pas de GTFS actif, réservation téléphonique, arrêt provisoire, produit tarifaire conditionnel, API à clé) au lieu de bloquer tous les réseaux.
5. Exécuter tests unitaires, tests de non-régression et validation Android sur chaque lot indépendant. Intégration uniquement dans les modules autorisés ; aucun changement de synchronisation des missions, auth, Supabase ou déploiement.

## Critères de fin AURA + Genève + Suisse frontalière
- Chaque réseau connu est recensé avec source et exploitant, y compris les réseaux sans flux exploitable.
- Chaque ligne est classée : horaires vérifiés / horaires indisponibles / saisonnière / réservation obligatoire / hors service.
- Les tarifs sont associés à la ligne, au trajet, au sens, au produit et à la période ; les inconnus restent explicitement inconnus.
- Les trajets piétons et correspondances sont vérifiés, avec adresse exacte et marge.
- Tous les cas prioritaires Annecy, Rumilly, Ambérieu, Chambéry, Annemasse, Genève, Archamps, Saint-Julien-en-Genevois et liaisons frontalières sont testés.
- Le total de couverture est calculé avec dénominateurs distincts (réseaux, lignes, courses, arrêts, prix), jamais à partir du seul nombre de réseaux du catalogue.

## État initial honnête
- Le dépôt contient déjà des références tarifaires et des audits sur Ain, Haute-Savoie, TPG, Leman Pass, Aravis, Proxim iTi, X36, X37/X38 et GTFS suisse.
- Le GTFS suisse 2027 a été repéré ; la validité du GTFS 2026 s'arrête au 12/12/2026.
- L'agrégat Oùra et le script d'inventaire sont en cours d'audit ; l'archive agrégée n'est pas encore traitée ici.
- Les sept contrôles CI réussis sur le commit 7ba5f821 ne valident pas les commits plus récents.
- Aucun taux global de complétude fiable ne peut être annoncé sans extraction et rapprochement des inventaires.
