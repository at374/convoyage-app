# Référentiel TPG : points actifs et historiques, contrôle du 8 novembre 2026

État distant vérifié avant contrôle : PR #208 9a07bb1e0ac95c5ff816ca9ec6308afa8f3cce3d.

Source officielle : https://opendata.tpg.ch/explore/dataset/arrets/
API effectivement interrogée : https://opendata.tpg.ch/api/explore/v2.1/catalog/datasets/arrets/records?where=search%28%22ETOI%22%29&limit=100

Le producteur précise que le jeu inclut les arrêts actifs et inactifs. Réponse réelle : plusieurs lieux contenant Etoile ; ne retenir que le lieu, pays, code et statut vérifiés, pas un simple résultat de recherche plein texte.

Pour Lancy-Pont-Rouge-Gare/Etoile, commune CAROUGE, pays CH, code Didoc 8592679 : points actifs ETOI00 (46.187046, 6.127882), ETOI02 (46.187588, 6.126936), ETOI03 (46.187595, 6.127558), ETOI05 (46.188286, 6.128345), ETOI99 (46.187721, 6.126921). Points ETOI01, ETOI04, ETOI06 et ETOI98 marqués inactifs.

Les deux positions de la ligne 272 dans le GTFS Haute-Savoie contrôlé sont FR:6608:ZE:58821:HAUTExSAVOIE (46.187195, 6.128421) et FR:6608:ZE:58822:HAUTExSAVOIE (46.1871748, 6.1278741). La proximité géographique d'une position active ou inactive ne prouve ni le quai ni la desserte directionnelle. Le code Didoc partagé par plusieurs points n'est pas une identité de quai.

Nouvelle source exploitable pour valider le statut et rapprocher les points ; rattachement de la 272 au poteau provisoire toujours non démontré. Ne pas remplacer automatiquement les coordonnées du GTFS par le premier point actif. Référence enregistrée, aucun raccordement logiciel ni prix ajouté. Auth, Supabase et synchronisation préservés ; aucun déploiement ni fusion.
