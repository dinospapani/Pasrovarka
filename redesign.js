/* Νέα εμφάνιση: τα κουμπιά του χάρτη μαζεύονται σε 4 κουμπιά (Στρώματα, Ενέργειες, Ασφάλεια, Θέση μου) με φύλλα.
   Δεν αλλάζει λογική: μετακινεί τα ίδια τα υπάρχοντα κουμπιά, με τους ίδιους χειριστές.
   Διακόπτης: Προφίλ → Ρυθμίσεις → Εμφάνιση (κλειδί psaro-ui: new ή old). */
(function(){
'use strict';
var C=window.PsaroCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, KEY='psaro-ui';
var mode='new'; try{ if(C.lsGet(KEY,'new')==='old') C.lsSet(KEY,'new'); }catch(e){} /* μόνο η νέα εμφάνιση· ο διακόπτης αφαιρέθηκε */
function $(i){ return document.getElementById(i); }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
var SVG='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">';
var IC={
  layers:SVG+'<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>',
  actions:SVG+'<path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z"/></svg>',
  safety:SVG+'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/></svg>',
  me:SVG+'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  fish:SVG+'<path d="M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3Z"/><circle cx="8.5" cy="11" r="1"/></svg>',
  miss:SVG+'<path d="M6 6l12 12M18 6 6 18"/></svg>'
};

/* ---- διακόπτης εμφάνισης στις Ρυθμίσεις (υπάρχει και στις δύο καταστάσεις) ---- */
function addSwitch(){
  var ps=$('pSettings'); if(!ps||$('ndSw')) return;
  var card=el('div','card setcard'); card.id='ndSw';
  card.append(el('h3',null,T('Εμφάνιση','Appearance')));
  card.append(el('p','note',T('Η νέα εμφάνιση μαζεύει τα κουμπιά του χάρτη σε 4 με φύλλα. Όλες οι λειτουργίες μένουν ίδιες. Η αλλαγή ξαναφορτώνει την εφαρμογή.','The new look groups the map buttons into 4 with sheets. All functions stay the same. Changing reloads the app.')));
  var row=el('div','row'); row.style.marginTop='8px';
  [['new',T('Νέα εμφάνιση','New look')],['old',T('Παλιά εμφάνιση','Old look')]].forEach(function(x){
    var b=el('button','btn'+(mode===x[0]?' acc':' ghost'),x[1]); b.type='button'; b.setAttribute('aria-pressed',String(mode===x[0]));
    b.addEventListener('click',function(){ if(mode===x[0]) return; C.lsSet(KEY,x[0]); location.reload(); });
    row.append(b);
  });
  card.append(row); ps.append(card);
}
if(mode==='old') return;

/* ---- νέα εμφάνιση ---- */
var mb=document.querySelector('.mapbtns'), box=mb&&mb.parentNode; if(!mb||!box) return;
document.body.classList.add('nd');
var G={layers:['bLayer','bSea','bPorts','bDepthMap','bZones','bNav','bDams','bHot'],actions:['bQuick','bGear','bSpotPick'],safety:['bTools']};
var TITLE={layers:T('Στρώματα','Layers'),actions:T('Ενέργειες','Actions'),safety:T('Ασφάλεια και θάλασσα','Safety and sea')};
var SUB={layers:T('Τι φαίνεται πάνω στο χάρτη','What shows on the map'),actions:T('Καταγραφή, εργαλεία και σημεία','Record, gear and spots'),safety:T('Λειτουργούν με GPS και ανοιχτή εφαρμογή. Δεν είναι ναυτικό όργανο.','Work with GPS and the app open. Not a navigation instrument.')};
function groupOf(id){ for(var k in G) if(G[k].indexOf(id)>=0) return k; return 'actions'; }

var sheet=el('div','ndsheet'); sheet.id='ndSheet'; sheet.hidden=true;
var back=el('div','ndback'), panel=el('div','ndpanel'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
var hand=el('span','ndhand'), head=el('div','ndhead'), ttl=el('h2',null,''), done=el('button','btn ghost sm','✕'); done.type='button'; done.setAttribute('aria-label',T('Τέλος','Done'));
var sub=el('p','note ndsub','');
head.append(ttl,done); panel.append(hand,head,sub);
var lists={};
Object.keys(G).forEach(function(g){ var l=el('div','ndlist'); l.dataset.g=g; l.hidden=true; lists[g]=l; panel.append(l); });
sheet.append(back,panel); document.body.append(sheet);

var secA=el('div','ndsec',T('Στρώματα χάρτη','Map layers')), secB=el('div','ndsec',T('Τι εμφανίζεται στον χάρτη','Shown on the map')); var tgRow=el('div','ndtogs'); lists.layers.append(tgRow);
var TG=[['psaro-showbites',T('Ψάρια','Fish'),function(){ if(C.bitesVis) C.bitesVis(); }],['psaro-showmiss',T('Χαμένα','Lost'),function(){ document.dispatchEvent(new Event('psaro-spfilter')); }],['psaro-showspots',T('Σημεία μου','My spots'),function(){ if(C.spotsVis) C.spotsVis(); }]];
TG.forEach(function(t){ var b=el('button','ndtog'); b.innerHTML='<i></i><span></span>'; b.lastChild.textContent=t[1]; b.type='button'; function sync(){ b.setAttribute('aria-pressed',String(C.lsGet(t[0],true)!==false)); } sync();
  b.addEventListener('click',function(){ C.lsSet(t[0],C.lsGet(t[0],true)===false); sync(); t[2](); }); b.dataset.k=t[0]; tgRow.append(b); });
function syncTg(){ Array.prototype.forEach.call(tgRow.children,function(b){ b.setAttribute('aria-pressed',String(C.lsGet(b.dataset.k,true)!==false)); }); }
function open(g){
  if(g==='layers'){ lists.layers.insertBefore(secA,lists.layers.firstChild); lists.layers.append(secB); lists.layers.append(tgRow); syncTg(); }
  Object.keys(lists).forEach(function(k){ lists[k].hidden=(k!==g); });
  ttl.textContent=TITLE[g]; sub.textContent=SUB[g]; panel.setAttribute('aria-label',TITLE[g]);
  sheet.dataset.g=g; ed.hidden=(g==='safety'); sheet.hidden=false; document.body.classList.add('ndopen'); try{ done.focus({preventScroll:true}); }catch(e){}
}
function close(){ sheet.hidden=true; document.body.classList.remove('ndopen'); if(typeof setEdit==='function') setEdit(false); }
var ed=el('button','btn ghost sm ndedit','⚙'); ed.type='button'; ed.setAttribute('aria-pressed','false'); ed.setAttribute('aria-label',T('Προσαρμογή: διάλεξε ποια εργαλεία φαίνονται','Customize: choose which tools show'));
var editing=false, TKEY='psaro-toolsoff';
function setEdit(v){ editing=v; sheet.classList.toggle('ndediting',v); ed.setAttribute('aria-pressed',String(v)); ed.textContent=v?'✓':'⚙'; sub.textContent=v?T('Πάτα ένα εργαλείο για να το κρύψεις ή να το εμφανίσεις.',''):SUB[sheet.dataset.g]||''; sub.style.display=v?'block':''; }
ed.addEventListener('click',function(){ setEdit(!editing); });
head.insertBefore(ed,done);
panel.addEventListener('click',function(e){
  if(!editing) return; var b=e.target.closest&&e.target.closest('.mbtn'); if(!b||b.id==='bQuick') return;
  e.stopPropagation(); e.preventDefault();
  var off=C.lsGet(TKEY,[]); if(!Array.isArray(off)) off=[]; var i=off.indexOf(b.id); if(i>=0) off.splice(i,1); else off.push(b.id);
  C.lsSet(TKEY,off); b.classList.toggle('tool-off',off.indexOf(b.id)>=0);
},true);
back.addEventListener('click',close); done.addEventListener('click',close);
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!sheet.hidden) close(); });
Object.keys(lists).forEach(function(g){
  lists[g].addEventListener('click',function(e){ if(g!=='layers'&&e.target.closest&&e.target.closest('.mbtn,.ndrow')) setTimeout(close,0); });
});

/* ενέργειες που δεν ήταν κουμπιά του χάρτη: ίδιες συναρτήσεις με πριν */
function proxy(g,label,icon,fn,first,tripHide){
  var b=el('button','ndrow'); if(tripHide) b.classList.add('ndnotrip'); b.type='button'; b.innerHTML=icon+'<span></span>'; b.lastChild.textContent=label; b.addEventListener('click',fn);
  if(first&&lists[g].firstChild) lists[g].insertBefore(b,lists[g].firstChild); else lists[g].append(b);
}

var SHOP='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9"/><path d="M5.5 12v8h13v-8"/></svg>';
proxy('actions',T('Κοντινά μαγαζιά ψαρικής','Nearby fishing stores'),SHOP,function(){ var b=$('sShops'); if(b) b.click(); },false);

proxy('actions',T('Πρόσθεσε ράμπα ή λιμάνι','Add a ramp or port'),SVG+'<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11Z"/><path d="M12 7.500v5M9.500 10h5"/></svg>',function(){ if(window.PsaroPorts) PsaroPorts.startAdd(); },false);

var KEEP={bLoc:1,bToolsCfg:1};
function adopt(b){
  if(!b||!b.classList||!b.classList.contains('mbtn')||KEEP[b.id]) return;
  var lab=b.getAttribute('aria-label')||b.title||b.id; try{ if(window.PsaroTr) lab=window.PsaroTr(lab); }catch(e){} b.dataset.nd=lab;
  lists[groupOf(b.id)].append(b);
}
Array.prototype.slice.call(mb.querySelectorAll('.mbtn')).forEach(adopt);
new MutationObserver(function(ms){ ms.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes,adopt); }); }).observe(mb,{childList:true});

