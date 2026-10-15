(function(){
'use strict';
const $=id=>document.getElementById(id);
function h(tag,props,...kids){
  const e=document.createElement(tag);
  for(const k in (props||{})){
    const v=props[k]; if(v==null||v===false) continue;
    if(k==='class') e.className=v;
    else if(k==='text') e.textContent=v;
    else if(k.slice(0,2)==='on') e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat()){ if(c==null||c===false) continue; e.append(c.nodeType?c:document.createTextNode(String(c))); }
  return e;
}
const NS='http://www.w3.org/2000/svg';
function s(tag,attrs,text){
  const e=document.createElementNS(NS,tag);
  for(const k in (attrs||{})) e.setAttribute(k,attrs[k]);
  if(text!=null) e.textContent=text;
  return e;
}
const pad=n=>String(n).padStart(2,'0');
const fmt=m=>{m=((Math.round(m)%1440)+1440)%1440;return pad(Math.floor(m/60))+':'+pad(m%60);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

/* ---------- Time and astronomy ---------- */
const TZ='Asia/Nicosia';
let cond=lsGet('psaro-cond',null), refreshing=null;
const utcOff=()=>cond&&typeof cond.utc==='number'?cond.utc:-new Date().getTimezoneOffset();
const shifted=()=>new Date(Date.now()+utcOff()*60000);
const nicosiaToday=()=>shifted().toISOString().slice(0,10);
const nicosiaNowMin=()=>{const d=shifted();return d.getUTCHours()*60+d.getUTCMinutes();};
function tzOffsetMin(d){
  try{
    const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,timeZoneName:'shortOffset'}).formatToParts(d).find(x=>x.type==='timeZoneName').value;
    const m=/GMT([+-])(\d+)(?::(\d+))?/.exec(p);
    if(m) return (m[1]==='-'?-1:1)*(parseInt(m[2],10)*60+(m[3]?parseInt(m[3],10):0));
  }catch(e){}
  return 120;
}
const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14);
function sunMoon(dateStr){
  const [y,m,d]=dateStr.split('-').map(Number);
  const noonUtc=Date.UTC(y,m-1,d,12);
  const tz=utcOff();
  const n=Math.floor((noonUtc-Date.UTC(y,0,0))/86400000);
  const lat=cond&&cond.lat!=null?cond.lat:34.9, lon=cond&&cond.lon!=null?cond.lon:33.2, la=lat*Math.PI/180;
  const g=2*Math.PI/365*(n-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const cosH=Math.cos(90.833*Math.PI/180)/(Math.cos(la)*Math.cos(dec))-Math.tan(la)*Math.tan(dec);
  const H=Math.acos(clamp(cosH,-1,1))*180/Math.PI;
  const noon=720-4*lon-eq+tz, rise=720-4*(lon+H)-eq+tz, set=720-4*(lon-H)-eq+tz;
  let age=((noonUtc-tz*60000+0-REF)/86400000)%SYN; if(age<0) age+=SYN;
  const f=age/SYN;
  const illum=(1-Math.cos(2*Math.PI*f))/2;
  const transit=((noon+f*1440)%1440+1440)%1440;
  return {noon,rise,set,age,f,illum,transit,anti:(transit+745)%1440,mrise:((transit-373)%1440+1440)%1440,mset:(transit+373)%1440};
}
function moonName(f){
  const i=Math.floor(((f*8)+0.5))%8;
  return ['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα σελήνη','Πανσέληνος','Φθίνουσα σελήνη','Τελευταίο τέταρτο','Φθίνων μηνίσκος'][i];
}
function drawMoon(f){
  const svg=$('moonSvg'); svg.replaceChildren();
  const r=20, k=Math.cos(2*Math.PI*f), rx=r*Math.abs(k);
  svg.append(s('circle',{r:r,cx:0,cy:0,fill:'var(--line)',stroke:'var(--coast)','stroke-width':1}));
  const sweep=k>0?0:1;
  const gEl=s('g',{transform:f>0.5?'scale(-1,1)':''});
  gEl.append(s('path',{d:`M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`,fill:'var(--ink)'}));
  svg.append(gEl);
}
function circDist(a,b){const d=Math.abs(a-b)%1440;return Math.min(d,1440-d);}

/* ---------- Activity model ---------- */
function compute(){
  const date=$('dDate').value||nicosiaToday();
  const wind=+$('dWind').value, wave=+$('dWave').value;
  const press=$('dPress').value, cloud=$('dCloud').value;
  const sm=sunMoon(date);
  const factors=[];
  const moon=Math.round(Math.cos(4*Math.PI*sm.f)*8);
  factors.push(['Φάση σελήνης',moon]);
  const pv={slow:8,stable:3,rise:0,fast:-4}[press]; factors.push(['Πίεση',pv]);
  const wv=wind<5?2:wind<=12?4:wind<=18?-3:wind<=25?-12:-25; factors.push(['Άνεμος',wv]);
  const cv=wave<=0.5?3:wave<=1?0:wave<=1.5?-6:wave<=2?-15:-25; factors.push(['Κύμα',cv]);
  const clv={clear:0,part:2,over:4}[cloud]; factors.push(['Ουρανός',clv]);
  const base=50+factors.reduce((a,f)=>a+f[1],0);
  const hours=[];
  for(let hr=0;hr<24;hr++){
    const t=hr*60+30; let b=0;
    const dTw=Math.min(circDist(t,sm.rise),circDist(t,sm.set));
    if(dTw<=75) b+=14*(1-dTw/75);
    const dMaj=Math.min(circDist(t,sm.transit),circDist(t,sm.anti));
    if(dMaj<=60) b+=10;
    const dMin=Math.min(circDist(t,sm.mrise),circDist(t,sm.mset));
    if(dMin<=30) b+=5;
    if(t>=660&&t<=900) b-=4;
    hours.push(clamp(Math.round(base+b),5,98));
  }
  const day=clamp(Math.round(base),5,98);
  return {date,wind,wave,sm,factors,hours,day};
}
function bft(w){return [1,4,7,11,17,22,28,34,41].filter(x=>x<=w).length;}
function renderToday(){
  const c=compute();
  $('vWind').textContent=c.wind+' kn · Bf '+bft(c.wind);
  $('vWave').textContent=c.wave.toFixed(1)+' m';
  const sc=$('score'); sc.replaceChildren(String(c.day),h('small',{text:'/100'}));
  $('scoreText').textContent=c.day>=75?'Πολύ καλές προϋποθέσεις':c.day>=60?'Καλές προϋποθέσεις':c.day>=45?'Μέτριες προϋποθέσεις':'Δύσκολη μέρα για ψάρεμα';
  const lvl=(c.wind>20||c.wave>1.5)?'bad':(c.wind>14||c.wave>0.9)?'warn':'good';
  const pill=$('safePill'); pill.className='pill '+lvl;
  pill.textContent={good:'Ήπια θάλασσα',warn:'Προσοχή',bad:'Δύσκολες συνθήκες'}[lvl];
  $('safeText').textContent={good:'Συνθήκες κατάλληλες για έξοδο με μικρό σκάφος.',warn:'Αρκετός άνεμος ή κύμα για μικρό σκάφος. Κοίτα την πρόγνωση για ριπές.',bad:'Άνεμος ή κύμα ψηλά για μικρό σκάφος. Ξανασκέψου την έξοδο.'}[lvl];
  const fx=$('factors'); fx.replaceChildren(h('div',{class:'muted',text:'Βάση'}),h('div',{class:'v',text:'50'}));
  for(const [n,v] of c.factors){ fx.append(h('div',{text:n}),h('div',{class:'v '+(v>0?'pos':v<0?'neg':''),text:(v>0?'+':'')+v})); }
  drawHours(c);
  const sm=c.sm;
  $('moonName').textContent=moonName(sm.f);
  $('moonSub').textContent='Φωτισμός '+Math.round(sm.illum*100)+'% · ηλικία '+sm.age.toFixed(1)+' ημέρες';
  drawMoon(sm.f);
  const st=$('sunTimes'); st.replaceChildren();
  for(const [a,b] of [['Ανατολή ηλίου',fmt(sm.rise)],['Δύση ηλίου',fmt(sm.set)],['Σελήνη στο ζενίθ',fmt(sm.transit)],['Σελήνη στο ναδίρ',fmt(sm.anti)]]){
    st.append(h('span',{class:'muted',text:a}),h('span',{text:b}));
  }
}
function drawHours(c){
  const svg=$('hourChart'); svg.replaceChildren();
  const W=480,H=150,L=8,R=8,T=14,B=22, bw=(W-L-R)/24, ch=H-T-B;
  const mx=Math.max(...c.hours);
  c.hours.forEach((v,i)=>{
    const hgt=Math.max(2,v/100*ch), x=L+i*bw+1.5;
    const cls=v>=mx-6?'b-hi':v>=mx-18?'b-mid':'b-lo';
    svg.append(s('rect',{x:x,y:T+ch-hgt,width:bw-3,height:hgt,rx:1.5,class:cls}));
  });
  const xm=m=>L+(m/1440)*(W-L-R);
  for(const [m,l] of [[c.sm.rise,'↑ '+fmt(c.sm.rise)],[c.sm.set,'↓ '+fmt(c.sm.set)]]){
    svg.append(s('line',{x1:xm(m),x2:xm(m),y1:T-4,y2:T+ch,stroke:'var(--accent)','stroke-width':1.2,'stroke-dasharray':'3 3'}));
    svg.append(s('text',{x:xm(m),y:10,'text-anchor':'middle'},l));
  }
  if(c.date===nicosiaToday()){
    const n=nicosiaNowMin();
    svg.append(s('line',{x1:xm(n),x2:xm(n),y1:T,y2:T+ch,stroke:'var(--ink)','stroke-width':1.5}));
  }
  for(const hr of [0,6,12,18,24]) svg.append(s('text',{x:L+hr*bw,y:H-6,'text-anchor':hr===0?'start':hr===24?'end':'middle'},pad(hr%24)+':00'));
  const thr=mx-6, groups=[]; let cur=null;
  c.hours.forEach((v,i)=>{ if(v>=thr){ if(cur&&cur.e===i-1){cur.e=i;cur.m=Math.max(cur.m,v);} else {cur={s:i,e:i,m:v};groups.push(cur);} } });
  groups.sort((a,b)=>b.m-a.m);
  const w=$('windows'); w.replaceChildren();
  groups.slice(0,3).sort((a,b)=>a.s-b.s).forEach(g=>w.append(h('span',{text:pad(g.s)+':00 – '+pad((g.e+1)%24)+':00'})));
}

/* ---------- Store (this device, localStorage) ---------- */
const Store=(function(){
  const cache={spots:[],trips:[],bites:[]}, subs={spots:[],trips:[],bites:[]};
  const emit=k=>subs[k].forEach(f=>f(cache[k]));
  const persist=k=>lsSet('psaro-'+k,cache[k]);
  async function init(){
    for(const k in cache){cache[k]=lsGet('psaro-'+k,[]);emit(k);}
    try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
  }
  async function save(k,obj){
    const id=obj.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6));
    const data=Object.assign({},obj,{id:id});
    cache[k]=cache[k].filter(x=>x.id!==id).concat([data]); persist(k); emit(k); return id;
  }
  async function remove(k,id){cache[k]=cache[k].filter(x=>x.id!==id);persist(k);emit(k);}
  return {init,save,remove,on:(k,f)=>{subs[k].push(f);f(cache[k]);},get:k=>cache[k]};
})();

