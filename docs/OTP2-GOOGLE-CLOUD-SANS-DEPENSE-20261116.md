# OTP2 sur Google Cloud — plan sans dépense autorisée (16/11/2026)

## Décision et limites
- Projet existant : `convoyage-ultra`, région Cloud Run `europe-west9`.
- Service existant **à ne pas modifier** : `convoyage-transports-pilote`.
- Capture utilisateur : la console Cloud Run montre un choix mémoire avec **512 Mio surlignés** ; ce n'est **pas** la preuve d'une configuration OTP2 ni d'un budget disponible.
- Aucun accès Google Cloud direct depuis cette session ChatGPT ; aucun déploiement, coût ou URL OTP2 confirmés.
- **Aucune création de VM, Cloud Run, stockage, registre, tâche de build ou facturation sans approbation explicite.**
- `min-instances=0` ne garantit PAS la gratuité ; un conteneur de 8 Gio peut consommer le quota gratuit rapidement. Les crédits d'essai ne constituent pas un hébergement gratuit permanent.

## Architecture envisagée (non déployée)
1. Construire le graphe OTP2 **hors du service de production** avec un conteneur Java et les flux GTFS officiels AURA et Suisse + OSM couvrant le périmètre (incluant les correspondances frontalières).
2. Valider les licences, le calendrier GTFS, la couverture des arrêts et la taille du graphe ; enregistrer la provenance et la date de chaque archive.
3. Charger le graphe au démarrage du conteneur OTP2. Sur Cloud Run, le système de fichiers local est éphémère : **ne pas compter sur un graphe construit au démarrage et conservé sur disque**. Un graphe préconstruit embarqué dans l'image peut être volumineux et allonger le démarrage.
4. Avant tout déploiement, mesurer RAM de construction et de service, durée de démarrage, taille d'image, coût des builds, registre, stockage, trafic et temps CPU. Tester l'adéquation aux limites de démarrage Cloud Run. Si les chiffres ne conviennent pas, arrêter ; ne pas créer le service.
5. Après approbation des coûts : nouveau service distinct `convoyage-otp2`, min 0, max 1, accès HTTPS contrôlé ; ne jamais écraser `convoyage-transports-pilote`.
6. Vérifier le schéma GraphQL **sur la version réellement choisie** avant d'activer le client ; l'adaptateur actuel attend `data.plan.itineraries[].legs[]` et `startTime/endTime`. Une API `planConnection.edges[].node` exige une adaptation explicite et des tests de fixtures réelles.
7. Valider de bout en bout Annecy–Genève, Annemasse–Genève, Ambérieu–Lyon, Chambéry–Saint-Julien-en-Genevois et Archamps, avec marche réelle et marge mission.

## Critères de réussite
- Endpoint HTTPS répondant à une requête GraphQL vérifiée ; URL fournie **uniquement après** test réel.
- GTFS AURA + Suisse et OSM réellement chargés ; itinéraires vérifiés sur plusieurs dates.
- Horaires programmés clairement distingués des données temps réel.
- Prix inconnus signalés ; **OTP2 ne remplace pas les prix commerciaux SNCF, BlaBlaCar et FlixBus**.
- Aucun moteur de recherche manuel sur la fiche mission ; cartes automatiques et classement conservés.
- Journal des coûts et plafond/budget validés avant activation.

## Informations à récupérer dans la console avant autorisation
- Facturation : état de l'essai, crédits restants, alertes et éventuels budgets.
- Cloud Run : CPU/RAM/instances du service existant **en lecture seule**.
- Compute Engine : existence éventuelle d'une VM déjà payée avec RAM suffisante (réutilisation possible uniquement après vérification de son rôle).
- Mesure de mémoire du graphe AURA+Suisse : **inconnue** ; 8 Gio est une hypothèse, pas une garantie.

## Transmission à Claude
Les modules OTP2 ont été fusionnés sur `feature/transports-aura-suisse` d'après la transmission de Claude. Avant tout nouveau changement, lire le HEAD distant et vérifier les tests. Ne pas présenter l'architecture ci-dessus comme déployée. Priorité immédiate : corriger la compatibilité GraphQL sur une version OTP2 figée et documenter une construction reproductible à partir de sources officielles.
