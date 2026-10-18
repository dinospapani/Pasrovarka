/* Ενιαίο παράθυρο επιβεβαίωσης της εφαρμογής (αντί για το παράθυρο του browser). window.PsaroAsk(μήνυμα, {title, ok, cancel, danger}) → Promise<boolean> */
(function(){
'use strict';
var EN=window.LANG==='en';
var root=null, busy=null;
function build(){
  root=document.createElement('div'); root.className='askov'; root.hidden=true; root.setAttribute('role','alertdialog'); root.setAttribute('aria-modal','true');
  root.innerHTML='<div class="askbox"><div class="asktitle"></div><div class="asktext"></div><div class="askbtns"><button type="button" class="btn ghost askno"></button><button type="button" class="btn askyes"></button></div></div>';
  document.body.appendChild(root);
}
function ask(msg,o){
  o=o||{}; if(!root) build();
  if(busy){ busy(false); busy=null; }
  return new Promise(function(res){
    var t=root.querySelector('.asktitle'), x=root.querySelector('.asktext'), y=root.querySelector('.askyes'), n=root.querySelector('.askno');
    t.textContent=o.title||'BiteCast'; x.textContent=msg; x.style.whiteSpace='pre-line';
    y.textContent=o.ok||(EN?'OK':'Εντάξει'); n.textContent=o.cancel||(EN?'Cancel':'Άκυρο');
    y.className='btn askyes'+(o.danger?' danger':' acc'); n.hidden=(o.cancel===false);
    function done(v){ root.hidden=true; busy=null; y.onclick=n.onclick=root.onclick=null; document.removeEventListener('keydown',kd); res(v); }
    function kd(e){ if(e.key==='Escape') done(false); }
    busy=done; y.onclick=function(){ done(true); }; n.onclick=function(){ done(false); };
    root.onclick=function(e){ if(e.target===root) done(false); };
    document.addEventListener('keydown',kd);
    root.hidden=false; try{ (o.danger?n:y).focus(); }catch(e){}
  });
}
window.PsaroAsk=ask;
})();
