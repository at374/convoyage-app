# OTP2 — Couverture nationale à raccorder au graphe AURA–Suisse

Date : 2026-11-16. Sources : catalogue officiel https://transport.data.gouv.fr/datasets?format=GTFS&locale=en et https://transport.data.gouv.fr/datasets?format=GTFS&licence=odc-odbl&locale=en&type=public-transit .

## Candidats identifiés dans le catalogue officiel
| Réseau | Présence GTFS catalogue | Rôle | Tarifs commerciaux |
|---|---|---|---|
| SNCF TGV / Intercités / TER | Oui | Trains et correspondances | Non garantis par GTFS |
| FlixBus / FlixTrain | Oui | Cars longue distance | Non garantis par GTFS |
| BlaBlaCar Bus | Oui | Cars longue distance | Non garantis par GTFS |
| Cars Région Express | Oui | Cars AURA | Non garantis par GTFS |
| Agrégat urbain/interurbain AURA | Oui | Réseaux régionaux | Non garantis par GTFS |
| Sibra Annecy | Catalogue identifié séparément | Approche locale | Non garantis par GTFS |
| SKI Suisse | Catalogue opentransportdata.swiss identifié séparément | Réseau suisse | Non garantis par GTFS |

**Attention :** catalogue identifié ≠ archive téléchargée ≠ validité sur une date ≠ graphe opérationnel ≠ prix vérifié.

## Ordre de construction du graphe
1. Sélectionner les archives valides pour une date test, vérifier la licence et conserver SHA256.
2. Importer un ensemble **sans doublons** : agrégat AURA OU ses flux enfants, selon les courses réellement présentes.
3. Ajouter SNCF et cars longue distance si les calendriers et les licences le permettent.
4. Ajouter la Suisse SKI et contrôler les correspondances transfrontalières.
5. Ajouter OSM couvrant les accès piétons, puis mesurer le graphe et les temps de démarrage.
6. Vérifier les axes Annecy–Genève, Annemasse–Genève, Ambérieu–Lyon, Chambéry–Saint-Julien-en-Genevois, Archamps–Genève.
7. Pour chaque itinéraire, distinguer `horaire_planifié`, `trajet_piéton_vérifié`, `tarif_vérifié` et `réservation_disponible`. **Ne jamais inférer les trois derniers à partir du premier.**

## Blocage prix
- OTP2 = calcul d'itinéraire à partir de données ouvertes.
- SNCF, FlixBus et BlaBlaCar : prix variables, à obtenir via sources de vente ou API autorisées ; ne pas annoncer un accès commercial sans vérification des droits et conditions.
- Si prix indisponible, afficher `Prix non confirmé` et un lien d'achat officiel connu ; ne pas inventer de montant.
- Ne pas confondre les tarifs locaux publiés et un billet commercial disponible pour une date précise.

## État
Aucune archive téléchargée, aucun graphe construit, aucun déploiement Cloud Run dans cette intervention. Le plafond Cloud Run de 5 €/mois n'est pas une garantie de gratuité pour les autres services Google Cloud.
