/* Παλιά διεύθυνση: ο service worker σβήνει τον εαυτό του και στέλνει τις ανοιχτές σελίδες στη νέα διεύθυνση (/Alkyon).
   ΔΕΝ σβήνει caches: ο «τόπος» (dinospapani.github.io) είναι κοινός με τη νέα εφαρμογή. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(self.registration.unregister().then(() => self.clients.matchAll({ type: 'window' })).then(cs => Promise.all(cs.map(c => {
    const u = new URL(c.url); const p = u.pathname.replace(/^\/[Pp]asrovarka/, '/Alkyon');
    return c.navigate(u.origin + p + u.search + u.hash).catch(() => {});
  }))));
});
self.addEventListener('fetch', () => {});
