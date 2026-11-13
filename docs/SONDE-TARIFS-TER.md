# Sonde des tarifs SNCF (serveur)

## tarifs-ter-aura
- erreur : <HTTPError 404: 'Not Found'>

## tarifs-ter-par-od
- erreur : <HTTPError 404: 'Not Found'>

## tarifs-intercites
- titre : Tarifs Intercités
- modifié : 2025-12-26T22:19:05+00:00
- données traitées : 2025-12-26T22:19:05+00:00
- licence : Open Database License (ODbL)
- lignes : 2559
- description : <p>Prix plein tarif des trains Intercités de jour et de nuit en vigueur à partir du 02/01/2026. </p>  <p>Une fourchette de prix (prix minimum, prix maximum) est affichée pour chaque origine-destination et classe tarifaire.</p>  <p>Les CGV de l'ensemble des tarifs sont accessibles à <a href="https://www.sncf-voyageurs.com/fr/voyagez-avec-nous/en-france/tarifs-grandes-lignes/conditions-generales-de-vente/" target="_blank">cette page</a>.</p>
- champs : transporteur (Transporteur), origine (Gare origine), origine_uic8 (Gare origine - code UIC), destination (Gare destination), destination_uic8 (Gare destination - code UIC), classe (Classe), profil_tarifaire (Profil tarifaire), type_place (Type de place), prix_min (Prix minimum), prix_max (Prix maximum)
```json
[]
```

## tarifs-tgv-inoui-ouigo
- titre : Tarifs TGV INOUI et OUIGO
- modifié : 2026-03-17T09:50:01+00:00
- données traitées : 2026-03-17T09:50:01+00:00
- licence : Open Database License (ODbL)
- lignes : 36349
- description : <p>Prix plein tarif des trains TGV INOUI et OUIGO.</p> <p>Une fourchette de prix (prix minimum, prix maximum) est affichée pour chaque origine-destination et classe tarifaire.</p> <p> Les prix des trains TGV INOUI sont en vigueur à partir du 01/04/2026 et ceux des trains OUIGO à partir du 02/01/2026.</p><p> </p><p> Les CGV TGV INOUI sont accessibles au lien suivant<span style="font-family: inherit; font-size: 0.875rem;"> : </span><a 255);"="" 255,="" ;="" background-color:="" href="https://www.sncf-voyageurs.com/fr/voyagez-avec-nous/en-france/tarifs-grandes-lignes/conditions-generales-de-vente
- champs : transporteur (Transporteur), gare_origine (Gare origine), gare_origine_code_uic (Gare origine - code UIC), gare_destination (Gare destination), gare_destination_code_uic (Gare destination - code UIC), classe (Classe), profil_tarifaire (Profil tarifaire), prix_minimum (Prix minimum), prix_maximum (Prix maximum)
```json
[
 {
  "transporteur": "TGV INOUI",
  "gare_origine": "LA ROCHE SUR FORON",
  "gare_origine_code_uic": "87746305",
  "gare_destination": "ANNECY",
  "gare_destination_code_uic": "87746008",
  "classe": "1",
  "profil_tarifaire": "Tarif Avantage",
  "prix_minimum": 4.2,
  "prix_maximum": 11.9
 },
 {
  "transporteur": "TGV INOUI",
  "gare_origine": "GROISY THORENS LA CAILLE",
  "gare_origine_code_uic": "87746248",
  "gare_destination": "ANNECY",
  "gare_destination_code_uic": "87746008",
  "classe": "1",
  "profil_tarifaire": "Tarif Normal",
  "prix_minimum": 7.4,
  "prix_maximum": 12.3
 },
 {
  "transporteur": "TGV INOUI",
  "gare_origine": "ANNECY",
  "gare_origine_code_uic": "87746008",
  "gare_destination": "AIX LES BAINS - LE REVARD",
  "gare_destination_code_uic": "87741132",
  "classe": "1",
  "profil_tarifaire": "Tarif Elève - Etudiant - Apprenti",
  "prix_minimum": 15.0,
  "prix_maximum": 15.0
 },
 {
  "transporteur": "TGV INOUI",
  "gare_origine": "CHAMBERY CHALLES LES EAUX",
  "gare_origine_code_uic": "87741009",
  "gare_destination": "ANNECY",
  "gare_destination_code_uic": "87746008",
  "classe": "1",
  "profil_tarifaire": "Tarif Avantage",
  "prix_minimum": 4.9,
  "prix_maximum": 16.0
 },
 {
  "transporteur": "TGV INOUI",
  "gare_origine": "CLUSES  74",
  "gare_origine_code_uic": "87746370",
  "gare_destination": "ANNECY",
  "gare_destination_code_uic": "87746008",
  "classe": "1",
  "profil_tarifaire": "Tarif Avantage",
  "prix_minimum": 5.6,
  "prix_maximum": 16.5
 }
]
```