/* η δεξιά μπάρα: 4 κουμπιά */
var bar=el('div','ndbar'); bar.setAttribute('role','group'); bar.setAttribute('aria-label',T('Εργαλεία χάρτη','Map tools'));
var tools=el('div','ndtools'); tools.setAttribute('role','group'); tools.setAttribute('aria-label',T('Εργαλεία χάρτη','Map tools'));
function nb(label,icon,fn,host){ var b=el('button','ndb'); b.type='button'; b.innerHTML=icon+'<span></span>'; b.lastChild.textContent=label; b.addEventListener('click',fn); (host||bar).append(b); return b; }
nb(T('Στρώματα','Layers'),IC.layers,function(){ open('layers'); },tools);
nb(T('Ενέργειες','Actions'),IC.actions,function(){ open('actions'); },tools);
nb(T('Ασφάλεια','Safety'),IC.safety,function(){ open('safety'); },tools);
nb(T('Θέση','Position'),IC.me,function(){ var l=$('bLoc'); if(l) l.click(); },tools);
/* NU/CU/HU: ο προσανατολισμός του χάρτη ως εργαλείο της μπάρας (μόνο κατά την έξοδο), χρησιμοποιεί το ίδιο κουμπί #bOrient */
var orb=nb('NU',SVG+'<circle cx="12" cy="12" r="8.500"/><path d="m15.500 8.500-2 5-5 2 2-5z"/></svg>',function(){ var x=$('bOrient'); if(x) x.click(); });
orb.classList.add('ndorient'); orb.setAttribute('aria-label',T('Προσανατολισμός χάρτη','Map orientation'));
function orUpd(){ var x=$('bOrient'); if(!x) return; var m=x.textContent||'NU'; if(orb.lastChild.textContent!==m) orb.lastChild.textContent=m; orb.classList.toggle('on',x.classList.contains('on')); orb.title=x.title||''; }
setInterval(orUpd,400); orUpd();
/* MOB και SOS μέσα στη μπάρα (μόνο κατά την έξοδο): χρησιμοποιούν τα ίδια κουμπιά και τις ίδιες λειτουργίες με πριν */
var sosb=nb('SOS',SVG+'<path d="M12 3.500 21.500 20h-19z"/><path d="M12 10v4.500M12 17.300v.01"/></svg>',function(){ var x=$('sosBtn'); if(x) x.click(); });
sosb.classList.add('ndsos'); sosb.setAttribute('aria-label',T('SOS: ειδοποίηση κινδύνου','SOS: distress alert'));
var mobb=nb('MOB',SVG+'<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3.500"/><path d="M6 6l3.500 3.500M14.500 14.500 18 18M18 6l-3.500 3.500M9.500 14.500 6 18"/></svg>',function(){});
mobb.classList.add('ndmob'); mobb.setAttribute('aria-label',T('Άνθρωπος στη θάλασσα (MOB)','Man overboard (MOB)')); bar.insertBefore(mobb,sosb); /* κάτω από «Θέση μου»: πρώτα MOB, μετά SOS */
/* MOB με παρατεταμένο πάτημα (1,5 δευτ.), ώστε να μη ενεργοποιείται κατά λάθος από κύμα ή βρεγμένα χέρια */
(function(){
  var HOLD=1500, tm=null, fired=false;
  mobb.setAttribute('aria-label',T('Άνθρωπος στη θάλασσα (MOB), κράτα πατημένο','Man overboard (MOB), press and hold'));
  function stop(){ clearTimeout(tm); tm=null; mobb.classList.remove('holding'); }
  function fire(){ fired=true; stop(); try{ navigator.vibrate&&navigator.vibrate([60,40,60]); }catch(e){} var x=$('bMob'); if(x) x.click(); }
  mobb.addEventListener('pointerdown',function(e){ fired=false; stop(); mobb.classList.add('holding'); tm=setTimeout(fire,HOLD); });
  ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ mobb.addEventListener(ev,function(){ if(tm){ stop(); if(ev==='pointerup'&&!fired) C.toast(T('Κράτα πατημένο το MOB 1,5 δευτ.','Hold MOB for 1.5 s')); } }); });
  mobb.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  /* το πληκτρολόγιο (Enter/Space) ενεργοποιεί αμέσως */
  mobb.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fire(); } });
})();
/* NU/CU/HU: μικρό κουμπί κάτω από το + / − του χάρτη (αριστερά), ώστε να μην πιάνει τη δεξιά πλευρά */
orb.classList.add('ndorin');
/* MOB και SOS: μικρά και διακριτικά, πάνω από τα «Χάρτης» (αριστερά) και «Προφίλ» (δεξιά), μόνο κατά την έξοδο */
mobb.classList.add('ndfloat','ndfl'); sosb.classList.add('ndfloat','ndfr'); box.append(mobb,sosb);
box.insertBefore(bar,mb.nextSibling);
/* τα υπόλοιπα εργαλεία σε πάνελ που κρύβεται δεξιά: λαβάκι, πάτημα ή σύρσιμο από τη δεξιά άκρη */
var hd=el('button','ndhandle'); hd.type='button'; hd.innerHTML=SVG+'<path d="m9 6 6 6-6 6"/></svg>'; tools.append(hd);
/* όργανα μέσα στο πάνελ: «Προορισμός» (όταν υπάρχει) και «Τώρα» (ταχύτητα, πορεία) */
(function(){
  var ins=el('div','ndins'), dg=el('div','ndgrp'), ng=el('div','ndgrp');
  function sec(t){ return el('div','ndsec',t); }
  function cell(l){ var c=el('div','ndc'); var b=document.createElement('b'); b.textContent='–'; var i=document.createElement('i'); i.textContent=l; c.append(b,i); c.v=b; return c; }
  var dd=cell(T('Απόσταση','Distance')), db=cell(T('Πορεία προς','Bearing to')), de=cell('ETA'), ns=cell(T('Ταχύτητα','Speed')), nc=cell(T('Πορεία','Course'));
  dd.classList.add('ndo'); db.classList.add('ndo'); de.classList.add('ndo');
  dg.append(sec(T('Προορισμός','Destination')),dd,db,de); ng.append(sec(T('Τώρα','Now')),ns,nc); ins.append(dg,ng);
  var DIRS=['N','NE','E','SE','S','SW','W','NW'];
  function upd(){
    var N=window.PsaroNav, fresh=N&&Date.now()-N.t<20000, D=window.PsaroDirectInfo;
    ns.v.textContent=(fresh&&N.kn!=null)?N.kn.toFixed(1)+' kn':'–';
    nc.v.textContent=(fresh&&N.head!=null&&N.kn!=null&&N.kn>=0.8)?('00'+Math.round(N.head)).slice(-3)+'° '+DIRS[Math.round(N.head/45)%8]:'–';
    dg.hidden=!D;
    if(D){ dd.v.textContent=D.wait?'…':D.d; db.v.textContent=D.wait?'…':D.b; de.v.textContent=D.eta||'–'; }
  }
  setInterval(upd,1000); upd();
  tools.insertBefore(ins,tools.firstChild); tools.insertBefore(orb,tools.querySelector('.ndb'));
})();
box.insertBefore(tools,bar.nextSibling);
(function(){
  var KEY='psaro_ndtools', shut=false, tm=null, was=null;
  function trip(){ return document.body.classList.contains('ontrip'); }
  function arm(){ clearTimeout(tm); if(!shut&&trip()) tm=setTimeout(function(){ set(true); },7000); }
  function set(sh,save){ shut=sh; document.body.classList.toggle('ndtoolsopen',!sh); tools.classList.toggle('shut',sh); hd.setAttribute('aria-expanded',String(!sh)); hd.setAttribute('aria-label',sh?T('Άνοιγμα εργαλείων','Open tools'):T('Κλείσιμο εργαλείων','Close tools')); arm(); if(save&&!trip()) C.lsSet(KEY,sh?1:0); }
  hd.addEventListener('click',function(e){ e.stopPropagation(); set(!shut,true); });
  tools.addEventListener('click',arm,true);
  function sync(){ var t=trip(); if(t===was) return; was=t; if(t) set(true); else set(!!C.lsGet(KEY,0)); }
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']}); sync();
  var sx=null, sy=null, inTools=false;
  document.addEventListener('touchstart',function(e){ var t=e.touches[0]; sx=t.clientX; sy=t.clientY; inTools=tools.contains(e.target); },{passive:true});
  document.addEventListener('touchend',function(e){ if(sx==null) return; var t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)>50&&Math.abs(dx)>2*Math.abs(dy)){ if(dx<0&&shut&&sx>window.innerWidth-44) set(false,true); else if(dx>0&&!shut&&inTools) set(true,true); } sx=null; },{passive:true});
  setTimeout(function(){ try{ var m=C.map&&C.map(); if(m) m.on('click',function(){ if(trip()&&!shut) set(true); }); }catch(e){} },1500);
})();

