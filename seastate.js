/* Κατάσταση θάλασσας στον χάρτη (χρώματα) — ΕΚΤΙΜΗΣΗ, όχι μέτρηση, όχι ναυτικό όργανο.
   Ανά κελί ~1 km έως 10 km από την ακτή της Κύπρου:
   1) Κύμα ανέμου: SPM 1984 (deep water), fetch-limited ΚΑΙ duration-limited, με όριο το πλήρως ανεπτυγμένο.
      - fetch: προϋπολογισμένο ενεργό fetch της κατεύθυνσης του ανέμου (coastexp.js, ακτογραμμή OSM)
      - άνεμος: ο χάρτης ανέμου της εφαρμογής (windmap.js), ίδια ώρα με το ρυθμιστικό
      - διάρκεια: πόσες συνεχόμενες ώρες φυσάει περίπου ο ίδιος άνεμος (±45°, ≥50% της έντασης), από ιστορικό 24 h Open-Meteo
        t_min = 68.8 (gF/Ua²)^(2/3) · Ua/g  ->  αν η διάρκεια είναι μικρότερη, χρησιμοποιείται το ισοδύναμο fetch διάρκειας
   2) Swell: Open-Meteo Marine (swell_wave_height/direction) σε πλέγμα 0,25°, εξασθενεί όταν η κατεύθυνσή του είναι κλειστή από ακτή
      (γραμμικά από fetch 5 km = 0 έως 60 km = 1, όπως η κάρτα έκθεσης).
   Σύνολο: Hs = √(Hs_ανέμου² + Hs_swell²). Κατηγορίες WMO Sea State Code 3700.
   ΔΕΝ περιλαμβάνει ρηχά, ρεύματα, διάθλαση/περίθλαση, βουνά (επιτάχυνση/σκιά ανέμου). */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };

/* ---------- δεδομένα fetch ---------- */
var E=null, IDX=null, FB=null;
function decode(){
  if(IDX) return true;
  E=window.PSARO_COASTEXP; if(!E||!E.cells||!E.f) return false;
  var s=atob(E.cells), n=E.w*E.h, idx=new Int32Array(n).fill(-1), i=0, pos=0, on=0, k=0;
  while(i<s.length&&pos<n){
    var v=0, sh=0, b;
    do{ b=s.charCodeAt(i++); v|=(b&127)<<sh; sh+=7; }while(b&128&&i<s.length);
    if(on){ for(var j=pos;j<Math.min(n,pos+v);j++) idx[j]=k++; }
    pos+=v; on^=1;
  }
  if(pos!==n||k!==E.n) return false;
  var f=atob(E.f); if(f.length!==k*16) return false;
  var fb=new Uint8Array(f.length); for(var q=0;q<f.length;q++) fb[q]=f.charCodeAt(q);
  IDX=idx; FB=fb; return true;
}
function qkm(q){ return q<=200?q*0.25:50+(q-200)*3; }
function cellOf(lat,lon){
  var c=Math.floor((lon-E.lon0)/E.step), r=Math.floor((E.lat1-lat)/E.step);
  if(c<0||r<0||c>=E.w||r>=E.h) return -1;
  return IDX[r*E.w+c];
}
function fetchKm(k,dir){
  var x=((dir%360)+360)%360/22.5, i0=Math.floor(x)%16, i1=(i0+1)%16, t=x-Math.floor(x);
  return qkm(FB[k*16+i0])*(1-t)+qkm(FB[k*16+i1])*t;
}
/* SPM 1984: κύμα ανέμου βαθέων υδάτων, fetch- και duration-limited, όριο πλήρως ανεπτυγμένου */
function hsWind(u10,fkm,durH){
  if(!(u10>0.2)) return 0;
  var g=9.81, ua=0.71*Math.pow(u10,1.23), F=fkm*1000;
  if(durH>0&&isFinite(durH)){ var t=durH*3600, Fd=(ua*ua/g)*Math.pow((g*t/ua)/68.8,1.5); if(Fd<F) F=Fd; }
  return Math.min(0.0016*ua*ua/g*Math.sqrt(g*F/(ua*ua)),0.2433*ua*ua/g);
}
function swellOpen(fkm){ return Math.max(0,Math.min(1,(fkm-5)/55)); }

