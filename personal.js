/* Προσωπική πρόγνωση: μαθαίνει από τις έξοδες (ώρες ψαρέματος) και τα τσιμπήματα του χρήστη.
   Καθαρές συναρτήσεις, χωρίς DOM· δουλεύει και σε node. */
(function(g){
'use strict';
const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14), K=4;           // K = «εικονικές» ώρες πριν εμπιστευτούμε τα δεδομένα
const NEED={hours:15,sessions:6,catches:10};
const moonOf=ms=>{let a=((ms-REF)/86400000)%SYN; if(a<0)a+=SYN; return Math.floor(a/SYN*4+0.5)%4;};
const windCls=w=>w==null?null:w<8?0:w<=14?1:2;
const PTS=['fast','slow','stable','rise'];
const biteMs=(b,utcMin)=>{ if(!b||!b.date||!b.time) return null; const [y,m,d]=b.date.split('-').map(Number), [hh,mm]=b.time.split(':').map(Number); return Date.UTC(y,m-1,d,hh,mm)-utcMin*60000; };
function sessionsOf(trips){ return (trips||[]).filter(t=>t&&t.startMs&&t.endMs&&t.endMs>t.startMs&&(t.endMs-t.startMs)>=10*60000&&(t.endMs-t.startMs)<=16*3600000); }
const LV={block:8,moon:4,ptrend:4,wind:3};
function build(trips,bites,opt){
  const utcMin=(opt&&opt.utcMin)||0, S=sessionsOf(trips);
  const T={}; for(const k in LV) T[k]=Array.from({length:LV[k]},()=>({h:0,c:0}));
  let H=0,C=0;
  for(const s of S){
    const gross=s.endMs-s.startMs, sc=gross>0?Math.max(0,gross-(+s.pauseMs||0))/gross:1, hrs=gross*sc/3600000;
    const inS=s.manual?[]:(bites||[]).map(b=>({b,ms:biteMs(b,utcMin)})).filter(x=>x.ms!=null&&x.ms>=s.startMs-600000&&x.ms<=s.endMs+600000);
    const c=s.manual?Math.max(0,+s.count||0):inS.length; H+=hrs; C+=c;
    const bh=new Array(8).fill(0); // ώρες ανά τρίωρο, μοιράζουμε τον χρόνο ανά 10 λεπτά
    for(let t=s.startMs;t<s.endMs;t+=600000){ const loc=new Date(t+utcMin*60000); bh[Math.floor(loc.getUTCHours()/3)]+=Math.min(600000,s.endMs-t)/3600000*sc; }
    bh.forEach((v,i)=>{ T.block[i].h+=v; if(s.manual&&hrs>0) T.block[i].c+=c*v/hrs; });
    inS.forEach(x=>{ const loc=new Date(Math.min(Math.max(x.ms,s.startMs),s.endMs-1)+utcMin*60000); T.block[Math.floor(loc.getUTCHours()/3)].c++; });
    const mi=moonOf((s.startMs+s.endMs)/2); T.moon[mi].h+=hrs; T.moon[mi].c+=c;
    const cd=s.cond0||{}; const pi=PTS.indexOf(cd.ptrend); if(pi>=0){ T.ptrend[pi].h+=hrs; T.ptrend[pi].c+=c; }
    const wi=windCls(cd.wind); if(wi!=null){ T.wind[wi].h+=hrs; T.wind[wi].c+=c; }
  }
  const r0=H>0?C/H:0;
  const factors={};
  for(const k in T) factors[k]=T[k].map((x,i)=>{ const rate=(x.c+K*r0)/(x.h+K); return {i,h:x.h,c:x.c,rate:x.h?x.c/x.h:null,m:r0>0?rate/r0:1}; });
  const progress={hours:H,sessions:S.length,catches:C,need:NEED};
  const ready=H>=NEED.hours&&S.length>=NEED.sessions&&C>=NEED.catches;
  return {r0,factors,progress,ready,H,C,S:S.length};
}
function score(model,x){
  if(!model||!model.ready) return null;
  let l=0; const F=model.factors;
  if(x.hr!=null) l+=Math.log(F.block[Math.floor(x.hr/3)].m);
  if(x.f!=null) l+=Math.log(F.moon[Math.floor(x.f*4+0.5)%4].m);
  const pi=PTS.indexOf(x.ptrend); if(pi>=0) l+=Math.log(F.ptrend[pi].m);
  const wi=windCls(x.wind); if(wi!=null) l+=Math.log(F.wind[wi].m);
  return Math.max(5,Math.min(95,Math.round(50+38*Math.tanh(0.8*l))));
}
/* day = ημέρα του PF.getForecast (με day.f, day.rise, day.set). Επιστρέφει {best,win,hours} μόνο για ασφαλείς ώρες φωτός. */
function day(model,d,nowHourKey){
  if(!model||!model.ready) return null;
  const hours=d.hours.map(h=>({t:h.t,hr:h.hr,safe:h.safe,score:score(model,{hr:h.hr,f:d.f,ptrend:h.ptrend,wind:h.wind})}));
  const dl=h=>{const t=h.hr*60+30; return d.rise==null||(t>=d.rise-60&&t<=d.set+60);};
  const cand=hours.filter(h=>h.safe&&dl(h)&&(!nowHourKey||h.t>=nowHourKey));
  if(!cand.length) return {best:0,win:null,hours,safe:false};
  const best=Math.max(...cand.map(h=>h.score)), thr=best-6; let cur=null,groups=[];
  for(const h of hours){ if(cand.includes(h)&&h.score>=thr){ if(cur&&cur.e===h.hr-1) cur.e=h.hr; else {cur={s:h.hr,e:h.hr};groups.push(cur);} } }
  const win=groups.sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0]||null;
  return {best,win,hours,safe:true};
}
g.PP={build,score,day,sessionsOf,moonOf,NEED,biteMs};
if(typeof module!=='undefined') module.exports=g.PP;
})(typeof window!=='undefined'?window:globalThis);