/* ---------- Photos (IndexedDB) ---------- */
const Photos=(function(){
  let dbp=null;
  const db=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('psarovarka',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));
  async function tx(mode,fn){const d=await db();return new Promise((res,rej)=>{const t=d.transaction('photos',mode);const rq=fn(t.objectStore('photos'));t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});}
  return {put:(id,b)=>tx('readwrite',s=>s.put(b,id)),get:id=>tx('readonly',s=>s.get(id)),del:id=>tx('readwrite',s=>s.delete(id))};
})();
async function resizeImage(file){
  let bmp;
  try{ bmp=await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch(e){ bmp=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(file);}); }
  const w=bmp.width||bmp.naturalWidth, hh=bmp.height||bmp.naturalHeight, k=Math.min(1,1280/Math.max(w,hh));
  const cv=document.createElement('canvas'); cv.width=Math.round(w*k); cv.height=Math.round(hh*k);
  cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
  return new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('blob')),'image/jpeg',0.78));
}
const toast=(m)=>{const e=$('toast');e.textContent=m;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3500);};

/* ---------- Map (Leaflet, world) ---------- */
const REFS=[['Πάφος',32.41,34.75],['Λατσί',32.43,35.04],['Λεμεσός',33.04,34.67],['Ακρ. Γάτα',33.03,34.56],['Ζύγι',33.34,34.72],['Λάρνακα',33.63,34.91],['Κάβο Γκρέκο',34.08,34.96]];
const TILES={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
let map=null,baseSat,baseOsm,seaL,youM=null,pendM=null,spotsG,bitesG,popup=null;
const markerById={};
let selSpot=null,pending=null,pick=null,pickedPt=null;
const purl=new Map();
async function loadPhoto(id,img){
  try{
    let u=purl.get(id);
    if(!u){const bl=await Photos.get(id); if(!bl) return; u=URL.createObjectURL(bl); purl.set(id,u);}
    img.src=u; img.hidden=false;
  }catch(e){}
}
function initMap(){
  if(typeof L==='undefined'){ $('lmap').textContent='Ο χάρτης δεν φόρτωσε.'; return; }
  const last=lsGet('psaro-view',null), c=cond&&cond.lat!=null?[cond.lat,cond.lon]:null;
  map=L.map('lmap',{minZoom:2,worldCopyJump:true,zoomControl:false}).setView(last?[last.lat,last.lon]:(c||[34.9,33.2]),last?last.z:(c?10:8));
  L.control.zoom({position:'bottomleft'}).addTo(map);
  baseSat=L.tileLayer(TILES.sat,{maxZoom:18,attribution:'Esri'});
  baseOsm=L.tileLayer(TILES.osm,{maxZoom:19,attribution:'© OpenStreetMap'});
  seaL=L.tileLayer(TILES.sea,{maxZoom:18,attribution:'OpenSeaMap'});
  let lay=lsGet('psaro-layer','sat'); (lay==='osm'?baseOsm:baseSat).addTo(map);
  $('bLayer').addEventListener('click',()=>{
    if(lay==='sat'){map.removeLayer(baseSat);baseOsm.addTo(map);lay='osm';} else {map.removeLayer(baseOsm);baseSat.addTo(map);lay='sat';}
    lsSet('psaro-layer',lay); if(map.hasLayer(seaL)) seaL.bringToFront();
  });
  $('bSea').addEventListener('click',()=>{
    const on=!map.hasLayer(seaL); if(on) seaL.addTo(map); else map.removeLayer(seaL);
    $('bSea').setAttribute('aria-pressed',String(on));
  });
  $('bLoc').addEventListener('click',async()=>{ const c2=await refreshConditions(); if(c2&&c2.lat!=null) map.flyTo([c2.lat,c2.lon],Math.max(map.getZoom(),12)); });
  $('bSpotPick').addEventListener('click',()=>startPick('spot'));
  $('mapHintX').addEventListener('click',()=>{const was=pick; endPick(); if(was==='bite') openSheet();});
  spotsG=L.layerGroup().addTo(map); bitesG=L.layerGroup().addTo(map);
  map.on('moveend',()=>{const p=map.getCenter(); lsSet('psaro-view',{lat:+p.lat.toFixed(4),lon:+p.lng.toFixed(4),z:map.getZoom()});});
  map.on('click',e=>{
    const ll=e.latlng.wrap(), lat=+ll.lat.toFixed(5), lon=+ll.lng.toFixed(5);
    if(pick==='spot'){ endPick(); openSpotForm({lat:lat,lon:lon}); return; }
    if(pick==='bite'){ endPick(); pickedPt={lat:lat,lon:lon}; $('bLocMode').value='pick'; syncLoc(); openSheet(); return; }
    const box=h('div',{class:'pop'},h('div',{class:'mono',text:lat.toFixed(4)+', '+lon.toFixed(4)}),
      h('div',{class:'row',style:'margin-top:6px'},
        h('button',{class:'btn sm',type:'button',text:'Νέο σημείο',onclick:()=>{map.closePopup();openSpotForm({lat:lat,lon:lon});}}),
        h('button',{class:'btn acc sm',type:'button',text:'Τσίμπημα εδώ',onclick:()=>{map.closePopup();pickedPt={lat:lat,lon:lon};$('bLocMode').value='pick';syncLoc();openSheet();}})));
    L.popup().setLatLng(ll).setContent(box).openOn(map);
  });
  if(cond&&cond.lat!=null) setYou(cond.lat,cond.lon);
}
function setYou(lat,lon){
  if(!map) return;
  if(youM) youM.setLatLng([lat,lon]); else youM=L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="you"></div>',iconSize:[18,18]}),interactive:false,zIndexOffset:-100}).addTo(map);
}
function startPick(mode){
  pick=mode; $('mapHint').hidden=false;
  $('mapHintTxt').textContent=mode==='spot'?'Πάτα στον χάρτη για το νέο σημείο':'Πάτα στον χάρτη εκεί που έπιασες';
  switchTab('map');
}
function endPick(){ pick=null; $('mapHint').hidden=true; }
function showOnMap(lat,lon,id){
  switchTab('map'); if(!map) return;
  map.flyTo([lat,lon],Math.max(map.getZoom(),13));
  const m=markerById[id]; if(m) setTimeout(()=>m.openPopup(),800);
}
function catchPopup(b){
  const img=h('img',{class:'pimg',alt:'Φωτογραφία ψαριού'}); img.hidden=true;
  const cd=[b.wind!=null?b.wind+' kn':null,b.wave!=null?b.wave+' m κύμα':null,b.press!=null?b.press+' hPa':null,b.sst!=null?Math.round(b.sst)+'°C θάλασσα':null,MOON_LBL[biteMoon(b)]].filter(Boolean).join(' · ');
  const size=[b.kg?b.kg+' kg':null,b.len?b.len+' cm':null].filter(Boolean).join(' · ');
  return h('div',{class:'pop'},img,h('b',{text:b.species||'Άγνωστο'}),b.latin?h('div',{class:'meta',text:b.latin}):null,
    h('div',{class:'meta mono',text:(b.date||'')+' '+(b.time||'')}),
    size?h('div',{text:size}):null,
    (b.bait||b.tech)?h('div',{class:'meta',text:[b.bait,b.tech].filter(Boolean).join(' · ')}):null,
    cd?h('div',{class:'meta',text:cd}):null,b.notes?h('div',{class:'meta',text:b.notes}):null);
}
function drawMap(){
  if(!map) return;
  spotsG.clearLayers(); bitesG.clearLayers();
  for(const k in markerById) delete markerById[k];
  for(const sp of Store.get('spots')){
    if(typeof sp.lat!=='number'||typeof sp.lon!=='number') continue;
    const m=L.marker([sp.lat,sp.lon],{icon:L.divIcon({className:'',html:'<div class="mk-spot'+(sp.id===selSpot?' sel':'')+'"></div>',iconSize:[22,22]}),title:sp.name});
    m.bindTooltip(sp.name||'',{direction:'right',offset:[10,0],className:'lbl'});
    m.bindPopup(()=>h('div',{class:'pop'},h('b',{text:sp.name||'Χωρίς όνομα'}),h('div',{class:'meta',text:[sp.type,sp.depth!=null?sp.depth+' m':null].filter(Boolean).join(' · ')}),sp.notes?h('div',{class:'meta',text:sp.notes}):null,
      h('div',{class:'row',style:'margin-top:6px'},h('button',{class:'btn acc sm',type:'button',text:'Τσίμπημα εδώ',onclick:()=>{map.closePopup();pickedPt=null;$('bLocMode').value='spot';syncLoc();$('bSpot').value=sp.id;openSheet();}}))));
    m.addTo(spotsG); markerById[sp.id]=m;
  }
  for(const b of Store.get('bites')){
    if(typeof b.lat!=='number'||typeof b.lon!=='number') continue;
    const m=L.marker([b.lat,b.lon],{icon:L.divIcon({className:'',html:'<div class="mk-fish'+(b.photo?' ph':'')+'">🐟</div>',iconSize:[30,30]}),title:b.species||''});
    m.bindPopup(()=>catchPopup(b),{minWidth:180});
    m.on('popupopen',e=>{const im=e.popup.getElement().querySelector('img.pimg'); if(im&&b.photo) loadPhoto(b.id,im);});
    m.addTo(bitesG); markerById[b.id]=m;
  }
  if(pendM){map.removeLayer(pendM);pendM=null;}
  if(pending) pendM=L.circleMarker([pending.lat,pending.lon],{radius:10,color:'#d8431c',weight:3,fillOpacity:.15}).addTo(map);
}
function openSpotForm(p){
  pending=(p&&typeof p.lat==='number')?{lat:p.lat,lon:p.lon}:null;
  switchTab('map');
  $('spotForm').hidden=false;
  $('sLat').value=p&&p.lat!=null?p.lat:''; $('sLon').value=p&&p.lon!=null?p.lon:'';
  $('sErr').textContent=''; drawMap();
  $('spotForm').scrollIntoView({behavior:'smooth',block:'center'});
  $('sName').focus({preventScroll:true});
}
function closeSpotForm(){ pending=null; $('spotForm').hidden=true; $('spotForm').reset(); drawMap(); }
$('sNew').addEventListener('click',()=>openSpotForm({}));
$('sCancel').addEventListener('click',closeSpotForm);
['sLat','sLon'].forEach(id=>$(id).addEventListener('input',()=>{
  const la=parseFloat($('sLat').value),lo=parseFloat($('sLon').value);
  pending=(isFinite(la)&&isFinite(lo))?{lat:la,lon:lo}:null; drawMap();
}));
$('spotForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const la=parseFloat($('sLat').value),lo=parseFloat($('sLon').value);
  if(!(la>=-90&&la<=90&&lo>=-180&&lo<=180)){$('sErr').textContent='Γράψε έγκυρο πλάτος και μήκος σε δεκαδικές μοίρες, ή πάτα στον χάρτη.';return;}
  const depth=$('sDepth').value===''?null:+$('sDepth').value;
  try{
    const id=await Store.save('spots',{name:$('sName').value.trim(),type:$('sType').value,lat:la,lon:lo,depth:depth,notes:$('sNotes').value.trim()});
    selSpot=id; closeSpotForm();
  }catch(err){$('sErr').textContent='Δεν αποθηκεύτηκε. Δοκίμασε ξανά.';}
});
function copyText(t,btn){
  const done=()=>{const o=btn.textContent;btn.textContent='Αντιγράφηκε';setTimeout(()=>btn.textContent=o,1200);};
  try{ navigator.clipboard.writeText(t).then(done,()=>{}); }catch(e){}
}
function renderSpots(){
  const L=$('spotList'); L.replaceChildren();
  const spots=Store.get('spots').slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','el'));
  if(!spots.length){ L.append(h('div',{class:'empty',text:'Δεν έχεις αποθηκεύσει σημεία ακόμα. Πάτα πάνω στον χάρτη ή στο κουμπί «Νέο σημείο με συντεταγμένες».'})); }
  for(const sp of spots){
    const coord=(typeof sp.lat==='number'?sp.lat.toFixed(5):'?')+', '+(typeof sp.lon==='number'?sp.lon.toFixed(5):'?');
    const cb=h('button',{class:'btn ghost sm',type:'button',text:'Αντιγραφή'});
    cb.addEventListener('click',()=>copyText(coord,cb));
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('spots',sp.id);}catch(e){}
    });
    const it=h('div',{class:'item'+(sp.id===selSpot?' sel':'')},
      h('div',{},h('b',{text:sp.name||'Χωρίς όνομα'}),h('div',{class:'meta',text:[sp.type,sp.depth!=null?sp.depth+' m':null].filter(Boolean).join(' · ')}),h('div',{class:'meta mono',text:coord}),sp.notes?h('div',{class:'meta',text:sp.notes}):null),
      h('div',{class:'acts'},cb,del));
    it.firstChild.addEventListener('click',()=>{selSpot=sp.id;drawMap();renderSpots();if(typeof sp.lat==='number') showOnMap(sp.lat,sp.lon,sp.id);});
    L.append(it);
  }
  const dl=$('spotNames'); dl.replaceChildren(); for(const sp of spots) dl.append(h('option',{value:sp.name}));
  const bs=$('bSpot'), cur=bs.value; bs.replaceChildren(h('option',{value:'',text:'Χωρίς σημείο'}));
  for(const sp of spots) bs.append(h('option',{value:sp.id,text:sp.name}));
  bs.value=spots.some(x=>x.id===cur)?cur:'';
}

