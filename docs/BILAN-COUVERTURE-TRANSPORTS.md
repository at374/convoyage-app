# Bilan chiffré de couverture — transports AURA–Suisse

Généré le 2026-11-14 par `scripts/bilan-couverture-transports.cjs` à partir de `transport-coverage.js`.
Diagnostic réel serveur du 2026-11-14T10:10:19.456Z (départs 2026-11-16T08:00:00+01:00, TripGo : non) intégré : « Validé en réel » = trajets réels obtenus par le serveur ; la validation sur téléphone reste à faire.

## Synthèse par zone (dénominateur = réseaux identifiés dans la zone)

| Zone | Périmètre de l’inventaire | Identifiés | Raccordés | Validés en réel | Prix vérifiés | Prix partiels | Restant à terminer |
|---|---|---|---|---|---|---|---|
| AURA | réseaux des zones de mission (Savoies, Isère, Ain, Lyon) | 17 | 17 (100 %) | 15 (88 %) | 5 (29 %) | 3 | 13 |
| Suisse | Genève et frontière seulement | 2 | 2 (100 %) | 2 (100 %) | 0 (0 %) | 0 | 2 |
| Transfrontalier | Grand Genève | 3 | 2 (67 %) | 2 (67 %) | 0 (0 %) | 0 | 3 |
| TAD | services repérés seulement | 3 | 0 (0 %) | 0 (0 %) | 0 (0 %) | 2 | 3 |
| **Total** | — | 25 | 21 (84 %) | 19 (76 %) | 5 (20 %) | — | **21** |

« Raccordé » = une source officielle est branchée (pas une validation). La présence possible d’un opérateur dans TripGo n’est **jamais** comptée comme raccordement.

## États

- Testé sur données enregistrées : 2 réseau(x)
- Validé en réel : 19 réseau(x)
- Non raccordé : 4 réseau(x)

## Détail réseau par réseau

