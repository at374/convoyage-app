// Convoyage Ultra — service worker de l'application : met en cache l'interface (ouverture hors ligne).
// Les données des missions ne passent jamais par ce cache (elles sont gardées par l'application).
const CACHE = 'cp-app-transport-results-cards-20261125-v237';
const FICHIERS = ['./', 'index.html', 'account-storage.js', 'style.css?v=tad-main-20261124a', 'app.js?v=marches-auto-20261125', 'sncf-fallback.js?v=terminus-trains-20261125', 'api.js?v=account-20261125', 'calc.js', 'edition.js', 'geo.js?v=adresses-marche-20261125', 'retours.js', 'agenda.js', 'planning.js', 'filtres.js?v=deliverycar-balaye-20261125', 'facturation.js?v=account-20261125', 'etat.js?v=account-20261125', 'config.js', 'plateformes.js?v=account-20261125', 'routes-pricing.js?v=account-20261125', 'sanef-gps-protection.js', 'sibra-feed.js?v=325-json-timeout', 'sibra-planner.js', 'transport-blablacar-realtime.js?v=bus-relay-20261031', 'transport-tripgo.js?v=account-20261125', 'regional-routing.js?v=terminus-bus-20261125', 'swiss-transport-api.js?v=hub-20261113', 'transport-gtfs-worker-client.js', 'transport-gtfs-agenda.js?v=hub-20261120a', 'transport-walking.js?v=marches-auto-20261125', 'transport-gtfs-worker.js', 'transport-hub-local-worker.js?v=transferts-gtfs-20261125', 'transport-gtfs-fares.js', 'transport-gtfs-time.js', 'transport-gtfs-federation.js?v=transferts-gtfs-20261125', 'transport-gtfs-federation.js?v=transferts-gtfs-20261125', 'transport-gtfs-loader.js', 'transport-gtfs-flex-courses.js', 'transport-gtfs-index.js?v=proximite-gtfs-20261125', 'transport-catalogue.js?v=gtfs-streaming-fallback-20261121a', 'transport-fares.js?v=fares-leg-labels-20261102', 'transport-sibra-pass.js?v=sibra-pass-y51-20261031', 'transport-y51-fares.js?v=y51-fares-20261120', 'transport-ranking.js?v=ranking-min5-20261031', 'transport-adapters.js?v=adapters-20261030', 'routes-ui.js?v=account-20261125', 'admin.js?v=account-20261125', 'manifest.webmanifest', 'icones/icone-192.png', 'icones/icone-512.png', 'icones/icone-masquable-512.png', 'transport-fare-grids.js?v=hub-20261115e', 'transport-ojp.js?v=ojp-20261115a', 'transport-otp-adapter.js?v=otp-gtfsid-horaires-20261123a', 'transport-otp-client.js?v=terminus-bus-20261125', 'transport-mission-hub.js?v=repli-reseaux-20261126', 'transport-coverage.js?v=p35-bfc-cherpa-20261121a', 'transport-national-gtfs-journeys.js?v=index-mission-20261125'];
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
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok && r.type !== 'opaque') { const copie = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copie)).catch(() => {})); } return r; }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
// V77 : notification reçue alors que l'application est fermée (message chiffré, déchiffré par le téléphone).
// V160 : son des notifications réglable (préférence écrite par la page dans le cache cp-prefs).
function lirePrefs() { return caches.open('cp-prefs').then(c => c.match(new URL('prefs-notif', self.registration.scope).href)).then(r => r ? r.json() : {}).catch(() => ({})); }
self.addEventListener('push', e => {
  e.waitUntil(lirePrefs().then(pr => {
    if (!pr.on) return;
    return self.registration.showNotification('Convoyage Ultra', {
      silent: pr.son === false, body: 'Ouvre Convoyage Ultra pour consulter tes alertes.',
      tag: 'cp', icon: 'icones/icone-192.png', data: { url: './index.html#alertes' }
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const dn = e.notification.data || {};
  const url = new URL(dn.url || './index.html#alertes', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => { const c = l.find(x => x.url.startsWith(self.registration.scope)); if (c) { c.navigate(url).catch(() => {}); return c.focus(); } return self.clients.openWindow(url); }));
});


