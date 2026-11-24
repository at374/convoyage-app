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
import argparse, csv, hashlib, io, json, math, os, re, sys, tempfile, unicodedata, urllib.request, zipfile, datetime

UA = {'User-Agent': 'ConvoyageUltra-GTFS/1.0'}
MAX_OUT = 12 * 1024 * 1024
# Réseaux extraits de l'agrégat : motifs sur agency_name / agency_id (normalisés sans accents, minuscules).
EXTRACT = [
    {'id': 'jybus-rumilly', 'network': "J'y bus Rumilly", 'pattern': r"j.?y ?bus|rumilly", 'bounds': [45.80, 5.85, 45.93, 6.05]},
    {'id': 'tam-amberieu', 'network': 'TAM Ambérieu-en-Bugey', 'pattern': r"\btam\b|amberieu", 'bounds': [45.90, 5.28, 46.02, 5.45]},
    {'id': 'cars-region-isere', 'network': 'Cars Région Isère', 'pattern': r"cars? region.*isere|\bisere\b", 'bounds': [44.69, 4.74, 45.89, 6.36]},
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
    # Couronne suivant la BFC : première tranche interurbaine Fluo Grand Est. La source agrège
    # les lignes départementales ; le découpage garde les parcours ayant au moins deux arrêts
    # dans l'emprise régionale et n'annonce pas un raccordement moteur.
    {'id': 'fluo-grand-est', 'network': 'Fluo Grand Est (interurbain)',
     'url': 'https://transport.data.gouv.fr/resources/83635/download',
     'bounds': [47.3, 3.2, 50.35, 8.45], 'download_limit': 60 * 1024 * 1024,
     'license': 'Licence Ouverte 2.0', 'publisher': 'Région Grand Est / Fluo Grand Est'},
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
]
# Flux propres recopiés tels quels (après validation).
MIRROR = [
    # Forbus: retain the French network but remove the line H whose route ends in Germany.
    # The official feed is refreshed via the public PAN dataset slug; the fixed resource is fallback.
    {'id': 'forbus-forbach', 'network': 'Forbus Forbach',
     'dataset': 'fr-200052264-t0007-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/80467/download',
     'agency_pattern': 'forbus', 'exclude_route_patterns': ['schoeneck'],
     'derive_bounds': True, 'license': 'Licence Ouverte 2.0',
     'publisher': 'Fluo Grand Est / CA de Forbach Porte de France'},
    # TeMo'b's route 052 continues from France to Redange in Luxembourg; retain its French routes only.
    {'id': 'temob-thionville', 'network': "TeMo'b Thionville-Fensch",
     'dataset': 'offre-de-transport-du-reseau-temob-syndicat-mixte-des-transports-urbains-thionville-fensch',
     'url': 'https://transport.data.gouv.fr/resources/80459/download',
     'agency_pattern': 'thionville fensch', 'exclude_route_patterns': ['redange'],
     'derive_bounds': True, 'license': 'Licence Ouverte 2.0',
     'publisher': 'Fluo Grand Est / SM des transports urbains Thionville Fensch'},
    # Première couronne Hauts-de-France : flux urbains officiels. Ceux-ci restent au stade
    # indexeur GTFS tant qu'ils ne sont pas raccordés et éprouvés dans un fournisseur mission.
    {'id': 'ilevia-lille', 'network': 'ilévia Lille',
     'dataset': 'ilevia-localisation-des-arrets-bus-metro-et-tram-gtfs',
     'url': 'https://transport.data.gouv.fr/resources/81995/download',
     'derive_bounds': True, 'license': 'Licence Ouverte 2.0',
     'publisher': 'Métropole Européenne de Lille'},
    {'id': 'transvilles-valenciennes', 'network': 'Transvilles Valenciennes',
     'dataset': 'simouv-horaires-theoriques-format-gtfs-et-temps-reel-format-siri-transvilles-valenciennes',
     'url': 'https://transport.data.gouv.fr/resources/84121/download',
     'derive_bounds': True, 'license': 'Licence Ouverte 2.0',
     'publisher': 'Syndicat Intercommunal de Mobilité et d’Organisation Urbaine du Valenciennois'},
    # Le ZIP TADAO brut dépasse 12 Mo ; l'extraction mono-agence retire les tables inutiles
    # tout en gardant routes, courses, calendriers, arrêts et coordonnées.
    {'id': 'tadao-lens', 'network': 'TADAO Lens-Liévin',
     'dataset': 'gtfs-tadao', 'url': 'https://transport.data.gouv.fr/resources/83643/download',
     'download_limit': 60 * 1024 * 1024,
     'agency_pattern': 'tadao', 'derive_bounds': True, 'license': 'ODbL',
     'publisher': 'Syndicat Mixte des Transports Artois-Gohelle'},
    {'id': 'dkbus-dunkerque', 'network': 'DK’BUS Dunkerque',
     'dataset': 'offre-de-transports-reseau-dk-bus-de-la-communaute-urbaine-de-dunkerque-gtfs',
     'url': 'https://transport.data.gouv.fr/resources/82683/download',
     'derive_bounds': True, 'license': 'ODbL',
     'publisher': 'Communauté urbaine de Dunkerque'},
    {'id': 'ametis-amiens', 'network': 'Ametis Amiens', 'dataset': 'ametis',
     'resource_keywords': ['tad', 'scolaire', 'shapes'], 'url': 'https://transport.data.gouv.fr/resources/80223/download',
     'derive_bounds': True, 'license': 'Licence Ouverte 2.0',
     'publisher': 'Amiens Métropole'},
    {'id': 'eveole-douai', 'network': 'Évéole Douai',
     'dataset': 'eveole-douai-reseau-bus-du-syndicat-mixte-des-transports-du-douaisis-smtd',
     'url': 'https://transport.data.gouv.fr/resources/79544/download',
     'derive_bounds': True, 'license': 'ODbL',
     'publisher': 'Syndicat Mixte des Transports du Douaisis'},
    {'id': 'marineo-boulogne', 'network': 'Marinéo Boulogne-sur-Mer',
     'dataset': 'horaires-theoriques-et-temps-reel-du-reseau-de-transport-marineo',
     'url': 'https://transport.data.gouv.fr/resources/51449/download',
     'derive_bounds': True, 'license': 'Licence Ouverte 2.0',
     'publisher': 'Communauté d’agglomération du Boulonnais'},
    {'id': 'artis-arras', 'network': 'Artis Arras', 'dataset': 'reseau-de-transport-artis',
     'url': 'https://transport.data.gouv.fr/resources/83372/download',
     'derive_bounds': True, 'license': 'Licence Ouverte 2.0',
     'publisher': 'Communauté urbaine d’Arras'},
    # Le GTFS SITAC contient aussi des traversées en ferry (route_type=4), exclues ici :
    # Convoyage Ultra ne recherche pas les bateaux.
    {'id': 'sitac-calais', 'network': 'SITAC Calais',
     'dataset': 'horaires-theoriques-et-temps-reel-aux-formats-gtfs-et-gtfs-rt-du-reseau-sitac',
     'url': 'https://transport.data.gouv.fr/resources/83807/download',
     'agency_pattern': 'zenbus', 'exclude_route_types': ['4'], 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0', 'publisher': 'Grand Calais Terres et Mers'},
    # Source urbaine Grand Est indépendante de l'agrégat Fluo. 4,36 Mo, 48 lignes,
    # et calendrier valide au 25/06/2027 selon la ressource PAN 80787.
    {'id': 'solea-mulhouse', 'network': 'Soléa Mulhouse',
     'url': 'https://transport.data.gouv.fr/resources/80787/download',
     'bounds': [47.62, 7.10, 47.85, 7.55], 'license': 'Licence Ouverte 2.0',
     'publisher': 'Mulhouse Alsace Agglomération'},
    {'id': 'grand-reims', 'network': 'Grand Reims Mobilités',
     'dataset': 'offre-de-transport-du-reseau-grand-reims-mobilites-communaute-urbaine-du-grand-reims',
     'url': 'https://transport.data.gouv.fr/resources/80594/download',
     'bounds': [49.10, 3.80, 49.40, 4.30], 'license': 'Licence Ouverte 2.0',
     'publisher': 'Fluo Grand Est / CU du Grand Reims'},
    # Source urbaine publique STAN Nancy, actualisée par Fluo Grand Est sur data.gouv.fr.
    # Résolution dynamique par slug; le repli PAN reste stable si l'API data.gouv est indisponible.
    {'id': 'stan-nancy', 'network': 'STAN Nancy',
     'dataset': 'fr-200052264-t0034-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/83710/download',
     'bounds': [48.60, 6.09, 48.74, 6.29], 'license': 'Licence Ouverte 2.0',
     'publisher': 'Fluo Grand Est / Métropole du Grand Nancy'},
    # Prochaine tranche Grand Est. Les emprises sont mesurées dans stops.txt au moment de la collecte
    # (derive_bounds), jamais estimées à partir du nom de la ville.
    {'id': 'sub-nancy', 'network': 'SUB Nancy', 'dataset': 'fr-200052264-t0039-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/80431/download', 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0'},
    {'id': 'trace-colmar', 'network': 'TRACE Colmar', 'dataset': 'fr-200052264-t0004-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/80479/download', 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0'},
    {'id': 'imagine-epinal', 'network': 'Imagine Épinal', 'dataset': 'fr-200052264-t0009-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/80461/download', 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0'},
    {'id': 'ticea-saint-dizier', 'network': 'Ticéa Saint-Dizier', 'dataset': 'fr-200052264-t0010-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/80477/download', 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0'},
    {'id': 'transavold-saint-avold', 'network': 'Transavold Saint-Avold', 'dataset': 'fr-200052264-t0015-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/82413/download', 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0'},
    {'id': 'cmonbus-chaumont', 'network': 'Cmonbus Chaumont',
     'dataset': 'offre-de-transport-du-reseau-cmonbus-communaute-dagglomeration-de-chaumont',
     'url': 'https://transport.data.gouv.fr/resources/80410/download', 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0'},
    {'id': 'tub-bar-le-duc', 'network': 'TUB Bar-le-Duc', 'dataset': 'fr-200052264-t0003-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/80441/download', 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0'},
    {'id': 'rezo-verdun', 'network': 'Rézo Verdun', 'dataset': 'fr-200052264-t0011-0000-1',
     'url': 'https://transport.data.gouv.fr/resources/80772/download', 'derive_bounds': True,
     'license': 'Licence Ouverte 2.0'},
    {'id': 'tcat-troyes', 'network': 'TCAT Troyes', 'dataset': 'donnees-tcat-troyes-champagne-metropole-1',
     'url': 'https://transport.data.gouv.fr/resources/79847/download', 'derive_bounds': True,
     'license': 'ODbL', 'publisher': 'Troyes Champagne Métropole'},
    # Première région dans la progression en escargot au départ d'AURA : Bourgogne-Franche-Comté.
    # Les ressources départementales Mobigo sont publiées individuellement par la Région sous Licence Ouverte 2.0.
    # Elles restent séparées pour conserver les calendriers et éviter de fusionner des identifiants GTFS homonymes.
    {'id': 'mobigo-39-jura', 'network': 'Mobigo Jura (39)', 'url': 'https://transport.data.gouv.fr/resources/84076/download', 'bounds': [46.25, 5.2, 47.0, 6.25]},
    {'id': 'mobigo-58-nievre', 'network': 'Mobigo Nièvre (58)', 'url': 'https://transport.data.gouv.fr/resources/84075/download', 'bounds': [46.55, 2.75, 47.75, 4.35]},
    {'id': 'mobigo-21-cote-dor', 'network': "Mobigo Côte-d'Or (21)", 'url': 'https://transport.data.gouv.fr/resources/84078/download', 'bounds': [46.65, 3.95, 48.0, 5.65]},
    {'id': 'mobigo-25-doubs', 'network': 'Mobigo Doubs (25)', 'url': 'https://transport.data.gouv.fr/resources/84077/download', 'bounds': [46.6, 5.55, 47.75, 7.15]},
    {'id': 'mobigo-89-yonne', 'network': 'Mobigo Yonne (89)', 'url': 'https://transport.data.gouv.fr/resources/84072/download', 'bounds': [47.2, 2.75, 48.45, 4.5]},
    {'id': 'mobigo-70-haute-saone', 'network': 'Mobigo Haute-Saône (70)', 'url': 'https://transport.data.gouv.fr/resources/84074/download', 'bounds': [47.15, 5.25, 48.05, 7.15]},
    {'id': 'mobigo-71-saone-et-loire', 'network': 'Mobigo Saône-et-Loire (71)', 'url': 'https://transport.data.gouv.fr/resources/84073/download', 'bounds': [46.1, 3.55, 47.05, 5.55]},
    # Première tranche urbaine BFC : les archives courantes sont résolues depuis l'API publique data.gouv,
    # avec une ressource connue en repli. Elles seront publiées seulement après les tests réels moteur.
    {'id': 'divia-dijon', 'network': 'DiviaMobilités Dijon', 'dataset': 'gtfs-diviamobilites',
     'url': 'https://transport.data.gouv.fr/resources/80742/download', 'bounds': [47.24, 4.96, 47.39, 5.12]},
    {'id': 'ginko-besancon', 'network': 'Ginko Besançon',
     'dataset': 'gtfs-et-siri-du-reseau-ginko-besancon-lignes-urbaines-et-periurbaines',
     'url': 'https://transport.data.gouv.fr/resources/80590/download', 'bounds': [47.15, 5.90, 47.32, 6.10]},
    {'id': 'evolity-montbeliard', 'network': 'évolitY Montbéliard',
     'dataset': 'evolity-horaires-theoriques-de-transport-public',
     'url': 'https://transport.data.gouv.fr/resources/81944/download', 'bounds': [47.40, 6.70, 47.60, 6.95]},
    {'id': 'zoom-chalon', 'network': 'Zoom Grand Chalon',
     'dataset': 'reseauzoom-horaires-theoriques',
     'url': 'https://transport.data.gouv.fr/resources/82664/download', 'bounds': [46.74, 4.78, 46.86, 4.92]},
    {'id': 'monrezo-creusot-montceau', 'network': 'MonRéZO Le Creusot–Montceau',
     'dataset': 'arrets-horaires-et-parcours-theoriques-du-reseau-monrezo-cucm-gtfs-1',
     'url': 'https://transport.data.gouv.fr/resources/82999/download', 'bounds': [46.61, 4.30, 46.85, 4.49]},
    {'id': 'leo-auxerre', 'network': 'Léo Auxerre',
     'dataset': 'reseau-de-transports-en-commun-de-la-communaute-dagglomeration-de-lauxerrois',
     'url': 'https://transport.data.gouv.fr/resources/78934/download', 'bounds': [47.76, 3.48, 47.88, 3.64]},
    {'id': 'taneo-nevers', 'network': 'Tanéo Nevers',
     'dataset': 'versions-des-horaires-theoriques-des-lignes-du-reseau-de-bus-au-format-gtfs',
     'url': 'https://transport.data.gouv.fr/resources/81227/download', 'bounds': [46.96, 3.07, 47.06, 3.20]},
    {'id': 'intercom-sens', 'network': 'Intercom Grand Sénonais',
     'dataset': 'horaires-du-reseau-de-bus-intercom-3',
     'url': 'https://transport.data.gouv.fr/resources/81898/download', 'bounds': [48.16, 3.23, 48.23, 3.34]},
    {'id': 'grandole-dole', 'network': 'Grandole Mobilités',
     'dataset': 'reseau-de-transport-du-grand-dole',
     'url': 'https://transport.data.gouv.fr/resources/81254/download', 'bounds': [47.02, 5.42, 47.12, 5.53]},
    {'id': 'cote-bus-beaune', 'network': 'Côte&Bus Beaune',
     'dataset': 'offre-de-transport-de-la-c-a-beaune-cote-sud-gtfs',
     'url': 'https://transport.data.gouv.fr/resources/82660/download', 'bounds': [46.98, 4.78, 47.08, 4.90]},
    {'id': 'moova-vesoul', 'network': 'moova Vesoul',
     'dataset': 'horaires-theoriques-du-reseau-moova-communaute-dagglomeration-de-vesoul-gtfs',
     'url': 'https://transport.data.gouv.fr/resources/81222/download', 'bounds': [47.59, 6.10, 47.68, 6.19]},
    {'id': 'ca-roule-autun', 'network': 'ça roule Autun',
     'dataset': 'arrets-lignes-regulieres-reseau-de-transport-urbain-a-autun',
     'url': 'https://static.data.gouv.fr/resources/arrets-lignes-regulieres-reseau-de-transport-urbain-a-autun/20251030-071946/ligne-a-autun-ca-roule.zip',
     'bounds': [46.90, 4.24, 47.02, 4.39],
     'license': 'ODbL 1.0 + conditions particulières PAN',
     'publisher': 'Communauté de communes du Grand Autunois Morvan'},
    {'id': 'papillon-cosne', 'network': 'Papillon Cosne-Cours-sur-Loire',
     'dataset': 'donnees-du-reseau-de-bus-papillon-a-cosne-cours-sur-loire',
     'url': 'https://transport.data.gouv.fr/resources/83859/download',
     'bounds': [47.36, 2.85, 47.46, 3.00],
     'license': 'Licence Ouverte 2.0',
     'publisher': 'Communauté de communes Cœur de Loire'},
    {'id': 'ecla-lons', 'network': 'ECLA Mobilité Lons-le-Saunier',
     'dataset': 'ecla-lons-agglo-mobilites',
     'url': 'https://transport.data.gouv.fr/resources/ec61df69-830c-4ca7-9d78-9a81c515e9de/download',
     'bounds': [46.63, 5.48, 46.72, 5.64],
     'license': 'Licence Ouverte 2.0',
     'publisher': 'CA ECLA (Espace Communautaire Lons Agglomération)'},
    # Archive intégrale volontairement conservée sans modification. Le GTFS mélange lignes urbaines,
    # suburbaines et scolaires : son ajout à makeProviders attend l'inspection des lignes et un filtre
    # testé afin de ne jamais proposer une desserte scolaire comme service public ordinaire.
    {'id': 'optymo-belfort', 'network': 'Optymo Territoire de Belfort',
     'dataset': 'arrets-circuits-et-horaires-du-reseau-optymo-de-belfort',
     'url': 'https://transport.data.gouv.fr/resources/79374/download',
     'bounds': [47.40, 6.80, 47.80, 7.15],
     'license': 'ODbL 1.0 + conditions particulières PAN',
     'publisher': 'Optymo - Belfort / SM des transports en commun du Territoire-de-Belfort'},
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
    {'id': 'start-thonon', 'network': "Star't Thonon", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/7cbb883b-d0cb-4bc7-b2e0-7537afdbc86e', 'bounds': [46.25, 6.3, 46.45, 6.65]},
]
# Un flux agrégé peut contenir de nombreux opérateurs. On le télécharge une seule fois puis
# on produit un ZIP autonome par agence. Ferries exclus (route_type=4), conformément au périmètre.
BUNDLED_AGENCY_FEEDS = [{
    'dataset': 'base-de-donnees-multimodale-des-reseaux-de-transport-public-normands',
    'url': 'https://transport.data.gouv.fr/resources/81942/download',
    'download_limit': 80 * 1024 * 1024,
    'exclude_route_types': ['4'],
    'license': 'Licence Ouverte 2.0',
    'publisher': 'Syndicat mixte Atoumod',
    'networks': [
        {'id': 'atoumod-altobus-alencon', 'network': 'Altobus Alençon', 'agency_name': "Altobus (Communauté Urbaine d'Alençon)"},
        {'id': 'atoumod-tiva-vire-noireau', 'network': 'Tiva Vire au Noireau', 'agency_name': 'Tiva (Intercom de la Vire au Noireau)'},
        {'id': 'atoumod-argentanbus', 'network': 'ArgentanBus', 'agency_name': 'ArgentanBus (Argentan Intercom)'},
        {'id': 'atoumod-astrobus-lisieux', 'network': 'Astrobus Lisieux', 'agency_name': 'Astrobus (Lisieux Normandie)'},
        {'id': 'atoumod-bagnoles', 'network': 'Bagnoles de l’Orne', 'agency_name': "Bagnoles de l'Orne"},
        {'id': 'atoumod-ibus-bernay', 'network': 'I’BUS Bernay', 'agency_name': "I'BUS (Intercom Bernay Terres de Normandie)"},
        {'id': 'atoumod-bybus-bayeux', 'network': 'Bybus Bayeux', 'agency_name': 'Bybus (Bayeux Intercom)'},
        {'id': 'atoumod-cosibus-coutances', 'network': 'Cosibus Coutances', 'agency_name': 'Cosibus (Coutances Mer et Bocage)'},
        {'id': 'atoumod-deep-mob-dieppe', 'network': 'Deep Mob Dieppe', 'agency_name': 'Deep Mob (Dieppe-Maritime)'},
        {'id': 'atoumod-ficibus-fecamp', 'network': 'Ficibus Fécamp', 'agency_name': 'Ficibus (Fécamp Caux Littoral)'},
        {'id': 'atoumod-hobus-honfleur', 'network': 'Hobus Honfleur', 'agency_name': 'Hobus (Honfleur)'},
        {'id': 'atoumod-le-bus-pont-audemer', 'network': 'Le Bus Pont-Audemer', 'agency_name': 'Le Bus (Pont-Audemer/Val de Risle)'},
        {'id': 'atoumod-lia-le-havre', 'network': 'LiA Le Havre', 'agency_name': 'LiA (Le Havre Seine Métropole)'},
        {'id': 'atoumod-navette-pontorson', 'network': 'Navette Pontorson–Mont-Saint-Michel', 'agency_name': 'Navette Pontorson - Le Mont St Michel'},
        {'id': 'atoumod-nemus-flers', 'network': 'Némus Flers', 'agency_name': 'Némus (Flers Agglo)'},
        {'id': 'atoumod-neva-granville', 'network': 'Néva Granville', 'agency_name': 'Néva (Granville Terre et Mer)'},
        {'id': 'atoumod-rezobus-caux-seine', 'network': 'Rézo’Bus Caux Seine', 'agency_name': "Rézo'Bus (Bolbec, Lillebonne, Port-Jérôme, Caux Seine Agglo)"},
        {'id': 'atoumod-semo-seine-eure', 'network': 'Semo Seine-Eure', 'agency_name': 'Semo (Val-de-Reuil, Louviers, Seine Eure Agglo)'},
        {'id': 'atoumod-slam-saint-lo', 'network': 'SLAM Saint-Lô', 'agency_name': 'SLAM (Saint-Lô Agglo)'},
        {'id': 'atoumod-nomad-train', 'network': 'Nomad Train Normandie', 'agency_name': 'Nomad Train (SNCF, Région Normandie)'},
        {'id': 'atoumod-sngo-vernon', 'network': 'SN’go Vernon–Les Andelys', 'agency_name': "SN'go! (Vernon, Les Andelys, Seine Normandie Agglo)"},
        {'id': 'atoumod-astuce-rouen', 'network': 'Astuce Rouen', 'agency_name': 'Astuce (Métropole Rouen Normandie)'},
        {'id': 'atoumod-transurbain-evreux', 'network': 'Transurbain Évreux', 'agency_name': 'Transurbain (Evreux Portes de Normandie)'},
        {'id': 'atoumod-twisto-caen', 'network': 'Twisto Caen', 'agency_name': 'Twisto (Caen la mer)'},
        {'id': 'atoumod-vikibus-yvetot', 'network': 'Vikibus Yvetot', 'agency_name': 'Vikibus (Yvetot Normandie)'},
        {'id': 'atoumod-cap-cotentin', 'network': 'Cap Cotentin', 'agency_name': 'Cap Cotentin (Cherbourg, Agglo. du Cotentin)'},
        {'id': 'atoumod-nomad-car', 'network': 'Nomad Car Normandie', 'agency_name': 'Nomad Car (Région Normandie)'},
        {'id': 'atoumod-moca-caux-austreberthe', 'network': 'MOCA Caux-Austreberthe', 'agency_name': 'MOCA (Communauté de Communes Caux Austreberthe)'},
    ],
}, {
    'dataset': 'arrets-itineraires-et-horaires-theoriques-des-reseaux-de-transport-des-membres-de-jvmalin',
    'url': 'https://transport.data.gouv.fr/resources/83521/download',
    'download_limit': 60 * 1024 * 1024,
    'exclude_route_types': [],
    'license': 'ODbL 1.0 + conditions particulières PAN', 'allow_mobile_sharding': True,
    'publisher': 'JVMALIN / Région Centre-Val de Loire et autorités organisatrices partenaires',
    'networks': [
        {'id': 'jvmalin-amelys-montargis', 'network': 'Amelys Montargis', 'agency_name': 'Amelys', 'agency_pattern': 'amelys'},
        {'id': 'jvmalin-azalys-blois', 'network': 'Azalys Blois', 'agency_name': 'Azalys', 'agency_pattern': 'azalys'},
        {'id': 'jvmalin-agglobus-bourges', 'network': 'Agglobus Bourges', 'agency_name': 'Agglobus', 'agency_pattern': 'agglobus'},
        {'id': 'jvmalin-fil-bleu-tours', 'network': 'Fil Bleu Tours', 'agency_name': 'Fil Bleu', 'agency_pattern': 'fil ?bleu'},
        {'id': 'jvmalin-filibus-chartres', 'network': 'Filibus Chartres', 'agency_name': 'Filibus', 'agency_pattern': 'filibus'},
        {'id': 'jvmalin-horizon-chateauroux', 'network': 'HORIZON Châteauroux', 'agency_name': 'HORIZON', 'agency_pattern': 'horizon'},
        {'id': 'jvmalin-linead-dreux', 'network': 'Linéad Dreux', 'agency_name': 'Linéad', 'agency_pattern': 'linead'},
        {'id': 'jvmalin-vib-vierzon', 'network': "Le VIB Vierzon", 'agency_name': 'Le VIB', 'agency_pattern': '\\bvib\\b'},
        {'id': 'jvmalin-move-vendomois', 'network': 'MOVE Vendômois', 'agency_name': 'MOVE', 'agency_pattern': '\\bmove\\b'},
        {'id': 'jvmalin-nosbus-nogent', 'network': 'Nosbus Nogent-le-Rotrou', 'agency_name': 'Nosbus', 'agency_pattern': 'nosbus'},
        {'id': 'jvmalin-remi-18', 'network': 'Rémi Car 18', 'agency_name': 'Rémi 18', 'agency_pattern': 'remi.*18'},
        {'id': 'jvmalin-remi-28', 'network': 'Rémi Car 28', 'agency_name': 'Rémi 28', 'agency_pattern': 'remi.*28'},
        {'id': 'jvmalin-remi-36', 'network': 'Rémi Car 36', 'agency_name': 'Rémi 36', 'agency_pattern': 'remi.*36'},
        {'id': 'jvmalin-remi-37', 'network': 'Rémi Car 37', 'agency_name': 'Rémi 37', 'agency_pattern': 'remi.*37'},
        {'id': 'jvmalin-remi-41', 'network': 'Rémi Car 41', 'agency_name': 'Rémi 41', 'agency_pattern': 'remi.*41'},
        {'id': 'jvmalin-remi-45', 'network': 'Rémi Car 45', 'agency_name': 'Rémi 45', 'agency_pattern': 'remi.*45'},
        {'id': 'jvmalin-tao-orleans', 'network': 'TAO Orléans', 'agency_name': 'TAO', 'agency_pattern': '\\btao\\b'},
        {'id': 'jvmalin-tigr-issoudun', 'network': 'TIG+R Issoudun', 'agency_name': 'TIG+R', 'agency_pattern': 'tig.*r|issoudun'},
        {'id': 'jvmalin-le-bus-amboise', 'network': 'Le Bus Amboise', 'agency_name': 'Le Bus', 'agency_pattern': 'amboise|le bus'},
    ],
}]
REQUIRED = ['agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt']


def norm(text):
    return unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().lower()


def download(url, limit=400 * 1024 * 1024):
    req = urllib.request.Request(url, headers=UA)
    path = None
    try:
        with urllib.request.urlopen(req, timeout=120) as r, tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
            path = tmp.name
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                tmp.write(chunk)
                if tmp.tell() > limit:
                    raise SystemExit('Archive trop volumineuse : ' + url)
        return path
    except BaseException:
        if path:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
        raise


def select_dataset_gtfs_url(meta, fallback, required_keywords=()):
    """Select an explicitly identified GTFS ZIP, never a newer NeTEx ZIP."""
    resources = []
    for item in meta.get('resources', []):
        url = str(item.get('url') or '')
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
            continue
        fmt = str(item.get('format') or '').lower()
        if parsed.path.lower().endswith('.zip') or fmt in ('gtfs', 'zip'):
            resources.append(item)
    gtfs = []
    for item in resources:
        evidence = ' '.join(str(item.get(k) or '') for k in ('format', 'title', 'name', 'url')).lower()
        if ('gtfs' in evidence and 'netex' not in evidence and
                all(str(keyword).lower() in evidence for keyword in required_keywords)):
            gtfs.append(item)
    gtfs.sort(key=lambda x: str(x.get('last_modified') or ''), reverse=True)
    return (gtfs[0].get('url') if gtfs and gtfs[0].get('url') else fallback)


def current_dataset_zip(slug, fallback, required_keywords=()):
    """Adresse de la ressource GTFS la plus récente d'un jeu data.gouv.fr ; repli stable."""
    try:
        api = 'https://www.data.gouv.fr/api/1/datasets/%s/' % slug
        with urllib.request.urlopen(urllib.request.Request(api, headers=UA), timeout=90) as r:
            meta = json.load(r)
        return select_dataset_gtfs_url(meta, fallback, required_keywords)
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


def table_paths(z, name):
    """Return matching GTFS table paths at root or under a single packaging directory."""
    return [p for p in z.namelist() if not p.endswith('/') and
            p.replace('\\\\', '/').rsplit('/', 1)[-1].lower() == name.lower()]


def read_table(z, name):
    matches = table_paths(z, name)
    if not matches:
        return None, []
    if len(matches) != 1:
        raise ValueError('table GTFS ambiguë : ' + name)
    with z.open(matches[0]) as s:
        reader = csv.DictReader(io.TextIOWrapper(s, encoding='utf-8-sig', newline=''))
        return reader.fieldnames, list(reader)


def stop_bounds(z):
    """Emprise réelle issue des coordonnées GTFS, utile aux flux miroir sans bbox manuelle."""
    _, stops = read_table(z, 'stops.txt')
    points = []
    for stop in stops:
        try:
            lat, lon = float(stop.get('stop_lat') or 'nan'), float(stop.get('stop_lon') or 'nan')
        except ValueError:
            continue
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            points.append((lat, lon))
    if not points:
        raise ValueError('aucun arrêt avec coordonnées GPS valides')
    # Arrondir vers l'extérieur : un arrondi au plus proche pouvait repousser un point valide de < 0,5 m.
    return [math.floor(min(p[0] for p in points) * 1_000_000) / 1_000_000,
            math.floor(min(p[1] for p in points) * 1_000_000) / 1_000_000,
            math.ceil(max(p[0] for p in points) * 1_000_000) / 1_000_000,
            math.ceil(max(p[1] for p in points) * 1_000_000) / 1_000_000]


def write_table(out, name, fields, rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator='\n', extrasaction='ignore')
    w.writeheader()
    w.writerows(rows)
    out.writestr(name, buf.getvalue())


def validate(z):
    missing = [t for t in REQUIRED if not table_paths(z, t)]
    ambiguous = [t for t in REQUIRED if len(table_paths(z, t)) > 1]
    if missing:
        raise ValueError('tables manquantes : ' + ', '.join(missing))
    if ambiguous:
        raise ValueError('tables GTFS ambiguës : ' + ', '.join(ambiguous))
    calendars = [t for t in ('calendar.txt', 'calendar_dates.txt') if table_paths(z, t)]
    if not calendars:
        raise ValueError('calendrier absent')
    if any(len(table_paths(z, t)) > 1 for t in calendars):
        raise ValueError('tables calendrier GTFS ambiguës')
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


def extract(z, spec, allow_oversize=False):
    pat = re.compile(spec['pattern'])
    afields, agencies = read_table(z, 'agency.txt')
    keep_ag = [a for a in agencies if pat.search(norm(a.get('agency_name'))) or pat.search(norm(a.get('agency_id')))]
    if not keep_ag:
        return None, 'aucune agence correspondante'
    ag_ids = {a.get('agency_id') or '' for a in keep_ag}
    single = len(agencies) == 1
    rfields, routes = read_table(z, 'routes.txt')
    routes = [r for r in routes if (r.get('agency_id') or '') in ag_ids or (single and not r.get('agency_id'))]
    excluded_route_types = {str(route_type) for route_type in spec.get('exclude_route_types', ())}
    if excluded_route_types:
        routes = [r for r in routes if str(r.get('route_type') or '') not in excluded_route_types]
    excluded_route_patterns = [re.compile(norm(pattern)) for pattern in spec.get('exclude_route_patterns', ())]
    if excluded_route_patterns:
        routes = [r for r in routes if not any(pattern.search(norm(' '.join(
            r.get(field) or '' for field in ('route_id', 'route_short_name', 'route_long_name'))))
            for pattern in excluded_route_patterns)]
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
    if len(data) > MAX_OUT and not allow_oversize:
        return None, 'extrait trop volumineux (%d octets)' % len(data)
    return data, {'agencies': [a.get('agency_name') for a in keep_ag], 'routes': len(routes), 'trips': len(trips), 'stops': len(stops), 'fares': bool(ff)}



def archive_needs_sharding(data):
    """True si une archive dépasserait les limites standard du chargeur mobile."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        entries = [item for item in z.infolist() if not item.is_dir()]
        return (sum(item.file_size for item in entries) > 128 * 1024 * 1024 or
                any(item.file_size > 64 * 1024 * 1024 for item in entries))


def iter_gtfs_shards(data, target_stop_times_bytes=35 * 1024 * 1024):
    """Émet des archives GTFS complètes par groupes de courses, sans scinder une course."""
    with zipfile.ZipFile(io.BytesIO(data)) as source:
        af, agencies = read_table(source, 'agency.txt')
        rf, routes = read_table(source, 'routes.txt')
        tf, trips = read_table(source, 'trips.txt')
        sf, stops = read_table(source, 'stops.txt')
        stf, times = read_table(source, 'stop_times.txt')
        if not trips or not times:
            raise ValueError('aucune course à segmenter')
        route_by_id = {row['route_id']: row for row in routes}
        trip_by_id = {row['trip_id']: row for row in trips}
        times_by_trip = {}
        for row in times:
            times_by_trip.setdefault(row['trip_id'], []).append(row)
        stop_by_id = {row['stop_id']: row for row in stops}
        parent_ids = {stop_by_id[row['stop_id']].get('parent_station')
                      for rows in times_by_trip.values() for row in rows
                      if row.get('stop_id') in stop_by_id and stop_by_id[row['stop_id']].get('parent_station')}
        stop_ids_by_trip = {trip_id: {row.get('stop_id') for row in rows}
                            for trip_id, rows in times_by_trip.items()}
        # Regroupe d'abord les courses entières ; les tables de référence sont répliquées par fragment.
        chunks, current, size = [], [], 0
        for trip in trips:
            trip_id = trip.get('trip_id')
            rows = times_by_trip.get(trip_id, [])
            row_size = sum(len((',' .join(str(row.get(field) or '') for field in stf) + '\\n').encode('utf-8')) for row in rows)
            if current and size + row_size > target_stop_times_bytes:
                chunks.append(current); current, size = [], 0
            current.append(trip_id); size += row_size
        if current:
            chunks.append(current)
        _, calendars = {}, {}
        calendar_tables = {}
        for cal in ('calendar.txt', 'calendar_dates.txt'):
            fields, rows = read_table(source, cal)
            if fields:
                calendar_tables[cal] = (fields, rows)
        ff, fares = read_table(source, 'fare_attributes.txt')
        fare_rules_fields, fare_rules = read_table(source, 'fare_rules.txt')
        feed_fields, feed_rows = read_table(source, 'feed_info.txt')
        for trip_ids in chunks:
            trip_set = set(trip_ids)
            trip_rows = [trip_by_id[trip_id] for trip_id in trip_ids if trip_id in trip_by_id]
            route_ids = {row.get('route_id') for row in trip_rows}
            service_ids = {row.get('service_id') for row in trip_rows}
            shard_times = [row for trip_id in trip_ids for row in times_by_trip.get(trip_id, [])]
            shard_stop_ids = {row.get('stop_id') for row in shard_times}
            shard_parents = {stop_by_id[sid].get('parent_station') for sid in shard_stop_ids
                             if sid in stop_by_id and stop_by_id[sid].get('parent_station')}
            shard_stops = [row for row in stops if row.get('stop_id') in shard_stop_ids | shard_parents]
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as out:
                write_table(out, 'agency.txt', af, agencies)
                write_table(out, 'routes.txt', rf, [row for row in routes if row.get('route_id') in route_ids])
                write_table(out, 'trips.txt', tf, trip_rows)
                write_table(out, 'stop_times.txt', stf, shard_times)
                write_table(out, 'stops.txt', sf, shard_stops)
                for cal, (fields, rows) in calendar_tables.items():
                    write_table(out, cal, fields, [row for row in rows if row.get('service_id') in service_ids])
                if feed_fields:
                    write_table(out, 'feed_info.txt', feed_fields, feed_rows)
                if ff:
                    relevant_rules = [row for row in (fare_rules or []) if not row.get('route_id') or row.get('route_id') in route_ids]
                    fare_ids = {row.get('fare_id') for row in relevant_rules}
                    relevant_fares = [row for row in fares if row.get('fare_id') in fare_ids]
                    if fare_rules_fields:
                        write_table(out, 'fare_rules.txt', fare_rules_fields, relevant_rules)
                    write_table(out, 'fare_attributes.txt', ff, relevant_fares or fares)
            shard = buf.getvalue()
            with zipfile.ZipFile(io.BytesIO(shard)) as check:
                validate(check)
                expanded = sum(item.file_size for item in check.infolist() if not item.is_dir())
                largest = max((item.file_size for item in check.infolist() if not item.is_dir()), default=0)
            if expanded > 128 * 1024 * 1024 or largest > 64 * 1024 * 1024 or len(shard) > MAX_OUT:
                raise ValueError('fragment GTFS toujours supérieur aux limites du chargeur')
            yield shard, {'trips': len(trip_rows), 'stop_times': len(shard_times),
                          'routes': len(route_ids), 'stops': len(shard_stops)}



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

    excluded_stop_ids = set(spec.get('exclude_stop_ids', ()))

    def in_bounds(s):
        if s.get('stop_id') in excluded_stop_ids:
            return False
        try:
            lat, lon = float(s.get('stop_lat') or 'nan'), float(s.get('stop_lon') or 'nan')
        except ValueError:
            return False
        return lat_min <= lat <= lat_max and lon_min <= lon <= lon_max
    in_zone = {s['stop_id'] for s in stops if in_bounds(s)}
    if not in_zone:
        return None, 'aucun arrêt dans la zone géographique'
    stfields, times = read_table(z, 'stop_times.txt')
    by_trip = {}
    for t in times:
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
                origin = current_dataset_zip(spec['dataset'], spec['url'], spec.get('resource_keywords', [])) if spec.get('dataset') else spec['url']
                p = download(origin, spec.get('download_limit', MAX_OUT))
                with zipfile.ZipFile(p) as z:
                    if spec.get('agency_pattern'):
                        data, info = extract(z, {'pattern': spec['agency_pattern'],
                                                 'exclude_route_patterns': spec.get('exclude_route_patterns', []),
                                                 'exclude_route_types': spec.get('exclude_route_types', [])})
                        if data is None:
                            raise ValueError(info)
                        with zipfile.ZipFile(io.BytesIO(data)) as extracted:
                            validate(extracted)
                            bounds = stop_bounds(extracted) if spec.get('derive_bounds') else spec.get('bounds')
                    else:
                        trips, times = validate(z)
                        bounds = stop_bounds(z) if spec.get('derive_bounds') else spec['bounds']
                        data = open(p, 'rb').read()
                        info = {'trips': trips}
                name = spec['id'] + '.zip'
                with open(os.path.join(args.out, name), 'wb') as f:
                    f.write(data)
                manifest['networks'][spec['id']] = {'network': spec['network'], 'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
                                                    'bytes': len(data), 'bounds': bounds, 'origin': origin, **info,
                                                    **{key: spec[key] for key in ('license', 'publisher') if spec.get(key)}}
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
                                                    'bytes': len(data), 'origin': spec['url'], **info,
                                                    **{key: spec[key] for key in ('license', 'publisher') if spec.get(key)}}
            except BaseException as e:
                manifest['errors'][spec['id']] = 'erreur : %s' % e
        # Les agrégats multi-opérateurs (ex. Atoumod) sont téléchargés une fois sur disque,
        # puis extraits agence par agence. Une seule archive d'agence reste en mémoire à la fois.
        for bundle in BUNDLED_AGENCY_FEEDS:
            source_path = None
            try:
                origin = current_dataset_zip(bundle['dataset'], bundle['url'])
                source_path = download(origin, bundle.get('download_limit', 80 * 1024 * 1024))
                with zipfile.ZipFile(source_path) as source_zip:
                    for agency in bundle['networks']:
                        spec = {'pattern': agency.get('agency_pattern') or re.escape(norm(agency['agency_name'])),
                                'exclude_route_types': bundle.get('exclude_route_types', [])}
                        try:
                            data, info = extract(source_zip, spec, allow_oversize=bool(bundle.get('allow_mobile_sharding')))
                            if data is None:
                                manifest['errors'][agency['id']] = info
                                continue
                            with zipfile.ZipFile(io.BytesIO(data)) as extracted:
                                trips, stop_times = validate(extracted)
                                bounds = stop_bounds(extracted)
                            if bundle.get('allow_mobile_sharding') and archive_needs_sharding(data):
                                shard_iter = iter_gtfs_shards(data)
                                shard_files, shard_hashes, total_bytes = [], [], 0
                                for part, (shard_data, shard_info) in enumerate(shard_iter, 1):
                                    name = '%s-part-%02d.zip' % (agency['id'], part)
                                    with open(os.path.join(args.out, name), 'wb') as output:
                                        output.write(shard_data)
                                    shard_files.append(name); shard_hashes.append(hashlib.sha256(shard_data).hexdigest())
                                    total_bytes += len(shard_data)
                                    del shard_data
                                if not shard_files:
                                    raise ValueError('le découpage n’a produit aucun fragment')
                                entry = {'network': agency['network'], 'file': shard_files[0], 'files': shard_files,
                                         'sha256': shard_hashes[0], 'sha256_files': shard_hashes,
                                         'bytes': total_bytes, 'bounds': bounds, 'origin': origin,
                                         'routes': info['routes'], 'trips': trips, 'stop_times': stop_times,
                                         'stops': info['stops'], 'agencies': info['agencies'], 'fares': info['fares'],
                                         'license': bundle['license'], 'publisher': bundle['publisher'],
                                         'sharded': True}
                            else:
                                name = agency['id'] + '.zip'
                                with open(os.path.join(args.out, name), 'wb') as output:
                                    output.write(data)
                                entry = {'network': agency['network'], 'file': name,
                                         'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                                         'bounds': bounds, 'origin': origin,
                                         'routes': info['routes'], 'trips': trips, 'stop_times': stop_times,
                                         'stops': info['stops'], 'agencies': info['agencies'],
                                         'fares': info['fares'], 'license': bundle['license'],
                                         'publisher': bundle['publisher']}
                            manifest['networks'][agency['id']] = entry
                            del data
                        except Exception as e:  # échec isolé : poursuivre les autres agences
                            manifest['errors'][agency['id']] = 'erreur : %s' % e
            except Exception as e:
                for agency in bundle['networks']:
                    manifest['errors'][agency['id']] = 'erreur agrégat %s : %s' % (bundle['dataset'], e)
            finally:
                if source_path:
                    try:
                        os.unlink(source_path)
                    except FileNotFoundError:
                        pass
    with open(os.path.join(args.out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(json.dumps({'networks': list(manifest['networks']), 'errors': manifest['errors']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
