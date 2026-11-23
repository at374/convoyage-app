# Vérification ciblée des lignes bloquant les prix — 23 novembre 2026

## Ondéa Grand Lac 419 et 102

- Ligne **419** : Mont Blanc (Place Montillet, Entrelacs) ↔ Chambéry Gare Routière, via Aix-les-Bains, Viviers-du-Lac et Sonnaz. Source officielle : https://www.ondeagrandlac.fr/itineraires/horaires-des-lignes/ligne-bus-419
- Ligne **102** : Lycée Marlioz ↔ Collège Garibaldi / Saintinaix, via Aix-les-Bains et Brison-Saint-Innocent. Source officielle : https://www.ondeagrandlac.fr/itineraires/horaires-des-lignes/ligne-bus-102
- Les deux lignes figurent dans les lignes de proximité/scolaires du réseau. Le prix **1 voyage** publié pour les bus Ondéa ne prouve pas, à lui seul, son applicabilité à ces lignes particulières : https://www.ondeagrandlac.fr/tarifs/choisir-son-titre
- **Décision** : ne pas généraliser automatiquement le tarif urbain 1,70 € aux lignes 102 et 419. Chercher les conditions de vente propres à ces lignes avant tout raccordement.

## Cars Région Haute-Savoie 274

- Ligne **274** : Sallanches ↔ Genève, via notamment Fillinges ; grille **transfrontalière par zone** et distinction Parcours / Parcours + zone 10. Source officielle : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_horaires_274_rentree_2026-nouvel-horaire.pdf
- Le transporteur confirme la validité de la grille jusqu'au **12 décembre 2026**, et précise qu'un trajet transfrontalier doit être couvert par un titre unique adapté à l'ensemble du déplacement : https://jacquet-autocars.com/ligne-274/
- **Décision** : pas de prix forfaitaire unique sur toute la ligne 274. Vérifier communes/arrêts d'origine et destination, zone 10 et date avant attribution.


## Complément vérifié : support du billet Ondéa (23 novembre 2026)

- Le site officiel distingue **le prix** et **le support** : le M-Ticket/QR code n'est pas accepté dans les cars affectés à certaines lignes scolaires, dont les **400 à 419**. Source : https://www.ondeagrandlac.fr/acheter-son-titre-sur-internet
- La vente à bord est explicitement annoncée **dans les cars sur les lignes de transports scolaires**, auprès du conducteur, avec préparation de monnaie. Source : https://www.ondeagrandlac.fr/tarifs/vente-bord
- La page « Titres pour tous » affiche le **titre 1 voyage à bord à 1,70 €** à compter du 1er juillet 2026. Source : https://www.ondeagrandlac.fr/tarifs/choisir-son-titre
- Le réseau propose également une carte **Pass Ondéa avec 10 voyages pour 14,50 €**, utilisable sur les lignes scolaires ; les versions QR/M-Ticket du même produit ne le sont pas. Source : https://www.ondeagrandlac.fr/titres/titres-pour-tous-tarifs-applicables-du-1er-juillet-2026/titre-10-voyages
- **Décision d'intégration** : ne pas utiliser le prix M-Ticket comme billet disponible sur la 419 ; vérifier le titre conducteur applicable à la course et les conditions d'accès du public avant de faire évoluer le moteur. Ne pas diviser automatiquement un carnet de 10 voyages pour présenter 1,45 € comme prix d'achat d'un billet unique.

## Règle d'intégration

Une ligne identifiée dans le diagnostic n'est **pas** une preuve de tarif. N'attribuer un prix qu'après vérification du produit, du périmètre géographique, de la période de validité et de l'éligibilité au trajet. Sinon : « Prix à confirmer », rentabilité masquée.

Cette note documente la recherche ; elle **n'ajoute aucun tarif** et ne revendique aucune hausse de couverture.

## Contrôle complémentaire : éligibilité des courses scolaires

Le site officiel Ondéa classe les **lignes 100 à 108** (dont 102) et **400 à 419** (dont 419) parmi les lignes de proximité qui circulent **en période scolaire uniquement**, en direction des établissements scolaires : https://www.ondeagrandlac.fr/services/bus

Le plan 2026 et les fiches horaires permettent de retrouver les arrêts, mais **ne suffisent pas à démontrer qu'un convoyeur adulte sans statut scolaire peut emprunter chaque course**. La documentation officielle distingue en outre les supports de titres acceptés : https://www.ondeagrandlac.fr/nos-points-de-vente

**Règle produit :** avant de marquer une proposition « réalisable » ou de lui affecter un prix, vérifier séparément (1) que le service circule le jour demandé, (2) que la course est ouverte au public visé, (3) que le support de titre est accepté, (4) que le tarif est applicable. En l'absence de preuve, conserver « Conditions d'accès / prix à confirmer » et masquer la rentabilité.

## Confirmation officielle : accès des adultes aux lignes de proximité Ondéa

La page officielle https://www.ondeagrandlac.fr/services/decouvrez-loffre-du-reseau-ondea-grand-lac indique explicitement que les lignes de proximité **100 à 511 sont accessibles à toute personne munie d'un titre de transport valide**, même si elles ne circulent **qu'en période scolaire**. Cela inclut les lignes 102 et 419. Le statut de convoyeur adulte n'est donc pas, à lui seul, un obstacle d'accès.

La vente d'un titre unitaire auprès du conducteur est explicitement prévue dans les cars des lignes scolaires : https://www.ondeagrandlac.fr/tarifs/vente-bord . La gamme officielle au 1er juillet 2026 affiche **1,70 €** pour le titre 1 voyage à bord : https://www.ondeagrandlac.fr/titres/titres-pour-tous-tarifs-applicables-du-1er-juillet-2026 .

**Conséquence :** ne pas bloquer une course 102/419 pour le seul motif « ligne scolaire » ; conserver les contrôles GTFS du calendrier, des arrêts, de l'horaire et des correspondances. Ne pas présenter le QR/M-Ticket comme utilisable sur les cars scolaires. Le tarif de 1,70 € ne rend pas une course réalisable si celle-ci ne circule pas.
