# Référence tarifaire Savoie — contrôle du 6 novembre 2026

La page régionale distingue les lignes périurbaines S01 à S07 des lignes touristiques S10 à S83 : https://www.laregionvoustransporte.fr/cars-region/cars-region-de-la-savoie/infos-et-services-cars-region-de-la-savoie/titres-et-tarifs-de-savoie/.

Sa fiche PDF liée, datée du 1er mars 2026, publie un billet simple à 3,40 € : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_savoie_tarifs_mars_2026.pdf. Le lecteur de références Cars Région reprend ce montant uniquement pour le réseau GTFS `oura-savoie-regular` et les lignes S01 à S07. Dans le flux actuellement contrôlé, cela concerne S01, S03, S04, S05 et S07. S10, S11 et S12 présents dans ce même fichier ne reçoivent pas ce montant.

La page affiche aussi un tarif SMS de 3,30 € adulte et 1,70 € moins de 26 ans, sous conditions d’opérateur mobile et de forfait. Le périmètre SMS indiqué diffère : S01, S02, S04, S05, S07, S11, S12. Ne pas prendre automatiquement 3,30 € comme prix standard de toutes les lignes ni en déduire un changement chronologique de tarif. L’écart entre publications/canaux doit être confirmé avant un devis définitif.

Les références affichées gardent `fareVerified: false` et `totalEUR: null` : abonnements, correspondances, validité à la date du trajet et canal d’achat restent à vérifier. Aucun prix périurbain n’est transféré au réseau touristique.

Les contrôles ciblés exécutent le lecteur réel sur les cinq lignes périurbaines présentes et vérifient l’exclusion des autres lignes et du réseau touristique. Un test de régression est ajouté à la suite GitHub ; le scénario navigateur et les suites complètes du nouveau commit restent à contrôler. Aucun déploiement effectué.