var LV=[
  {max:0.5, el:'Ήρεμη / λεία', en:'Calm / smooth', r:'< 0,5 m', ren:'< 0.5 m'},
  {max:1.25,el:'Ελαφρά κυματώδης', en:'Slight', r:'0,5–1,25 m', ren:'0.5–1.25 m'},
  {max:2.5, el:'Μέτρια', en:'Moderate', r:'1,25–2,5 m', ren:'1.25–2.5 m'},
  {max:1e9, el:'Ταραγμένη', en:'Rough', r:'≥ 2,5 m', ren:'≥ 2.5 m'}
];
var BOUNDS=[0.5,1.25,2.5];
var GS=[[0,[52,168,120]],[0.25,[52,168,120]],[0.875,[240,200,80]],[1.875,[238,136,62]],[3,[208,66,72]]];
function grad(h){
  if(!(h>0)) return GS[0][1];
  for(var i=1;i<GS.length;i++){ if(h<=GS[i][0]){ var a=GS[i-1], b=GS[i], t=(h-a[0])/(b[0]-a[0]); return [a[1][0]+(b[1][0]-a[1][0])*t,a[1][1]+(b[1][1]-a[1][1])*t,a[1][2]+(b[1][2]-a[1][2])*t]; } }
  return GS[GS.length-1][1];
}
function levelOf(h){ for(var i=0;i<LV.length;i++) if(h<LV[i].max) return i; return LV.length-1; }

/* ---------- εξωτερικά δεδομένα: ιστορικό ανέμου (διάρκεια) και swell, σταθερό πλέγμα γύρω από την Κύπρο ---------- */
var XG={la0:34.45,la1:35.80,nla:7,lo0:32.15,lo1:34.70,nlo:11};
var XD=null, XP=null, XT=0;
function xLat(j){ return XG.la0+(XG.la1-XG.la0)*j/(XG.nla-1); }
function xLon(i){ return XG.lo0+(XG.lo1-XG.lo0)*i/(XG.nlo-1); }
function getJ(u){
  var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },20000);
  return fetch(u,{signal:ac.signal}).then(function(r){ clearTimeout(tm); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); },function(e){ clearTimeout(tm); throw e; });
}
function loadExt(){
  if(XP&&Date.now()-XT<3600000) return XP;
  var la=[], lo=[]; for(var j=0;j<XG.nla;j++) for(var i=0;i<XG.nlo;i++){ la.push(xLat(j).toFixed(3)); lo.push(xLon(i).toFixed(3)); }
  var q='latitude='+la.join(',')+'&longitude='+lo.join(',');
  var pw=getJ('https://api.open-meteo.com/v1/forecast?'+q+'&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&past_hours=24&forecast_hours=49&timezone=UTC');
  var pm=getJ('https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=swell_wave_height,swell_wave_direction&past_hours=1&forecast_hours=49&timezone=UTC');
  XT=Date.now();
  XP=Promise.all([pw.catch(function(){ return null; }),pm.catch(function(){ return null; })]).then(function(res){
    function arr(j){ return j==null?null:(Array.isArray(j)?j:[j]); }
    var w=arr(res[0]), m=arr(res[1]), d={w:null,m:null};
    var NP=XG.nla*XG.nlo;
    if(w&&w.length===NP&&w[0].hourly&&w[0].hourly.time) d.w={t:w[0].hourly.time,sp:w.map(function(p){ return (p.hourly&&p.hourly.wind_speed_10m)||[]; }),dir:w.map(function(p){ return (p.hourly&&p.hourly.wind_direction_10m)||[]; })};
    if(m&&m.length===NP&&m[0].hourly&&m[0].hourly.time) d.m={t:m[0].hourly.time,h:m.map(function(p){ return (p.hourly&&p.hourly.swell_wave_height)||[]; }),dir:m.map(function(p){ return (p.hourly&&p.hourly.swell_wave_direction)||[]; })};
    if(!d.w||!d.m) XT=Date.now()-3300000; /* ό,τι έλειψε ξαναδοκιμάζεται σε ~5 λεπτά */
    XD=d; return d;
  });
  return XP;
}
function adiff(a,b){ var d=Math.abs(a-b)%360; return d>180?360-d:d; }
/* διάρκεια (ώρες) σταθερού ανέμου σε κάθε κόμβο για τη χρονική στιγμή t */
function durGrid(t){
  if(!XD||!XD.w||!t) return null;
  var ti=XD.w.t.indexOf(t); if(ti<0) return null;
  var NP=XG.nla*XG.nlo, out=new Float32Array(NP);
  for(var p=0;p<NP;p++){
    var sp=XD.w.sp[p], dr=XD.w.dir[p], s0=sp[ti], d0=dr[ti];
    if(s0==null||d0==null){ out[p]=Infinity; continue; }
    var D=1, k=ti-1;
    for(;k>=0;k--){ var s=sp[k], d=dr[k]; if(s==null||d==null) break; if(s>=Math.max(3,0.5*s0)&&adiff(d,d0)<=45) D++; else break; }
    out[p]=(k<0)?Math.max(D,24):D; /* σταθερός σε όλο το ιστορικό: τουλάχιστον 24 h */
  }
  return out;
}
function swellGrid(t){
  if(!XD||!XD.m||!t) return null;
  var ti=XD.m.t.indexOf(t); if(ti<0) return null;
  var NP=XG.nla*XG.nlo, h=new Float32Array(NP), u=new Float32Array(NP), v=new Float32Array(NP), ok=new Uint8Array(NP), any=false;
  for(var p=0;p<NP;p++){ var a=XD.m.h[p][ti], d=XD.m.dir[p][ti]; if(a==null||d==null) continue; h[p]=a; u[p]=Math.sin(d*Math.PI/180); v[p]=Math.cos(d*Math.PI/180); ok[p]=1; any=true; }
  return any?{h:h,u:u,v:v,ok:ok}:null;
}
/* παρεμβολή στο πλέγμα με βάρη απόστασης, μόνο από κόμβους με τιμή (κοντά στην ακτή το μοντέλο κύματος συχνά δεν έχει) */
function xSample(lat,lon,fn){
  var fy=(lat-XG.la0)/(XG.la1-XG.la0)*(XG.nla-1), fx=(lon-XG.lo0)/(XG.lo1-XG.lo0)*(XG.nlo-1);
  var j0=Math.floor(fy), i0=Math.floor(fx), sw=0, acc=null;
  for(var R=1;R<=3&&sw===0;R++){
    for(var j=j0-R+1;j<=j0+R;j++) for(var i=i0-R+1;i<=i0+R;i++){
      if(j<0||i<0||j>=XG.nla||i>=XG.nlo) continue;
      var r=fn(j*XG.nlo+i); if(r==null) continue;
      var dd=(fy-j)*(fy-j)+(fx-i)*(fx-i), w=1/(dd+0.05);
      if(!acc){ acc=[]; for(var z0=0;z0<r.length;z0++) acc.push(0); }
      for(var z=0;z<r.length;z++) acc[z]+=r[z]*w; sw+=w;
    }
  }
  if(!sw) return null; for(var z2=0;z2<acc.length;z2++) acc[z2]/=sw; return acc;
}
function durAt(dg,lat,lon){ if(!dg) return Infinity; var d=xSample(lat,lon,function(p){ return isFinite(dg[p])?[dg[p]]:null; }); return d?d[0]:Infinity; }
function swellAt(sg,lat,lon){ if(!sg) return null; var s=xSample(lat,lon,function(p){ return sg.ok[p]?[sg.h[p],sg.u[p],sg.v[p]]:null; }); return s?{h:s[0],dir:(Math.atan2(s[1],s[2])*180/Math.PI+360)%360}:null; }

