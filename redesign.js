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
})();
