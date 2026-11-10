# Agrégat Oùra : couverture AURA — source officielle (10 novembre 2026)

## Source vérifiée
- Catalogue officiel : https://transport.data.gouv.fr/datasets/agregat-oura?locale=fr
- Publication GTFS : 09/11/2026 ; période annoncée 09/11/2026–30/06/2028.
- **44 réseaux partenaires** ayant accepté la publication dans l'agrégat. Ce chiffre décrit le catalogue, **pas** la couverture de Convoyage Ultra.
- 543 avertissements de validation publiés : contrôler chaque arrêt, trajet et date avant de marquer un service confirmé.

## Réseaux prioritaires présents dans le catalogue
- AMBERIEU-EN-BUGEY – Tam ; ANNEMASSE – TAC ; BONNEVILLE – Proxim iTi ; RUMILLY – J'YBUS ; VALSERHONE – Mobi'Vals.
- CHAMBERY – Synchro ; BOURG-EN-BRESSE – Rubis ; THONON LES BAINS – STAR'T ; EVIAN – EVA'D.
- Cars Région Ain, Haute Savoie, Isère, Savoie et Express ; AIX-LES-BAINS – Ondéa ; ALBERTVILLE – TRA Mobilité ; CHAMONIX – Chamonix Bus.

## Divergence de métadonnées constatée le 10/11/2026
- Une nouvelle consultation de la fiche officielle https://transport.data.gouv.fr/datasets/agregat-oura?locale=fr affiche **29/10/2026–30/06/2028**, une dernière modification au **30/10/2026** et **550 avertissements**, alors que l'audit précédent consignait **09/11/2026** et **543 avertissements**.
- Ces chiffres ne doivent pas être fusionnés ni considérés comme décrivant la même version : la ressource et sa fiche peuvent évoluer ou être servies avec des états différents. La fiche observée le 10/11 ne démontre pas que l'archive précédemment décrite est erronée.
- Pour l'exploitation, relever l'URL téléchargée, l'empreinte SHA-256, la date d'observation et les dates de service **à partir du ZIP effectivement traité**, avant d'annoncer une couverture à une date de mission.
- Les périodes par réseau mentionnées plus bas restent des **observations documentaires non vérifiées dans l'archive**.

## Taille et limites de la ressource
- La fiche officielle de la ressource 78904 indique une archive **GTFS de 106,07 Mo**. Prévoir un traitement en flux ou en fichiers temporaires, sans charger toute l'archive en mémoire du navigateur Android.
- Le catalogue affiche **44 réseaux partenaires** ; la liste de couverture par réseau de la ressource est à contrôler séparément, car présence dans le catalogue et présence de courses à une date donnée sont deux critères différents.
- Le nombre d'avertissements de validation peut changer d'une publication à l'autre ; conserver l'identifiant et la date de l'archive analysée.

## Dates de service par réseau — vérification indispensable
- **Proxim iTi Bonneville : du 29/03/2027 au 12/12/2027 dans la ressource GTFS consultée.** Pour une mission en novembre 2026, la présence du réseau dans l'agrégat ne prouve **aucune course utilisable** ; rechercher un flux local couvrant la date, sans fabriquer de trajet.
- **Cars Région Express : 09/11/2026–07/02/2027** ; **Synchro Chambéry : 09/11/2026–20/12/2026** ; **STAR’T Thonon : 09/11/2026–20/12/2026** ; **TAM Ambérieu : 09/11/2026–31/12/2026**.
- **J’ybus Rumilly : 09/11/2026–03/07/2027** ; **TAC Annemasse : 09/11/2026–31/12/2027** ; **Rubis Bourg : 09/11/2026–31/12/2027**.
- Ces périodes décrivent les dates couvertes par le GTFS, non la preuve d'un service à chaque jour/heure. Contrôler `calendar` et `calendar_dates`.
- Source détaillée par réseau : https://transport.data.gouv.fr/resources/78904?issue_type=Slow&locale=fr

## Contrôle du contenu tarifaire et des correspondances
- La fiche technique de la ressource 78904 indique **aucune donnée tarifaire GTFS** : `fare_attributes.txt`, `fare_rules.txt`, `fare_products.txt` et `fare_media.txt` sont absents. L'agrégat ne peut donc pas fournir, à lui seul, les prix demandés.
- `transfers.txt` est présent (35 709 enregistrements dans la version décrite), mais ces correspondances ne prouvent ni leur faisabilité à une heure donnée ni la marche depuis une adresse exacte.
- Inventaire publié sur la fiche technique : 1 910 lignes et 30 609 arrêts dans la version décrite. Ces valeurs ne représentent **pas** la couverture fonctionnelle de l'application.
- Source : https://transport.data.gouv.fr/resources/78904?locale=fr&page=2 ; dates de service : https://transport.data.gouv.fr/resources/78904?issue_type=Slow&locale=fr

## Limites et stratégie d'intégration
1. Télécharger l'archive officielle, conserver URL, date et empreinte SHA-256 ; ne jamais confondre sa période de validité avec celle d'un trajet.
2. Inventorier `agency.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `stops.txt`, `calendar.txt` et `calendar_dates.txt` ; identifier les doublons avec les flux GTFS par réseau déjà branchés.
3. Vérifier la couverture réelle des lignes, les coordonnées GPS, les dates et la direction ; conserver les correspondances piétonnes et le calcul à l'adresse exacte.
4. **Ne pas déclarer un tarif confirmé à partir du seul GTFS** : confronter chaque trajet daté aux preuves tarifaires officielles, y compris abonnements, correspondances et exceptions.
5. Aucun nouveau résultat n'est visible dans les fiches Missions tant que les contrôles de bout en bout n'ont pas été réalisés.

## Statut
Source officielle **identifiée**, archive **non téléchargée ni auditée** dans ce travail, réseau **non raccordé** à l'application. Aucun taux de couverture fiable ne peut être calculé à partir du nombre 44.
