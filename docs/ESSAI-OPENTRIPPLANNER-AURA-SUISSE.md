# Essai OpenTripPlanner 2 — Convoyage Ultra (AURA + Grand Genève)

Statut : **étude / essai à effectuer**, pas un moteur branché en production.

## Pourquoi
TripGo nécessite un accès API entreprise non disponible. OpenTripPlanner (OTP) est un moteur libre auto-hébergeable, mais ne fournit pas à lui seul les prix commerciaux SNCF, BlaBlaCar ou FlixBus. Les fichiers GTFS sont des horaires programmés et non des garanties de disponibilité ou de correspondance.

## Critères de validation avant intégration
1. Construire un graphe de test OTP à partir d'un extrait cohérent OpenStreetMap et de GTFS officiels AURA + Suisse. Contrôler les licences, dates de validité, identifiants d'arrêts, fuseaux horaires et la mémoire nécessaire.
2. Interroger le moteur avec les coordonnées exactes de départ et d'arrivée, les dates et heures de mission, en récupérant plusieurs itinéraires et chaque segment (marche, attente, transport, correspondance).
3. Comparer avec les moteurs existants sur les axes Ambérieu-en-Bugey ↔ Lyon, Chambéry ↔ Saint-Julien-en-Genevois, Annecy ↔ Genève, Annecy ↔ Annemasse et Archamps. Mesurer la présence de trajets, le nombre de correspondances, les horaires et les parcours piétons.
4. Ne jamais afficher « Réalisable » sur la seule base d'OTP : valider la marche à l'adresse exacte, la marge d'avance, les horaires, les correspondances et la fraîcheur des données. Sans preuve suffisante : « Transport non confirmé ».
5. Rattacher les tarifs seulement via les grilles officielles déjà intégrées ou un fournisseur commercial autorisé. Si aucun prix vérifié n'existe : « Prix à confirmer » et lien officiel de réservation, jamais un tarif inventé.
6. Tester l'interface Android : plusieurs cartes automatiques dans la fiche mission, prix visible ou explicitement inconnu, tri « Moins cher / Compromis / Plus rapide », carte du trajet et segments piétons. Aucun champ de recherche manuel imposé.
7. Évaluer consommation RAM/CPU, taille du graphe, fréquence de mise à jour, latence et coût d'hébergement **avant** tout déploiement. Ne créer aucun service payant sans accord.

## Conditions de sortie
- Un serveur OTP de test accessible, version fixée et jeux de données documentés.
- Des résultats reproductibles sur les cinq corridors, avec captures de réponse ou fixtures et comparaison avec le moteur existant.
- Un adaptateur isolé et désactivé par défaut jusqu'à la validation des tests.
- Aucune substitution aux GTFS, OJP et moteurs déjà raccordés ; aucun changement automatique de l'APK.

## Blocages connus
- L'accès à un logiciel libre ne garantit pas l'accès aux tarifs de billetterie ni à toutes les données temps réel.
- Une couverture GTFS incomplète peut masquer des bus ou des correspondances.
- Les itinéraires transfrontaliers nécessitent une fusion fiable des arrêts et calendriers français et suisses.
