// Génère le projet Android (TWA) de façon NON interactive, à partir de
// android/twa-manifest.json, pour pouvoir tourner dans GitHub Actions sans
// aucune invite clavier (bubblewrap init est 100% interactif et ne peut pas
// être utilisé tel quel en CI — voir docs/TRANSMISSION-CHATGPT-ANDROID-APK.md).
//
// Usage : node generate-twa-project.js
// Doit être lancé depuis le dossier android/ (où se trouve twa-manifest.json).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');

async function main() {
  const dir = __dirname;
  const manifestPath = path.join(dir, 'twa-manifest.json');
  const appDir = path.join(dir, 'app');

  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // TwaManifest attend un objet TwaManifestJson ; on passe par fromFile pour
  // réutiliser exactement la même validation/désérialisation que le CLI.
  const twaManifest = await TwaManifest.fromFile(manifestPath);

  fs.mkdirSync(appDir, { recursive: true });

  const generator = new TwaGenerator();
  const log = new ConsoleLog('generate-twa-project');
  await generator.createTwaProject(appDir, twaManifest, log, (current, total) => {
    console.log(`Génération du projet Android : ${Math.round((current / total) * 100)}%`);
  });

  // twa-manifest.json doit aussi exister DANS appDir pour que `bubblewrap build`
  // (lancé avec --directory=./app) le retrouve, avec un fichier de somme de
  // contrôle correspondant — sinon `build` déclenche une invite interactive.
  const appManifestPath = path.join(appDir, 'twa-manifest.json');
  await twaManifest.saveToFile(appManifestPath);
  const checksum = crypto.createHash('sha1').update(fs.readFileSync(appManifestPath)).digest('hex');
  fs.writeFileSync(path.join(appDir, 'manifest-checksum.txt'), checksum);

  console.log('Projet Android généré dans', appDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
