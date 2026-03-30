const CACHE_NAME = 'dartmaster-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-maskable-192x192.png',
  './icon-maskable-512x512.png'
];

// Instalacja Service Worker'a
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: instalacja...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache otwarty');
        return cache.addAll(ASSETS_TO_CACHE)
          .catch(err => {
            console.warn('⚠️ Nie wszystkie pliki zostały cache\'owane:', err);
          });
      })
      .then(() => self.skipWaiting())
  );
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

// Przechwytywanie żądań (Network First dla dynamicznych, Cache First dla statycznych)
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignoruj żądania do innych domen
  if (url.origin !== location.origin) {
    return;
  }

  // Cache first dla zasobów statycznych
  if (request.method === 'GET' && /\.(js|css|png|jpg|svg|woff|woff2)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request))
        .catch(() => {
          // Fallback jeśli brak i w cache i nie ma internetu
          console.warn('⚠️ Nie można załadować:', url.pathname);
        })
    );
    return;
  }

  // Network first dla dokumentów HTML (aby zawsze była najnowsza wersja)
  if (request.method === 'GET' && /\.html$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache'uj pomyślne odpowiedzi
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Jeśli offline, użyj cache'u
          return caches.match(request);
        })
    );
    return;
  }

  // Domyślnie: network z fallbackiem do cache
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});
