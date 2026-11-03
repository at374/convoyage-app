# Y51 : même référence tarifaire dans les deux blocs Agenda — 31/10/2026

## Corrections fonctionnelles

Le bloc historique « Vérifier les courses officielles Y51 » cherchait le mot Annecy dans le nom/description/code de la gare. L’arrêt officiel de l’export s’appelle simplement « Gare Routiere », sans ville en description ; cela pouvait masquer les courses existantes. La gare est désormais aussi identifiée par son identifiant épinglé, son secteur Annecy et ses coordonnées, avec la même tolérance de 50 m que le catalogue tarifaire. Aucun nom de gare générique d’une autre ville n’est accepté par ce rapprochement.

Les trajets du bloc historique reçoivent désormais le même barème Y51 daté que les propositions du worker GTFS. `CPTY51Fares.fromImportedTables` vérifie la provenance déclarée de l’export, son horodatage, la ligne Y51, le calendrier actif, la course, les arrêts, les heures et les séquences exactes de la proposition. Il reconstruit une preuve bornée de tous les arrêts intermédiaires et la passe au calculateur de références existant. Le convertisseur horaire GTFS existant est réutilisé côté page, avec Europe/Paris et les heures au-delà de minuit ; aucun décalage UTC fixe n’est ajouté.

La référence garde les réserves du lot précédent : barème du 01/03/2026 consulté le 31/10, à revérifier avant achat, plein tarif hors abonnement, aucun total de correspondances ni prix actuel garanti. Si le module est indisponible, la course inactive ou les données altérées, la référence reste absente et les horaires ne sont pas effacés. Le fichier historique conserve sa date réelle de contrôle du 30/10/2026 ; le raccordement ne le fait pas passer pour un nouveau téléchargement de l’exploitant.

Le navigateur a également reproduit une mise à jour SIBRA quotidienne après fermeture de la fiche : l’élément restait dans le DOM, donc `isConnected` seul ne suffisait pas. Les callbacks du bloc quotidien exigent désormais que la fiche et le panneau soient encore actifs, visibles et liés au bouton courant, avant modification ou insertion. Cela couvre la réponse principale, la recherche d’Aller et les retours d’erreur. Les créneaux régionaux et leurs annulations restent inchangés.

## Vérifications

- 206 tests JavaScript + 2 Python réussis localement ; syntaxe et diff vérifiés.
- Nouveaux tests : course officielle enregistrée École Saint-François → Annecy le 02/11/2026 à 11 h 48, référence 8,90 €, gare sans mot Annecy dans le nom, coordonnées déplacées/identifiant étranger, export d’un autre fournisseur, horodatage futur, séquence ou heure modifiée, calendrier inactif et bibliothèque horaire absente.
- Chromium 156, viewport Pixel 7 : déclaration d’une livraison prévue, fermeture de la fiche, bouton historique de l’Agenda, départ 11 h 48 → arrivée 13 h 15 et référence 8,90 € présents. Cet essai relit l’export officiel enregistré localement ; il ne confirme pas la circulation actuelle ou l’approche depuis une mission réelle. Les autres scénarios utilisent leurs fixtures annoncées.
- La régression de fermeture retarde volontairement une réponse quotidienne SIBRA, ferme la fiche, libère la réponse et attend la fin de lecture avant de vérifier que le contenu masqué n’a pas changé. Les scénarios GTFS, SNCF, TripGo, cartes et pass SIBRA restent inclus.
- Les contrôles GitHub sont suivis séparément dans la PR. Android physique non testé. Aucun déploiement, fusion, achat ou changement Supabase/authentification/synchronisation.
