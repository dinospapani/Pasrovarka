/* Πρόγνωση δραστηριότητας ψαριών (ίδιο μοντέλο με την καρτέλα «Σήμερα») και έλεγχος για ειδοποιήσεις.
   Χρησιμοποιείται από τη σελίδα και από το service worker (importScripts). */
(function(g){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pad=n=>String(n).padStart(2,'0');
const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14);
const circDist=(a,b)=>{const d=Math.abs(a-b)%1440;return Math.min(d,1440-d);};
function sunMoon(dateStr,lat,lon,tz){
  const [y,m,d]=dateStr.split('-').map(Number);
  const noonUtc=Date.UTC(y,m-1,d,12);
  const n=Math.floor((noonUtc-Date.UTC(y,0,0))/86400000), la=lat*Math.PI/180;
  const gm=2*Math.PI/365*(n-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(gm)-0.032077*Math.sin(gm)-0.014615*Math.cos(2*gm)-0.040849*Math.sin(2*gm));
  const dec=0.006918-0.399912*Math.cos(gm)+0.070257*Math.sin(gm)-0.006758*Math.cos(2*gm)+0.000907*Math.sin(2*gm)-0.002697*Math.cos(3*gm)+0.00148*Math.sin(3*gm);
  const cosH=Math.cos(90.833*Math.PI/180)/(Math.cos(la)*Math.cos(dec))-Math.tan(la)*Math.tan(dec);
  const H=Math.acos(clamp(cosH,-1,1))*180/Math.PI;
  const noon=720-4*lon-eq+tz, rise=720-4*(lon+H)-eq+tz, set=720-4*(lon-H)-eq+tz;
  let age=((noonUtc-tz*60000-REF)/86400000)%SYN; if(age<0) age+=SYN;
  const f=age/SYN, transit=((noon+f*1440)%1440+1440)%1440;
  return {rise,set,f,transit,anti:(transit+745)%1440,mrise:((transit-373)%1440+1440)%1440,mset:(transit+373)%1440};
}
function hourScore(sm,hr,w){
  const wind=w.wind, wave=w.wave==null?0.5:w.wave;
  let base=50+Math.round(Math.cos(4*Math.PI*sm.f)*8);
  base+={slow:8,stable:3,rise:0,fast:-4}[w.ptrend||'stable'];
  base+=wind<5?2:wind<=12?4:wind<=18?-3:wind<=25?-12:-25;
  base+=wave<=0.5?3:wave<=1?0:wave<=1.5?-6:wave<=2?-15:-25;
  base+={clear:0,part:2,over:4}[w.cloud||'part'];
  if(w.gust!=null) base+=w.gust>=35?-10:w.gust>=28?-5:0;
  if(w.code!=null&&w.code>=95) base-=15;
  if(w.rain!=null&&w.rain>=70) base-=2;
  const t=hr*60+30; let b=0;
  const dTw=Math.min(circDist(t,sm.rise),circDist(t,sm.set)); if(dTw<=75) b+=14*(1-dTw/75);
  const dMaj=Math.min(circDist(t,sm.transit),circDist(t,sm.anti)); if(dMaj<=60) b+=10;
  const dMin=Math.min(circDist(t,sm.mrise),circDist(t,sm.mset)); if(dMin<=30) b+=5;
  if(t>=660&&t<=900) b-=4;
  return clamp(Math.round(base+b),5,98);
}
const bft=w=>[1,4,7,11,17,22,28,34,41,48,56,64].filter(x=>x<=w).length;
const safeHour=h=>h.wind<=14&&(h.wave==null||h.wave<=0.9)&&(h.gust==null||h.gust<=24)&&(h.code==null||h.code<95);
function ptrendOf(d){return d<=-3?'fast':d<=-1?'slow':d>=1?'rise':'stable';}
async function fetchJson(url,fetchFn){
  const f=fetchFn||fetch, ac=typeof AbortController!=='undefined'?new AbortController():null, t=ac&&setTimeout(()=>ac.abort(),12000);
  try{ const r=await f(url,ac?{signal:ac.signal}:undefined); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  finally{ if(t) clearTimeout(t); }
}
/* Επιστρέφει {days:[{date,best,win,hours,avgWind,avgWave,safe,why,wx}], tz, nowLocal}. opt.days = πόσες ημέρες (προεπιλογή 3, έως 14). */
async function getForecast(lat,lon,fetchFn,opt){
  const nd=Math.min(14,Math.max(1,(opt&&opt.days)||3));
  const q='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4);
  const [w,m]=await Promise.allSettled([
    fetchJson('https://api.open-meteo.com/v1/forecast?'+q+'&hourly=pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,temperature_2m,precipitation_probability,precipitation,weather_code&wind_speed_unit=kn&timezone=auto&past_days=1&forecast_days='+(nd+1),fetchFn),
    fetchJson('https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=wave_height,wave_period,sea_surface_temperature,sea_level_height_msl&timezone=auto&past_days=1&forecast_days='+(nd+1),fetchFn)
  ]);
  if(w.status!=='fulfilled') throw new Error('weather');
  const H=w.value.hourly||{}, T=H.time||[], tz=Math.round((w.value.utc_offset_seconds||0)/60);
  const mar={}; if(m.status==='fulfilled'&&m.value.hourly&&m.value.hourly.time){ const MH=m.value.hourly; MH.time.forEach((t,i)=>{mar[t]={wave:MH.wave_height?MH.wave_height[i]:null,period:MH.wave_period?MH.wave_period[i]:null,sst:MH.sea_surface_temperature?MH.sea_surface_temperature[i]:null,lvl:MH.sea_level_height_msl?MH.sea_level_height_msl[i]:null};}); }
  const tideAt=(t)=>{ const i=m.status==='fulfilled'&&m.value.hourly&&m.value.hourly.time?m.value.hourly.time.indexOf(t):-1; const L=i>0&&m.value.hourly.sea_level_height_msl; if(!L||typeof L[i-1]!=='number'||typeof L[i+1]!=='number') return null; const d=L[i+1]-L[i-1]; return d>0.01?'up':d<-0.01?'down':'slack'; };
  const nowLocal=new Date(Date.now()+tz*60000).toISOString().slice(0,16);
  const today=nowLocal.slice(0,10);
  const at=(k,i)=>H[k]?H[k][i]:null, nn=v=>typeof v==='number'?v:null;
  const byDay={};
  for(let i=0;i<T.length;i++){
    const t=T[i], date=t.slice(0,10); if(date<today) continue;
    const p=at('pressure_msl',i), p0=i>=3?H.pressure_msl[i-3]:null, c=at('cloud_cover',i), ws=at('wind_speed_10m',i);
    if(ws==null) continue;
    const mm=mar[t]||{};
    (byDay[date]=byDay[date]||[]).push({t,hr:+t.slice(11,13),wind:ws,gust:nn(at('wind_gusts_10m',i)),dir:nn(at('wind_direction_10m',i)),temp:nn(at('temperature_2m',i)),rain:nn(at('precipitation_probability',i)),mm:nn(at('precipitation',i)),code:nn(at('weather_code',i)),p:nn(p),cc:nn(c),
      wave:nn(mm.wave),period:nn(mm.period),sst:nn(mm.sst),tide:tideAt(t),ptrend:(p!=null&&p0!=null)?ptrendOf(p-p0):'stable',cloud:c==null?'part':c<20?'clear':c<70?'part':'over'});
  }
  const num=a=>a.filter(v=>typeof v==='number'), av=a=>{a=num(a);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}, mx=a=>{a=num(a);return a.length?Math.max(...a):null;}, mn=a=>{a=num(a);return a.length?Math.min(...a):null;};
  const days=[];
  for(const date of Object.keys(byDay).sort().slice(0,nd)){
    const sm=sunMoon(date,lat,lon,tz), rows=byDay[date];
    const hours=rows.map(h=>({t:h.t,hr:h.hr,p:h.p,wind:h.wind,wave:h.wave,gust:h.gust,code:h.code,ptrend:h.ptrend,tide:h.tide,score:hourScore(sm,h.hr,h),safe:safeHour(h)}));
    const day=h=>{const t=h.hr*60+30;return t>=sm.rise-60&&t<=sm.set+60;};
    const cand=hours.filter(h=>h.safe&&day(h)&&(date>today||h.t>=nowLocal.slice(0,13)+':00'));
    let best=0,win=null;
    if(cand.length){
      best=Math.max(...cand.map(h=>h.score)); const thr=best-6; let groups=[],cur=null;
      for(const h of hours){ if(h.safe&&h.score>=thr&&cand.includes(h)){ if(cur&&cur.e===h.hr-1){cur.e=h.hr;} else {cur={s:h.hr,e:h.hr};groups.push(cur);} } }
      win=groups.sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0]||null;
    }
    const used=win?hours.filter(h=>h.hr>=win.s&&h.hr<=win.e):hours;
    const why=cand.length?'':(hours.some(h=>h.safe&&day(h))?'night':'unsafe');
    const dr=rows.filter(r=>{const t=r.hr*60+30;return t>=sm.rise-60&&t<=sm.set+60;}), use=dr.length?dr:rows;
    const cnt={}; let storm=false; use.forEach(r=>{ if(r.code!=null){ cnt[r.code]=(cnt[r.code]||0)+1; if(r.code>=95) storm=true; } });
    const mode=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];
    const mid=rows.find(r=>r.hr===12)||rows[0];
    const wx={tmax:mx(rows.map(r=>r.temp)),tmin:mn(rows.map(r=>r.temp)),windAvg:av(use.map(r=>r.wind)),windMax:mx(use.map(r=>r.wind)),gustMax:mx(use.map(r=>r.gust)),windDir:mid?mid.dir:null,
      rainMax:mx(use.map(r=>r.rain)),rainMm:num(rows.map(r=>r.mm)).reduce((x,y)=>x+y,0),code:storm?95:(mode!=null?+mode:null),cloudAvg:av(use.map(r=>r.cc)),
      pStart:rows[0].p,pEnd:rows[rows.length-1].p,waveMax:mx(use.map(r=>r.wave)),waveAvg:av(use.map(r=>r.wave)),period:av(use.map(r=>r.period)),sst:av(rows.map(r=>r.sst)),illum:(1-Math.cos(2*Math.PI*sm.f))/2,rise:sm.rise,set:sm.set};
    days.push({date,f:sm.f,rise:sm.rise,set:sm.set,best,win,why,hours,avgWind:av(used.map(h=>h.wind)),avgWave:av(used.filter(h=>h.wave!=null).map(h=>h.wave)),safe:cand.length>0,wx});
  }
  return {days,tz,nowLocal};
}
/* Βρίσκει την πρώτη ιδανική ώρα τις επόμενες ~36 ώρες. */
function findIdeal(fc,threshold){
  const hourNow=fc.nowLocal.slice(0,13);
  for(const d of fc.days.slice(0,2)){
    if(!d.win||d.best<threshold) continue;
    const start=d.date+'T'+pad(d.win.s)+':00';
    if(d.date===fc.nowLocal.slice(0,10)&&start<hourNow+':00'&&d.win.e<+fc.nowLocal.slice(11,13)) continue;
    return {key:d.date+'T'+pad(d.win.s),date:d.date,win:d.win,best:d.best,wind:d.avgWind,wave:d.avgWave,isToday:d.date===fc.nowLocal.slice(0,10)};
  }
  return null;
}
function message(f){
  const day=f.isToday?'Σήμερα':'Αύριο';
  return {title:'Ιδανική ώρα για ψάρεμα',body:day+' '+pad(f.win.s)+':00–'+pad((f.win.e+1)%24)+':00 · δείκτης '+f.best+' · άνεμος '+bft(f.wind)+' Bft'+(f.wave!=null?' · κύμα '+f.wave.toFixed(1)+' m':'')};
}
/* cfg: {lat,lon,threshold,last}. Επιστρέφει {notify,key} ή null. */
async function check(cfg,fetchFn){
  if(!cfg||cfg.lat==null) return null;
  const fc=await getForecast(cfg.lat,cfg.lon,fetchFn);
  const f=findIdeal(fc,cfg.threshold||75);
  if(!f||f.key===cfg.last) return null;
  const m=message(f); return {title:m.title,body:m.body,key:f.key};
}
/* Απότομη αλλαγή πίεσης τις επόμενες ~30 ώρες: ≥3 hPa σε 3 ώρες ή ≥6 hPa σε 12 ώρες. */
function pressureEvent(fc){
  const now=fc.nowLocal.slice(0,13)+':00', fut=[];
  fc.days.forEach(d=>d.hours.forEach(h=>{ if(h.p!=null&&h.t>=now) fut.push(h); }));
  let best=null;
  for(const [n,lim] of [[3,3],[12,6]]){
    for(let i=0;i+n<fut.length&&i<30;i++){
      const d=fut[i+n].p-fut[i].p;
      if(Math.abs(d)>=lim&&(!best||Math.abs(d)/lim>best.k)) best={d,k:Math.abs(d)/lim,from:fut[i].p,to:fut[i+n].p,t:fut[i].t,hours:n};
    }
  }
  return best?{dir:best.d<0?'fall':'rise',delta:Math.round(Math.abs(best.d)*10)/10,from:Math.round(best.from),to:Math.round(best.to),t:best.t,hours:best.hours}:null;
}
const DN=['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
function dayLabel(date){ const dt=new Date(date+'T12:00:00Z'); return DN[dt.getUTCDay()]+' '+date.slice(8)+'/'+date.slice(5,7); }
function goodDays(fc,thr){ return fc.days.filter(d=>d.safe&&d.win&&d.best>=thr).map(d=>({date:d.date,best:d.best,win:d.win,wind:d.avgWind,wave:d.avgWave})); }
/* cfg: {places,threshold,notified,pressure}. Επιστρέφει πάντα {items,notified,title,body}. */
async function checkPlaces(cfg,fetchFn){
  const thr=cfg.threshold||75, notified=Object.assign({},cfg.notified||{}), goods=[], press=[];
  const today=new Date(Date.now()-86400000).toISOString().slice(0,10);
  for(const k of Object.keys(notified)){ if(k.split(':').pop()<today) delete notified[k]; }
  for(const p of cfg.places||[]){
    if(p.watch===false||p.lat==null) continue;
    try{
      const fc=await getForecast(p.lat,p.lon,fetchFn,{days:7});
      for(const g of goodDays(fc,thr)){ const key=p.id+':'+g.date; if(notified[key]) continue; goods.push({type:'good',place:p,key,date:g.date,best:g.best,win:g.win,wind:g.wind}); }
      if(cfg.pressure!==false){
        const ev=pressureEvent(fc);
        if(ev){ const key=p.id+':pr-'+ev.dir+':'+ev.t.slice(0,10); if(!notified[key]) press.push(Object.assign({type:'pressure',place:p,key},ev)); }
      }
    }catch(e){}
  }
  goods.sort((a,b)=>b.best-a.best);
  const top=goods.slice(0,4).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:b.best-a.best);
  const lines=top.map(i=>i.place.name+': '+dayLabel(i.date)+' · δείκτης '+i.best+' · '+pad(i.win.s)+':00–'+pad((i.win.e+1)%24)+':00');
  if(goods.length>top.length) lines.push('+'+(goods.length-top.length)+' ακόμα');
  const pl=press.slice(0,2).map(i=>i.place.name+': η πίεση '+(i.dir==='fall'?'πέφτει':'ανεβαίνει')+' '+i.delta+' hPa σε '+i.hours+' ώρες ('+i.from+'→'+i.to+'). '+(i.dir==='fall'?'Πριν αλλάξει ο καιρός τα ψάρια συχνά τσιμπούν πιο έντονα.':'Μετά από μεταβολή τα ψάρια συνήθως χρειάζονται λίγο να ξαναπιάσουν δουλειά.'));
  const items=goods.concat(press);
  items.forEach(i=>{notified[i.key]=1;});
  const title=goods.length&&press.length?'Ενημέρωση ψαρέματος':goods.length>1?'Καλές μέρες για ψάρεμα':goods.length?'Καλή μέρα για ψάρεμα':'Αλλαγή πίεσης';
  return {items,notified,title,body:lines.concat(pl).join('\n')};
}
g.PF={sunMoon,hourScore,getForecast,findIdeal,message,check,goodDays,checkPlaces,dayLabel,bft,pressureEvent};
})(typeof self!=='undefined'?self:this);
