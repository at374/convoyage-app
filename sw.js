// Convoyage Ultra — service worker de l'application : met en cache l'interface (ouverture hors ligne).
// Les données des missions ne passent jamais par ce cache (elles sont gardées par l'application).
const CACHE = 'cp-app-walking-addresses-20261030';
const FICHIERS = ['./', 'index.html', 'style.css', 'app.js?v=gtfs-agenda-20261030', 'sncf-fallback.js?v=sncf-fallback-20261030', 'api.js', 'calc.js', 'edition.js', 'geo.js', 'retours.js', 'agenda.js', 'planning.js', 'filtres.js', 'facturation.js', 'etat.js', 'config.js', 'plateformes.js', 'routes-pricing.js', 'sibra-feed.js', 'sibra-planner.js', 'regional-routing.js?v=agenda-calculate-feedback-20261029', 'swiss-transport-api.js', 'transport-gtfs-worker-client.js', 'transport-gtfs-agenda.js', 'transport-walking.js', 'transport-gtfs-worker.js', 'transport-gtfs-time.js', 'transport-gtfs-federation.js', 'transport-gtfs-loader.js', 'transport-gtfs-index.js', 'transport-catalogue.js', 'transport-fares.js?v=fares-20261030', 'transport-ranking.js?v=ranking-20261030', 'transport-adapters.js?v=adapters-20261030', 'routes-ui.js', 'admin.js', 'manifest.webmanifest', 'icones/icone-192.png', 'icones/icone-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE && x !== 'cp-prefs').map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // serveur de données : jamais mis en cache ici
  // Explicit SIBRA refresh must never silently fall back to an older
  // cached timetable: return a network error when offline.
  if (u.pathname.includes('/data/sibra/sibra-') && u.pathname.endsWith('.json') &&
      u.searchParams.has('refresh')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }
  // Réseau d'abord (nouvelle version), cache si hors ligne.
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const copie = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copie)); return r; }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
// V77 : notification reçue alors que l'application est fermée (message chiffré, déchiffré par le téléphone).
// V160 : son des notifications réglable (préférence écrite par la page dans le cache cp-prefs).
function lirePrefs() { return caches.open('cp-prefs').then(c => c.match(new URL('prefs-notif', self.registration.scope).href)).then(r => r ? r.json() : {}).catch(() => ({})); }
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { texte: e.data ? e.data.text() : '' }; }
  // V90 : nouvelle mission Hiflow → bouton « Faire le devis » (page de devis Hiflow) ; toucher la notification ouvre la fiche de la mission.
  const devis = typeof d.devis === 'string' && /^https:\/\/partenaire\.expedicar\.com\/transfer\/\d{6,9}\/quotation$/.test(d.devis) ? d.devis : null;
  e.waitUntil(lirePrefs().then(pr => self.registration.showNotification(d.titre || 'Convoyage Ultra', { silent: pr.son === false, body: d.texte || 'Nouvelle alerte', tag: d.tag || 'cp', renotify: true, icon: 'icones/icone-192.png', badge: 'icones/icone-192.png',
    data: { url: d.url || './index.html#alertes', devis }, actions: devis ? [{ action: 'devis', title: '📱 Faire le devis' }] : [] })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const dn = e.notification.data || {};
  // V93 : « Faire le devis » → fiche de la mission dans Convoyage Ultra, d'où le bouton ouvre l'application Hiflow (devis possibles seulement dans l'application sur téléphone).
  const url = new URL(dn.url || './index.html#alertes', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => { const c = l.find(x => x.url.startsWith(self.registration.scope)); if (c) { c.navigate(url).catch(() => {}); return c.focus(); } return self.clients.openWindow(url); }));
});