| Réseau | Zone | Couverture | Horaires | Tarifs | Marche | Dernier contrôle | Blocage | Prochaine action |
|---|---|---|---|---|---|---|---|---|
| Sibra (Grand Annecy) | AURA | Testé sur données enregistrées | enregistrés | vérifiés | calculée (données enregistrées) | 2026-11-13 · CGV Sibra 01/07/2026 | Aucun bloquant connu | Lancer le diagnostic téléphone (axe Rumilly → Annecy) |
| TAC / Genevois français Mobilités (Annemasse, Saint-Julien, Archamps) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Tram 17 (exploité par tpg, données suisses) non chiffré par cette grille ; 2,00 € à bord de la T1 | Diagnostic téléphone (Annemasse → Saint-Julien) |
| Synchro Bus (Chambéry) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Montagne/combinés ski non chiffrés ; à revérifier si une grille « juillet 2026 » est publiée | Surveiller une nouvelle délibération tarifaire 2026 |
| Ondéa Grand Lac (Aix-les-Bains) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Était évincé par Cars Région Savoie sur Chambéry → Aix (un seul partenaire retenu) ; corrigé le 13/11/2026 (Synchro + Ondéa, convention d’extension de la ligne A du 7/07/2025) | Diagnostic téléphone (Chambéry → Aix) pour confirmer en réel |
| Star't (Thonon) | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune ; était évincé sur Thonon → Genève par Cars Région Ain puis par TAC Annemasse (enveloppes larges) — corrigé le 13/11/2026 (le moteur préfère désormais le réseau qui couvre le départ) | Confirmer la grille 2026 ; associer chaque arrêt à sa commune ; diagnostic Thonon → Genève |
| M réso — Métropole grenobloise | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Aucun bloquant connu | Diagnostic téléphone (Grenoble → Crolles) |
| M réso — Grésivaudan | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché | Ajouter la liste des communes du Grésivaudan |
| M réso — Voironnais | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché ; attente Voiron → Grenoble retirée le 13/11/2026 (ligne réellement exploitée par Cars Région Isère T40/T41, pas le réseau urbain Voironnais) | Liste des communes du Voironnais pour le tarif intra |
| TCL (Lyon) | AURA | Validé en réel | réels | confirmés (GTFS Fares V1 officiel, 2,10 € zones 1+2) | non calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Zone couverte volontairement réduite (Part-Dieu/Bellecour/Perrache) ; F1/F2/7601 ambigus sans prix (comportement voulu) | Diagnostic téléphone (Ambérieu → Lyon Part-Dieu) pour confirmer que la bbox est exercée par une mission réelle |
| J'y bus (Rumilly) | AURA | Validé en réel | réels | confirmés (1,00 €, règlement officiel jybus.fr) | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Aucun pour le ticket unité | Lancer la tâche « Build regional GTFS », puis diagnostic Rumilly |
| TAM (Ambérieu-en-Bugey) | AURA | Validé en réel | réels | confirmés (1,10 €, fiche tarifaire TAM 2026) | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Aucun pour le titre 1 voyage | Lancer la tâche « Build regional GTFS », puis diagnostic Ambérieu → Lyon |
| Cars Région Haute-Savoie (dont Y51) | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Seule la Y51 a une grille par zones ; autres lignes sans prix | Grilles zonales des autres lignes Cars Région 74 |
| Cars Région Ain | AURA | Validé en réel | réels | manquants | non calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Tarif par zones non intégré | Grille zonale Cars Région Ain |
| Cars Région Isère | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts | Lancer la tâche serveur ; zones par arrêt si fare_rules absent |
| Cars Région Savoie | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Seulement 8 lignes dans l’agrégat ; aucun tarif publié | Vérifier si d’autres lignes Savoie sont publiées sous un autre nom d’agence (oura-agencies.json) |
| TER Auvergne-Rhône-Alpes / SNCF | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | SNCF ne publie plus de grille TER en open data : jeu « Tarifs TER AURA » archivé (prix au 01/03/2025), absent du catalogue actuel (seuls Intercités 2026 et TGV/OUIGO en fourchettes) | Décision : afficher le prix 2025 comme simple indication, ou clé TripGo, ou garder « Prix à confirmer » |
| FlixBus / BlaBlaCar Bus | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-10-31 · réponse TripGo enregistrée | Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées | Clé TripGo puis diagnostic (Annecy → Genève) |
| CFF / trains suisses | Suisse | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | API sans prix (transport.opendata.ch ne publie aucun tarif) ; aucun autre blocage identifié | Aucune action moteur : chercher si une grille tarifaire SBB/CFF officielle existe ailleurs (hors API) |
| TPG (Genève, zone 10) | Suisse | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Billet Tout Genève 60 min : prix non affiché sur la page lue (seul le complément zone 10 CHF 3.00 l’est) ; unireso.com illisible au serveur | Grille unireso 2026 (PDF) |
| Léman Express | Transfrontalier | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Ticket Léman Pass 210+10 : 4,80 € ou 4,90 € selon la source officielle → non appliqué ; trajets plus longs : tarif « Parcours + zone 10 » non publié par gare | Grille Léman Pass par gare (lemanpass.com) |
| TPG lignes transfrontalières | Transfrontalier | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T10:10:19.456Z · diagnostic téléphone | Tarif Léman Pass non intégré | Grille Léman Pass 2026 |
| Léman Pass (tarif) | Transfrontalier | Non raccordé | indisponibles | manquants | non vérifiée | 2026-11-13 · guide TAC (14/12/2025), Jacquet (14/12/2025), tpg/Alpbus (→ 12/12/2026), page tpg | Sources officielles contradictoires pour le ticket 210+10 : 4,90 € (TAC) contre 4,80 € (Jacquet) → aucun prix ; 10+230 : 4,80 € (tpg/Alpbus) ; compléments zone 10 3,20 € / zone 210 1,70 € (non applicables sans connaître l’abonnement) | Grille lemanpass.com en vigueur (bloquée au serveur) pour trancher 4,80 / 4,90 € |
| Flexi (Synchro, Chambéry) | TAD | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-13 · communiqué Grand Chambéry 15/05/2025 | Transport à la demande : réservation obligatoire, pas d’horaires publiés | Information + lien de réservation affichés dans la fiche (13/11) ; rien d’autre possible sans réservation |
| Mobéa (Ondéa, Grand Lac) | TAD | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-13 | Transport à la demande : réservation obligatoire | Information + lien affichés dans la fiche (13/11) |
| TPG Flex | TAD | Non raccordé | indisponibles | manquants | non vérifiée | 2026-11-13 | Transport à la demande : réservation obligatoire | Afficher le lien de réservation |

