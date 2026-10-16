/* Καρτέλα «Πρόγνωση»: 7 ημέρες συνθηκών και δείκτη ψαρέματος, επιλογή τοποθεσίας, ειδοποιήσεις για καλές μέρες. */
(function(){
'use strict';
var C=window.PsaroCore, PF=window.PF; if(!C||!PF||!document.getElementById('tab-fc')) return;
var $=C.$, h=C.h, pad=C.pad, lsGet=C.lsGet, lsSet=C.lsSet, toast=C.toast;
var Cl=function(){ return window.PsaroCloud&&window.PsaroCloud.logged()?window.PsaroCloud:null; };
var places=lsGet('psaro-places',[]); if(!Array.isArray(places)) places=[];
var sel=lsGet('psaro-fcsel','gps');
var nt=Object.assign({on:false,threshold:75,notified:{},server:false,gpsWatch:true,pressure:true},lsGet('psaro-notify',{}));
if(!nt.notified||typeof nt.notified!=='object') nt.notified={};
var fc=null, fcPlace=null, busy=false;
var EN=window.LANG==='en';
var DAYN=EN?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
var DAYS=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
function dl(date){ var dt=new Date(date+'T12:00:00Z'); return DAYS[dt.getUTCDay()]+' '+date.slice(8)+'/'+date.slice(5,7); }
var DIRS=window.LANG==='en'?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dirName(d){ return d==null?'':DIRS[Math.round(d/45)%8]; }
function wxIcon(c){ if(c==null) return '🌤️'; if(c>=95) return '⛈️'; if(c>=80) return '🌦️'; if(c>=61) return '🌧️'; if(c>=51) return '🌦️'; if(c>=45) return '🌫️'; if(c<=1) return '☀️'; if(c===2) return '🌤️'; return '☁️'; }
function wxText(c){ if(c==null) return ''; if(c>=95) return 'Καταιγίδα'; if(c>=80) return 'Μπόρες'; if(c>=61) return 'Βροχή'; if(c>=51) return 'Ψιχάλα'; if(c>=45) return 'Ομίχλη'; if(c<=1) return 'Καθαρός ουρανός'; if(c===2) return 'Λίγα σύννεφα'; return 'Συννεφιά'; }
function fmtMin(m){ m=((Math.round(m)%1440)+1440)%1440; return pad(Math.floor(m/60))+':'+pad(m%60); }
function save(){ lsSet('psaro-places',places); lsSet('psaro-fcsel',sel); lsSet('psaro-notify',nt); }

/* ---------- τοποθεσίες ---------- */
function gps(){
  var c=C.getCond(); if(!c||c.lat==null) return null;
  return {id:'gps',name:EN?'My location':'Η θέση μου',lat:c.lat,lon:c.lon,watch:nt.gpsWatch!==false,gps:true};
}
function allPlaces(){ var g=gps(); return (g?[g]:[]).concat(places); }
function findPlace(id){ return allPlaces().filter(function(p){ return p.id===id; })[0]||null; }
function pid(lat,lon){ return 'p'+Math.round(lat*100)+'_'+Math.round(lon*100); }
function addPlace(name,lat,lon){
  var id=pid(lat,lon), ex=places.filter(function(p){ return p.id===id; })[0];
  if(!ex){ places.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:true}); places=places.slice(0,10); }
  sel=id; save(); renderPlaces(); load(); syncNotify();
}
function renderPlaces(){
  var box=$('plChips'); box.replaceChildren();
  var list=allPlaces();
  if(!list.length) box.append(h('span',{class:'note',text:'Πάτα «Η θέση μου» στον χάρτη ή αναζήτησε μια τοποθεσία.'}));
  list.forEach(function(p){
    var b=h('button',{type:'button',class:'chip','aria-pressed':String(p.id===sel),text:(p.gps?'📍 ':'')+p.name+(p.watch===false?'':' 🔔')});
    b.addEventListener('click',function(){ sel=p.id; save(); renderPlaces(); load(); });
    box.append(b);
  });
}
async function geocode(){
  var q=$('plQ').value.trim(), R=$('plRes'); R.replaceChildren(); if(q.length<2) return;
  R.append(h('div',{class:'note',text:'Αναζήτηση…'}));
  try{
    var r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=6&format=json&language='+(window.LANG==='en'?'en':'el'));
    var j=await r.json(); R.replaceChildren();
    var res=(j&&j.results)||[];
    if(!res.length){ R.append(h('div',{class:'note',text:'Δεν βρέθηκε τοποθεσία.'})); return; }
    res.forEach(function(x){
      var label=[x.name,x.admin1,x.country].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
      var it=h('button',{type:'button',class:'item plres'},h('b',{text:x.name}),h('span',{class:'meta',text:label}));
      it.addEventListener('click',function(){ R.replaceChildren(); $('plQ').value=''; addPlace(x.name,x.latitude,x.longitude); });
      R.append(it);
    });
  }catch(e){ R.replaceChildren(h('div',{class:'note',text:'Η αναζήτηση δεν δούλεψε. Έλεγξε τη σύνδεση.'})); }
}
function showSpots(){
  var box=$('plSpotList'); box.hidden=!box.hidden; if(box.hidden) return; box.replaceChildren();
  var sp=(C.Store.get('spots')||[]).filter(function(s){ return typeof s.lat==='number'&&typeof s.lon==='number'; });
  if(!sp.length) box.append(h('span',{class:'note',text:'Δεν έχεις αποθηκευμένα σημεία με συντεταγμένες.'}));
  sp.forEach(function(s){ var b=h('button',{type:'button',class:'chip',text:s.name||'Σημείο'}); b.addEventListener('click',function(){ box.hidden=true; addPlace(s.name||'Σημείο',s.lat,s.lon); }); box.append(b); });
}

