const c=document.getElementById('map'),ctx=c.getContext('2d');
const statusEl=document.getElementById('status');
const infoBtn=document.getElementById('infoBtn'),infoPanel=document.getElementById('infoPanel'),closeInfo=document.getElementById('closeInfo');
let clickMoved=false,downPos=null,svMarker=null,svTimer=null,selectedHydro=null;
let center={lon:1.8131,lat:48.7075}, zoom=13.5, gps=null, dragging=false,last=null, addMode=false, streetViewMode=false, addLocation=null, userPoints=[], data={water:[],sources:[],points:[],hydro:[],commune:[]};
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
    if(!img){if(!navigator.onLine)continue;img=new Image();img.crossOrigin='anonymous';img.retryCount=0;img.onload=()=>{img.failed=false;draw()};img.onerror=()=>{img.failed=true;if(type==='satellite'&&img.retryCount<3){img.retryCount++;setTimeout(()=>{img.failed=false;img.src=tileUrl(type,z,wrapped,ty)+'&_retry='+img.retryCount},500*img.retryCount)}else{draw();setTimeout(()=>{if(tileCache.get(key)===img)tileCache.delete(key)},8000)}};img.src=tileUrl(type,z,wrapped,ty);tileCache.set(key,img);if(tileCache.size>600)tileCache.delete(tileCache.keys().next().value)}
    if(img.complete&&!img.failed&&img.naturalWidth)ctx.drawImage(img,sx,sy,tileSize+1,tileSize+1);
  }
}
function point(lon,lat,r,fill,stroke='#fff'){let p=screen(lon,lat);ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=stroke;ctx.stroke();return p}
function line(coords,color='#087fb5',w=3){const pts=coords.map(q=>screen(q[0],q[1]));if(!pts.length)return;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='rgba(255,255,255,.88)';ctx.lineWidth=w+4;ctx.stroke();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke()}
function highlightLine(coords){const pts=coords.map(q=>screen(q[0],q[1]));if(!pts.length)return;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='rgba(255,255,255,.96)';ctx.lineWidth=11;ctx.stroke();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#00a8e8';ctx.lineWidth=6;ctx.stroke();ctx.restore()}
function drawSelectedHydro(f){const g=f?.geometry;if(!g)return;if(g.type==='LineString')highlightLine(g.coordinates);if(g.type==='MultiLineString')g.coordinates.forEach(highlightLine)}
function polygon(rings,fill='rgba(0,126,183,.28)',stroke='#007eb7'){rings.forEach(ring=>{ctx.beginPath();ring.forEach((q,i)=>{const p=screen(q[0],q[1]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=stroke;ctx.lineWidth=2.5;ctx.stroke()})}
function drawFeature(f,color,kind='generic'){let g=f.geometry;if(!g)return;if(g.type==='Point')point(g.coordinates[0],g.coordinates[1],zoom<14?7:6,color);if(g.type==='LineString'&&zoom>=12.5)line(g.coordinates,color,3);if(g.type==='MultiLineString'&&zoom>=12.5)g.coordinates.forEach(x=>line(x,color,3));if(g.type==='Polygon'&&zoom>=13.5)polygon(g.coordinates);if(g.type==='MultiPolygon'&&zoom>=13.5)g.coordinates.forEach(x=>polygon(x))}
function featureCenter(f){const g=f.geometry;if(!g)return null;if(g.type==='Point')return g.coordinates;if(g.type==='Polygon'&&g.coordinates?.[0]?.length){const a=g.coordinates[0];return [a.reduce((s,q)=>s+q[0],0)/a.length,a.reduce((s,q)=>s+q[1],0)/a.length]}if(g.type==='MultiPolygon'&&g.coordinates?.[0]?.[0]?.length){const a=g.coordinates[0][0];return [a.reduce((s,q)=>s+q[0],0)/a.length,a.reduce((s,q)=>s+q[1],0)/a.length]}return null}
function updateAttribution(type){const el=document.getElementById('attribution');if(type==='osm'){el.innerHTML='© OpenStreetMap contributors';el.classList.remove('hidden')}else if(type==='satellite'){el.innerHTML='Photographies aériennes © IGN';el.classList.remove('hidden')}else el.classList.add('hidden')}
function draw(){const base=activeBasemap();grid();if(base!=='local')drawTiles(base);updateAttribution(base);if(document.getElementById('showHydro').checked)data.hydro.forEach(f=>drawFeature(f,'#087fb5','hydro'));if(document.getElementById('showWater').checked)data.water.forEach(f=>drawFeature(f,'#007eb7','water'));if(document.getElementById('showSources').checked)data.sources.forEach(f=>drawFeature(f,'#00a86b','source'));if(document.getElementById('showPoints').checked)data.points.forEach(f=>drawFeature(f,'#7a5cff','point'));if(document.getElementById('showUserPoints').checked)userPoints.forEach(f=>drawFeature(f,'#d7191c','point'));if(addLocation)point(addLocation.lon,addLocation.lat,8,'#d7191c','#fff');if(document.getElementById('showCommune').checked)data.commune.forEach(f=>drawFeature(f,'#496d54'));if(selectedHydro&&document.getElementById('showHydro').checked)drawSelectedHydro(selectedHydro);if(svMarker)drawSvPin();if(gps){const gp=screen(gps.lon,gps.lat);if(gps.acc){const rr=Math.min(80,Math.max(10,gps.acc*scale()));ctx.beginPath();ctx.arc(gp.x,gp.y,rr,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.16)';ctx.fill();ctx.strokeStyle='rgba(20,20,20,.38)';ctx.lineWidth=1.5;ctx.stroke()}point(gps.lon,gps.lat,11,'#ffffff','#263238');point(gps.lon,gps.lat,7,'#00d4d8','#ffffff');point(gps.lon,gps.lat,3,'#00d4d8','#263238')}}
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
  statusEl.textContent=errors.length?`Données partielles • ${data.water.length} points d’eau chargés`:'';
  draw();
}
function coordFromEvent(e){let rect=c.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}}
const pointers=new Map();let pinchDistance=null;
function pointerDistance(){const a=[...pointers.values()];return a.length<2?null:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}
c.addEventListener('pointerdown',e=>{const p=coordFromEvent(e);pointers.set(e.pointerId,p);c.setPointerCapture(e.pointerId);if(pointers.size===1){dragging=true;last=p;downPos=p;clickMoved=false}else{dragging=false;clickMoved=true;pinchDistance=pointerDistance()}});
c.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=coordFromEvent(e);pointers.set(e.pointerId,p);if(downPos&&Math.hypot(p.x-downPos.x,p.y-downPos.y)>8)clickMoved=true;if(pointers.size>=2){const d=pointerDistance();if(pinchDistance&&d){zoom=Math.max(10,Math.min(19,zoom+Math.log2(d/pinchDistance)));pinchDistance=d;draw()}return}if(!dragging)return;let dx=p.x-last.x,dy=p.y-last.y,m=merc(center.lon,center.lat),s=scale();center=inv(m.x-dx/s,m.y+dy/s);last=p;draw()});
function endPointer(e){pointers.delete(e.pointerId);pinchDistance=null;if(pointers.size===1){dragging=true;last=[...pointers.values()][0]}else dragging=false}
c.addEventListener('pointerup',endPointer);c.addEventListener('pointercancel',endPointer);c.addEventListener('wheel',e=>{
  e.preventDefault();
  const p=coordFromEvent(e),v=viewportSize(),oldScale=scale(),oldCenter=merc(center.lon,center.lat);
  const worldX=oldCenter.x+(p.x-v.w/2)/oldScale,worldY=oldCenter.y-(p.y-v.h/2)/oldScale;
  const newZoom=Math.max(10,Math.min(19,zoom+(e.deltaY<0?.5:-.5)));
  if(newZoom===zoom)return;
  zoom=newZoom;
  const newScale=scale();
  center=inv(worldX-(p.x-v.w/2)/newScale,worldY+(p.y-v.h/2)/newScale);
  draw();
},{passive:false});
function closePopup(){popup.classList.add('hidden');popup.style.left='';popup.style.top='';if(selectedHydro){selectedHydro=null;draw()}}
function updateUserPointTools(){const b=document.getElementById('exportKmlBtn');if(b)b.classList.toggle('hidden',userPoints.length===0)}
function persistUserPoints(){try{localStorage.setItem('eauBreviairesUserPoints',JSON.stringify(userPoints));return true}catch(e){return false}}
function clearSvMarker(redraw=true){svMarker=null;clearTimeout(svTimer);if(redraw)draw()}
function setSvMarker(lon,lat){svMarker={lon,lat};clearTimeout(svTimer);svTimer=setTimeout(()=>clearSvMarker(),30000);draw()}
function drawSvPin(){const p=screen(svMarker.lon,svMarker.lat);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#ff9800';ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.fillRect(-9,-9,18,18);ctx.strokeRect(-9,-9,18,18);ctx.lineWidth=1.5;ctx.strokeStyle='#263238';ctx.strokeRect(-9,-9,18,18);ctx.restore();ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fillStyle='#263238';ctx.fill()}
function openStreetView(lon,lat){if(!navigator.onLine)return false;const l=document.createElement('a');l.href=streetViewUrl(lon,lat);l.target='_blank';l.rel='noopener';document.body.appendChild(l);l.click();l.remove();return true}
function streetViewUrl(lon,lat){return`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`}
function xmlEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function isMobileDevice(){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Macintosh/i.test(navigator.userAgent))}
async function exportUserPointsKml(){
  if(!userPoints.length)return;
  const placemarks=userPoints.map((f,i)=>{const a=f.properties||{},q=f.geometry?.coordinates||[];if(q.length<2)return'';const d=a.description||`Point nouveau ${i+1}`,date=a.date_heure||'non renseignée',sv=streetViewUrl(q[0],q[1]),statut=a.statut||'À vérifier';
    const html=`<p><b>Description :</b> ${xmlEscape(d)}</p><p><b>Date/heure :</b> ${xmlEscape(date)}</p><p><b>Latitude :</b> ${q[1]}<br><b>Longitude :</b> ${q[0]}</p><p><b>Statut :</b> ${xmlEscape(statut)}</p><p><a href="${xmlEscape(sv)}">Ouvrir Street View</a></p>`;
    const nm=d.length>60?d.slice(0,57)+'…':d;
    return`<Placemark><name>${xmlEscape(nm)}</name><description><![CDATA[${html}]]></description><ExtendedData><Data name="description"><value>${xmlEscape(d)}</value></Data><Data name="date_heure"><value>${xmlEscape(date)}</value></Data><Data name="latitude"><value>${q[1]}</value></Data><Data name="longitude"><value>${q[0]}</value></Data><Data name="statut"><value>${xmlEscape(statut)}</value></Data><Data name="street_view"><value>${xmlEscape(sv)}</value></Data></ExtendedData><Point><coordinates>${q[0]},${q[1]},0</coordinates></Point></Placemark>`}).join('');
  const kml=`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Points nouveaux - Eau Les Bréviaires</name>${placemarks}</Document></kml>`;
  const KMLTYPE='application/vnd.google-earth.kml+xml',filename=`points_eau_breviaires_${new Date().toISOString().slice(0,10)}.kml`,blob=new Blob([kml],{type:KMLTYPE});
  let shareFailed=false;
  if(isMobileDevice()&&navigator.share){
    let toShare=null;
    try{const cands=[new File([kml],filename,{type:KMLTYPE}),new File([kml],filename,{type:'text/xml'}),new File([kml],filename,{type:'text/plain'})];toShare=navigator.canShare?cands.find(x=>navigator.canShare({files:[x]})):cands[0]}catch(e){toShare=null}
    if(toShare){try{await navigator.share({title:'Points nouveaux – Eau Les Bréviaires',text:'Points relevés sur le terrain.',files:[toShare]});statusEl.textContent=`${userPoints.length} point(s) partagé(s)`;return}catch(e){if(e&&e.name==='AbortError'){statusEl.textContent='Partage annulé';return}shareFailed=true}}else shareFailed=true;
  }
  const u=URL.createObjectURL(blob),l=document.createElement('a');l.href=u;l.download=filename;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
  statusEl.textContent=shareFailed?`Partage indisponible : ${userPoints.length} point(s) téléchargé(s) en KML`:`${userPoints.length} point(s) exporté(s) en KML`;
}
function placePopup(p){const margin=10,v=viewportSize(),w=Math.min(390,v.w-24);let left=Math.max(margin,Math.min(v.w-w-margin,p.x-w/2));let top=p.y+16;popup.style.width=w+'px';popup.style.left=left+'px';popup.style.top=top+'px';popup.style.bottom='auto';popup.style.transform='none';popup.classList.remove('hidden');requestAnimationFrame(()=>{const h=popup.offsetHeight;if(top+h>v.h-margin){top=Math.max(margin,p.y-h-16);popup.style.top=top+'px'}})}
function pointToSegmentDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,c2=vx*vx+vy*vy;if(!c2)return Math.hypot(p.x-a.x,p.y-a.y);const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/c2)),x=a.x+t*vx,y=a.y+t*vy;return Math.hypot(p.x-x,p.y-y)}
function ringContainsPoint(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=screen(ring[i][0],ring[i][1]),b=screen(ring[j][0],ring[j][1]);if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside}return inside}
function featureHitDistance(f,p){const g=f.geometry;if(!g)return Infinity;if(g.type==='Point'){const q=screen(g.coordinates[0],g.coordinates[1]);return Math.hypot(q.x-p.x,q.y-p.y)}if(g.type==='LineString'){if(zoom<12.5)return Infinity;let d=Infinity;for(let i=1;i<g.coordinates.length;i++)d=Math.min(d,pointToSegmentDistance(p,screen(...g.coordinates[i-1]),screen(...g.coordinates[i])));return d}if(g.type==='MultiLineString'){return Math.min(...g.coordinates.map(a=>featureHitDistance({geometry:{type:'LineString',coordinates:a}},p)))}if(g.type==='Polygon'){if(zoom<13.5)return Infinity;if(g.coordinates[0]&&ringContainsPoint(p,g.coordinates[0]))return 0;return Infinity}if(g.type==='MultiPolygon'){if(zoom<13.5)return Infinity;for(const poly of g.coordinates)if(poly[0]&&ringContainsPoint(p,poly[0]))return 0;return Infinity}return Infinity}
function featureName(f){const a=f.properties||{};return a.nom||a.TopoOH||a.name||a.type_carto||a.type||a.nature||'Élément hydrographique'}
function removeUserPoint(f){const i=userPoints.indexOf(f);if(i<0)return;if(!confirm('Supprimer définitivement ce point ajouté ?'))return;userPoints.splice(i,1);persistUserPoints();closePopup();const userPointLabel=document.querySelector('label[for="showUserPoints"]');if(userPointLabel)userPointLabel.innerHTML=`<span class="dot user-point"></span>Points nouveaux (${userPoints.length})`;statusEl.textContent='Point utilisateur supprimé';updateUserPointTools();draw()}
function showFeaturePopup(f,p){
  const a=f.properties||{},isUser=userPoints.includes(f);
  const esc=v=>xmlEscape(String(v??''));
  if(isUser){
    const description=a.description||a.commentaire||a.nom||'',q=f.geometry?.coordinates||[],date=a.date_heure||'';
    popup.innerHTML=`<button class="popup-close" type="button" aria-label="Fermer">×</button><div class="popup-title"><span class="popup-symbol user-symbol">+</span><div><b>Point nouveau</b><span class="popup-type user-type">Observation terrain</span></div></div><div class="popup-details">${description?`<div class="popup-row"><span>Description</span><strong>${esc(description)}</strong></div>`:'<div class="popup-row"><span>Description</span><strong>Aucune description</strong></div>'}${date?`<div class="popup-row"><span>Date / heure</span><strong>${esc(date)}</strong></div>`:''}${a.statut?`<div class="popup-row"><span>Statut</span><strong>${esc(a.statut)}</strong></div>`:''}${q.length>=2?`<div class="popup-row"><span>Coordonnées</span><strong>${q[1].toFixed(6)}, ${q[0].toFixed(6)}</strong></div>`:''}</div>${q.length>=2?'<button class="streetview-user-point" type="button">Ouvrir Street View</button>':''}<button class="remove-user-point" type="button">Supprimer ce point</button>`;
  }else{
    const nom=featureName(f),type=a.type_carto||a.type||a.nature||'',source=a.source||'non renseignée',pot=a.potabilite||'non renseignée',statut=a.statut||a.StatutOH||'',comment=a.commentaire||a.CommentaireOH||'';
    const low=(type+' '+nom).toLowerCase();
    const kind=low.includes('source')||low.includes('résurg')?'source':(low.includes('mare')||low.includes("plan d'eau")||low.includes('étang'))?'water':low.includes('cours')||low.includes('hydro')?'hydro':'other';
    const symbol=kind==='source'?'S':kind==='water'?'≈':kind==='hydro'?'≈':'●';
    const typeLabel=type||'Point d’eau';
    popup.innerHTML=`<button class="popup-close" type="button" aria-label="Fermer">×</button><div class="popup-title"><span class="popup-symbol ${kind}">${symbol}</span><div><b>${esc(nom)}</b><span class="popup-type ${kind}">${esc(typeLabel)}</span></div></div><div class="popup-details"><div class="popup-row"><span>Potabilité</span><strong>${esc(pot)}</strong></div>${statut?`<div class="popup-row"><span>Statut</span><strong>${esc(statut)}</strong></div>`:''}<div class="popup-row popup-source-row"><span>Source</span><strong>${esc(source)}</strong></div>${comment?`<div class="popup-row"><span>Commentaire</span><strong>${esc(comment)}</strong></div>`:''}</div>`;
  }
  popup.querySelector('.popup-close').onclick=closePopup;
  if(isUser){popup.querySelector('.remove-user-point').onclick=()=>removeUserPoint(f);const sv=popup.querySelector('.streetview-user-point');if(sv)sv.onclick=()=>{const q=f.geometry.coordinates;openStreetView(q[0],q[1])}}
  placePopup(p)
}
c.addEventListener('click',e=>{
  if(clickMoved){clickMoved=false;return}
  const p=coordFromEvent(e),m=merc(center.lon,center.lat),sc=scale(),v=viewportSize(),ll=inv(m.x+(p.x-v.w/2)/sc,m.y-(p.y-v.h/2)/sc);
  if(!streetViewMode&&svMarker)clearSvMarker(false);
  if(streetViewMode){if(!openStreetView(ll.lon,ll.lat)){statusEl.textContent='Street View nécessite une connexion Internet';return}streetViewMode=false;streetViewBtn.classList.remove('active');setSvMarker(ll.lon,ll.lat);statusEl.textContent='Street View ouvert';return}
  if(addMode){addLocation=ll;addCoords.textContent=`Position : ${ll.lat.toFixed(6)}, ${ll.lon.toFixed(6)}`;addForm.classList.remove('hidden');addMode=false;statusEl.textContent='Compléter la fiche du point';draw();return}
  let best=null,bd=22;
  const groups=[showUserPoints.checked?userPoints:[],showWater.checked?data.water:[],showSources.checked?data.sources:[],showPoints.checked?data.points:[],showHydro.checked?data.hydro:[]];
  for(const group of groups)for(const f of group){if(f.geometry?.type!=='Point')continue;const d=featureHitDistance(f,p);if(d<bd){best=f;bd=d}}
  if(!best){bd=22;for(const group of groups){for(const f of group){const d=featureHitDistance(f,p);if(d<bd){best=f;bd=d}}if(best)break}}
  if(best){selectedHydro=data.hydro.includes(best)?best:null;draw();showFeaturePopup(best,p)}else{selectedHydro=null;closePopup();draw()}
});
layersBtn.onclick=()=>{closePopup();infoPanel.classList.add('hidden');panel.classList.toggle('hidden')};document.getElementById('closeLayers').onclick=()=>panel.classList.add('hidden');['showWater','showSources','showPoints','showUserPoints','showHydro','showCommune'].forEach(id=>document.getElementById(id).onchange=draw);document.getElementById('exportKmlBtn').onclick=exportUserPointsKml;
function setBasemap(which){online.checked=which==='osm';satellite.checked=which==='satellite';statusEl.textContent='';draw()}
online.onchange=()=>setBasemap(online.checked?'osm':'local');satellite.onchange=()=>setBasemap(satellite.checked?'satellite':'local');
gpsBtn.onclick=()=>{
  if(!navigator.geolocation){statusEl.textContent='GPS non disponible';return}
  if(gpsWatchId!==null){navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null;gpsBtn.classList.remove('active');statusEl.textContent='GPS arrêté';return}
  statusEl.textContent='Recherche GPS…';gpsBtn.classList.add('active');
  gpsWatchId=navigator.geolocation.watchPosition(p=>{gps={lon:p.coords.longitude,lat:p.coords.latitude,acc:p.coords.accuracy};center={lon:gps.lon,lat:gps.lat};zoom=16;statusEl.textContent=`GPS actif • précision ±${Math.round(gps.acc)} m`;draw()},e=>{gpsBtn.classList.remove('active');gpsWatchId=null;statusEl.textContent='GPS : '+e.message},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
};

try{userPoints=JSON.parse(localStorage.getItem('eauBreviairesUserPoints')||'[]');if(!Array.isArray(userPoints))userPoints=[]}catch(e){userPoints=[]}updateUserPointTools();if(isMobileDevice()){const b=document.getElementById('exportKmlBtn');if(b)b.textContent='Partager les points en KML'}
infoBtn.onclick=()=>{clearSvMarker(false);streetViewMode=false;streetViewBtn.classList.remove('active');addMode=false;addLocation=null;addForm.classList.add('hidden');panel.classList.add('hidden');closePopup();infoPanel.classList.toggle('hidden');statusEl.textContent='';draw()};closeInfo.onclick=()=>infoPanel.classList.add('hidden');
streetViewBtn.onclick=()=>{infoPanel.classList.add('hidden');clearSvMarker(false);streetViewMode=!streetViewMode;addMode=false;addLocation=null;addForm.classList.add('hidden');panel.classList.add('hidden');closePopup();streetViewBtn.classList.toggle('active',streetViewMode);statusEl.textContent=streetViewMode?'Cliquez sur la carte pour ouvrir Street View':'';draw()};
addBtn.onclick=()=>{infoPanel.classList.add('hidden');clearSvMarker(false);streetViewMode=false;streetViewBtn.classList.remove('active');addMode=true;addLocation=null;closePopup();panel.classList.add('hidden');addForm.classList.add('hidden');statusEl.textContent='Touchez la carte à l’emplacement du point à ajouter';draw()};
closeAdd.onclick=()=>{addForm.classList.add('hidden');addLocation=null;addMode=false;statusEl.textContent='Ajout annulé';draw()};
removeAdd.onclick=()=>{addForm.classList.add('hidden');addLocation=null;addMode=false;statusEl.textContent='Point retiré • ajout annulé';draw()};
saveAdd.onclick=()=>{if(!addLocation)return;const description=addDescription.value.trim();const f={type:'Feature',properties:{type:'Point nouveau',description,date_heure:new Date().toLocaleString('fr-FR'),source:'Contribution utilisateur locale',statut:'À vérifier'},geometry:{type:'Point',coordinates:[addLocation.lon,addLocation.lat]}};userPoints.push(f);const saved=persistUserPoints();addForm.classList.add('hidden');addDescription.value='';addLocation=null;const userPointLabel=document.querySelector('label[for="showUserPoints"]');if(userPointLabel)userPointLabel.innerHTML=`<span class="dot user-point"></span>Points nouveaux (${userPoints.length})`;
  const hydroLabel=document.querySelector('label[for="showHydro"]');if(hydroLabel)hydroLabel.innerHTML=`<span class="line-key hydro-key"></span>Hydrographie (${data.hydro.length})`;statusEl.textContent=saved?'Point enregistré sur cet appareil • à vérifier':'⚠ Point NON enregistré durablement (stockage indisponible) • exportez en KML';updateUserPointTools();draw()};

// V30 — sélection hydrographique sur toute la géométrie cliquée
// V29 — commandes mobiles sans duplication de la logique métier
const mobileDrawer=document.getElementById('mobileDrawer'),mobileDrawerHandle=document.getElementById('mobileDrawerHandle'),mobileBasemapPanel=document.getElementById('mobileBasemapPanel');
const mobileGpsBtn=document.getElementById('mobileGpsBtn'),mobileStreetBtn=document.getElementById('mobileStreetBtn');
function closeMobileMenus(){mobileDrawer?.classList.add('hidden');mobileBasemapPanel?.classList.add('hidden');mobileDrawerHandle?.setAttribute('aria-expanded','false')}
function syncMobileQuick(){mobileGpsBtn?.classList.toggle('active',gpsWatchId!==null);mobileStreetBtn?.classList.toggle('active',streetViewMode)}
function syncMobileBasemap(){document.querySelectorAll('.basemap-choice').forEach(b=>b.classList.toggle('selected',(b.dataset.basemap==='osm'&&online.checked)||(b.dataset.basemap==='satellite'&&satellite.checked)||(b.dataset.basemap==='local'&&!online.checked&&!satellite.checked)))}
if(mobileDrawerHandle){mobileDrawerHandle.onclick=()=>{const opening=mobileDrawer.classList.contains('hidden');closeMobileMenus();if(opening){mobileDrawer.classList.remove('hidden');mobileDrawerHandle.setAttribute('aria-expanded','true');panel.classList.add('hidden');infoPanel.classList.add('hidden');closePopup()}};document.getElementById('closeMobileDrawer').onclick=closeMobileMenus;document.getElementById('closeMobileBasemap').onclick=closeMobileMenus;
mobileGpsBtn.onclick=()=>{gpsBtn.click();setTimeout(syncMobileQuick,0)};mobileStreetBtn.onclick=()=>{streetViewBtn.click();syncMobileQuick()};
document.getElementById('mobileLayersBtn').onclick=()=>{closeMobileMenus();layersBtn.click()};document.getElementById('mobileBasemapBtn').onclick=()=>{mobileDrawer.classList.add('hidden');mobileBasemapPanel.classList.remove('hidden');syncMobileBasemap()};document.getElementById('mobileAddBtn').onclick=()=>{closeMobileMenus();addBtn.click()};document.getElementById('mobileExportBtn').onclick=()=>{closeMobileMenus();document.getElementById('exportKmlBtn').click()};document.getElementById('mobileInfoBtn').onclick=()=>{closeMobileMenus();infoBtn.click()};
document.querySelectorAll('.basemap-choice').forEach(b=>b.onclick=()=>{setBasemap(b.dataset.basemap);syncMobileBasemap();setTimeout(closeMobileMenus,120)});}
setBasemap('osm');
if('serviceWorker'in navigator){const hadController=!!navigator.serviceWorker.controller;let reloaded=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadController||reloaded)return;if(!addForm.classList.contains('hidden')||addMode){statusEl.textContent='Nouvelle version prête • rechargez la page';return}reloaded=true;location.reload()});navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{})}addEventListener('resize',resize);if(window.visualViewport){visualViewport.addEventListener('resize',resize);visualViewport.addEventListener('scroll',resize)}addEventListener('offline',()=>{statusEl.textContent='Hors ligne • données locales actives, fond de carte limité aux zones déjà vues'});addEventListener('online',()=>{statusEl.textContent='Connexion rétablie';draw();setTimeout(()=>{if(statusEl.textContent==='Connexion rétablie')statusEl.textContent=''},2500)});
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
resize();load().then(()=>{if(!navigator.onLine)statusEl.textContent='Hors ligne • données locales actives, fond de carte limité aux zones déjà vues'});

// V29 — reflet visuel des états GPS / Street View sur les boutons mobiles
gpsBtn.addEventListener('click',()=>setTimeout(syncMobileQuick,0));streetViewBtn.addEventListener('click',()=>setTimeout(syncMobileQuick,0));
if(window.MutationObserver){const quickObserver=new MutationObserver(syncMobileQuick);quickObserver.observe(gpsBtn,{attributes:true,attributeFilter:['class']});quickObserver.observe(streetViewBtn,{attributes:true,attributeFilter:['class']});syncMobileQuick()}
