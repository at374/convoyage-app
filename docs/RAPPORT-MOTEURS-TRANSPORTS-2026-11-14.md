# Rapport des moteurs Transports AURA + Suisse — 14 novembre 2026

Source : diagnostic serveur réel `diagnostic-transports.yml` du 2026-11-14 20:25 UTC (vraies réponses des fournisseurs, vrai routeur piéton), date de voyage testée : lundi 16/11/2026. Branche `feature/transports-aura-suisse`. Les chiffres ci-dessous ne viennent d'aucune simulation ; les tests simulés (suites `tests/`) et le test navigateur (Chrome, émulation Pixel 7, marches simulées) sont décrits à part dans `TRANSMISSION-CHATGPT-TRANSPORTS-2026.md`. Aucun test sur téléphone Android réel n'a été fait.

## Synthèse

- 23 parcours, 873 trajets affichés : 157 réalisables, 673 en horaire programmé, 43 non confirmés ; 132 trajets impossibles masqués.
- 833 trajets avec marches réelles calculées ; 174 requêtes piétonnes, 0 échec.
- 254 trajets entièrement tarifés par une source officielle ; 72 partiellement.
- Aucun moteur en erreur, aucun réseau attendu absent.

## Statut par moteur

| Moteur | Statut | Précision |
|---|---|---|
| SNCF (horaires : API + tranche GTFS AURA) | Opérationnel et testé sur données réelles | J+31 testé en navigateur sur les archives publiées (hors diagnostic serveur) |
| FlixBus (horaires GTFS) | Opérationnel et testé sur données réelles | J+31 testé en navigateur ; prix : bloqué (accès partenaire) |
| BlaBlaCar Bus (horaires GTFS) | Opérationnel et testé sur données réelles | J+31 testé en navigateur ; prix : clé gratuite à créer |
| Suisse (transport.opendata.ch : CFF, TPG, Léman Express) | Opérationnel et testé sur données réelles | Bateaux exclus ; prix : zone 10 seulement |
| Réseaux locaux par GTFS (Sibra, TAC, TCL, Synchro, Ondéa, J'y bus, TAM, M réso, Star't, Cars Région) | Opérationnel et testé sur données réelles | Sans temps réel : statut « Horaire programmé » |
| Marche à pied (Valhalla, réseau piéton OSM) | Opérationnel et testé sur données réelles | 0 échec ; jamais de distance à vol d'oiseau |
| Cartes des trajets dans les fiches | Développé, testé en navigateur (vue mobile) | Non validé sur téléphone réel |
| Prix SNCF, FlixBus | Bloqué par une restriction externe | Voir blocages |
| Prix BlaBlaCar Bus, CFF hors zone 10 | Partiellement opérationnel | Sources gratuites identifiées, clés à créer |
| TripGo | Bloqué par une restriction externe | Désactivé par défaut (contrat entreprise) |

## Couverture tarifaire par opérateur (portions de trajet, diagnostic réel)

| Opérateur | Portions | Avec prix officiel | Sans prix | Couverture | Remarque |
|---|---|---|---|---|---|
| SNCF | 436 | 3 | 433 | 1 % | Prix non accessible : jeu « Tarifs TER AURA » retiré par SNCF ; billetterie = accès commercial |
| Ondéa Aix-les-Bains | 108 | 70 | 38 | 65 % | Lignes 400–419 hors M-ticket : titre à confirmer |
| TAM Ambérieu | 101 | 101 | 0 | 100 % |  |
| Cars Région Haute-Savoie | 96 | 0 | 96 | 0 % | Grilles 271/272/274 et autres lignes à qualifier (ChatGPT) |
| J'y bus Rumilly | 84 | 84 | 0 | 100 % |  |
| Star't Thonon | 63 | 31 | 32 | 49 % | Zones A/AB/B par couple d’arrêts à qualifier |
| TCL Lyon | 57 | 57 | 0 | 100 % | Tarif publié dans le GTFS officiel (2,10 €) |
| FlixBus | 57 | 0 | 57 | 0 % | Aucun prix public ; billetterie = accès partenaire |
| TAC Annemasse | 51 | 51 | 0 | 100 % |  |
| BlaBlaCar Bus | 48 | 0 | 48 | 0 % | Prix possibles via l’API officielle gratuite sur inscription (clé à créer) |
| Cars Région Ain | 34 | 32 | 2 | 94 % | Grille officielle 2,30 € |
| CFF / SBB | 33 | 9 | 24 | 27 % | Zone 10 Genève : 3,00 CHF ; reste : service de prix opentransportdata.swiss (clé gratuite à créer) |
| TPG | 32 | 12 | 20 | 38 % | Zone 10 Genève : 3,00 CHF ; transfrontalier (Léman Pass) non intégré |
| Cars Région Isère | 24 | 0 | 24 | 0 % | Zones Isère en cours (ChatGPT) |
| M Réso - Métropole Grenobloise | 8 | 8 | 0 | 100 % |  |
| But | 8 | 0 | 8 | 0 % |  |
| Synchro Chambéry | 6 | 6 | 0 | 100 % |  |
| AFO | 3 | 0 | 3 | 0 % |  |
| Cars Région Savoie | 2 | 0 | 2 | 0 % |  |
| Evian | 2 | 0 | 2 | 0 % |  |
| Sibra | 1 | 1 | 0 | 100 % |  |

