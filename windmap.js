/* Χάρτης ανέμου (κινούμενα σωματίδια, τύπου Windy): πλέγμα ανέμου από Open-Meteo για την περιοχή που βλέπεις,
   ωριαίο, 48 ώρες μπροστά. Ενδεικτικό (μοντέλο, χοντρό πλέγμα), όχι μέτρηση στο σημείο. */
(function(){
'use strict';
var C=window.PsaroCore, mb=document.querySelector('.mapbtns'), L=window.L; if(!C||!mb||!L) return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var btn=document.createElement('button'); btn.type='button'; btn.id='bWind'; btn.className='mbtn'; btn.setAttribute('aria-pressed','false');
btn.setAttribute('aria-label',T('Άνεμος στον χάρτη','Wind on the map')); btn.title=btn.getAttribute('aria-label');
btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8a3 3 0 1 1-3 3"/></svg>';
mb.appendChild(btn);
var N=11, MODELS=[['ecmwf_ifs025','ECMWF'],['icon_global','ICON'],['gfs_global','GFS']], SEL=0, nowIdx=0, stations=null, stLayer=null, stErr=null, grid=null, hours=[], hi=0, on=false, cv=null, ctx=null, panel=null, parts=[], raf=0, loadId=0, mvT=null, last=0;
var COLS=[[0,'#6c78d8'],[3,'#4f9fd8'],[7,'#3fc4a6'],[11,'#66d46a'],[16,'#c9dc4a'],[22,'#f2b134'],[28,'#ec6a3c'],[34,'#d6394f'],[41,'#a62a8a']];
function col(kn){ var c=COLS[0][1]; for(var i=0;i<COLS.length;i++){ if(kn>=COLS[i][0]) c=COLS[i][1]; } return c; }
function unit(){ try{ return window.PsaroUnits.wind(1)!==undefined; }catch(e){ return false; } }
function W(kn){ try{ return window.PsaroUnits.wind(kn); }catch(e){ return Math.round(kn)+' kn'; } }
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dn(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; }
function ensure(){
  if(cv) return;
  cv=document.createElement('canvas'); cv.id='ndWindCv'; cv.setAttribute('aria-hidden','true');
  cv.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:450';
  map.getContainer().appendChild(cv); ctx=cv.getContext('2d'); fit();
  panel=document.createElement('div'); panel.id='ndWindPanel'; panel.setAttribute('role','group'); panel.setAttribute('aria-label',T('Άνεμος','Wind'));
  panel.style.cssText='position:fixed;left:10px;right:10px;bottom:calc(var(--navh,64px) + 14px);z-index:900;background:var(--card,var(--bg,#fff));color:var(--ink,#111);border:1px solid var(--line,#8886);border-radius:14px;padding:10px 12px;box-shadow:0 4px 18px #0004;max-height:36vh;overflow:auto';
  document.body.appendChild(panel);
}
function fit(){ var s=map.getSize(), r=Math.min(window.devicePixelRatio||1,2); cv.width=s.x*r; cv.height=s.y*r; ctx.setTransform(r,0,0,r,0,0); }
function clear(){ if(ctx){ var s=map.getSize(); ctx.clearRect(0,0,s.x,s.y); } }
function drawPanel(msg){
  if(!panel) return; panel.replaceChildren();
  var top=document.createElement('div'); top.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:8px';
  var b=document.createElement('b'); b.textContent=T('Άνεμος','Wind'); var x=document.createElement('button'); x.type='button'; x.className='btn ghost sm'; x.textContent='✕'; x.setAttribute('aria-label',T('Κλείσιμο','Close')); x.addEventListener('click',stop); top.append(b,x); panel.append(top);
  var lab=document.createElement('div'); lab.id='ndWindLab'; lab.style.cssText='font-weight:600;margin:6px 0'; lab.setAttribute('aria-live','polite'); panel.append(lab);
  if(msg){ lab.textContent=msg; return; }
  var sl=document.createElement('input'); sl.type='range'; sl.min=0; sl.max=Math.max(0,hours.length-1); sl.value=hi; sl.style.width='100%'; sl.setAttribute('aria-label',T('Ώρα','Hour'));
  sl.addEventListener('input',function(){ hi=+sl.value; label(); seed(); }); panel.append(sl);
  var row=document.createElement('label'); row.className='f'; row.style.marginTop='6px'; row.append(document.createTextNode(T('Μοντέλο','Model')));
  var sel=document.createElement('select'); var opts=[[0,(grid&&grid.m.length>1?T('Μέσος όρος μοντέλων','Model average'):grid.m[0].name)]]; if(grid.m.length>1) grid.m.forEach(function(m,i){ opts.push([i+1,m.name]); });
  opts.forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; sel.append(op); }); sel.value=String(SEL); sel.addEventListener('change',function(){ SEL=+sel.value; label(); seed(); }); row.append(sel); panel.append(row);
  var lg=document.createElement('div'); lg.style.cssText='display:flex;height:8px;border-radius:4px;overflow:hidden;margin:8px 0 2px'; COLS.forEach(function(c){ var s=document.createElement('span'); s.style.cssText='flex:1;background:'+c[1]; lg.append(s); }); panel.append(lg);
  var lt=document.createElement('div'); lt.className='note'; lt.style.cssText='display:flex;justify-content:space-between;font-size:11px'; ['0','7','16','28','41+ kn'].forEach(function(t){ var s=document.createElement('span'); s.textContent=t; lt.append(s); }); panel.append(lt);
  var ag=document.createElement('div'); ag.id='ndWindAg'; ag.style.cssText='margin-top:8px;font-size:13px'; panel.append(ag);
  var st=document.createElement('div'); st.id='ndWindSt'; st.style.cssText='margin-top:8px;font-size:13px'; panel.append(st);
  var nt=document.createElement('p'); nt.className='note'; nt.style.marginTop='6px'; nt.textContent=T('Μοντέλα (Open-Meteo): ανάλυση περίπου 9–25 km, πλέγμα 11×11 για την περιοχή που βλέπεις. Ενδεικτικό: δεν δείχνει τοπικά φαινόμενα κοντά στην ακτή (π.χ. θαλάσσια αύρα). Οι μετρήσεις σταθμών είναι το μόνο πραγματικό στοιχείο.','Models (Open-Meteo): roughly 9–25 km resolution, 11×11 grid for the area in view. Indicative: it does not show local effects near the coast (e.g. sea breeze). Station observations are the only real measurements.'); panel.append(nt);
  label();
}
function label(){
  var el=document.getElementById('ndWindLab'); if(!el||!hours.length) return;
  var t=hours[hi], ms=Date.parse(t+'Z'), s;
  try{ s=new Date(ms).toLocaleString(EN?'en-GB':'el-GR',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Nicosia'}); }catch(e){ s=t.slice(11,16)+'Z'; }
  var c=map.getCenter(), v=sample(c.lat,c.lng);
  el.textContent=s+(v?' · '+T('κέντρο χάρτη: ','map centre: ')+dn(v.dir)+' '+W(v.sp):'');
  var ag=document.getElementById('ndWindAg'); if(ag){ var a=agree(c.lat,c.lng); ag.replaceChildren();
    if(!a){ ag.textContent=grid&&grid.m.length<2?T('Διαθέσιμο μόνο ένα μοντέλο: δεν μπορεί να μετρηθεί η διαφωνία.','Only one model available: agreement cannot be measured.'):''; }
    else{ var lvTxt=[T('Τα μοντέλα συμφωνούν','Models agree'),T('Μέτρια διαφωνία μοντέλων','Moderate disagreement'),T('Μεγάλη διαφωνία: χαμηλή βεβαιότητα','Large disagreement: low confidence')][a.lv];
      var bd=document.createElement('b'); bd.textContent=(a.lv===0?'✅ ':a.lv===1?'⚠️ ':'🔴 ')+lvTxt; ag.append(bd,document.createElement('br'));
      ag.append(document.createTextNode(a.vs.map(function(x){ return x.n+' '+dn(x.v.dir)+' '+W(x.v.sp); }).join(' · ')+' ('+T('διαφορά ','spread ')+Math.round(a.dsp)+' kn'+(a.dd?', '+Math.round(a.dd)+'°':'')+')')); } }
  var sd=document.getElementById('ndWindSt'); if(sd){ sd.replaceChildren(); var cp=compare();
    if(cp.length){ var b2=document.createElement('b'); b2.textContent=T('Μετρήσεις τώρα vs μοντέλο','Observed now vs model'); sd.append(b2); cp.forEach(function(x){ var d=document.createElement('div'); d.textContent=(x.st.id||'')+' '+(x.st.name||'')+': '+Math.round(x.st.spd)+' kn '+T('μετρήθηκαν','observed')+' · '+Math.round(x.mod)+' kn '+T('μοντέλο','model')+' ('+(x.d>0?'+':'')+Math.round(x.d)+')'; sd.append(d); }); }
    else if(stErr==='nofn') sd.textContent=T('Σταθμοί: δεν έχει ενεργοποιηθεί ακόμα η συνάρτηση «metar» στο Supabase.','Stations: the "metar" Supabase function is not set up yet.');
    else if(stErr) sd.textContent=T('Οι μετρήσεις σταθμών δεν φορτώθηκαν.','Station observations did not load.'); }
}
/* πλέγμα: g.lat[j], g.lon[i], g.m[k]={name,u[h],v[h]} (kn, προς τα πού πάει ο αέρας) · g.mean = μέσος όρος μοντέλων */
function bil(A,lat,lon){
  var g=grid, fy=(lat-g.lat[0])/(g.lat[N-1]-g.lat[0])*(N-1), fx=(lon-g.lon[0])/(g.lon[N-1]-g.lon[0])*(N-1);
  if(!(fx>=0&&fx<=N-1&&fy>=0&&fy<=N-1)) return null;
  var i=Math.min(N-2,Math.floor(fx)), j=Math.min(N-2,Math.floor(fy)), a=fx-i, bb=fy-j;
  return A[j*N+i]*(1-a)*(1-bb)+A[j*N+i+1]*a*(1-bb)+A[(j+1)*N+i]*(1-a)*bb+A[(j+1)*N+i+1]*a*bb;
}
function vec(u,v){ var sp=Math.sqrt(u*u+v*v); return isFinite(sp)?{u:u,v:v,sp:sp,dir:(Math.atan2(-u,-v)*180/Math.PI+360)%360}:null; }
function sampleSrc(src,h,lat,lon){ if(!grid) return null; var u=bil(src.u[h],lat,lon), v=bil(src.v[h],lat,lon); if(u==null||v==null) return null; return vec(u,v); }
function sample(lat,lon,h){ if(!grid) return null; var src=SEL===0||!grid.m[SEL-1]?grid.mean:grid.m[SEL-1]; return sampleSrc(src,h==null?hi:h,lat,lon); }
function adiff(a,b){ var d=Math.abs(a-b)%360; return d>180?360-d:d; }
function agree(lat,lon){
  if(!grid||grid.m.length<2) return null;
  var vs=grid.m.map(function(m){ var v=sampleSrc(m,hi,lat,lon); return v&&{n:m.name,v:v}; }).filter(Boolean); if(vs.length<2) return null;
  var sp=vs.map(function(x){ return x.v.sp; }), dsp=Math.max.apply(null,sp)-Math.min.apply(null,sp), dd=0, mean=sp.reduce(function(a,b){return a+b;},0)/sp.length;
  if(mean>=4) for(var i=0;i<vs.length;i++) for(var j=i+1;j<vs.length;j++) dd=Math.max(dd,adiff(vs[i].v.dir,vs[j].v.dir));
  var lv=(dsp>=6||dd>=60)?2:(dsp>=3||dd>=30)?1:0;
  return {vs:vs,dsp:dsp,dd:dd,lv:lv};
}
async function fetchGrid(url){
  var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },20000);
  try{ var r=await fetch(url,{signal:ac.signal}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); } finally{ clearTimeout(tm); }
}
async function load(){
  var id=++loadId, b=map.getBounds().pad(0.05), s=b.getSouth(), n=b.getNorth(), w=b.getWest(), e=b.getEast();
  var lat=[], lon=[]; for(var k=0;k<N;k++){ lat.push(s+(n-s)*k/(N-1)); lon.push(w+(e-w)*k/(N-1)); }
  var la=[], lo=[]; for(var j=0;j<N;j++) for(var i=0;i<N;i++){ la.push(lat[j].toFixed(3)); lo.push(lon[i].toFixed(3)); }
  var base='https://api.open-meteo.com/v1/forecast?latitude='+la.join(',')+'&longitude='+lo.join(',')+'&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&past_hours=1&forecast_hours=48&timezone=UTC';
  drawPanel(T('Φόρτωση ανέμου…','Loading wind…'));
  try{
    var arr, multi=true;
    try{ arr=await fetchGrid(base+'&models='+MODELS.map(function(m){ return m[0]; }).join(',')); }
    catch(e1){ multi=false; arr=await fetchGrid(base); }
    if(id!==loadId||!on) return;
    arr=Array.isArray(arr)?arr:[arr]; if(arr.length<N*N) throw new Error('short');
    var T0=arr[0].hourly.time, H=T0.length, names=[];
    if(multi){ MODELS.forEach(function(m){ if(arr[0].hourly['wind_speed_10m_'+m[0]]&&arr[0].hourly['wind_direction_10m_'+m[0]]) names.push({id:m[0],name:m[1],sfx:'_'+m[0]}); }); }
    if(!names.length) names=[{id:'auto',name:T('Μοντέλο','Model'),sfx:''}];
    var ms=names.map(function(nm){
      var U=[],V=[]; for(var h=0;h<H;h++){ var uu=new Float32Array(N*N), vv=new Float32Array(N*N);
        for(var q=0;q<N*N;q++){ var sp=arr[q].hourly['wind_speed_10m'+nm.sfx][h], d=arr[q].hourly['wind_direction_10m'+nm.sfx][h]*Math.PI/180; if(sp==null||d!=d){ sp=NaN; d=0; } uu[q]=-sp*Math.sin(d); vv[q]=-sp*Math.cos(d); }
        U.push(uu); V.push(vv); }
      return {name:nm.name,u:U,v:V};
    });
    /* μέσος όρος διανυσμάτων μόνο από τα μοντέλα που έχουν τιμή */
    var MU=[],MV=[]; for(var h2=0;h2<H;h2++){ var mu=new Float32Array(N*N), mv=new Float32Array(N*N);
      for(var q2=0;q2<N*N;q2++){ var su=0,sv=0,c=0; ms.forEach(function(m){ var x=m.u[h2][q2]; if(x===x){ su+=x; sv+=m.v[h2][q2]; c++; } }); mu[q2]=c?su/c:0; mv[q2]=c?sv/c:0; }
      MU.push(mu); MV.push(mv); }
    ms.forEach(function(m){ m.u.forEach(function(a){ for(var z=0;z<a.length;z++) if(a[z]!==a[z]) a[z]=0; }); m.v.forEach(function(a){ for(var z=0;z<a.length;z++) if(a[z]!==a[z]) a[z]=0; }); });
    grid={lat:lat,lon:lon,m:ms,mean:{name:T('Μέσος όρος','Average'),u:MU,v:MV}}; hours=T0;
    if(SEL>ms.length) SEL=0;
    var nowK=new Date().toISOString().slice(0,13); hi=0; for(var z2=0;z2<hours.length;z2++){ if(hours[z2].slice(0,13)<=nowK) hi=z2; } nowIdx=hi;
    drawPanel(); seed(); if(!raf) loop(0); loadStations();
  }catch(err){ if(id===loadId&&on){ grid=null; drawPanel(T('Ο άνεμος δεν φορτώθηκε. Έλεγξε τη σύνδεση.','Wind did not load. Check your connection.')); clear(); } }
}
/* Μετρήσεις σταθμών (METAR αεροδρομίων): περνούν από συνάρτηση στο Supabase, γιατί η πηγή δεν επιτρέπει κλήση απευθείας από browser. */
var SUPA='https://sgfohmqwdwtkhtrebnix.supabase.co', SKEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
async function loadStations(){
  stErr=null;
  try{
    var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },10000);
    var r=await fetch((window.PSARO_OBS_URL||SUPA+'/functions/v1/smart-api'),{signal:ac.signal,headers:{apikey:SKEY,Authorization:'Bearer '+SKEY}}); clearTimeout(tm);
    if(r.status===404) throw new Error('nofn'); if(!r.ok) throw new Error('HTTP '+r.status);
    var j=await r.json(); stations=(Array.isArray(j)?j:(j.stations||[])).filter(function(x){ return x&&isFinite(x.lat)&&isFinite(x.lon)&&x.spd!=null; });
  }catch(e){ stations=null; stErr=(e&&e.message==='nofn')?'nofn':'err'; }
  drawStations(); label();
}
function drawStations(){
  if(stLayer){ map.removeLayer(stLayer); stLayer=null; }
  if(!on||!stations||!stations.length) return; stLayer=L.layerGroup().addTo(map);
  stations.forEach(function(st){
    var rot=((st.dir==null?0:st.dir)+180)%360, c=col(st.spd);
    var ic=L.divIcon({className:'',iconSize:[46,46],iconAnchor:[23,23],html:'<div style="width:46px;text-align:center;font:700 11px system-ui;color:#fff;text-shadow:0 1px 3px #000"><div style="width:26px;height:26px;margin:0 auto;border-radius:50%;background:'+c+';border:2px solid #fff;box-shadow:0 1px 5px #0008;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="16" height="16" style="transform:rotate('+rot+'deg)"><path d="M12 3v16M6 13l6 6 6-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'+Math.round(st.spd)+' kn</div>'});
    var m=L.marker([st.lat,st.lon],{icon:ic,keyboard:false,interactive:true,title:(st.name||st.id)+' '+Math.round(st.spd)+' kn'}).addTo(stLayer);
    m.bindPopup('<b>'+(st.id||'')+' '+(st.name||'')+'</b><br>'+T('Μέτρηση','Observed')+': '+(st.dir!=null?dn(st.dir)+' ':'')+W(st.spd)+(st.gust?' · '+T('ριπές ','gusts ')+W(st.gust):'')+(st.t?'<br>'+String(st.t).slice(11,16)+'Z':''));
  });
}
function compare(){
  if(!stations||!stations.length||!grid) return [];
  return stations.map(function(st){ var v=sampleSrc(grid.mean,nowIdx,st.lat,st.lon); return v?{st:st,mod:v.sp,d:st.spd-v.sp}:null; }).filter(Boolean);
}
function seed(){
  var s=map.getSize(), cnt=Math.min(1600,Math.round(s.x*s.y/520)); parts=[];
  for(var i=0;i<cnt;i++) parts.push(np());
  clear();
}
function np(){ var s=map.getSize(); return {x:Math.random()*s.x,y:Math.random()*s.y,age:Math.floor(Math.random()*40)}; }
var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop(ts){
  raf=0; if(!on||!grid||document.hidden){ if(on&&grid) raf=requestAnimationFrame(loop); return; }
  raf=requestAnimationFrame(loop); if(ts-last<33) return; last=ts;
  var s=map.getSize(); ctx.globalCompositeOperation='destination-out'; ctx.fillStyle='rgba(0,0,0,'+(RM?1:0.08)+')'; ctx.fillRect(0,0,s.x,s.y); ctx.globalCompositeOperation='source-over'; ctx.lineWidth=1.6; ctx.lineCap='round';
  var sc=0.12*Math.pow(2,(map.getZoom()-8)*0.35);
  for(var i=0;i<parts.length;i++){
    var p=parts[i], ll=map.containerPointToLatLng([p.x,p.y]), v=sample(ll.lat,ll.lng);
    if(!v||p.age--<=0){ parts[i]=np(); parts[i].age=40+Math.floor(Math.random()*30); continue; }
    var nx=p.x+v.u*sc, ny=p.y-v.v*sc;
    ctx.strokeStyle=col(v.sp); ctx.globalAlpha=0.9; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(nx,ny); ctx.stroke();
    p.x=nx; p.y=ny; if(nx<0||ny<0||nx>s.x||ny>s.y){ parts[i]=np(); parts[i].age=40+Math.floor(Math.random()*30); }
  }
  ctx.globalAlpha=1;
}
function moved(){ if(!on) return; clear(); clearTimeout(mvT); mvT=setTimeout(function(){ if(!on) return; var b=map.getBounds(); if(!grid||!(b.getSouth()>=grid.lat[0]-0.001&&b.getNorth()<=grid.lat[N-1]+0.001&&b.getWest()>=grid.lon[0]-0.001&&b.getEast()<=grid.lon[N-1]+0.001)||map.getBounds().getNorth()-map.getBounds().getSouth()<(grid.lat[N-1]-grid.lat[0])/3) load(); else{ seed(); label(); } },600); }
function start(){ if(on) return; on=true; ensure(); cv.style.display='block'; btn.setAttribute('aria-pressed','true'); btn.classList.add('on'); fit(); map.on('moveend zoomend resize',moved); window.addEventListener('resize',fit); load(); }
function stop(){ on=false; loadId++; btn.setAttribute('aria-pressed','false'); btn.classList.remove('on'); map.off('moveend zoomend resize',moved); if(raf){ cancelAnimationFrame(raf); raf=0; } if(stLayer){ map.removeLayer(stLayer); stLayer=null; } if(cv) cv.style.display='none'; if(panel){ panel.remove(); panel=null; } clear(); parts=[]; }
btn.addEventListener('click',function(){ on?stop():start(); });
window.PsaroWindMap={start:start,stop:stop,sample:sample};
})();