/* ---- αρχική οθόνη: αναζήτηση, κάρτα «Σήμερα», κάτω μενού με κεντρικό κουμπί ---- */
(function(){
  var NS='http://www.w3.org/2000/svg';
  function svgEl(n,a){ var e=document.createElementNS(NS,n); for(var k in a) e.setAttribute(k,a[k]); return e; }
  function pad(n){ return (n<10?'0':'')+n; }
  var tab=function(n){ if(C.switchTab) C.switchTab(n); };

  /* 1. γραμμή αναζήτησης: ανοίγει την πρόγνωση με το πεδίο τοποθεσίας έτοιμο */
  var sb=el('button','ndsearch'); sb.type='button';
  var lg=document.createElement('img'); lg.src='icon-192.png'; lg.alt=''; lg.width=40; lg.height=40;
  var st=el('span',null,T('Πού θα ψαρέψεις;','Where will you fish?'));
  var mg=svgEl('svg',{viewBox:'0 0 24 24','aria-hidden':'true'}); mg.setAttribute('fill','none'); mg.setAttribute('stroke','currentColor'); mg.setAttribute('stroke-width','2'); mg.setAttribute('stroke-linecap','round');
  mg.append(svgEl('circle',{cx:'11',cy:'11',r:'7'}),svgEl('path',{d:'m20 20-3.5-3.5'}));
  sb.append(lg,st,mg); sb.setAttribute('aria-label',T('Αναζήτηση τοποθεσίας','Search a place'));
  /* φύλλο αναζήτησης: βρίσκει τόπο και αλλάζει τον καιρό (κάρτα και Πρόγνωση). Η θέση μου είναι η προεπιλογή. */
  var fd=el('div','ndsheet ndfind'); fd.hidden=true;
  var fb=el('div','ndback'), fp=el('div','ndpanel'); fp.setAttribute('role','dialog'); fp.setAttribute('aria-modal','true'); fp.setAttribute('aria-label',T('Αναζήτηση τοποθεσίας','Search a place'));
  var fi=document.createElement('input'); fi.type='search'; fi.className='ndq'; fi.placeholder=T('Πού θα ψαρέψεις;','Where will you fish?'); fi.setAttribute('autocomplete','off'); fi.setAttribute('enterkeyhint','search');
  var fr=el('div','ndres'); fp.append(fi,fr); fd.append(fb,fp); document.body.append(fd);
  var label=null, tmr=null, seq=0;
  function setLabel(n){ label=n||null; st.textContent=label||T('Πού θα ψαρέψεις;','Where will you fish?'); sb.classList.toggle('ndset',!!label); }
  function row(txt,sub,fn,icon){ var b=el('button','ndrow'); b.type='button'; b.innerHTML=(icon||'')+'<span></span>'; b.lastChild.textContent=txt+(sub?' · '+sub:''); b.addEventListener('click',fn); fr.append(b); }
  var PIN=SVG+'<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  function showBase(){
    fr.replaceChildren();
    row(T('Η θέση μου','My location'),label?T('προεπιλογή','default'):'',function(){
      setLabel(null); closeF();
      if(window.PsaroPlaces&&PsaroPlaces.selectGps) PsaroPlaces.selectGps();
      if(window.PsaroPlaces&&PsaroPlaces.view) PsaroPlaces.view(); else if(C.viewPlace) C.viewPlace({gps:true});
    },IC.me);
    row(T('Επιλογή στον χάρτη','Choose on map'),'',function(){ closeF(); window.dispatchEvent(new CustomEvent('psaro-pickplace')); },PIN);
  }
  window.addEventListener('psaro-placepicked',function(e){
    var d=e.detail||{}, nm=T('Σημείο στον χάρτη','Map point');
    try{ if(window.PsaroCoord&&PsaroCoord.fmt) nm=PsaroCoord.fmt(d.lat,d.lon); else nm=d.lat.toFixed(4)+', '+d.lon.toFixed(4); }catch(x){}
    setLabel(nm);
    if(window.PsaroPlaces&&PsaroPlaces.pick) PsaroPlaces.pick(nm,d.lat,d.lon);
    else if(C.viewPlace) C.viewPlace({id:'s'+d.lat+','+d.lon,name:nm,lat:d.lat,lon:d.lon});
  });
  document.addEventListener('psaro-viewname',function(e){ setLabel(e.detail); });
  function openF(){ fd.hidden=false; fi.value=''; showBase(); setTimeout(function(){ try{ fi.focus(); }catch(e){} },80); }
  function closeF(){ fd.hidden=true; try{ fi.blur(); }catch(e){} }
  fb.addEventListener('click',closeF);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!fd.hidden) closeF(); });
  var GR={'α':'a','β':'v','γ':'g','δ':'d','ε':'e','ζ':'z','η':'i','θ':'th','ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p','ρ':'r','σ':'s','ς':'s','τ':'t','υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o'};
  function plain(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,''); }
  function latin(s){ return plain(s).toLowerCase().replace(/[α-ως]/g,function(c){ return GR[c]||c; }); }
  function omSearch(q){
    return fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=12&format=json&language='+(EN?'en':'el'))
      .then(function(r){ return r.json(); }).then(function(j){ return ((j&&j.results)||[]).map(function(x){ return {name:x.name,lat:x.latitude,lon:x.longitude,sub:[x.admin1,x.country].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ')}; }); }).catch(function(){ return []; });
  }
  function osmSearch(q){
    return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language='+(EN?'en':'el')+'&viewbox=32.2,35.75,34.7,34.5&q='+encodeURIComponent(q))
      .then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){ return (j||[]).map(function(x){ var p=(x.display_name||'').split(',').map(function(s){ return s.trim(); }); return {name:(x.name||p[0]||'').trim(),lat:+x.lat,lon:+x.lon,sub:p.slice(1,3).join(', ')}; }).filter(function(x){ return x.name&&isFinite(x.lat)&&isFinite(x.lon); }); }).catch(function(){ return []; });
  }
  function find(){
    var q=fi.value.trim(), my=++seq; showBase(); if(q.length<2) return;
    var note=el('div','note',T('Αναζήτηση…','Searching…')); fr.append(note);
    var variants=[q]; var p1=plain(q), l1=latin(q); if(p1!==q) variants.push(p1); if(l1!==p1&&l1!==q) variants.push(l1);
    /* πρώτα Open-Meteo (με παραλλαγές γραφής), μετά και OpenStreetMap */
    var chain=Promise.resolve([]);
    variants.forEach(function(v){ chain=chain.then(function(acc){ return acc.length?acc:omSearch(v); }); });
    Promise.all([chain,osmSearch(variants[variants.length-1]===l1&&l1!==q?q:q)]).then(function(rs){
      if(my!==seq) return; note.remove();
      var seen={}, all=rs[0].concat(rs[1]).filter(function(x){ var k=x.lat.toFixed(2)+','+x.lon.toFixed(2); if(seen[k]) return false; seen[k]=1; return true; });
      /* ταξινόμηση: πιο κοντινά πρώτα (από το κέντρο του χάρτη, αλλιώς από το κέντρο της Κύπρου) */
      var ref=[35.0,33.2]; try{ var mm=C.map&&C.map(); if(mm){ var cc=mm.getCenter(); ref=[cc.lat,cc.lng]; } }catch(e){}
      var dist=function(x){ var dl=(x.lat-ref[0])*Math.PI/180, dn=(x.lon-ref[1])*Math.PI/180, a1=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(ref[0]*Math.PI/180)*Math.cos(x.lat*Math.PI/180)*Math.sin(dn/2)*Math.sin(dn/2); return 2*Math.asin(Math.min(1,Math.sqrt(a1))); };
      all.sort(function(x,y){ return dist(x)-dist(y); }); all=all.slice(0,8);
      if(!all.length){ fr.append(el('div','note',T('Δεν βρέθηκε τοποθεσία. Δοκίμασε άλλη γραφή ή λατινικούς χαρακτήρες.','No place found. Try another spelling.'))); return; }
      all.forEach(function(x){
        row(x.name,x.sub,function(){
          setLabel(x.name); closeF();
          if(window.PsaroPlaces&&PsaroPlaces.pick) PsaroPlaces.pick(x.name,x.lat,x.lon);
          else if(C.viewPlace) C.viewPlace({id:'s'+x.lat+','+x.lon,name:x.name,lat:x.lat,lon:x.lon});
          try{ var m=C.map&&C.map(); if(m) m.setView([x.lat,x.lon],Math.max(m.getZoom(),11)); }catch(e){}
        },PIN);
      });
    }).catch(function(){ if(my!==seq) return; note.textContent=T('Η αναζήτηση δεν δούλεψε. Έλεγξε τη σύνδεση.','Search failed. Check your connection.'); });
  }
  fi.addEventListener('input',function(){ clearTimeout(tmr); tmr=setTimeout(find,400); });
  fi.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); clearTimeout(tmr); find(); } });
  sb.addEventListener('click',openF);
  if(window.PsaroPlaces&&PsaroPlaces.selectGps) PsaroPlaces.selectGps();
  box.append(sb);

  /* 2. κάρτα «Σήμερα» */
  var card=el('div','ndcard'); card.hidden=true;
  var top=el('div','ndtop');
  var ring=svgEl('svg',{viewBox:'0 0 56 56',class:'ndring','aria-hidden':'true'});
  ring.append(svgEl('circle',{cx:'28',cy:'28',r:'23',class:'ndr0'}),svgEl('circle',{cx:'28',cy:'28',r:'23',class:'ndr1',transform:'rotate(-90 28 28)'}));
  var rn=el('span','ndrn','–'); var rw=el('div','ndringw'); rw.append(ring,rn);
  var tx=el('div','ndtx'); var h1=el('b',null,'…'); var h2=el('span',null,''); tx.append(h1,h2);
  var go=el('button','ndgo'); go.type='button'; go.setAttribute('aria-label',T('Άνοιγμα λεπτομερειών σήμερα','Open today details')); go.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  go.addEventListener('click',function(){ tab('today'); });
  top.append(rw,tx,go);
  var bars=el('div','ndbars'), lab=el('div','ndlab');
  var foot=el('div','ndfoot'); var wxslot=el('div','ndwx'); foot.append(wxslot);
  var shop=el('button','ndshop'); shop.type='button'; shop.innerHTML=SHOP+'<span></span>'; shop.lastChild.textContent=T('Μαγαζιά','Stores');
  shop.addEventListener('click',function(){ var b=$('sShops'); if(b) b.click(); });
  card.append(top,bars,lab,foot); box.append(card);
  /* κουμπί απόκρυψης της κάρτας (βελάκι προς τα κάτω) και μικρό κουμπί για να ξαναβγεί */
  var CHEV_D='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  var CHEV_U='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>';
  var hideb=el('button','ndhide'); hideb.type='button'; hideb.setAttribute('aria-label',T('Απόκρυψη κάρτας','Hide card')); hideb.innerHTML=CHEV_D;
  var showb=el('button','ndshowc'); showb.type='button'; showb.setAttribute('aria-label',T('Εμφάνιση κάρτας','Show card'));
  var shn=el('b',null,'–'); showb.innerHTML=CHEV_U; showb.append(shn);
  card.prepend(hideb); box.append(showb);
  function setMin(v){ document.body.classList.toggle('ndmin',!!v); try{ localStorage.setItem('psaro_ndmin',v?'1':'0'); }catch(e){} }
  try{ if(localStorage.getItem('psaro_ndmin')==='1') document.body.classList.add('ndmin'); }catch(e){}
  hideb.addEventListener('click',function(){ setMin(true); });
  showb.addEventListener('click',function(){ setMin(false); });
  var FR=0, TO=23;
  for(var h=FR;h<=TO;h++){ var bb=el('i'); bb.dataset.h=h; bars.append(bb); var lb=el('span',null,(h===0||h===6||h===12||h===18)?pad(h):''); lab.append(lb); }
  function draw(){
    var cc=C.getCond&&C.getCond(), c=null; try{ c=cc&&C.compute&&C.compute(); }catch(e){ c=null; }
    if(!c||!c.hours||c.day==null){ card.hidden=true; document.body.classList.remove('ndhascard'); return; }
    card.hidden=false; document.body.classList.add('ndhascard');
    var day=c.day, sc=Math.max(0,Math.min(100,Math.round(day)));
    rn.textContent=String(sc); shn.textContent=String(sc); ring.querySelector('.ndr1').style.strokeDasharray=(2*Math.PI*23*Math.max(sc,2)/100).toFixed(1)+' 999';
    h1.textContent=day>=75?'Πολύ καλές προϋποθέσεις':day>=60?'Καλές προϋποθέσεις':day>=45?'Μέτριες προϋποθέσεις':'Δύσκολη μέρα για ψάρεμα';
    var mx=Math.max.apply(null,c.hours), thr=mx-6, gs=[], cur=null;
    c.hours.forEach(function(v,i){ if(v>=thr){ if(cur&&cur.e===i-1){ cur.e=i; if(v>cur.m) cur.m=v; } else { cur={s:i,e:i,m:v}; gs.push(cur); } } });
    gs.sort(function(a,b){ return b.m-a.m; });
    h2.textContent=gs.length?T('Καλύτερα ','Best ')+pad(gs[0].s)+':00–'+pad((gs[0].e+1)%24)+':00':'';
    var lvl=function(v){ return v>=75?'g':v>=60?'l':v>=45?'w':'b'; };
    card.dataset.lv=lvl(day); showb.dataset.lv=lvl(day);
    Array.prototype.forEach.call(bars.children,function(b){ var v=c.hours[+b.dataset.h]||0; b.style.height=Math.max(8,Math.round(v/Math.max(mx,1)*100))+'%'; b.dataset.lv=lvl(v); b.className=v>=thr?'hi':''; b.title=pad(+b.dataset.h)+':00 · '+v+'%'; });
  }
  document.addEventListener('psaro-cond',function(){ setTimeout(draw,80); });
  document.addEventListener('psaro-view',function(){ setTimeout(draw,80); });
  setTimeout(draw,900); setTimeout(draw,3600); setInterval(draw,30000);

  /* τα στοιχεία καιρού που έχεις διαλέξει (⚙) μπαίνουν μέσα στην κάρτα, με την ίδια λογική */
  var mw=box.querySelector('.mapwx'); if(mw) wxslot.append(mw);
  var mo=new MutationObserver(function(){ var m=box.querySelector('.mapwx'); if(m) wxslot.append(m); });
  mo.observe(box,{childList:true});

  /* 3. κάτω μενού: «Πρόγνωση» και κεντρικό κουμπί ψαρέματος */
  var nav=document.querySelector('nav.tabs');
  if(nav){
    var fcb=nav.querySelector('[data-tab="fc"]');
    if(fcb){ for(var i=0;i<fcb.childNodes.length;i++){ var n=fcb.childNodes[i]; if(n.nodeType===3&&n.textContent.trim()){ n.textContent=T('Πρόγνωση','Forecast'); break; } } }
    var cb=el('button','ndfish'); cb.type='button'; cb.innerHTML=IC.fish;
    var STOP=SVG+'<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';
    /* κατά την έξοδο το κεντρικό κουμπί γίνεται «Τέλος εξόδου» (πάτημα = επιβεβαίωση, παρατεταμένο = λεπτομέρειες) */
    function fl(){
      var on=document.body.classList.contains('ontrip'), tb=$('tripBtn');
      cb.setAttribute('aria-label',on?T('Τέλος εξόδου','End trip'):T('Ξεκίνα έξοδο για ψάρεμα','Start a fishing trip'));
      cb.innerHTML=on?STOP:IC.fish; cb.classList.toggle('end',on); cb.classList.toggle('late',!!(on&&tb&&tb.classList.contains('late')));
    }
    fl(); new MutationObserver(fl).observe(document.body,{attributes:true,attributeFilter:['class']});
    var tbn=$('tripBtn'); if(tbn) new MutationObserver(fl).observe(tbn,{attributes:true,attributeFilter:['class']});
    var lt=null, lheld=false;
    cb.addEventListener('pointerdown',function(){ lheld=false; clearTimeout(lt); if(!document.body.classList.contains('ontrip')) return; lt=setTimeout(function(){ lheld=true; try{ navigator.vibrate&&navigator.vibrate(30); }catch(e){} if(window.PsaroTrip&&window.PsaroTrip.sheet) window.PsaroTrip.sheet(); },450); });
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ cb.addEventListener(ev,function(){ clearTimeout(lt); }); });
    cb.addEventListener('contextmenu',function(e){ e.preventDefault(); });
    cb.addEventListener('click',function(){
      if(lheld){ lheld=false; return; }
      var t=$('tripBtn'); if(t) t.click();
    });
    var logb=nav.querySelector('[data-tab="log"]'); nav.insertBefore(cb,logb||null);
  }
  setInterval(function(){ try{ var tb=document.querySelector('.ndbar'); if(!tb) return; document.documentElement.style.setProperty('--ndfixh',(tb.offsetHeight||0)+'px'); var br=tb.getBoundingClientRect(), cr=card.getBoundingClientRect(); var dtb=document.getElementById('dtBar'); if(dtb){ var dr=dtb.getBoundingClientRect(); dtb.classList.toggle('dtclear',dr.height>0&&br.height>0&&br.top<dr.bottom+16&&br.bottom>dr.top); } card.classList.toggle('ndclear',false&&!document.body.classList.contains('ontrip')&&br.height>0&&br.bottom>cr.top-6&&br.top<cr.bottom); }catch(e){} }, 400);
  setInterval(function(){ var on=document.body.classList.contains('ontrip')&&!card.hidden; document.documentElement.style.setProperty('--ndwx',on?Math.max(0,card.offsetHeight-34)+'px':'0px'); document.documentElement.style.setProperty('--ndtop',(on?card.offsetTop+card.offsetHeight+8:72)+'px'); },400);
  setInterval(function(){ box.style.setProperty('--ndch',(card.hidden||document.body.classList.contains('ontrip')?0:card.offsetHeight)+'px'); },400);
  setInterval(function(){ var m=box.querySelector('.mapwx'); if(m){ m.style.removeProperty('left'); m.style.removeProperty('top'); } },500);
})();

/* κόκκινο χρώμα στα κουμπιά «Διαγραφή» των καρτών */
(function(){ var q=0; function mark(){ q=0; document.querySelectorAll('.card .btn,.acts .btn').forEach(function(b){ var t=(b.textContent||'').trim(); if(t==='Διαγραφή'||t==='Delete') b.classList.add('ndel'); }); }
  new MutationObserver(function(){ if(!q) q=requestAnimationFrame(mark); }).observe(document.body,{childList:true,subtree:true}); mark(); })();