## Résultats par parcours

| Parcours | Trajets | Réalisables | Horaire programmé | Tarifés | Marches calculées | Impossibles masqués | Durée | Moteurs ayant répondu |
|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 59 | 14 | 45 | 0 | 59 | 0 | 11.1 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse |
| Annemasse → Saint-Julien-en-Genevois | 56 | 12 | 30 | 32 | 42 | 22 | 20.1 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse, TAC Annemasse GTFS |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 19 | 5 | 14 | 0 | 19 | 5 | 3.9 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS |
| Chambéry → Aix-les-Bains | 64 | 5 | 59 | 4 | 64 | 1 | 12.8 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, Cars Région Savoie GTFS, FlixBus GTFS, GTFS lo |
| Grenoble → Crolles | 30 | 12 | 18 | 5 | 30 | 0 | 5.7 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, Cars Région Savoie GTFS, FlixBus GTFS, GTFS lo |
| Rumilly → Annecy | 24 | 6 | 18 | 1 | 24 | 1 | 4.5 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS |
| Thonon-les-Bains → Genève | 10 | 2 | 8 | 0 | 10 | 8 | 5.2 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse |
| Voiron → Grenoble | 39 | 4 | 35 | 0 | 39 | 0 | 9.8 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, FlixBus GTFS, GTFS local, Mobilités M, SNCF, S |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 31 | 1 | 29 | 18 | 30 | 21 | 9.6 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, Cars Région Savoie GTFS, FlixBus GTFS, GTFS lo |
| Thonon → Bons-en-Chablais (Star’t 142) | 59 | 11 | 48 | 6 | 59 | 12 | 19.7 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 56 | 0 | 56 | 56 | 56 | 2 | 11.4 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, FlixBus GTFS, GTFS local, J’y bus Rumilly GTFS |
| Ambérieu gare → Cabrol (TAM 2) | 82 | 0 | 82 | 82 | 82 | 1 | 16.2 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, TAM Ambérieu GTFS |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 19 | 8 | 11 | 0 | 19 | 2 | 4.8 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, Cars Région Savoie GTFS, FlixBus GTFS, GTFS lo |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 18 | 3 | 15 | 1 | 18 | 0 | 6.1 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS |
| Genève → Lausanne | 26 | 8 | 18 | 0 | 26 | 0 | 6.2 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse |
| Annemasse → Genève | 33 | 11 | 20 | 0 | 31 | 0 | 3.9 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse, TAC Annemasse GTFS |
| Saint-Julien-en-Genevois → Genève | 45 | 8 | 37 | 0 | 45 | 10 | 9.1 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse, TAC Annemasse GTFS |
| Archamps → Genève | 9 | 8 | 1 | 5 | 9 | 18 | 6.5 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse, TAC Annemasse GTFS |
| Chambéry → Saint-Julien-en-Genevois | 15 | 12 | 3 | 0 | 15 | 0 | 4.9 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, Suisse |
| Annecy → Chambéry | 39 | 7 | 30 | 0 | 39 | 0 | 2.9 s | BlaBlaCar Bus GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS |
| Lyon → Grenoble | 55 | 7 | 47 | 0 | 55 | 3 | 3.9 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS |
| Lyon Part-Dieu → Bellecour (TCL) | 50 | 1 | 26 | 42 | 27 | 26 | 28.8 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, FlixBus GTFS, GTFS local, SNCF, SNCF GTFS, TCL |
| Voiron → Voreppe (M réso Voironnais) | 35 | 12 | 23 | 2 | 35 | 0 | 3.5 s | BlaBlaCar Bus GTFS, Cars Région Isère GTFS, FlixBus GTFS, GTFS local, Mobilités M, SNCF, S |

## Blocages impossibles à lever sans accès externe

1. **Prix TER / SNCF** : le jeu officiel « Tarifs TER Auvergne-Rhône-Alpes » (prix par origine-destination) a été retiré du portail SNCF (erreur 404 constatée le 14/11/2026) ; les jeux restants sont des fourchettes Intercités/TGV, jamais un prix exact. Billetterie SNCF : accès commercial.
2. **Prix FlixBus** : aucun prix public ; accès partenaire.
3. **Prix BlaBlaCar Bus** : API officielle annoncée gratuite sur inscription — clé à créer par Laurent.
4. **Prix CFF hors zone 10** : service de prix d'opentransportdata.swiss (bêta) — clé gratuite à créer par Laurent.
5. **TripGo** : billets réservés au contrat entreprise.
6. **Temps réel des petits réseaux** (J'y bus, TAM, Ondéa, Star't…) : aucun flux temps réel public ; leurs trajets restent « Horaire programmé ».
