/* Νέα εμφάνιση: τα κουμπιά του χάρτη μαζεύονται σε 4 κουμπιά (Στρώματα, Ενέργειες, Ασφάλεια, Θέση μου) με φύλλα.
   Δεν αλλάζει λογική: μετακινεί τα ίδια τα υπάρχοντα κουμπιά, με τους ίδιους χειριστές.
   Διακόπτης: Προφίλ → Ρυθμίσεις → Εμφάνιση (κλειδί psaro-ui: new ή old). */
(function(){
'use strict';
var C=window.PsaroCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, KEY='psaro-ui';
var mode=C.lsGet(KEY,'new')==='old'?'old':'new';
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
addSwitch();
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
  var lab=b.getAttribute('aria-label')||b.title||b.id; b.dataset.nd=lab;
  lists[groupOf(b.id)].append(b);
}
Array.prototype.slice.call(mb.querySelectorAll('.mbtn')).forEach(adopt);
new MutationObserver(function(ms){ ms.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes,adopt); }); }).observe(mb,{childList:true});

/* η δεξιά μπάρα: 4 κουμπιά */
var bar=el('div','ndbar'); bar.setAttribute('role','group'); bar.setAttribute('aria-label',T('Εργαλεία χάρτη','Map tools'));
function nb(label,icon,fn){ var b=el('button','ndb'); b.type='button'; b.innerHTML=icon+'<span></span>'; b.lastChild.textContent=label; b.addEventListener('click',fn); bar.append(b); return b; }
nb(T('Στρώματα','Layers'),IC.layers,function(){ open('layers'); });
nb(T('Ενέργειες','Actions'),IC.actions,function(){ open('actions'); });
nb(T('Ασφάλεια','Safety'),IC.safety,function(){ open('safety'); });
nb(T('Θέση μου','My position'),IC.me,function(){ var l=$('bLoc'); if(l) l.click(); });
/* NU/CU/HU: ο προσανατολισμός του χάρτη ως εργαλείο της μπάρας (μόνο κατά την έξοδο), χρησιμοποιεί το ίδιο κουμπί #bOrient */
var orb=nb('NU',SVG+'<circle cx="12" cy="12" r="8.500"/><path d="m15.500 8.500-2 5-5 2 2-5z"/></svg>',function(){ var x=$('bOrient'); if(x) x.click(); });
orb.classList.add('ndorient'); orb.setAttribute('aria-label',T('Προσανατολισμός χάρτη','Map orientation'));
function orUpd(){ var x=$('bOrient'); if(!x) return; var m=x.textContent||'NU'; if(orb.lastChild.textContent!==m) orb.lastChild.textContent=m; orb.classList.toggle('on',x.classList.contains('on')); orb.title=x.title||''; }
setInterval(orUpd,400); orUpd();
/* MOB και SOS μέσα στη μπάρα (μόνο κατά την έξοδο): χρησιμοποιούν τα ίδια κουμπιά και τις ίδιες λειτουργίες με πριν */
var sosb=nb('SOS',SVG+'<path d="M12 3.500 21.500 20h-19z"/><path d="M12 10v4.500M12 17.300v.01"/></svg>',function(){ var x=$('sosBtn'); if(x) x.click(); });
sosb.classList.add('ndsos'); sosb.setAttribute('aria-label',T('SOS: ειδοποίηση κινδύνου','SOS: distress alert')); bar.insertBefore(sosb,bar.firstChild);
var mobb=nb('MOB',SVG+'<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3.500"/><path d="M6 6l3.500 3.500M14.500 14.500 18 18M18 6l-3.500 3.500M9.500 14.500 6 18"/></svg>',function(){});
mobb.classList.add('ndmob'); mobb.setAttribute('aria-label',T('Άνθρωπος στη θάλασσα (MOB)','Man overboard (MOB)')); bar.insertBefore(mobb,bar.firstChild);
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
box.insertBefore(bar,mb.nextSibling);

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
  }
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
  foot.append(shop); card.append(top,bars,lab,foot); box.append(card);
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
    var day=c.day, sc=Math.max(1,Math.min(10,Math.round(day/10)));
    rn.textContent=String(sc); shn.textContent=String(sc); ring.querySelector('.ndr1').style.strokeDasharray=(2*Math.PI*23*sc/10).toFixed(1)+' 999';
    h1.textContent=day>=75?T('Πολύ καλό δάγκωμα','Very good bite'):day>=60?T('Καλό δάγκωμα','Good bite'):day>=45?T('Μέτριο δάγκωμα','Fair bite'):T('Αδύναμο δάγκωμα','Weak bite');
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
  setInterval(function(){ var on=document.body.classList.contains('ontrip')&&!card.hidden; document.documentElement.style.setProperty('--ndwx',on?Math.max(0,card.offsetHeight-34)+'px':'0px'); document.documentElement.style.setProperty('--ndtop',(on?card.offsetTop+card.offsetHeight+8:72)+'px'); },400);
  setInterval(function(){ box.style.setProperty('--ndch',(card.hidden||document.body.classList.contains('ontrip')?0:card.offsetHeight)+'px'); },400);
  setInterval(function(){ var m=box.querySelector('.mapwx'); if(m){ m.style.removeProperty('left'); m.style.removeProperty('top'); } },500);
})();

/* κόκκινο χρώμα στα κουμπιά «Διαγραφή» των καρτών */
(function(){ var q=0; function mark(){ q=0; document.querySelectorAll('.card .btn,.acts .btn').forEach(function(b){ var t=(b.textContent||'').trim(); if(t==='Διαγραφή'||t==='Delete') b.classList.add('ndel'); }); }
  new MutationObserver(function(){ if(!q) q=requestAnimationFrame(mark); }).observe(document.body,{childList:true,subtree:true}); mark(); })();
})();