/* Settings: επαγγελματική σειρά + επικεφαλίδες ενοτήτων */
(function(){
  var busy=false;
  function en(){ return window.LANG==='en'; }
  function title(c){ var h=c.querySelector('h3'); if(h) return (h.textContent||'').toLowerCase(); var b=c.querySelector('b'); return b?(b.textContent||'').toLowerCase():''; }
  function arrange(){
    var ps=document.getElementById('pSettings'); if(!ps||busy) return; busy=true;
    try{
      var OWN={ndExport:1,ndTour:1,ndDelAcc:1,ndAbout:1,ndFProf:1};
      var kids=[].slice.call(ps.children).filter(function(c){ return !c.classList.contains('ndsech')&&!OWN[c.id]; });
      var g={back:[],acc:[],pref:[],safe:[],data:[],adv:[],about:[],out:[],ver:[]};
      kids.forEach(function(c,i){
        var id=c.id||'', t=title(c);
        if(c.querySelector('#pBackMain')) g.back.push(c);
        else if(c.querySelector('#acLogout')) g.out.push(c);
        else if(c.id==='appVer'||c.tagName==='P') g.ver.push(c);
        else if(id==='unitsCard'||c.querySelector('#pGpsChk')) g.pref.push(c);
        else if(id==='pContacts') g.safe.push(c);
        else if(id==='dgCard') g.data.push(c);
        else if(t.indexOf('ai')===0||t.indexOf('fish')>-1||t.indexOf('claude')>-1||c.querySelector('input[type=password]')&&/api|key/i.test(c.textContent)&&!/account|λογαριασμ/i.test(t)) g.adv.push(c);
        else g.acc.push(c);
      });
      /* μέσα στο acc: Account, Sync, Password με αυτή τη σειρά */
      var rank=function(c){ var t=(c.textContent||'').toLowerCase(); return /sync|συγχρον/.test(t.slice(0,60))?1:/password|κωδικ/.test(t.slice(0,60))?2:0; };
      g.acc.sort(function(a,b){ return rank(a)-rank(b); });
      g.pref.sort(function(a,b){ return (a.id==='unitsCard'?0:1)-(b.id==='unitsCard'?0:1); });
      var fpc=document.getElementById('ndFProf'); if(!fpc&&window.PsaroFProf) fpc=window.PsaroFProf.card(); if(fpc) g.pref.unshift(fpc);
      var E=en();
      var ex=document.getElementById('ndExport');
      if(!ex){ ex=document.createElement('div'); ex.id='ndExport'; ex.className='card setcard';
        ex.innerHTML='<h3></h3><p class="note"></p><p class="note" id="ndExLast"></p><div class="row"><button class="btn sm" type="button" data-a="exp"></button><button class="btn sm ghost" type="button" data-a="imp"></button><button class="btn sm ghost" type="button" data-a="csv"></button></div>';
        ex.addEventListener('click',function(e){ var a=e.target.closest&&e.target.closest('button'); if(!a) return; var k=a.getAttribute('data-a');
          if(k==='exp'){ var x=document.getElementById('expBtn'); if(x) x.click(); setTimeout(upd,1500); }
          else if(k==='imp'){ var f=document.getElementById('impFile'); if(f) f.click(); }
          else if(k==='csv'&&window.PsaroOpenExport) window.PsaroOpenExport(); }); }
      function upd(){ try{ var lb=+localStorage.getItem('psaro-lastbackup')||0; ex.querySelector('#ndExLast').textContent=(E?'Last backup: ':'Τελευταίο αντίγραφο: ')+(lb?new Date(lb).toLocaleDateString():(E?'never':'ποτέ')); }catch(e){} }
      ex.querySelector('h3').textContent=E?'Backup & export':'Αντίγραφο ασφαλείας και εξαγωγή';
      ex.querySelector('p').textContent=E?'Back up everything on this device, including photos, and restore it on another phone. CSV files are for Excel.':'Αντίγραφο όλων όσων έχεις στη συσκευή, μαζί με τις φωτογραφίες, και επαναφορά σε άλλο κινητό. Τα CSV είναι για Excel.';
      ex.querySelector('[data-a=exp]').textContent=E?'Back up':'Αντίγραφο'; ex.querySelector('[data-a=imp]').textContent=E?'Restore':'Επαναφορά'; ex.querySelector('[data-a=csv]').textContent=E?'CSV / more':'CSV και άλλα';
      upd();
      g.data.push(ex);
      var tr=document.getElementById('ndTour');
      if(!tr){ tr=document.createElement('div'); tr.id='ndTour'; tr.className='card setcard'; tr.innerHTML='<h3></h3><p class="note"></p><div class="row"><button class="btn sm ghost" type="button"></button></div>'; tr.querySelector('button').addEventListener('click',function(){ var p=document.getElementById('profile'); if(p) p.hidden=true; if(window.PsaroTour) window.PsaroTour(); }); }
      tr.querySelector('h3').textContent=E?'Welcome guide':'Οδηγός καλωσορίσματος'; tr.querySelector('p').textContent=E?'A quick tour of forecast, map and trip logging.':'Σύντομη περιήγηση σε πρόγνωση, χάρτη και καταγραφή εξόδων.'; tr.querySelector('button').textContent=E?'Show again':'Εμφάνιση ξανά';
      var da=document.getElementById('ndDelAcc');
      if(!da){ da=document.createElement('div'); da.id='ndDelAcc'; da.className='card setcard';
        da.innerHTML='<h3></h3><p class="note"></p><div class="row"><button class="btn sm ghost ndel" type="button"></button></div>';
        da.querySelector('button').addEventListener('click',function(){ if(window.PsaroDeleteAccount) window.PsaroDeleteAccount(); }); }
      da.querySelector('h3').textContent=E?'Delete account':'Διαγραφή λογαριασμού';
      da.querySelector('p').textContent=E?'Deletes your account and the data synced to the cloud. Data stored on this phone stays until you delete it here.':'Διαγράφει τον λογαριασμό σου και τα δεδομένα που έχουν συγχρονιστεί στο cloud. Τα δεδομένα που είναι στο κινητό μένουν μέχρι να τα σβήσεις εδώ.';
      da.querySelector('button').textContent=E?'Delete my account':'Διαγραφή λογαριασμού';
      da.hidden=!(window.PsaroCloud&&window.PsaroCloud.logged&&window.PsaroCloud.logged());
      g.adv.push(da);
      var ab=document.getElementById('ndAbout');
      if(!ab){ ab=document.createElement('div'); ab.id='ndAbout'; ab.className='card setcard ndabout'; }
      ab.innerHTML=E
        ? '<h3>Privacy</h3><ul class="ndul"><li>Your catches, trips, spots, tackle and photos are stored on this phone.</li><li>If you sign in, they are also synced to your BiteCast account so you can restore them on another phone.</li><li>Your location is used on the phone and sent to weather and map services (Open-Meteo, OpenStreetMap, Esri) only to load forecasts, places and map tiles.</li><li>When trip safety monitoring is on, the route, last known position, battery level and your contact’s email are sent to the BiteCast server so an alert can be sent if you do not return.</li><li>If you use AI fish identification, the photo is sent to Anthropic with your own key.</li></ul><h3>Safety</h3><p class="note">BiteCast is a planning and logging aid. Forecasts are indicative and not an official forecast. It does not replace a VHF radio, lifejackets, flares or official weather warnings. Mobile coverage at sea is limited, so alerts can be delayed or fail.</p>'
        : '<h3>Απόρρητο</h3><ul class="ndul"><li>Τα ψάρια, οι έξοδοι, τα σημεία, ο εξοπλισμός και οι φωτογραφίες σου αποθηκεύονται στο κινητό.</li><li>Αν συνδεθείς, συγχρονίζονται και με τον λογαριασμό σου στο BiteCast, ώστε να τα επαναφέρεις σε άλλο κινητό.</li><li>Η τοποθεσία σου χρησιμοποιείται στο κινητό και στέλνεται σε υπηρεσίες καιρού και χαρτών (Open-Meteo, OpenStreetMap, Esri) μόνο για να φορτωθούν πρόγνωση, μέρη και χάρτης.</li><li>Όταν είναι ενεργή η παρακολούθηση ασφάλειας της εξόδου, στέλνονται στον διακομιστή του BiteCast η διαδρομή, η τελευταία γνωστή θέση, η μπαταρία και το email της επαφής σου, ώστε να σταλεί ειδοποίηση αν δεν γυρίσεις.</li><li>Αν χρησιμοποιήσεις αναγνώριση ψαριού με AI, η φωτογραφία στέλνεται στην Anthropic με το δικό σου κλειδί.</li></ul><h3>Ασφάλεια</h3><p class="note">Το BiteCast είναι βοήθημα προγραμματισμού και καταγραφής. Οι προγνώσεις είναι ενδεικτικές και όχι επίσημη πρόγνωση. Δεν αντικαθιστά VHF, σωσίβια, φωτοβολίδες ή επίσημες προειδοποιήσεις καιρού. Η κάλυψη κινητού στη θάλασσα είναι περιορισμένη, οπότε οι ειδοποιήσεις μπορεί να καθυστερήσουν ή να αποτύχουν.</p>';
      g.about.push(ab);
      g.adv.unshift(tr);
      var H={acc:E?'Account & sync':'Λογαριασμός και συγχρονισμός',pref:E?'Preferences':'Προτιμήσεις',safe:E?'Safety':'Ασφάλεια',data:E?'Data':'Δεδομένα',adv:E?'Advanced':'Για προχωρημένους',about:E?'About':'Σχετικά'};
      var order=[];
      g.back.forEach(function(c){order.push(c)});
      ['acc','pref','safe','data','adv','about'].forEach(function(k){
        if(!g[k].length) return;
        var h=ps.querySelector('.ndsech[data-k="'+k+'"]');
        if(!h){ h=document.createElement('div'); h.className='ndsech'; h.setAttribute('data-k',k); }
        h.textContent=H[k]; order.push(h); g[k].forEach(function(c){order.push(c)});
      });
      g.out.concat(g.ver).forEach(function(c){order.push(c)});
      var seenO=[]; order=order.filter(function(c){ if(seenO.indexOf(c)>-1) return false; seenO.push(c); return true; });
      var cur=[].slice.call(ps.children), same=cur.length===order.length&&cur.every(function(c,i){return c===order[i];});
      if(!same) order.forEach(function(c){ ps.appendChild(c); });
    }catch(e){}
    busy=false;
  }
  var q=0; function sch(){ if(!q) q=setTimeout(function(){ q=0; arrange(); },60); }
  function init(){ var ps=document.getElementById('pSettings'); if(!ps){ setTimeout(init,500); return; }
    new MutationObserver(sch).observe(ps,{childList:true}); arrange(); }
  init();
})();

/* Εικονίδια γραμμής αντί για emoji: ενιαίο στυλ με τα υπόλοιπα εικονίδια (μονόχρωμα, ακολουθούν το χρώμα του κειμένου) */
(function(){
  var IC={"💡": "<path d=\"M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z\"/>", "📍": "<path d=\"M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z\"/><circle cx=\"12\" cy=\"10\" r=\"2.5\"/>", "🔧": "<path d=\"M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z\"/>", "🛒": "<circle cx=\"9\" cy=\"20\" r=\"1.3\"/><circle cx=\"18\" cy=\"20\" r=\"1.3\"/><path d=\"M3 4h2.5l2.2 11h10.6L20.5 8H6.2\"/>", "💾": "<path d=\"M5 4h11l3 3v13H5z\"/><path d=\"M8 4v5h7V4M8 20v-6h8v6\"/>", "📷": "<path d=\"M4 8h3l2-2h6l2 2h3v11H4z\"/><circle cx=\"12\" cy=\"13\" r=\"3.5\"/>", "🖼": "<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"1.6\"/><path d=\"M4 18l5-5 4 4 3-3 4 4\"/>", "🧰": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18\"/>", "📦": "<path d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9z\"/><path d=\"M4 7.5l8 4.5 8-4.5M12 12v9\"/>", "🏠": "<path d=\"M4 11l8-7 8 7v9H4z\"/><path d=\"M10 20v-6h4v6\"/>", "⛽": "<path d=\"M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11\"/><path d=\"M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-3-3\"/><path d=\"M7 8h5\"/>", "⚓": "<circle cx=\"12\" cy=\"5\" r=\"2\"/><path d=\"M12 7v14M7 11h10M4 14a8 8 0 0 0 16 0\"/>", "📅": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10h16M8 3v4M16 3v4\"/>", "⚖": "<path d=\"M12 4v16M7 20h10M5 8h14\"/><path d=\"M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z\"/>", "🎯": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"12\" cy=\"12\" r=\".8\"/>", "🔒": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>", "🔍": "<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"M20 20l-4.5-4.5\"/>", "📝": "<path d=\"M5 4h10l4 4v12H5z\"/><path d=\"M8 12h8M8 16h5\"/>", "🏆": "<path d=\"M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M10 17h4\"/>", "🪪": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><circle cx=\"9\" cy=\"11\" r=\"2\"/><path d=\"M6 16c.5-1.5 5.5-1.5 6 0M14 10h4M14 14h3\"/>", "🎣": "<path d=\"M6 3v10a5 5 0 0 0 10 0v-2M6 3l-2 2\"/><circle cx=\"16\" cy=\"9.5\" r=\"1.5\"/>", "🐟": "<path d=\"M2 12c3-5.5 10-7 15-3l5-3v12l-5-3c-5 4-12 2.5-15-3z\"/><circle cx=\"7.5\" cy=\"11\" r=\".8\"/>", "🔔": "<path d=\"M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4\"/>", "🔕": "<path d=\"M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4M3 3l18 18\"/>", "🧵": "<path d=\"M7 4h10M7 20h10M8 4v16M16 4v16M8 8h8M8 12h8M8 16h8\"/>", "➰": "<path d=\"M4 17c0-6 5-9 8-5s8 1 8-5\"/>", "🪝": "<circle cx=\"14\" cy=\"4\" r=\"1.5\"/><path d=\"M14 5.5V14a5 5 0 0 1-10 0M1.5 12l2.5 2.5L6.5 12\"/>", "🔹": "<path d=\"M12 4l7 8-7 8-7-8z\"/>", "🪢": "<path d=\"M5 8c4 0 4 8 8 8s4-8 8-8M5 16c4 0 4-8 8-8s4 8 8 8\"/>", "🗑": "<path d=\"M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6\"/>", "✏": "<path d=\"M4 20l1-4L16 5l3 3L8 19zM14 7l3 3\"/>", "💬": "<path d=\"M4 5h16v11H9l-5 4z\"/>"};
  var SKIP={OPTION:1,SCRIPT:1,STYLE:1,TEXTAREA:1,TITLE:1,INPUT:1,SELECT:1,svg:1,SVG:1,CODE:1};
  var rx=new RegExp('['+Object.keys(IC).join('')+']');
  function mk(k,tail){ var i=document.createElement('i'); i.className='ndi'; i.setAttribute('aria-hidden','true');
    i.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+IC[k]+'</svg>';
    if(tail) i.classList.add('ndit'); return i; }
  function conv(t){
    var s=t.nodeValue; if(!s||!rx.test(s)) return;
    var p=t.parentNode; if(!p||SKIP[p.nodeName]||(p.closest&&p.closest('svg,[contenteditable=true],.leaflet-tooltip-pane'))) return;
    var cps=Array.from(s), f=document.createDocumentFragment(), buf='';
    for(var j=0;j<cps.length;j++){ var ch=cps[j];
      if(IC[ch]){ if(buf){ f.appendChild(document.createTextNode(buf)); buf=''; }
        var k=j+1; if(cps[k]==='\uFE0F') { j=k; k++; }
        var rest=cps.slice(k).join('').trim(); f.appendChild(mk(ch,!!rest)); }
      else if(ch!=='\uFE0F'||buf) buf+=ch; }
    if(buf) f.appendChild(document.createTextNode(buf));
    p.replaceChild(f,t);
  }
  function walk(n){
    if(n.nodeType===3){ conv(n); return; }
    if(n.nodeType!==1||SKIP[n.nodeName]) return;
    var c=[].slice.call(n.childNodes); for(var i=0;i<c.length;i++) walk(c[i]);
  }
  var q=0, pend=[];
  function flush(){ q=0; var a=pend; pend=[]; for(var i=0;i<a.length;i++){ try{ if(a[i].isConnected) walk(a[i]); }catch(e){} } }
  function sch(n){ pend.push(n); if(!q) q=setTimeout(flush,30); }
  new MutationObserver(function(ms){ for(var i=0;i<ms.length;i++){ var m=ms[i];
    if(m.type==='childList'){ for(var j=0;j<m.addedNodes.length;j++){ var n=m.addedNodes[j]; if(n.nodeType===1&&n.classList&&n.classList.contains('ndi')) continue; sch(n); } }
    else if(m.type==='characterData'){ sch(m.target); } } })
    .observe(document.body,{childList:true,subtree:true,characterData:true});
  setTimeout(function(){ walk(document.body); },200);
})();

