/* BiteCast 4 · κέλυφος: καρτέλες, πλοήγηση με #, κάτω μπάρα. Κάθε σελίδα δηλώνεται με BC.view(όνομα,{mount,unmount,resume}). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T;
var VIEWS={}, cur=null, main=null;
B.view=function(name,def){ VIEWS[name]=def; };

/* σελίδες που δεν έχουν ξαναχτιστεί ακόμα: ανοίγουν στην κλασική έκδοση */
var SOON={
  map:{title:T('Χάρτης','Map'),q:'?a=map',p:T('Ο χάρτης, η έναρξη εξόδου και τα εργαλεία ασφαλείας ξαναχτίζονται. Μέχρι τότε δουλεύουν κανονικά στην κλασική έκδοση, με τα ίδια δεδομένα.','The map, trips and safety tools are being rebuilt. Until then they work as usual in the classic version, with the same data.')}
};
Object.keys(SOON).forEach(function(k){ var o=SOON[k];
  B.view(k,{mount:function(el){ el.replaceChildren(h('div',{class:'page'},h('div',{class:'top'},h('h1',{class:'lt',text:o.title})),
    h('div',{class:'soon'},h('h2',{text:T('Σύντομα εδώ','Coming here soon')}),h('p',{text:o.p}),h('a',{class:'btn pri full',href:B.classic(o.q),text:T('Άνοιγμα στην κλασική έκδοση','Open in the classic version')})))); }}); });

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
