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

## Limites et stratégie d'intégration
1. Télécharger l'archive officielle, conserver URL, date et empreinte SHA-256 ; ne jamais confondre sa période de validité avec celle d'un trajet.
2. Inventorier `agency.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `stops.txt`, `calendar.txt` et `calendar_dates.txt` ; identifier les doublons avec les flux GTFS par réseau déjà branchés.
3. Vérifier la couverture réelle des lignes, les coordonnées GPS, les dates et la direction ; conserver les correspondances piétonnes et le calcul à l'adresse exacte.
4. **Ne pas déclarer un tarif confirmé à partir du seul GTFS** : confronter chaque trajet daté aux preuves tarifaires officielles, y compris abonnements, correspondances et exceptions.
5. Aucun nouveau résultat n'est visible dans les fiches Missions tant que les contrôles de bout en bout n'ont pas été réalisés.

## Statut
Source officielle **identifiée**, archive **non téléchargée ni auditée** dans ce travail, réseau **non raccordé** à l'application. Aucun taux de couverture fiable ne peut être calculé à partir du nombre 44.