/* κατάσταση σε σημείο: kn, dir (ΑΠΟ), opts {dur:ώρες, swell:{h,dir}} */
function at(lat,lon,kn,dir,opts){
  if(!decode()) return null;
  var k=cellOf(lat,lon); if(k<0) return null; opts=opts||{};
  var f=fetchKm(k,dir), hw=hsWind(Math.max(0,kn)*0.514444,f,opts.dur), hsw=0, fs=null;
  if(opts.swell&&opts.swell.h>0){ fs=fetchKm(k,opts.swell.dir); hsw=opts.swell.h*swellOpen(fs); }
  var h=Math.sqrt(hw*hw+hsw*hsw);
  return {fetchKm:f,hsWind:hw,hsSwell:hsw,swellFetchKm:fs,hs:h,level:levelOf(h)};
}
window.PsaroSeaState={decode:decode,at:at,levels:LV,grad:grad,hsWind:hsWind};

/* ---------- χάρτης ---------- */
var C=window.PsaroCore, mb=document.querySelector('.mapbtns'), Lf=window.L; if(!C||!mb||!Lf) return;
var map=C.map&&C.map(); if(!map) return;
(function(){ var st=document.createElement('style'); st.textContent='body.ndsea #ndWindCv{opacity:.4}.ndseacv{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:440;transition:opacity .45s ease}.ndseacv.nt{transition:none}'; document.head.appendChild(st); })();
var on=false, ownWind=false, cvs=[], cur=0, leg=null, drawT=null, curT=null, tapLL=null, tapMk=null, LAST=null;
var btn=document.createElement('button'); btn.type='button'; btn.id='bSeaState'; btn.className='mbtn'; btn.setAttribute('aria-pressed','false');
btn.setAttribute('aria-label',T('Κατάσταση θάλασσας (χρώματα)','Sea state (colours)')); btn.title=btn.getAttribute('aria-label');
btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/></svg>';
mb.appendChild(btn);

