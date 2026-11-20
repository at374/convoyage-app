/* Robot de synchronisation Hiflow -> Supabase, pour Cloud Run.
 *
 * Reprend la même logique, déjà éprouvée et conforme à la confidentialité (contrat Hiflow art. 12),
 * que le robot embarqué dans l'application Android (hiflow-robot.js / net-core.js / sync-core.js du
 * dépôt at374/convoyage-tel) : jamais de mot de passe tapé « à la main », capture des réponses JSON
 * que le site envoie déjà à son propre navigateur (getJourneysOpenToConveyorBooking, getBooking),
 * jamais de requête construite nous-mêmes vers une API interne.
 *
 * Seule différence avec le robot téléphone : ici personne n'est présent pour se reconnecter, donc
 * les identifiants sont lus (chiffrés) dans Supabase Vault juste avant de se connecter, avec un vrai
 * navigateur (Playwright) qui remplit le formulaire visible, exactement comme le ferait Laurent.
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL              URL du projet Supabase
 *   SUPABASE_SERVICE_ROLE_KEY clé service_role (jamais exposée côté application/client)
 *   HIFLOW_SYNC_SECRET        secret partagé avec Cloud Scheduler (en-tête X-Sync-Secret)
 *   HIFLOW_USER_ID            uuid Supabase (auth.users.id) pour qui on synchronise
 *   PORT                      port HTTP (fourni par Cloud Run)
 */
'use strict';
const http = require('node:http');
const { chromium } = require('playwright');
const CPNet = require('./hiflow-vendor/net-core.js');
const CPSync = require('./hiflow-vendor/sync-core.js');

const PLATFORM = 'Hiflow';
const BASE_URL = 'https://partenaire.expedicar.com';
const LOGIN_URL = BASE_URL + '/login';
const LIST_URL = BASE_URL + '/journey/list#journeys';
const BOOKING_URL = BASE_URL + '/booking';
const BILLING_URL = BASE_URL + '/billing';
const FACTURES_MIN_INTERVAL_MS = 6 * 3600000; // comme le téléphone : les factures changent rarement

