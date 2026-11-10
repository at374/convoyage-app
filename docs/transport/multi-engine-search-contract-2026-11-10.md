# Contrat multi-moteurs — Convoyage Ultra (10 novembre 2026)

## Décision impérative — moteurs uniquement (10/11/2026)
Les **seules sources de résultats** (trajets ET prix) sont les réponses de calculateurs/moteurs de recherche interrogés pour la mission et la date exactes. Ne pas construire de trajet par énumération de lignes GTFS, ni déduire un prix à partir d'une grille PDF, matrice, forfait ou calcul interne. GTFS/NeTEx et PDF peuvent servir uniquement à auditer la couverture ou la qualité des moteurs, jamais à générer un itinéraire ou prix affiché. Les tarifs non renvoyés par un moteur restent « Prix indisponible ». Les offres non disponibles restent inconnues, jamais inventées. L'agrégateur peut normaliser, dédoublonner, classer et vérifier les réponses ; le moteur piéton est lui-même un moteur d'itinéraire. Les prix de moteurs doivent conserver source, date, produit et nature (devis confirmé ou indicatif). Ne pas désactiver de composants existants sans audit des dépendances et tests.

## Décision produit
**Ne pas créer manuellement toutes les relations, trajets et prix.** Pour chaque mission, interroger les calculateurs disponibles et agréger leurs résultats. Les GTFS, NeTEx et grilles officielles servent à enrichir et valider les réponses, pas à pré-calculer chaque combinaison de villes.

## Flux cible de la fiche Mission (sans moteur de recherche visible)
1. L'utilisateur ouvre la fiche existante et touche l'icône **Transport** déjà présente.
2. L'application récupère les adresses et coordonnées exactes, la date et l'heure de la mission et les contraintes horaires, sans modifier le mécanisme de synchronisation des missions.
3. Le module Transports existant lance **en parallèle** les calculateurs configurés et autorisés, chacun avec un délai maximal et un statut de réponse. Pas de saisie manuelle d'une requête par l'utilisateur.
4. Chaque réponse est normalisée en étapes (marche, bus, car, train, tram, covoiturage), horaires locaux et fuseaux, arrêts GPS, origine, destination, exploitant, identifiant de course, source et fraîcheur.
5. Fusionner les **vrais doublons** par identité de courses/arrêts/horaires, sans supprimer les alternatives dont les prix, produits, arrêts ou correspondances diffèrent. Garder la provenance de chaque moteur.
6. Calculer l'accès piéton et les correspondances par **routage piéton réel**, pas par distance à vol d'oiseau. Appliquer marge minimale de 15 min et conditions de la mission ; l'arrivée à 5 min n'est pas une marge générale.
7. Pour les prix : afficher d'abord un devis frais retourné par le fournisseur,  sinon **« Prix inconnu »**. Distinguer tarif public, tarif abonné et prix total ; jamais d'estimation présentée comme vérifiée.
8. Afficher tous les itinéraires exploitables, les cartes et les prix visibles, tri **moins cher / compromis / plus rapide**. Afficher séparément les itinéraires dont l'horaire, l'accès ou le prix n'est pas confirmé ; ne jamais les éliminer silencieusement.
9. Si un fournisseur échoue, le statut est **« Source indisponible / couverture partielle »** et non « aucun trajet ». Rechercher les autres moteurs et conserver leurs résultats.
10. Préserver la présentation Android existante, l'icône Transport et les favoris. Aucune acceptation automatique de mission.

## Familles de moteurs à orchestrer

| Famille | Rôle | Limite à conserver |
|---|---|---|
| TripGo | calcul multimodal, trains, cars, bus, marche, correspondances et partenaires FlixBus/BlaBlaCar lorsqu'ils sont effectivement renvoyés | un fournisseur absent de TripGo n'est pas couvert ; prix éventuellement indicatif |
| SNCF / TER / Oùra | compléter les lignes et horaires régionaux ; sources GTFS/NeTEx et, quand accessible, temps réel | GTFS n'est ni devis tarifaire ni preuve temps réel |
| Réseaux locaux AURA | Sibra, TCL, Grenoble, Synchro, Proxim iTi, cars régionaux, petites lignes | utiliser les calculateurs/APIs officiels disponibles ; ne pas inventer une API |
| TPG / Léman Pass | Genève, tram, bus et lignes transfrontalières | zone, produit et conditions doivent correspondre |
| Suisse | calculateur suisse déjà raccordé, GTFS SKI et éventuellement OJP officiel avec autorisation | pas de clé OJP ni de tarif CFF inventés |
| Longue distance | FlixBus, BlaBlaCar Bus et covoiturage via fournisseurs effectivement accessibles | offres, disponibilité et prix nécessitent un devis frais |
| Marche | moteur de routage piéton pour accès et correspondances | les distances directes ne valident pas l'approche |

## Mesures de couverture, sans faux 100 %
- **Couverture des moteurs** : nombre de moteurs réellement interrogés / nombre de moteurs applicables.
- **Couverture des itinéraires** : nombre de solutions renvoyées et nombre avec horaires, arrêts et approche vérifiés.
- **Couverture des prix** : nombre de solutions avec devis/grille applicable vérifiés / nombre de solutions renvoyées.
- **Fraîcheur** : date de dernière réponse par moteur ; erreur et délai de chaque source.
- Ne jamais utiliser le nombre de réseaux du catalogue Oùra comme pourcentage de trajets couverts.

## Travail restant avant production
Auditer le code de l'orchestrateur et des adaptateurs réels ; combler les moteurs non appelés, les erreurs silencieuses, le routage piéton et la qualification des prix. Tester en priorité Annecy, Rumilly, Ambérieu–Lyon, Chambéry, Annemasse, Saint-Julien-en-Genevois, Archamps et Genève. Ne modifier ni synchronisation des missions, ni authentification, ni Supabase ; pas de fusion/déploiement sans validation.
