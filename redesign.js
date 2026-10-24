/* Νέα εμφάνιση: τα κουμπιά του χάρτη μαζεύονται σε 4 κουμπιά (Στρώματα, Ενέργειες, Ασφάλεια, Εγώ) με φύλλα.
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
var G={layers:['bLayer','bSea','bDepthMap','bZones','bNav','bDams','bHot'],actions:['bQuick','bGear','bSpotPick'],safety:['bTools']};
var TITLE={layers:T('Στρώματα','Layers'),actions:T('Ενέργειες','Actions'),safety:T('Ασφάλεια και θάλασσα','Safety and sea')};
var SUB={layers:T('Τι φαίνεται πάνω στο χάρτη','What shows on the map'),actions:T('Καταγραφή, εργαλεία και σημεία','Record, gear and spots'),safety:T('Λειτουργούν με GPS και ανοιχτή εφαρμογή. Δεν είναι ναυτικό όργανο.','Work with GPS and the app open. Not a navigation instrument.')};
function groupOf(id){ for(var k in G) if(G[k].indexOf(id)>=0) return k; return 'actions'; }

var sheet=el('div','ndsheet'); sheet.id='ndSheet'; sheet.hidden=true;
var back=el('div','ndback'), panel=el('div','ndpanel'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
var hand=el('span','ndhand'), head=el('div','ndhead'), ttl=el('h2',null,''), done=el('button','btn ghost sm',T('Τέλος','Done')); done.type='button';
var sub=el('p','note ndsub','');
head.append(ttl,done); panel.append(hand,head,sub);
var lists={};
Object.keys(G).forEach(function(g){ var l=el('div','ndlist'); l.dataset.g=g; l.hidden=true; lists[g]=l; panel.append(l); });
sheet.append(back,panel); document.body.append(sheet);

function open(g){
  Object.keys(lists).forEach(function(k){ lists[k].hidden=(k!==g); });
  ttl.textContent=TITLE[g]; sub.textContent=SUB[g]; panel.setAttribute('aria-label',TITLE[g]);
  sheet.hidden=false; try{ done.focus({preventScroll:true}); }catch(e){}
}
function close(){ sheet.hidden=true; }
back.addEventListener('click',close); done.addEventListener('click',close);
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!sheet.hidden) close(); });
Object.keys(lists).forEach(function(g){
  lists[g].addEventListener('click',function(e){ if(g!=='layers'&&e.target.closest&&e.target.closest('.mbtn,.ndrow')) setTimeout(close,0); });
});

/* ενέργειες που δεν ήταν κουμπιά του χάρτη: ίδιες συναρτήσεις με πριν */
function proxy(g,label,icon,fn,first){
  var b=el('button','ndrow'); b.type='button'; b.innerHTML=icon+'<span></span>'; b.lastChild.textContent=label; b.addEventListener('click',fn);
  if(first&&lists[g].firstChild) lists[g].insertBefore(b,lists[g].firstChild); else lists[g].append(b);
}
proxy('actions',T('Νέο ψάρι (φόρμα)','New fish (form)'),IC.fish,function(){ var f=$('fab'); if(f) f.click(); },false);
if(C.quickMiss) proxy('actions',T('Έχασα ψάρι','Lost a fish'),IC.miss,function(){ C.quickMiss(); },false);

var SHOP='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9"/><path d="M5.5 12v8h13v-8"/></svg>';
proxy('actions',T('Κοντινά μαγαζιά ψαρικής','Nearby fishing stores'),SHOP,function(){ var b=$('sShops'); if(b) b.click(); },false);

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
nb(T('Εγώ','Me'),IC.me,function(){ var l=$('bLoc'); if(l) l.click(); });
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
  sb.addEventListener('click',function(){ tab('fc'); setTimeout(function(){ var q=$('plQ'); if(q){ try{ q.focus(); }catch(e){} } },250); });
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
  var FR=5, TO=20;
  for(var h=FR;h<=TO;h++){ var bb=el('i'); bb.dataset.h=h; bars.append(bb); var lb=el('span',null,(h===6||h===12||h===18)?pad(h):''); lab.append(lb); }
  function draw(){
    var cc=C.getCond&&C.getCond(), c=null; try{ c=cc&&C.compute&&C.compute(); }catch(e){ c=null; }
    if(!c||!c.hours||c.day==null){ card.hidden=true; document.body.classList.remove('ndhascard'); return; }
    card.hidden=false; document.body.classList.add('ndhascard');
    var day=c.day, sc=Math.max(1,Math.min(10,Math.round(day/10)));
    rn.textContent=String(sc); ring.querySelector('.ndr1').style.strokeDasharray=(2*Math.PI*23*sc/10).toFixed(1)+' 999';
    h1.textContent=day>=75?T('Πολύ καλό δάγκωμα','Very good bite'):day>=60?T('Καλό δάγκωμα','Good bite'):day>=45?T('Μέτριο δάγκωμα','Fair bite'):T('Αδύναμο δάγκωμα','Weak bite');
    var mx=Math.max.apply(null,c.hours), thr=mx-6, gs=[], cur=null;
    c.hours.forEach(function(v,i){ if(v>=thr){ if(cur&&cur.e===i-1){ cur.e=i; if(v>cur.m) cur.m=v; } else { cur={s:i,e:i,m:v}; gs.push(cur); } } });
    gs.sort(function(a,b){ return b.m-a.m; });
    h2.textContent=gs.length?T('Καλύτερα ','Best ')+pad(gs[0].s)+':00–'+pad((gs[0].e+1)%24)+':00':'';
    Array.prototype.forEach.call(bars.children,function(b){ var v=c.hours[+b.dataset.h]||0; b.style.height=Math.max(8,Math.round(v/Math.max(mx,1)*100))+'%'; b.className=v>=thr?'hi':''; });
  }
  document.addEventListener('psaro-cond',function(){ setTimeout(draw,80); });
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
    function fl(){ cb.setAttribute('aria-label',document.body.classList.contains('ontrip')?T('Νέο ψάρι','New fish'):T('Ξεκίνα έξοδο για ψάρεμα','Start a fishing trip')); }
    fl(); new MutationObserver(fl).observe(document.body,{attributes:true,attributeFilter:['class']});
    cb.addEventListener('click',function(){
      if(document.body.classList.contains('ontrip')){ var f=$('fab'); if(f) f.click(); }
      else { var t=$('tripBtn'); if(t) t.click(); }
    });
    var logb=nav.querySelector('[data-tab="log"]'); nav.insertBefore(cb,logb||null);
  }
  setInterval(function(){ var m=box.querySelector('.mapwx'); if(m){ m.style.removeProperty('left'); m.style.removeProperty('top'); } },500);
})();
})();
