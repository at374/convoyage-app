#!/usr/bin/env node
'use strict';
// 23/11/2026 (Laurent : collecteur GTFS national automatisé) : découvre tous les réseaux GTFS
// publiés sur le catalogue officiel transport.data.gouv.fr, télécharge et valide chaque flux,
// classe ses lignes (régulière / scolaire / transport à la demande / inconnue — jamais « régulière »
// par défaut), ne retélécharge que ce qui a changé, et écrit un manifeste JSON + CSV.
//
// Réutilise volontairement les modules déjà en place et testés (aucune réécriture des moteurs de
// transport) :
//   - transport-catalogue.js : découverte du catalogue PAN, téléchargement sécurisé (taille plafonnée,
//     signature ZIP vérifiée, redirections https uniquement).
//   - transport-gtfs-loader.js (extractGTFS) : dézippage et vérification structurelle (tables GTFS
//     obligatoires, calendrier présent) — lève déjà une erreur explicite si une table manque.
//   - transport-gtfs-index.js (parseCSV, activeServices) : lecture des tables et calcul des services
//     actifs sur une date donnée.
//
// Aucun tarif n'est jamais inventé : on se contente de noter si un flux publie fare_attributes.txt.
// La rentabilité d'une mission reste masquée tant que le coût complet du transport n'est pas connu
// (décision déjà en vigueur ailleurs dans l'application).
//
// Stockage : les archives validées ne sont PAS commitées dans Git (le dépôt est déjà à 1,3 Go à cause
// des extraits régionaux). Elles sont déposées dans la Release GitHub « gtfs-national » (même
// mécanisme déjà utilisé pour le graphe OTP2 dans otp2-graphe-reel.yml) ; seul le manifeste, petit,
// reste versionné dans Git.

const crypto = require('node:crypto');
const catalogue = require('../transport-catalogue.js');
const loader = require('../transport-gtfs-loader.js');
const gtfs = require('../transport-gtfs-index.js');

const SCHEMA_VERSION = 1;
// Plafonds généreux : ce collecteur tourne côté serveur (CI), pas sur le téléphone. Les plus gros
// réseaux français (IDFM, grandes métropoles) dépassent largement les 20 Mo par défaut du chargeur
// mobile (transport-gtfs-loader.js DEFAULT_LIMITS), qui reste inchangé pour l'app.
const DEFAULT_MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
const DEFAULT_MAX_FILE_BYTES = 350 * 1024 * 1024;
const DEFAULT_MAX_EXPANDED_BYTES = 700 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 256;
const DEFAULT_CONCURRENCY = 2; // Limite mémoire sur runner GitHub hébergé
const DEFAULT_TIMEOUT_MS = 90000;
const ACTIVE_WINDOW_DAYS = 30;

// Mots-clés signalant un agrégat régional/multi-réseaux (ex. « Oùra », « réseau régional »), qui
// mélange plusieurs opérateurs dans un seul flux. Ce collecteur ne tente pas de séparer ces agrégats
// (ce travail spécifique reste celui de scripts/build_regional_gtfs.py) : il les télécharge et les
// valide comme un flux unique, mais les signale pour qu'aucun autre script ne les traite à tort comme
// un réseau simple.
const AGGREGATE_HINTS = /\b(r[ée]gional(?:e)?|r[ée]gion\b|agr[ée]gat|aggregate|national(?:e)?|ou[̀]?ra)\b/i;

const SCHOOL_HINTS = /\bscol(?:aire)?s?\b|\btransport\s+scolaire\b|\bligne\s+scol\b/i;
// Codes GTFS étendus « hail and ride » / transport à la demande (711-716), quand le producteur les
// utilise. Beaucoup de producteurs français signalent plutôt le TAD via pickup_type/drop_off_type
// (cf. isDemandRoute ci-dessous), d'où les deux vérifications.
const DEMAND_ROUTE_TYPES = new Set(['704', '714', '715', '716']);

