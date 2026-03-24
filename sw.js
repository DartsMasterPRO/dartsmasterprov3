const CACHE = 'dartsmasterpro-v4'; // ← zmieniaj ten numer przy każdej aktualizacji
const urls = ['/app.html', '/manifest.json', '/sw.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(urls).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Usuwa stare cache przy każdej aktualizacji
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(r => {
      if (!r || r.status !== 200) return r;
      const rc = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, rc));
      return r;
    }).catch(() => new Response('Offline')))
  );
});