/* Άδειες οθόνες (εικονίδιο, τίτλος, κουμπί) και καλωσόρισμα πρώτου ανοίγματος */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  var SV=function(p){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; };
  var P={anchor:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M7 11h10M4 14a8 8 0 0 0 16 0"/>',
    fish:'<path d="M2 12c3-5.5 10-7 15-3l5-3v12l-5-3c-5 4-12 2.5-15-3z"/><circle cx="7.5" cy="11" r=".8"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    pin:'<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    rod:'<path d="M6 3v10a5 5 0 0 0 10 0v-2M6 3l-2 2"/><circle cx="16" cy="9.5" r="1.5"/>',
    wave:'<path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
    shield:'<path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'};
  var KIND={
    tripList:{ic:'anchor',t:T('Ξεκίνα το ημερολόγιό σου','Start your logbook'),cta:T('Προσθήκη εξόδου','Add a trip'),btn:'tNew'},
    biteList:{ic:'fish',t:T('Κατέγραψε το πρώτο σου ψάρι','Log your first catch'),cta:T('Νέο τσίμπημα','New catch'),btn:'bNew',rng:'log',rt:T('Τίποτα σε αυτό το διάστημα','Nothing in this period')},
    stBody:{ic:'chart',t:T('Τα στατιστικά θα εμφανιστούν εδώ','Your statistics will appear here')},
    spotList:{ic:'pin',t:T('Αποθήκευσε το πρώτο σου σημείο','Save your first spot'),cta:T('Νέο σημείο','New spot'),btn:'sNew'}};
  function enhance(e){
    if(e.getAttribute('data-nd')) return; var host=e.parentElement; var k=host&&KIND[host.id];
    if(!k&&e.closest&&e.closest('#pTackle')){ k={ic:'rod',t:T('Πρόσθεσε τον εξοπλισμό σου','Add your tackle')}; }
    if(!k) return; e.setAttribute('data-nd','1'); e.classList.add('ndempty');
    var title=k.t, cta=k.cta, btn=k.btn;
    try{ if(k.rng&&window.PsaroRange&&window.PsaroRange.active(k.rng)){ title=k.rt; cta=null; } }catch(x){}
    var ic=document.createElement('div'); ic.className='ndeic'; ic.innerHTML=SV(P[k.ic]);
    var h=document.createElement('div'); h.className='ndet'; h.textContent=title;
    e.insertBefore(h,e.firstChild); e.insertBefore(ic,e.firstChild);
    if(cta&&btn){ var b=document.createElement('button'); b.type='button'; b.className='btn acc sm ndecta'; b.textContent=cta;
      b.addEventListener('click',function(){ var t=document.getElementById(btn); if(t) t.click(); }); e.appendChild(b); }
  }
  function scan(){ var l=document.querySelectorAll('.empty:not([data-nd])'); for(var i=0;i<l.length;i++){ try{ enhance(l[i]); }catch(x){} } }
  var q=0; new MutationObserver(function(){ if(!q) q=setTimeout(function(){ q=0; scan(); },40); }).observe(document.body,{childList:true,subtree:true});
  scan();

  /* Καλωσόρισμα πρώτου ανοίγματος */
  var OB='psaro-onboard';
  function done(){ try{ localStorage.setItem(OB,'1'); }catch(x){} }
  function seen(){ try{ return !!localStorage.getItem(OB); }catch(x){ return true; } }
  function hasData(){ try{ var S=window.PsaroCore&&window.PsaroCore.Store; if(!S) return false; return ['bites','trips','spots','tackle'].some(function(k){ return (S.raw?S.raw(k):[]).length>0; }); }catch(x){ return false; } }
  var STEPS=[
    {ic:'fish',t:T('Καλώς ήρθες στο BiteCast','Welcome to BiteCast'),b:T('Πρόγνωση, χάρτης και ημερολόγιο για ψάρεμα με σκάφος στην Κύπρο. Τέσσερα γρήγορα βήματα για να ξεκινήσεις.','Forecast, map and logbook for boat fishing in Cyprus. Four quick steps to get started.')},
    {ic:'fish',pick:true,t:T('Πού ψαρεύεις συνήθως;','Where do you usually fish?'),b:T('Διάλεξε τον τύπο ψαρέματος. Προσαρμόζει τις τεχνικές και τα κουμπιά ασφαλείας. Μπορείς να το αλλάξεις αργότερα στα Settings.','Pick your fishing type. It adapts the techniques and safety buttons. You can change it later in Settings.')},
    {ic:'wave',t:T('Δες τη θάλασσα πριν φύγεις','Check the sea before you leave'),b:T('Στην Πρόγνωση βλέπεις βαθμό 0–100, τις καλύτερες ώρες, άνεμο και κύμα για το σημείο που διαλέγεις.','Forecast shows a 0–100 score, the best hours, wind and waves for the place you choose.')},
    {ic:'anchor',t:T('Κατέγραψε κάθε έξοδο','Log every outing'),b:T('Πάτα το κουμπί με το ψάρι για να ξεκινήσεις έξοδο και κατέγραψε ψάρια με ένα άγγιγμα. Αν ορίσεις επαφή ασφαλείας, η εφαρμογή την ειδοποιεί αν δεν γυρίσεις στην ώρα σου.','Tap the fish button to start a trip and log catches with one tap. If you set a safety contact, the app alerts them if you do not return on time.'),last:true}];
  var ov=null, step=0, prevFocus=null, ST=STEPS;
  function close(){ if(!ov) return; done(); ov.remove(); ov=null; document.removeEventListener('keydown',key); try{ if(prevFocus&&prevFocus.focus) prevFocus.focus(); }catch(x){} }
  function key(e){ if(e.key==='Escape') close(); }
  function draw(){
    var s=ST[step]; ov.querySelector('.ndobic').innerHTML=SV(P[s.ic]); ov.querySelector('.ndobt').textContent=s.t; ov.querySelector('.ndobb').textContent=s.b;
    var dots=ov.querySelector('.ndobd'); dots.innerHTML=''; ST.forEach(function(_,i){ var d=document.createElement('i'); if(i===step) d.className='on'; dots.appendChild(d); });
    var pk=ov.querySelector('.ndobp'); pk.hidden=!s.pick; if(s.pick&&window.PsaroFProf){ var cur=window.PsaroFProf.get(); [].forEach.call(pk.querySelectorAll('button'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.p===cur)); }); }
    var nx=ov.querySelector('.ndobn'); nx.textContent=s.nosafe?T('Έτοιμο','Done'):s.last?T('Ξεκινάμε','Get started'):T('Επόμενο','Next');
    var sf=ov.querySelector('.ndobs'); sf.hidden=!s.last||!!s.nosafe; var sk=ov.querySelector('.ndobk'); sk.hidden=!!s.last;
  }
  function open(force,only){
    if(ov) return; ST=only?[Object.assign({},STEPS[1],{last:true,nosafe:true})]:STEPS; if(!force&&(seen()||hasData())){ if(!seen()&&hasData()) done(); return; }
    prevFocus=document.activeElement; step=0;
    ov=document.createElement('div'); ov.className='ndob'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label',T('Καλωσόρισμα','Welcome'));
    ov.innerHTML='<div class="ndobc"><div class="ndobic"></div><h2 class="ndobt"></h2><p class="ndobb"></p><div class="ndobp seg" role="group" hidden></div><div class="ndobd" aria-hidden="true"></div><button type="button" class="btn acc ndobn"></button><button type="button" class="btn ghost ndobs"></button><button type="button" class="ndobk"></button></div>';
    ov.querySelector('.ndobs').textContent=T('Ορισμός επαφής ασφαλείας','Set a safety contact'); ov.querySelector('.ndobk').textContent=T('Παράλειψη','Skip');
    ov.querySelector('.ndobn').addEventListener('click',function(){ if(step<ST.length-1){ step++; draw(); } else{ if(ST.length===1&&window.PsaroFProf){ window.PsaroFProf.set(window.PsaroFProf.get()); try{ localStorage.setItem('psaro-fprof-done','1'); }catch(e){} } close(); } });
    var pkb=ov.querySelector('.ndobp'), PN={boat:T('Βάρκα','Boat'),shore:T('Από στεριά','From shore'),lake:T('Λίμνη / φράγμα','Lake / dam'),spear:T('Ψαροντούφεκο','Spearfishing')};
    var PIC={"boat": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc0\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc0)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"48\" width=\"96\" height=\"14\" fill=\"#2b7893\"/><rect y=\"62\" width=\"96\" height=\"40\" fill=\"#0f5c76\"/><g transform=\"translate(5,3) scale(.93)\">\n<path d=\"M30 17L24 5M34 17L29 4M60 17V6\" stroke=\"#e8f2f5\" stroke-width=\"1.200\" stroke-linecap=\"round\"/>\n<path d=\"M41 45L43 22M52 45L50 22\" stroke=\"#e8f2f5\" stroke-width=\"2.400\" stroke-linecap=\"round\"/><path d=\"M43 36h8M42 30h8\" stroke=\"#e8f2f5\" stroke-width=\"1.200\" stroke-opacity=\".7\"/>\n<path d=\"M28 17.500h37l-2 4.500H30z\" fill=\"#e8f2f5\"/><rect x=\"44\" y=\"13\" width=\"9\" height=\"4.500\" rx=\"1\" fill=\"#8fb6c4\"/><rect x=\"55\" y=\"14.500\" width=\"3\" height=\"3\" rx=\".5\" fill=\"#8fb6c4\"/>\n<path d=\"M38 56V45h18l2 11z\" fill=\"#cfe0e6\"/><path d=\"M40 45l2.500-6h10l3 6z\" fill=\"#7fc6d8\"/>\n<path d=\"M64 56v-8h5l1 8z\" fill=\"#8fb6c4\"/><path d=\"M62 48h8\" stroke=\"#e8f2f5\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M22 56v-4h8v4z\" fill=\"#8fb6c4\"/>\n<path d=\"M82 45h6.500q2.500 0 2.500 3l-1 9-1.500 11q-.5 3-3 3h-3z\" fill=\"#08202b\"/>\n<path d=\"M4 56L22 54.500 82 54Q86 54 86 57L84.500 63Q83 68 77 68H28Q14 68 4 56Z\" fill=\"#e8f2f5\"/>\n<path d=\"M7 59.500L85.500 58.500 84.500 63Q83 68 77 68H28Q15 68 7 59.500Z\" fill=\"#2f9db8\"/><path d=\"M8 60L85 59\" stroke=\"#ff6a3d\" stroke-width=\"1.500\"/>\n</g>\n<path d=\"M0 70c8-3 14 3 22 0s14 3 22 0 14 3 22 0 14 3 22 0 6 2 8 0V96H0z\" fill=\"#0b475d\"/><path d=\"M0 70c8-3 14 3 22 0s14 3 22 0 14 3 22 0 14 3 22 0\" stroke=\"#e8f2f5\" stroke-opacity=\".5\" stroke-width=\"1.600\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#ff6a3d\" stroke-width=\"2.5\"/></svg>", "shore": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc1\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc1)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"50\" width=\"96\" height=\"14\" fill=\"#2b7893\"/><rect y=\"64\" width=\"96\" height=\"40\" fill=\"#0f5c76\"/>\n<path d=\"M33 49Q58 36 80 18\" stroke=\"#08202b\" stroke-width=\"1.900\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M80 18C84 28 83 48 76 71\" stroke=\"#e8f2f5\" stroke-opacity=\".85\" stroke-width=\".9\" fill=\"none\"/>\n<circle cx=\"76\" cy=\"71\" r=\"2.600\" fill=\"#ff6a3d\"/><ellipse cx=\"76\" cy=\"73\" rx=\"9\" ry=\"2.200\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".5\"/>\n<path d=\"M0 60Q14 54 30 60Q40 64 46 72L50 96H0z\" fill=\"#27495a\"/><path d=\"M0 60Q14 54 30 60Q36 62 40 66L44 74 0 74z\" fill=\"#2f5a6b\"/><path d=\"M0 60Q14 54 30 60Q36 62 40 66\" stroke=\"#6fb08a\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M20 60 22 50Q24 44 30 44L35 46 34 52 30 60z\" fill=\"#ff6a3d\"/>\n<path d=\"M16 60l4-1 9-1 8 2 1 3H18z\" fill=\"#08202b\"/><path d=\"M34 60l1 5\" stroke=\"#08202b\" stroke-width=\"2.600\" stroke-linecap=\"round\"/>\n<circle cx=\"26\" cy=\"39\" r=\"3.800\" fill=\"#f2c9a5\"/><path d=\"M20 37.500h13l-2-2.500a4 4 0 0 0-9 0z\" fill=\"#16384a\"/><path d=\"M18 38h17\" stroke=\"#16384a\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n<path d=\"M30 47Q34 48 34 49\" stroke=\"#f2c9a5\" stroke-width=\"2.200\" stroke-linecap=\"round\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>", "lake": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc2\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc2)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"0\" width=\"96\" height=\"26\" fill=\"#2b7893\"/>\n<path d=\"M0 22L22 12 42 30 0 44z\" fill=\"#2f6f52\"/><path d=\"M96 14L72 24 54 30 96 46z\" fill=\"#2f6f52\"/>\n<path d=\"M0 36L28 28 40 34 0 58z\" fill=\"#245a42\"/><path d=\"M96 40L68 30 54 34 96 62z\" fill=\"#245a42\"/>\n<rect x=\"30\" y=\"32\" width=\"36\" height=\"5\" fill=\"#2a8aa6\"/>\n<path d=\"M22 36H74L82 62H14z\" fill=\"#d6e2e5\"/><path d=\"M22 36H74\" stroke=\"#e8f2f5\" stroke-width=\"2.400\"/>\n<rect x=\"26\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"36\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"46\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"56\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"66\" y=\"38\" width=\"4\" height=\"9\" fill=\"#6f8f98\"/>\n<path d=\"M28 47l-2 15M38 47l-2 15M48 47l-1 15M58 47l1 15M68 47l2 15\" stroke=\"#e8f2f5\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\".85\"/>\n<path d=\"M0 62H96V96H0z\" fill=\"#0f5c76\"/><path d=\"M0 62C20 58 34 66 50 62S80 58 96 62V70C80 66 66 74 48 70S16 66 0 70z\" fill=\"#0b475d\"/>\n<path d=\"M0 62L14 62 6 96H0zM96 62L82 62 90 96H96z\" fill=\"#245a42\"/><path d=\"M30 70c6-2 10 2 16 0s10 2 16 0\" stroke=\"#e8f2f5\" stroke-opacity=\".5\" stroke-width=\"1.800\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>", "spear": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc3\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc3)\"><rect width=\"96\" height=\"96\" fill=\"#14627c\"/><rect y=\"46\" width=\"96\" height=\"50\" fill=\"#0e4d64\"/><rect y=\"74\" width=\"96\" height=\"22\" fill=\"#0a3548\"/>\n<path d=\"M14 0h12l14 80H24zM44 0h9l18 80H58z\" fill=\"#e8f2f5\" opacity=\".08\"/>\n<path d=\"M0 8c10-4 20 4 30 0s20 4 30 0 24 4 36 0\" stroke=\"#e8f2f5\" stroke-opacity=\".4\" stroke-width=\"1.800\" fill=\"none\"/>\n<path d=\"M0 86c14-8 26 2 42-2s26 4 40-2 10 0 14-2v18H0z\" fill=\"#06202b\"/>\n<path d=\"M72 30q6-6 14 0-8 6-14 0zM86 30l5-4v8z\" fill=\"#8fb6c4\"/><circle cx=\"76\" cy=\"29.500\" r=\"1\" fill=\"#08202b\"/>\n<g transform=\"translate(2,6) scale(.94)\"><g fill=\"#08202b\" stroke=\"#08202b\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n<ellipse cx=\"62\" cy=\"44\" rx=\"6.200\" ry=\"4.600\" stroke=\"none\"/>\n<path d=\"M57 42L52 40 40 44 28 51 25 55 31 58 44 53 56 49z\" stroke-width=\"1\"/>\n<path d=\"M58 47Q68 47 76 49.500\" fill=\"none\" stroke-width=\"4.600\"/>\n<path d=\"M28 53L16 59 8 58\" fill=\"none\" stroke-width=\"5.400\"/><path d=\"M30 56L20 63 12 66\" fill=\"none\" stroke-width=\"4.800\"/>\n<path d=\"M8 58L1 54 2 61 9 64z\" stroke-width=\"1\"/><path d=\"M12 66L5 64 4 71 12 70z\" stroke-width=\"1\"/>\n<path d=\"M65 40L63 31\" fill=\"none\" stroke-width=\"1.800\"/><path d=\"M63 31h-3\" fill=\"none\" stroke-width=\"1.800\"/></g>\n<rect x=\"62\" y=\"41.800\" width=\"5\" height=\"3.400\" rx=\"1.200\" fill=\"#8fd3e2\"/>\n<path d=\"M66 49.500L95 48.800\" stroke=\"#08202b\" stroke-width=\"2.200\" stroke-linecap=\"round\"/><path d=\"M95 48.800l-6.500-1.800 .2 3.200z\" fill=\"#ff6a3d\" stroke=\"none\"/></g>\n<circle cx=\"72\" cy=\"22\" r=\"2.200\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".6\"/><circle cx=\"76\" cy=\"14\" r=\"1.600\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".5\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>"};
    var PD={boat:T('Θάλασσα, κύμα, MOB και SOS','Sea, waves, MOB and SOS'),shore:T('Τεχνικές στεριάς, χωρίς MOB','Shore techniques, no MOB'),lake:T('Τεχνικές λίμνης, χωρίς κύμα','Lake techniques, no waves'),spear:T('Τεχνικές κατάδυσης, επαφή ασφαλείας','Diving techniques, safety contact')};
    ['boat','shore','lake','spear'].forEach(function(k){ var b=document.createElement('button'); b.type='button'; b.dataset.p=k;
      b.innerHTML='<i class="ndck" aria-hidden="true"></i><span class="ndpic" aria-hidden="true">'+PIC[k]+'</span><b></b><span class="ndpd"></span>'; b.querySelector('b').textContent=PN[k]; b.querySelector('.ndpd').textContent=PD[k];
      b.addEventListener('click',function(){ if(window.PsaroFProf) window.PsaroFProf.set(k); try{ localStorage.setItem('psaro-fprof-done','1'); }catch(e){} draw(); }); pkb.appendChild(b); });
    ov.querySelector('.ndobk').addEventListener('click',close);
    ov.querySelector('.ndobs').addEventListener('click',function(){ close(); var np=document.getElementById('navProf'); if(np) np.click(); setTimeout(function(){ var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){ return x.offsetParent&&/^(Settings|Ρυθμίσεις)$/.test(x.textContent.trim()); })[0]; if(b) b.click(); var n=0, t=setInterval(function(){ n++; var c=document.getElementById('pContacts'), f=document.getElementById('sfName');
      if(c&&c.offsetParent&&f){ clearInterval(t); try{ c.scrollIntoView({block:'start',behavior:'smooth'}); }catch(e){ c.scrollIntoView(); }
        c.classList.add('ndflash'); setTimeout(function(){ c.classList.remove('ndflash'); },2200); setTimeout(function(){ try{ f.focus({preventScroll:true}); }catch(e){} },450); }
      else if(n>20) clearInterval(t); },150); },350); });
    document.body.appendChild(ov); document.addEventListener('keydown',key); draw(); try{ ov.querySelector('.ndobn').focus({preventScroll:true}); }catch(x){}
  }
  window.PsaroTour=function(){ open(true); };
  /* υπάρχοντες χρήστες που δεν έχουν διαλέξει ακόμα τύπο ψαρέματος: μία φορά */
  function fpUnset(){ try{ return !localStorage.getItem('psaro-fprof-done'); }catch(x){ return false; } }
  var t2=0, iv2=setInterval(function(){ t2++; if(t2>50){ clearInterval(iv2); return; }
    if(document.documentElement.classList.contains('gated')||ov) return; if(!document.querySelector('.ndcard,.ndsearch')||!window.PsaroFProf) return;
    clearInterval(iv2); if(!fpUnset()) return;
    if(!seen()&&!hasData()) return; /* οι νέοι χρήστες το βλέπουν μέσα στο καλωσόρισμα */
    setTimeout(function(){ if(!ov) open(true,true); },1600); },700);
  var tries=0, iv=setInterval(function(){ tries++;
    if(tries>40){ clearInterval(iv); return; }
    if(document.documentElement.classList.contains('gated')) return;
    if(!document.querySelector('.ndcard,.ndsearch')) return;
    clearInterval(iv); setTimeout(function(){ open(false); },900); },700);
})();

