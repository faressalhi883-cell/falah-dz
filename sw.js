const CACHE='falahdz-v10';

const CORE_ASSETS=[
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './icons/icon-photo.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>Promise.allSettled(CORE_ASSETS.map(url=>cache.add(url))))
      .then(results=>{results.forEach((r,i)=>{if(r.status==='rejected')console.warn('فشل تخزين:',CORE_ASSETS[i],r.reason);});})
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
      .then(()=>self.clients.matchAll({includeUncontrolled:true,type:'window'}))
      .then(clients=>{clients.forEach(client=>client.postMessage({type:'SW_UPDATE'}));})
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  let url;
  try{url=new URL(request.url);}catch(err){return;}
  if(url.origin!==self.location.origin)return;

  if(url.pathname.endsWith('/favicon.ico')){
    event.respondWith(
      caches.match('./icons/icon-192.svg').then(cached=>{
        if(cached)return cached;
        return fetch(request).then(res=>{
          if(res&&res.ok){
            const copy=res.clone();
            event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
          }
          return res;
        }).catch(()=>new Response(null,{status:204}));
      })
    );
    return;
  }

  const isHTML=request.mode==='navigate'||(request.headers.get('accept')||'').includes('text/html');

  if(isHTML){
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(response&&response.ok){
            const copy=response.clone();
            event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
          }
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached||caches.match('./index.html')).then(cached=>cached||caches.match('./offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(cache=>
      cache.match(request).then(cached=>{
        const network=fetch(request).then(response=>{
          if(response&&response.ok){
            const copy=response.clone();
            event.waitUntil(cache.put(request,copy));
          }
          return response;
        }).catch(()=>cached||new Response('Offline',{status:504,headers:{'Content-Type':'text/plain; charset=utf-8'}}));
        if(cached){network.catch(()=>{});return cached;}
        return network;
      })
    )
  );
});