/* ---------- Log ---------- */
function renderTrips(){
  const trips=Store.get('trips').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const n=trips.length, fish=trips.reduce((a,t)=>a+(+t.count||0),0), kg=trips.reduce((a,t)=>a+(+t.kg||0),0);
  const by={}; trips.forEach(t=>{if(t.spot)by[t.spot]=(by[t.spot]||0)+(+t.count||0);});
  const best=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
  const st=$('stats'); st.replaceChildren();
  for(const [lab,val] of [['Έξοδοι',n],['Ψάρια',fish],['Kg',kg.toFixed(1)]]) st.append(h('div',{},h('b',{text:val}),h('span',{class:'label',text:lab})));
  const L=$('tripList'); L.replaceChildren();
  if(best&&best[1]>0) L.append(h('p',{class:'muted',text:'Πιο παραγωγικό σημείο: '+best[0]+' ('+best[1]+' ψάρια)'}));
  if(!n) L.append(h('div',{class:'empty',text:'Καμία έξοδος καταγεγραμμένη. Συμπλήρωσε τη φόρμα πάνω μετά το επόμενο ψάρεμα.'}));
  for(const t of trips){
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('trips',t.id);}catch(e){}
    });
    L.append(h('div',{class:'item'},
      h('div',{},h('b',{text:(t.date||'')+(t.spot?' · '+t.spot:'')}),
        h('div',{class:'meta',text:[t.tech,(t.count||0)+' ψάρια',(+t.kg||0).toFixed(1)+' kg',t.species].filter(Boolean).join(' · ')}),
        t.notes?h('div',{class:'meta',text:t.notes}):null),
      h('div',{class:'acts'},del)));
  }
}
$('tripForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    await Store.save('trips',{date:$('tDate').value,spot:$('tSpot').value.trim(),tech:$('tTech').value,species:$('tSpecies').value.trim(),count:+$('tCount').value||0,kg:+$('tKg').value||0,notes:$('tNotes').value.trim()});
    $('tSpot').value='';$('tSpecies').value='';$('tCount').value='0';$('tKg').value='0';$('tNotes').value='';
  }catch(err){}
});