// Régions de la liste déroulante « Ville de départ » du site (FR + Belgique).
const REGIONS = [
  'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire',
  'Corse', 'DOM-TOM', 'Grand Est', 'Hauts-de-France', 'Ile-de-france', 'Normandie',
  'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la loire', "Provence-Alpes-Côte d'Azur",
  'Wallonie', 'Flandre', 'Bruxelles-Capitale',
];

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error("variable d'environnement manquante: " + name);
  return v;
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function jitter(base, spread) { return base + Math.floor(Math.random() * spread); }

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
async function supabasePatch(url, key, table, filterQuery, patch) {
  const r = await fetch(`${url}/rest/v1/${table}?${filterQuery}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`patch ${table}: ${r.status} ${await r.text()}`);
}

async function loginHiflow(page, email, password) {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  if (!/\/login/.test(page.url())) return; // déjà connecté (session réutilisée)
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL(/\/schedule|\/journey/, { timeout: 20000 }).catch(() => {}),
    page.click('#button-login-submit'),
  ]);
  if (/\/login/.test(page.url())) throw new Error('connexion Hiflow refusée');
}

// Capture passive des réponses JSON, comme côté Android (HiflowPont / cerveau.js) : jamais de requête
// construite par nous. Chaque parseur de net-core.js vérifie lui-même la forme exacte attendue (clé de
// tableau différente : response.journeys sans booking, response.booking, response.quotations,
// response.bills, response.journeys AVEC booking) ; on les essaie donc tous, sans deviner par l'URL.
function armerCapture(page, missionsBucket, resaBucket, facturesBucket, attenteBucket) {
  page.on('response', async (resp) => {
    try {
      const url = resp.url();
      if (/getJourneysOpenToConveyorBooking/i.test(url) && /near/i.test(url)) return; // V85 : jamais les trajets « à proximité »
      const ct = resp.headers()['content-type'] || '';
      if (!/json/i.test(ct)) return;
      const text = await resp.text();
      if (text.length > 2500000) return;
      let json; try { json = JSON.parse(text); } catch (_) { return; }
      const now = new Date().toISOString();

      const resa = CPNet.reservationsHiflow(json);
      if (resa) {
        for (const m of resa) {
          const id = String(m.external_id || ''); if (!/^\d{5,10}$/.test(id)) continue;
          const sr = String(m.status_raw || '');
          const st = /annul/i.test(sr) ? 'annulee' : /effectu|termin/i.test(sr) ? 'terminee' : 'acceptee';
          resaBucket[id] = { ...(resaBucket[id] || {}), ...m, status: st, last_seen_at: now };
        }
        return;
      }
      const dispo = CPNet.trajetsHiflow(json);
      if (dispo) {
        for (const m of dispo) {
          const id = String(m.external_id || ''); if (!/^\d{5,10}$/.test(id) || !m.from || !m.to) continue;
          const prev = missionsBucket[id] || {};
          missionsBucket[id] = { ...prev, ...m, platform: 'Hiflow', first_seen_at: prev.first_seen_at || now, last_seen_at: now };
        }
        return;
      }
      const factures = CPNet.facturesHiflow(json);
      if (factures) {
        for (const f of factures) if (f && f.id) facturesBucket[f.id] = { ...(facturesBucket[f.id] || {}), ...f };
        return;
      }
      const attente = CPNet.attenteHiflow(json);
      if (attente) {
        for (const t of attente) if (t && t.id_booking) attenteBucket[t.id_booking] = { ...(attenteBucket[t.id_booking] || {}), ...t };
      }
    } catch (_) { /* une réponse illisible ne doit jamais arrêter la lecture */ }
  });
}

async function choisirRegion(page, region) {
  // Diagnostic du 20/11/2026 (régions à 0/17, « located to hidden <select id="start_region"> ») : le site a
  // habillé ce <select> natif d'un composant stylé, le rendant visuellement caché en permanence sans rien
  // changer à son fonctionnement — attendre sa visibilité ne peut plus aboutir. On attend seulement sa
  // présence dans le DOM et on force la sélection (selectOption déclenche quand même les événements
  // input/change attendus par le site).
  await page.waitForSelector('#start_region', { state: 'attached', timeout: 15000 });
  await page.selectOption('#start_region', region, { force: true });
  await page.selectOption('#end_region', '', { force: true }).catch(() => {});
  await sleep(1500);
}

async function tournerLesPages(page) {
  for (let i = 0; i < 60; i++) {
    await sleep(jitter(3500, 1800));
    if (/\/login/.test(page.url())) throw new Error('déconnecté en cours de lecture');
    const pag = await page.$('.pagination-tableJourneyList');
    if (!pag) break;
    const next = await pag.$('[data-action="next"]');
    if (!next) break;
    const disabled = await next.evaluate((n) => n.disabled || n.getAttribute('aria-disabled') === 'true' || /disabled/i.test(n.className || ''));
    if (disabled) break;
    await next.click();
  }
}

async function scrapeRegion(page, region, missionsBucket, resaBucket) {
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  const onglet = await page.$('a[href="#journeys"]');
  if (onglet) await onglet.click().catch(() => {});
  await choisirRegion(page, region);
  await tournerLesPages(page);
}

async function lireMesTrajets(page, resaBucket) {
  await page.goto(BOOKING_URL, { waitUntil: 'domcontentloaded' });
  await sleep(4000); // la liste arrive via la réponse JSON capturée passivement
}

// Comme le téléphone (hf_factures_at) : « Mes factures » change rarement, on ne la relit pas à chaque passage.
async function fauteDeFacturesRecentes(url, key) {
  try {
    const r = await fetch(`${url}/rest/v1/factures?platform=eq.${PLATFORM}&select=maj_le&order=maj_le.desc&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return true;
    const rows = await r.json();
    const dernier = rows && rows[0] && rows[0].maj_le ? Date.parse(rows[0].maj_le) : 0;
    return !dernier || Date.now() - dernier > FACTURES_MIN_INTERVAL_MS;
  } catch (_) { return true; }
}