function norm(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function isAggregateSuspect(datasetName) {
  return AGGREGATE_HINTS.test(norm(datasetName));
}

// Une étape (stop_time) en transport à la demande indique pickup_type/drop_off_type 2 (téléphoner à
// l'agence) ou 3 (coordonner avec le conducteur) — convention GTFS standard, déjà utilisée côté moteur
// (transport-gtfs-index.js, fonctions internes regularAccess/demandAccess) pour l'accès aux arrêts.
function isDemandStopTime(row) {
  return row.pickup_type === '2' || row.pickup_type === '3' || row.drop_off_type === '2' || row.drop_off_type === '3';
}

// Classe chaque ligne (route) d'un flux en 'regular' | 'school' | 'demandResponsive' | 'unknown'.
// Ne classe JAMAIS une ligne inconnue en 'regular' par défaut — conformément à la consigne de ne
// jamais traiter une ligne non identifiée comme une ligne régulière classique.
function classifyRoutes(files) {
  const routes = gtfs.parseCSV(files['routes.txt'] || '');
  const trips = gtfs.parseCSV(files['trips.txt'] || '');
  const routeIdByTrip = new Map(trips.filter((t) => t.trip_id && t.route_id).map((t) => [t.trip_id, t.route_id]));
  const demandRouteIds = new Set();
  for (const row of gtfs.csvRows(files['stop_times.txt'] || '')) {
    if (!isDemandStopTime(row)) continue;
    const routeId = routeIdByTrip.get(row.trip_id);
    if (routeId) demandRouteIds.add(routeId);
  }
  const counts = { regular: 0, school: 0, demandResponsive: 0, unknown: 0 };
  for (const route of routes) {
    const label = norm([route.route_short_name, route.route_long_name, route.route_desc].filter(Boolean).join(' '));
    let kind;
    if (DEMAND_ROUTE_TYPES.has(String(route.route_type || '').trim()) || demandRouteIds.has(route.route_id)) {
      kind = 'demandResponsive';
    } else if (SCHOOL_HINTS.test(label)) {
      kind = 'school';
    } else {
      // Le mode GTFS seul ne prouve pas une ligne régulière ouverte au public.
      kind = 'unknown';
    }
    counts[kind] += 1;
  }
  return counts;
}

// Identifiants de service actifs au moins un jour dans les `days` prochains jours (fenêtre glissante
// à partir de `today`, calendar.txt + calendar_dates.txt pris en compte via gtfs.activeServices).
function activeWithinDays(files, days, today = new Date()) {
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(today.getTime() + offset * 86400000);
    const stamp = date.toISOString().slice(0, 10); // activeServices attend AAAA-MM-JJ, pas AAAAMMJJ.
    if (gtfs.activeServices(files, stamp).size > 0) return true;
  }
  return false;
}

function lastServiceDate(files) {
  const dates = [];
  for (const row of gtfs.csvRows(files['calendar.txt'] || '')) {
    if (/^\\d{8}$/.test(row.end_date || '')) dates.push(row.end_date);
  }
  for (const row of gtfs.csvRows(files['calendar_dates.txt'] || '')) {
    if (/^\\d{8}$/.test(row.date || '') && row.exception_type === '1') dates.push(row.date);
  }
  if (!dates.length) return null;
  const latest = dates.sort().at(-1);
  return latest.slice(0, 4) + '-' + latest.slice(4, 6) + '-' + latest.slice(6, 8);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function slugify(text) {
  return norm(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'reseau';
}

// Fonctionne aussi bien sur une ressource brute du catalogue PAN (identifiant dans .id) que sur une
// entrée déjà écrite dans le manifeste (identifiant PAN conservé dans .resourceId, .id étant alors le
// slug lisible du réseau) — sans ça, une entrée inchangée ne serait jamais reconnue d'une exécution à l'autre.
function dedupKey(resource) {
  return `${resource.datasetId}|${resource.resourceId ?? resource.id}`;
}

// On ne retélécharge que ce qui a changé : si la date de mise à jour publiée par le catalogue PAN
// n'a pas bougé depuis le dernier manifeste, on réutilise l'entrée précédente sans retoucher au réseau.
function shouldSkip(resource, previousEntry) {
  if (!previousEntry || !['ok', 'unchanged'].includes(previousEntry.status)) return false;
  if (!resource.updatedAt || !previousEntry.updatedAt) return false;
  const current = Date.parse(resource.updatedAt);
  const previous = Date.parse(previousEntry.updatedAt);
  return Number.isFinite(current) && Number.isFinite(previous) && current === previous;
}

async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, next));
  return results;
}