/* ---------- πρόγνωση ---------- */
async function load(force){
  var p=findPlace(sel)||allPlaces()[0]; 
  if(!p){ renderFc(null,null,'Χρειάζεται τοποθεσία. Πάτα «Η θέση μου» στον χάρτη ή αναζήτησε μία.'); return; }
  if(p.id!==sel){ sel=p.id; renderPlaces(); }
  var cache=lsGet('psaro-fc7',null);
  if(!force&&cache&&cache.id===p.id&&Date.now()-cache.t<3600e3&&cache.fc){ renderFc(p,cache.fc,'',cache.t); return; }
  if(busy) return; busy=true; $('fcSub').textContent='Φόρτωση…';
  try{
    var f=await PF.getForecast(p.lat,p.lon,null,{days:7});
    lsSet('psaro-fc7',{id:p.id,t:Date.now(),fc:f}); renderFc(p,f,'',Date.now());
  }catch(e){
    try{ console.error('forecast',e); }catch(e0){}
    if(cache&&cache.id===p.id&&cache.fc) renderFc(p,cache.fc,'Δεν φορτώθηκε νέα πρόγνωση. Δείχνω την τελευταία αποθηκευμένη.',cache.t);
    else renderFc(p,null,'Η πρόγνωση δεν φορτώθηκε. Έλεγξε τη σύνδεση.');
  }finally{ busy=false; }
}
function tileEl(l,v){ return h('div',{class:'ft'},h('i',{text:l}),h('b',{text:v})); }
function reason(d){
  if(d.safe) return '';
  var w=d.wx||{}, r=[];
  if(d.why==='night') return 'Δεν απομένει φως.';
  if(w.windMax!=null&&w.windMax>14) r.push((EN?'wind up to ':'άνεμος έως ')+PF.bft(w.windMax)+' Bft');
  if(w.waveMax!=null&&w.waveMax>0.9) r.push((EN?'waves up to ':'κύμα έως ')+w.waveMax.toFixed(1)+' m');
  if(w.gustMax!=null&&w.gustMax>24) r.push((EN?'gusts up to ':'ριπές έως ')+PF.bft(w.gustMax)+' Bft');
  if(w.code!=null&&w.code>=95) r.push('καταιγίδα');
  return 'Δεν υπάρχει ασφαλές παράθυρο'+(r.length?': '+r.join(', '):'')+'.';
}
function renderFc(p,f,note,t){
  fc=f; fcPlace=p;
  var D=$('fcDays'), W=$('fcWeek'); D.replaceChildren(); W.replaceChildren();
  $('fcName').textContent=p?p.name:'';
  $('fcSub').textContent=p&&f?('Ενημερώθηκε '+new Date(t||Date.now()).toLocaleTimeString(EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'})+' · '+p.lat.toFixed(2)+', '+p.lon.toFixed(2)):'';
  $('fcNote').textContent=note||'';
  var wb=$('fcWatch'), delBtn=$('plDel');
  wb.hidden=!p; delBtn.hidden=!p||!!(p&&p.gps);
  if(p){ var on=p.watch!==false; wb.setAttribute('aria-pressed',String(on)); wb.textContent=on?'🔔 Ειδοποιήσεις: ναι':'🔕 Ειδοποιήσεις: όχι'; }
  if(!f){ $('fcBest').textContent=''; if(note) D.append(h('div',{class:'empty',text:note})); $('fcNote').textContent=''; return; }
  var today=f.nowLocal.slice(0,10), bestD=null;
  f.days.forEach(function(d){ if(d.safe&&(!bestD||d.best>bestD.best)) bestD=d; });
  $('fcBest').textContent=bestD?('Καλύτερη μέρα: '+dl(bestD.date)+' · '+(EN?'score ':'δείκτης ')+bestD.best+(bestD.win?' · '+pad(bestD.win.s)+':00–'+pad((bestD.win.e+1)%24)+':00':'')):'Καμία ασφαλής μέρα στο εύρος της πρόγνωσης.';
  f.days.forEach(function(d){
    var dt=new Date(d.date+'T12:00:00Z'), w=d.wx||{};
    var good=d.safe&&d.best>=75, mid=d.safe&&d.best>=60, cls=!d.safe?'none':good?'good':mid?'mid':'bad';
    var col=h('button',{type:'button',class:'wkc','aria-label':dl(d.date)},h('span',{class:'wkv',text:d.safe?String(d.best):'–'}),h('span',{class:'wkbar '+cls,style:'height:'+(d.safe?Math.max(8,d.best):8)+'%'}),h('span',{class:'wkl',text:dl(d.date).split(' ')[0]}));
    col.addEventListener('click',function(){ var el=document.getElementById('fd-'+d.date); if(el){ el.open=true; el.scrollIntoView({behavior:'smooth',block:'start'}); } });
    W.append(col);
    var lab=(d.date===today?(EN?'Today':'Σήμερα'):DAYN[dt.getUTCDay()])+' '+d.date.slice(8)+'/'+d.date.slice(5,7);
    var sum=h('summary',{},
      h('span',{class:'fdi',text:wxIcon(w.code)}),
      h('span',{class:'fdt'},h('b',{text:lab}),h('span',{class:'meta',text:[w.tmax!=null?Math.round(w.tmin)+'–'+Math.round(w.tmax)+'°C':null,w.windAvg!=null?PF.bft(w.windAvg)+' Bft '+dirName(w.windDir):null,w.waveAvg!=null?w.waveAvg.toFixed(1)+' m':null].filter(Boolean).join(' · ')})),
      h('span',{class:'pill '+(d.safe?(good?'good':mid?'warn':'bad'):'bad'),text:d.safe?String(d.best):'–'}));
    var tiles=h('div',{class:'ftiles'},
      tileEl('Καιρός',wxText(w.code)||'–'),
      tileEl('Θερμοκρασία',w.tmax!=null?Math.round(w.tmin)+'–'+Math.round(w.tmax)+'°C':'–'),
      tileEl('Άνεμος',w.windMax!=null?PF.bft(w.windAvg)+' Bft ('+(EN?'up to ':'έως ')+PF.bft(w.windMax)+')':'–'),
      tileEl('Ριπές',w.gustMax!=null?PF.bft(w.gustMax)+' Bft':'–'),
      tileEl('Βροχή',w.rainMax!=null?w.rainMax+'%'+(w.rainMm>=0.1?' · '+w.rainMm.toFixed(1)+' mm':''):'–'),
      tileEl('Σύννεφα',w.cloudAvg!=null?Math.round(w.cloudAvg)+'%':'–'),
      tileEl('Πίεση',w.pStart!=null?Math.round(w.pEnd)+' hPa '+(w.pEnd-w.pStart>=1.5?'↑':w.pEnd-w.pStart<=-1.5?'↓':'→'):'–'),
      tileEl('Κύμα',w.waveMax!=null?w.waveAvg.toFixed(1)+' m ('+(EN?'up to ':'έως ')+w.waveMax.toFixed(1)+')'+(w.period?' · '+Math.round(w.period)+' s':''):'–'),
      tileEl('Θάλασσα',w.sst!=null?w.sst.toFixed(1)+'°C':'–'),
      tileEl('Σελήνη',Math.round(w.illum*100)+'%'),
      tileEl('Ανατολή / Δύση',fmtMin(w.rise)+' / '+fmtMin(w.set)),
      tileEl('Καλύτερο παράθυρο',d.safe&&d.win?pad(d.win.s)+':00–'+pad((d.win.e+1)%24)+':00':'–'));
    var mx=Math.max.apply(null,d.hours.map(function(x){ return x.score; }).concat([1]));
    var bars=h('div',{class:'minibars'}); var byHr={}; d.hours.forEach(function(x){ byHr[x.hr]=x; });
    for(var k=0;k<24;k++){ var x=byHr[k]; bars.append(h('i',{style:'height:'+(x?Math.round(x.score/mx*100):0)+'%;'+(x&&x.safe?'':'opacity:.25'),title:pad(k)+':00'+(x?' · '+x.score:'')})); }
    var det=h('details',{class:'fday',id:'fd-'+d.date},sum,tiles,
      d.safe?null:h('p',{class:'note sfwarn',text:reason(d)}),
      h('div',{class:'label',style:'margin-top:8px',text:'Δείκτης ανά ώρα (00 → 23, αχνές οι ώρες με ανασφαλείς συνθήκες)'}),bars);
    D.append(det);
  });
  $('fcNote').textContent=note||(EN?'Index 0–100 from wind, gusts, waves, pressure, clouds, storms, light and moon. Only hours with wind up to 4 Bft, gusts up to 6 Bft and waves up to 0.9 m count. Local times.':'Δείκτης 0–100 από άνεμο, ριπές, κύμα, πίεση, σύννεφα, καταιγίδες, φως και σελήνη. Μετράνε μόνο ώρες με άνεμο ως 4 Bft, ριπές ως 6 Bft και κύμα ως 0,9 m. Ώρες τοπικές.')
}

/* ---------- ειδοποιήσεις ---------- */
function cfgPlaces(){ return allPlaces().map(function(p){ return {id:p.id,name:p.name,lat:+p.lat.toFixed(3),lon:+p.lon.toFixed(3),watch:p.watch!==false}; }); }
async function writeCfg(){
  var cfg={on:nt.on,threshold:nt.threshold,pressure:nt.pressure!==false,notified:nt.notified,server:!!nt.server,places:cfgPlaces()};
  try{ var c=await caches.open('psaro-cfg'); await c.put(new URL('__cfg',location.href).href,new Response(JSON.stringify(cfg))); }catch(e){}
}
var b64u=function(s){ var p='='.repeat((4-s.length%4)%4), r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(r,function(c){ return c.charCodeAt(0); }); };
async function subId(sub){
  var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub.endpoint));
  return Array.prototype.map.call(new Uint8Array(buf),function(b){ return ('0'+b.toString(16)).slice(-2); }).join('').slice(0,40);
}
async function getSub(create){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!window.VAPID_PUBLIC) return null;
  var reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription();
  if(!sub&&create) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(window.VAPID_PUBLIC)});
  return sub;
}
async function pushServer(){
  var cl=Cl(); if(!cl) return false;
  try{
    var sub=await getSub(true); if(!sub) return false;
    var body={id:await subId(sub),sub:sub.toJSON(),places:cfgPlaces(),threshold:nt.threshold,checked_at:null,updated_at:new Date().toISOString()};
    var H={Prefer:'resolution=merge-duplicates,return=minimal'};
    try{ await cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:nt.pressure!==false},body))}); }
    catch(e1){ await cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(body)}); }
    return true;
  }catch(e){ return false; }
}
async function dropServer(){
  var cl=Cl(); if(!cl) return;
  try{ var sub=await getSub(false); if(sub) await cl.rest('push_subs?id=eq.'+(await subId(sub)),{method:'DELETE'}); }catch(e){}
}
function ntStatus(t){ $('ntMsg').textContent=t; }
function sigOf(){ return JSON.stringify([nt.threshold,allPlaces().map(function(p){ return [p.id,+p.lat.toFixed(2),+p.lon.toFixed(2),p.watch!==false]; })]); }
async function syncNotify(onlyIfChanged){
  save();
  if(!nt.on){ await writeCfg(); return; }
  var sg=sigOf()+(nt.pressure!==false); if(onlyIfChanged&&nt.sig===sg&&nt.server) return; nt.sig=sg;
  var ok=await pushServer(); nt.server=ok; save(); await writeCfg();
  ntStatus(ok?'Ενεργό. Ο server ελέγχει την πρόγνωση περίπου κάθε 3 ώρες και σου στέλνει ειδοποίηση, ακόμα και με κλειστή εφαρμογή.':'Ενεργό μόνο όταν ανοίγεις την εφαρμογή (ή περιοδικά στο παρασκήνιο, αν το επιτρέπει το Android). Για ειδοποιήσεις με κλειστή εφαρμογή χρειάζεται η ρύθμιση του server.');
}
async function showNote(title,body){
  try{
    var reg=await navigator.serviceWorker.getRegistration();
    if(reg) await reg.showNotification(title,{body:body,tag:'psaro-ideal',icon:'icon-192.png',badge:'icon-192.png',data:{url:reg.scope}});
    else new Notification(title,{body:body});
  }catch(e){ try{ new Notification(title,{body:body}); }catch(e2){} }
}
async function localCheck(){
  if(!nt.on||nt.server||!('Notification' in window)||Notification.permission!=='granted') return;
  try{
    var r=await PF.checkPlaces({places:cfgPlaces(),threshold:nt.threshold,pressure:nt.pressure!==false,notified:nt.notified});
    nt.notified=r.notified; save(); await writeCfg();
    if(r.items.length) showNote(r.title,r.body);
  }catch(e){}
}
async function periodic(on){
  try{ var reg=await navigator.serviceWorker.ready; if(!reg.periodicSync) return false;
    if(on) await reg.periodicSync.register('psaro-forecast',{minInterval:12*3600*1000}); else await reg.periodicSync.unregister('psaro-forecast'); return true;
  }catch(e){ return false; }
}
$('ntPress').checked=nt.pressure!==false;
$('ntOn').checked=!!nt.on; $('ntThr').value=String(nt.threshold);
$('ntOn').addEventListener('change',async function(){
  if($('ntOn').checked){
    if(!('Notification' in window)){ $('ntOn').checked=false; ntStatus('Ο browser δεν υποστηρίζει ειδοποιήσεις.'); return; }
    var p=await Notification.requestPermission();
    if(p!=='granted'){ $('ntOn').checked=false; ntStatus('Δεν δόθηκε άδεια ειδοποιήσεων. Επίτρεψέ τες στις ρυθμίσεις του browser.'); return; }
    nt.on=true; nt.notified={}; await syncNotify(); await periodic(true); localCheck();
  } else { nt.on=false; save(); await writeCfg(); await dropServer(); await periodic(false); nt.server=false; save(); ntStatus('Οι ειδοποιήσεις έκλεισαν.'); }
});
$('ntThr').addEventListener('change',async function(){ nt.threshold=+$('ntThr').value; nt.notified={}; save(); if(nt.on){ await syncNotify(); localCheck(); } });
$('ntPress').addEventListener('change',function(){ nt.pressure=$('ntPress').checked; save(); if(nt.on){ syncNotify(); } });
$('ntTest').addEventListener('click',async function(){
  if(!('Notification' in window)){ ntStatus('Ο browser δεν υποστηρίζει ειδοποιήσεις.'); return; }
  var p=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(p!=='granted'){ ntStatus('Δεν δόθηκε άδεια ειδοποιήσεων.'); return; }
  await showNote('Δοκιμή ειδοποίησης','Οι ειδοποιήσεις του BiteCast δουλεύουν.'); ntStatus('Στάλθηκε δοκιμαστική ειδοποίηση.');
});
if(nt.on) ntStatus(nt.server?'Ενεργό (server).':'Ενεργό.');

