/* Acorn Trail's small hosted shell. Gameplay still lives entirely in index.html. */
const BASE=self.registration.scope;
const PREFIX='acorn-trail:'+new URL(BASE).pathname+':';
const CACHE=PREFIX+'shell-v1';
const INDEX=new URL('index.html',BASE).href;
const FILES=['index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png'];
const URLS=FILES.map(f=>new URL(f,BASE).href);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACORN_ACTIVATE_UPDATE'){event.waitUntil(self.skipWaiting());return;}
  if(event.data?.type==='ACORN_OFFLINE_STATUS')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    let ready=(await Promise.all(URLS.map(url=>cache.match(url)))).every(Boolean);
    if(!ready&&event.data.prepare){try{await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})));ready=true;}catch{}}
    event.ports[0]?.postMessage({ready});
  })());
});
async function navigation(request){
  const cache=await caches.open(CACHE),abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),4000);
  try{
    const response=await fetch(request,{signal:abort.signal});
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('Game unavailable');
    try{await cache.put(INDEX,response.clone());}catch{} // Keep online play available if storage fills up.
    return response;
  }catch{
    const saved=await cache.match(INDEX);
    return saved||new Response('Open Acorn Trail online once to save it for offline play.',{status:503,headers:{'Content-Type':'text/plain'}});
  }finally{clearTimeout(timer);}
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),base=new URL(BASE);
  if(request.method!=='GET'||url.origin!==base.origin)return;
  if(request.mode==='navigate'&&(url.pathname===base.pathname||url.pathname===new URL(INDEX).pathname)){
    event.respondWith(navigation(request));return;
  }
  const canonical=url.origin+url.pathname;
  if(URLS.includes(canonical))event.respondWith((async()=>{
    const cache=await caches.open(CACHE);return await cache.match(canonical)||fetch(request);
  })());
});
