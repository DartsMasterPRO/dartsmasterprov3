const CACHE='dartsmasterpro-v3';
const urls=['/'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(urls).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch',e=>{
  // Pomiń żądania inne niż GET (POST, PUT, DELETE itp.)
  if(e.request.method !== 'GET') return;

  // Pomiń zewnętrzne URL (Firebase, Google APIs, CDN itp.)
  const url = new URL(e.request.url);
  const isExternal = url.origin !== self.location.origin;
  if(isExternal) return;

  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request).then(r=>{
      if(!r||r.status!==200)return r;
      const rc=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,rc));
      return r;
    }).catch(()=>new Response('Offline')))
  );
});