## Tarifs manquants ou partiels, réseau par réseau

- **Star't (Thonon)** (manquants) : Prix à confirmer (tarif par zones A/B) ; GTFS Fares si publiés — Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune ; était évincé sur Thonon → Genève par Cars Région Ain puis par TAC Annemasse (enveloppes larges) — corrigé le 13/11/2026 (le moteur préfère désormais le réseau qui couvre le départ)
- **M réso — Grésivaudan** (partiels) : Grille officielle 2,00 € (1,00 € intra-Grésivaudan non appliqué) — Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché
- **M réso — Voironnais** (partiels) : Grille officielle 2,00 € (1,30 € intra-Voironnais non appliqué) — Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché ; attente Voiron → Grenoble retirée le 13/11/2026 (ligne réellement exploitée par Cars Région Isère T40/T41, pas le réseau urbain Voironnais)
- **TCL (Lyon)** (confirmés (GTFS Fares V1 officiel, 2,10 € zones 1+2)) : Grille officielle 2,10 € confirmée (73/76 lignes ; 3 lignes ambiguës — F1/F2/7601 — sans prix par prudence) — Zone couverte volontairement réduite (Part-Dieu/Bellecour/Perrache) ; F1/F2/7601 ambigus sans prix (comportement voulu)
- **J'y bus (Rumilly)** (confirmés (1,00 €, règlement officiel jybus.fr)) : Grille officielle 1,00 € (règlement jybus.fr, ticket unité 1 h) — Aucun pour le ticket unité
- **TAM (Ambérieu-en-Bugey)** (confirmés (1,10 €, fiche tarifaire TAM 2026)) : Grille officielle 1,10 € (fiche TAM 2026, philibert-transport.fr) — Aucun pour le titre 1 voyage
- **Cars Région Haute-Savoie (dont Y51)** (partiels) : Y51 : grille officielle par zones ; autres lignes à confirmer — Seule la Y51 a une grille par zones ; autres lignes sans prix
- **Cars Région Ain** (manquants) : Prix à confirmer (zones) — Tarif par zones non intégré
- **Cars Région Isère** (manquants) : Zonal confirmé (4,10 € à 12,10 €, zones par arrêt toujours indisponibles) — Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts
- **Cars Région Savoie** (manquants) : Par ligne (3 € à 12,50 €), pas de tarif réseau unique — Seulement 8 lignes dans l’agrégat ; aucun tarif publié
- **TER Auvergne-Rhône-Alpes / SNCF** (manquants) : Prix dynamique : pas de source autorisée gratuite — SNCF ne publie plus de grille TER en open data : jeu « Tarifs TER AURA » archivé (prix au 01/03/2025), absent du catalogue actuel (seuls Intercités 2026 et TGV/OUIGO en fourchettes)
- **FlixBus / BlaBlaCar Bus** (manquants) : Prix dynamique : à confirmer (billet TripGo repris s’il est transmis) — Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées
- **CFF / trains suisses** (manquants) : Prix à confirmer (pas de prix dans l’API) — API sans prix (transport.opendata.ch ne publie aucun tarif) ; aucun autre blocage identifié
- **TPG (Genève, zone 10)** (manquants) : 3,00 CHF confirmé (zone 10 uniquement) ; non appliqué, zone par arrêt indisponible — Billet Tout Genève 60 min : prix non affiché sur la page lue (seul le complément zone 10 CHF 3.00 l’est) ; unireso.com illisible au serveur
- **Léman Express** (manquants) : Léman Pass : prix à confirmer — Ticket Léman Pass 210+10 : 4,80 € ou 4,90 € selon la source officielle → non appliqué ; trajets plus longs : tarif « Parcours + zone 10 » non publié par gare
- **TPG lignes transfrontalières** (manquants) : Léman Pass : prix à confirmer — Tarif Léman Pass non intégré
- **Léman Pass (tarif)** (manquants) : Aucune grille officielle 2026 intégrée — Sources officielles contradictoires pour le ticket 210+10 : 4,90 € (TAC) contre 4,80 € (Jacquet) → aucun prix ; 10+230 : 4,80 € (tpg/Alpbus) ; compléments zone 10 3,20 € / zone 210 1,70 € (non applicables sans connaître l’abonnement)
- **Flexi (Synchro, Chambéry)** (partiels) : Même tarif que le bus Synchro — Transport à la demande : réservation obligatoire, pas d’horaires publiés
- **Mobéa (Ondéa, Grand Lac)** (partiels) : Tarif Ondéa — Transport à la demande : réservation obligatoire
- **TPG Flex** (manquants) : Prix à confirmer — Transport à la demande : réservation obligatoire

