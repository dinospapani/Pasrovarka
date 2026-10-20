// Network first for the app's own files so updates arrive at once; cache is the offline fallback.
// Weather APIs and fonts are cross-origin and always go straight to the network.
importScripts('forecast.js');
const V = 'psarovarka-v31z24';
const CFG = 'psaro-cfg';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'species.js', 'cy100.js','i18n.js','cloud.js','extras.js','track.js','mapwx.js','tripui.js','dialog.js','units.js','version.js', 'coords.js','gear.js','hist.js','profile-view.js','mpa.js','direct.js','sea.js','cards.js','tools.js','dams.js','smart.js','insights.js','speciespick.js','regions.js','community.js','forecast-tab.js','fish-photos.js', 'rules.js', 'zones.js', 'forecast.js', 'personal.js', 'mine-tab.js','knowledge.js','advisor.js', 'diag.js', 'leaflet.js', 'leaflet.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const cfgUrl = () => new URL('__cfg', self.registration.scope).href;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== CFG && k !== 'psaro-tiles').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'GET' && u.origin !== location.origin && /(^|\.)(arcgisonline\.com|tile\.openstreetmap\.org|openseamap\.org)$/.test(u.hostname)) {
    e.respondWith(caches.open('psaro-tiles').then(c => c.match(e.request.url, { ignoreVary: true })).then(r => r || fetch(e.request)));
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
async function readCfg() {
  try { const r = await (await caches.open(CFG)).match(cfgUrl()); return r ? await r.json() : null; } catch (e) { return null; }
}
async function writeCfg(cfg) {
  try { await (await caches.open(CFG)).put(cfgUrl(), new Response(JSON.stringify(cfg))); } catch (e) {}
}
async function runCheck() {
  const cfg = await readCfg();
  if (!cfg || !cfg.on || cfg.server) return;
  try {
    if (cfg.places && cfg.places.length) {
      const r = await PF.checkPlaces(cfg);
      cfg.notified = r.notified; await writeCfg(cfg);
      if (r.items.length) await self.registration.showNotification(r.title, { body: r.body, tag: 'psaro-ideal', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: self.registration.scope } });
    }
  } catch (e) {}
}
self.addEventListener('periodicsync', e => { if (e.tag === 'psaro-forecast') e.waitUntil(runCheck()); });
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { try { d = { body: e.data.text() }; } catch (e2) {} }
  e.waitUntil(self.registration.showNotification(d.title || 'BiteCast', { body: d.body || 'Άνοιξε την εφαρμογή για την πρόγνωση.', tag: 'psaro-ideal', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: self.registration.scope } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