/* Ειδοποίηση νέας έκδοσης: όταν ανεβαίνουν νέα αρχεία, ο χρήστης βλέπει «Νέα έκδοση» και ανανεώνει όταν θέλει (ποτέ μέσα σε έξοδο) */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  var bar=null, dismissed=false, had=!!(navigator.serviceWorker&&navigator.serviceWorker.controller);
  function show(){
    if(bar||dismissed) return;
    bar=document.createElement('div'); bar.className='ndupd'; bar.setAttribute('role','status');
    bar.innerHTML='<span></span><button type="button" class="ndupgo"></button><button type="button" class="ndupx" aria-label="✕">✕</button>';
    bar.querySelector('span').textContent=T('Νέα έκδοση διαθέσιμη','A new version is available');
    bar.querySelector('.ndupgo').textContent=T('Ανανέωση','Update');
    bar.querySelector('.ndupgo').addEventListener('click',function(){
      var go=function(){ location.reload(); };
      try{ if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function(rg){ return rg?rg.update():0; }).catch(function(){}).then(function(){ return window.caches?caches.keys():[]; }).then(function(ks){ return Promise.all((ks||[]).filter(function(k){ return /^psarovarka-/.test(k)&&k!=='psarovarka-'+window.PSARO_VERSION; }).map(function(k){ return caches.delete(k); })); }).then(go,go); else go(); }catch(e){ go(); } });
    bar.querySelector('.ndupx').addEventListener('click',function(){ dismissed=true; bar.remove(); bar=null; });
    document.body.appendChild(bar);
  }
  function ready(){ return !document.body.classList.contains('ontrip'); }
  /* συγκρίνουμε αριθμητικά (v31z269 → 269): μια παλιά αντίγραφη του server δεν πρέπει να εμφανίζει «νέα έκδοση» */
  function num(v){ var m=/z(\d+)/.exec(v||''); return m?+m[1]:0; }
  function check(){
    if(!navigator.onLine||!window.PSARO_VERSION) return;
    fetch('version.js?_='+Date.now(),{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; }).then(function(t){
      var m=/PSARO_VERSION\s*=\s*'([^']+)'/.exec(t||''); if(m&&num(m[1])>num(window.PSARO_VERSION)&&ready()) show(); }).catch(function(){});
  }
  if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange',function(){ setTimeout(check,1500); });
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') check(); });
  setTimeout(check,8000); setInterval(check,15*60*1000);
  /* μετά το τέλος εξόδου, αν περίμενε ενημέρωση */
  window.addEventListener('psaro-tripend',function(){ setTimeout(check,3000); });
})();

