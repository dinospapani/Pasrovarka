/* «Πηγαίνω εκεί» (Direct to): γραμμή, απόσταση, πορεία, ταχύτητα και ώρα άφιξης προς ένα σημείο ή ψάρι. Δεν είναι ναυτικός χάρτης. */
(function(){
'use strict';
var C=window.PsaroCore, box=document.querySelector('.mapbox'); if(!C||!box||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, U=window.PsaroUnits;
var KEY='psaro-direct';
var tgt=C.lsGet(KEY,null); if(tgt&&(typeof tgt.lat!=='number'||typeof tgt.lon!=='number')) tgt=null;
var pos=null, prev=null, spd=null, wid=null, lastZ=0, zNames=[], arrived=false;
var layer=L.layerGroup().addTo(map), line=null, tm=null;
var bar=document.createElement('div'); bar.id='dtBar'; bar.hidden=true;
bar.innerHTML='<div class="dtmain"><b class="dtname"></b><span class="dtinfo"></span><span class="dtwarn" hidden></span></div><button type="button" class="dtx" aria-label="'+T('Τέλος πλοήγησης','Stop navigation')+'">✕</button>';
box.appendChild(bar);
var nameEl=bar.querySelector('.dtname'), infoEl=bar.querySelector('.dtinfo'), warnEl=bar.querySelector('.dtwarn');

var R=Math.PI/180;
function distKm(a,b,c,d){ var dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742*Math.asin(Math.min(1,Math.sqrt(x))); }
function bearing(a,b,c,d){ var y=Math.sin((d-b)*R)*Math.cos(c*R), x=Math.cos(a*R)*Math.sin(c*R)-Math.sin(a*R)*Math.cos(c*R)*Math.cos((d-b)*R); return (Math.atan2(y,x)/R+360)%360; }
var DIRS=['N','NE','E','SE','S','SW','W','NW'];
function card(deg){ return DIRS[Math.round(deg/45)%8]; }
function inRing(lat,lon,r){ var ins=false; for(var i=0,j=r.length-1;i<r.length;j=i++){ var yi=r[i][0],xi=r[i][1],yj=r[j][0],xj=r[j][1]; if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) ins=!ins; } return ins; }
function crossed(a,b,c,d){
  var Z=window.ZONES||[], names={}, n=Math.max(2,Math.min(300,Math.ceil(distKm(a,b,c,d)*1000/40)));
  for(var k=0;k<=n;k++){ var f=k/n, la=a+(c-a)*f, lo=b+(d-b)*f;
    Z.forEach(function(z){ if(names[z.n]) return; var cnt=0; for(var r=0;r<z.p.length;r++) if(inRing(la,lo,z.p[r])) cnt++; if(cnt%2===1) names[z.n]=1; }); }
  return Object.keys(names);
}
function fmtEta(min){ if(min>=600) return '>10'+T('ω','h'); var h=Math.floor(min/60), m=Math.round(min%60); return h?h+T('ω ','h ')+m+T('λ','m'):Math.max(1,m)+T('λ','m'); }

function render(){
  layer.clearLayers(); line=null; tm=null;
  if(!tgt){ bar.hidden=true; document.body.classList.remove('hasdt'); return; }
  bar.hidden=false; document.body.classList.add('hasdt');
  tm=L.circleMarker([tgt.lat,tgt.lon],{radius:9,color:'#fff',weight:3,fillColor:'#e8541e',fillOpacity:1}).addTo(layer);
  nameEl.textContent='➤ '+(tgt.name||T('Σημείο','Point'));
  if(!pos){ infoEl.textContent=T('Αναμονή για GPS…','Waiting for GPS…'); warnEl.hidden=true; return; }
  var d=distKm(pos.lat,pos.lon,tgt.lat,tgt.lon), b=bearing(pos.lat,pos.lon,tgt.lat,tgt.lon);
  line=L.polyline([[pos.lat,pos.lon],[tgt.lat,tgt.lon]],{color:'#ff8a50',weight:3,dashArray:'8 8',opacity:.95}).addTo(layer);
  var nm=d/1.852, kn=spd!=null?spd*1.94384:null, parts=[];
  parts.push(U?U.dist(d,d<10?(d<1?2:1):0):d.toFixed(1)+' km');
  parts.push(('00'+Math.round(b)).slice(-3)+'° '+card(b));
  if(kn!=null&&kn>=0.8){ parts.push(kn.toFixed(1)+' kn'); parts.push('ETA '+fmtEta(nm/kn*60)); }
  infoEl.textContent=parts.join(' · ');
  var now=Date.now();
  if(now-lastZ>4000){ lastZ=now; zNames=crossed(pos.lat,pos.lon,tgt.lat,tgt.lon); }
  warnEl.hidden=!zNames.length; warnEl.textContent=zNames.length?'⚠ '+T('Περνά μέσα από απαγορευμένη περιοχή: ','Crosses a no-fishing zone: ')+zNames.join(', '):'';
  if(d<0.05&&!arrived){ arrived=true; try{ if(navigator.vibrate) navigator.vibrate([120,80,120]); }catch(e){} try{ C.toast(T('Έφτασες στο σημείο','You have arrived')); }catch(e){} setTimeout(function(){ if(arrived) clear(); },4000); }
}
function onPos(p){
  var c=p.coords, t=Date.now(); if(c.accuracy&&c.accuracy>80) return;
  var np={lat:c.latitude,lon:c.longitude,t:t};
  var v=(c.speed!=null&&!isNaN(c.speed))?c.speed:null;
  if(v==null&&prev&&t-prev.t>=2000){ v=distKm(prev.lat,prev.lon,np.lat,np.lon)*1000/((t-prev.t)/1000); }
  if(v!=null) spd=spd==null?v:spd*0.6+v*0.4;
  if(!prev||t-prev.t>=2000) prev=np;
  pos=np; render();
}
function onErr(e){ if(e&&e.code===1){ try{ C.toast(T('Δεν δόθηκε άδεια θέσης. Χωρίς GPS δεν υπάρχει πορεία.','Location permission denied. No course without GPS.')); }catch(x){} } }
function begin(){ if(wid!=null||!navigator.geolocation) return; try{ wid=navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:3000,timeout:30000}); }catch(e){ wid=null; } }
function stop(){ if(wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } }
function go(lat,lon,name){ tgt={lat:+lat,lon:+lon,name:(name||'').slice(0,40)}; C.lsSet(KEY,tgt); arrived=false; spd=null; prev=null; lastZ=0; map.closePopup(); begin(); render(); try{ C.toast(T('Πλοήγηση προς ','Heading to ')+(tgt.name||T('σημείο','point'))); }catch(e){} }
function clear(){ tgt=null; arrived=false; C.lsSet(KEY,null); stop(); render(); }
bar.querySelector('.dtx').addEventListener('click',function(e){ e.stopPropagation(); clear(); });
bar.querySelector('.dtmain').addEventListener('click',function(){ if(!tgt) return; var pts=[[tgt.lat,tgt.lon]]; if(pos) pts.push([pos.lat,pos.lon]); if(pts.length>1) map.fitBounds(L.latLngBounds(pts),{padding:[70,70],maxZoom:16}); else map.flyTo(pts[0],Math.max(map.getZoom(),14)); });

/* κουμπί «Πηγαίνω εκεί» σε κάθε παράθυρο πληροφοριών του χάρτη */
map.on('popupopen',function(e){
  var p=e.popup, el=p.getElement&&p.getElement(); if(!el) return;
  var pop=el.querySelector('.pop'); if(!pop||pop.querySelector('.pdirect')||pop.classList.contains('nodirect')) return;
  var ll=p.getLatLng&&p.getLatLng(); if(!ll) return;
  var nm=(pop.querySelector('b')||{}).textContent||'';
  var b=document.createElement('button'); b.type='button'; b.className='pact pdirect'+(pop.classList.contains('pmap')?'':' solo');
  b.innerHTML='<svg viewBox="0 0 24 24" class="pi"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg><span></span>'; b.querySelector('span').textContent=T('Πηγαίνω εκεί','Go there');
  b.addEventListener('click',function(){ go(ll.lat,ll.lng,nm); });
  pop.appendChild(b);
});
window.PsaroDirect={go:go,clear:clear,target:function(){ return tgt; }};
if(tgt){ begin(); render(); }
})();
