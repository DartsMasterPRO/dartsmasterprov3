const CACHE_NAME = 'dartmaster-v1';

// Instalacja Service Worker'a
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: instalacja...');
  self.skipWaiting();
});

// Aktywacja Service Worker'a
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: aktywacja...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('🗑️ Usuwanie starego cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Przechwytywanie żądań - Network first
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignoruj żądania do innych domen i non-GET
  if (url.origin !== location.origin || request.method !== 'GET') {
    return;
  }

  // Network first - spróbuj pobrać, fallback do cache
  event.respondWith(
    fetch(request)
      .then(response => {
        // Jeśli OK, cache'uj i zwróć
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, cloned))
            .catch(err => console.warn('Cache put error:', err));
        }
        return response;
      })
      .catch(() => {
        // Jeśli offline, spróbuj z cache'a
        return caches.match(request);
      })
  );
});
