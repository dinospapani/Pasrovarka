// Network first for the app's own files so updates arrive at once; cache is the offline fallback.
// Weather APIs and fonts are cross-origin and always go straight to the network.
importScripts('forecast.js');
const V = 'psarovarka-v31z375';
const CFG = 'psaro-cfg';
const SHELL = ['./', 'apple-touch-icon.png', 'push-config.js', 'index.html','startpick.js','divelog.js','ruler.js','windwatch.js','windmap.js','windlocal.js','seastate.js','tripform.js','plotterscan.js','boat.js','cx_index.json','inbox.js', 'style.css', 'app.js', 'species.js', 'cy100.js','cy100-en.js','i18n.js','cloud.js','extras.js','ext.js','track.js','mapwx.js','tripui.js','dialog.js','units.js','version.js','range.js','gearstats.js', 'coords.js','techs.js','tackle.js','knots.js','orient.js','todayloc.js','tackle-lib.js','tackle-guide.js','gear.js','hist.js','bitewx.js','profile-view.js','navigator.js','navigator-mpa.json','bathy-lines.js','direct.js','sea.js','cards.js','tools.js','ports.js','route.js','redesign.js','redesign.css','dams.js','smart.js','insights.js','speciespick.js','regions.js','community.js','forecast-tab.js','coastgrid.js','exposure.js','fish-photos.js', 'rules.js', 'zones.js', 'forecast.js', 'personal.js', 'mine-tab.js','knowledge.js','advisor.js', 'diag.js', 'leaflet.js', 'leaflet.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const cfgUrl = () => new URL('__cfg', self.registration.scope).href;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
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
    fetch(new Request(e.request, { cache: 'no-cache' }))
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
/* ιστορικό ειδοποιήσεων στη συσκευή (το διαβάζει το inbox.js της σελίδας) */
const inboxUrl = () => new URL('__inbox', self.registration.scope).href;
async function inboxAdd(it) {
  try {
    const c = await caches.open(CFG), r = await c.match(inboxUrl());
    let a = []; try { a = r ? await r.json() : []; } catch (e) { a = []; }
    if (!Array.isArray(a)) a = [];
    if (it.id && a.some(x => x.id === it.id)) return;
    a.unshift(it); a = a.slice(0, 400);
    await c.put(inboxUrl(), new Response(JSON.stringify(a)));
  } catch (e) {}
}
async function showMsg(m, src) {
  const id = m.id || ('n' + Date.now() + Math.random().toString(36).slice(2, 6));
  const it = { id, at: m.at || new Date().toISOString(), kind: m.kind || 'info', title: m.title || 'BiteCast', body: m.body || '', full: m.full || m.body || '', place: m.place || null, t: m.t || null, src: src || 'push' };
  await inboxAdd(it);
  await self.registration.showNotification(it.title, { body: it.body, tag: m.tag || ('bc-' + id), renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: self.registration.scope + '#inbox=' + encodeURIComponent(id) } });
}
async function runCheck() {
  const cfg = await readCfg();
  if (!cfg || !cfg.on || cfg.server) return;
  try {
    if (cfg.places && cfg.places.length) {
      const r = await PF.checkPlaces(cfg);
      cfg.notified = r.notified; await writeCfg(cfg);
      if (r.msgs && r.msgs.length) { for (const m of r.msgs) await showMsg({ title: m.title, body: m.body, full: m.full, kind: m.kind, id: m.key, place: m.place, t: m.t }, 'local'); }
      else if (r.items.length) await showMsg({ title: r.title, body: r.body, full: r.body, kind: 'info' }, 'local');
    }
  } catch (e) {}
}
self.addEventListener('periodicsync', e => { if (e.tag === 'psaro-forecast') e.waitUntil(runCheck()); });
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { try { d = { body: e.data.text() }; } catch (e2) {} }
  if (!d.body) d.body = 'Άνοιξε την εφαρμογή για την πρόγνωση.';
  e.waitUntil(showMsg(d, 'push').then(async () => {
    /* v31z366: τελεία/αριθμός στο εικονίδιο της εφαρμογής και ανανέωση της ένδειξης «αδιάβαστες» στις ανοιχτές σελίδες */
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(); } catch (x) {}
    try { const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); cs.forEach(c => c.postMessage({ inboxNew: 1 })); } catch (x) {}
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  const m = /#inbox=([^&]*)/.exec(url), id = m ? decodeURIComponent(m[1]) : null;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { if (id) c.postMessage({ inbox: id }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
