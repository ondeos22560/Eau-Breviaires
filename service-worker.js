const CACHE='eau-breviaires-v30';
const TILES='eau-breviaires-tuiles';
const MAX_TILES=800;
const CORE=['./','./index.html','./style.css','./app.js','./manifest.json','./docs/Installation_Eau_Breviaires.pdf','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-512-maskable.png','./data/eau.geojson','./data/sources.geojson','./data/points_eau.geojson','./data/plans_eau.geojson','./data/hydrographie.geojson','./data/commune.geojson'];
const TILE_HOSTS=['tile.openstreetmap.org','data.geopf.fr'];
// Installation : tout le nécessaire hors ligne est téléchargé d'un coup (sans passer par le cache HTTP).
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting())));
// Activation : on supprime les anciennes versions, mais on garde les tuiles déjà vues.
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==TILES).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
function tileKey(url){const u=new URL(url);u.searchParams.delete('_retry');return u.toString()}
async function trimTiles(c){const ks=await c.keys();if(ks.length>MAX_TILES)await Promise.all(ks.slice(0,ks.length-MAX_TILES).map(k=>c.delete(k)))}
// Fonds de carte : réseau d'abord (4 s max), sinon la tuile déjà vue.
async function tileResponse(req){
  const key=tileKey(req.url),c=await caches.open(TILES);
  try{
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),4000);
    const resp=await fetch(req,{signal:ctl.signal});clearTimeout(t);
    if(resp&&resp.ok&&resp.type!=='opaque'){await c.put(key,resp.clone());trimTiles(c)}
    return resp;
  }catch(err){
    const hit=await c.match(key);
    if(hit)return hit;
    return Response.error();
  }
}
// Application : on sert le cache immédiatement (marche sans réseau et avec un réseau faible),
// puis on rafraîchit en arrière-plan quand le réseau répond.
async function appResponse(e){
  const req=e.request,isNav=req.mode==='navigate';
  const c=await caches.open(CACHE);
  const hit=await c.match(req,{ignoreSearch:true})||(isNav?await c.match('./index.html'):null);
  const refresh=fetch(req,{cache:'no-store'}).then(resp=>{if(resp&&resp.ok&&resp.status===200)c.put(req,resp.clone());return resp});
  if(hit){e.waitUntil(refresh.catch(()=>{}));return hit}
  try{return await refresh}catch(err){return isNav?Response.error():new Response('',{status:504,statusText:'Hors ligne'})}
}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin===location.origin){e.respondWith(appResponse(e));return}
  if(TILE_HOSTS.includes(u.hostname))e.respondWith(tileResponse(e.request));
});