/* Διαγραφή λογαριασμού: πρώτα έλεγχος ότι η υπηρεσία υπάρχει στον διακομιστή, μετά σβήσιμο δεδομένων cloud και λογαριασμού */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  function say(m){ try{ window.PsaroCore.toast(m); }catch(e){} }
  setInterval(function(){ var d=document.getElementById('ndDelAcc'); if(d) d.hidden=!(window.PsaroCloud&&window.PsaroCloud.logged&&window.PsaroCloud.logged()); },1500);
  window.PsaroDeleteAccount=async function(){
    var C=window.PsaroCloud, A=window.PsaroAsk; if(!C||!C.logged()||!A) return;
    var word=T('ΔΙΑΓΡΑΦΗ','DELETE');
    var sure=await A(T('Σίγουρα θέλεις να διαγράψεις τον λογαριασμό σου; Θα χαθούν οριστικά τα δεδομένα σου στο cloud και δεν μπορεί να αναιρεθεί.','Are you sure you want to delete your account? Your cloud data will be permanently lost and this cannot be undone.'),{title:T('Διαγραφή λογαριασμού','Delete account'),ok:T('Ναι, συνέχεια','Yes, continue'),cancel:T('Άκυρο','Cancel'),danger:true});
    if(!sure) return;
    var v=await A.prompt(T('Θα διαγραφεί ο λογαριασμός σου και όσα δεδομένα έχουν συγχρονιστεί στο cloud. Δεν μπορεί να αναιρεθεί. Τα δεδομένα στο κινητό μένουν.\n\nΓράψε '+word+' για να συνεχίσεις.','Your account and everything synced to the cloud will be deleted. This cannot be undone. Data on this phone stays.\n\nType '+word+' to continue.'),{title:T('Διαγραφή λογαριασμού','Delete account'),ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel')});
    if(!v||v.trim().toUpperCase()!==word){ if(v!==null) say(T('Δεν έγινε διαγραφή.','Nothing was deleted.')); return; }
    try{
      try{ await C.rest('rpc/delete_my_account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dry:true})}); }
      catch(e){ say(T('Η διαγραφή λογαριασμού δεν έχει ενεργοποιηθεί ακόμα στον διακομιστή. Δεν διαγράφηκε τίποτα.','Account deletion is not enabled on the server yet. Nothing was deleted.')); return; }
      try{ await C.rest('records?id=not.is.null',{method:'DELETE'}); }catch(e){}
      try{ await C.rest('safety_trips?id=not.is.null',{method:'DELETE'}); }catch(e){}
      try{ await C.rest('safety_contacts?updated_at=not.is.null',{method:'DELETE'}); }catch(e){}
      try{ var pup=JSON.parse(localStorage.getItem('psaro-pup')||'{}'), uid=C.uid(); for(var k in pup){ try{ await C.storage('DELETE','photos/'+uid+'/'+k+'.jpg'); }catch(e){} } }catch(e){}
      await C.rest('rpc/delete_my_account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dry:false})});
      try{ ['psaro-sess','psaro-last','psaro-pup'].forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
      say(T('Ο λογαριασμός διαγράφηκε.','Your account was deleted.')); setTimeout(function(){ location.reload(); },1200);
    }catch(e){ say(T('Η διαγραφή απέτυχε. Δοκίμασε ξανά.','Deletion failed. Try again.')); }
  };
})();

/* Χαμηλή μπαταρία κατά την έξοδο (20% και 10%) */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  if(!navigator.getBattery) return;
  var warned={20:false,10:false}, bar=null;
  function show(txt){ if(bar) bar.remove(); bar=document.createElement('div'); bar.className='ndupd ndbat'; bar.setAttribute('role','alert');
    bar.innerHTML='<span></span><button type="button" class="ndupx" aria-label="✕">✕</button>'; bar.querySelector('span').textContent=txt;
    bar.querySelector('.ndupx').addEventListener('click',function(){ bar.remove(); bar=null; }); document.body.appendChild(bar);
    try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){} }
  function chk(b){ if(!document.body.classList.contains('ontrip')) return; if(b.charging){ warned[20]=warned[10]=false; return; }
    var p=Math.round(b.level*100);
    if(p<=10&&!warned[10]){ warned[10]=warned[20]=true; show(T('Μπαταρία '+p+'%. Φόρτισε τώρα ή κλείσε ό,τι δεν χρειάζεσαι.','Battery '+p+'%. Charge now or close what you do not need.')); }
    else if(p<=20&&p>10&&!warned[20]){ warned[20]=true; show(T('Μπαταρία '+p+'%. Η έξοδος συνεχίζει να καταγράφεται.','Battery '+p+'%. The trip keeps being recorded.')); }
    if(p>25){ warned[20]=warned[10]=false; } }
  navigator.getBattery().then(function(b){ b.addEventListener('levelchange',function(){ chk(b); }); b.addEventListener('chargingchange',function(){ chk(b); }); setInterval(function(){ chk(b); },60000); }).catch(function(){});
})();

/* Ζωντανή κατάσταση εξόδου: χρονόμετρο, ψάρια, χιλιόμετρα και ώρα επιστροφής πάνω από τον χάρτη */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  var pill=null, tmr=null;
  function p2(n){ return (n<10?'0':'')+n; }
  function hm(ms){ var d=new Date(ms); return p2(d.getHours())+':'+p2(d.getMinutes()); }
  function build(){
    var host=document.querySelector('.ndsearch'); host=host&&host.parentNode; if(!host) return false;
    pill=document.createElement('div'); pill.className='ndlive'; pill.setAttribute('role','status'); pill.hidden=true;
    pill.innerHTML='<span class="ndld" aria-hidden="true"></span><b class="ndlt">00:00</b><span class="ndls"></span>';
    host.appendChild(pill); return true;
  }
  function tick(){
    var on=document.body.classList.contains('ontrip'); if(!pill&&!build()) return;
    var s=null; try{ s=window.PsaroTrip&&window.PsaroTrip.state&&window.PsaroTrip.state(); }catch(e){}
    if(!on||!s||!s.active||!s.start){ pill.hidden=true; return; }
    pill.hidden=false;
    var sec=Math.max(0,Math.floor((Date.now()-s.start)/1000)), h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), x=sec%60;
    pill.querySelector('.ndlt').textContent=(h?h+':'+p2(m):p2(m))+':'+p2(x);
    var n=0, km=0; try{ n=window.PsaroTrip.counts().n||0; }catch(e){} try{ km=window.PsaroTrack&&window.PsaroTrack.km?window.PsaroTrack.km():0; }catch(e){}
    var parts=[n+' '+(n===1?T('ψάρι','fish'):T('ψάρια','fish'))];
    if(km>=0.05) parts.push(km.toFixed(1)+' km');
    if(s.due) parts.push(T('επιστροφή ','back ')+hm(s.due));
    var ls=pill.querySelector('.ndls'); ls.textContent=''; var s1=document.createElement('span'); s1.textContent=parts[0]; ls.appendChild(s1);
    if(parts.length>1){ var s2=document.createElement('span'); s2.className='ndlx'; s2.textContent=' · '+parts.slice(1).join(' · '); ls.appendChild(s2); }
    pill.classList.toggle('late',!!(s.due&&Date.now()>s.due));
  }
  tmr=setInterval(tick,1000); document.addEventListener('visibilitychange',tick);
})();

/* «pop» στο σήμα των κουμπιών ψαριού όταν αλλάζει ο αριθμός */
(function(){
  var last=new WeakMap();
  setInterval(function(){
    [].forEach.call(document.querySelectorAll('#fbCatchN,#fbMissN'),function(b){
      var v=b.textContent; if(last.has(b)&&last.get(b)!==v){ b.classList.remove('ndpop'); void b.offsetWidth; b.classList.add('ndpop'); } last.set(b,v); });
  },500);
})();

/* Φύλλα (φόρμα ψαριού, έξοδος): κλείνουν σέρνοντας τη λαβή προς τα κάτω */
(function(){
  var PAIRS=[['#sheet .sheet-in','bClose'],['#tripSheet .pbox','tripClose']];
  function wire(pn,closeId){
    if(pn.querySelector(':scope>.ndgrab')) return;
    var cs=getComputedStyle(pn); if(cs.position==='static') pn.style.position='relative';
    var g=document.createElement('div'); g.className='ndgrab'; g.setAttribute('aria-hidden','true'); g.innerHTML='<i></i>'; pn.insertBefore(g,pn.firstChild);
    var y0=null, dy=0, t0=0;
    g.addEventListener('pointerdown',function(e){ y0=e.clientY; dy=0; t0=Date.now(); pn.style.transition='none'; try{ g.setPointerCapture(e.pointerId); }catch(x){} });
    g.addEventListener('pointermove',function(e){ if(y0==null) return; dy=Math.max(0,e.clientY-y0); pn.style.transform='translateY('+dy+'px)'; });
    function end(){ if(y0==null) return; var fast=dy/Math.max(1,Date.now()-t0)>0.6; var shut=dy>110||(fast&&dy>40); y0=null;
      pn.style.transition='transform .2s ease'; if(shut){ pn.style.transform='translateY(100%)'; setTimeout(function(){ var b=document.getElementById(closeId); if(b) b.click(); pn.style.transition='none'; pn.style.transform=''; },180); } else { pn.style.transform=''; setTimeout(function(){ pn.style.transition=''; },220); } }
    g.addEventListener('pointerup',end); g.addEventListener('pointercancel',end);
  }
  function run(){ PAIRS.forEach(function(p){ var pn=document.querySelector(p[0]); if(pn) wire(pn,p[1]); }); }
  run(); setTimeout(run,1500);
})();

/* Today: επιλογή συγκεκριμένης ημέρας και ώρας, με καιρό και bite forecast για εκείνη την ώρα */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.PsaroCore, PU=window.PsaroUnits;
  if(!C) return;
  var host=document.getElementById('liveBox'); if(!host||!host.parentNode) return;
  function p2(n){ return (n<10?'0':'')+n; }
  var card=document.createElement('div'); card.className='card ndhr'; card.hidden=true;
  card.innerHTML='<h3></h3><p class="note ndhrp"></p><div class="ndhrd" role="tablist"></div><div class="ndhrh" role="listbox"></div><div class="ndhrr" aria-live="polite"></div><p class="note ndhrn"></p>';
  card.querySelector('h3').textContent=T('Καιρός και ψάρεμα ανά ώρα','Weather and fishing by hour');
  card.querySelector('.ndhrn').textContent=T('Η πρόγνωση ανά ώρα προέρχεται από το Open-Meteo και δεν αντικαθιστά επίσημη πρόγνωση. Ώρες τοπικές για το σημείο.','Hourly data from Open-Meteo. Not an official forecast. Times are local to the place.');
  host.parentNode.insertBefore(card,host.nextSibling);
  var dEl=card.querySelector('.ndhrd'), hEl=card.querySelector('.ndhrh'), rEl=card.querySelector('.ndhrr'), pEl=card.querySelector('.ndhrp');
  var fc=null, key='', at=0, selD=0, selH=null, busy=false;
  var DN=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
  function lvl(v){ return v>=75?'g':v>=60?'l':v>=45?'w':'b'; }
  function verdict(v){ return v>=75?T('Πολύ καλές προϋποθέσεις','Very good conditions'):v>=60?T('Καλές προϋποθέσεις','Good conditions'):v>=45?T('Μέτριες προϋποθέσεις','Fair conditions'):T('Δύσκολες προϋποθέσεις','Poor conditions'); }
  function dirTxt(d){ if(d==null) return ''; var N=['N','NE','E','SE','S','SW','W','NW']; return N[Math.round(((d%360)+360)%360/45)%8]; }
  function dayLab(date,i){ if(i===0) return T('Σήμερα','Today'); if(i===1) return T('Αύριο','Tomorrow'); var d=new Date(date+'T12:00:00Z'); return DN[d.getUTCDay()]+' '+date.slice(8)+'/'+date.slice(5,7); }
  function u(fn,v,a){ try{ return PU&&PU[fn]?PU[fn](v,a):''; }catch(e){ return ''; } }
  function tile(lab,val,sub){ var t=document.createElement('div'); t.className='ndhrt'; var b=document.createElement('b'); b.textContent=val; var l=document.createElement('span'); l.textContent=lab; t.append(b,l); if(sub){ var s=document.createElement('small'); s.textContent=sub; t.append(s); } return t; }
  var PT={slow:T('Πέφτει αργά','Falling slowly'),stable:T('Σταθερή','Steady'),rise:T('Ανεβαίνει','Rising'),fast:T('Πέφτει απότομα','Falling fast')};
  var CL={clear:T('Καθαρός','Clear'),part:T('Λίγα σύννεφα','Partly cloudy'),over:T('Συννεφιά','Overcast')};
  function renderHours(){
    var d=fc.days[selD]; hEl.replaceChildren(); if(!d) return;
    var nowH=fc.nowLocal.slice(0,13), today=fc.nowLocal.slice(0,10);
    d.hours.forEach(function(h){
      var b=document.createElement('button'); b.type='button'; b.className='ndhc'; b.dataset.lv=lvl(h.score); b.dataset.h=h.hr; b.setAttribute('role','option');
      var past=d.date===today&&h.t.slice(0,13)<nowH; if(past) b.classList.add('past');
      var a=document.createElement('b'); a.textContent=p2(h.hr); var s=document.createElement('i'); s.textContent=h.score; b.append(a,s);
      b.setAttribute('aria-label',p2(h.hr)+':00 · '+T('βαθμός ','score ')+h.score); b.setAttribute('aria-selected',h.hr===selH?'true':'false');
      if(h.hr===selH) b.classList.add('on');
      b.addEventListener('click',function(){ selH=h.hr; renderHours(); renderDetail(); });
      hEl.append(b);
    });
    var on=hEl.querySelector('.on'); if(on&&on.scrollIntoView){ try{ hEl.scrollLeft=Math.max(0,on.offsetLeft-hEl.clientWidth/2+on.offsetWidth/2); }catch(e){} }
  }
  function centerOn(){ var on=hEl.querySelector('.on'); if(on) hEl.scrollLeft=Math.max(0,on.offsetLeft-hEl.clientWidth/2+on.offsetWidth/2); }
  function renderDays(){
    dEl.replaceChildren();
    fc.days.slice(0,4).forEach(function(d,i){ var b=document.createElement('button'); b.type='button'; b.className='ndhdb'+(i===selD?' on':''); b.textContent=dayLab(d.date,i); b.setAttribute('role','tab'); b.setAttribute('aria-selected',i===selD?'true':'false');
      b.addEventListener('click',function(){ selD=i; var d2=fc.days[i]; if(!d2.hours.some(function(h){ return h.hr===selH; })) selH=d2.hours[0]&&d2.hours[0].hr; if(i===0){ var nh=+fc.nowLocal.slice(11,13); var ok=d2.hours.filter(function(h){ return h.hr>=nh; })[0]; if(ok&&selH<nh) selH=ok.hr; } renderDays(); renderHours(); renderDetail(); setTimeout(centerOn,30); });
      dEl.append(b); });
  }
  function renderDetail(){
    var d=fc.days[selD], h=d&&d.hours.filter(function(x){ return x.hr===selH; })[0]; rEl.replaceChildren(); if(!h) return;
    var top=document.createElement('div'); top.className='ndhrtop';
    var sc=document.createElement('div'); sc.className='ndhrsc'; sc.dataset.lv=lvl(h.score); sc.innerHTML='<b></b><span>/100</span>'; sc.firstChild.textContent=h.score;
    var tx=document.createElement('div'); tx.className='ndhrtx'; var t1=document.createElement('b'); t1.textContent=dayLab(d.date,selD)+' · '+p2(h.hr)+':00'; var t2=document.createElement('span'); t2.textContent=verdict(h.score);
    var pill=document.createElement('em'); pill.className='ndhrsf'+(h.safe?'':' no'); pill.textContent=h.safe?T('Ασφαλές για μικρό σκάφος','Suitable for a small boat'):T('Όχι ασφαλές για μικρό σκάφος','Not safe for a small boat');
    tx.append(t1,t2,pill); top.append(sc,tx); rEl.append(top);
    var g=document.createElement('div'); g.className='ndhrg';
    g.append(tile(T('Άνεμος','Wind'),u('wind',h.wind)+(h.dir!=null?' '+dirTxt(h.dir):''),h.gust!=null?T('Ριπές ','Gusts ')+u('wind',h.gust):''));
    var lakeP=window.PsaroFProf&&window.PsaroFProf.get()==='lake';
    if(h.wave!=null&&!lakeP) g.append(tile(T('Κύμα','Waves'),u('wave',h.wave),h.period!=null?Math.round(h.period)+' s':''));
    if(h.temp!=null) g.append(tile(T('Αέρας','Air'),u('temp',h.temp),CL[h.cloud]||''));
    if(h.sst!=null&&!lakeP) g.append(tile(T('Θάλασσα','Sea'),u('temp',h.sst),''));
    if(h.pres!=null) g.append(tile(T('Πίεση','Pressure'),u('press',h.pres),PT[h.ptrend]||''));
    if(h.rain!=null) g.append(tile(T('Βροχή','Rain'),Math.round(h.rain)+'%',''));
    rEl.append(g);
  }
  function load(){
    var cc=C.getViewCond&&C.getViewCond(); if(!cc||cc.lat==null||!window.PF){ card.hidden=true; return; }
    var k=cc.lat.toFixed(3)+','+cc.lon.toFixed(3);
    if(fc&&k===key&&Date.now()-at<20*60000){ card.hidden=false; return; }
    if(busy) return; busy=true; var firstTime=!fc||k!==key;
    if(firstTime) card.hidden=true;
    window.PF.getForecast(+cc.lat,+cc.lon,undefined,{days:4}).then(function(r){
      fc=r; key=k; at=Date.now(); busy=false; if(!fc.days.length){ card.hidden=true; return; }
      selD=Math.min(selD,fc.days.length-1);
      var nh=+fc.nowLocal.slice(11,13); if(selH==null||firstTime){ selD=0; var d0=fc.days[0]; var nx=d0.hours.filter(function(h){ return h.hr>nh; })[0]||d0.hours[d0.hours.length-1]; selH=nx&&nx.hr; }
      var nm=document.getElementById('liveSub'); pEl.textContent=T('Για: ','For: ')+((cc.name||'')||T('το επιλεγμένο σημείο','the selected place'));
      card.hidden=false; renderDays(); renderHours(); renderDetail(); setTimeout(centerOn,60);
    }).catch(function(){ busy=false; if(!fc) card.hidden=true; });
  }
  ['psaro-view','psaro-cond'].forEach(function(ev){ document.addEventListener(ev,function(){ setTimeout(load,300); }); });
  document.addEventListener('click',function(e){ if(e.target.closest&&e.target.closest('[data-tab],[data-go]')) setTimeout(function(){ if(!card.hidden) centerOn(); },200); });
  setTimeout(load,2500); setInterval(function(){ var t=document.getElementById('tab-today'); if(t&&!t.hidden) load(); },60000);
  window.addEventListener('psaro-units',function(){ if(fc&&!card.hidden) renderDetail(); });
  window.addEventListener('psaro-fprof',function(){ if(fc&&!card.hidden) renderDetail(); });
})();

