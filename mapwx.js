/* Κάρτα καιρού πάνω στον χάρτη, με επιλογή στοιχείων (πατάς την κάρτα για να διαλέξεις τι θα φαίνεται). */
(function(){
'use strict';
var C=window.PsaroCore, box=document.querySelector('.mapbox'); if(!C||!box) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='psaro-mapwx-items', DEF=['wind','press','sst'];
var TR={fast:'↓↓',slow:'↓',stable:'→',rise:'↑'};
var DIRS=['N','NE','E','SE','S','SW','W','NW'];
var ITEMS=[
  ['wind','➤',T('Άνεμος','Wind'),function(c){ if(c.wind==null) return null; var d=c.windDeg!=null?DIRS[Math.round((((c.windDeg%360)+360)%360)/45)%8]:''; return [c.wind+'',('kn '+d).trim()]; }],
  ['press','☁',T('Πίεση','Pressure'),function(c){ return c.press!=null?[c.press+'','hPa '+(TR[c.ptrend]||'')]:null; }],
  ['sst','🌊',T('Θερμ. νερού','Water temp'),function(c){ return c.sst!=null?[Math.round(c.sst)+'°',T('θάλασσα','sea')]:null; }],
  ['air','🌡',T('Θερμ. αέρα','Air temp'),function(c){ return c.temp!=null?[Math.round(c.temp)+'°',T('αέρας','air')]:null; }],
  ['wave','〰',T('Κύμα','Wave'),function(c){ return c.wave!=null?[c.wave.toFixed(1),T('κύμα m','wave m')]:null; }],
  ['period','⏱',T('Περίοδος κύματος','Wave period'),function(c){ return c.wavePeriod?[Math.round(c.wavePeriod)+'',T('δευτ.','sec')]:null; }]
];
var el=document.createElement('div'); el.className='mapwx'; el.hidden=true; box.appendChild(el);
var editing=false;
function sel(){ var v=C.lsGet(KEY,null); return Array.isArray(v)?v:DEF.slice(); }
function draw(){
  var c=C.getCond(); if(!c){ el.hidden=true; return; }
  var on=sel(); el.hidden=false; el.replaceChildren(); el.classList.toggle('edit',editing);
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