/* ---------- Guide ---------- */
const SPECIES=[
 {n:'Λαυράκι',l:'Dicentrarchus labrax',w:'Κοντά στην ακτή, σε βράχια, λιμάνια και εκβολές.',m:'Spinning με τεχνητά, ζωντανό δόλωμα.',t:'Συχνά τα χαράματα και το σούρουπο.'},
 {n:'Τσιπούρα',l:'Sparus aurata',w:'Αμμώδεις και λασπώδεις πυθμένες, περίπου 5–30 m.',m:'Βυθού με οστρακοειδή.',t:'Πίεση που πέφτει αργά βοηθά.'},
 {n:'Σαργός',l:'Diplodus sargus',w:'Βραχώδεις ακτές και ρηχά.',m:'Βυθού με ελαφρύ μολύβι και κατάλληλο δόλωμα.',t:'Δουλεύει με λίγο κύμα που ανακατεύει τον πυθμένα.'},
 {n:'Λιθρίνι',l:'Pagellus erythrinus',w:'Αμμώδεις και λασπώδεις πυθμένες, περίπου 20–100 m.',m:'Βυθού με πολλά αγκίστρια.',t:'Συχνά σε βαθύτερα νερά.'},
 {n:'Συναγρίδα',l:'Dentex dentex',w:'Βραχώδεις πυθμένες και ύφαλοι, περίπου 20–100 m.',m:'Ζωντανό δόλωμα, jigging.',t:'Επιθετικό αρπακτικό. Θέλει γερό εξοπλισμό.'},
 {n:'Φαγκρί',l:'Pagrus pagrus',w:'Βραχώδεις και μικτοί πυθμένες, περίπου 20–100 m.',m:'Βυθού, jigging.',t:'Ψάρι βάθους, συνήθως πάνω από ύφαλο.'},
 {n:'Σφυρίδα',l:'Epinephelus marginatus',w:'Βράχια και σπηλιές.',m:'Βυθού με γερή πετονιά.',t:'Απειλούμενο είδος σε πολλές περιοχές. Έλεγξε τα ισχύοντα μέτρα προστασίας πριν κρατήσεις ψάρι.',warn:'Προστασία'},
 {n:'Μαγιάτικο',l:'Seriola dumerili',w:'Ανοιχτά, γύρω από υφάλους και υποβρύχια ανάγλυφα.',m:'Jigging, ζωντανό δόλωμα.',t:'Δυνατός αγώνας. Χρειάζεται βαρύς εξοπλισμός.'},
 {n:'Κυνηγός',l:'Coryphaena hippurus',w:'Ανοιχτή θάλασσα, κοντά σε πλωτά αντικείμενα.',m:'Τρόλινγκ.',t:'Στη Μεσόγειο εμφανίζεται συνήθως από το τέλος του καλοκαιριού ως το φθινόπωρο.'},
 {n:'Λούτσος',l:'Sphyraena sphyraena',w:'Επιφάνεια ως μέσα νερά, κοντά σε ακτή και υφάλους.',m:'Τρόλινγκ, spinning.',t:'Κοφτερά δόντια. Χρησιμοποίησε ατσαλένιο ή fluorocarbon ηγέτη.'},
 {n:'Λαγοκέφαλος',l:'Lagocephalus sceleratus',w:'Εισβλητικό είδος σε όλα τα βάθη κοντά στην ακτή.',m:'Πιάνεται τυχαία σε διάφορες τεχνικές.',t:'Δηλητηριώδης. Περιέχει τετροδοτοξίνη. Δεν τρώγεται, δεν δίνεται και δεν πωλείται. Κόβει πετονιές και δαγκώνει.',warn:'Τοξικό'},
 {n:'Λεοντόψαρο',l:'Pterois miles',w:'Βράχια και ύφαλοι, σε μικρά και μεσαία βάθη.',m:'Πιάνεται τυχαία στον πυθμένα.',t:'Εισβλητικό. Τα αγκάθια είναι δηλητηριώδη. Χειρίσου με γάντια και τσιμπίδα.',warn:'Αγκάθια'}
];
const strip=x=>(x||'').toLowerCase().replace(/ς/g,'σ').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const CY=(window.CY100||[]);
const CYL={}; CY.forEach(c=>{const k=c.l.toLowerCase(); if(!CYL[k]) CYL[k]=c;});
const DB=(window.SPECIES_DB||[]).map(r=>({el:r[0],en:r[1],la:r[2],k:''}));
for(const c of CY){
  const row=DB.find(x=>x.la.toLowerCase()===c.l.toLowerCase());
  if(row){ if(!row.el) row.el=c.n; if(!row.en) row.en=c.e; row.alt=(row.alt||'')+' '+c.n; }
  else DB.push({el:c.n,en:c.e,la:c.l,k:''});
}
DB.forEach(x=>{x.k=strip((x.el||'')+' '+(x.en||'')+' '+x.la+' '+(x.alt||''));});
const DETAIL={}; SPECIES.forEach(x=>DETAIL[x.l.toLowerCase()]=x);
function searchDB(q,max){
  q=strip(q.trim()); if(!q) return [];
  const out=[];
  for(const sp of DB){ const i=sp.k.indexOf(q); if(i<0) continue; const w=i===0||/[ \/]/.test(sp.k[i-1]); out.push([w?0:1,sp]); }
  out.sort((a,b)=>a[0]-b[0]);
  return out.slice(0,max).map(x=>x[1]);
}
const dispName=sp=>sp.el||sp.en;
let gbifSeen=[];
async function gbifSearch(q){
  const j=await fetchJson('https://api.gbif.org/v1/species/search?q='+encodeURIComponent(q)+'&rank=SPECIES&status=ACCEPTED&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&limit=15');
  const FISH=['Actinopterygii','Elasmobranchii','Holocephali','Petromyzonti','Cephalaspidomorphi','Sarcopterygii','Chondrichthyes'];
  return (j.results||[]).filter(r=>FISH.includes(r.class)&&(r.canonicalName||r.scientificName)).map(r=>{
    const v=(r.vernacularNames||[]).find(x=>x.language==='eng'); 
    return {el:null,en:v?v.vernacularName:(r.canonicalName||r.scientificName),la:r.canonicalName||r.scientificName,k:''};
  });
}
function spItem(sp){
  const d=DETAIL[(sp.la||'').toLowerCase()], cy=CYL[(sp.la||'').toLowerCase()];
  const slug=(sp.la||'').trim().replace(/\s+/g,'-');
  const fb=h('a',{href:'https://www.fishbase.se/summary/'+encodeURIComponent(slug)+'.html',target:'_blank',rel:'noopener',text:'FishBase'});
  const body=d?h('dl',{class:'dl'},h('dt',{text:'Πού'}),h('dd',{text:d.w}),h('dt',{text:'Πώς'}),h('dd',{text:d.m}),h('dt',{text:'Σημείωση'}),h('dd',{text:d.t}))
    :h('p',{class:'muted',text:'Δεν υπάρχει αναλυτική περιγραφή στην εφαρμογή. Δες περισσότερα στο '}) ;
  if(!d&&!cy) body.append(fb);
  return h('details',{class:'sp'},
    h('summary',{},h('span',{},h('b',{text:cy?cy.n:(d?d.n:dispName(sp))}),d&&d.warn?h('span',{class:'tag',text:d.warn}):null,(sp.el&&sp.en&&!d)?h('span',{class:'muted',text:' · '+sp.en}):null),h('span',{class:'lat',text:sp.la})),
    h('div',{class:'body'},cy?h('p',{text:cy.t}):null,cy?h('p',{class:'note',text:'Πηγή: «Τα 100 σημαντικότερα είδη ψαριών των κυπριακών θαλασσών», Τμήμα Αλιείας και Θαλασσίων Ερευνών, Κύπρος.'}):null,(d&&cy)?h('h3',{text:'Πρακτικά για το ψάρεμα',style:'margin-top:10px'}):null,d?body:(cy?null:body)));
}
function renderSpecies(extra){
  const q=$('spQ').value.trim(); const L=$('spList'); L.replaceChildren();
  $('spCount').textContent=(q?'':'Τα 100 είδη των κυπριακών θαλασσών (Τμήμα Αλιείας). ')+'Στη βάση: '+DB.length+' είδη, ενδεικτική λίστα.';
  let list;
  if(!q){
    list=CY.slice().sort((x,y)=>x.n.localeCompare(y.n,'el')).map(c=>({el:c.n,en:c.e,la:c.l}));
    SPECIES.forEach(x=>{ if(!CYL[x.l.toLowerCase()]) list.push({el:x.n,en:'',la:x.l}); });
  }
  else list=searchDB(q,60).concat(Array.isArray(extra)?extra.filter(e=>!DB.some(d=>d.la.toLowerCase()===e.la.toLowerCase())):[]);
  for(const sp of list) L.append(spItem(sp));
  if(!L.children.length) L.append(h('div',{class:'empty',text:'Κανένα είδος δεν ταιριάζει. Δοκίμασε αναζήτηση online.'}));
  $('spOnline').hidden=q.length<3;
}
$('spOnline').addEventListener('click',async()=>{
  const b=$('spOnline'); b.disabled=true; b.textContent='Αναζήτηση…';
  try{ const r=await gbifSearch($('spQ').value.trim()); renderSpecies(r); if(!r.length) toast('Δεν βρέθηκαν ψάρια online.'); }
  catch(e){ toast('Η online αναζήτηση δεν δούλεψε.'); }
  b.disabled=false; b.textContent='Αναζήτηση online (GBIF)';
});
$('spQ').addEventListener('input',()=>renderSpecies());
const TECH=[
 {n:'Βυθού',d:'Καλάμι με μολύβι και ένα ή περισσότερα αγκίστρια κοντά στον πυθμένα. Κατάλληλο για σαργούς, τσιπούρες, λιθρίνια.',g:'Καλάμι 2,4–3 m, πετονιά 0,25–0,35 mm, μολύβι ανάλογα με το ρεύμα.'},
 {n:'Jigging',d:'Κάθετη κίνηση μεταλλικού τεχνητού κοντά σε ύφαλο ή κατωφλι. Καλό για συναγρίδες και μαγιάτικα.',g:'Κοντό καλάμι jigging, μηχανισμός με καλή τριβή, braid, jigs 60–200 g.'},
 {n:'Τρόλινγκ',d:'Τράβηγμα τεχνητών πίσω από το σκάφος με σταθερή ταχύτητα. Για κυνηγούς, λούτσους και άλλα επιφανειακά.',g:'Ταχύτητα περίπου 4–7 κόμβοι, ηγέτες ανθεκτικοί στα δόντια.'},
 {n:'Spinning',d:'Ρίψη και μάζεμα τεχνητών κοντά στη ακτογραμμή ή πάνω από ρηχούς υφάλους. Για λαυράκια και λούτσους.',g:'Καλάμι 2,1–2,7 m, braid 0,15–0,25 mm, ηγέτης fluorocarbon.'},
 {n:'Ζωντανό δόλωμα',d:'Ζωντανό ψαράκι σε αγκίστρι, ελεύθερο ή στον πυθμένα. Για μεγάλα αρπακτικά.',g:'Δυνατό καλάμι, ηγέτης ανάλογα με το είδος, καλή φροντίδα του δολώματος.'}
];
function renderTech(){
  const L=$('g-tech'); L.replaceChildren();
  for(const t of TECH) L.append(h('div',{class:'card'},h('h3',{text:t.n}),h('p',{text:t.d}),h('div',{class:'note',text:'Εξοπλισμός: '+t.g})));
  L.append(h('p',{class:'note',text:'Οι τιμές είναι ενδεικτικές. Προσάρμοσέ τες στο σημείο, το ψάρι-στόχο και το ρεύμα.'}));
}
const CHECKS=['Σωσίβια για όλους στο σκάφος','VHF και φορτισμένο κινητό','Φάρμακα και κουτί πρώτων βοηθειών','Πυρσοί και σήμα κινδύνου','Άγκυρα και αρκετό σχοινί','Καύσιμο με εφεδρεία','Νερό και προστασία από τον ήλιο','Τσιμπίδα και γάντια για αγκάθια','Πρόγνωση καιρού ελεγμένη','Ενημέρωση κάποιου στη στεριά για τη διαδρομή'];
function renderChecks(){
  const saved=lsGet('psaro-checks',{}); const C=$('checks'); C.replaceChildren();
  CHECKS.forEach((t,i)=>{
    const id='ck'+i, cb=h('input',{type:'checkbox',id:id});
    cb.checked=!!saved[i];
    cb.addEventListener('change',()=>{const s2=lsGet('psaro-checks',{});s2[i]=cb.checked;lsSet('psaro-checks',s2);});
    C.append(h('div',{class:'chk'},cb,h('label',{for:id,text:t})));
  });
}
document.querySelectorAll('#tab-guide .seg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#tab-guide .seg button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  for(const g of ['species','tech','safety']) $('g-'+g).hidden=(g!==b.dataset.g);
}));

