/* Επιλογή εργαλείων χάρτη: το ⚙ στο τέλος της δεξιάς στήλης δείχνει/κρύβει κάθε κουμπί. */
(function(){
'use strict';
var C=window.PsaroCore, mb=document.querySelector('.mapbtns'); if(!C||!mb) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, KEY='psaro-toolsoff';
var off=C.lsGet(KEY,[]); if(!Array.isArray(off)) off=[];
var GEAR='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>';
var CHECK='<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
var cfg=document.createElement('button'); cfg.type='button'; cfg.id='bToolsCfg'; cfg.className='mbtn'; cfg.innerHTML=GEAR;
cfg.setAttribute('aria-label',T('Επιλογή εργαλείων','Choose tools')); cfg.title=cfg.getAttribute('aria-label'); mb.appendChild(cfg);
function tools(){ return Array.prototype.filter.call(mb.querySelectorAll('.mbtn'),function(b){ return b!==cfg&&b.id&&b.id!=='bQuick'; }); }
function apply(){ tools().forEach(function(b){ b.classList.toggle('tool-off',off.indexOf(b.id)>=0); }); }
var editing=false;
function setEdit(v){
  editing=v; document.body.classList.toggle('toolsedit',v); cfg.classList.toggle('on',v); cfg.innerHTML=v?CHECK:GEAR; cfg.setAttribute('aria-pressed',String(v));
  if(v) C.toast(T('Πάτα ένα εργαλείο για να το κρύψεις ή να το εμφανίσεις. Τέλος με ✓.','Tap a tool to hide or show it. Finish with ✓.'));
}
cfg.addEventListener('click',function(){ setEdit(!editing); });
mb.addEventListener('click',function(e){
  if(!editing) return; var b=e.target.closest&&e.target.closest('.mbtn'); if(!b||b===cfg||b.id==='bQuick') return;
  e.stopPropagation(); e.preventDefault();
  var i=off.indexOf(b.id); if(i>=0) off.splice(i,1); else off.push(b.id);
  C.lsSet(KEY,off); apply();
},true);
apply();
})();
