# Île-de-France Mobilités : flux complet et limite mobile — 7 novembre 2026

## Vérification actuelle

La ressource GTFS officielle consolidée d'Île-de-France Mobilités est publiée sur le Point d'Accès National :

- page : <https://transport.data.gouv.fr/datasets/reseau-urbain-et-interurbain-dile-de-france-mobilites> ;
- archive : <https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip> ;
- contrôle consulté le 7 novembre 2026 : **110,24 Mo**, période **3 novembre au 5 décembre 2026**, dernière modification de contenu **6 novembre 2026** ;
- périmètre annoncé : bus, tramway, métro, funiculaire, gondole et rail, 2 027 lignes, 35 490 arrêts et 15 408 zones d'arrêt.

Le portail producteur indique une fenêtre d'environ trente jours et trois mises à jour quotidiennes. Les adaptations travaux ne sont pas homogènes selon les modes : les trains et métros incluent des adaptations connues, tandis que les bus et tramways RATP peuvent ne pas inclure les adaptations travaux. Les accès sont explicitement décrits comme encore imparfaits.

## Décision de raccordement

Le chargeur GTFS Android de Convoyage Ultra fixe une limite de **20 MiB** par archive et de 128 MiB après extraction. Le GTFS IDFM consolidé est donc **découvert et vérifié comme existant, mais non raccordé directement** : le télécharger outrepasserait la limite de données définie pour l'application et son extraction dépasserait probablement le budget mémoire.

Le sous-flux officiel SNCF Transilien est distinct, environ 10 Mo au contrôle du 7 novembre. Il est raccordé dans la PR #207 uniquement pour des recherches à l'intérieur de son enveloppe Île-de-France. Il ne couvre ni métro, ni tram, ni bus franciliens complets.

Aucun prix n'est déduit de ces GTFS. Le tarif, les zones, les correspondances et la circulation restent non confirmés ; un devis ou calculateur IDFM frais par trajet/date reste nécessaire. Aucun compte, jeton, service payant ni appel à un calculateur tiers n'a été activé.

## Suite sûre

Un raccordement complet nécessite soit des flux officiels IDFM séparés par réseau sous les limites mobiles, soit un index pré-calculé et renouvelé hors appareil avec contrôle de fraîcheur. Cette note ne constitue pas ce raccordement et ne revendique pas une couverture France ou Île-de-France.
