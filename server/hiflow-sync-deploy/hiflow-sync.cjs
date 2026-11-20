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
 * 21/11/2026 : multi-convoyeurs — ce service ne sert plus un seul utilisateur figé (HIFLOW_USER_ID).
 * À chaque appel, il interroge Supabase pour la liste de TOUS les convoyeurs ayant un identifiant
 * Hiflow actif (plateforme_identifiants, platform='Hiflow', active=true), puis synchronise chacun
 * avec SES PROPRES identifiants (email + mot de passe), un par un, dans un navigateur neuf à chaque
 * fois (aucun cookie ni session partagée entre deux convoyeurs). Un convoyeur en échec (mauvais mot
 * de passe, compte bloqué...) n'empêche jamais la synchro des autres.
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL              URL du projet Supabase
 *   SUPABASE_SERVICE_ROLE_KEY clé service_role (jamais exposée côté application/client)
 *   HIFLOW_SYNC_SECRET        secret partagé avec Cloud Scheduler (en-tête X-Sync-Secret)
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
  // 21/11/2026 : le texte exact compte — alerteConnexion (app.js) ne déclenche la grosse alerte rouge
  // « Reconnexion nécessaire » que si le message contient connect/identifi/session/login. « connexion
  // Hiflow refusée » ne matchait AUCUN de ces mots (ne contient pas « connect », juste « connexion » qui a
  // un x), donc une vraie déconnexion Hiflow (mot de passe changé, compte bloqué…) ne provoquait qu'un
  // changement de couleur discret de la pastille, jamais l'alerte visible — constaté en relisant le code
  // suite à une question de Laurent (« si déconnexion, je le saurai ? »).
  if (/\/login/.test(page.url())) throw new Error('identifiants Hiflow refusés (connexion impossible)');
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
// 21/11/2026 (multi-convoyeurs) : filtré par user_id désormais — sans ça, la lecture récente des factures
// d'UN convoyeur aurait fait sauter celle des autres pendant 6h, alors que chacun a ses propres factures.
async function fauteDeFacturesRecentes(url, key, userId) {
  try {
    const r = await fetch(`${url}/rest/v1/factures?user_id=eq.${userId}&platform=eq.${PLATFORM}&select=maj_le&order=maj_le.desc&limit=1`, {
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

// 21/11/2026 : liste tous les convoyeurs ayant un identifiant Hiflow actif enregistré — chacun ne
// sera synchronisé qu'avec SON PROPRE email/mot de passe, lu séparément via lire_identifiant_plateforme.
async function listerUtilisateursHiflowActifs(url, key) {
  const r = await fetch(`${url}/rest/v1/plateforme_identifiants?platform=eq.${PLATFORM}&active=eq.true&select=user_id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`lister identifiants Hiflow actifs: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  return [...new Set(rows.map((row) => row.user_id))];
}

async function syncUnUtilisateur(SUPABASE_URL, SERVICE_KEY, USER_ID) {
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
    if (await fauteDeFacturesRecentes(SUPABASE_URL, SERVICE_KEY, USER_ID)) {
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
    const filtre = CPSync.filtreOrphelines(rows, PLATFORM, USER_ID);
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

  // 21/11/2026 : corrige un bug constaté en réel (Laurent) — le robot synchronisait avec succès depuis le
  // 19/11 (confirmé par sources_etat et par le nombre de missions à jour), mais ne mettait jamais à jour
  // plateforme_identifiants.derniere_sync_at/derniere_sync_statut, la SEULE chose que l'écran Réglages lit
  // (majStatutAuto, plateformes.js) : l'app affichait donc « Pas encore de synchro » indéfiniment malgré un
  // robot parfaitement fonctionnel. sources_etat et plateforme_identifiants sont deux tables distinctes,
  // jamais synchronisées entre elles jusqu'ici.
  try {
    await supabasePatch(SUPABASE_URL, SERVICE_KEY, 'plateforme_identifiants',
      `user_id=eq.${USER_ID}&platform=eq.${PLATFORM}`,
      { derniere_sync_at: new Date().toISOString(), derniere_sync_statut: statut });
  } catch (e) { console.error(`[hiflow-sync] écriture plateforme_identifiants échouée : ${e.message}`); }

  console.log(`[hiflow-sync] [${USER_ID}] résumé : statut=${statut} · ${rows.length} missions · régions ${regionsOk}/${REGIONS.length}` + (detail ? ` · ${detail}` : ''));
  return { statut, nb_missions: rows.length, regions_ok: regionsOk, regions_total: REGIONS.length, detail };
}

// 21/11/2026 : point d'entrée multi-convoyeurs — remplace l'ancien runSync() mono-utilisateur
// (qui lisait HIFLOW_USER_ID dans l'environnement). Chaque convoyeur est traité l'un après l'autre
// (jamais en parallèle : un seul navigateur Chromium à la fois, mémoire Cloud Run limitée) et avec
// ses propres identifiants Hiflow ; l'échec d'un convoyeur (login refusé, panne réseau...) est
// consigné et n'empêche jamais la synchro des suivants.
async function runSync() {
  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

  const userIds = await listerUtilisateursHiflowActifs(SUPABASE_URL, SERVICE_KEY);
  if (!userIds.length) {
    console.log('[hiflow-sync] aucun convoyeur avec identifiant Hiflow actif à synchroniser');
    return { utilisateurs: 0, resultats: [] };
  }

  const resultats = [];
  for (const userId of userIds) {
    try {
      const resultat = await syncUnUtilisateur(SUPABASE_URL, SERVICE_KEY, userId);
      resultats.push({ user_id: userId, ...resultat });
    } catch (e) {
      console.error(`[hiflow-sync] [${userId}] échec complet : ${e.message}`);
      // Même en cas d'échec total avant toute lecture (ex : identifiant Hiflow introuvable/invalide dans
      // Vault), on remonte le statut dans sources_etat et plateforme_identifiants pour que la pastille et
      // l'alerte de l'utilisateur concerné réagissent — sans ça, seuls les logs Cloud Run le sauraient.
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/sources_etat?on_conflict=user_id,platform`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ user_id: userId, platform: PLATFORM, lu_le: new Date().toISOString(), maj_le: new Date().toISOString(), ok: false, message: e.message }]),
        });
        await supabasePatch(SUPABASE_URL, SERVICE_KEY, 'plateforme_identifiants', `user_id=eq.${userId}&platform=eq.${PLATFORM}`, { derniere_sync_at: new Date().toISOString(), derniere_sync_statut: 'erreur' });
      } catch (e2) { console.error(`[hiflow-sync] [${userId}] écriture du statut d'échec impossible : ${e2.message}`); }
      resultats.push({ user_id: userId, statut: 'erreur', detail: e.message });
    }
  }
  console.log(`[hiflow-sync] terminé : ${resultats.length} convoyeur(s) traité(s)`);
  return { utilisateurs: resultats.length, resultats };
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
