/* Robot de synchronisation DriiveMe -> Supabase, pour Cloud Run.
 *
 * Même esprit que hiflow-sync.cjs (voir ce fichier pour le contexte général) : jamais de mot de passe
 * tapé « à la main » ici au sens d'improvisé — les identifiants sont lus (chiffrés) dans Supabase Vault
 * juste avant de se connecter, avec un vrai navigateur (Playwright) qui remplit le formulaire visible de
 * driiveme.com, exactement comme le ferait Laurent. Les réponses lues sont celles que le site envoie déjà
 * à son propre navigateur (fragment HTML « component/transport-list »), jamais une requête interne
 * reconstruite par nous.
 *
 * Différence majeure avec Hiflow : DriiveMe se lit par département (~101) et par « côté » (départ / arrivée),
 * soit environ 200 recherches — trop long pour un seul appel. Comme le fait déjà le téléphone (cerveau.js),
 * ce service tourne par LOT (quelques départements à la fois) à chaque appel, et garde sa position (curseur)
 * dans la table Supabase « plateforme_curseurs » pour reprendre où il s'était arrêté à l'appel suivant.
 * Cloud Scheduler doit donc appeler /sync toutes les ~5 minutes pour couvrir la France en continu.
 *
 * LIMITE CONNUE (V1 de ce service, volontairement simple pour démarrer) :
 *  - Pas encore de lecture des fiches détail (créneaux horaires exacts, adresse précise, véhicule) :
 *    seules les informations de la liste (ville, département, prix, dates du jour, distance) sont envoyées.
 *  - Pas encore de lecture de « Mes réservations » DriiveMe (missions acceptées) ni de purge des missions
 *    disparues (« plus_vue ») : tant que la rotation complète n'est pas bouclée, on ne sait pas qu'une
 *    mission a vraiment disparu plutôt que simplement pas encore relue. Seuls des ajouts / mises à jour
 *    sont envoyés pour l'instant — jamais de suppression hâtive.
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL              URL du projet Supabase
 *   SUPABASE_SERVICE_ROLE_KEY clé service_role (jamais exposée côté application/client)
 *   DRIIVEME_SYNC_SECRET      secret partagé avec Cloud Scheduler (en-tête X-Sync-Secret)
 *   DRIIVEME_USER_ID          uuid Supabase (auth.users.id) pour qui on synchronise
 *   PORT                      port HTTP (fourni par Cloud Run)
 *   DRIIVEME_LOT              (optionnel) nombre de départements (x2 côtés) lus par appel — défaut 4
 */
'use strict';
const http = require('node:http');
const { chromium } = require('playwright');
const CPGeo = require('./driiveme-vendor/geo.js');
const CPDriiveMe = require('./driiveme-vendor/driiveme.js');
const CPSync = require('./driiveme-vendor/sync-core.js');

