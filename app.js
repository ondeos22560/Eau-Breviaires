const c=document.getElementById('map'),ctx=c.getContext('2d');
let center={lon:1.8131,lat:48.7075}, zoom=13.5, gps=null, dragging=false,last=null, data={water:[],hydro:[],commune:[]};
let gpsWatchId=null;
const tileCache=new Map();
const R=6378137;
function merc(lon,lat){let x=R*lon*Math.PI/180,y=R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));return{x,y}}
function inv(x,y){return{lon:x/R*180/Math.PI,lat:(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI}}
function scale(){return 256*Math.pow(2,zoom)/(2*Math.PI*R)}
function screen(lon,lat){let p=merc(lon,lat),m=merc(center.lon,center.lat),s=scale();return{x:c.width/(2*(devicePixelRatio||1))+(p.x-m.x)*s,y:c.height/(2*(devicePixelRatio||1))-(p.y-m.y)*s}}
function resize(){let d=devicePixelRatio||1;c.width=innerWidth*d;c.height=innerHeight*d;c.style.width=innerWidth+'px';c.style.height=innerHeight+'px';ctx.setTransform(d,0,0,d,0,0);draw()}
function grid(){ctx.fillStyle='#e6eee5';ctx.fillRect(0,0,innerWidth,innerHeight);ctx.strokeStyle='#cbd9cc';ctx.lineWidth=1;for(let x=0;x<innerWidth;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,innerHeight);ctx.stroke()}for(let y=0;y<innerHeight;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(innerWidth,y);ctx.stroke()}}
function lonLatToTilePixel(lon,lat,z){const n=Math.pow(2,z),x=(lon+180)/360*n*256;const lr=lat*Math.PI/180,y=(1-Math.asinh(Math.tan(lr))/Math.PI)/2*n*256;return{x,y}}
function activeBasemap(){if(document.getElementById('satellite')?.checked)return'satellite';if(document.getElementById('online')?.checked)return'osm';return'local'}
function tileUrl(type,z,x,y){if(type==='osm')return`https://tile.openstreetmap.org/${z}/${x}/${y}.png`;return`https://wi.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`}
function drawTiles(type){
  const z=Math.max(0,Math.min(19,Math.round(zoom))),n=Math.pow(2,z),factor=Math.pow(2,zoom-z),tileSize=256*factor;
  const cp=lonLatToTilePixel(center.lon,center.lat,z),cx=cp.x*factor,cy=cp.y*factor;
  const left=cx-innerWidth/2,top=cy-innerHeight/2;
  const minX=Math.floor(left/tileSize),maxX=Math.floor((left+innerWidth)/tileSize),minY=Math.max(0,Math.floor(top/tileSize)),maxY=Math.min(n-1,Math.floor((top+innerHeight)/tileSize));
  for(let tx=minX;tx<=maxX;tx++)for(let ty=minY;ty<=maxY;ty++){
    const wrapped=((tx%n)+n)%n,key=`${type}/${z}/${wrapped}/${ty}`,sx=tx*tileSize-left,sy=ty*tileSize-top;
    let img=tileCache.get(key);
    if(!img){img=new Image();img.crossOrigin='anonymous';img.onload=()=>draw();img.onerror=()=>{img.failed=true;draw()};img.src=tileUrl(type,z,wrapped,ty);tileCache.set(key,img)}
    if(img.complete&&!img.failed&&img.naturalWidth)ctx.drawImage(img,sx,sy,tileSize+1,tileSize+1);
  }
}
function point(lon,lat,r,fill,stroke='#fff'){let p=screen(lon,lat);ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke();return p}
function line(coords,color='#2681a6',w=2){ctx.beginPath();coords.forEach((q,i)=>{let p=screen(q[0],q[1]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke()}
function drawFeature(f,color){let g=f.geometry;if(!g)return;if(g.type==='Point')point(g.coordinates[0],g.coordinates[1],6,color);if(g.type==='LineString')line(g.coordinates,color,2);if(g.type==='MultiLineString')g.coordinates.forEach(x=>line(x,color,2));}
function updateAttribution(type){const el=document.getElementById('attribution');if(type==='osm'){el.innerHTML='© OpenStreetMap contributors';el.classList.remove('hidden')}else if(type==='satellite'){el.innerHTML='Satellite © Esri et contributeurs';el.classList.remove('hidden')}else el.classList.add('hidden')}
function draw(){const base=activeBasemap();grid();if(base!=='local')drawTiles(base);updateAttribution(base);if(document.getElementById('showHydro').checked)data.hydro.forEach(f=>drawFeature(f,'#2585ad'));if(document.getElementById('showWater').checked)data.water.forEach(f=>drawFeature(f,'#1976a8'));if(document.getElementById('showCommune').checked)data.commune.forEach(f=>drawFeature(f,'#496d54'));if(gps)point(gps.lon,gps.lat,7,'#d22')}
async function load(){for(const [k,f] of [['water','data/plans_eau.geojson'],['hydro','data/hydrographie.geojson'],['commune','data/commune.geojson']]){try{let j=await fetch(f);data[k]=(await j.json()).features||[]}catch(e){}}draw()}
function coordFromEvent(e){let rect=c.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}}
c.addEventListener('pointerdown',e=>{dragging=true;last=coordFromEvent(e);c.setPointerCapture(e.pointerId)});c.addEventListener('pointermove',e=>{if(!dragging)return;let p=coordFromEvent(e),dx=p.x-last.x,dy=p.y-last.y,m=merc(center.lon,center.lat),s=scale();center=inv(m.x-dx/s,m.y+dy/s);last=p;draw()});c.addEventListener('pointerup',()=>{dragging=false});c.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(10,Math.min(18,zoom+(e.deltaY<0?.5:-.5)));draw()},{passive:false});
c.addEventListener('click',e=>{if(Math.abs(e.movementX||0)+Math.abs(e.movementY||0)>3)return;let p=coordFromEvent(e),best=null,bd=18;data.water.forEach(f=>{if(f.geometry?.type!=='Point')return;let q=screen(...f.geometry.coordinates),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){best=f;bd=d}});if(best){let a=best.properties||{};popup.innerHTML=`<button onclick="popup.classList.add('hidden')">×</button><b>${a.nom||'Point d’eau'}</b>${a.type||''}<br><small>Source : ${a.source||'non renseignée'}<br>Potabilité : ${a.potabilite||'non renseignée'}<br>${a.statut||''}</small>`;popup.classList.remove('hidden')}});
layersBtn.onclick=()=>panel.classList.toggle('hidden');['showWater','showHydro','showCommune'].forEach(id=>document.getElementById(id).onchange=draw);
function setBasemap(which){online.checked=which==='osm';satellite.checked=which==='satellite';status.textContent=which==='osm'?'Fond OpenStreetMap en ligne':which==='satellite'?'Fond satellite en ligne':'Mode hors ligne prêt • données locales';draw()}
online.onchange=()=>setBasemap(online.checked?'osm':'local');satellite.onchange=()=>setBasemap(satellite.checked?'satellite':'local');
gpsBtn.onclick=()=>{
  if(!navigator.geolocation){status.textContent='GPS non disponible';return}
  if(gpsWatchId!==null){navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null;gpsBtn.classList.remove('active');status.textContent='GPS arrêté';return}
  status.textContent='Recherche GPS…';gpsBtn.classList.add('active');
  gpsWatchId=navigator.geolocation.watchPosition(p=>{gps={lon:p.coords.longitude,lat:p.coords.latitude,acc:p.coords.accuracy};center={lon:gps.lon,lat:gps.lat};zoom=16;status.textContent=`GPS actif • précision ±${Math.round(gps.acc)} m`;draw()},e=>{gpsBtn.classList.remove('active');gpsWatchId=null;status.textContent='GPS : '+e.message},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});addEventListener('resize',resize);resize();load();
