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
  const t=hr*60+30; let b=0;
  const dTw=Math.min(circDist(t,sm.rise),circDist(t,sm.set)); if(dTw<=75) b+=14*(1-dTw/75);
  const dMaj=Math.min(circDist(t,sm.transit),circDist(t,sm.anti)); if(dMaj<=60) b+=10;
  const dMin=Math.min(circDist(t,sm.mrise),circDist(t,sm.mset)); if(dMin<=30) b+=5;
  if(t>=660&&t<=900) b-=4;
  return clamp(Math.round(base+b),5,98);
}
const safeHour=h=>h.wind<=14&&(h.wave==null||h.wave<=0.9);
function ptrendOf(d){return d<=-3?'fast':d<=-1?'slow':d>=1?'rise':'stable';}
async function fetchJson(url,fetchFn){
  const f=fetchFn||fetch, ac=typeof AbortController!=='undefined'?new AbortController():null, t=ac&&setTimeout(()=>ac.abort(),12000);
  try{ const r=await f(url,ac?{signal:ac.signal}:undefined); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  finally{ if(t) clearTimeout(t); }
}
/* Επιστρέφει {days:[{date,best,win:{s,e}|null,hours:[{hr,score,wind,wave,safe}],avgWind,avgWave,safe}], tz, nowLocal:'YYYY-MM-DDTHH:MM'} */
async function getForecast(lat,lon,fetchFn){
  const q='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4);
  const [w,m]=await Promise.allSettled([
    fetchJson('https://api.open-meteo.com/v1/forecast?'+q+'&hourly=pressure_msl,wind_speed_10m,cloud_cover&wind_speed_unit=kn&timezone=auto&past_days=1&forecast_days=4',fetchFn),
    fetchJson('https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=wave_height&timezone=auto&past_days=1&forecast_days=4',fetchFn)
  ]);
  if(w.status!=='fulfilled') throw new Error('weather');
  const H=w.value.hourly||{}, T=H.time||[], tz=Math.round((w.value.utc_offset_seconds||0)/60);
  const waveBy={}; if(m.status==='fulfilled'&&m.value.hourly&&m.value.hourly.time){ m.value.hourly.time.forEach((t,i)=>{waveBy[t]=m.value.hourly.wave_height[i];}); }
  const nowLocal=new Date(Date.now()+tz*60000).toISOString().slice(0,16);
  const today=nowLocal.slice(0,10);
  const byDay={};
  for(let i=0;i<T.length;i++){
    const t=T[i], date=t.slice(0,10); if(date<today) continue;
    const p=H.pressure_msl[i], p0=i>=3?H.pressure_msl[i-3]:null, c=H.cloud_cover[i], ws=H.wind_speed_10m[i];
    if(ws==null) continue;
    const wave=typeof waveBy[t]==='number'?waveBy[t]:null;
    (byDay[date]=byDay[date]||[]).push({t,hr:+t.slice(11,13),wind:ws,wave:wave,ptrend:(p!=null&&p0!=null)?ptrendOf(p-p0):'stable',cloud:c==null?'part':c<20?'clear':c<70?'part':'over'});
  }
  const days=[];
  for(const date of Object.keys(byDay).sort().slice(0,3)){
    const sm=sunMoon(date,lat,lon,tz);
    const hours=byDay[date].map(h=>({t:h.t,hr:h.hr,wind:h.wind,wave:h.wave,score:hourScore(sm,h.hr,h),safe:safeHour(h)}));
    const day=h=>{const t=h.hr*60+30;return t>=sm.rise-60&&t<=sm.set+60;};
    const cand=hours.filter(h=>h.safe&&day(h)&&(date>today||h.t>=nowLocal.slice(0,13)+':00'));
    let best=0,win=null;
    if(cand.length){
      best=Math.max(...cand.map(h=>h.score)); const thr=best-6; let groups=[],cur=null;
      for(const h of hours){ if(h.safe&&h.score>=thr&&cand.includes(h)){ if(cur&&cur.e===h.hr-1){cur.e=h.hr;} else {cur={s:h.hr,e:h.hr};groups.push(cur);} } }
      win=groups.sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0]||null;
    }
    const used=win?hours.filter(h=>h.hr>=win.s&&h.hr<=win.e):hours;
    const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
    const why=cand.length?'':(hours.some(h=>h.safe&&day(h))?'night':'unsafe');
    days.push({date,best,win,why,hours,avgWind:avg(used.map(h=>h.wind)),avgWave:avg(used.filter(h=>h.wave!=null).map(h=>h.wave)),safe:cand.length>0});
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
  return {title:'Ιδανική ώρα για ψάρεμα',body:day+' '+pad(f.win.s)+':00–'+pad((f.win.e+1)%24)+':00 · δείκτης '+f.best+' · άνεμος '+Math.round(f.wind)+' kn'+(f.wave!=null?' · κύμα '+f.wave.toFixed(1)+' m':'')};
}
/* cfg: {lat,lon,threshold,last}. Επιστρέφει {notify,key} ή null. */
async function check(cfg,fetchFn){
  if(!cfg||cfg.lat==null) return null;
  const fc=await getForecast(cfg.lat,cfg.lon,fetchFn);
  const f=findIdeal(fc,cfg.threshold||75);
  if(!f||f.key===cfg.last) return null;
  const m=message(f); return {title:m.title,body:m.body,key:f.key};
}
g.PF={sunMoon,hourScore,getForecast,findIdeal,message,check};
})(typeof self!=='undefined'?self:this);
