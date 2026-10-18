/* Προφίλ: κύρια όψη με στατιστικά (28 ημέρες / έτος / όλα) και κουμπί ρυθμίσεων (⚙) που ανοίγει τις παλιές ρυθμίσεις. */
(function(){
'use strict';
var C=window.PsaroCore, $=function(i){ return document.getElementById(i); }; if(!C||!$('pMain')) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var range=C.lsGet('psaro-prange','28');
function showSet(on){ $('pMain').hidden=on; $('pSettings').hidden=!on; try{ $('profile').scrollTop=0; }catch(e){} }
function hrs(ms){ return Math.round(ms/360000)/10; }
function draw(){
  var box=$('pStats'); if(!box) return; box.replaceChildren();
  Array.prototype.forEach.call(document.querySelectorAll('#pRange button'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.r===range)); });
  var now=C.nicosiaToday(), y=+now.slice(0,4), lim=null;
  if(range==='28'){ var d=new Date(Date.now()-27*86400000+C.utcMin()*60000); lim=d.toISOString().slice(0,10); }
  else if(range==='year') lim=y+'-01-01';
  var inR=function(x){ return !lim||((x.date||'')>=lim); };
  var bites=(C.Store.get('bites')||[]).filter(inR), trips=(C.Store.get('trips')||[]).filter(inR);
  var days={}; bites.forEach(function(b){ if(b.date) days[b.date]=1; }); trips.forEach(function(t){ if(t.date) days[t.date]=1; });
  var ms=0; trips.forEach(function(t){ if(t.startMs&&t.endMs) ms+=Math.max(0,t.endMs-t.startMs-(t.pauseMs||0)); });
  var kg=0, big=0, bigS='', sp={}; bites.forEach(function(b){ var w=+b.kg||0; kg+=w; if(w>big){ big=w; bigS=b.species||''; } if(b.species) sp[b.species]=1; });
  var tiles=[
    ['🐟',bites.length,T('Ψάρια','Fish')],['🎣',trips.length,T('Έξοδοι','Trips')],['📅',Object.keys(days).length,T('Μέρες ψαρέματος','Days fishing')],
    ['⏱',ms?hrs(ms)+' h':'–',T('Ώρες στη θάλασσα','Hours at sea')],['⚖',Math.round(kg*10)/10+' kg',T('Συνολικό βάρος','Total weight')],['🐠',Object.keys(sp).length,T('Είδη','Species')]
  ];
  tiles.forEach(function(t){ var d=document.createElement('div'); d.className='pst'; var i=document.createElement('i'); i.textContent=t[0]; var b=document.createElement('b'); b.textContent=String(t[1]); var s=document.createElement('span'); s.textContent=t[2]; d.append(i,b,s); box.append(d); });
  if(big>0){ var r=document.createElement('div'); r.className='pst pwide'; r.textContent='🏆 '+T('Μεγαλύτερο ψάρι: ','Biggest fish: ')+big+' kg'+(bigS?' · '+bigS:''); box.append(r); }
}
document.querySelectorAll('#pRange button').forEach(function(b){ b.addEventListener('click',function(){ range=b.dataset.r; C.lsSet('psaro-prange',range); draw(); }); });
$('pOpenSet').addEventListener('click',function(){ showSet(true); });
$('pBackMain').addEventListener('click',function(){ showSet(false); draw(); });
var gear=document.createElement('button'); gear.type='button'; gear.className='btn ghost sm'; gear.id='pGear'; gear.textContent='⚙'; gear.setAttribute('aria-label',T('Ρυθμίσεις','Settings'));
gear.addEventListener('click',function(){ showSet(true); });
var cl=$('pClose'); cl.parentNode.insertBefore(gear,cl); gear.style.marginLeft='auto'; cl.style.marginLeft='0';
var wantSet=false;
$('sfGoProf').addEventListener('click',function(){ wantSet=true; },true);
$('profBtn').addEventListener('click',function(){ showSet(wantSet); wantSet=false; draw(); });
draw();
})();
