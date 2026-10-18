/* Κάρτα καιρού πάνω στον χάρτη, με επιλογή στοιχείων (πατάς την κάρτα για να διαλέξεις τι θα φαίνεται). */
(function(){
'use strict';
var C=window.PsaroCore, box=document.querySelector('.mapbox'); if(!C||!box) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='psaro-mapwx-items', DEF=['wind','press','sst'];
var TR={fast:'↓↓',slow:'↓',stable:'→',rise:'↑'};
var DIRS=['N','NE','E','SE','S','SW','W','NW'];
var ITEMS=[
  ['wind','➤',T('Άνεμος','Wind'),function(c){ if(c.wind==null) return null; var wp=window.PsaroUnits.windP(c.wind), d=c.windDeg!=null?DIRS[Math.round((((c.windDeg%360)+360)%360)/45)%8]:''; return [wp[0],(wp[1]+' '+d).trim()]; }],
  ['press','☁',T('Πίεση','Pressure'),function(c){ if(c.press==null) return null; var pp=window.PsaroUnits.pressP(c.press); return [pp[0],pp[1]+' '+(TR[c.ptrend]||'')]; }],
  ['sst','🌊',T('Θερμ. νερού','Water temp'),function(c){ if(c.sst==null) return null; var t=window.PsaroUnits.tempP(c.sst); return [t[0]+'°',T('θάλασσα','sea')]; }],
  ['air','🌡',T('Θερμ. αέρα','Air temp'),function(c){ if(c.temp==null) return null; var t=window.PsaroUnits.tempP(c.temp); return [t[0]+'°',T('αέρας','air')]; }],
  ['wave','〰',T('Κύμα','Wave'),function(c){ if(c.wave==null) return null; var wv=window.PsaroUnits.waveP(c.wave); return [wv[0],T('κύμα ','wave ')+wv[1]]; }],
  ['period','⏱',T('Περίοδος κύματος','Wave period'),function(c){ return c.wavePeriod?[Math.round(c.wavePeriod)+'',T('δευτ.','sec')]:null; }]
];
var el=document.createElement('div'); el.className='mapwx'; el.hidden=true; box.appendChild(el);
var editing=false;
function sel(){ var v=C.lsGet(KEY,null); return Array.isArray(v)?v:DEF.slice(); }
function draw(){
  var c=C.getCond(); if(!c){ el.hidden=true; document.body.classList.remove('hasmw'); return; }
  var on=sel(); el.hidden=false; document.body.classList.add('hasmw'); el.replaceChildren(); el.classList.toggle('edit',editing);
  var row=document.createElement('div'); row.className='mwrow';
  ITEMS.forEach(function(it){
    if(on.indexOf(it[0])<0) return;
    var v=it[3](c), d=document.createElement('div'); d.className='mw';
    var i=document.createElement('i'); i.textContent=it[1]; var b=document.createElement('b'); b.textContent=v?v[0]:'–'; var s=document.createElement('span'); s.textContent=v?v[1]:it[2];
    d.append(i,b,s); row.append(d);
  });
  if(!row.childNodes.length){ var m=document.createElement('span'); m.className='mwempty'; m.textContent=T('Πάτα για να διαλέξεις στοιχεία','Tap to choose items'); row.append(m); }
  var g=document.createElement('button'); g.type='button'; g.className='mwgear'; g.textContent=editing?'✓':'⚙'; g.setAttribute('aria-label',T('Επιλογή στοιχείων καιρού','Choose weather items'));
  row.append(g); el.append(row);
  if(editing){
    var ch=document.createElement('div'); ch.className='mwchips';
    ITEMS.forEach(function(it){
      var b=document.createElement('button'); b.type='button'; b.className='mwchip'; b.setAttribute('aria-pressed',String(on.indexOf(it[0])>=0)); b.textContent=it[1]+' '+it[2];
      b.addEventListener('click',function(e){ e.stopPropagation(); var cur=sel(), i=cur.indexOf(it[0]); if(i>=0) cur.splice(i,1); else cur.push(it[0]); cur=ITEMS.map(function(x){ return x[0]; }).filter(function(k){ return cur.indexOf(k)>=0; }); C.lsSet(KEY,cur); draw(); });
      ch.append(b);
    });
    el.append(ch);
  }
}
el.addEventListener('click',function(){ editing=!editing; draw(); });
document.addEventListener('psaro-cond',function(){ setTimeout(draw,50); });
function place(){
  var sb=document.getElementById('sessBar'), full=document.body.classList.contains('mapfull');
  el.style.top=(sb&&full&&sb.offsetParent!==null)?Math.round(sb.getBoundingClientRect().bottom+8)+'px':'';
}
setInterval(place,500);
setTimeout(draw,800); setTimeout(draw,3500);
})();

/* Παράθυρο πληροφοριών: κεντράρεται και φαίνεται ολόκληρο (και το ψάρι από κάτω) ανάμεσα στην κάρτα καιρού και τα κουμπιά */
(function(){
var Cc=window.PsaroCore, map=Cc&&Cc.map&&Cc.map(); if(!map) return;
function fit(p){
  var el=p&&p.getElement&&p.getElement(); if(!el||!p._map) return;
  var mr=map.getContainer().getBoundingClientRect(), r=el.getBoundingClientRect();
  var topLim=mr.top+64, botLim=mr.bottom-70-38; /* χώρος για το εικονίδιο κάτω από το popup και τη γραμμή αναφορών */
  var dx=(mr.left+(112+(mr.width-58))/2)-(r.left+r.width/2), dy=0;
  if(r.bottom>botLim) dy=botLim-r.bottom;
  if(r.top+dy<topLim) dy=topLim-r.top;
  if(Math.abs(dx)>1||Math.abs(dy)>1) map.panBy([-dx,-dy],{animate:true,duration:.3});
}
map.on('popupopen',function(e){
  var p=e.popup; setTimeout(function(){ fit(p); },40);
  var im=p.getElement&&p.getElement()&&p.getElement().querySelector('img');
  if(im&&!im.complete) im.addEventListener('load',function(){ fit(p); },{once:true});
});
})();
