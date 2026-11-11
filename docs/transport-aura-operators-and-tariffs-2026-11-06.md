# Cars Région AURA : exploitants et barèmes — 6 novembre 2026

## Publications tarifaires structurées

Le fichier `data/transport/cars-region-fare-references-2026-11-06.json` conserve deux publications officielles avec périmètre, date d’effet et produits. Ces références ne sont pas encore raccordées aux prix des trajets dans l’application.

- Ain : la fiche régionale de mars 2026 couvre les lignes A du réseau, indépendamment de l’exploitant. Billet simple 2,30 €, carnet de dix 17 €, mensuel 44,50 €, douze mois 441 € et moins de 26 ans 331 €. Correspondances autorisées sous deux heures ; aller-retour = deux voyages. Les lignes X suivent un régime distinct. Source : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/02/cars_region_ain_tarifs_mars-2026.pdf.
- Haute-Savoie : la fiche regroupant Y13, Y03, Y04, Y81 à Y86 et Y91 à Y94 indique un billet simple adulte à 1,70 €, deux voyages 3,40 €, dix voyages 13,50 € et trente jours 33 €. Les autres lignes nécessitent leurs propres fiches. Les prix réduits publiés doivent être conservés tels quels : calculer arithmétiquement 50 % ne reproduit pas forcément leur arrondi. Source : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_tarifs_MAJ-septembre_2026_Y13-03-04-81-82-83-84-85-86-91-92-93-94.pdf.

Les dates de fin de validité n’étant pas publiées dans ces fiches, aucune validité future n’est inventée. Les frais éventuels de support, conditions d’achat, titres possédés, correspondances et réductions nécessitent une évaluation distincte.

## Premiers exploitants confirmés par des sources primaires

Ce tableau n’est pas un annuaire exhaustif. Une mention d’exploitant ne prouve pas l’attribution actuelle de toutes ses lignes. Les références historiques ne doivent pas remplacer les affectations récentes.

| Département / périmètre | Exploitants explicitement mentionnés | Preuve et portée |
|---|---|---|
| Ain | Régie des Transports de l’Ain, Philibert, Maisavia, Cars du Plateau, Transarc Segui | Page tarifaire régionale actuelle, formulaires des transporteurs : https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lain/infos-et-services-cars-region-de-lain/titres-et-tarifs-de-lain/ |
| Savoie, services décrits par le portail Cars Région Savoie | Transdev Martin, Transdev Savoie Modane, Faure Savoie, Doucy Bus, Voyages Loyet, Alpbus, Trans-Alpes | https://www.cars-region-savoie.fr/conditions-generales-des-transports/ ; cette page précise les secteurs et préfixes de billets, pas l’ensemble des affectations de lignes AURA |
| Haute-Savoie, Y51 | Transdev Bassin Annécien | https://annecy.transdev.com/line/ligne-y51/ |
| Haute-Savoie, Y62/Y63 | Alpbus | https://www.alpbus-mobilites.fr/nouvelle-tarification-ligne-y6263 |
| Haute-Savoie, Y02/Y92/Y93/Y94 | Autocars Jacquet | https://jacquet-autocars.com/ ; lignes affichées sur le site de l’exploitant |
| Autres pistes régionales | SRADDA et services Transaltitude | https://www.sradda.com/lignes-regionales-rhone-alpes.html et https://www.transaltitude.fr/fr/reserver-son-billet/ ; lignes et tarifs spécifiques à contrôler |

Le dépliant Ain de 2025 toujours lié depuis la page actuelle cite aussi Autocars Maisonneuve. Il est historique : ne pas l’assimiler automatiquement à Maisavia ni annoncer une attribution de 2026 à partir de ce seul document.

## Sources officielles par ligne déjà repérées

La page tarifaire de Haute-Savoie lie des fiches séparées Y02, Y21, Y22, Y51, Y62, Y63, 272 et 274, ainsi qu’une fiche commune pour le groupe à 1,70 €. Elle fournit également des cartes de zones. Source : https://www.laregionvoustransporte.fr/cars-region/cars-region-de-haute-savoie/infos-et-services-cars-region-de-haute-savoie/titres-et-tarifs-de-haute-savoie/.

La page Ain distingue A, cinq lignes Express (X25, X33, X36, X37, X38), Mobi’Vals et TAM. Ne pas étendre le tarif des lignes A à ces autres périmètres. Les fiches Express sont accessibles depuis la page régionale.

## Découverte reproductible dans les douze départements

Le script `scripts/discover_aura_fare_documents.py` part de la page Cars Région et récupère les pages départementales et leurs liens PDF. Le site remplit certains boutons par JavaScript : le script reproduit la règle de lien publique du bouton Infos et services, puis suit les liens de tarifs dans un périmètre limité. Les PDF ne sont pas téléchargés par cette commande ; un lien trouvé ne valide ni ses prix ni sa date.

```sh
python scripts/discover_aura_fare_documents.py /tmp/aura-fare-documents.json
```

Le rapport conserve les URLs, libellés, pages de provenance, empreintes des pages et erreurs. Il doit rester explicite sur les documents candidats et les pages non parcourues. Les liens tarifaires sont classés par leur libellé, ce qui peut manquer un document mal nommé. Les exploitants et prix de chaque PDF restent à lire et à rapprocher des lignes GTFS.

## Raccordement restant

Rapprocher les lignes actuelles, leurs exploitants et leurs barèmes, puis tester le prix d’une portion réelle et les correspondances. Ajouter les calculateurs découverts lorsque leur accès et leur périmètre sont validés. Conserver les frais et devises, sans doubler un billet couvrant plusieurs portions. Aucune couverture complète AURA ni livraison de ces nouveaux prix sur Android n’est établie par ce recensement.