/* ---------- Bites and statistics ---------- */
document.querySelectorAll('#logSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#logSeg button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  for(const g of ['trips','bites','stats']) $('l-'+g).hidden=(g!==b.dataset.l);
}));
const nowLocalInput=()=>nicosiaToday()+'T'+fmt(nicosiaNowMin());
const PT={slow:'Πέφτει αργά',stable:'Σταθερή',rise:'Ανεβαίνει',fast:'Πέφτει απότομα'};
const MOON_LBL=['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα','Πανσέληνος','Φθίνουσα','Τελευταίο τέταρτο','Φθίνων μηνίσκος'];
function biteMs(b){
  const [y,m,d]=(b.date||nicosiaToday()).split('-').map(Number), [hh,mm]=(b.time||'12:00').split(':').map(Number);
  const off=b.tz!=null?b.tz:tzOffsetMin(new Date(Date.UTC(y,m-1,d,12)));
  return Date.UTC(y,m-1,d,hh,mm)-off*60000;
}
function biteMoon(b){let a=((biteMs(b)-REF)/86400000)%SYN; if(a<0)a+=SYN; return Math.floor(a/SYN*8+0.5)%8;}
const norm=t=>(t||'').trim().toLowerCase();

/* quick-log sheet */
let photoBlob=null, curLatin='', sheetFresh=true;
function syncLoc(){
  const m=$('bLocMode').value;
  $('bSpotWrap').hidden=m!=='spot'; $('bPickWrap').hidden=m!=='pick';
  $('bPickTxt').textContent=pickedPt?pickedPt.lat.toFixed(4)+', '+pickedPt.lon.toFixed(4):'Δεν έχει επιλεγεί θέση.';
}
function openSheet(){
  if(sheetFresh){
    $('bWhen').value=nowLocalInput();
    if(cond&&cond.press!=null) $('bPress').value=cond.press;
    sheetFresh=false;
    refreshConditions();
  }
  renderChips(); syncLoc();
  $('sheet').hidden=false;
}
function closeSheet(){ $('sheet').hidden=true; $('bSug').hidden=true; }
function resetSheet(){
  $('biteForm').reset(); photoBlob=null; curLatin=''; pickedPt=null; sheetFresh=true;
  $('bPrev').hidden=true; $('bPrevX').hidden=true; $('bErr').textContent='';
}
$('fab').addEventListener('click',openSheet);
$('bNew').addEventListener('click',openSheet);
$('bClose').addEventListener('click',closeSheet);
$('sheet').addEventListener('click',e=>{ if(e.target===$('sheet')) closeSheet(); });
$('bLocMode').addEventListener('change',()=>{syncLoc();});
$('bPickBtn').addEventListener('click',()=>{ closeSheet(); startPick('bite'); });
$('bFile').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    photoBlob=await resizeImage(f);
    $('bPrev').src=URL.createObjectURL(photoBlob); $('bPrev').hidden=false; $('bPrevX').hidden=false;
  }catch(err){ toast('Η φωτογραφία δεν διαβάστηκε.'); }
  e.target.value='';
});
$('bPrevX').addEventListener('click',()=>{photoBlob=null;$('bPrev').hidden=true;$('bPrevX').hidden=true;});
function renderChips(){
  const bites=Store.get('bites').slice().sort((a,b)=>biteMs(b)-biteMs(a));
  const uniq=(arr,n)=>[...new Set(arr.map(x=>(x||'').trim()).filter(Boolean))].slice(0,n);
  const fill=(el,items,input)=>{el.replaceChildren(); items.forEach(x=>el.append(h('button',{type:'button',class:'chip',text:x,onclick:()=>{input.value=x; if(input===$('bSpecies')){const m=DB.find(d=>dispName(d)===x); curLatin=m?m.la:(bites.find(b=>b.species===x)||{}).latin||'';}}})));};
  fill($('bChipsSp'),uniq(bites.map(b=>b.species),6),$('bSpecies'));
  fill($('bChipsBait'),uniq(bites.map(b=>b.bait),6),$('bBait'));
}
/* species suggestions */
let sugT=null, sugSeq=0;
function showSug(items){
  const box=$('bSug'); box.replaceChildren();
  items.forEach(sp=>box.append(h('button',{type:'button',class:'sugi',onclick:()=>{ $('bSpecies').value=dispName(sp); curLatin=sp.la; box.hidden=true; }},h('b',{text:dispName(sp)}),h('span',{class:'lat',text:(sp.el&&sp.en?sp.en+' · ':'')+sp.la}))));
  box.hidden=!items.length;
}
$('bSpecies').addEventListener('input',()=>{
  curLatin=''; const q=$('bSpecies').value.trim();
  clearTimeout(sugT);
  if(q.length<2){ $('bSug').hidden=true; return; }
  const local=searchDB(q,8); showSug(local);
  if(q.length>=4&&local.length<4){
    const seq=++sugSeq;
    sugT=setTimeout(async()=>{
      try{ const r=await gbifSearch(q); if(seq!==sugSeq||$('bSpecies').value.trim()!==q) return;
        showSug(local.concat(r.filter(e=>!local.some(d=>d.la.toLowerCase()===e.la.toLowerCase())).slice(0,6))); }catch(e){}
    },500);
  }
});
$('bSpecies').addEventListener('blur',()=>setTimeout(()=>{$('bSug').hidden=true;},200));
$('biteForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=$('biteForm').querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Αποθήκευση…';
  $('bErr').textContent='';
  try{
    const [date,time]=$('bWhen').value.split('T');
    const mode=$('bLocMode').value;
    const isNow=Math.abs(biteMs({date:date,time:time,tz:utcOff()})-Date.now())<90*60000;
    let c=cond;
    if(isNow||(mode==='auto'&&!cond)) c=await refreshConditions();
    let lat=null,lon=null,place='';
    if(mode==='auto'&&c&&c.lat!=null){lat=c.lat;lon=c.lon;}
    else if(mode==='spot'){const sp=Store.get('spots').find(x=>x.id===$('bSpot').value); if(sp){lat=sp.lat;lon=sp.lon;place=sp.name;}}
    else if(mode==='pick'&&pickedPt){lat=pickedPt.lat;lon=pickedPt.lon;}
    const num=id=>$(id).value===''?null:+$(id).value;
    const sName=$('bSpecies').value.trim();
    const rec={date:date,time:(time||'12:00').slice(0,5),tz:utcOff(),species:sName,latin:curLatin||'',bait:$('bBait').value.trim(),tech:$('bTech').value,
      depth:num('bDepth'),kg:num('bKg'),len:num('bLen'),press:num('bPress'),notes:$('bNotes').value.trim(),
      ptrend:isNow?$('dPress').value:null,wind:isNow?+$('dWind').value:null,wave:isNow?+$('dWave').value:null,cloud:isNow?$('dCloud').value:null,
      temp:isNow&&c&&c.temp!=null?c.temp:null,sst:isNow&&c&&c.sst!=null?c.sst:null,
      place:place,lat:lat,lon:lon,photo:!!photoBlob,src:'app'};
    const id=await Store.save('bites',rec);
    if(photoBlob){ try{await Photos.put(id,photoBlob);}catch(err){ rec.photo=false; await Store.save('bites',Object.assign({},rec,{id:id})); toast('Η φωτογραφία δεν αποθηκεύτηκε.'); } }
    resetSheet(); closeSheet();
    if(lat!=null){ toast('Αποθηκεύτηκε στον χάρτη'); showOnMap(lat,lon,id); }
    else { toast(mode==='auto'?'Αποθηκεύτηκε, αλλά δεν βρέθηκε θέση.':'Αποθηκεύτηκε χωρίς θέση.'); }
  }catch(err){ $('bErr').textContent='Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'; }
  btn.disabled=false; btn.textContent='Αποθήκευση στον χάρτη';
});
function updateSuggest(){
  const bites=Store.get('bites');
  const sel=$('stSpecies'), cur=sel.value; sel.replaceChildren(h('option',{value:'',text:'Όλα τα είδη'}));
  [...new Set(bites.map(b=>(b.species||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')).forEach(n=>sel.append(h('option',{value:n,text:n})));
  sel.value=[...sel.options].some(o=>o.value===cur)?cur:'';
}
function renderBites(){
  updateSuggest();
  const L=$('biteList'); L.replaceChildren();
  const list=Store.get('bites').slice().sort((a,b)=>biteMs(b)-biteMs(a));
  if(!list.length) L.append(h('div',{class:'empty',text:'Κανένα τσίμπημα ακόμα. Πάτα το + για να καταγράψεις το πρώτο.'}));
  for(const b of list){
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('bites',b.id); if(b.photo) await Photos.del(b.id);}catch(e){}
    });
    const acts=[del];
    if(typeof b.lat==='number') acts.unshift(h('button',{class:'btn ghost sm',type:'button',text:'Χάρτης',onclick:()=>showOnMap(b.lat,b.lon,b.id)}));
    const cd=[b.wind!=null?b.wind+' kn':null,b.wave!=null?b.wave+' m κύμα':null,b.press!=null?b.press+' hPa':null,b.ptrend?PT[b.ptrend]:null,MOON_LBL[biteMoon(b)]].filter(Boolean).join(' · ');
    const where=b.place||(typeof b.lat==='number'?b.lat.toFixed(4)+', '+b.lon.toFixed(4):'');
    const img=h('img',{class:'thumb',alt:''}); img.hidden=true; if(b.photo) loadPhoto(b.id,img);
    L.append(h('div',{class:'item'},
      h('div',{},h('b',{text:(b.species||'Άγνωστο')+(b.kg?' · '+b.kg+' kg':'')+(b.len?' · '+b.len+' cm':'')}),
        h('div',{class:'meta mono',text:(b.date||'')+' '+(b.time||'')}),
        h('div',{class:'meta',text:[b.bait,b.tech,b.depth!=null?b.depth+' m βάθος':null,where].filter(Boolean).join(' · ')}),
        h('div',{class:'meta',text:cd}),img),
      h('div',{class:'acts'},acts)));
  }
  renderChips(); drawMap(); renderReco();
}
/* recommendation */
function renderReco(){
  const card=$('recoCard'); if(!card) return;
  const all=Store.get('bites').filter(b=>norm(b.bait));
  const body=$('recoBody'); body.replaceChildren();
  if(all.length<5){ card.hidden=false; body.append(h('p',{class:'muted',text:'Μετά από 5 τσιμπήματα με καταγεγραμμένο δόλωμα θα σου προτείνω τι να βάλεις, με βάση σελήνη, πίεση, άνεμο και ώρα. Έχεις '+all.length+'.'})); return; }
  const sm=sunMoon(nicosiaToday()), mi=Math.floor(sm.f*8+0.5)%8, pt=$('dPress').value, wb=w=>w<=5?0:w<=12?1:w<=18?2:3, wnow=wb(+$('dWind').value), blk=Math.floor(nicosiaNowMin()/180);
  const sc=new Map(), sp=new Map();
  for(const b of all){
    const md=Math.abs(biteMoon(b)-mi), mdist=Math.min(md,8-md);
    let w=1+(mdist<=1?1:0)+(b.ptrend===pt?1:0)+(b.wind!=null&&wb(b.wind)===wnow?1:0)+(Math.floor(parseInt((b.time||'12:00').slice(0,2),10)/3)===blk?1:0);
    const k=norm(b.bait); const e=sc.get(k)||{n:b.bait.trim(),w:0,c:0,sp:new Map()};
    e.w+=w; e.c++; if(b.species) e.sp.set(b.species.trim(),(e.sp.get(b.species.trim())||0)+1); sc.set(k,e);
  }
  const top=[...sc.values()].sort((a,b)=>b.w-a.w).slice(0,3);
  card.hidden=false;
  top.forEach((e,i)=>{
    const spc=[...e.sp.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(', ');
    body.append(h('div',{class:'bar',style:'grid-template-columns:auto 1fr'},h('b',{text:(i+1)+'.'}),h('span',{},h('b',{text:e.n}),h('span',{class:'muted',text:' · '+e.c+' τσιμπήματα'+(spc?' · '+spc:'')}))));
  });
  body.append(h('p',{class:'note',style:'margin:8px 0 0',text:'Βασίζεται στο δικό σου ιστορικό και στις τωρινές συνθήκες. Με λίγα δεδομένα είναι ένδειξη, όχι κανόνας.'}));
}
function tally(list,fn){const m=new Map();for(const b of list){const k=fn(b);if(k==null)continue;m.set(k,(m.get(k)||0)+1);}return m;}
function barsCard(title,rows){
  const mxv=Math.max(1,...rows.map(r=>r[1]));
  return h('div',{class:'card'},h('h3',{text:title}),rows.map(r=>{
    const i=h('i'); i.style.width=(r[1]/mxv*100)+'%';
    return h('div',{class:'bar'},h('span',{text:r[0]}),h('span',{class:'t'},i),h('span',{class:'n',text:r[1]}));
  }));
}
function renderStats(){
  const all=Store.get('bites'), sel=$('stSpecies').value;
  const bs=sel?all.filter(b=>norm(b.species)===norm(sel)):all;
  const B=$('stBody'); B.replaceChildren();
  if(!all.length){B.append(h('div',{class:'empty',text:'Τα στατιστικά εμφανίζονται μόλις καταγράψεις τσιμπήματα στην καρτέλα «Τσιμπήματα».'}));return;}
  B.append(h('p',{class:'muted',text:bs.length+' τσιμπήματα'+(bs.length<15?'. Λίγα δεδομένα, δες τα ως ένδειξη και όχι ως κανόνα.':'')}));
  const sorted=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]);
  if(!sel){
    const m=tally(bs,b=>(b.species||'').trim()||null);
    B.append(barsCard('Ανά είδος',sorted(m).slice(0,10)));
  }
  const first=new Map(); bs.forEach(b=>{const k=norm(b.bait); if(k&&!first.has(k)) first.set(k,b.bait.trim());});
  const bm=tally(bs,b=>norm(b.bait)||'—');
  const baitRows=sorted(bm).slice(0,8).map(([k,v])=>[k==='—'?'Χωρίς καταγραφή':first.get(k),v]);
  B.append(barsCard('Με τι τσίμπησε',baitRows));
  const hm=tally(bs,b=>Math.floor(parseInt((b.time||'12:00').slice(0,2),10)/3));
  B.append(barsCard('Ώρα ημέρας',Array.from({length:8},(_,i)=>[pad(i*3)+'–'+pad((i*3+3)%24),hm.get(i)||0])));
  const mm=tally(bs,b=>biteMoon(b));
  B.append(barsCard('Φάση σελήνης',MOON_LBL.map((l,i)=>[l,mm.get(i)||0])));
  const pm=tally(bs,b=>b.ptrend||null);
  if(pm.size) B.append(barsCard('Τάση πίεσης',Object.keys(PT).map(k=>[PT[k],pm.get(k)||0])));
  const wm=tally(bs,b=>b.wind==null?null:b.wind<=5?0:b.wind<=12?1:b.wind<=18?2:3);
  if(wm.size) B.append(barsCard('Άνεμος',['0–5 kn','6–12 kn','13–18 kn','19+ kn'].map((l,i)=>[l,wm.get(i)||0])));
}
$('stSpecies').addEventListener('input',renderStats);