/* ---------- events ---------- */
$('plGo').addEventListener('click',geocode);
$('plQ').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); geocode(); } });
$('plSpots').addEventListener('click',showSpots);
$('plMap').addEventListener('click',function(){ window.dispatchEvent(new Event('psaro-pickfc')); });
window.addEventListener('psaro-fcpick',function(e){ var d=e.detail; addPlace((EN?'Point ':'Σημείο ')+d.lat.toFixed(2)+', '+d.lon.toFixed(2),d.lat,d.lon); });
$('fcRefresh').addEventListener('click',function(){ load(true); });
$('fcWatch').addEventListener('click',function(){
  var p=findPlace(sel); if(!p) return;
  if(p.gps) nt.gpsWatch=!(nt.gpsWatch!==false); else p.watch=!(p.watch!==false);
  save(); renderPlaces(); renderFc(fcPlace&&findPlace(sel),fc,'',Date.now()); syncNotify();
});
$('plDel').addEventListener('click',function(){
  places=places.filter(function(p){ return p.id!==sel; }); sel='gps'; save(); renderPlaces(); load(); syncNotify();
});
document.querySelectorAll('nav.tabs button[data-tab="fc"]').forEach(function(b){ b.addEventListener('click',function(){ renderPlaces(); load(); }); });
document.addEventListener('psaro-cond',function(){ renderPlaces(); if(!document.getElementById('tab-fc').hidden) load(); else if(sel==='gps') { /* θα φορτώσει όταν ανοίξει */ } if(nt.on) syncNotify(true); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden) localCheck(); });
renderPlaces(); 
setTimeout(function(){ if(nt.on) { writeCfg(); localCheck(); } },3000);
})();
