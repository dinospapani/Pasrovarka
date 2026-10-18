/* Κουμπιά εξόδου στον χάρτη: πράσινο ψάρι = έπιασα, κόκκινο ψάρι = τσίμπησε και χάθηκε.
   Παρατεταμένο πάτημα = διαγραφή του τελευταίου. Το κουμπί Έξοδος γίνεται «Τέλος εξόδου» και δίπλα εμφανίζεται το SOS. */
(function(){
'use strict';
var C=window.PsaroCore, box=document.querySelector('.mapbox'); if(!C||!box||!window.PsaroTrip) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var $=function(i){ return document.getElementById(i); };
function buzz(){ try{ if(navigator.vibrate) navigator.vibrate(25); }catch(e){} }
var FB='<path d="M3 12C8 4.5 17 4 22 12c-5 8-14 7.5-19 0z"/><path d="M22 12l7-6.5v13z"/>';
var FISH='<svg viewBox="0 0 32 24" aria-hidden="true" fill="currentColor" stroke="none">'+FB+'<circle cx="9" cy="10.3" r="1.5" fill="#2e9e7e"/></svg>';
var MISS='<svg viewBox="0 0 32 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">'+FB+'<circle cx="9" cy="10.3" r="1.1" fill="currentColor" stroke="none"/><path d="M5 22L27 2" stroke-width="2.6"/></svg>';
var wrap=document.createElement('div'); wrap.className='fishbtns'; wrap.id='fishBtns'; wrap.hidden=true;
function mk(id,cls,svg,label){
  var b=document.createElement('button'); b.type='button'; b.id=id; b.className='fb '+cls; b.setAttribute('aria-label',label);
  b.innerHTML=svg+'<b id="'+id+'N">0</b>'; return b;
}
var bc=mk('fbCatch','fbc',FISH,T('Έπιασα ψάρι (κράτα για διαγραφή του τελευταίου)','Caught a fish (hold to delete the last one)'));
var bm=mk('fbMiss','fbm',MISS,T('Τσίμπησε αλλά χάθηκε (κράτα για διαγραφή του τελευταίου)','Bite but lost (hold to delete the last one)'));
wrap.append(bm,bc); box.appendChild(wrap);

function upd(){
  var s=window.PsaroTrip.state(), on=!!(s&&s.active); wrap.hidden=!on;
  if(!on) return;
  var c=window.PsaroTrip.counts(); $('fbCatchN').textContent=c.n; $('fbMissN').textContent=c.miss;
}
function lastOf(list,startMs){
  var best=null;
  list.forEach(function(b){ if(!b.date||!b.time) return; if((b._u||0)<startMs) return; if(!best||(b._u||0)>(best._u||0)) best=b; });
  return best;
}
function del(miss){
  var s=window.PsaroTrip.state(), list=miss?C.Store.misses():C.Store.get('bites'), b=lastOf(list,s.start||0);
  if(!b){ C.toast(T('Δεν υπάρχει καταγραφή σε αυτή την έξοδο.','Nothing logged on this trip yet.')); return; }
  var msg=miss?T('Να διαγραφεί η τελευταία αστοχία;','Delete the last miss?'):T('Να διαγραφεί το τελευταίο ψάρι','Delete the last fish')+(b.species?' ('+b.species+(b.kg?' '+b.kg+' kg':'')+')':'')+'?';
  window.PsaroAsk(msg,{title:miss?T('Διαγραφή αστοχίας','Delete miss'):T('Διαγραφή ψαριού','Delete fish'),ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel'),danger:true}).then(function(ok){ if(!ok) return; C.Store.remove('bites',b.id).then(function(){ C.toast(T('Διαγράφηκε.','Deleted.')); upd(); }); });
  /* οι φωτογραφίες του ψαριού διαγράφονται από τον ίδιο μηχανισμό του Ημερολογίου, αν υπήρχαν */
}
function press(btn,miss){
  var t=null, held=false;
  btn.addEventListener('pointerdown',function(){ held=false; clearTimeout(t); t=setTimeout(function(){ held=true; buzz(); del(miss); },500); });
  ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ btn.addEventListener(ev,function(){ clearTimeout(t); }); });
  btn.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  btn.addEventListener('click',function(){ if(held){ held=false; return; } buzz(); if(miss) C.quickMiss(); else $('fab').click(); });
}
press(bc,false); press(bm,true);

/* Κουμπί εξόδου: πάτημα = τέλος εξόδου (με επιβεβαίωση), παρατεταμένο = λεπτομέρειες/παράταση */
var tb=$('tripBtn'), lt=null, lheld=false;
tb.addEventListener('pointerdown',function(){ lheld=false; clearTimeout(lt); if(!window.PsaroTrip.state().active) return; lt=setTimeout(function(){ lheld=true; buzz(); window.PsaroTrip.sheet(); },450); });
['pointerup','pointerleave','pointercancel'].forEach(function(ev){ tb.addEventListener(ev,function(){ clearTimeout(lt); }); });
tb.addEventListener('click',function(e){
  if(lheld){ lheld=false; e.stopImmediatePropagation(); return; }
  if(window.PsaroTrip.state().active){
    e.stopImmediatePropagation();
    window.PsaroAsk(T('Να τελειώσει η έξοδος;\n\nΚράτα πατημένο το κουμπί για λεπτομέρειες ή παράταση ώρας.','End this trip?\n\nHold the button for details or to extend the return time.'),{title:T('Τέλος εξόδου','End trip'),ok:T('Τέλος εξόδου','End trip'),cancel:T('Συνέχεια','Keep going')}).then(function(ok){ if(ok) window.PsaroTrip.back(); });
  }
},true);
tb.addEventListener('contextmenu',function(e){ e.preventDefault(); });
$('sosBtn').addEventListener('click',function(){ window.PsaroTrip.sos(); });

window.addEventListener('psaro-sess',upd);
C.Store.on('bites',upd);
setInterval(upd,20000);
upd();
})();