/* ---------- Live weather and location ---------- */
const COMPASS=['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
const dirName=d=>COMPASS[Math.round((((d%360)+360)%360)/45)%8];
const numOrNull=v=>typeof v==='number'&&isFinite(v)?v:null;
function getPosition(){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation){rej(new Error('no geolocation'));return;}
    navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}),rej,{enableHighAccuracy:true,timeout:8000,maximumAge:120000});
  });
}
function nearestRef(lat,lon){
  let best=null; const k=Math.cos(lat*Math.PI/180);
  for(const [n,lo,la] of REFS){const d=Math.hypot((lo-lon)*k*111.32,(la-lat)*110.57); if(!best||d<best.d) best={n:n,d:d};}
  return best&&best.d<40?best.n:null;
}
async function fetchJson(url){
  const ac=new AbortController(), t=setTimeout(()=>ac.abort(),9000);
  try{ const r=await fetch(url,{signal:ac.signal}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}
async function fetchConditions(lat,lon){
  const q='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4);
  const [w,m]=await Promise.allSettled([
    fetchJson('https://api.open-meteo.com/v1/forecast?'+q+'&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover&hourly=pressure_msl&past_hours=3&forecast_hours=1&wind_speed_unit=kn&timezone=auto'),
    fetchJson('https://marine-api.open-meteo.com/v1/marine?'+q+'&current=wave_height,wave_direction,wave_period,sea_surface_temperature&timezone=auto')
  ]);
  if(w.status!=='fulfilled') throw new Error('weather');
  const c=w.value.current||{}, hp=(w.value.hourly&&w.value.hourly.pressure_msl)||[];
  const press=numOrNull(c.pressure_msl), old=numOrNull(hp[0]);
  let ptrend=null;
  if(press!=null&&old!=null&&hp.length>=3){const d=press-old; ptrend=d<=-3?'fast':d<=-1?'slow':d>=1?'rise':'stable';}
  const cc=numOrNull(c.cloud_cover), ws=numOrNull(c.wind_speed_10m), wd=numOrNull(c.wind_direction_10m);
  const mc=m.status==='fulfilled'?(m.value.current||{}):{};
  const uo=numOrNull(w.value.utc_offset_seconds);
  return {lat:lat,lon:lon,utc:uo==null?null:Math.round(uo/60),temp:numOrNull(c.temperature_2m),press:press==null?null:Math.round(press),ptrend:ptrend,
    wind:ws==null?null:Math.round(ws),windDir:wd==null?null:dirName(wd),
    cloud:cc==null?null:cc<20?'clear':cc<70?'part':'over',
    wave:numOrNull(mc.wave_height),wavePeriod:numOrNull(mc.wave_period),sst:numOrNull(mc.sea_surface_temperature)};
}
function setLive(msg){ $('liveSub').textContent=msg; }
function applyConditions(c){
  if(!c) return;
  if(c.wind!=null) $('dWind').value=clamp(c.wind,0,40);
  if(c.wave!=null) $('dWave').value=clamp(Math.round(c.wave*10)/10,0,3);
  if(c.cloud) $('dCloud').value=c.cloud;
  if(c.ptrend&&PT[c.ptrend]) $('dPress').value=c.ptrend;
  if(c.press!=null) $('bPress').value=c.press;
  const near=nearestRef(c.lat,c.lon);
  const parts=[c.wind!=null?c.wind+' kn'+(c.windDir?' '+c.windDir:''):null,c.wave!=null?'κύμα '+c.wave.toFixed(1)+' m'+(c.wavePeriod?' · '+Math.round(c.wavePeriod)+' s':''):'κύμα μη διαθέσιμο',
    c.temp!=null?c.temp.toFixed(0)+'°C αέρας':null,c.sst!=null?c.sst.toFixed(0)+'°C θάλασσα':null,c.press!=null?c.press+' hPa'+(c.ptrend?' · '+PT[c.ptrend].toLowerCase():''):null].filter(Boolean);
  $('liveMain').textContent=parts.join(' · ');
  setLive('Ενημερώθηκε '+(c.date?c.date.split('-').reverse().join('/')+' ':'')+(c.at||'')+' · θέση '+c.lat.toFixed(2)+', '+c.lon.toFixed(2)+(near?' · κοντά σε '+near:''));
  setYou(c.lat,c.lon); renderWx();
  renderToday();
}
function renderWx(){
  const el=$('wx'); el.replaceChildren();
  const sm=sunMoon(nicosiaToday());
  const cell=(l,v)=>h('div',{},h('span',{class:'wl',text:l}),h('b',{text:v}));
  const c=cond||{};
  const dash='–';
  el.append(h('div',{class:'wxg'},
    cell('Σελήνη',Math.round(sm.illum*100)+'%'),cell('Πίεση',c.press!=null?c.press+' hPa':dash),cell('Αέρας',c.temp!=null?Math.round(c.temp)+'°C':dash),
    cell('Θάλασσα',c.sst!=null?Math.round(c.sst)+'°C':dash),cell('Άνεμος',c.wind!=null?c.wind+' kn'+(c.windDir?' '+c.windDir:''):dash),cell('Κύμα',c.wave!=null?c.wave.toFixed(1)+' m':dash)));
}
function refreshConditions(){
  if(refreshing) return refreshing;
  refreshing=(async()=>{
    $('liveRefresh').disabled=true; setLive('Ανανέωση καιρού…');
    try{
      let pos=null; try{ pos=await getPosition(); }catch(e){ if(cond&&cond.lat!=null) pos={lat:cond.lat,lon:cond.lon}; }
      if(!pos){ setLive('Δεν βρέθηκε τοποθεσία. Επίτρεψε την τοποθεσία στον browser και πάτα ανανέωση.'); return cond; }
      const c=await fetchConditions(pos.lat,pos.lon);
      c.at=fmt(nicosiaNowMin()); c.date=nicosiaToday(); cond=c; lsSet('psaro-cond',c); applyConditions(c); return c;
    }catch(e){
      setLive('Ο καιρός δεν φορτώθηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.'); return cond;
    }finally{ $('liveRefresh').disabled=false; refreshing=null; }
  })();
  return refreshing;
}
$('liveRefresh').addEventListener('click',()=>{refreshConditions();});

/* ---------- Backup ---------- */
const blobToDataUrl=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b);});
$('expBtn').addEventListener('click',async()=>{
  const btn=$('expBtn'); btn.disabled=true;
  try{
    const bites=Store.get('bites'), photos={};
    for(const b of bites) if(b.photo){ try{const bl=await Photos.get(b.id); if(bl) photos[b.id]=await blobToDataUrl(bl);}catch(e){} }
    const data={app:'psarovarka',v:2,spots:Store.get('spots'),trips:Store.get('trips'),bites:bites,photos:photos};
    const a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),download:'psarovarka-'+nicosiaToday()+'.json'});
    document.body.append(a); a.click(); a.remove();
  }catch(e){ $('impMsg').textContent='Η εξαγωγή απέτυχε.'; }
  btn.disabled=false;
});
$('impFile').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    const d=JSON.parse(await f.text()); let n=0;
    for(const k of ['spots','trips','bites']) for(const it of (Array.isArray(d[k])?d[k]:[])) if(it&&typeof it==='object'){await Store.save(k,it);n++;}
    const ph=d.photos&&typeof d.photos==='object'?d.photos:{};
    for(const id in ph){ try{ const bl=await (await fetch(ph[id])).blob(); await Photos.put(id,bl); }catch(err){} }
    $('impMsg').textContent=n+' εγγραφές εισήχθησαν.';
  }catch(err){ $('impMsg').textContent='Το αρχείο δεν διαβάστηκε.'; }
  e.target.value='';
});

