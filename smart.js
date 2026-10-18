/* Έξυπνα εργαλεία: λιμάνι και σκάφος, «Πότε να γυρίσω», αυτονομία καυσίμου, θερμά σημεία, αυτόματη έναρξη/λήξη εξόδου,
   «Πέρσι τέτοια μέρα», λίστα ελέγχου, ώρες κινητήρα, υπενθύμιση άδειας, εβδομαδιαία περίληψη.
   Οι εκτιμήσεις είναι ενδεικτικές και δουλεύουν μόνο με ανοιχτή εφαρμογή και GPS. Δεν είναι ναυτικό όργανο. */
(function(){
'use strict';
var C=window.PsaroCore; if(!C||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, U=window.PsaroUnits;
var $=function(i){ return document.getElementById(i); };
var KEY='psaro-smart', R=Math.PI/180;
var S=C.lsGet(KEY,{}); if(!S||typeof S!=='object'||Array.isArray(S)) S={};
S.cruise=+S.cruise>0?+S.cruise:15; S.reserve=S.reserve!=null?+S.reserve:20; S.auto=S.auto!==false; S.ring=S.ring!==false;
S.hot=S.hot||{on:false,sp:'',per:'all'}; S.eng=S.eng||{h:0,every:100,last:0};
S.cl=S.cl||{items:null,done:{}}; if(!Array.isArray(S.cl.items)) S.cl.items=T(['Σωσίβια για όλους','Καύσιμα επαρκή','Δολώματα και εξοπλισμός','Άδεια ψαρέματος','Φορτισμένο κινητό','Νερό και φαγητό','Φαρμακείο πρώτων βοηθειών','Φακός / VHF'],['Lifejackets for everyone','Enough fuel','Bait and tackle','Fishing licence','Phone charged','Water and food','First aid kit','Torch / VHF']);
function save(){ C.lsSet(KEY,S); }
function distKm(a,b,c,d){ var dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742*Math.asin(Math.min(1,Math.sqrt(x))); }
function tripOn(){ var s=window.PsaroTrip&&window.PsaroTrip.state&&window.PsaroTrip.state(); return !!(s&&s.active); }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function dist(km){ return U?U.dist(km,km<10?(km<1?2:1):0):km.toFixed(1)+' km'; }
function fixNow(cb,fail){
  var fx=window.PsaroTrack&&window.PsaroTrack.fix&&window.PsaroTrack.fix();
  if(fx&&fx.lat!=null&&Date.now()-fx.t<60000){ cb({lat:fx.lat,lon:fx.lon}); return; }
  if(!navigator.geolocation){ fail&&fail(); return; }
  navigator.geolocation.getCurrentPosition(function(p){ cb({lat:p.coords.latitude,lon:p.coords.longitude}); },function(){ fail&&fail(); },{enableHighAccuracy:true,timeout:9000,maximumAge:30000});
}
function note(title,body,key,gap){
  var sent=C.lsGet('psaro-smart-sent',{}), now=Date.now(); if(key){ if(sent[key]&&now-sent[key]<gap) return; sent[key]=now; C.lsSet('psaro-smart-sent',sent); }
  try{ if(window.PsaroSea&&window.PsaroSea.notify) window.PsaroSea.notify(title,body); else C.toast(title+(body?' · '+body:'')); }catch(e){ C.toast(title); }
  try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){}
}

/* ---------- ζωνη πληροφοριών εξόδου: λιμάνι, ETA, καύσιμο ---------- */
var box=document.querySelector('.mapbox');
var chip=el('button','rtchip'); chip.type='button'; chip.id='rtChip'; chip.hidden=true; box.appendChild(chip);
chip.addEventListener('click',function(){ if(S.home&&window.PsaroDirect) window.PsaroDirect.go(S.home.lat,S.home.lon,S.home.name||T('Λιμάνι','Home')); else openPanel(); });
var ringL=L.layerGroup().addTo(map);
function badIn(){
  var c=C.lsGet('psaro-wxa',null); if(!c||!c.f||!c.f.nowLocal||!c.f.days||Date.now()-c.t>4*3600000) return null;
  var base=Date.parse(c.f.nowLocal.slice(0,16)+':00Z'), el0=(Date.now()-c.t)/60000, best=null;
  c.f.days.forEach(function(d){ (d.hours||[]).forEach(function(h){
    if(!h.t||best) return; var tm=Date.parse(h.t.slice(0,13)+':00:00Z'); if(isNaN(tm)||tm<base-3600000) return;
    if((h.wind||0)>=20||(h.gust||0)>=28||(h.wave||0)>=1.5) best={mins:Math.max(0,(tm-base)/60000-el0),wind:h.wind,wave:h.wave};
  }); });
  return best;
}
var atHome=0, endAsked=false;
function rt(){
  if(!tripOn()){ chip.hidden=true; ringL.clearLayers(); return; }
  fixNow(function(p){
    var now=Date.now(), parts=[], level='', msg='';
    if(S.tank>0&&S.burn>0){
      if(!S.fuel||S.fuel.L==null) S.fuel={L:S.tank,t:now};
      var dt=(now-(S.fuel.t||now))/3600000; if(dt>0&&dt<1) S.fuel.L=Math.max(0,S.fuel.L-S.burn*dt); S.fuel.t=now; save();
    }
    var d=null, eta=null;
    if(S.home){ d=distKm(p.lat,p.lon,S.home.lat,S.home.lon)*1.1; eta=d/1.852/S.cruise*60; parts.push('🏠 '+dist(d)+' · ~'+Math.max(1,Math.round(eta))+(EN?' min':'λ')); }
    if(S.fuel&&S.tank>0){
      parts.push('⛽ ~'+Math.round(S.fuel.L)+' L');
      if(d!=null){
        var need=d/1.852/S.cruise*S.burn, rsv=S.tank*S.reserve/100;
        if(S.fuel.L-need<rsv*0.5){ level='bad'; msg=T('Καύσιμο: χρειάζεσαι ~','Fuel: you need ~')+Math.ceil(need)+T(' L για να γυρίσεις και έχεις ~',' L to get home and have ~')+Math.round(S.fuel.L)+' L'; note('⛽ '+T('Χαμηλά καύσιμα','Low fuel'),msg,'fuel',25*60000); }
        else if(S.fuel.L-need<rsv){ level='warn'; msg=T('Το καύσιμο πλησιάζει την εφεδρεία','Fuel is close to the reserve'); note('⛽ '+T('Καύσιμο','Fuel'),msg+' (~'+Math.round(S.fuel.L)+' L)','fuelw',40*60000); }
      }
    }
    if(eta!=null){
      var b=badIn();
      if(b){
        var margin=b.mins-eta;
        if(margin<=20){ level='bad'; msg=T('Ώρα να γυρίσεις: χρειάζεσαι ~','Time to head back: you need ~')+Math.round(eta)+T('′ και ο καιρός χειροτερεύει σε ~',' min and the weather worsens in ~')+Math.round(b.mins)+(EN?' min':'′'); note('🏠 '+T('Πότε να γυρίσεις','When to head back'),msg,'back',25*60000); }
        else if(margin<=60&&!level){ level='warn'; msg=T('Ο καιρός χειροτερεύει σε ~','Weather worsens in ~')+Math.round(b.mins)+T('′. Η επιστροφή θέλει ~',' min. The trip home takes ~')+Math.round(eta)+(EN?' min':'′'); note('🏠 '+T('Προσοχή στον καιρό','Weather watch'),msg,'backw',40*60000); }
      }
      /* αυτόματη πρόταση λήξης: ήσυχος στο λιμάνι */
      if(S.auto&&d!=null&&d/1.1<0.2){ atHome=atHome||now; if(now-atHome>120000&&!endAsked){ endAsked=true; window.PsaroAsk(T('Φαίνεται ότι γύρισες στο λιμάνι. Να τελειώσει η έξοδος;','You seem to be back at the port. End the trip?'),{title:T('Τέλος εξόδου','End trip'),ok:T('Τέλος εξόδου','End trip'),cancel:T('Όχι ακόμα','Not yet')}).then(function(ok){ if(ok) $('tripBtn').click(); }); } } else atHome=0;
    }
    chip.hidden=!parts.length; chip.textContent=parts.join('  ·  '); chip.className='rtchip '+level; chip.title=msg;
    drawRing(p);
  },function(){});
}
function drawRing(){
  ringL.clearLayers(); if(!S.ring||!S.home||!(S.tank>0&&S.burn>0)||!S.fuel) return;
  var usable=Math.max(0,S.fuel.L-S.tank*S.reserve/100), rKm=usable/S.burn*S.cruise*1.852/2; if(rKm<0.3) return;
  L.circle([S.home.lat,S.home.lon],{radius:rKm*1000,color:'#e8a317',weight:2,dashArray:'8 8',fill:false}).bindTooltip(T('Όριο επιστροφής με εφεδρεία ','Point-of-no-return with ')+S.reserve+'%',{sticky:true}).addTo(ringL);
}
setInterval(rt,60000); window.addEventListener('psaro-sess',function(){ if(tripOn()){ endAsked=false; atHome=0; if(S.fuel) S.fuel.t=Date.now(); S.cl.done={}; save(); clBtnUpd(); autoStop(); } else autoStart(); setTimeout(rt,800); });
setTimeout(rt,3000);

/* ---------- αυτόματη πρόταση έναρξης ---------- */
var aw=null, aPrev=null, aHits=0;
function autoStop(){ if(aw!=null){ try{ navigator.geolocation.clearWatch(aw); }catch(e){} aw=null; } aPrev=null; aHits=0; }
function autoStart(){
  if(aw!=null||!S.auto||!S.home||tripOn()||!navigator.geolocation) return;
  try{ aw=navigator.geolocation.watchPosition(function(p){
    if(tripOn()){ autoStop(); return; }
    var c=p.coords, t=Date.now(), v=(c.speed!=null&&!isNaN(c.speed))?c.speed:null;
    if(v==null&&aPrev&&t-aPrev.t>=2000) v=distKm(aPrev.lat,aPrev.lon,c.latitude,c.longitude)*1000/((t-aPrev.t)/1000);
    aPrev={lat:c.latitude,lon:c.longitude,t:t};
    var away=distKm(c.latitude,c.longitude,S.home.lat,S.home.lon)*1000>400;
    aHits=(v!=null&&v>=2.5&&away)?aHits+1:0;
    if(aHits>=4){ aHits=0; var sent=C.lsGet('psaro-smart-sent',{}); if(sent.autoStart&&t-sent.autoStart<3*3600000) return; sent.autoStart=t; C.lsSet('psaro-smart-sent',sent);
      window.PsaroAsk(T('Φαίνεται ότι ξεκίνησες από το λιμάνι. Να ξεκινήσεις έξοδο, ώστε να καταγράφονται τα ψάρια;','You seem to have left the port. Start a trip so catches get recorded?'),{title:T('Έναρξη εξόδου','Start trip'),ok:T('Έναρξη','Start'),cancel:T('Όχι τώρα','Not now')}).then(function(ok){ if(ok&&window.PsaroTrip) window.PsaroTrip.sheet(); }); }
  },function(){},{enableHighAccuracy:true,maximumAge:5000,timeout:30000}); }catch(e){ aw=null; }
}

/* ---------- θερμά σημεία ---------- */
var hotL=L.layerGroup(), bH=el('button','mbtn'); bH.type='button'; bH.id='bHot'; bH.setAttribute('aria-label',T('Θερμά σημεία ψαρέματος','Catch hotspots')); bH.title=T('Θερμά σημεία από τα ψάρια σου','Hotspots from your catches');
bH.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3c1 3.2 4.5 4.8 4.5 9.2a4.5 4.5 0 01-9 0c0-2.2 1.1-3.5 2.3-4.6.1 1.9.9 2.6 1.9 2.4-.4-2.2-.6-4.4.3-7z"/></svg>';
var mbEl=document.querySelector('.mapbtns'), cfgBtn=$('bToolsCfg'); if(cfgBtn) mbEl.insertBefore(bH,cfgBtn); else mbEl.appendChild(bH);
function inPeriod(b){
  if(S.hot.per==='all') return true; if(!b.date) return false; var ms=Date.parse(b.date+'T12:00:00Z'), now=Date.now();
  if(S.hot.per==='90') return now-ms<=90*86400000;
  var m=+b.date.slice(5,7), cm=+C.nicosiaToday().slice(5,7), dm=Math.abs(m-cm); return Math.min(dm,12-dm)<=1;
}
function heat(){
  hotL.clearLayers(); bH.setAttribute('aria-pressed',String(!!S.hot.on)); if(!S.hot.on){ if(map.hasLayer(hotL)) map.removeLayer(hotL); return; } if(!map.hasLayer(hotL)) hotL.addTo(map);
  var z=map.getZoom(), cell=z>=14?0.002:z>=12?0.005:z>=10?0.02:0.08, B={}, mx=1;
  (C.Store.get('bites')||[]).forEach(function(b){
    if(typeof b.lat!=='number'||typeof b.lon!=='number'||!inPeriod(b)) return; if(S.hot.sp&&b.species!==S.hot.sp) return;
    var k=Math.floor(b.lat/cell)+'|'+Math.floor(b.lon/cell), o=B[k]||(B[k]={la:(Math.floor(b.lat/cell)+.5)*cell,lo:(Math.floor(b.lon/cell)+.5)*cell,n:0,kg:0,sp:{}});
    o.n++; o.kg+=+b.kg||0; if(b.species) o.sp[b.species]=(o.sp[b.species]||0)+1; mx=Math.max(mx,o.n);
  });
  Object.keys(B).forEach(function(k){
    var o=B[k], f=o.n/mx, col='hsl('+Math.round(55-55*f)+',95%,50%)';
    L.circle([o.la,o.lo],{radius:cell*111000*(0.55+0.35*Math.sqrt(f)),color:col,weight:1,fillColor:col,fillOpacity:.22+.45*f}).bindPopup(function(){
      var d=el('div','pop'); d.append(el('b','',o.n+T(' ψάρια εδώ',' fish here'))); var sp=Object.keys(o.sp).sort(function(a,b){ return o.sp[b]-o.sp[a]; }).slice(0,4).map(function(s){ return s+' ×'+o.sp[s]; }).join(', ');
      if(sp) d.append(el('div','meta',sp)); if(o.kg) d.append(el('div','meta',(Math.round(o.kg*10)/10)+' kg')); return d;
    }).addTo(hotL);
  });
}
bH.addEventListener('click',function(){ S.hot.on=!S.hot.on; save(); heat(); if(S.hot.on&&!hotL.getLayers().length) C.toast(T('Δεν υπάρχουν ψάρια με θέση για αυτά τα φίλτρα.','No located catches for these filters.')); });
map.on('zoomend moveend',function(){ if(S.hot.on) heat(); }); C.Store.on('bites',function(){ if(S.hot.on) heat(); });
heat();

/* ---------- «Πέρσι τέτοια μέρα» ---------- */
function lastYear(){
  var tt=$('tab-today'); if(!tt) return; var card=$('lyCard');
  if(!card){ card=el('div','card lycard'); card.id='lyCard'; card.hidden=true; var seg=tt.querySelector('.tabseg'); tt.insertBefore(card,seg?seg.nextSibling:tt.firstChild); }
  var td=C.nicosiaToday(), y0=+td.slice(0,4), tm=Date.UTC(2000,+td.slice(5,7)-1,+td.slice(8,10)), Y={};
  (C.Store.get('bites')||[]).forEach(function(b){
    if(!b.date) return; var y=+b.date.slice(0,4); if(y>=y0) return; var d=Date.UTC(2000,+b.date.slice(5,7)-1,+b.date.slice(8,10)); if(Math.abs(d-tm)>7*86400000) return;
    var o=Y[y]||(Y[y]={n:0,kg:0,sp:{},w:[]}); o.n++; o.kg+=+b.kg||0; if(b.species) o.sp[b.species]=(o.sp[b.species]||0)+1; if(b.wind!=null) o.w.push(b.wind);
  });
  var ys=Object.keys(Y).sort(function(a,b){ return b-a; });
  card.hidden=!ys.length; if(!ys.length) return; card.replaceChildren();
  card.append(el('div','label',T('Πέρσι τέτοια μέρα (±7 ημέρες)','Around this date in past years (±7 days)')));
  ys.forEach(function(y){
    var o=Y[y], sp=Object.keys(o.sp).sort(function(a,b){ return o.sp[b]-o.sp[a]; }).slice(0,3).map(function(s){ return s+' ×'+o.sp[s]; }).join(', ');
    var w=o.w.length?(U?U.wind(o.w.reduce(function(a,b){ return a+b; },0)/o.w.length):''):'';
    var r=el('div','lyrow'); r.append(el('b','',y),el('span','',o.n+T(' ψάρια',' fish')+(o.kg?' · '+(Math.round(o.kg*10)/10)+' kg':'')+(sp?' · '+sp:'')+(w?' · '+T('άνεμος ','wind ')+w:''))); card.append(r);
  });
}
C.Store.on('bites',lastYear); lastYear();

/* ---------- λίστα ελέγχου ---------- */
var clOv=el('div','cdov'); clOv.hidden=true; clOv.style.zIndex=4750; document.body.appendChild(clOv);
function clCount(){ var n=0; S.cl.items.forEach(function(i){ if(S.cl.done[i]) n++; }); return n; }
function clRender(){
  clOv.replaceChildren(); var card=el('div','cdcard clcard'); card.append(el('h3','',T('Λίστα ελέγχου πριν βγεις','Pre-departure checklist')));
  S.cl.items.forEach(function(it,i){
    var r=el('label','clrow'), c=el('input'); c.type='checkbox'; c.checked=!!S.cl.done[it]; c.addEventListener('change',function(){ S.cl.done[it]=c.checked; save(); clBtnUpd(); });
    var s=el('span','',it), x=el('button','clx','✕'); x.type='button'; x.setAttribute('aria-label',T('Διαγραφή','Delete')); x.addEventListener('click',function(e){ e.preventDefault(); S.cl.items.splice(i,1); save(); clRender(); clBtnUpd(); });
    r.append(c,s,x); card.append(r);
  });
  var bt=el('div','cdbtn'), add=el('button','',T('+ Προσθήκη','+ Add')), ok=el('button','acc',T('Έτοιμος','Done')); add.type='button'; ok.type='button';
  add.addEventListener('click',function(){ window.PsaroAsk.prompt(T('Νέο στοιχείο στη λίστα','New checklist item'),{title:T('Λίστα ελέγχου','Checklist'),ok:T('Προσθήκη','Add'),max:50}).then(function(v){ v=(v||'').trim(); if(v&&S.cl.items.indexOf(v)<0){ S.cl.items.push(v); save(); clRender(); clBtnUpd(); } }); });
  ok.addEventListener('click',function(){ clOv.hidden=true; });
  bt.append(add,ok); card.append(bt); clOv.append(card);
}
clOv.addEventListener('click',function(e){ if(e.target===clOv) clOv.hidden=true; });
function openCl(){ clRender(); clOv.hidden=false; }
var clBtn=null;
function clBtnUpd(){ if(clBtn) clBtn.textContent='✓ '+T('Λίστα ελέγχου','Checklist')+' ('+clCount()+'/'+S.cl.items.length+')'; }
(function(){ var go=$('sfStart'); if(!go) return; clBtn=el('button','btn ghost clbtn'); clBtn.type='button'; clBtn.addEventListener('click',openCl); go.parentNode.insertBefore(clBtn,go); clBtnUpd(); })();

/* ---------- ώρες κινητήρα, άδεια, εβδομαδιαία περίληψη ---------- */
window.addEventListener('psaro-tripend',function(e){
  var t=(C.Store.raw('trips')||[]).find(function(x){ return e.detail&&x.id===e.detail.id; }); if(!t||!t.startMs||!t.endMs) return;
  S.eng.h=Math.round((S.eng.h+Math.max(0,t.endMs-t.startMs-(t.pauseMs||0))/3600000)*10)/10; save();
  if(S.eng.every>0&&S.eng.h-S.eng.last>=S.eng.every) setTimeout(function(){ note('🔧 '+T('Service κινητήρα','Engine service'),T('Πέρασαν ','It has been ')+Math.round(S.eng.h-S.eng.last)+T(' ώρες από το τελευταίο service.',' h since the last service.')); },4000);
});
function licCheck(){
  if(!S.lic) return; var today=C.nicosiaToday(), days=Math.round((Date.parse(S.lic+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000), sent=C.lsGet('psaro-smart-sent',{});
  if(sent.lic===today) return; if(days<0||days<=14){ sent.lic=today; C.lsSet('psaro-smart-sent',sent); note('🪪 '+T('Άδεια ψαρέματος','Fishing licence'),days<0?T('Η άδεια έχει λήξει.','The licence has expired.'):T('Λήγει σε ','Expires in ')+days+T(' ημέρες.',' days.')); }
}
function weekly(){
  var now=Date.now(); if(S.weekly&&now-S.weekly<7*86400000) return; if(tripOn()) return;
  var all=C.Store.get('bites')||[], tr=C.Store.get('trips')||[]; if(!all.length&&!tr.length){ return; }
  var lo=new Date(now-7*86400000+C.utcMin()*60000).toISOString().slice(0,10), b=all.filter(function(x){ return (x.date||'')>=lo; }), t=tr.filter(function(x){ return (x.date||'')>=lo; });
  S.weekly=now; save(); if(!b.length&&!t.length) return;
  var kg=b.reduce(function(a,x){ return a+(+x.kg||0); },0), sp={}; b.forEach(function(x){ if(x.species) sp[x.species]=(sp[x.species]||0)+1; });
  var top=Object.keys(sp).sort(function(a,c){ return sp[c]-sp[a]; })[0];
  window.PsaroAsk(t.length+T(' έξοδοι · ',' trips · ')+b.length+T(' ψάρια · ',' fish · ')+(Math.round(kg*10)/10)+' kg'+(top?'\n'+T('Συχνότερο: ','Most frequent: ')+top:''),{title:T('Η εβδομάδα σου','Your week'),ok:T('Εντάξει','OK'),cancel:false});
}
setTimeout(licCheck,5000); setTimeout(weekly,8000);

/* ---------- πίνακας ρυθμίσεων ---------- */
var P=el('div'); P.id='smPanel'; P.hidden=true;
P.innerHTML='<div class="spcard"><div class="sphead"><b></b><button type="button" class="spx" aria-label="✕">✕</button></div><div class="spbody"></div></div>';
P.querySelector('b').textContent=T('Λιμάνι και σκάφος','Port and boat'); document.body.appendChild(P);
var body=P.querySelector('.spbody');
P.querySelector('.spx').addEventListener('click',function(){ P.hidden=true; }); P.addEventListener('click',function(e){ if(e.target===P) P.hidden=true; });
function sec(t){ body.append(el('div','smsec',t)); }
function row(t,d,ctl){ var r=el('div','sprow'), x=el('div','sptx'); x.append(el('b','',t)); if(d) x.append(el('span','',d)); r.append(x); if(ctl) r.append(ctl); body.append(r); return r; }
function btn(t,cls,fn){ var b=el('button','spb '+(cls||''),t); b.type='button'; b.addEventListener('click',fn); return b; }
function sw(on,fn){ var b=el('button','spsw'); b.type='button'; b.setAttribute('role','switch'); b.setAttribute('aria-checked',String(!!on)); b.addEventListener('click',fn); return b; }
function num(val,ph,fn,step){ var i=el('input','sminp'); i.type='number'; i.inputMode='decimal'; i.min='0'; i.step=step||'any'; i.placeholder=ph||''; if(val!=null&&val!=='') i.value=val; i.addEventListener('change',function(){ fn(i.value===''?null:+i.value); save(); }); return i; }
function render(){
  body.replaceChildren();
  sec(T('Λιμάνι','Port'));
  var spots=(C.Store.get('spots')||[]).filter(function(s){ return typeof s.lat==='number'; });
  var sel=el('select','sminp'); sel.append(new Option(T('Από τα σημεία μου…','From my spots…'),''));
  spots.forEach(function(s){ sel.append(new Option(s.name||'?',s.id)); });
  sel.addEventListener('change',function(){ var s=spots.find(function(x){ return x.id===sel.value; }); if(s){ S.home={lat:s.lat,lon:s.lon,name:s.name}; save(); autoStop(); autoStart(); render(); } });
  row(S.home?(S.home.name||T('Λιμάνι','Port'))+' ✓':T('Δεν έχει οριστεί','Not set'),S.home?S.home.lat.toFixed(4)+', '+S.home.lon.toFixed(4):T('Χρειάζεται για «Πότε να γυρίσω», αυτονομία και αυτόματες προτάσεις.','Needed for “when to head back”, range and auto suggestions.'),null);
  var r2=el('div','sprow'); r2.append(sel,btn(T('Θέση μου τώρα','My position'),'acc',function(){ fixNow(function(p){ S.home={lat:p.lat,lon:p.lon,name:T('Λιμάνι','Port')}; save(); autoStop(); autoStart(); render(); C.toast(T('Το λιμάνι ορίστηκε στη θέση σου.','Port set to your position.')); },function(){ C.toast(T('Δεν βρέθηκε θέση GPS.','No GPS fix.')); }); }));
  if(S.home) r2.append(btn(T('Καθαρισμός','Clear'),'',function(){ S.home=null; save(); autoStop(); render(); rt(); })); body.append(r2);
  sec(T('Σκάφος και καύσιμο','Boat and fuel'));
  row(T('Ταχύτητα πλεύσης (kn)','Cruise speed (kn)'),T('Για τον υπολογισμό ώρας επιστροφής.','Used for the return-time estimate.'),num(S.cruise,'15',function(v){ S.cruise=v>0?v:15; }));
  row(T('Ρεζερβουάρ (L)','Tank (L)'),null,num(S.tank,'',function(v){ S.tank=v; if(v>0&&!S.fuel) S.fuel={L:v,t:Date.now()}; }));
  row(T('Κατανάλωση (L/ώρα)','Burn (L/h)'),T('Μέση κατανάλωση σε πορεία.','Average burn while running.'),num(S.burn,'',function(v){ S.burn=v; }));
  row(T('Εφεδρεία (%)','Reserve (%)'),null,num(S.reserve,'20',function(v){ S.reserve=v==null?20:v; }));
  row(T('Καύσιμο τώρα (L)','Fuel now (L)'),S.fuel?T('Εκτίμηση ~','Estimate ~')+Math.round(S.fuel.L)+' L':T('Μετά τον ανεφοδιασμό βάλε τα λίτρα.','Enter litres after refuelling.'),num(S.fuel?Math.round(S.fuel.L):'', 'L',function(v){ if(v!=null) S.fuel={L:v,t:Date.now()}; }));
  row(T('Δαχτυλίδι αυτονομίας','Range ring'),T('Στον χάρτη, γύρω από το λιμάνι, κατά την έξοδο.','On the map around the port during a trip.'),sw(S.ring,function(){ S.ring=!S.ring; save(); render(); rt(); }));
  sec(T('Κινητήρας','Engine'));
  row(T('Ώρες κινητήρα','Engine hours'),T('Προστίθενται κατά προσέγγιση από τις εξόδους.','Added approximately from your trips.'),num(S.eng.h,'0',function(v){ S.eng.h=v||0; }));
  row(T('Service κάθε (ώρες)','Service every (h)'),T('Τελευταίο στις ','Last at ')+S.eng.last+' h',num(S.eng.every,'100',function(v){ S.eng.every=v||0; }));
  row(T('Έγινε service','Service done'),null,btn(T('Τώρα','Now'),'',function(){ S.eng.last=S.eng.h; save(); render(); }));
  sec(T('Αυτόματα','Automatic'));
  row(T('Προτάσεις έναρξης και λήξης','Start and end suggestions'),T('Ρωτά όταν φεύγεις από το λιμάνι ή γυρίζεις. Χρησιμοποιεί GPS όσο η εφαρμογή είναι ανοιχτή.','Asks when you leave or return to the port. Uses GPS while the app is open.'),sw(S.auto,function(){ S.auto=!S.auto; save(); if(S.auto) autoStart(); else autoStop(); render(); }));
  sec(T('Θερμά σημεία','Hotspots'));
  var spn={}; (C.Store.get('bites')||[]).forEach(function(b){ if(b.species) spn[b.species]=1; });
  var s1=el('select','sminp'); s1.append(new Option(T('Όλα τα είδη','All species'),'')); Object.keys(spn).sort().forEach(function(k){ s1.append(new Option(k,k)); }); s1.value=S.hot.sp||'';
  s1.addEventListener('change',function(){ S.hot.sp=s1.value; save(); heat(); });
  var s2=el('select','sminp'); [['all',T('Όλες οι περίοδοι','All time')],['90',T('Τελευταίες 90 ημέρες','Last 90 days')],['season',T('Τρέχουσα εποχή (±1 μήνας)','This season (±1 month)')]].forEach(function(o){ s2.append(new Option(o[1],o[0])); }); s2.value=S.hot.per||'all';
  s2.addEventListener('change',function(){ S.hot.per=s2.value; save(); heat(); });
  row(T('Εμφάνιση στον χάρτη','Show on map'),T('Κουμπί φλόγας στη δεξιά στήλη. Δείχνει πού πιάνεις, χωρίς μεμονωμένα ψάρια.','Flame button on the right. Shows where you catch, without individual fish.'),sw(S.hot.on,function(){ S.hot.on=!S.hot.on; save(); heat(); render(); }));
  var r3=el('div','sprow'); r3.append(s1,s2); body.append(r3);
  sec(T('Άδεια και λίστα','Licence and checklist'));
  var li=el('input','sminp'); li.type='date'; if(S.lic) li.value=S.lic; li.addEventListener('change',function(){ S.lic=li.value||null; save(); var s=C.lsGet('psaro-smart-sent',{}); delete s.lic; C.lsSet('psaro-smart-sent',s); licCheck(); });
  row(T('Λήξη άδειας ψαρέματος','Licence expiry'),T('Υπενθύμιση 14 ημέρες πριν.','Reminder 14 days before.'),li);
  row(T('Λίστα ελέγχου','Checklist'),clCount()+'/'+S.cl.items.length,btn(T('Άνοιγμα','Open'),'',openCl));
  body.append(el('p','note',T('Οι εκτιμήσεις (ώρα επιστροφής, καύσιμο) είναι ενδεικτικές. Δεν αντικαθιστούν την κρίση σου ούτε τον κανονικό εξοπλισμό.','Estimates (return time, fuel) are indicative. They do not replace your judgement or proper equipment.')));
}
function openPanel(){ render(); P.hidden=false; }
(window.PsaroSeaRows=window.PsaroSeaRows||[]).push(function(){
  var r=el('div','sprow'), x=el('div','sptx'); x.append(el('b','',T('Λιμάνι και σκάφος','Port and boat')),el('span','',S.home?T('Λιμάνι ορισμένο','Port set')+(S.tank?' · '+S.tank+' L':''):T('Όρισε λιμάνι, καύσιμο και αυτόματες προτάσεις.','Set port, fuel and automatic suggestions.')));
  r.append(x,btn(T('Άνοιγμα','Open'),'acc',openPanel)); return r;
});
window.PsaroSmart={state:function(){ return S; },rt:rt,heat:heat,lastYear:lastYear,openPanel:openPanel,badIn:badIn,weekly:weekly};
autoStart();
})();
