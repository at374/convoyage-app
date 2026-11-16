# Transmission à ChatGPT — générer l'APK Android (TWA) de Convoyage Ultra

**Date : 16/11/2026, 06h50.** Dépôt `at374/convoyage-app`, branche **`feature/android-apk-twa`** (créée depuis `main`, commit `08dff7f`). Laurent a explicitement autorisé un déploiement mobile (TWA Android, pas de store pour l'instant). Objectif : produire un **APK Android installable**, signé, qui encapsule le PWA déjà en ligne (`https://at374.github.io/convoyage-app/`) via la technique **TWA (Trusted Web Activity)** et l'outil officiel Google **Bubblewrap**.

## Pourquoi ce document

Claude a préparé tout le code et la configuration, mais **ne peut pas finir seul**, pour deux raisons précises (pas une question de permission — des limites techniques du bac à sable) :

1. **Réseau** : le bac à sable de Claude bloque `dl.google.com`, `maven.google.com` et `services.gradle.org` (confirmé par des `curl` directs qui échouent en 403 sur le tunnel proxy). Or la construction d'un APK Android a besoin de télécharger le SDK Android, les build-tools et Gradle depuis ces domaines. **Ces domaines sont librement accessibles depuis les runners GitHub Actions** (confirmé par le pattern déjà utilisé pour `diagnostic-transports.yml`) — la solution retenue est donc de faire construire l'APK **par un workflow GitHub Actions**, pas localement.
2. **Secrets GitHub** : l'API `repos/.../actions/secrets/public-key` est explicitement bloquée pour Claude (« Access to this GitHub Actions path is not permitted through this proxy »). Claude ne peut donc pas poser lui-même la clé de signature Android comme secret du dépôt. **Il faut qu'un humain (Laurent) ou un outil ayant un accès `gh`/API non bridé (toi, ChatGPT, si tu en as un) le fasse.**

## Ce qui existe déjà sur la branche `feature/android-apk-twa`

- `android/twa-manifest.json` — configuration TWA (nom de paquet `fr.convoyageultra.app`, host `at374.github.io`, icônes, couleurs, `webManifestUrl` pointant vers le manifest.webmanifest déjà en prod). Champs vérifiés contre le schéma réel de `@bubblewrap/core` (`TwaManifest.d.ts`), pas improvisés.
- `android/package.json` — dépendances `@bubblewrap/cli` et `@bubblewrap/core` en version `1.27.0`.
- `android/generate-twa-project.js` — **script maison, non interactif**, qui génère le projet Gradle Android à partir de `twa-manifest.json`. Nécessaire car `bubblewrap init` est 100 % interactif (aucun flag CLI ne permet de le rendre non-interactif — vérifié en lisant `init.js` du paquet) : ce script appelle directement l'API `TwaManifest`/`TwaGenerator` de `@bubblewrap/core`, écrit le projet dans `android/app/`, puis génère lui-même `manifest-checksum.txt` (sha1 du contenu de `twa-manifest.json`) — sans ce fichier, `bubblewrap build` pose aussi des questions interactives.
- `.github/workflows/build-android-apk.yml` — workflow `workflow_dispatch` (déclenchement manuel, pour ne pas consommer des minutes CI à chaque commit) qui :
  1. installe JDK 17 et le SDK Android (`android-actions/setup-android@v3`),
  2. installe les dépendances npm dans `android/`,
  3. pré-remplit `~/.bubblewrap/config.json` avec les chemins JDK/SDK pour éviter l'assistant interactif de bubblewrap,
  4. décode la clé de signature depuis un secret,
  5. lance `generate-twa-project.js`,
  6. lance `bubblewrap build` **depuis `android/app/`** (important : bubblewrap résout ses chemins par rapport au répertoire courant, pas par rapport à `--directory`),
  7. récupère `app-release-signed.apk` et `app-release-bundle.aab`, les publie comme artefact du run.

## Ce qu'il reste à faire (dans l'ordre)

### 1. Poser les 4 secrets GitHub (bloquant, à faire en premier)

Claude a généré une clé de signature Android réelle (keystore RSA 2048, valide 10 000 jours, alias `convoyage-ultra`) et l'a transmise **directement à Laurent** (fichier `.keystore` + mot de passe), pas via ce document ni via git — une clé de signature ne doit jamais être committée dans un dépôt, surtout public.

Demande à Laurent (ou fais-le toi-même si tu as un accès `gh`/API non restreint à ce dépôt) d'ajouter ces 4 secrets sur **github.com/at374/convoyage-app → Settings → Secrets and variables → Actions → New repository secret** :

| Nom du secret | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le contenu encodé en base64 du fichier `.keystore` que Claude a donné à Laurent |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe donné par Claude à Laurent |
| `ANDROID_KEY_ALIAS` | `convoyage-ultra` |
| `ANDROID_KEY_PASSWORD` | le même mot de passe (store et key password sont identiques, PKCS12 l'impose) |

**Empreinte SHA-256 du certificat** (utile plus tard pour Digital Asset Links / `assetlinks.json`, voir section 3) :
`48:46:91:02:B8:4E:BD:07:DD:E9:30:82:32:05:42:CB:86:87:D7:63:9B:B1:F7:CB:51:3E:7D:D4:CB:4D:53:F4`

### 2. Lancer le workflow et corriger ce qui casse

```
gh workflow run build-android-apk.yml --repo at374/convoyage-app --ref feature/android-apk-twa
gh run watch --repo at374/convoyage-app
```

**Ce workflow n'a jamais été exécuté** (Claude n'a pas pu le tester — SDK Android inaccessible dans son bac à sable). Il a été écrit en lisant le code source exact de `@bubblewrap/cli`/`@bubblewrap/core` (pas par essai-erreur), mais il faut s'attendre à devoir corriger 1 ou 2 détails au premier run réel, notamment :

- `android-actions/setup-android@v3` expose-t-il bien `ANDROID_HOME` ? (sinon utiliser `ANDROID_SDK_ROOT`, qui est quasi toujours défini par cette action — à vérifier dans les logs du run, étape « Préconfigurer Bubblewrap », avant de committer un fix).
- Le premier build Gradle doit télécharger build-tools/platform via `sdkmanager` (`androidSdkTools.installBuildTools()` dans `@bubblewrap/core`) — normal que cette étape prenne plusieurs minutes la première fois.
- Les noms de fichiers de sortie (`app-release-signed.apk`, `app-release-bundle.aab`) sont des constantes du code de `@bubblewrap/cli` (`build.js`) — s'ils diffèrent dans les logs, le fichier a probablement été produit avec zipalign/Gradle mais mal copié ; chercher les `.apk`/`.aab` réels avec `find android -name "*.apk" -o -name "*.aab"` dans les logs avant de modifier l'étape « Rassembler les livrables ».

### 3. Une fois l'APK obtenu

- Télécharger l'artefact du run (`convoyage-ultra-android-apk`), le renvoyer à Laurent pour qu'il l'installe (il devra autoriser « Sources inconnues » sur son téléphone Android — c'est un sideload, pas une app du Play Store).
- **Optionnel, pour la prochaine itération** : publier `https://at374.github.io/convoyage-app/.well-known/assetlinks.json` avec l'empreinte SHA-256 ci-dessus, pour que la TWA s'affiche sans barre d'adresse Chrome (sinon elle fonctionne mais garde une mini barre d'URL visible la première fois). Format standard Google, à générer avec `bubblewrap fingerprint` une fois l'APK signé en main, ou à la main :
  ```json
  [{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "fr.convoyageultra.app",
      "sha256_cert_fingerprints": ["48:46:91:02:B8:4E:BD:07:DD:E9:30:82:32:05:42:CB:86:87:D7:63:9B:B1:F7:CB:51:3E:7D:D4:CB:4D:53:F4"]
    }
  }]
  ```
  Ce fichier va dans le dépôt (`.well-known/assetlinks.json` à la racine, servi par GitHub Pages) et nécessite donc un push sur `main` — à ne faire qu'après validation de Laurent, comme pour le reste.

### Rappel des contraintes de Laurent (inchangées)

Aucun service payant (Bubblewrap + GitHub Actions = gratuit), aucune modification de l'authentification/Supabase/synchronisation des missions, ne pas pousser sur `main` sans l'autorisation explicite de Laurent (l'APK/TWA reste sur `feature/android-apk-twa` tant qu'il n'a pas validé le résultat).