/* Τύπος ψαρέματος (προφίλ): Βάρκα, Από στεριά, Λίμνη/φράγμα, Ψαροντούφεκο. Αλλάζει τις τεχνικές, τα κουμπιά ασφαλείας και τον καιρό που φαίνεται. */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.PsaroCore;
  var KEY='psaro-fprof', LIST=['boat','shore','lake','spear'];
  var NAME={boat:T('Βάρκα','Boat'),shore:T('Από στεριά','From shore'),lake:T('Λίμνη / φράγμα','Lake / dam'),spear:T('Ψαροντούφεκο','Spearfishing')};
  var DESC={
    boat:T('Έξοδος με σκάφος στη θάλασσα: καιρός θάλασσας, κύμα, MOB και SOS.','Boat trips at sea: marine weather, waves, MOB and SOS.'),
    shore:T('Ψάρεμα από ακτή ή μόλο: τεχνικές στεριάς, χωρίς MOB.','Fishing from a beach or pier: shore techniques, no MOB.'),
    lake:T('Γλυκό νερό: τεχνικές λίμνης, χωρίς κύμα και θερμοκρασία θάλασσας.','Fresh water: lake techniques, no waves or sea temperature.'),
    spear:T('Κατάδυση και ψαροντούφεκο: τεχνικές κατάδυσης. Ορίσε επαφή ασφαλείας πριν βουτήξεις.','Freediving and spearfishing: diving techniques. Set a safety contact before you dive.')};
  function get(){ var v=null; try{ v=localStorage.getItem(KEY); }catch(e){} return LIST.indexOf(v)>-1?v:'boat'; }
  function apply(){ var p=get(); LIST.forEach(function(k){ document.body.classList.toggle('fp-'+k,k===p); }); }
  function set(p){ if(LIST.indexOf(p)<0) return; try{ localStorage.setItem(KEY,p); }catch(e){} apply(); try{ window.dispatchEvent(new Event('psaro-fprof')); }catch(e){} paint(); }
  var card=null;
  function paint(){ if(!card) return; var p=get(); [].forEach.call(card.querySelectorAll('button[data-p]'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.p===p)); }); card.querySelector('.ndfpd').textContent=DESC[p]; }
  function build(){
    if(card) return card;
    card=document.createElement('div'); card.id='ndFProf'; card.className='card setcard';
    card.innerHTML='<h3></h3><div class="seg ndfps" role="group"></div><p class="note ndfpd"></p><h3 class="ndvh"></h3><div class="seg ndvs" role="group"></div><p class="note ndvn"></p>';
    card.querySelector('h3').textContent=T('Τύπος ψαρέματος','Fishing type');
    var sg=card.querySelector('.seg');
    LIST.forEach(function(k){ var b=document.createElement('button'); b.type='button'; b.dataset.p=k; b.textContent=NAME[k]; b.addEventListener('click',function(){ set(k); }); sg.append(b); });
    card.querySelector('.ndvh').textContent=T('Γλώσσα φωνητικής καταγραφής','Voice input language');
    card.querySelector('.ndvn').textContent=T('Για το μικρόφωνο στον χάρτη (έξοδος) και το «Πες το» στη φόρμα ψαριού. Λέγε τα ονόματα των ψαριών στη γλώσσα που διαλέγεις.','For the map microphone (during a trip) and “Say it” in the catch form. Say fish names in the language you pick here.');
    var vs=card.querySelector('.ndvs');
    function vget(){ var v=null; try{ v=JSON.parse(localStorage.getItem('psaro-vlang')); }catch(e){} return v==='en-US'?'en-US':'el-GR'; }
    function vpaint(){ [].forEach.call(vs.querySelectorAll('button'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.v===vget())); }); }
    [['el-GR','Ελληνικά'],['en-US','English']].forEach(function(o){ var b=document.createElement('button'); b.type='button'; b.dataset.v=o[0]; b.textContent=o[1]; b.addEventListener('click',function(){ try{ if(C&&C.lsSet) C.lsSet('psaro-vlang',o[0]); else localStorage.setItem('psaro-vlang',JSON.stringify(o[0])); }catch(e){} vpaint(); }); vs.append(b); });
    vpaint(); paint(); return card;
  }
  window.PsaroFProf={get:get,set:set,card:build,name:function(){ return NAME[get()]; }};
  apply(); new MutationObserver(function(){ if(!document.body.classList.contains('fp-'+get())) apply(); }).observe(document.body,{attributes:true,attributeFilter:['class']});
})();

/* Φύλλο από κάτω (bottom sheet): τα παράθυρα σημείων, ψαριών και λιμανιών ανοίγουν ως φύλλο που σέρνεται (μισό ή σχεδόν πλήρες) αντί για μικρό παράθυρο πάνω στον χάρτη */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.PsaroCore;
  if(!C) return;
  var sheet=null, body=null, st={h:0}, map=null, wired=false;
  function isNarrow(){ return window.innerWidth<=700; }
  function navTop(){ var n=document.querySelector('nav.tabs'); var r=n&&n.getBoundingClientRect(); return r&&r.height?window.innerHeight-r.top+8:84; }
  function maxH(){ return Math.max(220,window.innerHeight-navTop()-76); }
  function peekH(){ return Math.min(maxH(),Math.round(window.innerHeight*.5)); }
  function build(){
    sheet=document.createElement('div'); sheet.className='ndbs'; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','false'); sheet.hidden=true;
    sheet.innerHTML='<div class="ndbsg" aria-hidden="true"><i></i></div><button type="button" class="ndbsx" aria-label="'+T('Κλείσιμο','Close')+'">✕</button><div class="ndbsb"></div>';
    document.body.appendChild(sheet); body=sheet.querySelector('.ndbsb');
    sheet.querySelector('.ndbsx').addEventListener('click',close);
    var g=sheet.querySelector('.ndbsg'), y0=null, h0=0, moved=false;
    g.addEventListener('pointerdown',function(e){ y0=e.clientY; h0=sheet.getBoundingClientRect().height; moved=false; sheet.style.transition='none'; try{ g.setPointerCapture(e.pointerId); }catch(x){} });
    g.addEventListener('pointermove',function(e){ if(y0==null) return; var dy=y0-e.clientY; if(Math.abs(dy)>3) moved=true; sheet.style.height=Math.max(60,Math.min(maxH(),h0+dy))+'px'; });
    function end(){ if(y0==null) return; y0=null; sheet.style.transition=''; var h=sheet.getBoundingClientRect().height, mx=maxH(), pk=peekH();
      if(!moved){ sheet.style.height=(h>pk+30?pk:mx)+'px'; return; }
      if(h<pk*0.55){ close(); return; } sheet.style.height=((Math.abs(h-mx)<Math.abs(h-pk))?mx:pk)+'px'; }
    g.addEventListener('pointerup',end); g.addEventListener('pointercancel',end);
    body.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('button,a'); if(!b||b.tagName==='A') return; setTimeout(function(){ if(!body.querySelector('.pdepth')||true) close(); },80); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!sheet.hidden) close(); });
    var nav=document.querySelector('nav.tabs'); if(nav) nav.addEventListener('click',close);
    window.addEventListener('resize',function(){ if(!sheet.hidden) sheet.style.height=Math.min(sheet.getBoundingClientRect().height,maxH())+'px'; });
  }
  function open(nodes){
    if(!sheet) build();
    body.replaceChildren.apply(body,nodes);
    sheet.hidden=false; sheet.style.height=''; sheet.style.maxHeight=peekH()+'px';
    var nat=sheet.getBoundingClientRect().height; sheet.style.maxHeight=''; sheet.style.height=Math.min(peekH(),Math.max(160,nat))+'px';
    document.body.classList.add('ndbsopen'); body.scrollTop=0;
  }
  function close(){ if(!sheet||sheet.hidden) return; sheet.hidden=true; body.replaceChildren(); document.body.classList.remove('ndbsopen'); }
  function wire(){
    if(wired) return; try{ map=C.map&&C.map(); }catch(e){ map=null; } if(!map) return; wired=true;
    map.on('popupopen',function(e){
      if(!isNarrow()) return; var pu=e.popup, el=pu&&pu.getElement&&pu.getElement(); if(!el) return;
      var ct=el.querySelector('.leaflet-popup-content'); if(!ct||!ct.childNodes.length) return;
      if(pu.options&&pu.options.className&&/nobs/.test(pu.options.className)) return;
      setTimeout(function(){
        if(!ct.childNodes.length) return;
        var nodes=[].slice.call(ct.childNodes); open(nodes);
        try{ map.closePopup(pu); }catch(x){}
      },30);
    });
    map.on('click',function(){ if(sheet&&!sheet.hidden&&!document.body.classList.contains('ndbsjust')) {} });
  }
  var tries=0, iv=setInterval(function(){ tries++; wire(); if(wired||tries>40) clearInterval(iv); },500);
  window.PsaroSheet={open:open,close:close};
})();
})();
