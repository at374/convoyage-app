# Maintenance des lignes et tarifs — demande du 6 novembre 2026

Une veille ChatGPT quotidienne a été activée pour rechercher les changements significatifs et les sources encore manquantes. Elle compare l’état réel du dépôt aux publications officielles : PAN, horaires et calendriers, sources tarifaires des douze départements AURA, exploitants et Cars Région Express, réseaux locaux, trajets France et Genève/Ain/Haute-Savoie, Suisse jusqu’à Lausanne. Elle peut préparer des corrections sourcées et testées sur une branche, sans fusion ni déploiement automatique. Cette veille n’est pas encore un mécanisme de mise à jour intégré à l’application Android.

À chaque changement : conserver ancienne et nouvelle source, dates de publication/effet, périmètre de lignes, changements de montants/règles et résultats de validation. Une modification d’empreinte PDF/GTFS seule ne prouve pas un changement de prix ou d’horaire. Ne pas déplacer artificiellement les dates d’un ancien calendrier pour le rendre valide.

Le mécanisme embarqué restant à construire doit :

- Vérifier périodiquement les sources et la validité des calendriers ; renouveler les données de lignes et d’arrêts avec contrôles de cohérence.
- Contrôler les dates d’effet, zones, réductions et correspondances avant de remplacer un barème.
- Invalider les références dérivées quand un document source change. Le numériseur Aravis refuse déjà un PDF différent de son empreinte validée.
- Récupérer une offre datée pour les trains, cars à prix variable et covoiturages lors de la recherche du trajet, avec fraîcheur et éventuel cache explicitement définis ; une veille quotidienne n’est pas suffisante pour ces devis.
- Conserver les données précédentes pour comparaison ou consultation dégradée, sans les présenter comme à jour si leur validité est dépassée ou inconnue.
- Exposer clairement ce qui est découvert, raccordé, testé et publié. Un réseau inaccessible ou non couvert ne doit jamais produire un prix de zéro par défaut.

Aucune garantie d’exhaustivité France/Suisse ni actualisation automatique des nouveaux barèmes dans Android n’est établie à ce stade.