function windOn(){ var b=document.getElementById('bWind'); return !!(b&&b.getAttribute('aria-pressed')==='true'); }
function fmt(x,d){ var s=x.toFixed(d); return EN?s:s.replace('.',','); }
function ensure(){
  if(!cvs.length){
    for(var i=0;i<2;i++){ var c=document.createElement('canvas'); c.className='ndseacv'; c.setAttribute('aria-hidden','true'); c.style.opacity='0'; map.getContainer().appendChild(c); cvs.push(c); }
  }
  if(!leg||!leg.isConnected){
    leg=document.createElement('div'); leg.id='ndSeaLeg'; leg.setAttribute('role','note');
    leg.style.cssText='position:fixed;left:8px;right:8px;bottom:calc(var(--navh,64px) + 38px + var(--ndwh,0px) + env(safe-area-inset-bottom,0px));z-index:899;background:var(--card,var(--bg,#fff));color:var(--ink,#111);border:1px solid var(--line,#8886);border-radius:12px;padding:6px 8px;box-shadow:0 2px 10px #0003;font-size:11px;line-height:1.35';
    var cols='16.7fr 25fr 41.6fr 16.7fr';
    var bar=document.createElement('div'); bar.style.cssText='height:8px;border-radius:4px;background:linear-gradient(90deg,'+GS.map(function(g){ return 'rgb('+g[1].join(',')+') '+(100*g[0]/3).toFixed(1)+'%'; }).join(',')+')';
    var nm=document.createElement('div'), rg=document.createElement('div');
    nm.style.cssText=rg.style.cssText='display:grid;grid-template-columns:'+cols+';gap:2px;margin-top:2px';
    LV.forEach(function(l){
      var a=document.createElement('span'); a.style.cssText='font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; a.textContent=EN?l.en.split(' /')[0]:l.el.split(' ')[0]; nm.append(a);
      var b=document.createElement('span'); b.className='note'; b.style.cssText='font-size:10px;white-space:nowrap'; b.textContent=EN?l.ren:l.r; rg.append(b);
    });
    var pt=document.createElement('div'); pt.id='ndSeaPt'; pt.style.cssText='margin-top:5px;padding:5px 7px;border-radius:8px;background:rgba(127,127,127,.14);font-size:12px'; pt.hidden=true; pt.setAttribute('aria-live','polite');
    var st=document.createElement('div'); st.id='ndSeaSt'; st.style.cssText='font-weight:600;margin-top:4px'; st.setAttribute('aria-live','polite');
    var nt=document.createElement('details'); nt.style.cssText='margin-top:2px';
    var sm=document.createElement('summary'); sm.className='note'; sm.style.cssText='font-size:11px;cursor:pointer;min-height:24px;display:list-item'; sm.textContent=T('Τι δείχνει αυτό · πάτα στη θάλασσα για τιμές','What this shows · tap the sea for values');
    var nb=document.createElement('p'); nb.className='note'; nb.style.cssText='font-size:11px;margin:2px 0 0';
    nb.textContent=T('Εκτίμηση σημαντικού ύψους κύματος. Κύμα ανέμου: μέθοδος SPM με τον άνεμο της ώρας, την ανοιχτή θάλασσα προς τον άνεμο (fetch) και πόσες ώρες φυσάει. Swell: μοντέλο κύματος Open-Meteo, μειωμένο όταν η ακτή το κόβει. Κατηγορίες WMO, λευκές γραμμές στα όρια. Δεν περιλαμβάνει ρηχά, ρεύματα και βουνά. Μόνο Κύπρος, έως 10 km από την ακτή. Δεν είναι ναυτικό όργανο. Ακτογραμμή © OpenStreetMap contributors · Δεδομένα καιρού Open-Meteo.','Significant wave height estimate. Wind sea: SPM method with the hour\'s wind, open sea upwind (fetch) and how long it has been blowing. Swell: Open-Meteo wave model, reduced where the coast blocks it. WMO categories, white lines at the boundaries. Excludes shallows, currents and mountains. Cyprus only, up to 10 km offshore. Not a navigation instrument. Coastline © OpenStreetMap contributors · Weather data Open-Meteo.');
    nt.append(sm,nb);
    leg.append(bar,nm,rg,pt,st,nt); document.body.appendChild(leg);
  }
}
function status(txt){ var s=document.getElementById('ndSeaSt'); if(s) s.textContent=txt||''; }
function blur(V,cw,ch){
  var K=[1/16,4/16,6/16,4/16,1/16], t=new Float32Array(V.length), o=new Float32Array(V.length), x, y, k, a;
  for(y=0;y<ch;y++) for(x=0;x<cw;x++){ a=0; for(k=-2;k<=2;k++){ var xx=Math.min(cw-1,Math.max(0,x+k)); a+=V[y*cw+xx]*K[k+2]; } t[y*cw+x]=a; }
  for(y=0;y<ch;y++) for(x=0;x<cw;x++){ a=0; for(k=-2;k<=2;k++){ var yy=Math.min(ch-1,Math.max(0,y+k)); a+=t[yy*cw+x]*K[k+2]; } o[y*cw+x]=a; }
  return o;
}
/* τιμές ενός σημείου με τα δεδομένα της τρέχουσας ώρας (για πάτημα) */
function pointInfo(lat,lon){
  if(!decode()) return null;
  var W=window.PsaroWindMap, v=W&&W.sample?W.sample(lat,lon):null; if(!v) return null;
  var o={dur:durAt(LAST&&LAST.dur,lat,lon),swell:swellAt(LAST&&LAST.sw,lat,lon)};
  var r=at(lat,lon,v.sp,v.dir,o); if(!r) return null; r.wind=v; r.dur=o.dur; r.swell=o.swell; return r;
}
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dn(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; }
function W_(kn){ try{ return window.PsaroUnits.wind(kn); }catch(e){ return Math.round(kn)+' kn'; } }
function showPoint(){
  var el=document.getElementById('ndSeaPt'); if(!el) return;
  if(!tapLL){ el.hidden=true; return; }
  var r=pointInfo(tapLL.lat,tapLL.lng); el.hidden=false;
  if(!r){ el.textContent=T('Εδώ δεν υπάρχει εκτίμηση (ξηρά ή πάνω από 10 km από την ακτή).','No estimate here (land or more than 10 km offshore).'); return; }
  var L=LV[r.level], parts=['≈ '+fmt(r.hs,1)+' m · '+(EN?L.en:L.el)];
  parts.push(T('άνεμος ','wind ')+dn(r.wind.dir)+' '+W_(r.wind.sp)+(isFinite(r.dur)?T(' επί ',' for ')+(r.dur>=24?'24+':Math.round(r.dur))+' h':''));
  parts.push(T('κύμα ανέμου ','wind sea ')+fmt(r.hsWind,1)+' m (fetch '+(r.fetchKm<10?fmt(r.fetchKm,1):Math.round(r.fetchKm))+' km)');
  if(r.swell) parts.push('swell '+fmt(r.hsSwell,1)+' m'+(r.swell.h>r.hsSwell+0.05?T(' (ανοιχτά '+fmt(r.swell.h,1)+' m από '+dn(r.swell.dir)+')',' (offshore '+fmt(r.swell.h,1)+' m from '+dn(r.swell.dir)+')'):T(' από ',' from ')+dn(r.swell.dir)));
  el.textContent=parts.join(' · ');
}
function onTap(e){
  if(!on) return; var t=e.target;
  if(t&&t.closest&&(t.closest('.mapbtns')||t.closest('#ndWindPanel')||t.closest('#ndSeaLeg')||t.closest('.leaflet-marker-icon')||t.closest('.leaflet-control')||t.closest('.ndbar')||t.closest('.ndsheet')||t.closest('button,a,input,select'))) return;
  tapLL=map.mouseEventToLatLng(e);
  if(tapMk) try{ map.removeLayer(tapMk); }catch(x){}
  if(!windOn()) tapMk=Lf.circleMarker(tapLL,{radius:7,color:'#fff',weight:3,fillColor:'#13212e',fillOpacity:1,interactive:false}).addTo(map);
  showPoint();
}
/* τμήματα ισοϋψούς (marching squares) για τιμή lv σε πλέγμα οθόνης */
var MS={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[2,0]],10:[[0,1],[2,3]],11:[[2,1]],12:[[1,3]],13:[[1,0]],14:[[0,3]]};
function contour(GH,GA,gw,gh,G,lv){
  var segs=[];
  for(var y=0;y<gh-1;y++) for(var x=0;x<gw-1;x++){
    var p0=y*gw+x, p1=p0+1, p2=p0+gw+1, p3=p0+gw;
    if(GA[p0]<0.35||GA[p1]<0.35||GA[p2]<0.35||GA[p3]<0.35) continue;
    var v0=GH[p0], v1=GH[p1], v2=GH[p2], v3=GH[p3];
    var m=(v0>=lv?1:0)|(v1>=lv?2:0)|(v2>=lv?4:0)|(v3>=lv?8:0); if(m===0||m===15) continue;
    var X0=x*G, Y0=y*G;
    var ed=[[X0+G*(lv-v0)/((v1-v0)||1e-9),Y0],[X0+G,Y0+G*(lv-v1)/((v2-v1)||1e-9)],[X0+G*(lv-v3)/((v2-v3)||1e-9),Y0+G],[X0,Y0+G*(lv-v0)/((v3-v0)||1e-9)]];
    MS[m].forEach(function(pr){ segs.push([ed[pr[0]],ed[pr[1]]]); });
  }
  return segs;
}

