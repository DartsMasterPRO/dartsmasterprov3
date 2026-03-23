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
  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request).then(r=>{
      if(!r||r.status!==200)return r;
      const rc=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,rc));
      return r;
    }).catch(()=>new Response('Offline')))
  );
});
