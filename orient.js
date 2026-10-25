/* Προσανατολισμός χάρτη: NU (βορράς πάνω), CU (πορεία GPS πάνω), HU (πυξίδα κινητού πάνω).
   Γυρίζει μόνο ο χάρτης (#lmap). Τα κουμπιά, τα ζουμ και οι κάρτες μένουν ακίνητα.
   Όσο ο χάρτης είναι γυρισμένος, ένα πάτημα πάνω του τον επιστρέφει προσωρινά σε NU (δεν εκτελεί την ενέργεια του πατήματος). */
(function(){
'use strict';
var C=window.PsaroCore, lm=document.getElementById('lmap'), box=lm&&lm.parentNode;
if(!C||!lm||!box||document.getElementById('bOrient')) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='psaro-orient', MODES=['NU','CU','HU'];
var mode=(function(){ var v=C.lsGet(KEY,'NU'); return MODES.indexOf(v)>=0?v:'NU'; })();
var head=null, comp=null, rot=0, shown=0, paused=0, swallowUntil=0, lastApply=0;
var NAMES={NU:T('Βορράς πάνω','North up'),CU:T('Πορεία πάνω (GPS)','Course up (GPS)'),HU:T('Πυξίδα πάνω (κινητό)','Heading up (phone compass)')};
function getMap(){ try{ return C.map?C.map():null; }catch(e){ return null; } }
function norm(a){ return ((a%360)+360)%360; }
function delta(a,b){ var d=norm(a-b); return d>180?d-360:d; }

/* Τα χειριστήρια του Leaflet (ζουμ, πηγές) βγαίνουν έξω από τον χάρτη που γυρίζει */
var ov=null;
function hoist(){
  if(ov) return; var cc=lm.querySelector('.leaflet-control-container'); if(!cc) return;
  ov=document.createElement('div'); ov.className='leaflet-container leaflet-touch mo-ctl'; ov.style.cssText='position:absolute;left:0;top:0;right:0;bottom:0;background:transparent;pointer-events:none;overflow:visible;z-index:700';
  ov.appendChild(cc); box.insertBefore(ov,lm.nextSibling);
}

/* Μέγεθος: ο γυρισμένος χάρτης είναι τετράγωνο με πλευρά τη διαγώνιο, ώστε να μη φαίνονται γωνίες */
function layout(on){
  var w=box.clientWidth, h=box.clientHeight;
  if(on){ var D=Math.ceil(Math.hypot(w,h))+4; lm.style.inset='auto'; lm.style.width=D+'px'; lm.style.height=D+'px'; lm.style.left=Math.round((w-D)/2)+'px'; lm.style.top=Math.round((h-D)/2)+'px'; lm.style.transformOrigin='50% 50%'; }
  else { lm.style.inset=''; lm.style.width=''; lm.style.height=''; lm.style.left=''; lm.style.top=''; lm.style.transform=''; lm.style.transformOrigin=''; }
  try{ var m=getMap(); if(m) m.invalidateSize({animate:false}); }catch(e){}
}
var isOn=false;
function setOn(on){
  if(on===isOn) return; isOn=on; hoist();
  box.classList.toggle('mrot',on); layout(on);
  lm.style.transition=on?'transform .35s linear':''; if(!on) shown=0;
}
function target(){
  if(Date.now()<paused) return null;
  if(mode==='CU') return head;
  if(mode==='HU') return comp!=null?comp:head;
  return null;
}
function apply(){
  var t=target();
  if(t==null){ if(isOn) setOn(false); lm.style.removeProperty('--mc'); updBtn(); return; }
  if(!isOn){ setOn(true); shown=-t; }
  var want=-t; shown+=delta(want,shown); /* συνεχής γωνία, χωρίς άλματα στο 360° */
  lm.style.transform='rotate('+shown.toFixed(1)+'deg)'; lm.style.setProperty('--mc',(-shown).toFixed(1)+'deg'); updBtn();
}
var btn=document.createElement('button'); btn.type='button'; btn.id='bOrient'; btn.className='mo-btn';
btn.addEventListener('click',function(){ setMode(MODES[(MODES.indexOf(mode)+1)%3],true); });
box.appendChild(btn);
function updBtn(){
  var rt=isOn&&Date.now()>=paused; btn.textContent=mode; btn.setAttribute('aria-label',T('Προσανατολισμός χάρτη: ','Map orientation: ')+NAMES[mode]); btn.title=NAMES[mode];
  btn.classList.toggle('on',mode!=='NU'); btn.classList.toggle('wait',mode!=='NU'&&!rt&&Date.now()>=paused);
}
function setMode(m,user){
  mode=m; C.lsSet(KEY,m); paused=0;
  if(m==='HU') startCompass();
  if(user){ var msg=NAMES[m]; if(m!=='NU'&&target()==null) msg+=' · '+T('περιμένει πορεία ή πυξίδα','waiting for course or compass'); C.toast(msg); }
  apply();
}

/* Πυξίδα κινητού */
var compOn=false;
function onOri(e){
  var h=null; if(typeof e.webkitCompassHeading==='number') h=e.webkitCompassHeading; else if(e.absolute&&typeof e.alpha==='number') h=360-e.alpha; else return;
  comp=(comp==null)?h:norm(comp+0.25*delta(h,comp)); /* απαλό φίλτρο */
  var now=Date.now(); if(mode==='HU'&&now-lastApply>200){ lastApply=now; apply(); }
}
function startCompass(){
  if(compOn) return; var DO=window.DeviceOrientationEvent;
  function go(){ compOn=true; window.addEventListener('deviceorientationabsolute',onOri,true); window.addEventListener('deviceorientation',onOri,true); }
  try{ if(DO&&typeof DO.requestPermission==='function'){ DO.requestPermission().then(function(r){ if(r==='granted') go(); else C.toast(T('Δεν δόθηκε άδεια πυξίδας.','Compass permission denied.')); }).catch(function(){}); } else go(); }catch(e){}
}
window.addEventListener('psaro-head',function(e){ var h=e.detail&&e.detail.head; if(h!=null){ head=h; } if(mode!=='NU') apply(); });

/* Πάτημα πάνω στον χάρτη όσο είναι γυρισμένος: γυρνά προσωρινά σε NU και δεν εκτελεί το πάτημα */
function swallow(e){
  if(!isOn&&Date.now()>=swallowUntil) return;
  if(!lm.contains(e.target)) return;
  if(e.type==='touchstart'||e.type==='mousedown'){ paused=Date.now()+20000; swallowUntil=Date.now()+900; apply(); setTimeout(apply,20100); }
  e.stopPropagation(); if(e.cancelable&&e.type==='click') e.preventDefault();
}
['mousedown','touchstart','click','dblclick','contextmenu','wheel'].forEach(function(t){ box.addEventListener(t,swallow,true); });
window.addEventListener('resize',function(){ if(isOn) layout(true); });
window.addEventListener('orientationchange',function(){ setTimeout(function(){ if(isOn) layout(true); },300); });

/* Δεν φορτώνει τίποτα ακόμα; ο χάρτης δημιουργείται από το app.js, οπότε περιμένουμε λίγο */
window.PsaroOrient={mode:function(){ return mode; }};
var tries=0; (function wait(){ if(getMap()||tries++>40){ hoist(); if(mode==='HU') startCompass(); apply(); updBtn(); } else setTimeout(wait,250); })();
})();