async function lireMesFactures(page) {
  await page.goto(BILLING_URL, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
}

async function runSync() {
  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  const USER_ID = env('HIFLOW_USER_ID');

  const [cred] = await supabaseRpc(SUPABASE_URL, SERVICE_KEY, 'lire_identifiant_plateforme', { p_user_id: USER_ID, p_platform: PLATFORM });
  if (!cred || !cred.email || !cred.password) throw new Error('aucun identifiant Hiflow enregistré pour cet utilisateur');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const missionsBucket = {}, resaBucket = {}, facturesBucket = {}, attenteBucket = {};
  let statut = 'ok', detail = null, regionsOk = 0, facturesLues = false;
  try {
    const page = await browser.newPage();
    armerCapture(page, missionsBucket, resaBucket, facturesBucket, attenteBucket);
    await loginHiflow(page, cred.email, cred.password);
    await lireMesTrajets(page, resaBucket);
    if (await fauteDeFacturesRecentes(SUPABASE_URL, SERVICE_KEY)) {
      try { await lireMesFactures(page); facturesLues = true; } catch (e) { statut = 'partiel'; detail = `factures: ${e.message}`; }
    }
    for (const region of REGIONS) {
      try {
        await scrapeRegion(page, region, missionsBucket, resaBucket);
        regionsOk++;
      } catch (e) {
        statut = 'partiel';
        detail = `${region}: ${e.message}`;
        // Visible dans les logs Cloud Run (le détail précédent n'était gardé qu'en mémoire et écrasé à
        // chaque région suivante) : signalé le 20/11/2026, plusieurs régions manquantes sans diagnostic possible.
        console.error(`[hiflow-sync] région en échec : ${region} — ${e.message}`);
      }
    }
    console.log(`[hiflow-sync] régions : ${regionsOk}/${REGIONS.length} ok · missions en mémoire : ${Object.keys(missionsBucket).length}`);
  } catch (e) {
    statut = 'erreur';
    detail = e.message;
    console.error(`[hiflow-sync] échec général : ${e.message}`);
  } finally {
    await browser.close();
  }

  const store = {
    cp50_hiflow_missions: missionsBucket,
    cp72_acceptees: { Hiflow: resaBucket },
    cp70_missions_autres: {},
    cp96_factures: facturesBucket,
    cp95_devis: {},
    cp98_attente: attenteBucket,
  };
  const rows = CPSync.buildRows(store, USER_ID, { plateformes: ['Hiflow'] }).map((r) => ({ ...r, first_seen_at: undefined }));

  await supabaseUpsert(SUPABASE_URL, SERVICE_KEY, 'missions', rows, 'user_id,platform,external_id,kind');

  // Sécurité (comme purgerApresLecture côté téléphone) : ne JAMAIS marquer « plus_vue » sur une lecture
  // incomplète (une région en échec = ses missions, pourtant peut-être toujours bien disponibles, seraient
  // sinon effacées à tort). On ne fait ce ménage que quand les 17 régions ont été lues avec succès.
  if (regionsOk === REGIONS.length) {
    const filtre = CPSync.filtreOrphelines(rows, PLATFORM);
    if (filtre) {
      await supabasePatch(SUPABASE_URL, SERVICE_KEY, 'missions', filtre, { status: 'plus_vue' });
    }
  }

  if (facturesLues) {
    const factureRows = CPSync.buildFactures(store, USER_ID);
    if (factureRows.length) await supabaseUpsert(SUPABASE_URL, SERVICE_KEY, 'factures', factureRows, 'user_id,platform,external_id');
  }

  const etatResp = await fetch(`${SUPABASE_URL}/rest/v1/sources_etat?on_conflict=user_id,platform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ user_id: USER_ID, platform: PLATFORM, lu_le: new Date().toISOString(), maj_le: new Date().toISOString(), ok: statut !== 'erreur', message: detail || `${rows.length} missions, ${regionsOk}/${REGIONS.length} régions` }]),
  }).catch((e) => { console.error(`[hiflow-sync] écriture sources_etat échouée : ${e.message}`); return null; });
  if (etatResp && !etatResp.ok) console.error(`[hiflow-sync] sources_etat refusé (${etatResp.status}) : ${(await etatResp.text()).slice(0, 300)}`);

  console.log(`[hiflow-sync] résumé : statut=${statut} · ${rows.length} missions · régions ${regionsOk}/${REGIONS.length}` + (detail ? ` · ${detail}` : ''));
  return { statut, nb_missions: rows.length, regions_ok: regionsOk, regions_total: REGIONS.length, detail };
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok' })); return; }
  if (req.method !== 'POST' || req.url !== '/sync') { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'not_found' })); return; }
  const expected = process.env.HIFLOW_SYNC_SECRET;
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
server.listen(PORT, () => console.log(`hiflow-sync à l'écoute sur ${PORT}`));

module.exports = { runSync };
