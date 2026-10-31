/* BiteCast 4 · κέλυφος: καρτέλες, πλοήγηση με #, κάτω μπάρα. Κάθε σελίδα δηλώνεται με BC.view(όνομα,{mount,unmount,resume}). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T;
var VIEWS={}, cur=null, main=null;
B.view=function(name,def){ VIEWS[name]=def; };

var TABS=[['forecast',T('Πρόγνωση','Forecast'),'forecast'],['map',T('Χάρτης','Map'),'map'],null,['log',T('Ημερολόγιο','Logbook'),'log'],['profile',T('Προφίλ','Profile'),'user']];
function nav(){
  var bar=h('div'); TABS.forEach(function(t){
    if(!t){ bar.append(h('button',{class:'fab',type:'button','aria-label':T('Νέο ψάρι','New catch'),html:B.iconSvg('plus'),onclick:function(){ if(B.biteForm) B.biteForm(); }})); return; }
    var a=h('a',{href:'#'+t[0],data:{v:t[0]}}); a.innerHTML=B.iconSvg(t[2]); a.append(h('span',{text:t[1]})); bar.append(a); });
  return h('nav',{class:'nav','aria-label':T('Κύρια πλοήγηση','Main navigation')},bar);
}
function route(){
  var name=(location.hash||'').slice(1)||'forecast'; if(!VIEWS[name]) name='forecast';
  [].forEach.call(document.querySelectorAll('.nav a[data-v]'),function(a){ if(a.dataset.v===name) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  if(cur===name) return;
  if(cur&&VIEWS[cur].unmount) VIEWS[cur].unmount();
  cur=name; main.replaceChildren(); window.scrollTo(0,0);
  VIEWS[name].mount(main);
  document.title=(VIEWS[name].title||'BiteCast')+' · BiteCast';
}
function start(){
  main=h('main',{class:'app',id:'main'});
  document.body.append(main,nav());
  window.addEventListener('hashchange',route);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&cur&&VIEWS[cur].resume) VIEWS[cur].resume(); });
  route();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(function(){});
}
B.start=start;
})();
