const c=document.getElementById('map'),ctx=c.getContext('2d');
let center={lon:1.8131,lat:48.7075}, zoom=13.5, gps=null, dragging=false,last=null, addMode=false, addLocation=null, userPoints=[], data={water:[],sources:[],points:[],hydro:[],commune:[]};
let gpsWatchId=null;
const tileCache=new Map();
const R=6378137;
function merc(lon,lat){let x=R*lon*Math.PI/180,y=R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));return{x,y}}
function inv(x,y){return{lon:x/R*180/Math.PI,lat:(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI}}
function scale(){return 256*Math.pow(2,zoom)/(2*Math.PI*R)}
function viewportSize(){const r=c.getBoundingClientRect();return{w:r.width||document.documentElement.clientWidth,h:r.height||document.documentElement.clientHeight}}
function screen(lon,lat){let p=merc(lon,lat),m=merc(center.lon,center.lat),s=scale(),v=viewportSize();return{x:v.w/2+(p.x-m.x)*s,y:v.h/2-(p.y-m.y)*s}}
function resize(){let d=devicePixelRatio||1,v=viewportSize(),w=Math.round(v.w*d),h=Math.round(v.h*d);if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;ctx.setTransform(d,0,0,d,0,0);draw()}
function grid(){const v=viewportSize();ctx.fillStyle='#e6eee5';ctx.fillRect(0,0,v.w,v.h);ctx.strokeStyle='#cbd9cc';ctx.lineWidth=1;for(let x=0;x<v.w;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,v.h);ctx.stroke()}for(let y=0;y<v.h;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(v.w,y);ctx.stroke()}}
function lonLatToTilePixel(lon,lat,z){const n=Math.pow(2,z),x=(lon+180)/360*n*256;const lr=lat*Math.PI/180,y=(1-Math.asinh(Math.tan(lr))/Math.PI)/2*n*256;return{x,y}}
function activeBasemap(){if(document.getElementById('satellite')?.checked)return'satellite';if(document.getElementById('online')?.checked)return'osm';return'local'}
function tileUrl(type,z,x,y){if(type==='osm')return`https://tile.openstreetmap.org/${z}/${x}/${y}.png`;return`https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`}
function drawTiles(type){
  const z=Math.max(0,Math.min(19,Math.round(zoom))),n=Math.pow(2,z),factor=Math.pow(2,zoom-z),tileSize=256*factor;
  const cp=lonLatToTilePixel(center.lon,center.lat,z),cx=cp.x*factor,cy=cp.y*factor;
  const v=viewportSize(),left=cx-v.w/2,top=cy-v.h/2;
  const minX=Math.floor(left/tileSize),maxX=Math.floor((left+v.w)/tileSize),minY=Math.max(0,Math.floor(top/tileSize)),maxY=Math.min(n-1,Math.floor((top+v.h)/tileSize));
  for(let tx=minX;tx<=maxX;tx++)for(let ty=minY;ty<=maxY;ty++){
    const wrapped=((tx%n)+n)%n,key=`${type}/${z}/${wrapped}/${ty}`,sx=tx*tileSize-left,sy=ty*tileSize-top;
    let img=tileCache.get(key);
    if(!img){img=new Image();img.crossOrigin='anonymous';img.retryCount=0;img.onload=()=>{img.failed=false;draw()};img.onerror=()=>{img.failed=true;if(type==='satellite'&&img.retryCount<3){img.retryCount++;setTimeout(()=>{img.failed=false;img.src=tileUrl(type,z,wrapped,ty)+'&_retry='+img.retryCount},500*img.retryCount)}else draw()};img.src=tileUrl(type,z,wrapped,ty);tileCache.set(key,img)}
    if(img.complete&&!img.failed&&img.naturalWidth)ctx.drawImage(img,sx,sy,tileSize+1,tileSize+1);
  }
}
function point(lon,lat,r,fill,stroke='#fff'){let p=screen(lon,lat);ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=stroke;ctx.stroke();return p}
function line(coords,color='#087fb5',w=3){const pts=coords.map(q=>screen(q[0],q[1]));if(!pts.length)return;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='rgba(255,255,255,.88)';ctx.lineWidth=w+4;ctx.stroke();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke()}
function polygon(rings,fill='rgba(0,126,183,.28)',stroke='#007eb7'){rings.forEach(ring=>{ctx.beginPath();ring.forEach((q,i)=>{const p=screen(q[0],q[1]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=stroke;ctx.lineWidth=2.5;ctx.stroke()})}
function drawFeature(f,color,kind='generic'){let g=f.geometry;if(!g)return;if(g.type==='Point')point(g.coordinates[0],g.coordinates[1],zoom<14?7:6,color);if(g.type==='LineString'&&zoom>=12.5)line(g.coordinates,color,3);if(g.type==='MultiLineString'&&zoom>=12.5)g.coordinates.forEach(x=>line(x,color,3));if(g.type==='Polygon'&&zoom>=13.5)polygon(g.coordinates);if(g.type==='MultiPolygon'&&zoom>=13.5)g.coordinates.forEach(x=>polygon(x))}
function featureCenter(f){const g=f.geometry;if(!g)return null;if(g.type==='Point')return g.coordinates;if(g.type==='Polygon'&&g.coordinates?.[0]?.length){const a=g.coordinates[0];return [a.reduce((s,q)=>s+q[0],0)/a.length,a.reduce((s,q)=>s+q[1],0)/a.length]}if(g.type==='MultiPolygon'&&g.coordinates?.[0]?.[0]?.length){const a=g.coordinates[0][0];return [a.reduce((s,q)=>s+q[0],0)/a.length,a.reduce((s,q)=>s+q[1],0)/a.length]}return null}
function updateAttribution(type){const el=document.getElementById('attribution');if(type==='osm'){el.innerHTML='© OpenStreetMap contributors';el.classList.remove('hidden')}else if(type==='satellite'){el.innerHTML='Photographies aériennes © IGN';el.classList.remove('hidden')}else el.classList.add('hidden')}
function draw(){const base=activeBasemap();grid();if(base!=='local')drawTiles(base);updateAttribution(base);if(document.getElementById('showHydro').checked)data.hydro.forEach(f=>drawFeature(f,'#087fb5','hydro'));if(document.getElementById('showWater').checked)data.water.forEach(f=>drawFeature(f,'#007eb7','water'));if(document.getElementById('showSources').checked)data.sources.forEach(f=>drawFeature(f,'#00a86b','source'));if(document.getElementById('showPoints').checked)data.points.forEach(f=>drawFeature(f,'#7a5cff','point'));if(document.getElementById('showUserPoints').checked)userPoints.forEach(f=>drawFeature(f,'#d7191c','point'));if(addLocation)point(addLocation.lon,addLocation.lat,8,'#d7191c','#fff');if(document.getElementById('showCommune').checked)data.commune.forEach(f=>drawFeature(f,'#496d54'));if(gps){const gp=screen(gps.lon,gps.lat);if(gps.acc){const rr=Math.min(80,Math.max(10,gps.acc*scale()));ctx.beginPath();ctx.arc(gp.x,gp.y,rr,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.16)';ctx.fill();ctx.strokeStyle='rgba(20,20,20,.38)';ctx.lineWidth=1.5;ctx.stroke()}point(gps.lon,gps.lat,11,'#ffffff','#263238');point(gps.lon,gps.lat,7,'#00d4d8','#ffffff');point(gps.lon,gps.lat,3,'#00d4d8','#263238')}}
async function load(){
  const sources=[['water','data/plans_eau.geojson'],['sources','data/sources.geojson'],['points','data/points_eau.geojson'],['hydro','data/hydrographie.geojson'],['commune','data/commune.geojson']];
  const errors=[];
  for(const [k,f] of sources){
    try{
      const j=await fetch(f,{cache:'no-store'});
      if(!j.ok)throw new Error(`HTTP ${j.status}`);
      const geo=await j.json();
      data[k]=Array.isArray(geo.features)?geo.features:[];
    }catch(e){errors.push(`${k}: ${e.message}`)}
  }
  const waterLabel=document.querySelector('label[for="showWater"]');
  if(waterLabel)waterLabel.innerHTML=`<span class="dot water"></span>Mares / plans d'eau (${data.water.length})`;
  const sourceLabel=document.querySelector('label[for="showSources"]');if(sourceLabel)sourceLabel.innerHTML=`<span class="dot source"></span>Sources / résurgences (${data.sources.length})`;
  const pointLabel=document.querySelector('label[for="showPoints"]');if(pointLabel)pointLabel.innerHTML=`<span class="dot other-water"></span>Autres points d'eau (${data.points.length})`;
  const userPointLabel=document.querySelector('label[for="showUserPoints"]');if(userPointLabel)userPointLabel.innerHTML=`<span class="dot user-point"></span>Points nouveaux (${userPoints.length})`;
  const hydroLabel=document.querySelector('label[for="showHydro"]');if(hydroLabel)hydroLabel.innerHTML=`<span class="line-key hydro-key"></span>Hydrographie (${data.hydro.length})`;
  status.textContent=errors.length?`Données partielles • ${data.water.length} points d’eau chargés`:'';
  draw();
}
function coordFromEvent(e){let rect=c.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}}
const pointers=new Map();let pinchDistance=null;
function pointerDistance(){const a=[...pointers.values()];return a.length<2?null:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}
c.addEventListener('pointerdown',e=>{const p=coordFromEvent(e);pointers.set(e.pointerId,p);c.setPointerCapture(e.pointerId);if(pointers.size===1){dragging=true;last=p}else{dragging=false;pinchDistance=pointerDistance()}});
c.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=coordFromEvent(e);pointers.set(e.pointerId,p);if(pointers.size>=2){const d=pointerDistance();if(pinchDistance&&d){zoom=Math.max(10,Math.min(19,zoom+Math.log2(d/pinchDistance)));pinchDistance=d;draw()}return}if(!dragging)return;let dx=p.x-last.x,dy=p.y-last.y,m=merc(center.lon,center.lat),s=scale();center=inv(m.x-dx/s,m.y+dy/s);last=p;draw()});
function endPointer(e){pointers.delete(e.pointerId);pinchDistance=null;if(pointers.size===1){dragging=true;last=[...pointers.values()][0]}else dragging=false}
c.addEventListener('pointerup',endPointer);c.addEventListener('pointercancel',endPointer);c.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(10,Math.min(19,zoom+(e.deltaY<0?.5:-.5)));draw()},{passive:false});
function closePopup(){popup.classList.add('hidden');popup.style.left='';popup.style.top=''}
function placePopup(p){const margin=10,v=viewportSize(),w=Math.min(390,v.w-24);let left=Math.max(margin,Math.min(v.w-w-margin,p.x-w/2));let top=p.y+16;popup.style.width=w+'px';popup.style.left=left+'px';popup.style.top=top+'px';popup.style.bottom='auto';popup.style.transform='none';popup.classList.remove('hidden');requestAnimationFrame(()=>{const h=popup.offsetHeight;if(top+h>v.h-margin){top=Math.max(margin,p.y-h-16);popup.style.top=top+'px'}})}
function removeUserPoint(f){const i=userPoints.indexOf(f);if(i<0)return;if(!confirm('Supprimer définitivement ce point ajouté ?'))return;userPoints.splice(i,1);localStorage.setItem('eauBreviairesUserPoints',JSON.stringify(userPoints));closePopup();const userPointLabel=document.querySelector('label[for="showUserPoints"]');if(userPointLabel)userPointLabel.innerHTML=`<span class="dot user-point"></span>Points nouveaux (${userPoints.length})`;status.textContent='Point utilisateur supprimé';draw()}
function showFeaturePopup(f,p){const a=f.properties||{},isUser=userPoints.includes(f);if(isUser){const description=a.description||a.commentaire||a.nom||'';popup.innerHTML=`<button class="popup-close" type="button" aria-label="Fermer">×</button><b>Point nouveau</b><br><small>${description?`Description : ${description}`:'Aucune description'}</small><button class="remove-user-point" type="button">Supprimer ce point</button>`}else{popup.innerHTML=`<button class="popup-close" type="button" aria-label="Fermer">×</button><b>${a.nom||a.name||'Point d’eau'}</b>${a.type||a.nature||''}<br><small>Source : ${a.source||'non renseignée'}<br>Potabilité : ${a.potabilite||'non renseignée'}<br>${a.statut||''}${a.commentaire?`<br>Commentaire : ${a.commentaire}`:''}</small>`}popup.querySelector('.popup-close').onclick=closePopup;if(isUser)popup.querySelector('.remove-user-point').onclick=()=>removeUserPoint(f);placePopup(p)}
c.addEventListener('click',e=>{if(Math.abs(e.movementX||0)+Math.abs(e.movementY||0)>3)return;let p=coordFromEvent(e);if(addMode){const m=merc(center.lon,center.lat),s=scale(),v=viewportSize(),ll=inv(m.x+(p.x-v.w/2)/s,m.y-(p.y-v.h/2)/s);addLocation=ll;addCoords.textContent=`Position : ${ll.lat.toFixed(6)}, ${ll.lon.toFixed(6)}`;addForm.classList.remove('hidden');addMode=false;status.textContent='Compléter la fiche du point';draw();return}let best=null,bd=22;const userCandidates=showUserPoints.checked?userPoints:[];userCandidates.forEach(f=>{const cc=featureCenter(f);if(!cc)return;let q=screen(...cc),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){best=f;bd=d}});if(!best){const officialCandidates=[...(showWater.checked?data.water:[]),...(showSources.checked?data.sources:[]),...(showPoints.checked?data.points:[])];officialCandidates.forEach(f=>{const cc=featureCenter(f);if(!cc)return;let q=screen(...cc),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){best=f;bd=d}})}if(best)showFeaturePopup(best,p);else closePopup()});
layersBtn.onclick=()=>{closePopup();panel.classList.toggle('hidden')};document.getElementById('closeLayers').onclick=()=>panel.classList.add('hidden');['showWater','showSources','showPoints','showUserPoints','showHydro','showCommune'].forEach(id=>document.getElementById(id).onchange=draw);
function setBasemap(which){online.checked=which==='osm';satellite.checked=which==='satellite';status.textContent='';draw()}
online.onchange=()=>setBasemap(online.checked?'osm':'local');satellite.onchange=()=>setBasemap(satellite.checked?'satellite':'local');
gpsBtn.onclick=()=>{
  if(!navigator.geolocation){status.textContent='GPS non disponible';return}
  if(gpsWatchId!==null){navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null;gpsBtn.classList.remove('active');status.textContent='GPS arrêté';return}
  status.textContent='Recherche GPS…';gpsBtn.classList.add('active');
  gpsWatchId=navigator.geolocation.watchPosition(p=>{gps={lon:p.coords.longitude,lat:p.coords.latitude,acc:p.coords.accuracy};center={lon:gps.lon,lat:gps.lat};zoom=16;status.textContent=`GPS actif • précision ±${Math.round(gps.acc)} m`;draw()},e=>{gpsBtn.classList.remove('active');gpsWatchId=null;status.textContent='GPS : '+e.message},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
};

try{userPoints=JSON.parse(localStorage.getItem('eauBreviairesUserPoints')||'[]');if(!Array.isArray(userPoints))userPoints=[]}catch(e){userPoints=[]}
addBtn.onclick=()=>{addMode=true;addLocation=null;closePopup();panel.classList.add('hidden');addForm.classList.add('hidden');status.textContent='Touchez la carte à l’emplacement du point à ajouter';draw()};
closeAdd.onclick=()=>{addForm.classList.add('hidden');addLocation=null;addMode=false;status.textContent='Ajout annulé';draw()};
removeAdd.onclick=()=>{addForm.classList.add('hidden');addLocation=null;addMode=false;status.textContent='Point retiré • ajout annulé';draw()};
saveAdd.onclick=()=>{if(!addLocation)return;const description=addDescription.value.trim();const f={type:'Feature',properties:{type:'Point nouveau',description,source:'Contribution utilisateur locale',statut:'À vérifier'},geometry:{type:'Point',coordinates:[addLocation.lon,addLocation.lat]}};userPoints.push(f);localStorage.setItem('eauBreviairesUserPoints',JSON.stringify(userPoints));addForm.classList.add('hidden');addDescription.value='';addLocation=null;const userPointLabel=document.querySelector('label[for="showUserPoints"]');if(userPointLabel)userPointLabel.innerHTML=`<span class="dot user-point"></span>Points nouveaux (${userPoints.length})`;
  const hydroLabel=document.querySelector('label[for="showHydro"]');if(hydroLabel)hydroLabel.innerHTML=`<span class="line-key hydro-key"></span>Hydrographie (${data.hydro.length})`;status.textContent='Point enregistré sur cet appareil • à vérifier';draw()};

setBasemap('osm');
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});addEventListener('resize',resize);if(window.visualViewport){visualViewport.addEventListener('resize',resize);visualViewport.addEventListener('scroll',resize)}resize();load();