function draw(){
  if(!on||!cvs.length) return;
  var tgt=cvs[1-cur], sz=map.getSize(), dpr=Math.min(window.devicePixelRatio||1,2);
  tgt.width=Math.round(sz.x*dpr); tgt.height=Math.round(sz.y*dpr);
  var ctx=tgt.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,sz.x,sz.y);
  if(!decode()){ status(T('Τα δεδομένα ακτής δεν φορτώθηκαν.','Coast data did not load.')); return; }
  var W=window.PsaroWindMap; if(!W||!W.sample){ status(T('Ο χάρτης ανέμου δεν είναι διαθέσιμος.','The wind map is not available.')); return; }
  var X=window.PsaroExposure, land=(X&&X.isLand)?X.isLand:null;
  var bd=map.getBounds(), s=Math.max(E.lat1-E.h*E.step,bd.getSouth()), n=Math.min(E.lat1,bd.getNorth()), w=Math.max(E.lon0,bd.getWest()), e=Math.min(E.lon0+E.w*E.step,bd.getEast());
  if(s>=n||w>=e){ swap(); status(T('Δεν υπάρχουν δεδομένα σε αυτή την περιοχή (μόνο Κύπρος).','No data in this area (Cyprus only).')); return; }
  var dg=durGrid(curT), sg=swellGrid(curT); LAST={dur:dg,sw:sg};
  var M=4, r0=Math.max(0,Math.floor((E.lat1-n)/E.step)-M), r1=Math.min(E.h-1,Math.floor((E.lat1-s)/E.step)+M);
  var c0=Math.max(0,Math.floor((w-E.lon0)/E.step)-M), c1=Math.min(E.w-1,Math.floor((e-E.lon0)/E.step)+M);
  var cw=c1-c0+1, ch=r1-r0+1, N=cw*ch, H=new Float32Array(N), A=new Float32Array(N);
  var cnt=[0,0,0,0], nowind=0, drawn=0;
  for(var r=r0;r<=r1;r++){
    var lam=E.lat1-(r+0.5)*E.step;
    for(var c=c0;c<=c1;c++){
      var k=IDX[r*E.w+c]; if(k<0) continue;
      var lom=E.lon0+(c+0.5)*E.step, v=W.sample(lam,lom);
      if(!v){ nowind++; continue; }
      var hw=hsWind(v.sp*0.514444,fetchKm(k,v.dir),durAt(dg,lam,lom)), hsw=0, sw0=swellAt(sg,lam,lom);
      if(sw0&&sw0.h>0) hsw=sw0.h*swellOpen(fetchKm(k,sw0.dir));
      var h=Math.sqrt(hw*hw+hsw*hsw), q=(r-r0)*cw+(c-c0);
      H[q]=h; A[q]=1;
      if(lam>=s&&lam<=n&&lom>=w&&lom<=e){ cnt[levelOf(h)]++; drawn++; }
    }
  }
  if(!drawn){ swap(); status(nowind?T('Περιμένω τον άνεμο…','Waiting for wind…'):T('Δεν υπάρχουν δεδομένα σε αυτή την περιοχή (μόνο Κύπρος).','No data in this area (Cyprus only).')); return; }
  /* επέκταση 3 κελιών (στην ξηρά πλήρως, κόβεται στην ακτή· ανοιχτά σβήνει) */
  var LAND=new Uint8Array(N);
  if(land) for(var y0=0;y0<ch;y0++) for(var x0=0;x0<cw;x0++) LAND[y0*cw+x0]=land(E.lat1-(r0+y0+0.5)*E.step,E.lon0+(c0+x0+0.5)*E.step)===1?1:0;
  [1,0.55,0.25].forEach(function(seaW){
    var nH=H.slice(), nA=A.slice();
    for(var y=0;y<ch;y++) for(var x=0;x<cw;x++){
      var q=y*cw+x; if(A[q]>0) continue; var sh=0, sw=0;
      for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){ var xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=cw||yy>=ch) continue; var p=yy*cw+xx; if(A[p]>0){ sh+=H[p]*A[p]; sw+=A[p]; } }
      if(sw>0){ nH[q]=sh/sw; nA[q]=LAND[q]?1:Math.min(seaW,sw/3); }
    }
    H=nH; A=nA;
  });
  /* Gaussian εξομάλυνση με κανονικοποίηση */
  var HA=new Float32Array(N); for(var i=0;i<N;i++) HA[i]=H[i]*A[i];
  var bHA=blur(HA,cw,ch), bA=blur(A,cw,ch);
  for(var i2=0;i2<N;i2++){ H[i2]=bA[i2]>1e-4?bHA[i2]/bA[i2]:0; A[i2]=bA[i2]; }
  function field(lat,lon,out){
    var fy=(E.lat1-lat)/E.step-0.5-r0, fx=(lon-E.lon0)/E.step-0.5-c0;
    if(fy<0||fy>ch-1||fx<0||fx>cw-1) return false;
    var j=Math.min(ch-2,Math.floor(fy)), ty=fy-j, i3=Math.min(cw-2,Math.floor(fx)), tx=fx-i3, q0=j*cw+i3, q1=q0+1, q2=q0+cw, q3=q2+1;
    var w0=(1-tx)*(1-ty), w1=tx*(1-ty), w2=(1-tx)*ty, w3=tx*ty;
    out[0]=H[q0]*w0+H[q1]*w1+H[q2]*w2+H[q3]*w3; out[1]=A[q0]*w0+A[q1]*w1+A[q2]*w2+A[q3]*w3; return true;
  }
  /* χρώμα ανά pixel οθόνης (CSS px· σε πολύ μεγάλες οθόνες ανά 2) */
  var bs=(sz.x*sz.y>600000)?2:1, bw=Math.ceil(sz.x/bs), bh=Math.ceil(sz.y/bs), LAT=new Float64Array(bh), LON=new Float64Array(bw);
  for(var y2=0;y2<bh;y2++) LAT[y2]=map.containerPointToLatLng([0,y2*bs+bs/2]).lat;
  for(var x2=0;x2<bw;x2++) LON[x2]=map.containerPointToLatLng([x2*bs+bs/2,0]).lng;
  var pc=document.createElement('canvas'); pc.width=bw; pc.height=bh;
  var px=pc.getContext('2d'), im=px.createImageData(bw,bh), d=im.data, mk=new Uint8Array(bw*bh), ALPHA=0.74*255, fv=[0,0];
  for(var y3=0;y3<bh;y3++){
    for(var x3=0;x3<bw;x3++){
      if(!field(LAT[y3],LON[x3],fv)||fv[1]<0.03) continue;
      if(land&&land(LAT[y3],LON[x3])===1){ mk[y3*bw+x3]=1; continue; }
      var g=grad(fv[0]), o=(y3*bw+x3)*4;
      d[o]=g[0]; d[o+1]=g[1]; d[o+2]=g[2]; d[o+3]=Math.round(ALPHA*Math.min(1,fv[1]*1.15));
    }
  }
  px.putImageData(im,0,0);
  ctx.imageSmoothingEnabled=true; try{ ctx.imageSmoothingQuality='high'; }catch(x){}
  ctx.drawImage(pc,0,0,bw,bh,0,0,bw*bs,bh*bs);
  /* ισοϋψείς στα όρια κατηγοριών: marching squares σε πλέγμα 4 px οθόνης, γραμμή με λεπτή σκιά, ετικέτες */
  var G=4, gw=Math.ceil(sz.x/G)+1, gh=Math.ceil(sz.y/G)+1, GH=new Float32Array(gw*gh), GA=new Float32Array(gw*gh), gLat=new Float64Array(gh), gLon=new Float64Array(gw);
  for(var a1=0;a1<gh;a1++) gLat[a1]=map.containerPointToLatLng([0,a1*G]).lat;
  for(var a2=0;a2<gw;a2++) gLon[a2]=map.containerPointToLatLng([a2*G,0]).lng;
  for(var gy=0;gy<gh;gy++) for(var gx=0;gx<gw;gx++){ if(field(gLat[gy],gLon[gx],fv)){ GH[gy*gw+gx]=fv[0]; GA[gy*gw+gx]=fv[1]; } }
  var labels=[];
  ctx.lineCap='round'; ctx.lineJoin='round';
  BOUNDS.forEach(function(lvB){
    var segs=contour(GH,GA,gw,gh,G,lvB); if(!segs.length) return;
    ctx.beginPath(); segs.forEach(function(sg2){ ctx.moveTo(sg2[0][0],sg2[0][1]); ctx.lineTo(sg2[1][0],sg2[1][1]); });
    ctx.strokeStyle='rgba(19,33,46,.20)'; ctx.lineWidth=3.2; ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=1.3; ctx.stroke();
    var nl=0;
    for(var z=Math.floor(segs.length/7);z<segs.length&&nl<3;z+=Math.max(7,Math.floor(segs.length/12))){
      var sgz=segs[z], cx=(sgz[0][0]+sgz[1][0])/2, cy=(sgz[0][1]+sgz[1][1])/2;
      if(cx<36||cy<70||cx>sz.x-36||cy>sz.y-70) continue;
      if(land){ var bad=false; [[0,0],[-26,-9],[26,-9],[-26,9],[26,9]].forEach(function(o3){ if(bad) return; var ll=map.containerPointToLatLng([cx+o3[0],cy+o3[1]]); if(land(ll.lat,ll.lng)!==0) bad=true; }); if(bad) continue; }
      if(labels.some(function(l){ return (l.x-cx)*(l.x-cx)+(l.y-cy)*(l.y-cy)<110*110; })) continue;
      labels.push({x:cx,y:cy,v:lvB}); nl++;
    }
  });
  /* κόψιμο στην ακτή (και για τις γραμμές) */
  var mc=document.createElement('canvas'); mc.width=bw; mc.height=bh; var mx=mc.getContext('2d'), mi=mx.createImageData(bw,bh);
  for(var q4=0;q4<mk.length;q4++) if(mk[q4]) mi.data[q4*4+3]=255;
  mx.putImageData(mi,0,0);
  ctx.save(); ctx.globalCompositeOperation='destination-out'; ctx.imageSmoothingEnabled=false; ctx.drawImage(mc,0,0,bw,bh,0,0,bw*bs,bh*bs); ctx.restore();
  ctx.font='600 11px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  labels.forEach(function(l){
    var tx=fmt(l.v,l.v===1.25?2:1)+' m', tw=ctx.measureText(tx).width+10;
    ctx.fillStyle='rgba(255,255,255,.92)'; ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(l.x-tw/2,l.y-8,tw,16,8); else ctx.rect(l.x-tw/2,l.y-8,tw,16);
    ctx.fill(); ctx.fillStyle='#13212e'; ctx.fillText(tx,l.x,l.y+0.5);
  });
  swap();
  var tot=drawn, best=LV.map(function(l,ii){ return Math.round(100*cnt[ii]/tot)+'% '+(EN?l.en:l.el).toLowerCase(); }).filter(function(x){ return x.indexOf('0% ')!==0; });
  var miss=[]; if(!sg) miss.push('swell'); if(!dg) miss.push(T('διάρκεια ανέμου','wind duration'));
  status(T('Στην περιοχή που βλέπεις: ','In view: ')+best.join(' · ')+(miss.length?T(' (χωρίς ',' (without ')+miss.join(T(' και ',' and '))+')':''));
  showPoint();
}
function swap(){ var a=cvs[cur], b=cvs[1-cur]; a.classList.remove('nt'); b.classList.remove('nt'); b.style.opacity='1'; a.style.opacity='0'; cur=1-cur; }
function later(ev){ if(ev&&ev.detail&&ev.detail.t) curT=ev.detail.t; clearTimeout(drawT); drawT=setTimeout(draw,60); }
function hide(){ clearTimeout(drawT); cvs.forEach(function(c){ c.classList.add('nt'); c.style.opacity='0'; }); }
function onWindStop(){ if(on){ ownWind=false; stop(); } }
function start(){
  if(on) return; on=true; ensure(); leg.hidden=false; document.body.classList.add('ndsea');
  btn.setAttribute('aria-pressed','true'); btn.classList.add('on');
  map.on('movestart zoomstart',hide); map.on('moveend zoomend resize',later);
  window.addEventListener('psaro-windhour',later); window.addEventListener('psaro-windstop',onWindStop);
  map.getContainer().addEventListener('click',onTap,true);
  if(!windOn()&&window.PsaroWindMap&&window.PsaroWindMap.start){ ownWind=true; window.PsaroWindMap.start(); }
  status(T('Φόρτωση…','Loading…'));
  loadExt().then(function(){ if(on) later(); });
  later();
}
function stop(){
  on=false; clearTimeout(drawT); cvs.forEach(function(c){ c.style.opacity='0'; }); if(leg) leg.hidden=true; document.body.classList.remove('ndsea');
  btn.setAttribute('aria-pressed','false'); btn.classList.remove('on');
  map.off('movestart zoomstart',hide); map.off('moveend zoomend resize',later);
  window.removeEventListener('psaro-windhour',later); window.removeEventListener('psaro-windstop',onWindStop);
  try{ map.getContainer().removeEventListener('click',onTap,true); }catch(e){}
  if(tapMk){ try{ map.removeLayer(tapMk); }catch(e){} tapMk=null; } tapLL=null; var pt=document.getElementById('ndSeaPt'); if(pt) pt.hidden=true;
  if(ownWind&&windOn()&&window.PsaroWindMap&&window.PsaroWindMap.stop){ ownWind=false; window.PsaroWindMap.stop(); }
  ownWind=false;
}
btn.addEventListener('click',function(){ on?stop():start(); });
window.PsaroSeaState.start=start; window.PsaroSeaState.stop=stop; window.PsaroSeaState.pointInfo=pointInfo;
})();
