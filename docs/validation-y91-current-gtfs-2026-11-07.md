# Validation GTFS Y91 — 7 novembre 2026

Source contrôlée :

```
https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA
```

Le téléchargement valide du 7 novembre contient :

- éditeur : Région Auvergne-Rhône-Alpes ;
- version de flux : `20261028` ;
- couverture déclarée : du 28 octobre 2026 au 31 août 2027 ;
- route : `HAUTExSAVOIE:Line:1007022:LOC` ;
- ligne : `Y91` ;
- libellé : Thonon-les-Bains > Morzine > Les Gets.

Cette présence confirme que la Y91 modifiée est fournie dans le flux régional courant. Elle ne prouve pas, à elle seule, chaque course d'une date donnée, l'absence de perturbation ni une liste des différences avec la version antérieure.

Un deuxième téléchargement du même endpoint a retourné une archive incomplète : il n'a pas été exploité. Aucune valeur de tarif ni calendrier ancien n'a été reconduit. Aucun changement d'application, déploiement, fusion, auth, Supabase ou synchronisation de missions.