## Diagnostic réel serveur, par axe

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | Sources | Erreurs |
|---|---|---|---|---|---|---|
| Annecy → Genève | 30 | 0 | 22 | 14 | Suisse (transport.opendata.ch), SNCF (GTFS officiel), Cars Région Haute-Savoie (GTFS) | GTFS Sibra : terminated |
| Annemasse → Saint-Julien-en-Genevois | 65 | 54 | 28 | 12 | Suisse (transport.opendata.ch), SNCF (GTFS officiel), TAC Annemasse (GTFS) | — |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 10 | 0 | 8 | 3 | SNCF (GTFS officiel) | — |
| Chambéry → Aix-les-Bains | 49 | 4 | 16 | 7 | Synchro Bus Chambéry (GTFS), Synchro Chambéry (GTFS), SNCF (GTFS officiel), Ondéa Aix-les-Bains (GTFS) | — |
| Grenoble → Crolles | 12 | 5 | 12 | 12 | Mobilités M, SNCF (GTFS officiel) | — |
| Rumilly → Annecy | 7 | 0 | 7 | 6 | SNCF (GTFS officiel) | GTFS Sibra : terminated |
| Thonon-les-Bains → Genève | 17 | 0 | 15 | 8 | SNCF (GTFS officiel), Suisse (transport.opendata.ch) | — |
| Voiron → Grenoble | 18 | 0 | 18 | 10 | SNCF (GTFS officiel), Mobilités M, Cars Région Isère (GTFS) | — |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 50 | 40 | 16 | 5 | Ondéa Aix-les-Bains (GTFS), SNCF (GTFS officiel) | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 55 | 7 | 32 | 10 | Star't Thonon (GTFS), SNCF (GTFS officiel), Suisse (transport.opendata.ch) | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 58 | 58 | 28 | 0 | J’y bus Rumilly (GTFS), J'y bus Rumilly (GTFS) | GTFS Sibra : terminated |
| Ambérieu gare → Cabrol (TAM 2) | 93 | 83 | 32 | 7 | TAM Ambérieu (GTFS), SNCF (GTFS officiel), TAM Ambérieu-en-Bugey (GTFS), Cars Région Ain (GTFS) | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 12 | 0 | 10 | 6 | SNCF (GTFS officiel), Cars Région Savoie (GTFS) | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 12 | 1 | 0 | 0 | Cars Région Ain (GTFS), SNCF (GTFS officiel) | — |
| Lyon Part-Dieu → Bellecour (TCL) | 70 | 0 | 0 | 0 | TCL Lyon (GTFS), TCL (GTFS), SNCF (GTFS officiel) | — |
| Voiron → Voreppe (M réso Voironnais) | 18 | 2 | 3 | 3 | Mobilités M, SNCF (GTFS officiel), Cars Région Isère (GTFS) | — |

## Axes du diagnostic téléphone

Dans l’application : Réglages → « Couverture et diagnostic des transports » → « Lancer le diagnostic réel », puis « Copier le rapport ».

- Annecy → Genève — réseaux attendus : ter, lex, cff, longue
- Annemasse → Saint-Julien-en-Genevois — réseaux attendus : tac, lex, tpg-fr
- Ambérieu-en-Bugey → Lyon Part-Dieu — réseaux attendus : ter
- Chambéry → Aix-les-Bains — réseaux attendus : ter, synchro, ondea
- Grenoble → Crolles — réseaux attendus : mreso-metro, mreso-gresivaudan
- Rumilly → Annecy — réseaux attendus : ter, sibra
- Thonon-les-Bains → Genève — réseaux attendus : lex, tpg-fr
- Voiron → Grenoble — réseaux attendus : cars-38, ter