/* ---------- Tabs and init ---------- */
function switchTab(t2){
  document.querySelectorAll('nav.tabs button[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.tab===t2)));
  for(const n of ['today','map','log','guide']) $('tab-'+n).hidden=(n!==t2);
  window.scrollTo(0,0);
  if(t2==='map'&&map) setTimeout(()=>map.invalidateSize(),50);
}
document.querySelectorAll('nav.tabs button[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
$('wx').addEventListener('click',()=>switchTab('today'));
const today=nicosiaToday();
$('dDate').value=today; $('tDate').value=today;
$('hdrDate').textContent=today.split('-').reverse().join('/');
['dDate','dWind','dWave','dPress','dCloud'].forEach(id=>$(id).addEventListener('input',()=>{renderToday();renderReco();}));
initMap();
renderToday(); renderSpecies(); renderTech(); renderChecks(); renderSpots(); renderTrips(); renderWx();
Store.on('spots',()=>{drawMap();renderSpots();});
Store.on('trips',renderTrips);
Store.on('bites',()=>{renderBites();renderStats();});
Store.init();
if(cond){ applyConditions(cond); } else { $('liveMain').textContent='Δεν υπάρχουν δεδομένα καιρού ακόμα.'; }
refreshConditions();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&(!cond||cond.date!==nicosiaToday()||Math.abs(nicosiaNowMin()-(parseInt((cond.at||'00:00').slice(0,2),10)*60+parseInt((cond.at||'00:00').slice(3,5),10)))>30)) refreshConditions();
});
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
