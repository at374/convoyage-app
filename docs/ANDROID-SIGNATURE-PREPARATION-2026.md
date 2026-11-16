# Préparation Android — Convoyage Ultra (16 novembre 2026)

## État vérifié
- Le dépôt `main` est une application web statique (index.html, manifest.webmanifest, service worker et JavaScript).
- Aucun projet Gradle Android ni fichier Capacitor n'est présent à la racine de `main`.
- Les workflows existants vérifient les transports et l'interface mobile dans un navigateur ; ils ne produisent pas d'APK signé.
- La présence des secrets GitHub Actions n'est pas vérifiable via la connexion GitHub actuelle.

## Secrets à créer dans GitHub Actions
Dans **Settings → Secrets and variables → Actions**, créer :
- `ANDROID_KEYSTORE_BASE64` : contenu encodé en Base64 du keystore (ne jamais committer).
- `ANDROID_KEYSTORE_PASSWORD` : mot de passe du magasin.
- `ANDROID_KEY_ALIAS` : alias de la clé.
- `ANDROID_KEY_PASSWORD` : mot de passe de la clé.

Ne jamais mettre les valeurs dans les fichiers suivis par Git, les logs ou les artefacts. Le document transmis contenant un mot de passe en clair ne doit pas être ajouté au dépôt.

## Prérequis avant compilation
1. Choisir et valider l'identifiant de package Android immuable (applicationId).
2. Déterminer si un paquet Android existe déjà et quel certificat signe ses versions précédentes. Une nouvelle clé non compatible empêcherait une mise à jour directe.
3. Préparer le conteneur Android (Capacitor ou autre, choix à valider) sans modifier les moteurs de transport ni la synchronisation des missions.
4. Construire un APK **debug non signé pour distribution** et tester sur appareil réel : connexion, permissions, cartes, géolocalisation, ouverture des liens SNCF/FlixBus/BlaBlaCar, retour à l'application, marche et fonctionnement hors ligne.
5. Ajouter ensuite une compilation release manuelle utilisant uniquement les quatre secrets ci-dessus, avec contrôles de présence sans afficher les valeurs ; signer via Gradle et vérifier le certificat avec `apksigner verify --print-certs`.
6. Conserver l'APK comme artefact privé, sans publication ni déploiement automatique ; demander l'accord explicite avant distribution.

## Sécurité
- Ne jamais décompresser ou imprimer le keystore dans un journal.
- Restreindre les jobs de signature aux déclenchements manuels et aux branches autorisées ; ne pas signer sur les pull requests externes.
- Nettoyer le fichier keystore temporaire à la fin du job, y compris en cas d'échec.
- Si la clé n'a jamais servi à publier l'application, envisager de la remplacer car ses mots de passe ont circulé en clair. Si elle a déjà servi, vérifier d'abord les conséquences sur les mises à jour et le mécanisme de signature Play App Signing.

## Module transports
L'intégration Android ne doit pas masquer les limitations de disponibilité des tarifs : un horaire GTFS n'est pas un prix de billet. Conserver l'état « tarif non confirmé » lorsqu'aucune source commerciale vérifiée n'existe. Les cartes des missions doivent conserver les trajets piétons et plusieurs propositions automatiques.
