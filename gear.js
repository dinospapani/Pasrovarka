/* Εργαλεία: παραγάδια, δίχτυα, ζεμπίλια/παγίδες. Πολλά ταυτόχρονα στη θάλασσα.
   Ρίψη (διαδρομή από-έως) → «Στη θάλασσα» → Ανέβασμα (διαδρομή). Τα ψάρια που καταγράφονται στο ανέβασμα
   μαρκάρονται στη θέση τους και συνδέονται με το εργαλείο (bite.gear). Οι εγγραφές εργαλείων μένουν στη συσκευή και
   όταν ολοκληρωθούν μπαίνουν σύνοψη μέσα στην έξοδο (trip.gear), που συγχρονίζεται. Η νομιμότητα του εργαλείου είναι δική σου ευθύνη. */
(function(){
'use strict';
var C=window.PsaroCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var $=function(i){ return document.getElementById(i); };
var KEY='psaro-gear';
var TYPES={ll:{el:'Παραγάδι',en:'Longline',pt:false,c:'#3aa0ff'},net:{el:'Δίχτυ',en:'Net',pt:false,c:'#35c9a7'},trap:{el:'Ζεμπίλι / παγίδα',en:'Trap / pot',pt:true,c:'#b98cff'}};
function tn(t){ var x=TYPES[t]||TYPES.net; return EN?x.en:x.el; }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function btn(t,cls,fn){ var b=el('button','spb '+(cls||''),t); b.type='button'; b.addEventListener('click',fn); return b; }
function load(){ var g=C.lsGet(KEY,null); if(!g||!Array.isArray(g.items)) g={items:[],seq:{}}; if(!g.seq) g.seq={}; return g; }
var G=load();
function save(){ try{ C.lsSet(KEY,G); }catch(e){} }
function R(x){ return Math.round(x*1e5)/1e5; }
function dist(a,b){ var r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)*Math.sin(dn/2); return 12742000*Math.asin(Math.min(1,Math.sqrt(x))); }
function len(pts){ var m=0; for(var i=1;i<pts.length;i++) m+=dist(pts[i-1],pts[i]); return m; }
function hm(ms){ var m=Math.max(0,Math.round(ms/60000)),h=Math.floor(m/60); return h?h+T('ω ','h ')+('0'+(m%60)).slice(-2)+T('λ','m'):m+T('λ','m'); }
function clock(ms){ var d=new Date(ms); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
function nm(it){ return it.name||tn(it.type); }
function active(){ return G.items.find(function(i){ return i.state==='setting'||i.state==='hauling'; })||null; }
function fishOf(it){ var n=0,kg=0; (C.Store.get('bites')||[]).forEach(function(b){ if(b.gear===it.id){ n++; kg+=+b.kg||0; } }); return {n:n,kg:Math.round(kg*10)/10}; }

/* ---------- θέση ---------- */
function here(){
  return new Promise(function(res){
    var fx=window.PsaroTrack&&window.PsaroTrack.fix&&window.PsaroTrack.fix();
    if(fx&&Date.now()-fx.t<60000){ res([R(fx.lat),R(fx.lon)]); return; }
    if(!navigator.geolocation){ res(null); return; }
    navigator.geolocation.getCurrentPosition(function(p){ res([R(p.coords.latitude),R(p.coords.longitude)]); },function(){ res(null); },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
  });
}
var wid=null;
function watch(){
  var it=active(); if(!it){ if(wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } return; }
  if(wid!=null||!navigator.geolocation) return;
  try{ wid=navigator.geolocation.watchPosition(function(p){
    var a=active(); if(!a) return; var c=p.coords; if(c.accuracy&&c.accuracy>60) return;
    var ph=a.state==='setting'?a.set:a.haul, pt=[R(c.latitude),R(c.longitude)], last=ph.pts[ph.pts.length-1];
    if(last){ var d=dist(last,pt); if(d<10||(d>3000&&Date.now()-(ph.lastT||0)<20000)) return; }
    ph.pts.push(pt); ph.lastT=Date.now(); if(ph.pts.length>1500) ph.pts=ph.pts.filter(function(_,i){ return i%2===0; });
    save(); draw(); if(!P.hidden) render();
  },function(){},{enableHighAccuracy:true,maximumAge:5000,timeout:30000}); }catch(e){ wid=null; }
}
function stopWatchIfIdle(){ if(!active()&&wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } }

/* ---------- ενέργειες ---------- */
function startSet(type){
  if(active()){ C.toast(T('Τελείωσε πρώτα την τρέχουσα ρίψη ή ανέβασμα.','Finish the current set or haul first.')); return; }
  here().then(function(p){
    if(!p){ C.toast(T('Δεν βρέθηκε θέση GPS. Δοκίμασε ξανά.','No GPS fix. Try again.')); return; }
    G.seq[type]=(G.seq[type]||0)+1;
    var it={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),type:type,name:tn(type)+' '+G.seq[type],state:TYPES[type].pt?'out':'setting',set:{a:p,ta:Date.now(),pts:[p],b:TYPES[type].pt?p:null,tb:TYPES[type].pt?Date.now():null},haul:null};
    G.items.push(it); save(); watch(); draw(); render();
    C.toast(T('Ρίψη: '+nm(it),'Set: '+nm(it)));
  });
}
function endSet(it){
  here().then(function(p){
    var pts=it.set.pts; if(p){ var l=pts[pts.length-1]; if(!l||dist(l,p)>3) pts.push(p); it.set.b=p; } else it.set.b=pts[pts.length-1]||it.set.a;
    it.set.tb=Date.now(); it.state='out'; save(); stopWatchIfIdle(); watch(); draw(); render();
    C.toast(T('Τέλος ρίψης: '+nm(it),'Set finished: '+nm(it)));
  });
}
function startHaul(it){
  if(active()){ C.toast(T('Τελείωσε πρώτα την τρέχουσα ρίψη ή ανέβασμα.','Finish the current set or haul first.')); return; }
  here().then(function(p){
    if(!p){ C.toast(T('Δεν βρέθηκε θέση GPS. Δοκίμασε ξανά.','No GPS fix. Try again.')); return; }
    it.haul={a:p,ta:Date.now(),pts:[p],b:null,tb:null}; it.state='hauling'; save(); watch(); draw(); render();
    C.toast(T('Ανέβασμα: '+nm(it)+'. Τα ψάρια που καταγράφεις θα μαρκάρονται εδώ.','Hauling: '+nm(it)+'. Fish you log are marked here.'));
  });
}
function endHaul(it){
  here().then(function(p){
    var pts=it.haul.pts; if(p){ var l=pts[pts.length-1]; if(!l||dist(l,p)>3) pts.push(p); it.haul.b=p; } else it.haul.b=pts[pts.length-1]||it.haul.a;
    it.haul.tb=Date.now(); it.state='done'; it.done=Date.now(); save(); stopWatchIfIdle(); draw(); render();
    var f=fishOf(it); C.toast(nm(it)+': '+f.n+T(' ψάρια',' fish')+(f.kg?' · '+f.kg+' kg':''));
    attachDone();
  });
}
function remove(it){
  window.PsaroAsk(nm(it),{title:T('Διαγραφή εργαλείου','Delete gear'),ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel'),danger:true}).then(function(ok){
    if(!ok) return; G.items=G.items.filter(function(x){ return x!==it&&x.id!==it.id; }); save(); stopWatchIfIdle(); draw(); render();
  });
}
function rename(it){
  window.PsaroAsk.prompt(T('Όνομα εργαλείου','Gear name'),{title:T('Μετονομασία','Rename'),value:nm(it),ok:T('Αποθήκευση','Save'),cancel:T('Άκυρο','Cancel')}).then(function(v){
    if(v&&String(v).trim()){ it.name=String(v).trim().slice(0,40); save(); draw(); render(); }
  });
}

/* ---------- σήμανση ψαριών (καλείται από το app.js στο tripStamp) ---------- */
function tag(rec){
  var it=G.items.find(function(i){ return i.state==='hauling'; }); if(!it||rec.miss) return rec;
  rec.gear=it.id; rec.gearName=nm(it); if(!rec.tech) rec.tech=tn(it.type);
  return rec;
}

/* ---------- χάρτης ---------- */
var layer=null;
function line(ll,color,dash){ return L.polyline(ll,{color:color,weight:4,opacity:.9,dashArray:dash||null}); }
function dot(p,fill,lbl){ var m=L.circleMarker(p,{radius:7,color:'#fff',weight:2,fillColor:fill,fillOpacity:1}); if(lbl) m.bindTooltip(lbl,{direction:'top'}); return m; }
function layersFor(it){
  var out=[], c=(TYPES[it.type]||TYPES.net).c, s=it.set||{}, h=it.haul;
  if(s.pts&&s.pts.length>1) out.push(line(s.pts,c));
  if(s.a) out.push(dot(s.a,'#2e9e5b',nm(it)+' · '+T('ρίψη ','set ')+(s.ta?clock(s.ta):'')));
  if(s.b&&(!s.a||s.b[0]!==s.a[0]||s.b[1]!==s.a[1])) out.push(dot(s.b,'#d33',nm(it)+' · '+T('τέλος ρίψης','end of set')));
  if(h){ if(h.pts&&h.pts.length>1) out.push(line(h.pts,'#ffd23a','8 8')); if(h.a) out.push(dot(h.a,'#ffd23a',nm(it)+' · '+T('ανέβασμα ','haul ')+clock(h.ta))); }
  return out;
}
function draw(){
  var map=C.map&&C.map(); if(!map||typeof L==='undefined') return;
  if(!layer) layer=L.layerGroup().addTo(map); else { layer.clearLayers(); if(!map.hasLayer(layer)) layer.addTo(map); }
  G.items.forEach(function(it){ if(it.state!=='done') layersFor(it).forEach(function(l){ l.addTo(layer); }); });
  updateBtn();
}
var shown=null;
function showItems(list,fit){
  C.switchTab('map');
  setTimeout(function(){
    var map=C.map&&C.map(); if(!map) return; if(shown){ try{ map.removeLayer(shown); }catch(e){} }
    var ls=[]; list.forEach(function(it){ ls=ls.concat(layersFor(it)); }); if(!ls.length) return;
    shown=L.layerGroup(ls).addTo(map); var pts=[]; list.forEach(function(it){ [it.set&&it.set.pts,it.haul&&it.haul.pts].forEach(function(a){ if(a) pts=pts.concat(a); }); });
    if(fit!==false&&pts.length) map.fitBounds(L.latLngBounds(pts),{padding:[50,50],maxZoom:16});
  },250);
}
function hideShown(){ var map=C.map&&C.map(); if(shown&&map){ try{ map.removeLayer(shown); }catch(e){} } shown=null; }

/* ---------- κουμπί στον χάρτη ---------- */
var gb=null;
function updateBtn(){
  if(!gb) return; var n=G.items.filter(function(i){ return i.state!=='done'; }).length, a=active();
  gb.classList.toggle('on',!!a); var b=gb.querySelector('.gbadge'); b.textContent=String(n); b.hidden=!n;
}
(function(){
  var host=$('bQuick'); if(!host) return;
  gb=el('button','mbtn'); gb.id='bGear'; gb.type='button'; gb.title=T('Εργαλεία: παραγάδι, δίχτυ, ζεμπίλι','Gear: longline, net, pot'); gb.setAttribute('aria-label',gb.title);
  gb.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/></svg><span class="gbadge" hidden>0</span>';
  host.parentNode.insertBefore(gb,host); gb.addEventListener('click',function(){ openPanel(); });
})();

/* ---------- πίνακας ---------- */
var P=el('div'); P.id='gearPanel'; P.hidden=true; P.innerHTML='<div class="spcard"><div class="sphead"><b></b><button type="button" class="spx" aria-label="✕">✕</button></div><div class="spbody"></div></div>';
P.querySelector('b').textContent=T('Εργαλεία','Gear'); document.body.appendChild(P);
var body=P.querySelector('.spbody');
P.querySelector('.spx').addEventListener('click',function(){ P.hidden=true; }); P.addEventListener('click',function(e){ if(e.target===P) P.hidden=true; });
function openPanel(){ render(); P.hidden=false; }
function sec(t){ body.append(el('div','spsec',t)); }
function render(){
  body.replaceChildren(); var a=active();
  body.append(el('div','sptx gwarn',T('Δίχτυα και παραγάδια είναι συνήθως εργαλεία επαγγελματικής αλιείας. Η καταγραφή δεν νομιμοποιεί το εργαλείο: έλεγξε την άδειά σου.','Nets and longlines are usually professional-fishing gear. Logging does not make the gear legal: check your licence.')));
  if(a){
    var box=el('div','gact'), f=fishOf(a), ph=a.state==='setting'?a.set:a.haul;
    box.append(el('b','',(a.state==='setting'?T('Ρίχνεις: ','Setting: '):T('Ανεβάζεις: ','Hauling: '))+nm(a)));
    box.append(el('div','sptx',T('Διαδρομή ','Route ')+(Math.round(len(ph.pts)/10)/100)+' km · '+hm(Date.now()-(ph.ta||Date.now()))+(a.state==='hauling'?' · '+f.n+T(' ψάρια',' fish')+(f.kg?' · '+f.kg+' kg':''):'')));
    if(a.state==='hauling') box.append(el('div','sptx',T('Καταγράφεις τα ψάρια με το πράσινο κουμπί στον χάρτη και μαρκάρονται εδώ.','Log fish with the green button on the map; they are marked here.')));
    box.append(btn(a.state==='setting'?T('Τέλος ρίψης','End set'):T('Τέλος ανεβάσματος','End haul'),'acc',function(){ a.state==='setting'?endSet(a):endHaul(a); }));
    body.append(box);
  } else {
    sec(T('Νέα ρίψη','New set'));
    var row=el('div','sprow wrap'); Object.keys(TYPES).forEach(function(k){ row.append(btn(tn(k),'acc',function(){ startSet(k); })); }); body.append(row);
    body.append(el('div','sptx',T('Η ρίψη καταγράφει από πού ξεκινάς και τη διαδρομή μέχρι το «Τέλος ρίψης». Για ζεμπίλι αρκεί ένα πάτημα στο σημείο.','A set records where you start and the route until “End set”. For a pot one tap marks the spot.')));
  }
  var out=G.items.filter(function(i){ return i.state==='out'||(i.state==='setting'&&i!==a)||(i.state==='hauling'&&i!==a); });
  sec(T('Στη θάλασσα ','At sea ')+'('+out.length+')');
  if(!out.length) body.append(el('div','sptx',T('Κανένα εργαλείο.','No gear.')));
  out.forEach(function(it){
    var r=el('div','sprow wrap'), x=el('div','sptx'); x.append(el('b','',nm(it)),el('span','',T('Ρίχτηκε ','Set ')+clock(it.set.ta)+' · '+hm(Date.now()-it.set.ta)));
    r.append(x);
    if(it.state==='out') r.append(btn(T('Ανέβασμα','Haul'),'acc',function(){ startHaul(it); }));
    r.append(btn(T('Χάρτης','Map'),'',function(){ P.hidden=true; showItems([it]); }),btn('✎','',function(){ rename(it); }),btn('✕','danger',function(){ remove(it); }));
    body.append(r);
  });
  var done=G.items.filter(function(i){ return i.state==='done'; }).sort(function(p,q){ return (q.done||0)-(p.done||0); }).slice(0,12);
  if(done.length){ sec(T('Ολοκληρωμένα','Completed'));
    done.forEach(function(it){ var f=fishOf(it), r=el('div','sprow wrap'), x=el('div','sptx'); x.append(el('b','',nm(it)),el('span','',f.n+T(' ψάρια',' fish')+(f.kg?' · '+f.kg+' kg':'')+' · '+T('μέσα ','soaked ')+hm((it.haul&&it.haul.ta||0)-it.set.ta)));
      r.append(x,btn(T('Χάρτης','Map'),'',function(){ P.hidden=true; showItems([it]); }),btn('✕','danger',function(){ remove(it); })); body.append(r); });
  }
}

/* ---------- σύνοψη μέσα στην έξοδο ---------- */
function compact(it){ var f=fishOf(it); function thin(p){ if(!p||p.length<=120) return p||[]; var k=Math.ceil(p.length/120); return p.filter(function(_,i){ return i%k===0||i===p.length-1; }); }
  return {id:it.id,type:it.type,name:nm(it),set:{a:it.set.a,b:it.set.b,ta:it.set.ta,tb:it.set.tb,pts:thin(it.set.pts)},haul:it.haul?{a:it.haul.a,b:it.haul.b,ta:it.haul.ta,tb:it.haul.tb,pts:thin(it.haul.pts)}:null,n:f.n,kg:f.kg}; }
function attachDone(tripId){
  /* προσθέτει στην πιο πρόσφατη έξοδο τα ολοκληρωμένα εργαλεία που δεν έχουν συνδεθεί */
  var pend=G.items.filter(function(i){ return i.state==='done'&&!i.att; }); if(!pend.length) return;
  var trips=C.Store.raw('trips')||[], t=tripId?trips.find(function(x){ return x.id===tripId; }):null;
  if(!t) return;
  var cur=Array.isArray(t.gear)?t.gear.slice():[];
  pend.forEach(function(it){ cur=cur.filter(function(g){ return g.id!==it.id; }).concat([compact(it)]); it.att=t.id; });
  save(); C.Store.save('trips',Object.assign({},t,{gear:cur}));
}
window.addEventListener('psaro-tripend',function(e){ var id=e&&e.detail&&e.detail.id; setTimeout(function(){ attachDone(id); },400); });

window.PsaroGear={tag:tag,open:openPanel,state:function(){ return G; },show:function(list){ showItems((list||[]).map(function(g){ return {type:g.type,name:g.name,set:g.set,haul:g.haul}; })); },hide:hideShown,types:TYPES};
setTimeout(function(){ watch(); draw(); },1500); setInterval(function(){ draw(); },20000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ if(wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } watch(); draw(); } });
})();