async function processResource(resource, { fetcher, maxBytes, timeoutMs, previousEntry, now, availableAssets = null }) {
  const base = {
    id: slugify(resource.network) + '-' + slugify(resource.id).slice(0, 12),
    datasetId: resource.datasetId,
    resourceId: resource.id,
    network: resource.network,
    url: resource.url,
    updatedAt: resource.updatedAt || null,
    aggregateSuspected: isAggregateSuspect(resource.network),
    lastCheckedAt: now,
  };
  // Si la Release a perdu son ZIP, ne jamais déclarer la ressource inchangée.
  const archiveAvailable = availableAssets === null || availableAssets.has(base.id + '.zip');
  if (archiveAvailable && shouldSkip(resource, previousEntry)) {
    return { ...previousEntry, ...base, status: 'unchanged', lastCheckedAt: now };
  }
  let bytes;
  try {
    bytes = await catalogue.downloadGTFS(resource, fetcher, maxBytes, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { ...base, status: 'error', error: 'téléchargement : ' + error.message };
  }
  const hash = sha256(bytes);
  if (archiveAvailable && previousEntry && ['ok', 'unchanged'].includes(previousEntry.status) && previousEntry.sha256 === hash) {
    return { ...previousEntry, ...base, status: 'unchanged', lastCheckedAt: now };
  }
  let extracted;
  try {
    extracted = await loader.extractGTFS(bytes, {
      maxArchiveBytes: DEFAULT_MAX_ARCHIVE_BYTES,
      maxFileBytes: DEFAULT_MAX_FILE_BYTES,
      maxExpandedBytes: DEFAULT_MAX_EXPANDED_BYTES,
      maxEntries: DEFAULT_MAX_ENTRIES,
    });
  } catch (error) {
    return { ...base, status: 'error', error: 'validation : ' + error.message };
  }
  const { files } = extracted;
  let agencies;
  try {
    agencies = gtfs.parseCSV(files['agency.txt'] || '');
    if (!agencies.length || agencies.some((a) => !a.agency_name || !a.agency_timezone)) {
      return { ...base, status: 'error', error: 'agency.txt invalide (nom ou fuseau horaire manquant)' };
    }
  } catch (error) {
    return { ...base, status: 'error', error: 'agency.txt : ' + error.message };
  }
  let index;
  let lines;
  try {
    index = gtfs.buildIndex(files);
    if (!index.counts.routes || !index.counts.trips) {
      return { ...base, status: 'error', error: 'flux sans ligne ou sans course exploitable' };
    }
    lines = classifyRoutes(files);
  } catch (error) {
    return { ...base, status: 'error', error: 'indexation ou classification : ' + error.message };
  }
  let activeNext30Days;
  let publishedLastServiceDate;
  try {
    activeNext30Days = activeWithinDays(files, ACTIVE_WINDOW_DAYS, new Date(now));
    publishedLastServiceDate = lastServiceDate(files);
  } catch (error) {
    return { ...base, status: 'error', error: 'calendrier : ' + error.message };
  }
  return {
    ...base,
    status: 'ok',
    sha256: hash,
    sizeBytes: bytes.length,
    routes: index.counts.routes,
    trips: index.counts.trips,
    stops: index.counts.stops,
    stopTimes: index.counts.stopTimes,
    agencies: agencies.map(a => ({ id: a.agency_id || null, name: a.agency_name, url: a.agency_url || null })),
    lastServiceDate: publishedLastServiceDate,
    fares: Boolean(files['fare_attributes.txt']),
    activeNext30Days,
    lines,
    bytes, // retiré avant écriture du manifeste ; utilisé par l'appelant pour la publication.
  };
}

async function collect({
  fetcher = fetch,
  limit = null,
  maxBytes = DEFAULT_MAX_ARCHIVE_BYTES,
  concurrency = DEFAULT_CONCURRENCY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  previousManifest = null,
  availableAssets = null,
  now = new Date().toISOString(),
} = {}) {
  const datasets = await catalogue.fetchCatalogue(fetcher);
  let resources = catalogue.gtfsResources(datasets);
  const seen = new Set();
  resources = resources.filter((r) => {
    const key = r.datasetId + '|' + r.id + '|' + r.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (Number.isInteger(limit) && limit > 0) resources = resources.slice(0, limit);
  const previousByKey = new Map((previousManifest?.networks ? Object.values(previousManifest.networks) : []).map((e) => [dedupKey(e), e]));
  const entries = await pool(resources, concurrency, async (resource) => {
    try {
      return await processResource(resource, {
        fetcher, maxBytes, timeoutMs, previousEntry: previousByKey.get(dedupKey(resource)), now, availableAssets
      });
    } catch (error) {
      // Une ressource imprévue ne doit pas annuler l'analyse des autres réseaux.
      return {
        id: slugify(resource.network) + '-' + slugify(resource.id).slice(0, 12),
        datasetId: resource.datasetId, resourceId: resource.id,
        network: resource.network, url: resource.url,
        updatedAt: resource.updatedAt || null, lastCheckedAt: now,
        status: 'error', error: 'traitement : ' + (error?.message || String(error))
      };
    }
  });
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now,
    source: catalogue.ENDPOINT,
    totals: { found: resources.length, ok: 0, unchanged: 0, error: 0 },
    networks: {},
    errors: {},
  };
  const uploads = [];
  for (const entry of entries) {
    const { bytes, ...toStore } = entry;
    manifest.networks[entry.id] = toStore;
    manifest.totals[entry.status] = (manifest.totals[entry.status] || 0) + 1;
    if (entry.status === 'error') manifest.errors[entry.id] = entry.error;
    if (entry.status === 'ok' && bytes) uploads.push({ id: entry.id, bytes });
  }
  return { manifest, uploads };
}

function toCSV(manifest) {
  const header = ['id', 'network', 'status', 'routes', 'trips', 'stops', 'fares', 'activeNext30Days', 'lastServiceDate', 'lines_regular', 'lines_school', 'lines_demandResponsive', 'lines_unknown', 'aggregateSuspected', 'sha256', 'url', 'error'];
  const rows = [header.join(',')];
  const esc = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  for (const entry of Object.values(manifest.networks)) {
    rows.push(
      [
        entry.id,
        entry.network,
        entry.status,
        entry.routes ?? '',
        entry.trips ?? '',
        entry.stops ?? '',
        entry.fares ?? '',
        entry.activeNext30Days ?? '',
        entry.lastServiceDate ?? '',
        entry.lines?.regular ?? '',
        entry.lines?.school ?? '',
        entry.lines?.demandResponsive ?? '',
        entry.lines?.unknown ?? '',
        entry.aggregateSuspected ?? '',
        entry.sha256 ?? '',
        entry.url ?? '',
        entry.error ?? '',
      ]
        .map(esc)
        .join(',')
    );
  }
  return rows.join('\n') + '\n';
}

module.exports = {
  norm,
  isAggregateSuspect,
  classifyRoutes,
  activeWithinDays,
  sha256,
  lastServiceDate,
  slugify,
  dedupKey,
  shouldSkip,
  pool,
  processResource,
  collect,
  toCSV,
  DEFAULT_MAX_ARCHIVE_BYTES,
};

if (require.main === module) {
  (async () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const args = process.argv.slice(2);
    const flag = (name, def) => {
      const i = args.indexOf('--' + name);
      return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
    };
    const outDir = flag('out', 'docs/gtfs-national');
    const limit = flag('limit', null);
    const releaseDir = flag('release-dir', null); // dossier local où déposer les ZIP validés pour la publication (gh release upload).
    const dryRun = args.includes('--dry-run');
    const availableAssetsFile = flag('available-assets', null);
    const availableAssets = availableAssetsFile
      ? new Set(JSON.parse(fs.readFileSync(availableAssetsFile, 'utf8')))
      : null;
    let previousManifest = null;
    const manifestPath = path.join(outDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        previousManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        previousManifest = null;
      }
    }
    const { manifest, uploads } = await collect({
      limit: limit ? Number(limit) : null,
      // Une collecte limitée ne doit pas remplacer le manifeste national complet.
      previousManifest,
      availableAssets,
    });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
    fs.writeFileSync(path.join(outDir, 'manifest.csv'), toCSV(manifest));
    if (!dryRun && releaseDir && uploads.length) {
      fs.mkdirSync(releaseDir, { recursive: true });
      for (const { id, bytes } of uploads) fs.writeFileSync(path.join(releaseDir, id + '.zip'), bytes);
    }
    const summary = `Catalogue PAN : ${manifest.totals.found} flux GTFS, ${manifest.totals.ok || 0} téléchargés/validés, ${manifest.totals.unchanged || 0} inchangés, ${manifest.totals.error || 0} en erreur.`;
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Collecteur GTFS national\n\n' + summary + '\n');
  })().catch((error) => {
    console.error('Collecteur GTFS national : échec —', error.message);
    process.exitCode = 1;
  });
}
