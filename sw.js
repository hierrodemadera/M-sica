/* Discos · funciona sin conexión.
   - La página: primero intenta la red (para recibir siempre la última versión); si no hay red o tarda más de 4 s, usa la copia guardada.
   - Portadas: se guardan la primera vez que se ven y después salen aunque no haya internet.
   - GitHub (guardar y descargar datos): siempre por la red; sin conexión, la app guarda en el aparato y sube al volver. */
const CACHE = 'discos-v1';
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(['./']).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=> Promise.all(ks.filter(k=> k !== CACHE).map(k=> caches.delete(k)))).then(()=> self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.hostname === 'api.github.com') return;
  const page = req.mode === 'navigate' || (url.origin === location.origin && /(\/|\.html)$/.test(url.pathname));
  const json = url.origin === location.origin && /\.json$/.test(url.pathname);
  if(page || json){ e.respondWith(networkFirst(req, page)); return; }
  if(url.hostname === 'raw.githubusercontent.com' || url.origin === location.origin){ e.respondWith(cacheFirst(req)); }
});
async function networkFirst(req, page){
  const c = await caches.open(CACHE);
  const key = page ? './' : req.url.split('?')[0];
  const net = fetch(req.url, { cache: 'no-store' }).then(r=>{ if(r.ok) c.put(key, r.clone()); return r; });
  const cached = ()=> c.match(key).then(m=> m || c.match(req, { ignoreSearch: true }));
  try{
    const r = await Promise.race([net, new Promise((_, rej)=> setTimeout(()=> rej(new Error('lento')), 4000))]);
    return r;
  }catch(err){
    const m = await cached();
    if(m) return m;
    return net;
  }
}
async function cacheFirst(req){
  const c = await caches.open(CACHE);
  const m = await c.match(req);
  if(m) return m;
  const r = await fetch(req);
  if(r.ok || r.type === 'opaque') c.put(req, r.clone());
  return r;
}
