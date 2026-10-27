/* Χάρακας χάρτη: απόσταση από την ακτή (ή τη θέση σου) και βάθος στο σημείο και κατά μήκος της γραμμής.
   Βάθη: EMODnet (πλέγμα ~100 m, ενδεικτικά κοντά στην ακτή). Όχι ναυτικό όργανο. */
(function(){
'use strict';
var C=window.PsaroCore, mb=document.querySelector('.mapbtns'), L=window.L; if(!C||!mb||!L) return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var PU=window.PsaroUnits;
var btn=document.createElement('button'); btn.type='button'; btn.id='bRuler'; btn.className='mbtn'; btn.setAttribute('aria-pressed','false');
btn.setAttribute('aria-label',T('Χάρακας (απόσταση και βάθος)','Ruler (distance and depth)')); btn.title=btn.getAttribute('aria-label');
btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>';
mb.appendChild(btn);

var on=false, A=null, B=null, line=null, mA=null, mB=null, panel=null, hint=null, seq=0, tmr=null;
function dist(a,b){ var R=6371000, r=Math.PI/180, dl=(b.lat-a.lat)*r, dn=(b.lng-a.lng)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.sqrt(x)); }
function fmtD(m){ if(PU&&PU.dist) { try{ return PU.dist(m/1000); }catch(e){} } return m<1000?Math.round(m)+' m':(m/1000).toFixed(2)+' km'; }
function dot(color){ return L.divIcon({className:'',html:'<div style="width:20px;height:20px;border-radius:50%;background:'+color+';border:3px solid #fff;box-shadow:0 1px 6px #0007"></div>',iconSize:[20,20],iconAnchor:[10,10]}); }
function ensurePanel(){
  if(panel) return panel;
  panel=document.createElement('div'); panel.id='ndRuler'; panel.setAttribute('role','status');
  panel.style.cssText='position:fixed;left:10px;right:10px;bottom:calc(var(--navh,64px) + 14px);z-index:900;background:var(--card,var(--bg,#fff));color:var(--ink,#111);border:1px solid var(--line,#8884);border-radius:16px;padding:12px 14px;box-shadow:0 8px 28px #0006;max-height:36vh;overflow:auto';
  document.body.appendChild(panel); return panel;
}
function say(){
  var p=ensurePanel(); p.replaceChildren();
  function row(){ var d=document.createElement('div'); d.style.cssText='display:flex;gap:8px;align-items:center;justify-content:space-between'; return d; }
  var top=row(), b1=document.createElement('b'); b1.textContent=T('Χάρακας','Ruler'); var x=document.createElement('button'); x.type='button'; x.className='btn ghost sm'; x.textContent='✕'; x.setAttribute('aria-label',T('Κλείσιμο','Close')); x.addEventListener('click',function(){ stop(); });
  top.append(b1,x); p.append(top);
  var t=document.createElement('p'); t.className='note'; t.style.margin='6px 0';
  if(!A){ t.textContent=T('Πάτα στον χάρτη το σημείο εκκίνησης (π.χ. την ακτή), ή χρησιμοποίησε τη θέση σου.','Tap the start point on the map (e.g. the shoreline), or use your position.'); p.append(t);
    var mine=document.createElement('button'); mine.type='button'; mine.className='btn sm'; mine.textContent=T('Αρχή = η θέση μου','Start = my position'); mine.addEventListener('click',useMe); p.append(mine); return; }
  if(!B){ t.textContent=T('Τώρα πάτα το δεύτερο σημείο (προς τη θάλασσα). Μπορείς μετά να το σύρεις.','Now tap the second point (out to sea). You can drag it afterwards.'); p.append(t); return; }
  var d=dist(A,B), big=document.createElement('div'); big.style.cssText='font-size:26px;font-weight:700;margin:4px 0'; big.textContent=fmtD(d); p.append(big);
  var dep=document.createElement('div'); dep.id='ndRulD'; dep.textContent=T('Βάθος στο σημείο: …','Depth at the point: …'); p.append(dep);
  var prof=document.createElement('div'); prof.id='ndRulP'; prof.style.marginTop='8px'; p.append(prof);
  var nt=document.createElement('p'); nt.className='note'; nt.style.marginTop='8px'; nt.textContent=T('Τα βάθη είναι από το EMODnet (πλέγμα περίπου 100 m) και κοντά στην ακτή είναι πολύ ενδεικτικά. Δεν είναι ναυτικό όργανο.','Depths come from EMODnet (about 100 m grid) and are only indicative close to shore. Not a navigation instrument.'); p.append(nt);
  var r2=row(); r2.style.marginTop='6px'; var nw=document.createElement('button'); nw.type='button'; nw.className='btn ghost sm'; nw.textContent=T('Νέα μέτρηση','New measurement'); nw.addEventListener('click',function(){ clear(); say(); });
  r2.append(nw); p.append(r2);
  var id=++seq; profile(id);
}
function profile(id){
  var n=Math.max(2,Math.min(8,Math.round(dist(A,B)/100)||2)), pts=[];
  for(var i=1;i<=n;i++){ var f=i/n; pts.push({f:f,la:A.lat+(B.lat-A.lat)*f,lo:A.lng+(B.lng-A.lng)*f}); }
  var D=dist(A,B);
  Promise.all(pts.map(function(q){ return C.depthAt(q.la,q.lo).catch(function(){ return null; }); })).then(function(res){
    if(id!==seq) return;
    var dp=document.getElementById('ndRulD'), pr=document.getElementById('ndRulP'); if(!dp||!pr) return;
    var last=res[res.length-1];
    dp.textContent=T('Βάθος στο σημείο: ','Depth at the point: ')+(last!=null?'≈ '+last+' m':T('δεν βρέθηκε','not available'));
    var mx=Math.max.apply(null,res.map(function(v){ return v||0; }).concat([1]));
    pr.replaceChildren();
    res.forEach(function(v,i){
      var r=document.createElement('div'); r.style.cssText='display:flex;align-items:center;gap:8px;font-size:13px;padding:2px 0';
      var l=document.createElement('span'); l.style.cssText='width:64px;flex:none;color:var(--muted,#888)'; l.textContent=fmtD(D*pts[i].f);
      var bar=document.createElement('span'); bar.style.cssText='flex:1;height:8px;border-radius:4px;background:var(--line,#8883);position:relative;overflow:hidden';
      var fill=document.createElement('i'); fill.style.cssText='position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:var(--accent,#2a7);width:'+(v==null?0:Math.max(4,Math.round(v/mx*100)))+'%'; bar.append(fill);
      var t=document.createElement('span'); t.style.cssText='width:74px;flex:none;text-align:right;white-space:nowrap'; t.textContent=v==null?'–':'≈ '+v+' m';
      r.append(l,bar,t); pr.append(r);
    });
  });
}
function draw(){
  if(line){ map.removeLayer(line); line=null; }
  if(A&&B) line=L.polyline([A,B],{color:'#E8743B',weight:4,dashArray:'8 8'}).addTo(map);
}
function setA(ll){ A=ll; if(mA) map.removeLayer(mA); mA=L.marker(A,{icon:dot('#2a7de1'),draggable:true,zIndexOffset:2000}).addTo(map); mA.on('drag',function(e){ A=e.target.getLatLng(); draw(); }); mA.on('dragend',later); }
function setB(ll){ B=ll; if(mB) map.removeLayer(mB); mB=L.marker(B,{icon:dot('#E8743B'),draggable:true,zIndexOffset:2001}).addTo(map); mB.on('drag',function(e){ B=e.target.getLatLng(); draw(); }); mB.on('dragend',later); }
function later(){ clearTimeout(tmr); tmr=setTimeout(function(){ say(); },350); }
function clear(){ A=null; B=null; seq++; [mA,mB,line].forEach(function(l){ if(l) try{ map.removeLayer(l); }catch(e){} }); mA=mB=line=null; }
function useMe(){
  var p=C.getPosition?C.getPosition():Promise.reject();
  Promise.resolve(p).then(function(q){ if(!q) throw 0; setA(L.latLng(q.lat,q.lon)); map.panTo(A); say(); }).catch(function(){ C.toast(T('Δεν βρέθηκε η θέση σου.','Could not get your position.')); });
}
function onClick(e){
  if(e.target&&e.target.closest&&(e.target.closest('.mapbtns')||e.target.closest('#ndRuler')||e.target.closest('.leaflet-marker-icon')||e.target.closest('.ndbar')||e.target.closest('.ndsheet'))) return;
  e.stopPropagation(); e.preventDefault();
  var ll=map.mouseEventToLatLng(e);
  if(!A){ setA(ll); say(); }
  else if(!B){ setB(ll); draw(); say(); }
}
function start(){
  on=true; btn.setAttribute('aria-pressed','true'); clear(); map.getContainer().addEventListener('click',onClick,true); map.getContainer().style.cursor='crosshair'; say();
  try{ map.closePopup(); }catch(e){}
}
function stop(){
  on=false; btn.setAttribute('aria-pressed','false'); clear(); try{ map.getContainer().removeEventListener('click',onClick,true); }catch(e){} map.getContainer().style.cursor='';
  if(panel){ panel.remove(); panel=null; }
}
btn.addEventListener('click',function(){ if(on) stop(); else start(); });
window.PsaroRuler={start:start,stop:stop};
})();
