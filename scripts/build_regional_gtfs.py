#!/usr/bin/env python3
"""Convoyage Ultra — prépare côté serveur de petits flux GTFS officiels servis par l'application.

1. Extrait de l'agrégat régional Oùra (data.gouv) les réseaux absents des flux propres
   (J'y bus Rumilly, TAM Ambérieu, Cars Région Isère, Cars Région Savoie) en GTFS réduits.
2. Recopie les flux propres déjà utilisés (TAC, Synchro, Ondéa, Star't) pour qu'ils soient servis
   depuis le site de l'application (même origine : pas de blocage CORS sur le téléphone).

Aucun horaire ni tarif n'est créé : seules des lignes du GTFS officiel sont recopiées, avec leurs
fare_attributes / fare_rules quand le producteur les publie. Chaque fichier est validé (tables
obligatoires, calendrier, références) et plafonné en taille ; un manifeste daté (SHA-256) est écrit.
Usage : python3 scripts/build_regional_gtfs.py [--aggregate fichier.zip] [--out data/gtfs] [--offline]
"""
import time, argparse, csv, hashlib, io, json, os, re, sys, tempfile, unicodedata, urllib.request, zipfile, datetime

UA = {'User-Agent': 'ConvoyageUltra-GTFS/1.0'}
MAX_OUT = 12 * 1024 * 1024
# Réseaux extraits de l'agrégat : motifs sur agency_name / agency_id (normalisés sans accents, minuscules).
EXTRACT = [
    {'id': 'jybus-rumilly', 'network': "J'y bus Rumilly", 'pattern': r"j.?y ?bus|rumilly", 'bounds': [45.80, 5.85, 45.93, 6.05]},
    {'id': 'tam-amberieu', 'network': 'TAM Ambérieu-en-Bugey', 'pattern': r"\btam\b|amberieu", 'bounds': [45.90, 5.28, 46.02, 5.45]},
    {'id': 'cars-region-isere', 'network': 'Cars Région Isère', 'pattern': r"cars? region.*isere|\bisere\b", 'bounds': [44.69, 4.74, 45.89, 6.36]},
    # 18/11/2026 : Haute-Savoie (Cluses, Taninges, Morzine, Samoëns : lignes Y92/Y93/Y94 à la demande, Y51…), emprise resserrée pour rester sous MAX_OUT.
    {'id': 'cars-region-haute-savoie', 'network': 'Cars Région Haute-Savoie', 'pattern': r"cars? region.*haute.?savoie", 'bounds': [45.90, 6.30, 46.30, 6.85]},
    {'id': 'cars-region-ain', 'network': 'Cars Région Ain', 'pattern': r"cars? region.*\bain\b", 'bounds': [45.75, 4.75, 46.5, 6.15]},
    {'id': 'cars-region-savoie', 'network': 'Cars Région Savoie', 'pattern': r"^(?!.*haute).*(cars? region.*savoie|\bsavoie\b)", 'bounds': [45.05, 5.62, 45.80, 7.19]},
    # 15/11/2026 : tous les autres réseaux de l'agrégat régional Oùra (emprises relevées sur les flux officiels).
    {'id': 'rubis-bourg', 'network': 'Rubis Bourg-en-Bresse', 'pattern': '\\brubis\\b', 'bounds': [46.15, 5.05, 46.52, 5.41]},
    {'id': 'evad-evian', 'network': "ÉVA'D Évian", 'pattern': '\\bevian\\b', 'bounds': [46.24, 6.45, 46.42, 6.86]},
    {'id': 'chamonix-bus', 'network': 'Chamonix Bus', 'pattern': '\\bchamonix\\b', 'bounds': [45.87, 6.74, 46.06, 6.96]},
    {'id': 'proximiti-bonneville', 'network': 'Proxim iTi Bonneville – La Roche', 'pattern': 'proxim ?iti', 'bounds': [45.91, 6.17, 46.23, 6.53]},
    {'id': 'mobivals-valserhone', 'network': "Mobi'Vals Valserhône", 'pattern': "mobi'?vals", 'bounds': [46.08, 5.76, 46.16, 5.87]},
    {'id': 'tra-albertville', 'network': 'TRA Mobilité Albertville', 'pattern': '\\balbertville\\b', 'bounds': [45.55, 6.22, 45.77, 6.59]},
    {'id': 'duobus-oyonnax', 'network': 'Duobus Oyonnax', 'pattern': '\\boyonnax\\b', 'bounds': [46.19, 5.59, 46.34, 5.7]},
    {'id': 'ruban-bourgoin', 'network': 'Ruban Bourgoin-Jallieu', 'pattern': '\\bbourgoin', 'bounds': [45.48, 5.08, 45.71, 5.4]},
    {'id': 'lva-vienne', 'network': "L'va Vienne", 'pattern': '^vienne\\b', 'bounds': [45.39, 4.59, 45.69, 5.49]},
    {'id': 'colibri-miribel', 'network': 'Colibri Miribel', 'pattern': '\\bcolibri\\b', 'bounds': [45.8, 4.89, 45.85, 5.04]},
    {'id': 'tico-montluel', 'network': 'TICO Montluel', 'pattern': '\\bmontluel\\b', 'bounds': [45.81, 5.03, 45.88, 5.15]},
    {'id': 'saonibus-trevoux', 'network': 'Saônibus Trévoux', 'pattern': '\\bsaonibus\\b', 'bounds': [45.86, 4.7, 45.97, 4.85]},
    {'id': 'cars-region-express', 'network': 'Cars Région Express', 'pattern': 'cars region express', 'bounds': [44.35, 2.8, 46.78, 6.15]},
    {'id': 'cars-region-loire', 'network': 'Cars Région Loire', 'pattern': 'cars region loire', 'bounds': [45.23, 3.68, 46.22, 4.88]},
    {'id': 'cars-region-drome', 'network': 'Cars Région Drôme', 'pattern': 'cars region drome', 'bounds': [44.04, 4.63, 45.38, 6.1]},
    {'id': 'cars-region-ardeche', 'network': 'Cars Région Ardèche', 'pattern': 'cars region ardeche', 'bounds': [44.25, 3.85, 45.4, 4.95]},
    {'id': 'cars-region-allier', 'network': 'Cars Région Allier', 'pattern': 'cars region allier', 'bounds': [46.02, 2.18, 46.85, 4.07]},
    {'id': 'cars-region-cantal', 'network': 'Cars Région Cantal', 'pattern': 'cars region cantal', 'bounds': [44.67, 2.18, 45.79, 3.32]},
    {'id': 'cars-region-haute-loire', 'network': 'Cars Région Haute-Loire', 'pattern': 'cars region haute-loire', 'bounds': [44.71, 3.23, 45.56, 4.41]},
    {'id': 'coqueligo-annonay', 'network': 'CoqueliGO Annonay', 'pattern': '\\bannonay\\b', 'bounds': [45.21, 4.62, 45.29, 4.72]},
    {'id': 'toutenbus-aubenas', 'network': "Tout'enbus Aubenas", 'pattern': '\\baubenas\\b', 'bounds': [44.54, 4.3, 44.69, 4.47]},
    {'id': 'transcab-aurillac', 'network': "Trans'Cab Aurillac", 'pattern': '\\baurillac\\b', 'bounds': [44.8, 2.22, 45.09, 2.68]},
    {'id': 'montelibus-montelimar', 'network': 'Montélibus Montélimar', 'pattern': '\\bmontelimar\\b', 'bounds': [44.44, 4.69, 44.73, 5.02]},
    {'id': 'maelis-montlucon', 'network': 'Maelis Montluçon', 'pattern': '\\bmontlucon\\b', 'bounds': [46.15, 2.49, 46.42, 2.74]},
    {'id': 'aleo-moulins', 'network': 'Aléo Moulins', 'pattern': '\\bmoulins\\b', 'bounds': [46.49, 3.27, 46.65, 3.46]},
    {'id': 'tcap-privas', 'network': "T'CAP Privas", 'pattern': '\\bprivas\\b', 'bounds': [44.68, 4.52, 44.84, 4.82]},
    {'id': 'velay-le-puy', 'network': 'Mobilité en Velay (Le Puy)', 'pattern': 'puy-en-velay', 'bounds': [44.97, 3.83, 45.09, 4.01]},
    {'id': 'rlv-riom', 'network': 'RLV Mobilités Riom', 'pattern': '\\briom\\b', 'bounds': [45.83, 3.02, 45.98, 3.24]},
    {'id': 'star-roanne', 'network': 'Star Roanne', 'pattern': '\\broanne\\b', 'bounds': [45.96, 3.78, 46.22, 4.26]},
    {'id': 'lebus-tain-tournon', 'network': 'Le Bus Tain-Tournon', 'pattern': 'tain-tournon', 'bounds': [44.99, 4.52, 45.16, 5.07]},
    {'id': 'smtut-thiers', 'network': 'SMTUT Thiers', 'pattern': '\\bthiers\\b', 'bounds': [45.69, 3.36, 46.03, 3.74]},
    {'id': 'mobivie-vichy', 'network': 'MobiVie Vichy', 'pattern': '\\bvichy\\b', 'bounds': [46.06, 3.37, 46.17, 3.49]},
    {'id': 'le37-roussillon', 'network': 'Le 37 Péage-de-Roussillon', 'pattern': 'peage-de-roussillon', 'bounds': [45.3, 4.75, 45.47, 5.07]},
]
# Flux propres recopiés tels quels (après validation).
# Flux trop lourds pour être recopiés tels quels : réduits à une zone géographique (bbox sur stops.txt)
# avant d'être servis. Contrairement à EXTRACT, le filtre porte ici sur les coordonnées des arrêts, pas
# sur le nom de l'agence (utile pour un flux mono-opérateur déjà trop volumineux en lui-même).
# TCL (SYTRAL, réseau unifié depuis 09/2025, ~654 lignes, ~14 Mo brut) : trop lourd pour le téléphone
# (cf. transport-coverage.js, bloquant historique). Bbox resserrée le 13/11/2026 (soir) après un premier
# essai réel en CI : [45.65,4.75,45.85,5.10] (Part-Dieu/Perrache/Bellecour/Villeurbanne + corridor
# Saint-Exupéry) produisait 19,96 Mo, au-dessus du plafond — réduite au seul triangle Part-Dieu/Bellecour/
# Perrache, le cœur utile pour une arrivée depuis l'axe Ambérieu → Lyon. Si le nouveau test réel échoue
# encore, resserrer davantage avant d'augmenter MAX_OUT (un flux plus gros reste plus lourd à charger sur
# le téléphone même sous la limite). Non testable contre le vrai flux depuis ce poste (accès réseau direct
# à data.gouv.fr/apigee bloqué par le bac à sable de développement) : seul le passage CI réel fait foi.
# Citéa (Valence Romans Mobilités) : bbox testée réellement contre l'archive officielle le 15/11/2026
# (brut 12,2 Mo, hors MAX_OUT) — [44.85,4.80,45.10,5.15] couvre Valence/Romans-sur-Isère/Bourg-lès-Valence
# et produit 4,56 Mo (286 lignes, 17 672 courses, validé localement avant publication).
# STAS (Saint-Étienne Métropole) et T2C (Clermont Auvergne Métropole, SMTC) : URL officielles trouvées via
# le sondage PAN du 15/11/2026 (docs/sources-tarifs/pan-aura-jeux.txt), mais ces deux domaines ne sont pas
# joignables depuis ce poste de développement (bloqués par le bac à sable) — bbox ci-dessous sont des
# estimations géographiques du cœur urbain (ville + communes limitrophes immédiates), PAS mesurées sur le
# flux réel. Si le premier passage CI réel échoue (« aucun arrêt dans la zone ») ou produit un flux
# anormalement petit/gros, élargir ou resserrer avant de considérer le réseau comme fiable.
FILTERED_MIRROR = [
    # Nice : le zip d'origine est en ZIP64 (illisible sur le téléphone) → recompressé via le filtre d'emprise.
    {'id': 'lignes-azur-nice', 'network': "Lignes d'Azur (Nice)", 'url': 'https://transport.data.gouv.fr/resources/83178/download',
     'bounds': [43.55, 7.0, 43.9, 7.5], 'download_limit': 60 * 1024 * 1024},
    # RTM Marseille : 69 Mo décompressés (51 000 courses) → centre-ville + courses des 45 prochains jours seulement.
    {'id': 'rtm-marseille', 'network': 'RTM (Marseille)', 'url': 'https://transport.data.gouv.fr/resources/39589/download',
     'bounds': [43.25, 5.33, 43.34, 5.46], 'horizon_days': 45, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    {'id': 'tcl-lyon', 'network': 'TCL', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/abebedc6-28cf-4e2e-9c64-db57a40156f8',
     'bounds': [45.74, 4.81, 45.77, 4.87], 'download_limit': 60 * 1024 * 1024},
    {'id': 'citea-valence', 'network': 'Citéa (Valence Romans Mobilités)',
     'url': 'https://static.data.gouv.fr/resources/ce-jeu-de-donnees-contient-la-liste-des-arrets-des-horaires-et-des-parcours-theoriques-du-reseau-de-transport-urbain-et-interurbain-de-vrm/20261022-080050/gtfs-nov2026-juin2027-citea.zip',
     'bounds': [44.85, 4.80, 45.10, 5.15], 'download_limit': 60 * 1024 * 1024},
    {'id': 'stas-saint-etienne', 'network': 'STAS (Saint-Étienne Métropole)',
     'url': 'https://bus-prod.saint-etienne-metropole.fr/Public/stas/api/gtfs.aspx',
     'bounds': [45.38, 4.32, 45.50, 4.45], 'download_limit': 60 * 1024 * 1024},
    {'id': 't2c-clermont', 'network': 'T2C (Clermont Auvergne Métropole, SMTC)',
     'url': 'https://opendata.clermontmetropole.eu/api/v2/catalog/datasets/gtfs-smtc/alternative_exports/gtfs',
     'bounds': [45.72, 3.00, 45.85, 3.20], 'download_limit': 60 * 1024 * 1024},
    # Régions voisines (étape 18/11/2026 ; Mobigo BFC à rajouter quand l’URL de ressource correcte est connue : l’ancienne donnait 404) : URL data.gouv.fr officielles, bbox limitées aux départements frontaliers d'AURA.
    {'id': 'lio-occitanie-nord', 'network': 'liO Occitanie (Gard, Lozère — limite Ardèche)',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/d747fe79-2915-4cdd-8cc5-51a810baaca5',
     'bounds': [44.0, 3.3, 44.95, 4.7], 'download_limit': 120 * 1024 * 1024},
    {'id': 'mobigo-bfc-jura', 'network': 'Mobigo Bourgogne-Franche-Comté (Jura, Ain, Suisse)',
     'url': 'https://transport.data.gouv.fr/resources/83931/download',
     'bounds': [46.2, 5.3, 47.1, 6.3], 'download_limit': 120 * 1024 * 1024},
    {'id': 'zou-proximite-nord', 'network': 'ZOU ! Proximité (Hautes-Alpes, Vaucluse nord — limite Drôme)',
     'url': 'https://www.datasud.fr/fr/dataset/datasets/3745/resource/5016/download/',
     'bounds': [44.0, 5.0, 45.0, 7.0], 'download_limit': 120 * 1024 * 1024},
    {'id': 'zou-express-nord', 'network': 'ZOU ! Express (Alpes du Sud — limites Isère, Drôme)',
     'url': 'https://transport.data.gouv.fr/resources/82285/download',
     'bounds': [44.0, 5.0, 45.2, 7.2], 'download_limit': 120 * 1024 * 1024},
    # Fil Bleu Tours : était à tort dans MIRROR (copie brute, aucun filtrage réel malgré la bbox affichée
    # — le resserrement du 19/11 n'avait donc rien changé). Toute l'agglomération est déjà dans la bbox
    # (resserrer davantage exclurait des arrêts réels) ; le flux complet dépasse quand même 128 Mo
    # décompressés (157 Mo de stop_times.txt) → même traitement que RTM Marseille : limiter aux courses
    # des 45 prochains jours (rafraîchi chaque semaine).
    {'id': 'fil-bleu-tours', 'network': 'Fil Bleu (Tours Métropole)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/198b7602-5e74-4d88-b6bc-483af85a2430',
     'bounds': [47.34, 0.62, 47.46, 0.76], 'horizon_days': 45, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    # 20/11/2026 — 5 grandes métropoles encore absentes (demande : couvrir toute la France). Chacune a un métro/tram
    # (gros volumes de courses) → horizon_days + slim dès le départ, même traitement préventif que RTM/Fil Bleu
    # (évite de reproduire le bug du 19-20/11 où une emprise seule ne suffit pas à repasser sous 128 Mo décompressés).
    {'id': 'cts-strasbourg', 'network': 'CTS (Strasbourg Eurométropole)',
     'url': 'https://transport.data.gouv.fr/resources/79220/download',
     'bounds': [48.48, 7.60, 48.68, 7.82], 'horizon_days': 45, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    {'id': 'ilevia-lille', 'network': 'ilévia (Métropole Européenne de Lille)',
     'url': 'https://transport.data.gouv.fr/resources/81995/download',
     'bounds': [50.55, 2.85, 50.75, 3.20], 'horizon_days': 45, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    # STAR Rennes : lien stable documenté par Keolis Rennes (« toujours le GTFS en cours », rafraîchi chaque nuit),
    # préféré au resource id transport.data.gouv.fr qui change à chaque rupture d'offre.
    {'id': 'star-rennes', 'network': 'STAR (Rennes Métropole)',
     'url': 'https://eu.ftp.opendatasoft.com/star/gtfs/GTFS_STAR_BUS_METRO_EN_COURS.zip',
     'bounds': [47.98, -1.85, 48.22, -1.55], 'horizon_days': 45, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    # Naolib/TAN Nantes : resource 8055 est devenue un lien mort (404) ; resource 84101
    # (jeu "tan-arrets-horaires-et-circuits", fichier gtfs_lumidata_id.zip, mis à jour 20/11/2026) le remplace.
    # Horizon réduit à 21 jours (au lieu des 45 habituels) : réseau dense, l'extrait bbox dépassait
    # le plafond MAX_OUT (20,1 Mo pour 12 Mo autorisés) ; 21 jours suffit à rester dans la limite.
    {'id': 'naolib-nantes', 'network': 'Naolib (Nantes Métropole)',
     'url': 'https://transport.data.gouv.fr/resources/84101/download',
     'bounds': [47.13, -1.70, 47.33, -1.40], 'horizon_days': 21, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    {'id': 'tbm-bordeaux', 'network': 'TBM (Bordeaux Métropole)',
     'url': 'https://transport.data.gouv.fr/resources/83024/download',
     'bounds': [44.75, -0.70, 44.95, -0.45], 'horizon_days': 45, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    # Irigo Angers : lien stable data.gouv.fr (toujours le GTFS en vigueur, même adresse à chaque republication).
    # Le réseau comprend un tramway (lignes A/B/C) → même traitement préventif horizon_days/slim que les autres métros.
    {'id': 'irigo-angers', 'network': 'Irigo (Angers Loire Métropole)',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/32f30b64-33f7-43bb-9b6f-34c21c2f83a3',
     'bounds': [47.35, -0.70, 47.55, -0.40], 'horizon_days': 45, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    # TAO Orléans Métropole : réseau urbain avec tramway (lignes A/B) → même traitement préventif.
    {'id': 'tao-orleans', 'network': 'TAO (Orléans Métropole)',
     'url': 'https://transport.data.gouv.fr/resources/83751/download',
     'bounds': [47.80, 1.78, 47.95, 2.05], 'horizon_days': 45, 'slim': True, 'download_limit': 60 * 1024 * 1024},
    # Ametis Amiens : ressource « pour GTFS-RT » (lignes régulières uniquement, sans TAD/scolaire qui alourdiraient
    # sans utilité pour un convoyage).
    {'id': 'ametis-amiens', 'network': 'Ametis (Amiens Métropole)',
     'url': 'https://transport.data.gouv.fr/resources/80705/download',
     'bounds': [49.80, 2.20, 49.95, 2.40], 'horizon_days': 45, 'slim': True, 'download_limit': 30 * 1024 * 1024},
    # Vitalis Grand Poitiers : lien stable data.gouv.fr (Producer URL référencé par MobilityData).
    {'id': 'vitalis-poitiers', 'network': 'Vitalis (Grand Poitiers)',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/82146378-f019-4048-aa16-7328081b0369',
     'bounds': [46.50, 0.20, 46.70, 0.45], 'horizon_days': 45, 'slim': True, 'download_limit': 30 * 1024 * 1024},
    # Filibus Chartres : lien stable data.gouv.fr (Producer URL référencé par MobilityData).
    {'id': 'filibus-chartres', 'network': 'Filibus (Chartres Métropole)',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/8d4c3e5c-1702-4649-b47a-b16c6016dcc6',
     'bounds': [48.30, 1.25, 48.60, 1.65], 'horizon_days': 45, 'slim': True, 'download_limit': 30 * 1024 * 1024},
    # Agglobus Bourges : ressource courante (identifiant susceptible de changer à chaque republication,
    # comme pour Naolib avant son renouvellement — à surveiller si le téléchargement échoue).
    {'id': 'agglobus-bourges', 'network': 'Agglobus (Bourges)',
     'url': 'https://transport.data.gouv.fr/resources/83519/download',
     'bounds': [47.00, 2.30, 47.15, 2.50], 'horizon_days': 45, 'slim': True, 'download_limit': 30 * 1024 * 1024},
    # Artis Arras et Evéole Douai : liens stables data.gouv.fr (Producer URL référencés par MobilityData).
    {'id': 'artis-arras', 'network': 'Artis (CU d\'Arras)',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/4ded8fb3-a38d-45c5-b4a7-a2f6ac17ba4f',
     'bounds': [50.25, 2.70, 50.35, 2.85], 'horizon_days': 45, 'slim': True, 'download_limit': 30 * 1024 * 1024},
    {'id': 'eveole-douai', 'network': 'Evéole (Douaisis)',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/99cf5e2f-87c2-4ff1-bc0d-32f04cc213ab',
     'bounds': [50.25, 2.90, 50.50, 3.20], 'horizon_days': 45, 'slim': True, 'download_limit': 30 * 1024 * 1024},
]
# Flux propres recopiés tels quels (après validation).
MIRROR = [
    {'id': 'tac-annemasse', 'network': 'TAC Annemasse', 'url': 'https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/tp2a/exports/medias.zip', 'bounds': [46.1, 5.98, 46.27, 6.42]},
    {'id': 'synchro-chambery', 'network': 'Synchro Bus Chambéry', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/a81cdf4b-5a70-43c9-8803-cef0430ed170', 'bounds': [45.45, 5.75, 45.75, 6.15]},
    {'id': 'ondea-grand-lac', 'network': 'Ondéa Aix-les-Bains', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/b4e8d98c-e17a-4fb0-857f-8cb618039b2a', 'bounds': [45.6, 5.75, 45.85, 6.05]},
    # SIBRA (Grand Annecy) : la ressource change d'adresse à chaque publication (l'archive épinglée du 01/10/2026 a
    # disparu le 11/11/2026) ; 'dataset' fait résoudre l'archive GTFS courante du jeu officiel via l'API data.gouv.fr.
    {'id': 'sibra-annecy', 'network': 'Sibra', 'dataset': 'offre-de-transports-sibra-a-annecy-gtfs',
     'url': 'https://transport.data.gouv.fr/resources/80100/download', 'bounds': [45.7, 5.9, 46.1, 6.5]},
    # M réso (Grenoble) : même besoin que SIBRA — data.gouv.fr échoue par intermittence depuis les téléphones.
    {'id': 'mreso-grenoble', 'network': 'M Réso — Métropole grenobloise', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/b6ec7ba4-09bc-46df-b9a1-79a2c2668cf2', 'bounds': [45.0, 5.5, 45.45, 6.0]},
    {'id': 'mreso-gresivaudan', 'network': 'M Réso — Grésivaudan', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/c1067233-c35e-4c53-93b3-050f707bf6a2', 'bounds': [45.15, 5.7, 45.5, 6.15]},
    # TréMA (Mâcon) : réseau urbain voisin de l'Ain ; la ressource change à chaque publication → résolution par jeu.
    {'id': 'trema-macon', 'network': 'TréMA (Mâcon)', 'dataset': 'offre-de-transport-du-reseau-trema-gtfs',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/92b18bc7-cd60-41f5-9af7-978eacbe0691', 'bounds': [46.2, 4.7, 46.5, 5.0]},
    {'id': 'divia-dijon', 'network': 'Divia Mobilités (Dijon)', 'dataset': 'gtfs-diviamobilites-1',
     'url': 'https://www.data.gouv.fr/fr/datasets/r/e0dbd217-15cd-4e28-9459-211a27511a34', 'bounds': [47.2, 4.95, 47.45, 5.2]},
    {'id': 'ginko-besancon', 'network': 'Ginko (Besançon)', 'dataset': 'gtfs-et-siri-du-reseau-ginko-besancon-lignes-urbaines-et-periurbaines',
     'url': 'https://transport.data.gouv.fr/datasets/gtfs-et-siri-du-reseau-ginko-besancon-lignes-urbaines-et-periurbaines', 'bounds': [47.15, 5.9, 47.35, 6.2]},
    {'id': 'zoom-chalon', 'network': 'Zoom (Chalon-sur-Saône)', 'dataset': 'horaires-theoriques-du-reseau-zoom-le-grand-chalon',
     'url': 'https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-zoom-le-grand-chalon', 'bounds': [46.7, 4.75, 46.85, 5.0]},
    {'id': 'grandole-dole', 'network': 'Grandole Mobilités (Dole)', 'dataset': 'reseau-de-transport-du-grand-dole',
     'url': 'https://transport.data.gouv.fr/datasets/reseau-de-transport-du-grand-dole', 'bounds': [47.0, 5.4, 47.2, 5.65]},
    {'id': 'evolity-montbeliard', 'network': 'évolitY (Montbéliard)', 'dataset': 'evolity-horaires-theoriques-de-transport-public',
     'url': 'https://transport.data.gouv.fr/datasets/evolity-horaires-theoriques-de-transport-public', 'bounds': [47.4, 6.65, 47.6, 6.95]},
    {'id': 'orizo-avignon', 'network': 'Orizo (Grand Avignon)', 'dataset': 'gtfs-et-gtfs-rt-reseau-orizo-grand-avignon',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/40b26c33-9be2-47ea-a46c-8bda9f63273e', 'bounds': [43.85, 4.7, 44.05, 4.95]},
    {'id': 'agglo-bus-gap', 'network': "L'Agglo en Bus (Gap)", 'dataset': 'horaires-theoriques-et-temps-reels-du-reseau-de-transports-lagglo-en-bus-communaute-dagglomeration-gap-tallard-durance',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/78b7910e-1e31-4f47-b0a8-949647205ffa', 'bounds': [44.4, 5.95, 44.75, 6.25]},
    {'id': 'altigo-briancon', 'network': 'Altigo (Briançonnais)',
     'url': 'https://www.data.gouv.fr/api/1/datasets/r/3ee23301-f454-4175-ba53-4734c30d5245', 'bounds': [44.8, 6.4, 45.15, 6.8]},
    # 18/11/2026 : couronne Sud (Occitanie, PACA) — villes desservies depuis la vallée du Rhône.
    {'id': 'tango-nimes', 'network': 'Tango (Nîmes Métropole)', 'dataset': 'offre-de-transport-du-reseau-tango-de-nimes-metropole-gtfs-gtfs-rt',
     'url': 'https://static.data.gouv.fr/resources/offre-de-transport-du-reseau-tango-de-nimes-metropole-gtfs-gtfs-rt/20261116-062814/gtfs-production.zip', 'bounds': [43.7, 4.15, 44.0, 4.55]},
    {'id': 'alesy-ales', 'network': "Ales'y (Alès)", 'dataset': 'horaires-theoriques-des-lignes-urbaines-et-interurbaines-sur-le-reseau-alesy-gtfs',
     'url': 'https://static.data.gouv.fr/resources/horaires-theoriques-des-lignes-urbaines-et-interurbaines-sur-le-reseau-alesy-gtfs/20261102-092556/gtfs-is-20261102.zip', 'bounds': [43.95, 3.9, 44.35, 4.4]},
    {'id': 'sankeo-perpignan', 'network': 'Sankéo (Perpignan)', 'dataset': 'gtfs-sankeo',
     'url': 'https://static.data.gouv.fr/resources/gtfs-sankeo/20261026-132315/gtfssankeo.zip', 'bounds': [42.6, 2.8, 42.8, 3.0]},
    {'id': 'beemob-beziers', 'network': 'beeMob (Béziers Méditerranée)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/c1581a3a-0b78-4944-905c-a8530206648a', 'bounds': [43.25, 3.1, 43.45, 3.35]},
    {'id': 'citibus-narbonne', 'network': 'Citibus (Narbonne)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/21ca2b77-505b-4c4c-9154-a044e61b8560', 'bounds': [43.1, 2.9, 43.25, 3.1]},
    {'id': 'rtca-carcassonne', 'network': 'RTCA (Carcassonne Agglo)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/941123b0-004e-4f48-81e7-8c62fb4f07aa', 'bounds': [43.0, 2.1, 43.45, 2.75]},
    {'id': 'sam-sete', 'network': 'Sète Agglopôle Mobilité', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/9402f130-ac11-4615-8494-a5c84fcdb78c', 'bounds': [43.25, 3.45, 43.57, 3.87]},
    {'id': 'lebus-frejus', 'network': "Le Bus (Estérel Côte d'Azur : Fréjus, Saint-Raphaël)", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/11e73e58-edb0-4fab-a220-61a659cf6423', 'bounds': [43.3, 6.6, 43.57, 6.97]},
    {'id': 'envia-arles', 'network': 'Envia (Arles, Tarascon)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/52216d2f-072e-4b7d-af0c-15d8d4e98b09', 'bounds': [43.33, 4.35, 43.89, 4.84]},
    {'id': 'zest-menton', 'network': 'Zest (Menton, Riviera Française)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/72609821-2459-47fb-a63b-3dbbc0d96c92', 'bounds': [43.71, 7.38, 44.14, 7.69]},
    {'id': 'libebus-salon', 'network': 'Libébus (Salon-de-Provence)', 'url': 'https://transport.data.gouv.fr/resources/39592/download', 'bounds': [43.41, 4.93, 43.77, 5.37]},
    {'id': 'agglobus-aubagne', 'network': "Lignes de l'Agglo (Aubagne)", 'url': 'https://transport.data.gouv.fr/resources/39598/download', 'bounds': [43.25, 5.48, 43.45, 5.75]},
    {'id': 'ulysse-istres', 'network': 'Ulysse (Istres, Fos, Miramas)', 'url': 'https://transport.data.gouv.fr/resources/39591/download', 'bounds': [43.31, 4.77, 43.72, 5.46]},
    {'id': 'tedbus-draguignan', 'network': 'TEDbus (Draguignan, Dracénie)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/a1d56fb0-e264-45f2-8822-c08746847a97', 'bounds': [43.3, 6.2, 43.7, 6.7]},
    {'id': 'libellus-castres', 'network': 'Libellus (Castres)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/b2fd45db-63be-4eb1-a6dd-9f104611594b', 'bounds': [43.46, 2.17, 43.65, 2.43]},
    {'id': 'alliance-auch', 'network': 'Alliance bus (Auch)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/b7522c9d-5e8c-4630-aa50-5d9095e994a8', 'bounds': [43.59, 0.54, 43.73, 0.65]},
    {'id': 'tlp-tarbes-lourdes', 'network': 'TLP Mobilités (Tarbes, Lourdes)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/84f7501c-de7b-46d9-8e0c-14c30d9fa58b', 'bounds': [43.06, -0.1, 43.31, 0.14]},
    {'id': 'tempo-agen', 'network': 'Tempo Bus (Agen)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/c1415ff3-7457-4b51-aead-aacbf03a474e', 'bounds': [44.04, 0.46, 44.33, 0.91]},
    {'id': 'agglobus-foix', 'network': "L'agglo-Bus (Foix, Varilhes)", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/8c9dd4f7-f6a2-4760-915e-89e8f9666c5b', 'bounds': [42.9, 1.54, 43.1, 1.67]},
    {'id': 'idelis-pau', 'network': 'Idelis (Pau Béarn Pyrénées)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/4fcb3d29-b37c-431b-924d-c52ead2dc2d1', 'bounds': [43.2, -0.5, 43.43, -0.22]},
    {'id': 'libeo-brive', 'network': 'Libéo (Brive)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/87a0b98b-8a5a-4ba7-ad93-5a1fb9924844', 'bounds': [45.07, 1.39, 45.22, 1.61]},
    {'id': 'tulle-agglo', 'network': 'Tulle Agglo (bus urbains)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/79ab3997-524a-48a3-baec-9f40f37f7bd1', 'bounds': [45.22, 1.72, 45.31, 1.8]},
    {'id': 'na-val-de-garonne', 'network': 'CA Val de Garonne (Marmande, bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/4ea5fb1f-3b42-4bc4-a255-303250fca10d', 'bounds': [44.37, 0.08, 44.55, 0.34]},
    {'id': 'na-bergeracoise', 'network': 'CA Bergeracoise (Bergerac, bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/f5437c89-50b3-4d35-8d38-be8b9417f7a0', 'bounds': [44.81, 0.36, 44.89, 0.56]},
    {'id': 'na-saintes', 'network': 'CA Saintes (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/33f62e9d-5495-413e-ae74-070e52ab51f7', 'bounds': [45.7, -0.7, 45.78, -0.58]},
    {'id': 'na-limoges', 'network': 'Limoges Métropole (bus, trolleybus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/99e0887d-4855-47f7-a03b-a8235dfc86b7', 'bounds': [45.73, 1.06, 45.99, 1.44]},
    {'id': 'na-rochefort', 'network': 'CA Rochefort Océan (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/0346e2ae-a004-40be-8ded-ffff9046d29d', 'bounds': [45.77, -1.14, 46.06, -0.75]},
    {'id': 'na-perigueux', 'network': 'Grand Périgueux (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/907e15b8-9a0c-4b00-b1b3-325ab1ac7d4c', 'bounds': [44.93, 0.52, 45.61, 0.96]},
    {'id': 'na-pays-basque', 'network': 'CA Pays Basque (Bayonne, Biarritz, bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/b73f66c4-9aad-4a7f-807c-cdda002eae18', 'bounds': [43.05, -1.68, 43.54, -0.84]},
    {'id': 'na-grand-dax', 'network': 'Grand Dax (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/1984dfab-a5e2-4a3a-8eda-96afa73c6fa0', 'bounds': [43.65, -1.13, 43.8, -0.97]},
    {'id': 'na-libournais', 'network': 'CA du Libournais (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/c521df03-4d5c-4b38-afee-ef6c0f43a491', 'bounds': [44.8, -0.41, 45.08, 0.05]},
    {'id': 'na-grand-cognac', 'network': 'Grand Cognac (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/7a0c4ec1-628d-4b72-b180-f0c2e750112f', 'bounds': [45.5, -0.44, 45.82, 0.03]},
    {'id': 'na-grand-angouleme', 'network': 'Grand Angoulême (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/5c268fe2-3912-475b-9191-f3a6fe06a525', 'bounds': [45.49, -0.04, 45.8, 0.41]},
    {'id': 'na-la-rochelle', 'network': 'La Rochelle (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/030b9c31-4237-4355-a4d5-842861d225be', 'bounds': [46.0, -1.24, 46.27, -0.9]},
    {'id': 'na-chatellerault', 'network': 'Grand Châtellerault (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/bf4d1b15-0837-4004-bdc1-2a0b3d9984e5', 'bounds': [46.63, 0.31, 47.02, 0.83]},
    {'id': 'na-niortais', 'network': 'CA du Niortais (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/d724a6df-7dc4-4b2d-be15-fc8b1d52c8ea', 'bounds': [46.13, -0.73, 46.41, -0.34]},
    {'id': 'na-marsan', 'network': 'CA du Marsan (Mont-de-Marsan, bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/03ebd538-f9be-4eb5-ab22-2b72a0ea338c', 'bounds': [43.84, -0.55, 43.95, -0.42]},
    {'id': 'na-royan', 'network': 'Royan Atlantique (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/3af621da-a600-4da9-92c4-dfd994b22c31', 'bounds': [45.43, -1.2, 45.87, -0.7]},
    {'id': 'na-bressuirais', 'network': 'CA du Bocage Bressuirais (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/414c049b-323a-4a5c-b484-e3917a62f485', 'bounds': [46.61, -0.92, 47.1, -0.27]},
    {'id': 'ge-le-fil', 'network': 'Le Fil (Syndicat Mixte des transports du Pays du Bassin de Briey)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/3dbac712-11da-4661-b10e-fd8fab435700', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-pays-du-sel-vermois', 'network': 'CC des Pays du Sel et du Vermois (bus)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/ac0e614d-900e-4a68-9af4-e00bc5c92a61', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-le-sit', 'network': 'Le SIT (CC du Bassin de Pompey)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/c9107337-b07c-45cf-8d99-179783c02c4b', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-bus-pont-a-mousson', 'network': 'Le Bus (Pont-à-Mousson)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/f6135ec3-0969-4ba1-bf35-69dfd75799cf', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-sub', 'network': 'SUB (SMT Suburbains de Nancy)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/81deae28-2805-4d89-89e3-458c98eb6c5d', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-linggo-en-ville', 'network': 'Linggo En Ville (PETR du pays de Langres)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/56a0a326-549a-4d50-bfa0-11138946e064', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-riv-connect', 'network': "Riv'Connect (CC Rives de Moselle)", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/2b621a71-38f5-4550-b7c2-0a1a6d8f0b45', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-lulu-en-bus', 'network': 'Lulu en bus (PETR du Pays du Lunevillois)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/ecf92b66-8120-4338-8903-6d2f157afa43', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-forbus', 'network': 'Forbus (Agglomération de Forbach)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/6dd5ba5d-370e-4320-a7b7-8c5bb388d135', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-ritmo', 'network': 'Ritmo (CA de Haguenau)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/2a30dd89-438e-40e5-bc27-0f9173f11f95', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-tum', 'network': 'TUM (Commune de Sainte-Ménéhould)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/40c9e092-7447-430b-8dc0-8e646af8a999', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-stan', 'network': 'STAN (Métropole du Grand Nancy)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/6fa33c41-dc16-4328-a010-8ce2fcac10f0', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-cmonbus', 'network': 'Cmonbus (CA de Chaumont)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/930b3420-d1b4-437c-8e93-58865b750d18', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-rezo', 'network': 'REZO (CA du Grand Verdun)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/121181fc-e848-420a-8fda-50ba3201e9fa', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-colibri', 'network': 'Colibri (CC Terres Touloises)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/8cd2d76d-5db3-4b80-8bed-614af4ef3c50', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-sitac', 'network': 'SITAC (CA de Châlons-en-Champagne)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/6c872029-400d-4946-a92c-01a8a13e4dda', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-t-mm', 'network': "T'MM (CC Moselle et Madon)", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/b7c8040c-9018-4323-a87d-d7539d68bd5e', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-isibus', 'network': 'Isibus (CC Sarrebourg Moselle Sud)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/4b966be4-6da0-4920-a55c-5341ec8876e9', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-temo-b', 'network': "Temo'b (SMT Urbains Thionville-Fensch)", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/f30a3b64-a902-4e7e-981c-d1f6caad933a', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-grand-reims-mobilites', 'network': 'Grand Reims Mobilités (CU du Grand Reims)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/2b928243-523d-42c5-8cf3-77176c0247f6', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-mouveo', 'network': 'Mouvéo (CA Epernay Coteaux et Plaine de Champagne)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/92ec059b-baf8-4afe-97fb-7c6ddccb9e86', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-ticea', 'network': 'TICEA (CA de St Dizier, Der et Blaise)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/473e63bc-ff9b-44f7-95c0-e18f1935622c', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-trace', 'network': 'TRACE (Colmar Agglomération)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/6a0c9cc9-d65e-49fc-a3a9-41f3d2e343b5', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-pass-o', 'network': "Pass'O (Ville d'Obernai)", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/16793463-96f4-43d4-86b8-1db036e97cdc', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-imagine', 'network': "Imagine (CA d'Epinal)", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/eef26fe9-7ebd-4ea9-8b16-dcb59b90766e', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-elsa', 'network': 'ELSA (PETR Sélestat Alsace Centrale)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/e8c2e6a9-d7f3-4c42-82c9-f7366dd79023', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-tac', 'network': 'TAC (CA Ardenne Métropole)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/cd55107e-671d-43f9-92bd-2e5360405e30', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-cabus', 'network': 'CABUS (CA Sarreguemines Confluences)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/5ddec6c5-51b5-40ab-8805-9ca2dc5c98ec', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-le-met', 'network': 'Le MET (CA Metz Métropole)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/5ffccf72-4a0e-4330-8155-5b74ae382219', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-transavold', 'network': 'Transavold (CA Saint-Avold Synergie)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/48cab21c-c6a5-4186-a4b5-53d61f03a2b8', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-solea', 'network': 'Soléa (CA Mulhouse Alsace Agglomération)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/4527e0e2-0e5b-4a1b-b250-d5269e0d5819', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-distribus', 'network': 'Distribus (CA Saint-Louis Agglomération)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/e90de03b-0247-444e-8d4d-ca557770b60f', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-tcat', 'network': 'TCAT (CA Troyes Champagne Métropole)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/db6708ac-bfb4-45cf-8c79-a88c3b805bc0', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-sylvia', 'network': 'SYLVIA (CA Saint Dié des Vosges)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/f7a3c744-c717-4ae9-a5f7-b48873a9e82a', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'ge-tub', 'network': 'TUB (CA Bar-le-Duc Sud Meuse)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/46055750-4ab2-46f1-b4cf-83900bc071b8', 'bounds': [47.4, 3.5, 50.2, 8.3]},
    {'id': 'twisto-caen', 'network': 'Twisto (Caen la mer)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/a5a8f046-e282-4010-91c5-82bc1f70ff73', 'bounds': [46.0, -2.0, 49.5, 2.5]},
    {'id': 'setram-lemans', 'network': 'SETRAM (Le Mans Métropole)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/dee9adc5-044c-4f68-9cd3-eefbdf7a6abd', 'bounds': [46.0, -2.0, 49.5, 2.5]},
    {'id': 'transurbain-evreux', 'network': 'Transurbain (Évreux Portes de Normandie)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/ec78df83-2e60-4284-acc3-86a0baa76bf0', 'bounds': [48.94, 1.04, 49.1, 1.21]},
    {'id': 'choletbus', 'network': 'Choletbus (Cholet Agglomération)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/71e8ee8e-0b55-40a1-a297-21ef89aba4dc', 'bounds': [46.98, -1.05, 47.22, -0.35]},
    {'id': 'dkbus-dunkerque', 'network': 'DK\'Bus (Dunkerque)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/f51fabfb-9d7a-44b7-bd03-d1032337fb80', 'bounds': [50.92, 2.08, 51.1, 2.62]},
    {'id': 'simouv-valenciennes', 'network': 'Transvilles / SIMOUV (Valenciennes)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/982e0826-4118-42d9-9b73-c3d3b455cd4f', 'bounds': [50.22, 3.23, 50.53, 3.71]},
    {'id': 'pastel-saint-quentin', 'network': 'Pastel (Saint-Quentin)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/42e3ea9d-251e-47c1-988d-f7227f0e2d0f', 'bounds': [49.8, 3.23, 49.89, 3.35]},
    {'id': 'bibus-brest', 'network': 'Bibus (Brest Métropole)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/583d1419-058b-481b-b378-449cab744c82', 'bounds': [43.0, -5.0, 50.5, 3.5]},
    {'id': 'astuce-rouen', 'network': 'Astuce (Métropole Rouen Normandie)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/c0ebcf01-954a-4d24-b2d8-a00333ffe937', 'bounds': [43.0, -5.0, 50.5, 3.5]},
    {'id': 'izilo-lorient', 'network': 'Izilo (Lorient Agglomération)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/c32dc40b-3538-4796-a6c6-fd239d6c1364', 'bounds': [43.0, -5.0, 50.5, 3.5]},
    {'id': 'tul-laval', 'network': 'TUL (Laval Agglomération)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/bd780aef-b3c5-405a-8450-8365a7a0c315', 'bounds': [43.0, -5.0, 50.5, 3.5]},
    {'id': 'sitac-calais', 'network': 'Sitac (Calais)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/326e6585-9319-4022-88bf-930dd18af464', 'bounds': [43.0, -5.0, 50.5, 3.5]},
    {'id': 'tic-compiegne', 'network': 'TIC (Compiègne)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/3a98dcdb-ca6e-40fc-8da9-09ab7f5661c9', 'bounds': [43.0, -5.0, 50.5, 3.5]},
    {'id': 'tisseo-toulouse', 'network': 'Tisséo (Toulouse)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/64318177-f5b5-4144-a6be-2d0f22d26c77', 'bounds': [43.45, 1.15, 43.85, 1.7]},
    {'id': 'mistral-toulon', 'network': 'Réseau Mistral (Toulon)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/b0789d9e-5077-4124-b6b2-773353ada8cf', 'bounds': [43.0, 5.75, 43.25, 6.15]},
    {'id': 'aixenbus-aix', 'network': 'Aix en Bus', 'url': 'https://transport.data.gouv.fr/resources/39603/download', 'bounds': [43.45, 5.35, 43.65, 5.55]},
    {'id': 'tam-montpellier', 'network': 'TaM (Montpellier, urbain et suburbain)', 'url': 'https://gtfsproxy.e-tam.fr/COMMON/GTFS.zip', 'bounds': [43.45, 3.5, 43.95, 4.15]},
    {'id': 'palmbus-cannes', 'network': 'Palmbus (Cannes Pays de Lérins)', 'dataset': 'horaires-theoriques-et-temps-reel-gtfs-gtfs-rt-du-reseau-palmbus-cannes-pays-de-lerins',
     'url': 'https://static.data.gouv.fr/resources/horaires-theoriques-et-temps-reel-gtfs-gtfs-rt-du-reseau-palmbus-cannes-pays-de-lerins/20261027-070043/palmbus-cannes-fr.zip', 'bounds': [43.45, 6.85, 43.7, 7.15]},
    {'id': 'start-thonon', 'network': "Star't Thonon", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/7cbb883b-d0cb-4bc7-b2e0-7537afdbc86e', 'bounds': [46.25, 6.3, 46.45, 6.65]},
    {'id': 'kiceo-vannes', 'network': 'KICEO (Vannes)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/565533c0-64ae-44d6-9dfa-169be5b805c6', 'bounds': [47.49, -2.95, 47.83, -2.53]},
    {'id': 'axeo-saint-brieuc', 'network': "Axéo (Baie d'Armor, Saint-Brieuc)", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/9bccfc79-5d35-4fc3-8296-526b791fc950', 'bounds': [48.31, -3.04, 48.67, -2.63]},
    {'id': 'lia-le-havre', 'network': 'LiA (Le Havre Seine Métropole)', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/2178bfa8-9fe0-4633-8223-8c151728ef28', 'bounds': [49.35, 0.0, 49.7, 0.5]},
]
REQUIRED = ['agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt']


def norm(text):
    return unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().lower()


def download(url, limit=400 * 1024 * 1024):
    # Les serveurs des réseaux coupent parfois la connexion : 3 essais avant d'abandonner.
    last = None
    for attempt in range(3):
        try:
            return _download_once(url, limit)
        except SystemExit:
            raise
        except Exception as exc:
            last = exc
            time.sleep(5 * (attempt + 1))
    raise last


def _download_once(url, limit=400 * 1024 * 1024):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            tmp.write(chunk)
            if tmp.tell() > limit:
                raise SystemExit('Archive trop volumineuse : ' + url)
        return tmp.name


def current_dataset_zip(slug, fallback):
    """Adresse de l'archive GTFS la plus récente d'un jeu data.gouv.fr ; repli sur l'adresse stable fournie."""
    try:
        api = 'https://www.data.gouv.fr/api/1/datasets/%s/' % slug
        with urllib.request.urlopen(urllib.request.Request(api, headers=UA), timeout=90) as r:
            meta = json.load(r)
        res = [x for x in meta.get('resources', []) if str(x.get('url', '')).lower().endswith('.zip')
               or str(x.get('format', '')).lower() in ('gtfs', 'zip')]
        res.sort(key=lambda x: str(x.get('last_modified') or ''), reverse=True)
        if res and res[0].get('url'):
            return res[0]['url']
    except Exception:
        pass
    return fallback


def find_oura_aggregate():
    api = 'https://www.data.gouv.fr/api/1/datasets/agregat-oura/'
    with urllib.request.urlopen(urllib.request.Request(api, headers=UA), timeout=40) as r:
        data = json.load(r)
    res = [x for x in data.get('resources', []) if 'gtfs' in (x.get('format') or '').lower() and (x.get('url') or '').startswith('https://')]
    if not res:
        raise SystemExit('Aucune ressource GTFS dans l’agrégat Oùra')
    best = max(res, key=lambda x: x.get('last_modified') or '')
    return best['url'], best.get('last_modified')


def read_table(z, name):
    if name not in z.namelist():
        return None, []
    with z.open(name) as s:
        reader = csv.DictReader(io.TextIOWrapper(s, encoding='utf-8-sig', newline=''))
        return reader.fieldnames, list(reader)


def write_table(out, name, fields, rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator='\n', extrasaction='ignore')
    w.writeheader()
    w.writerows(rows)
    out.writestr(name, buf.getvalue())


def validate(z):
    names = set(z.namelist())
    missing = [t for t in REQUIRED if t not in names]
    if missing:
        raise ValueError('tables manquantes : ' + ', '.join(missing))
    if not ({'calendar.txt', 'calendar_dates.txt'} & names):
        raise ValueError('calendrier absent')
    _, trips = read_table(z, 'trips.txt')
    _, times = read_table(z, 'stop_times.txt')
    if not trips or not times:
        raise ValueError('aucune course')
    return len(trips), len(times)


def agencies_report(z):
    _, agencies = read_table(z, 'agency.txt')
    _, routes = read_table(z, 'routes.txt')
    count = {}
    for r in routes:
        count[r.get('agency_id') or ''] = count.get(r.get('agency_id') or '', 0) + 1
    return [{'agency_id': a.get('agency_id'), 'agency_name': a.get('agency_name'), 'routes': count.get(a.get('agency_id') or '', 0)} for a in agencies]


def extract(z, spec):
    pat = re.compile(spec['pattern'])
    afields, agencies = read_table(z, 'agency.txt')
    keep_ag = [a for a in agencies if pat.search(norm(a.get('agency_name'))) or pat.search(norm(a.get('agency_id')))]
    if not keep_ag:
        return None, 'aucune agence correspondante'
    ag_ids = {a.get('agency_id') or '' for a in keep_ag}
    single = len(agencies) == 1
    rfields, routes = read_table(z, 'routes.txt')
    routes = [r for r in routes if (r.get('agency_id') or '') in ag_ids or (single and not r.get('agency_id'))]
    route_ids = {r['route_id'] for r in routes}
    tfields, trips = read_table(z, 'trips.txt')
    trips = [t for t in trips if t['route_id'] in route_ids]
    trip_ids = {t['trip_id'] for t in trips}
    service_ids = {t['service_id'] for t in trips}
    stfields, times = read_table(z, 'stop_times.txt')
    times = [t for t in times if t['trip_id'] in trip_ids]
    stop_ids = {t['stop_id'] for t in times}
    sfields, stops = read_table(z, 'stops.txt')
    parents = {s.get('parent_station') for s in stops if s['stop_id'] in stop_ids and s.get('parent_station')}
    stops = [s for s in stops if s['stop_id'] in stop_ids or s['stop_id'] in parents]
    if not trips or not times:
        return None, 'agence trouvée mais aucune course'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as out:
        write_table(out, 'agency.txt', afields, keep_ag)
        write_table(out, 'routes.txt', rfields, routes)
        write_table(out, 'trips.txt', tfields, trips)
        write_table(out, 'stop_times.txt', stfields, times)
        write_table(out, 'stops.txt', sfields, stops)
        for cal in ('calendar.txt', 'calendar_dates.txt'):
            f, rows = read_table(z, cal)
            if f:
                write_table(out, cal, f, [r for r in rows if r['service_id'] in service_ids])
        f, rows = read_table(z, 'feed_info.txt')
        if f:
            write_table(out, 'feed_info.txt', f, rows)
        # Tarifs officiels du producteur, limités aux lignes/agences extraites.
        ff, fares = read_table(z, 'fare_attributes.txt')
        rf, rules = read_table(z, 'fare_rules.txt')
        if ff:
            if rf:
                rules = [r for r in rules if not r.get('route_id') or r['route_id'] in route_ids]
                fare_ids = {r['fare_id'] for r in rules}
                fares = [x for x in fares if x['fare_id'] in fare_ids or (x.get('agency_id') or '') in ag_ids]
                write_table(out, 'fare_rules.txt', rf, rules)
            else:
                fares = [x for x in fares if (x.get('agency_id') or '') in ag_ids or len(fares) == 1]
            write_table(out, 'fare_attributes.txt', ff, fares)
    data = buf.getvalue()
    if len(data) > MAX_OUT:
        return None, 'extrait trop volumineux (%d octets)' % len(data)
    return data, {'agencies': [a.get('agency_name') for a in keep_ag], 'routes': len(routes), 'trips': len(trips), 'stops': len(stops), 'fares': bool(ff)}


def trips_active_within(z, days):
    """Identifiants des courses dont le service circule au moins un jour dans les `days` prochains jours."""
    today = datetime.date.today()
    window = {(today + datetime.timedelta(d)).strftime('%Y%m%d') for d in range(days)}
    weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    active = set()
    _, cal = read_table(z, 'calendar.txt')
    for c in cal:
        for d in window:
            if c['start_date'] <= d <= c['end_date']:
                dt = datetime.datetime.strptime(d, '%Y%m%d')
                if c.get(weekdays[dt.weekday()]) == '1':
                    active.add(c['service_id'])
                    break
    _, cd = read_table(z, 'calendar_dates.txt')
    removed = {}
    for r in cd:
        if r['date'] in window:
            if r['exception_type'] == '1':
                active.add(r['service_id'])
    _, trips = read_table(z, 'trips.txt')
    return {t['trip_id'] for t in trips if t['service_id'] in active}


def filter_by_bounds(z, spec):
    """Réduit un flux GTFS mono-opérateur à une zone géographique (bbox sur les arrêts), pour les flux
    trop volumineux pour être recopiés tels quels (ex. TCL). Contrairement à extract(), le filtre
    sélectionne d'abord les arrêts dans la bbox, puis ne garde que les courses passant par au moins deux
    d'entre eux (un seul arrêt dans la zone ne permet aucun trajet local). Les arrêts hors zone de ces
    courses sont retirés : le flux produit ne couvre que des trajets internes à la bbox, jamais un
    trajet qui en sortirait silencieusement sans l'indiquer."""
    lat_min, lon_min, lat_max, lon_max = spec['bounds']
    sfields, stops = read_table(z, 'stops.txt')
    if not stops:
        return None, 'aucun arrêt dans le flux source'

    def in_bounds(s):
        try:
            lat, lon = float(s.get('stop_lat') or 'nan'), float(s.get('stop_lon') or 'nan')
        except ValueError:
            return False
        return lat_min <= lat <= lat_max and lon_min <= lon <= lon_max
    in_zone = {s['stop_id'] for s in stops if in_bounds(s)}
    if not in_zone:
        return None, 'aucun arrêt dans la zone géographique'
    stfields, times = read_table(z, 'stop_times.txt')
    active_trips = None
    if spec.get('horizon_days'):
        # Flux trop lourd : on ne garde que les courses circulant dans les N prochains jours (rafraîchi chaque semaine).
        active_trips = trips_active_within(z, int(spec['horizon_days']))
    by_trip = {}
    for t in times:
        if active_trips is not None and t['trip_id'] not in active_trips:
            continue
        by_trip.setdefault(t['trip_id'], []).append(t)
    kept_trip_ids, times = set(), []
    for trip_id, rows in by_trip.items():
        local = [r for r in rows if r['stop_id'] in in_zone]
        if len(local) < 2:
            continue
        kept_trip_ids.add(trip_id)
        times.extend(local)
    if not kept_trip_ids:
        return None, 'aucune course avec au moins deux arrêts dans la zone'
    stop_ids = {t['stop_id'] for t in times}
    parents = {s.get('parent_station') for s in stops if s['stop_id'] in stop_ids and s.get('parent_station')}
    stops = [s for s in stops if s['stop_id'] in stop_ids or s['stop_id'] in parents]
    tfields, trips = read_table(z, 'trips.txt')
    trips = [t for t in trips if t['trip_id'] in kept_trip_ids]
    route_ids = {t['route_id'] for t in trips}
    service_ids = {t['service_id'] for t in trips}
    rfields, routes = read_table(z, 'routes.txt')
    routes = [r for r in routes if r['route_id'] in route_ids]
    ag_ids = {r.get('agency_id') or '' for r in routes}
    afields, agencies = read_table(z, 'agency.txt')
    keep_ag = [a for a in agencies if (a.get('agency_id') or '') in ag_ids or len(agencies) == 1]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as out:
        write_table(out, 'agency.txt', afields, keep_ag)
        write_table(out, 'routes.txt', rfields, routes)
        write_table(out, 'trips.txt', tfields, trips)
        if spec.get('slim'):
            # Colonnes facultatives vides ou à leur valeur par défaut : retirées pour alléger le flux.
            defaults = {'pickup_type': {'', '0'}, 'drop_off_type': {'', '0'}, 'timepoint': {'', '1'},
                        'stop_headsign': {''}, 'shape_dist_traveled': {''}}
            drop = {c for c, ok in defaults.items() if c in stfields and all((r.get(c) or '') in ok for r in times)}
            stfields = [c for c in stfields if c not in drop]
        write_table(out, 'stop_times.txt', stfields, times)
        write_table(out, 'stops.txt', sfields, stops)
        for cal in ('calendar.txt', 'calendar_dates.txt'):
            f, rows = read_table(z, cal)
            if f:
                write_table(out, cal, f, [r for r in rows if r['service_id'] in service_ids])
        f, rows = read_table(z, 'feed_info.txt')
        if f:
            write_table(out, 'feed_info.txt', f, rows)
        # Tarifs officiels du producteur, limités aux lignes retenues dans la zone. Contrairement à
        # extract() (filtrage par agence, où un repli par agency_id est sûr), ici une ligne écartée par la
        # bbox peut partager son agence avec une ligne gardée : pas de repli par agence, seul fare_rules
        # (par route_id) ou, à défaut, la cardinalité 1 décide — pour ne jamais faire fuiter un tarif
        # d'une ligne hors zone.
        ff, fares = read_table(z, 'fare_attributes.txt')
        rf, rules = read_table(z, 'fare_rules.txt')
        if ff:
            if rf:
                rules = [r for r in rules if not r.get('route_id') or r['route_id'] in route_ids]
                fare_ids = {r['fare_id'] for r in rules}
                fares = [x for x in fares if x['fare_id'] in fare_ids]
                write_table(out, 'fare_rules.txt', rf, rules)
            else:
                fares = fares if len(fares) == 1 else []
            write_table(out, 'fare_attributes.txt', ff, fares)
    data = buf.getvalue()
    if len(data) > MAX_OUT:
        return None, 'extrait géographique trop volumineux (%d octets) : réduire la bbox' % len(data)
    return data, {'routes': len(routes), 'trips': len(trips), 'stops': len(stops), 'fares': bool(ff), 'bounds': spec['bounds']}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--aggregate', help='archive Oùra déjà téléchargée (tests)')
    ap.add_argument('--out', default='data/gtfs')
    ap.add_argument('--offline', action='store_true', help='ne pas télécharger les flux propres (tests)')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    manifest = {'schemaVersion': 1, 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'scope': 'GTFS officiels réduits ou recopiés ; aucun horaire ni tarif créé', 'networks': {}, 'errors': {}}
    if args.aggregate:
        path, version, src = args.aggregate, 'fichier local', 'local'
    else:
        src, version = find_oura_aggregate()
        path = download(src)
    with zipfile.ZipFile(path) as z:
        manifest['oura'] = {'source': src, 'version': version}
        with open(os.path.join(args.out, 'oura-agencies.json'), 'w', encoding='utf-8') as f:
            json.dump(agencies_report(z), f, ensure_ascii=False, indent=1)
        for spec in EXTRACT:
            try:
                data, info = extract(z, spec)
            except Exception as e:  # une erreur sur un réseau n'arrête pas les autres
                data, info = None, 'erreur : %s' % e
            if data is None:
                manifest['errors'][spec['id']] = info
                continue
            with zipfile.ZipFile(io.BytesIO(data)) as check:
                validate(check)
            name = spec['id'] + '.zip'
            with open(os.path.join(args.out, name), 'wb') as f:
                f.write(data)
            manifest['networks'][spec['id']] = {'network': spec['network'], 'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
                                                'bytes': len(data), 'bounds': spec['bounds'], 'origin': 'agrégat Oùra', **info}
    if not args.offline:
        for spec in MIRROR:
            try:
                origin = current_dataset_zip(spec['dataset'], spec['url']) if spec.get('dataset') else spec['url']
                p = download(origin, MAX_OUT)
                with zipfile.ZipFile(p) as z:
                    trips, times = validate(z)
                data = open(p, 'rb').read()
                name = spec['id'] + '.zip'
                with open(os.path.join(args.out, name), 'wb') as f:
                    f.write(data)
                manifest['networks'][spec['id']] = {'network': spec['network'], 'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
                                                    'bytes': len(data), 'bounds': spec['bounds'], 'origin': origin, 'trips': trips}
            except BaseException as e:
                manifest['errors'][spec['id']] = 'erreur : %s' % e
        for spec in FILTERED_MIRROR:
            try:
                p = download(spec['url'], spec.get('download_limit', MAX_OUT))
                with zipfile.ZipFile(p) as z:
                    validate(z)
                    data, info = filter_by_bounds(z, spec)
                if data is None:
                    manifest['errors'][spec['id']] = info
                    continue
                with zipfile.ZipFile(io.BytesIO(data)) as check:
                    validate(check)
                name = spec['id'] + '.zip'
                with open(os.path.join(args.out, name), 'wb') as f:
                    f.write(data)
                manifest['networks'][spec['id']] = {'network': spec['network'], 'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
                                                    'bytes': len(data), 'origin': spec['url'], **info}
            except BaseException as e:
                manifest['errors'][spec['id']] = 'erreur : %s' % e
    with open(os.path.join(args.out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(json.dumps({'networks': list(manifest['networks']), 'errors': manifest['errors']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
