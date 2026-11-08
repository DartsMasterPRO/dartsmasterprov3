// DartsMaster Pro — Service Worker v2
// • strony (/, /app): najpierw sieć (zawsze najnowsza wersja), bez sieci — kopia z cache
// • /media/* (intro, dźwięki, grafiki): z cache (pobierane raz)
// • nic spoza domeny (Firebase, Google Fonts) nie jest dotykane
const VERSION = 'dm-v2';
const PAGES = VERSION + '-pages';
const MEDIA = VERSION + '-media';
const PRECACHE_MEDIA = ['/media/win.mp3', '/media/180.mp3', '/media/rzutka.png', '/media/intro.mp4'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(MEDIA).then(c => Promise.all(PRECACHE_MEDIA.map(u => c.add(u).catch(() => {}))))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== PAGES && k !== MEDIA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(res) {
  // tylko pełne, poprawne odpowiedzi z naszej domeny (to był powód błędu „Cache PUT”)
  return res && res.status === 200 && res.type === 'basic';
}
async function put(cacheName, req, res) {
  try { const c = await caches.open(cacheName); await c.put(req, res); } catch (e) {}
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // media: cache → sieć
  if (url.pathname.startsWith('/media/')) {
    const ranged = req.headers.has('range');
    event.respondWith((async () => {
      const key = url.pathname;
      if (ranged) { // wideo prosi o kawałki — oddaj sieć, a offline pełny plik z cache
        try { return await fetch(req); } catch (e) { const hit = await caches.match(key); if (hit) return hit; throw e; }
      }
      const hit = await caches.match(key);
      if (hit) return hit;
      const res = await fetch(req);
      if (cacheable(res)) put(MEDIA, key, res.clone());
      return res;
    })());
    return;
  }

  // strony: sieć → cache
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (cacheable(res)) put(PAGES, url.pathname, res.clone());
        return res;
      } catch (e) {
        return (await caches.match(url.pathname)) ||
               (await caches.match(url.pathname.replace(/\.html$/, ''))) ||
               (await caches.match(url.pathname + '.html')) ||
               (await caches.match('/app')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // reszta (manifest, ikony): sieć → cache
  event.respondWith(
    fetch(req).then(res => { if (cacheable(res)) put(PAGES, req, res.clone()); return res; })
      .catch(() => caches.match(req))
  );
});