const PLATFORM = 'DriiveMe';
const BASE_URL = 'https://www.driiveme.com';
const LOGIN_URL = BASE_URL + '/fr-FR/connexion.html';
const PAUSE_VILLE_MS = 6000, PAUSE_PAGE_MS = 2500, MAX_PAGES = 10, TAILLE_PAGE = CPDriiveMe.TAILLE_PAGE;

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error("variable d'environnement manquante: " + name);
  return v;
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function supabaseRpc(url, key, fn, args) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function supabaseUpsert(url, key, table, rows, onConflict) {
  if (!rows.length) return;
  const r = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert ${table}: ${r.status} ${await r.text()}`);
}

// ---------- Curseur de rotation (table plateforme_curseurs, V322) ----------
async function lireCurseur(url, key, userId) {
  const r = await fetch(`${url}/rest/v1/plateforme_curseurs?user_id=eq.${userId}&platform=eq.${PLATFORM}&select=position`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return 0;
  const rows = await r.json();
  return (rows && rows[0] && Number.isFinite(rows[0].position)) ? rows[0].position : 0;
}
async function ecrireCurseur(url, key, userId, position) {
  await supabaseUpsert(url, key, 'plateforme_curseurs', [{ user_id: userId, platform: PLATFORM, position, updated_at: new Date().toISOString() }], 'user_id,platform');
}

// ---------- Connexion ----------
// V2 : premier test réel (20/11/2026) en timeout sur #email après 15 s — probablement un bandeau cookies
// (jamais vu pendant la reconnaissance faite dans un vrai Chrome déjà « consenti ») ou un rendu plus lent
// en tête froide Cloud Run. On tente de fermer un bandeau cookies courant, on laisse plus de temps, et en
// cas d'échec on journalise titre/URL de la page pour diagnostiquer sans avoir besoin d'un navigateur live.
async function fermerBandeauCookies(page) {
  const textes = ['Tout accepter', 'Accepter', 'J’accepte', "J'accepte", 'Accept all', 'Accept'];
  for (const t of textes) {
    try {
      const bouton = page.getByRole('button', { name: t, exact: false }).first();
      if (await bouton.isVisible({ timeout: 1000 })) { await bouton.click({ timeout: 2000 }); await sleep(300); return true; }
    } catch (_) {}
  }
  return false;
}
async function loginDriiveMe(page, email, password) {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await fermerBandeauCookies(page).catch(() => {});
  try {
    await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
  } catch (e) {
    const titre = await page.title().catch(() => '?');
    // V3 : diagnostic — vérifié le 20/11/2026 dans un vrai Chrome que #email existe bel et bien et est
    // visible sans aucune action (pas de bandeau à fermer). Donc si ça échoue ici en tête sans interaction,
    // c'est soit une détection anti-robot (Cloudflare distingue souvent Chromium headless), soit un souci de
    // rendu propre à ce conteneur — on journalise de quoi distinguer les deux sans avoir besoin d'un navigateur live.
    const diag = await page.evaluate(() => ({
      presentDansLeDom: !!document.querySelector('#email'),
      aperçuTexte: (document.body && document.body.innerText || '').slice(0, 400),
      estHeadlessDetecte: navigator.webdriver === true,
    })).catch((err) => ({ erreurDiag: err.message }));
    throw new Error(`formulaire de connexion introuvable (titre page : « ${titre} », url : ${page.url()}) — ${e.message} — diagnostic : ${JSON.stringify(diag)}`);
  }
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    page.click('button.bt-login-submit'),
  ]);
  await sleep(2500);
  const encoreConnexion = await page.$('#password').then((h) => !!h).catch(() => false);
  if (encoreConnexion) throw new Error('connexion DriiveMe refusée (formulaire encore affiché)');
}

// ---------- Appels same-origin depuis la page (comme le téléphone, jamais de requête hors site) ----------
async function dmFetch(page, chemin, opts) {
  const post = !!(opts && opts.method === 'POST');
  const res = await page.evaluate(async ({ chemin, post, body }) => {
    try {
      const r = await fetch(chemin, {
        method: post ? 'POST' : 'GET',
        headers: post ? { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' } : { 'X-Requested-With': 'XMLHttpRequest' },
        body: post ? body : undefined,
        redirect: 'manual',
      });
      const texte = await r.text().catch(() => '');
      return { ok: true, statut: r.status, redirige: r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400), url: r.url, texte };
    } catch (e) { return { ok: false, erreur: String((e && e.message) || e) }; }
  }, { chemin, post, body: post ? String((opts && opts.body) || '') : '' });
  if (!res.ok) throw new Error('page DriiveMe injoignable (' + res.erreur + ')');
  return res;
}
async function dmVille(page, codeDep, cache) {
  if (cache[codeDep]) return cache[codeDep];
  const d = CPGeo.DEPARTEMENTS[codeDep]; if (!d) return null;
  const r = await dmFetch(page, '/fr-FR/search/cities', { method: 'POST', body: 'query=' + encodeURIComponent(d.chefLieu) });
  if (r.statut < 200 || r.statut >= 300) throw new Error('HTTP ' + r.statut + ' (recherche de la ville ' + d.chefLieu + ')');
  let j = null; try { j = JSON.parse(r.texte); } catch (_) { throw new Error('réponse illisible (recherche de la ville ' + d.chefLieu + ')'); }
  const v = CPDriiveMe.villeDuDepartement(CPDriiveMe.villes(j), codeDep, d.chefLieu, CPGeo.norm);
  if (!v) return null;
  cache[codeDep] = { id: v.id, nom: v.nom };
  return cache[codeDep];
}
async function dmPages(page, cote, idVille) {
  const out = new Map(); let pages = 0, retente = false, complet = false;
  for (let p = 1; p <= MAX_PAGES; p++) {
    if (p > 1) await sleep(PAUSE_PAGE_MS);
    const q = (cote === 'arrivee' ? 'departureCityId=&arrivalCityId=' + idVille : 'departureCityId=' + idVille + '&arrivalCityId=') + '&minDate=&vehicleType=0&driverType=&page=' + p;
    const r = await dmFetch(page, '/fr-FR/component/transport-list?' + q, {});
    if ((r.statut === 401 || (r.redirige && !/component\/transport-list/.test(r.url))) && !retente) { retente = true; await sleep(4000); p--; continue; }
    if (r.statut === 401 || (r.redirige && !/component\/transport-list/.test(r.url))) { const e = new Error('non connecté à DriiveMe'); e.connexion = true; throw e; }
    if (r.statut === 403 || r.statut === 429) { const e = new Error('DriiveMe refuse les lectures (HTTP ' + r.statut + ') : pause avant le prochain essai'); e.bloque = true; throw e; }
    if (r.statut < 200 || r.statut >= 300) throw new Error('HTTP ' + r.statut);
    const x = CPDriiveMe.parseListe(r.texte); pages++;
    // V1.77 côté téléphone : une liste faite seulement de trajets à 1 € (« locations ») = session expirée.
    if (x.missions.length >= 5 && x.missions.every((m) => m.fee != null && Number(m.fee) <= 1.01)) {
      if (!retente) { retente = true; await sleep(4000); p--; continue; }
      const e = new Error('non connecté à DriiveMe (liste de trajets à 1 € seulement : session expirée)'); e.connexion = true; throw e;
    }
    let nouveaux = 0; for (const m of x.missions) if (!out.has(m.external_id)) { out.set(m.external_id, m); nouveaux++; }
    if (x.cartes < TAILLE_PAGE || !nouveaux) { complet = true; break; }
  }
  return { missions: [...out.values()], pages, complet };
}

function listePassesNationale() {
  // Côté départ ET arrivée, pour tous les départements (geo.js) : couverture nationale complète, par rotation.
  const codes = Object.keys(CPGeo.DEPARTEMENTS).sort();
  const passes = [];
  for (const c of codes) passes.push({ cote: 'depart', dep: c });
  for (const c of codes) passes.push({ cote: 'arrivee', dep: c });
  return passes;
}

async function runSync() {
  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  const USER_ID = env('DRIIVEME_USER_ID');
  const LOT = Math.max(1, Number(process.env.DRIIVEME_LOT) || 4);

  const [cred] = await supabaseRpc(SUPABASE_URL, SERVICE_KEY, 'lire_identifiant_plateforme', { p_user_id: USER_ID, p_platform: PLATFORM });
  if (!cred || !cred.email || !cred.password) throw new Error('aucun identifiant DriiveMe enregistré pour cet utilisateur');

  const passes = listePassesNationale();
  const cur0 = (await lireCurseur(SUPABASE_URL, SERVICE_KEY, USER_ID)) % passes.length;
  const aLire = Array.from({ length: Math.min(LOT, passes.length) }, (_, i) => passes[(cur0 + i) % passes.length]);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const missionsBucket = {};
  const villeCache = {};
  let statut = 'ok', detail = null, depsOk = 0, connexion = false;
  try {
    const page = await browser.newPage();
    await loginDriiveMe(page, cred.email, cred.password);
    for (const pas of aLire) {
      try {
        const v = await dmVille(page, pas.dep, villeCache);
        if (!v) { statut = 'partiel'; detail = 'ville introuvable pour le département ' + pas.dep; continue; }
        const x = await dmPages(page, pas.cote, v.id);
        if (x.complet) depsOk++; else { statut = 'partiel'; detail = (pas.cote === 'arrivee' ? 'arrivée' : 'départ') + ' ' + pas.dep + ' : liste incomplète'; }
        for (const m of x.missions) {
          const prev = missionsBucket[m.external_id] || {};
          missionsBucket[m.external_id] = { ...prev, ...m, platform: 'DriiveMe', first_seen_at: prev.first_seen_at || new Date().toISOString(), last_seen_at: new Date().toISOString() };
        }
      } catch (e) {
        statut = e && e.connexion ? 'erreur' : 'partiel';
        detail = (pas.cote === 'arrivee' ? 'arrivée' : 'départ') + ' ' + pas.dep + ' : ' + e.message;
        console.error(`[driiveme-sync] ${detail}`);
        if (e && e.connexion) { connexion = true; break; }
        if (e && e.bloque) break; // Cloudflare : on arrête ce passage, le curseur reprendra plus loin au prochain appel.
      }
      await sleep(PAUSE_VILLE_MS);
    }
    console.log(`[driiveme-sync] lot ${cur0}-${(cur0 + aLire.length - 1) % passes.length} (sur ${passes.length}) : ${depsOk}/${aLire.length} ok · missions en mémoire : ${Object.keys(missionsBucket).length}`);
  } catch (e) {
    statut = 'erreur'; detail = e.message;
    console.error(`[driiveme-sync] échec général : ${e.message}`);
  } finally {
    await browser.close();
  }

  // Le curseur avance toujours (même en cas d'échec partiel), pour ne jamais rester bloqué sur le même
  // département en panne ; en cas de déconnexion franche, on ne fait pas avancer le curseur (on retentera
  // le même lot une fois reconnecté, pour ne pas sauter des départements pendant la coupure).
  if (!connexion) await ecrireCurseur(SUPABASE_URL, SERVICE_KEY, USER_ID, (cur0 + aLire.length) % passes.length);

  const store = { cp70_missions_autres: { DriiveMe: missionsBucket }, cp72_acceptees: {}, cp50_hiflow_missions: {}, cp96_factures: {}, cp95_devis: {}, cp98_attente: {} };
  const rows = CPSync.buildRows(store, USER_ID, { plateformes: ['DriiveMe'] }).map((r) => ({ ...r, first_seen_at: undefined }));
  await supabaseUpsert(SUPABASE_URL, SERVICE_KEY, 'missions', rows, 'user_id,platform,external_id,kind');
  // V1 : pas de purge « plus_vue » ici (lecture par lots, pas de vision complète en un seul appel — voir
  // la limite connue en tête de fichier). À ajouter plus tard, quand une rotation complète sera détectée.

  const etatResp = await fetch(`${SUPABASE_URL}/rest/v1/sources_etat?on_conflict=user_id,platform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ user_id: USER_ID, platform: PLATFORM, lu_le: new Date().toISOString(), maj_le: new Date().toISOString(), ok: statut !== 'erreur', message: detail || `${rows.length} missions, lot ${cur0}/${passes.length}` }]),
  }).catch((e) => { console.error(`[driiveme-sync] écriture sources_etat échouée : ${e.message}`); return null; });
  if (etatResp && !etatResp.ok) console.error(`[driiveme-sync] sources_etat refusé (${etatResp.status}) : ${(await etatResp.text()).slice(0, 300)}`);

  // V322 : date/statut affichés dans Réglages (bloc « Lecture automatique DriiveMe »).
  await fetch(`${SUPABASE_URL}/rest/v1/plateforme_identifiants?user_id=eq.${USER_ID}&platform=eq.${PLATFORM}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ derniere_sync_at: new Date().toISOString(), derniere_sync_statut: statut }),
  }).catch(() => {});

  console.log(`[driiveme-sync] résumé : statut=${statut} · ${rows.length} missions · lot ${depsOk}/${aLire.length}` + (detail ? ` · ${detail}` : ''));
  return { statut, nb_missions: rows.length, lot_ok: depsOk, lot_total: aLire.length, curseur_suivant: connexion ? cur0 : (cur0 + aLire.length) % passes.length, total_passes: passes.length, detail };
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok' })); return; }
  if (req.method !== 'POST' || req.url !== '/sync') { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'not_found' })); return; }
  const expected = process.env.DRIIVEME_SYNC_SECRET;
  if (expected && req.headers['x-sync-secret'] !== expected) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
  try {
    const result = await runSync();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`driiveme-sync à l'écoute sur ${PORT}`));

module.exports = { runSync, listePassesNationale };
