(function(){
'use strict';
const $=id=>document.getElementById(id);
function h(tag,props,...kids){
  const e=document.createElement(tag);
  for(const k in (props||{})){
    const v=props[k]; if(v==null||v===false) continue;
    if(k==='class') e.className=v;
    else if(k==='text') e.textContent=v;
    else if(k.slice(0,2)==='on') e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat()){ if(c==null||c===false) continue; e.append(c.nodeType?c:document.createTextNode(String(c))); }
  return e;
}
const NS='http://www.w3.org/2000/svg';
function s(tag,attrs,text){
  const e=document.createElementNS(NS,tag);
  for(const k in (attrs||{})) e.setAttribute(k,attrs[k]);
  if(text!=null) e.textContent=text;
  return e;
}
const pad=n=>String(n).padStart(2,'0');
const fmt=m=>{m=((Math.round(m)%1440)+1440)%1440;return pad(Math.floor(m/60))+':'+pad(m%60);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

/* ---------- Time and astronomy ---------- */
const TZ='Asia/Nicosia';
let cond=lsGet('psaro-cond',null), refreshing=null;
const utcOff=()=>cond&&typeof cond.utc==='number'?cond.utc:-new Date().getTimezoneOffset();
const shifted=()=>new Date(Date.now()+utcOff()*60000);
const nicosiaToday=()=>shifted().toISOString().slice(0,10);
const nicosiaNowMin=()=>{const d=shifted();return d.getUTCHours()*60+d.getUTCMinutes();};
function tzOffsetMin(d){
  try{
    const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,timeZoneName:'shortOffset'}).formatToParts(d).find(x=>x.type==='timeZoneName').value;
    const m=/GMT([+-])(\d+)(?::(\d+))?/.exec(p);
    if(m) return (m[1]==='-'?-1:1)*(parseInt(m[2],10)*60+(m[3]?parseInt(m[3],10):0));
  }catch(e){}
  return 120;
}
const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14);
function sunMoon(dateStr){
  const [y,m,d]=dateStr.split('-').map(Number);
  const noonUtc=Date.UTC(y,m-1,d,12);
  const tz=utcOff();
  const n=Math.floor((noonUtc-Date.UTC(y,0,0))/86400000);
  const lat=cond&&cond.lat!=null?cond.lat:34.9, lon=cond&&cond.lon!=null?cond.lon:33.2, la=lat*Math.PI/180;
  const g=2*Math.PI/365*(n-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const cosH=Math.cos(90.833*Math.PI/180)/(Math.cos(la)*Math.cos(dec))-Math.tan(la)*Math.tan(dec);
  const H=Math.acos(clamp(cosH,-1,1))*180/Math.PI;
  const noon=720-4*lon-eq+tz, rise=720-4*(lon+H)-eq+tz, set=720-4*(lon-H)-eq+tz;
  let age=((noonUtc-tz*60000+0-REF)/86400000)%SYN; if(age<0) age+=SYN;
  const f=age/SYN;
  const illum=(1-Math.cos(2*Math.PI*f))/2;
  const transit=((noon+f*1440)%1440+1440)%1440;
  return {noon,rise,set,age,f,illum,transit,anti:(transit+745)%1440,mrise:((transit-373)%1440+1440)%1440,mset:(transit+373)%1440};
}
function moonName(f){
  const i=Math.floor(((f*8)+0.5))%8;
  return ['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα σελήνη','Πανσέληνος','Φθίνουσα σελήνη','Τελευταίο τέταρτο','Φθίνων μηνίσκος'][i];
}
function drawMoon(f){
  const svg=$('moonSvg'); svg.replaceChildren();
  const r=20, k=Math.cos(2*Math.PI*f), rx=r*Math.abs(k);
  svg.append(s('circle',{r:r,cx:0,cy:0,fill:'var(--line)',stroke:'var(--coast)','stroke-width':1}));
  const sweep=k>0?0:1;
  const gEl=s('g',{transform:f>0.5?'scale(-1,1)':''});
  gEl.append(s('path',{d:`M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`,fill:'var(--ink)'}));
  svg.append(gEl);
}
function circDist(a,b){const d=Math.abs(a-b)%1440;return Math.min(d,1440-d);}

/* ---------- Activity model ---------- */
function haversine(a,b,c,d){const R=6371,r=Math.PI/180,dl=(c-a)*r,dn=(d-b)*r,x=Math.sin(dl/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function personal(){
  const bs=Store.get('bites').filter(b=>b.time), n=bs.length;
  const P={n:n,enough:n>=12,on:false,hour:new Array(24).fill(0),press:{},moon:new Array(8).fill(0)};
  P.on=P.enough&&lsGet('psaro-pm',true)!==false;
  if(!P.enough) return P;
  const w=n/(n+25), cnt=new Array(24).fill(0);
  bs.forEach(b=>{const hh=+b.time.slice(0,2); [hh-1,hh,hh+1].forEach(x=>cnt[(x+24)%24]++);});
  for(let k=0;k<24;k++) P.hour[k]=Math.round(clamp(((cnt[k]/n)/0.125-1)*7,-6,10)*w);
  const pt={}, np=bs.filter(b=>b.ptrend).length; bs.forEach(b=>{if(b.ptrend) pt[b.ptrend]=(pt[b.ptrend]||0)+1;});
  if(np>=10) for(const k of ['slow','stable','rise','fast']) P.press[k]=Math.round(clamp((((pt[k]||0)/np)/0.25-1)*6,-5,8)*np/(np+25));
  const mc=new Array(8).fill(0); bs.forEach(b=>mc[biteMoon(b)]++);
  for(let k=0;k<8;k++) P.moon[k]=Math.round(clamp(((mc[k]/n)*8-1)*4,-4,6)*w);
  return P;
}
function compute(){
  const date=$('dDate').value||nicosiaToday();
  const wind=+$('dWind').value, wave=+$('dWave').value;
  const press=$('dPress').value, cloud=$('dCloud').value;
  const sm=sunMoon(date);
  const factors=[];
  const moon=Math.round(Math.cos(4*Math.PI*sm.f)*8);
  factors.push(['Φάση σελήνης',moon]);
  const pv={slow:8,stable:3,rise:0,fast:-4}[press]; factors.push(['Πίεση',pv]);
  const wv=wind<5?2:wind<=12?4:wind<=18?-3:wind<=25?-12:-25; factors.push(['Άνεμος',wv]);
  const cv=wave<=0.5?3:wave<=1?0:wave<=1.5?-6:wave<=2?-15:-25; factors.push(['Κύμα',cv]);
  const clv={clear:0,part:2,over:4}[cloud]; factors.push(['Ουρανός',clv]);
  const P=personal(), mIdx=Math.floor(sm.f*8+0.5)%8;
  const pmAdj=P.on?((P.press[press]||0)+P.moon[mIdx]):0;
  const base=50+factors.reduce((a,f)=>a+f[1],0)+pmAdj;
  const hours=[];
  for(let hr=0;hr<24;hr++){
    const t=hr*60+30; let b=0;
    const dTw=Math.min(circDist(t,sm.rise),circDist(t,sm.set));
    if(dTw<=75) b+=14*(1-dTw/75);
    const dMaj=Math.min(circDist(t,sm.transit),circDist(t,sm.anti));
    if(dMaj<=60) b+=10;
    const dMin=Math.min(circDist(t,sm.mrise),circDist(t,sm.mset));
    if(dMin<=30) b+=5;
    if(t>=660&&t<=900) b-=4;
    hours.push(clamp(Math.round(base+b+(P.on?P.hour[hr]:0)),5,98));
  }
  const day=clamp(Math.round(base),5,98);
  return {date,wind,wave,sm,factors,hours,day,P:P,pmAdj:pmAdj};
}
function bft(w){return [1,4,7,11,17,22,28,34,41,48,56,64].filter(x=>x<=w).length;}
const ICO={
  arrow:'<svg viewBox="0 0 24 24"><path d="M12 20V5M6 11l6-6 6 6"/></svg>',
  wave:'<svg viewBox="0 0 24 24"><path d="M2 9c3-4 5-4 8 0s5 4 8 0 3-3 4-2M2 16c3-4 5-4 8 0s5 4 8 0 3-3 4-2"/></svg>',
  gauge:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M12 5v2"/></svg>',
  temp:'<svg viewBox="0 0 24 24"><path d="M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z"/></svg>',
  drop:'<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>'
};
function tile(ico,label,val,sub,rot){
  const t=h('div',{class:'tile'}); const i=h('span',{class:'ti'}); i.innerHTML=ICO[ico]; if(rot!=null){ const sv=i.firstChild; sv.style.transform='rotate('+Math.round(rot)+'deg)'; }
  t.append(i,h('b',{text:val}),h('span',{class:'tl',text:label}),h('span',{class:'ts',text:sub||'\u00a0'})); return t;
}
const PT_ARROW={slow:'↘',stable:'→',rise:'↗',fast:'↓'};
function renderTiles(c){
  const box=$('tiles'); if(!box) return; box.replaceChildren();
  const k=cond||{}, dash='–';
  box.append(
    tile('arrow','Άνεμος',k.wind!=null?bft(k.wind)+' Bft':dash,wdir(k),k.windDeg!=null?k.windDeg+180:0),
    tile('wave','Κύμα',k.wave!=null?k.wave.toFixed(1)+' m':dash,k.wavePeriod?Math.round(k.wavePeriod)+' s':''),
    tile('gauge','Πίεση',k.press!=null?String(k.press):dash,(k.ptrend?PT_ARROW[k.ptrend]+' ':'')+'hPa'),
    tile('temp','Αέρας',k.temp!=null?Math.round(k.temp)+'°C':dash,''),
    tile('drop','Θάλασσα',k.sst!=null?Math.round(k.sst)+'°C':dash,''),
    tile('arrow','Ρεύμα',k.cur!=null?k.cur.toFixed(1)+' kn':dash,k.curDir!=null?dirName(k.curDir):'',k.curDir!=null?k.curDir:0));
}
function renderSea(){
  const box=$('seaTiles'); if(!box) return; box.replaceChildren();
  const k=cond||{}, dash='–';
  box.append(
    tile('drop','Θερμοκρασία',k.sst!=null?k.sst.toFixed(1)+'°C':dash,''),
    tile('arrow','Ρεύμα',k.cur!=null?k.cur.toFixed(2)+' kn':dash,k.curDir!=null?dirName(k.curDir):'',k.curDir!=null?k.curDir:0),
    tile('clock','Περίοδος κύματος',k.wavePeriod?Math.round(k.wavePeriod)+' s':dash,''));
  const n=$('seaNote'); let t='';
  if(k.cur==null) t='Δεν υπάρχουν δεδομένα ρεύματος για αυτή τη θέση.';
  else if(k.cur<0.3) t='Ασθενές ρεύμα: ελαφρύ μολύβι και φυσικό δόλωμα κάτω στο βυθό.';
  else if(k.cur<0.8) t='Ήπιο ρεύμα: τα ψάρια συγκεντρώνονται πίσω από βράχια και υφάλους. Ρίξε προς το ρεύμα.';
  else t='Ισχυρό ρεύμα: χρειάζεσαι βαρύτερο μολύβι και σταθερή άγκυρα.';
  if(k.sst!=null) t+=k.sst>=26?' Θερμό νερό: πιο δραστήρια ψάρια το πρωί και το βράδυ.':k.sst<=18?' Κρύο νερό: τα ψάρια είναι πιο αργά, ψάξε βαθύτερα.':'';
  n.textContent=t+' Δεδομένα μοντέλου, χαμηλής ανάλυσης κοντά στην ακτή.';
}
function renderStrip(c){
  const box=$('hdrStrip'); if(!box) return; box.replaceChildren();
  const k=cond||{}, sm=c.sm, dash='–';
  const ph=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'][Math.floor(sm.f*8+0.5)%8];
  const chip=(l,v)=>h('span',{class:'sc'},h('i',{text:l}),h('b',{text:v}));
  const rf=h('button',{type:'button',class:'sc rf',id:'hdrRef','aria-label':'Ανανέωση συνθηκών'},h('i',{text:'Τώρα'}),h('b',{text:'↻ '+(k.at||dash)}));
  rf.addEventListener('click',()=>{ rf.classList.add('spin'); refreshConditions().finally(()=>rf.classList.remove('spin')); });
  box.append(
    chip('Άνεμος',k.wind!=null?bft(k.wind)+' Bft'+(wdir(k)?' '+wdir(k):''):dash),
    chip('Πίεση',k.press!=null?k.press+' '+(k.ptrend?PT_ARROW[k.ptrend]:''):dash),
    chip('Κύμα',k.wave!=null?k.wave.toFixed(1)+' m':dash),
    chip('Ρεύμα',k.cur!=null?k.cur.toFixed(1)+' kn'+(k.curDir!=null?' '+dirName(k.curDir):''):dash),
    chip('Θάλασσα',k.sst!=null?Math.round(k.sst)+'°C':dash),
    chip(ph+' Σελήνη',Math.round(sm.illum*100)+'%'),
    chip('Ανατολή',fmt(sm.rise)),chip('Δύση',fmt(sm.set)),rf);
}
function drawSun(sm,date){
  const sv=$('sunArc'); if(!sv) return; sv.replaceChildren();
  const el=(n,p)=>{const e=document.createElementNS(NS,n); for(const k in p) e.setAttribute(k,p[k]); return e;};
  const rise=sm.rise,set=sm.set, now=nicosiaNowMin(), isToday=date===nicosiaToday();
  sv.append(el('path',{class:'arc',d:'M20 100 A140 80 0 0 1 300 100'}),el('line',{class:'hz',x1:8,y1:100,x2:312,y2:100}));
  const p=(now-rise)/(set-rise);
  if(isToday&&p>=0&&p<=1){
    const x=160-140*Math.cos(Math.PI*p), y=100-80*Math.sin(Math.PI*p);
    sv.append(el('path',{class:'arcd',d:'M20 100 A140 80 0 0 1 '+x.toFixed(1)+' '+y.toFixed(1)}),el('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:7,fill:'#f2b84b'}));
  }
  const tx=(x,y,t,anc)=>{const e=el('text',{x:x,y:y,'text-anchor':anc||'middle'}); e.textContent=t; return e;};
  sv.append(tx(20,116,fmt(rise),'middle'),tx(300,116,fmt(set),'middle'));
  const dl=Math.max(0,set-rise); sv.append(tx(160,116,Math.floor(dl/60)+(window.LANG==='en'?'h ':'ω ')+Math.round(dl%60)+(window.LANG==='en'?'m':'λ'),'middle'));
}
/* ---------- Πού να πας ---------- */
function bestSpots(c){
  const bs=Store.get('bites').filter(b=>typeof b.lat==='number'&&typeof b.lon==='number');
  const cands=[]; Store.get('spots').forEach(s=>{ if(typeof s.lat==='number') cands.push({name:s.name||'Σημείο',lat:s.lat,lon:s.lon}); });
  bs.forEach(b=>{ if(!cands.some(x=>haversine(x.lat,x.lon,b.lat,b.lon)<0.6)) cands.push({name:b.place||(b.lat.toFixed(3)+', '+b.lon.toFixed(3)),lat:b.lat,lon:b.lon}); });
  const k=cond||{}, hrNow=Math.floor(nicosiaNowMin()/60), wb=w=>w==null?null:w<8?0:w<=14?1:2;
  const out=[];
  for(const x of cands){
    const near=bs.filter(b=>haversine(x.lat,x.lon,b.lat,b.lon)<=0.6); if(!near.length) continue;
    let sim=0;
    for(const b of near){
      let w=1; const bh=b.time?+b.time.slice(0,2):null;
      if(bh!=null&&Math.min(Math.abs(bh-hrNow),24-Math.abs(bh-hrNow))<=3) w+=1;
      if(b.ptrend&&b.ptrend===($('dPress').value)) w+=0.5;
      if(wb(b.wind)!=null&&wb(b.wind)===wb(+$('dWind').value)) w+=0.5;
      sim+=w;
    }
    const dist=(k.lat!=null)?haversine(k.lat,k.lon,x.lat,x.lon):null;
    out.push({x:x,n:near.length,sim:sim,dist:dist});
  }
  return out.sort((a,b)=>b.sim-a.sim).slice(0,3);
}
function renderBest(c){
  const box=$('bestBody'); if(!box) return; box.replaceChildren();
  const all=Store.get('bites').filter(b=>typeof b.lat==='number');
  if(all.length<3){ box.append(h('p',{class:'note',text:'Όταν καταγράψεις τουλάχιστον 3 τσιμπήματα με θέση, εδώ θα βλέπεις σε ποια σημεία σου έχει πετύχει περισσότερο, σε παρόμοια ώρα και συνθήκες.'})); return; }
  const top=bestSpots(c);
  if(!top.length){ box.append(h('p',{class:'note',text:'Δεν βρέθηκε σημείο με αρκετά τσιμπήματα.'})); return; }
  top.forEach((t,i)=>{
    const sub=t.n+' τσιμπήματα στο σημείο'+(t.dist!=null?' · '+(t.dist<1?Math.round(t.dist*1000)+' m':t.dist.toFixed(1)+' km')+' από εσένα':'');
    box.append(h('div',{class:'bestrow'},h('span',{class:'rk',text:String(i+1)}),h('div',{style:'flex:1;min-width:0'},h('b',{text:t.x.name}),h('div',{class:'note',text:sub})),h('button',{class:'btn ghost sm',type:'button',text:'Χάρτης',onclick:()=>{switchTab('map');showOnMap(t.x.lat,t.x.lon);}})));
  });
  box.append(h('p',{class:'note',style:'margin:8px 0 0',text:'Βασίζεται στα δικά σου τσιμπήματα: ίδια περιοχή (έως 600 m), ώρα, πίεση και άνεμος παρόμοια με τώρα.'}));
}
function renderToday(){
  const c=compute();
  $('vWind').textContent=bft(c.wind)+' Bft';
  $('vWave').textContent=c.wave.toFixed(1)+' m';
  const sc=$('score'); sc.replaceChildren(String(c.day),h('small',{text:'/100'}));
  $('scoreText').textContent=c.day>=75?'Πολύ καλές προϋποθέσεις':c.day>=60?'Καλές προϋποθέσεις':c.day>=45?'Μέτριες προϋποθέσεις':'Δύσκολη μέρα για ψάρεμα';
  const rf=$('ringFg'); if(rf){ rf.style.strokeDashoffset=(326.7*(1-c.day/100)).toFixed(1); rf.setAttribute('class','rfg '+(c.day>=65?'good':c.day>=45?'mid':'bad')); }
  const lvl=(c.wind>20||c.wave>1.5)?'bad':(c.wind>14||c.wave>0.9)?'warn':'good';
  const pill=$('safePill'); pill.className='pill '+lvl;
  pill.textContent={good:'Ήπια θάλασσα',warn:'Προσοχή',bad:'Δύσκολες συνθήκες'}[lvl];
  $('safeText').textContent={good:'Συνθήκες κατάλληλες για έξοδο με μικρό σκάφος.',warn:'Αρκετός άνεμος ή κύμα για μικρό σκάφος. Κοίτα την πρόγνωση για ριπές.',bad:'Άνεμος ή κύμα ψηλά για μικρό σκάφος. Ξανασκέψου την έξοδο.'}[lvl];
  const fx=$('factors'); fx.replaceChildren();
  const pressTx={slow:['Πέφτει αργά','Η πίεση πέφτει αργά: τα ψάρια τρώνε πιο πολύ πριν αλλάξει ο καιρός.'],stable:['Σταθερή','Η πίεση είναι σταθερή: φυσιολογική δραστηριότητα.'],rise:['Ανεβαίνει','Η πίεση ανεβαίνει: συνήθως πιο ήσυχα ψάρια.'],fast:['Πέφτει απότομα','Η πίεση πέφτει απότομα: έρχεται αλλαγή καιρού και τα ψάρια συχνά σταματούν.']};
  const cloudTx={clear:['Καθαρός','Καθαρός ουρανός: δυνατό φως, τα ψάρια πάνε πιο βαθιά.'],part:['Λίγα σύννεφα','Λίγα σύννεφα: καλό, μαλακό φως.'],over:['Συννεφιά','Συννεφιά: χαμηλό φως, τα ψάρια πλησιάζουν πιο εύκολα.']};
  const moonTx=c.factors[0][1]>=4?'Κοντά σε νέα ή πανσέληνο: ισχυρότερα ρεύματα και πιο έντονη όρεξη στα ψάρια.':c.factors[0][1]<=-4?'Κοντά σε τέταρτο: πιο ήρεμα ρεύματα και λιγότερη όρεξη στα ψάρια.':'Ενδιάμεση φάση σελήνης: ουδέτερη επίδραση.';
  const windTx=c.wind<5?'Σχεδόν άπνοια: εύκολο ψάρεμα και ασφαλής έξοδος.':c.wind<=12?'Ήπιος άνεμος: ιδανικός, ανακατεύει λίγο την επιφάνεια.':c.wind<=18?'Αρκετός άνεμος: δύσκολο το ψάρεμα και η ρίψη.':c.wind<=25?'Δυνατός άνεμος: κουραστικό και ανασφαλές για μικρό σκάφος.':'Πολύ δυνατός άνεμος: μην βγεις με μικρό σκάφος.';
  const waveTx=c.wave<=0.5?'Ήρεμη θάλασσα: καλή για ψάρεμα και ασφαλής.':c.wave<=1?'Μικρό κύμα: αποδεκτό.':c.wave<=1.5?'Μέτριο κύμα: ταλαιπωρεί το σκάφος και δυσκολεύει το ψάρεμα.':c.wave<=2?'Μεγάλο κύμα: δύσκολο και επικίνδυνο για μικρό σκάφος.':'Πολύ μεγάλο κύμα: μην βγεις με μικρό σκάφος.';
  const rows=[
    ['Σελήνη',moonName(c.sm.f),c.factors[0][1],moonTx],
    ['Πίεση',pressTx[$('dPress').value][0],c.factors[1][1],pressTx[$('dPress').value][1]],
    ['Άνεμος',bft(c.wind)+' Bft',c.factors[2][1],windTx],
    ['Κύμα',c.wave.toFixed(1)+' m',c.factors[3][1],waveTx],
    ['Ουρανός',cloudTx[$('dCloud').value][0],c.factors[4][1],cloudTx[$('dCloud').value][1]]
  ];
  const good=[],bad=[];
  for(const [n,val,v,tx] of rows){
    const k=v>=2?'good':v<=-3?'bad':'mid';
    if(k==='good') good.push(n); if(k==='bad') bad.push(n);
    fx.append(h('div',{class:'fx'},h('div',{class:'fxh'},h('b',{text:n}),h('span',{class:'mono',text:val}),h('span',{class:'fxc '+k,text:k==='good'?'Βοηθά':k==='bad'?'Δεν βοηθά':'Ουδέτερο'})),h('div',{class:'note',text:tx})));
  }
  const EN_=window.LANG==='en', nmE={'Σελήνη':'Moon','Πίεση':'Pressure','Άνεμος':'Wind','Κύμα':'Waves','Ουρανός':'Sky'}, jn=l=>l.map(x=>EN_?nmE[x]:x).join(', ');
  if(EN_) fx.prepend(h('p',{class:'note fxs',text:'Score 0–100: how favourable conditions are for fish to bite. 50 is average. Helps: '+(jn(good)||'nothing in particular')+'. Does not help: '+(jn(bad)||'nothing')+'.'}));
  else fx.prepend(h('p',{class:'note fxs',text:'Βαθμός 0–100: πόσο ευνοϊκές είναι οι συνθήκες για να τσιμπήσουν τα ψάρια. Το 50 είναι ο μέσος όρος. Βοηθά: '+(good.join(', ')||'τίποτα ιδιαίτερα')+'. Δεν βοηθά: '+(bad.join(', ')||'τίποτα')+'.'}));
  const dt=h('details',{class:'fxd'},h('summary',{text:'Δες τους πόντους'}),h('div',{class:'factors'},h('div',{class:'muted',text:'Βάση'}),h('div',{class:'v',text:'50'})));
  for(const [n,v] of c.factors){ dt.querySelector('.factors').append(h('div',{text:n}),h('div',{class:'v '+(v>0?'pos':v<0?'neg':''),text:(v>0?'+':'')+v})); }
  fx.append(dt);
  const P=c.P;
  if(P.enough){
    const row=h('div',{class:'fx'},h('div',{class:'fxh'},h('b',{text:'Δικό σου ιστορικό'}),h('span',{class:'mono',text:P.n+' τσιμπήματα'}),h('span',{class:'fxc '+(!P.on?'mid':c.pmAdj>=2?'good':c.pmAdj<=-3?'bad':'mid'),text:P.on?(c.pmAdj>0?'+':'')+c.pmAdj:'Κλειστό'})),
      h('div',{class:'note',text:'Δείχνει πότε και με ποια πίεση ή σελήνη σου έχουν τσιμπήσει στο παρελθόν. Δεν ξέρει πότε δεν ψάρεψες, οπότε είναι ένδειξη και όχι κανόνας.'}));
    const cb=h('input',{type:'checkbox',id:'pmOn'}); cb.checked=P.on; cb.addEventListener('change',()=>{lsSet('psaro-pm',cb.checked);renderToday();});
    row.append(h('label',{class:'chk',style:'border:0'},cb,h('span',{text:'Χρήση του ιστορικού μου στον βαθμό'})));
    fx.insertBefore(row,dt);
  } else if(P.n>0){ fx.insertBefore(h('p',{class:'note',text:'Μετά από 12 τσιμπήματα ο βαθμός θα προσαρμόζεται στο δικό σου ιστορικό.'}),dt); }
  renderTiles(c); renderSea(); renderBest(c);
  drawHours(c);
  const sm=c.sm;
  $('moonName').textContent=moonName(sm.f);
  $('moonSub').textContent='Φωτισμός '+Math.round(sm.illum*100)+'% · ηλικία '+sm.age.toFixed(1)+' ημέρες';
  drawMoon(sm.f);
  $('illumBar').style.width=Math.round(sm.illum*100)+'%';
  const toNew=((1-sm.f)%1)*SYN, toFull=((0.5-sm.f+1)%1)*SYN, addD=n=>{const [y,m,d]=c.date.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d+Math.round(n)));return pad(dt.getUTCDate())+'/'+pad(dt.getUTCMonth()+1);};
  $('moonNext').textContent=(window.LANG==='en'?'Next full moon: '+addD(toFull)+' · new moon: '+addD(toNew):'Επόμενη πανσέληνος: '+addD(toFull)+' · νέα σελήνη: '+addD(toNew));
  renderStrip(c);
  drawSun(sm,c.date);
  const st=$('sunTimes'); st.replaceChildren();
  for(const [a,b] of [['Ανατολή ηλίου',fmt(sm.rise)],['Δύση ηλίου',fmt(sm.set)],['Ανατολή σελήνης',fmt(sm.mrise)],['Δύση σελήνης',fmt(sm.mset)],['Σελήνη στο ζενίθ',fmt(sm.transit)],['Σελήνη στο ναδίρ',fmt(sm.anti)]]){
    st.append(h('span',{class:'muted',text:a}),h('span',{text:b}));
  }
}
function drawHours(c){
  const svg=$('hourChart'); svg.replaceChildren();
  const W=480,H=150,L=8,R=8,T=14,B=22, bw=(W-L-R)/24, ch=H-T-B;
  const mx=Math.max(...c.hours);
  c.hours.forEach((v,i)=>{
    const hgt=Math.max(2,v/100*ch), x=L+i*bw+1.5;
    const cls=v>=mx-6?'b-hi':v>=mx-18?'b-mid':'b-lo';
    svg.append(s('rect',{x:x,y:T+ch-hgt,width:bw-3,height:hgt,rx:1.5,class:cls}));
  });
  const xm=m=>L+(m/1440)*(W-L-R);
  for(const [m,l] of [[c.sm.rise,'↑ '+fmt(c.sm.rise)],[c.sm.set,'↓ '+fmt(c.sm.set)]]){
    svg.append(s('line',{x1:xm(m),x2:xm(m),y1:T-4,y2:T+ch,stroke:'var(--accent)','stroke-width':1.2,'stroke-dasharray':'3 3'}));
    svg.append(s('text',{x:xm(m),y:10,'text-anchor':'middle'},l));
  }
  if(c.date===nicosiaToday()){
    const n=nicosiaNowMin();
    svg.append(s('line',{x1:xm(n),x2:xm(n),y1:T,y2:T+ch,stroke:'var(--ink)','stroke-width':1.5}));
  }
  for(const hr of [0,6,12,18,24]) svg.append(s('text',{x:L+hr*bw,y:H-6,'text-anchor':hr===0?'start':hr===24?'end':'middle'},pad(hr%24)+':00'));
  const thr=mx-6, groups=[]; let cur=null;
  c.hours.forEach((v,i)=>{ if(v>=thr){ if(cur&&cur.e===i-1){cur.e=i;cur.m=Math.max(cur.m,v);} else {cur={s:i,e:i,m:v};groups.push(cur);} } });
  groups.sort((a,b)=>b.m-a.m);
  const w=$('windows'); w.replaceChildren();
  groups.slice(0,3).sort((a,b)=>a.s-b.s).forEach(g=>w.append(h('span',{text:pad(g.s)+':00 – '+pad((g.e+1)%24)+':00'})));
}

/* ---------- Store (this device, localStorage) ---------- */
const Store=(function(){
  const cache={spots:[],trips:[],bites:[]}, subs={spots:[],trips:[],bites:[]}, hooks=[];
  let tombs=[];
  const emit=k=>subs[k].forEach(f=>f(cache[k]));
  const persist=k=>lsSet('psaro-'+k,cache[k]);
  const ptomb=()=>lsSet('psaro-tomb',tombs);
  const changed=(k,id)=>hooks.forEach(f=>{try{f(k,id);}catch(e){}});
  async function init(){
    for(const k in cache){cache[k]=lsGet('psaro-'+k,[]);} for(const k in cache) emit(k);
    tombs=lsGet('psaro-tomb',[]);
    try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
  }
  async function save(k,obj){
    const id=obj.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6));
    const data=Object.assign({},obj,{id:id,_u:Date.now()});
    cache[k]=cache[k].filter(x=>x.id!==id).concat([data]); tombs=tombs.filter(t=>!(t.k===k&&t.id===id)); persist(k); ptomb(); emit(k); changed(k,id); return id;
  }
  async function remove(k,id){cache[k]=cache[k].filter(x=>x.id!==id);tombs=tombs.filter(t=>!(t.k===k&&t.id===id)).concat([{k:k,id:id,u:Date.now()}]);persist(k);ptomb();emit(k);changed(k,id);}
  /* Συγχρονισμός: ενσωμάτωση από τον server (το πιο πρόσφατο κερδίζει) */
  function mergeIn(k,id,data,deleted,u){
    const cur=cache[k].find(x=>x.id===id), t=tombs.find(x=>x.k===k&&x.id===id);
    const lu=Math.max(cur?(cur._u||0):0,t?t.u:0);
    if(u<=lu) return false;
    if(deleted){ cache[k]=cache[k].filter(x=>x.id!==id); tombs=tombs.filter(x=>!(x.k===k&&x.id===id)).concat([{k:k,id:id,u:u}]); }
    else { cache[k]=cache[k].filter(x=>x.id!==id).concat([Object.assign({},data,{id:id,_u:u})]); tombs=tombs.filter(x=>!(x.k===k&&x.id===id)); }
    return true;
  }
  function flush(){ for(const k in cache){persist(k);emit(k);} ptomb(); }
  function wipe(){ for(const k in cache){cache[k]=[];} tombs=[]; flush(); }
  return {init,save,remove,mergeIn,flush,wipe,tombs:()=>tombs,hook:f=>hooks.push(f),on:(k,f)=>{subs[k].push(f);f(cache[k]);},get:k=>cache[k]};
})();

/* ---------- Photos (IndexedDB) ---------- */
const Photos=(function(){
  let dbp=null;
  const db=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('psarovarka',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));
  async function tx(mode,fn){const d=await db();return new Promise((res,rej)=>{const t=d.transaction('photos',mode);const rq=fn(t.objectStore('photos'));t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});}
  return {put:(id,b)=>tx('readwrite',s=>s.put(b,id)),get:id=>tx('readonly',s=>s.get(id)),del:id=>tx('readwrite',s=>s.delete(id))};
})();
window.PsaroCore={Store:Store,Photos:Photos,toast:null};
window.addEventListener('psaro-pickfc',()=>startPick('fc'));
async function resizeImage(file){
  let bmp;
  try{ bmp=await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch(e){ bmp=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(file);}); }
  const w=bmp.width||bmp.naturalWidth, hh=bmp.height||bmp.naturalHeight, k=Math.min(1,1280/Math.max(w,hh));
  const cv=document.createElement('canvas'); cv.width=Math.round(w*k); cv.height=Math.round(hh*k);
  cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
  return new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('blob')),'image/jpeg',0.78));
}
const toast=(m)=>{const e=$('toast');e.textContent=m;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3500);};
window.PsaroCore.toast=toast; window.PsaroCore.Photos=Photos;

/* ---------- Map (Leaflet, world) ---------- */
const REFS=[['Πάφος',32.41,34.75],['Λατσί',32.43,35.04],['Λεμεσός',33.04,34.67],['Ακρ. Γάτα',33.03,34.56],['Ζύγι',33.34,34.72],['Λάρνακα',33.63,34.91],['Κάβο Γκρέκο',34.08,34.96]];
const TILES={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
let map=null,baseSat,baseOsm,seaL,youM=null,pendM=null,spotsG,bitesG,popup=null;
const markerById={};
let selSpot=null,pending=null,pick=null,pickedPt=null;
const purl=new Map();
async function loadPhoto(id,img){
  try{
    let u=purl.get(id);
    if(!u){const bl=await Photos.get(id); if(!bl) return; u=URL.createObjectURL(bl); purl.set(id,u);}
    img.src=u; img.hidden=false;
  }catch(e){}
}
/* ---------- Restricted fishing areas ---------- */
const ZONES=window.ZONES||[];
function inRing(lat,lon,r){
  let c=false;
  for(let i=0,j=r.length-1;i<r.length;j=i++){
    const yi=r[i][0],xi=r[i][1],yj=r[j][0],xj=r[j][1];
    if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) c=!c;
  }
  return c;
}
function zonesAt(lat,lon){
  if(lat==null||lon==null) return [];
  return ZONES.filter(z=>{ let n=0; for(const r of z.p) if(inRing(lat,lon,r)) n++; return n%2===1; });
}
let zonesG=null;
function zoneText(z){ return z.n+': '+z.d; }
function checkZoneHere(){
  const w=$('zoneWarn'); if(!w) return;
  const z=cond&&cond.lat!=null?zonesAt(cond.lat,cond.lon):[];
  if(z.length){ w.textContent='⚠ Είσαι μέσα σε περιοχή απαγόρευσης. '+z.map(zoneText).join(' | '); w.hidden=false; } else w.hidden=true;
}
function showZone(z){
  switchTab('map'); if(!map) return;
  map.fitBounds(L.polygon(z.p[0]).getBounds(),{maxZoom:15,padding:[30,30]});
}
function initMap(){
  if(typeof L==='undefined'){ $('lmap').textContent='Ο χάρτης δεν φόρτωσε.'; return; }
  const last=lsGet('psaro-view',null), c=cond&&cond.lat!=null?[cond.lat,cond.lon]:null;
  map=L.map('lmap',{minZoom:2,worldCopyJump:true,zoomControl:false}).setView(last?[last.lat,last.lon]:(c||[34.9,33.2]),last?last.z:(c?10:8));
  L.control.zoom({position:'topleft'}).addTo(map);
  baseSat=L.tileLayer(TILES.sat,{maxZoom:18,attribution:'Esri'});
  baseOsm=L.tileLayer(TILES.osm,{maxZoom:19,attribution:'© OpenStreetMap'});
  seaL=L.tileLayer(TILES.sea,{maxZoom:18,attribution:'OpenSeaMap'});
  let lay=lsGet('psaro-layer','sat'); (lay==='osm'?baseOsm:baseSat).addTo(map);
  $('bLayer').addEventListener('click',()=>{
    if(lay==='sat'){map.removeLayer(baseSat);baseOsm.addTo(map);lay='osm';} else {map.removeLayer(baseOsm);baseSat.addTo(map);lay='sat';}
    lsSet('psaro-layer',lay); if(map.hasLayer(seaL)) seaL.bringToFront();
  });
  const wmsU='https://ows.emodnet-bathymetry.eu/wms', depthC=L.tileLayer.wms(wmsU,{layers:'emodnet:mean_multicolour',format:'image/png',transparent:true,opacity:.6,version:'1.3.0',attribution:'EMODnet Bathymetry'}), depthK=L.tileLayer.wms(wmsU,{layers:'emodnet:contours',format:'image/png',transparent:true,version:'1.3.0',attribution:'EMODnet Bathymetry'});
  let dm=+lsGet('psaro-depth',0)||0;
  const applyDepth=()=>{ [depthC,depthK].forEach(l=>{ if(map.hasLayer(l)) map.removeLayer(l); }); if(dm===1) depthC.addTo(map); if(dm===2) depthK.addTo(map); if(map.hasLayer(seaL)) seaL.bringToFront(); $('bDepth').setAttribute('aria-pressed',String(dm!==0)); $('bDepth').title=['Βάθη θάλασσας: κλειστά','Βάθη θάλασσας: χρώματα','Βάθη θάλασσας: γραμμές βάθους'][dm]; };
  applyDepth();
  $('bDepth').addEventListener('click',()=>{ dm=(dm+1)%3; lsSet('psaro-depth',dm); applyDepth(); toast(['Βάθη: κλειστά','Βάθη: χρώματα','Βάθη: γραμμές βάθους'][dm]); });
  $('bSea').addEventListener('click',()=>{
    const on=!map.hasLayer(seaL); if(on) seaL.addTo(map); else map.removeLayer(seaL);
    $('bSea').setAttribute('aria-pressed',String(on));
  });
  $('bLoc').addEventListener('click',async()=>{ const c2=await refreshConditions(); if(c2&&c2.lat!=null) map.flyTo([c2.lat,c2.lon],Math.max(map.getZoom(),12)); });
  $('bSpotPick').addEventListener('click',()=>startPick('spot'));
  $('mapHintX').addEventListener('click',()=>{const was=pick; endPick(); if(was==='bite') openSheet(); if(was==='fc') switchTab('fc');});
  zonesG=L.layerGroup();
  for(const z of ZONES){
    L.polygon(z.p,{color:'#e02020',weight:2,fillColor:'#e02020',fillOpacity:.22}).bindPopup(()=>h('div',{class:'pop'},h('b',{text:z.n}),h('div',{text:z.d}),h('div',{class:'note',text:'Επιβεβαίωσε στο Cy-FIS και στον νόμο.'}))).addTo(zonesG);
  }
  const zOn=lsGet('psaro-zones',true); if(zOn) zonesG.addTo(map); $('bZones').setAttribute('aria-pressed',String(!!zOn));
  $('bZones').addEventListener('click',()=>{
    const on=!map.hasLayer(zonesG); if(on) zonesG.addTo(map); else map.removeLayer(zonesG);
    $('bZones').setAttribute('aria-pressed',String(on)); lsSet('psaro-zones',on);
  });
  spotsG=L.layerGroup().addTo(map); bitesG=L.layerGroup().addTo(map);
  map.on('moveend',()=>{const p=map.getCenter(); lsSet('psaro-view',{lat:+p.lat.toFixed(4),lon:+p.lng.toFixed(4),z:map.getZoom()});});
  map.on('click',e=>{
    const ll=e.latlng.wrap(), lat=+ll.lat.toFixed(5), lon=+ll.lng.toFixed(5);
    if(pick==='fc'){ endPick(); switchTab('fc'); window.dispatchEvent(new CustomEvent('psaro-fcpick',{detail:{lat:lat,lon:lon}})); return; }
    if(pick==='spot'){ endPick(); openSpotForm({lat:lat,lon:lon}); return; }
    if(pick==='bite'){ endPick(); pickedPt={lat:lat,lon:lon}; $('bLocMode').value='pick'; syncLoc(); openSheet(); return; }
    const box=h('div',{class:'pop'},h('div',{class:'mono',text:lat.toFixed(4)+', '+lon.toFixed(4)}),
      h('div',{class:'row',style:'margin-top:6px'},
        h('button',{class:'btn sm',type:'button',text:'Νέο σημείο',onclick:()=>{map.closePopup();openSpotForm({lat:lat,lon:lon});}}),
        h('button',{class:'btn ghost sm',type:'button',text:'Πρόγνωση εδώ',onclick:()=>{map.closePopup();switchTab('fc');window.dispatchEvent(new CustomEvent('psaro-fcpick',{detail:{lat:lat,lon:lon}}));}}),
        h('button',{class:'btn acc sm',type:'button',text:'Τσίμπημα εδώ',onclick:()=>{map.closePopup();pickedPt={lat:lat,lon:lon};$('bLocMode').value='pick';syncLoc();openSheet();}})));
    L.popup().setLatLng(ll).setContent(box).openOn(map);
  });
  if(cond&&cond.lat!=null) setYou(cond.lat,cond.lon);
  checkZoneHere();
}
function setYou(lat,lon){
  if(!map) return;
  if(youM) youM.setLatLng([lat,lon]); else youM=L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="you"></div>',iconSize:[18,18]}),interactive:false,zIndexOffset:-100}).addTo(map);
}
function startPick(mode){
  pick=mode; $('mapHint').hidden=false; document.body.classList.add('picking');
  $('mapHintTxt').textContent=mode==='fc'?'Πάτα στον χάρτη για πρόγνωση σε αυτό το σημείο':mode==='spot'?'Πάτα στον χάρτη για το νέο σημείο':'Πάτα στον χάρτη εκεί που έπιασες';
  switchTab('map');
}
function endPick(){ pick=null; $('mapHint').hidden=true; document.body.classList.remove('picking'); }
function showOnMap(lat,lon,id){
  switchTab('map'); if(!map) return;
  map.flyTo([lat,lon],Math.max(map.getZoom(),13));
  const m=markerById[id]; if(m) setTimeout(()=>m.openPopup(),800);
}
function catchPopup(b){
  const img=h('img',{class:'pimg',alt:'Φωτογραφία ψαριού'}); img.hidden=true;
  const cd=[b.wind!=null?bft(b.wind)+' Bft':null,b.wave!=null?b.wave+(window.LANG==='en'?' m wave':' m κύμα'):null,b.press!=null?b.press+' hPa':null,b.sst!=null?Math.round(b.sst)+'°C θάλασσα':null,MOON_LBL[biteMoon(b)]].filter(Boolean).join(' · ');
  const size=[b.kg?b.kg+' kg':null,b.len?b.len+' cm':null].filter(Boolean).join(' · ');
  return h('div',{class:'pop'},img,h('b',{text:b.species||'Άγνωστο'}),b.latin?h('div',{class:'meta',text:b.latin}):null,
    h('div',{class:'meta mono',text:(b.date||'')+' '+(b.time||'')}),
    size?h('div',{text:size}):null,
    (b.bait||b.tech)?h('div',{class:'meta',text:[b.bait,b.tech].filter(Boolean).join(' · ')}):null,
    cd?h('div',{class:'meta',text:cd}):null,b.notes?h('div',{class:'meta',text:b.notes}):null);
}
function drawMap(){
  if(!map) return;
  spotsG.clearLayers(); bitesG.clearLayers();
  for(const k in markerById) delete markerById[k];
  for(const sp of Store.get('spots')){
    if(typeof sp.lat!=='number'||typeof sp.lon!=='number') continue;
    const m=L.marker([sp.lat,sp.lon],{icon:L.divIcon({className:'',html:'<div class="mk-spot'+(sp.id===selSpot?' sel':'')+'"></div>',iconSize:[22,22]}),title:sp.name});
    m.bindTooltip(sp.name||'',{direction:'right',offset:[10,0],className:'lbl'});
    m.bindPopup(()=>h('div',{class:'pop'},h('b',{text:sp.name||'Χωρίς όνομα'}),h('div',{class:'meta',text:[sp.type,sp.depth!=null?sp.depth+' m':null].filter(Boolean).join(' · ')}),sp.notes?h('div',{class:'meta',text:sp.notes}):null,
      h('div',{class:'row',style:'margin-top:6px'},h('button',{class:'btn acc sm',type:'button',text:'Τσίμπημα εδώ',onclick:()=>{map.closePopup();pickedPt=null;$('bLocMode').value='spot';syncLoc();$('bSpot').value=sp.id;openSheet();}}))));
    m.addTo(spotsG); markerById[sp.id]=m;
  }
  for(const b of Store.get('bites')){
    if(typeof b.lat!=='number'||typeof b.lon!=='number') continue;
    const m=L.marker([b.lat,b.lon],{icon:L.divIcon({className:'',html:'<div class="mk-fish'+(b.photo?' ph':'')+'">🐟</div>',iconSize:[30,30]}),title:b.species||''});
    m.bindPopup(()=>catchPopup(b),{minWidth:180});
    m.on('popupopen',e=>{const im=e.popup.getElement().querySelector('img.pimg'); if(im&&b.photo) loadPhoto(b.id,im);});
    m.addTo(bitesG); markerById[b.id]=m;
  }
  if(pendM){map.removeLayer(pendM);pendM=null;}
  if(pending) pendM=L.circleMarker([pending.lat,pending.lon],{radius:10,color:'#d8431c',weight:3,fillOpacity:.15}).addTo(map);
}
function openSpotForm(p){
  pending=(p&&typeof p.lat==='number')?{lat:p.lat,lon:p.lon}:null;
  switchTab('map');
  $('spotForm').hidden=false;
  $('sLat').value=p&&p.lat!=null?p.lat:''; $('sLon').value=p&&p.lon!=null?p.lon:'';
  $('sErr').textContent=''; drawMap();
  $('spotForm').scrollIntoView({behavior:'smooth',block:'center'});
  $('sName').focus({preventScroll:true});
}
function closeSpotForm(){ pending=null; $('spotForm').hidden=true; $('spotForm').reset(); drawMap(); }
$('sNew').addEventListener('click',()=>openSpotForm({}));
$('sCancel').addEventListener('click',closeSpotForm);
['sLat','sLon'].forEach(id=>$(id).addEventListener('input',()=>{
  const la=parseFloat($('sLat').value),lo=parseFloat($('sLon').value);
  pending=(isFinite(la)&&isFinite(lo))?{lat:la,lon:lo}:null; drawMap();
}));
$('spotForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const la=parseFloat($('sLat').value),lo=parseFloat($('sLon').value);
  if(!(la>=-90&&la<=90&&lo>=-180&&lo<=180)){$('sErr').textContent='Γράψε έγκυρο πλάτος και μήκος σε δεκαδικές μοίρες, ή πάτα στον χάρτη.';return;}
  const depth=$('sDepth').value===''?null:+$('sDepth').value;
  try{
    const id=await Store.save('spots',{name:$('sName').value.trim(),type:$('sType').value,lat:la,lon:lo,depth:depth,notes:$('sNotes').value.trim()});
    selSpot=id; closeSpotForm();
  }catch(err){$('sErr').textContent='Δεν αποθηκεύτηκε. Δοκίμασε ξανά.';}
});
function copyText(t,btn){
  const done=()=>{const o=btn.textContent;btn.textContent='Αντιγράφηκε';setTimeout(()=>btn.textContent=o,1200);};
  try{ navigator.clipboard.writeText(t).then(done,()=>{}); }catch(e){}
}
function renderSpots(){
  const L=$('spotList'); L.replaceChildren();
  const spots=Store.get('spots').slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','el'));
  if(!spots.length){ L.append(h('div',{class:'empty',text:'Δεν έχεις αποθηκεύσει σημεία ακόμα. Πάτα πάνω στον χάρτη ή στο κουμπί «Νέο σημείο με συντεταγμένες».'})); }
  for(const sp of spots){
    const coord=(typeof sp.lat==='number'?sp.lat.toFixed(5):'?')+', '+(typeof sp.lon==='number'?sp.lon.toFixed(5):'?');
    const cb=h('button',{class:'btn ghost sm',type:'button',text:'Αντιγραφή'});
    cb.addEventListener('click',()=>copyText(coord,cb));
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('spots',sp.id);}catch(e){}
    });
    const it=h('div',{class:'item'+(sp.id===selSpot?' sel':'')},
      h('div',{},h('b',{text:sp.name||'Χωρίς όνομα'}),h('div',{class:'meta',text:[sp.type,sp.depth!=null?sp.depth+' m':null].filter(Boolean).join(' · ')}),h('div',{class:'meta mono',text:coord}),sp.notes?h('div',{class:'meta',text:sp.notes}):null),
      h('div',{class:'acts'},cb,del));
    it.firstChild.addEventListener('click',()=>{selSpot=sp.id;drawMap();renderSpots();if(typeof sp.lat==='number') showOnMap(sp.lat,sp.lon,sp.id);});
    L.append(it);
  }
  const dl=$('spotNames'); dl.replaceChildren(); for(const sp of spots) dl.append(h('option',{value:sp.name}));
  const bs=$('bSpot'), cur=bs.value; bs.replaceChildren(h('option',{value:'',text:'Χωρίς σημείο'}));
  for(const sp of spots) bs.append(h('option',{value:sp.id,text:sp.name}));
  bs.value=spots.some(x=>x.id===cur)?cur:'';
}

/* ---------- Log ---------- */
function renderTrips(){
  const trips=Store.get('trips').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const n=trips.length, fish=trips.reduce((a,t)=>a+(+t.count||0),0), kg=trips.reduce((a,t)=>a+(+t.kg||0),0);
  const by={}; trips.forEach(t=>{if(t.spot)by[t.spot]=(by[t.spot]||0)+(+t.count||0);});
  const best=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
  const st=$('stats'); st.replaceChildren();
  for(const [lab,val] of [['Έξοδοι',n],['Ψάρια',fish],['Kg',kg.toFixed(1)]]) st.append(h('div',{},h('b',{text:val}),h('span',{class:'label',text:lab})));
  const L=$('tripList'); L.replaceChildren();
  if(best&&best[1]>0) L.append(h('p',{class:'muted',text:'Πιο παραγωγικό σημείο: '+best[0]+' ('+best[1]+' ψάρια)'}));
  if(!n) L.append(h('div',{class:'empty',text:'Καμία έξοδος καταγεγραμμένη. Συμπλήρωσε τη φόρμα πάνω μετά το επόμενο ψάρεμα.'}));
  for(const t of trips){
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('trips',t.id);}catch(e){}
    });
    const dayB=Store.get('bites').filter(b=>b.date===t.date);
    let det=null;
    if(dayB.length){
      const kgT=dayB.reduce((s,b)=>s+(+b.kg||0),0), by=(f)=>{const o={}; dayB.forEach(b=>{const k=(b[f]||'').trim(); if(k) o[k]=(o[k]||0)+1;}); return Object.entries(o).sort((x,y)=>y[1]-x[1]);};
      const hrs=new Array(24).fill(0); dayB.forEach(b=>{if(b.time) hrs[+b.time.slice(0,2)]++;}); const mx=Math.max(1,...hrs);
      const times=dayB.filter(b=>b.time).map(b=>b.time).sort();
      const bars=h('div',{class:'minibars'}); hrs.forEach((n,k)=>bars.append(h('i',{style:'height:'+Math.round(n/mx*100)+'%;'+(n?'':'opacity:.15'),title:pad(k)+':00 · '+n})));
      det=h('details',{class:'trdet'},h('summary',{text:'Τσιμπήματα εκείνης της ημέρας'}),
        h('div',{class:'tr'},h('span',{text:'Τσιμπήματα'}),h('b',{text:String(dayB.length)})),
        h('div',{class:'tr'},h('span',{text:'Συνολικό βάρος'}),h('b',{text:kgT.toFixed(1)+' kg'})),
        times.length?h('div',{class:'tr'},h('span',{text:'Πρώτο και τελευταίο'}),h('b',{text:times[0]+' – '+times[times.length-1]})):null,
        by('species').length?h('div',{class:'tr'},h('span',{text:'Είδη'}),h('b',{text:by('species').map(e=>e[0]+' ×'+e[1]).join(', ')})):null,
        by('bait').length?h('div',{class:'tr'},h('span',{text:'Δολώματα'}),h('b',{text:by('bait').map(e=>e[0]+' ×'+e[1]).join(', ')})):null,
        by('tech').length?h('div',{class:'tr'},h('span',{text:'Τεχνικές'}),h('b',{text:by('tech').map(e=>e[0]+' ×'+e[1]).join(', ')})):null,
        h('div',{class:'label',style:'margin-top:6px',text:'Ώρες που τσίμπησε (00 → 23)'}),bars);
    }
    L.append(h('div',{class:'item'},
      h('div',{},h('b',{text:(t.date||'')+(t.spot?' · '+t.spot:'')}),
        h('div',{class:'meta',text:[t.tech,(t.count||0)+' ψάρια',(+t.kg||0).toFixed(1)+' kg',t.species].filter(Boolean).join(' · ')}),
        t.notes?h('div',{class:'meta',text:t.notes}):null,det),
      h('div',{class:'acts'},del)));
  }
}
$('tripForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    await Store.save('trips',{date:$('tDate').value,spot:$('tSpot').value.trim(),tech:$('tTech').value,species:$('tSpecies').value.trim(),count:+$('tCount').value||0,kg:+$('tKg').value||0,notes:$('tNotes').value.trim()});
    $('tSpot').value='';$('tSpecies').value='';$('tCount').value='0';$('tKg').value='0';$('tNotes').value='';
  }catch(err){}
});

/* ---------- Guide ---------- */
const SPECIES=[
 {n:'Λαυράκι',l:'Dicentrarchus labrax',w:'Κοντά στην ακτή, σε βράχια, λιμάνια και εκβολές.',m:'Spinning με τεχνητά, ζωντανό δόλωμα.',t:'Συχνά τα χαράματα και το σούρουπο.'},
 {n:'Τσιπούρα',l:'Sparus aurata',w:'Αμμώδεις και λασπώδεις πυθμένες, περίπου 5–30 m.',m:'Βυθού με οστρακοειδή.',t:'Πίεση που πέφτει αργά βοηθά.'},
 {n:'Σαργός',l:'Diplodus sargus',w:'Βραχώδεις ακτές και ρηχά.',m:'Βυθού με ελαφρύ μολύβι και κατάλληλο δόλωμα.',t:'Δουλεύει με λίγο κύμα που ανακατεύει τον πυθμένα.'},
 {n:'Λιθρίνι',l:'Pagellus erythrinus',w:'Αμμώδεις και λασπώδεις πυθμένες, περίπου 20–100 m.',m:'Βυθού με πολλά αγκίστρια.',t:'Συχνά σε βαθύτερα νερά.'},
 {n:'Συναγρίδα',l:'Dentex dentex',w:'Βραχώδεις πυθμένες και ύφαλοι, περίπου 20–100 m.',m:'Ζωντανό δόλωμα, jigging.',t:'Επιθετικό αρπακτικό. Θέλει γερό εξοπλισμό.'},
 {n:'Φαγκρί',l:'Pagrus pagrus',w:'Βραχώδεις και μικτοί πυθμένες, περίπου 20–100 m.',m:'Βυθού, jigging.',t:'Ψάρι βάθους, συνήθως πάνω από ύφαλο.'},
 {n:'Σφυρίδα',l:'Epinephelus marginatus',w:'Βράχια και σπηλιές.',m:'Βυθού με γερή πετονιά.',t:'Απειλούμενο είδος σε πολλές περιοχές. Έλεγξε τα ισχύοντα μέτρα προστασίας πριν κρατήσεις ψάρι.',warn:'Προστασία'},
 {n:'Μαγιάτικο',l:'Seriola dumerili',w:'Ανοιχτά, γύρω από υφάλους και υποβρύχια ανάγλυφα.',m:'Jigging, ζωντανό δόλωμα.',t:'Δυνατός αγώνας. Χρειάζεται βαρύς εξοπλισμός.'},
 {n:'Κυνηγός',l:'Coryphaena hippurus',w:'Ανοιχτή θάλασσα, κοντά σε πλωτά αντικείμενα.',m:'Τρόλινγκ.',t:'Στη Μεσόγειο εμφανίζεται συνήθως από το τέλος του καλοκαιριού ως το φθινόπωρο.'},
 {n:'Λούτσος',l:'Sphyraena sphyraena',w:'Επιφάνεια ως μέσα νερά, κοντά σε ακτή και υφάλους.',m:'Τρόλινγκ, spinning.',t:'Κοφτερά δόντια. Χρησιμοποίησε ατσαλένιο ή fluorocarbon ηγέτη.'},
 {n:'Λαγοκέφαλος',l:'Lagocephalus sceleratus',w:'Εισβλητικό είδος σε όλα τα βάθη κοντά στην ακτή.',m:'Πιάνεται τυχαία σε διάφορες τεχνικές.',t:'Δηλητηριώδης. Περιέχει τετροδοτοξίνη. Δεν τρώγεται, δεν δίνεται και δεν πωλείται. Κόβει πετονιές και δαγκώνει.',warn:'Τοξικό'},
 {n:'Λεοντόψαρο',l:'Pterois miles',w:'Βράχια και ύφαλοι, σε μικρά και μεσαία βάθη.',m:'Πιάνεται τυχαία στον πυθμένα.',t:'Εισβλητικό. Τα αγκάθια είναι δηλητηριώδη. Χειρίσου με γάντια και τσιμπίδα.',warn:'Αγκάθια'}
];
const strip=x=>(x||'').toLowerCase().replace(/ς/g,'σ').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const CY=(window.CY100||[]);
const CYL={}; CY.forEach(c=>{const k=c.l.toLowerCase(); if(!CYL[k]) CYL[k]=c;});
const DB=(window.SPECIES_DB||[]).map(r=>({el:r[0],en:r[1],la:r[2],k:''}));
for(const c of CY){
  const row=DB.find(x=>x.la.toLowerCase()===c.l.toLowerCase());
  if(row){ if(!row.el) row.el=c.n; if(!row.en) row.en=c.e; row.alt=(row.alt||'')+' '+c.n; }
  else DB.push({el:c.n,en:c.e,la:c.l,k:''});
}
DB.forEach(x=>{x.k=strip((x.el||'')+' '+(x.en||'')+' '+x.la+' '+(x.alt||''));});
const DETAIL={}; SPECIES.forEach(x=>DETAIL[x.l.toLowerCase()]=x);
function searchDB(q,max){
  q=strip(q.trim()); if(!q) return [];
  const out=[];
  for(const sp of DB){ const i=sp.k.indexOf(q); if(i<0) continue; const w=i===0||/[ \/]/.test(sp.k[i-1]); out.push([w?0:1,sp]); }
  out.sort((a,b)=>a[0]-b[0]);
  return out.slice(0,max).map(x=>x[1]);
}
const dispName=sp=>sp.el||sp.en;
let gbifSeen=[];
async function gbifSearch(q){
  const j=await fetchJson('https://api.gbif.org/v1/species/search?q='+encodeURIComponent(q)+'&rank=SPECIES&status=ACCEPTED&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&limit=15');
  const FISH=['Actinopterygii','Elasmobranchii','Holocephali','Petromyzonti','Cephalaspidomorphi','Sarcopterygii','Chondrichthyes'];
  return (j.results||[]).filter(r=>FISH.includes(r.class)&&(r.canonicalName||r.scientificName)).map(r=>{
    const v=(r.vernacularNames||[]).find(x=>x.language==='eng'); 
    return {el:null,en:v?v.vernacularName:(r.canonicalName||r.scientificName),la:r.canonicalName||r.scientificName,k:''};
  });
}
let imgP=null;
function loadFishImgs(){ if(window.FISH_IMG) return Promise.resolve(); if(!imgP) imgP=new Promise(r=>{const s=document.createElement('script');s.src='fish-photos.js';s.onload=()=>r();s.onerror=()=>{imgP=null;r();};document.head.append(s);}); return imgP; }
function spItem(sp){
  const d=DETAIL[(sp.la||'').toLowerCase()], cy=CYL[(sp.la||'').toLowerCase()];
  const slug=(sp.la||'').trim().replace(/\s+/g,'-');
  const fb=h('a',{href:'https://www.fishbase.se/summary/'+encodeURIComponent(slug)+'.html',target:'_blank',rel:'noopener',text:'FishBase'});
  const body=d?h('dl',{class:'dl'},h('dt',{text:'Πού'}),h('dd',{text:d.w}),h('dt',{text:'Πώς'}),h('dd',{text:d.m}),h('dt',{text:'Σημείωση'}),h('dd',{text:d.t}))
    :h('p',{class:'muted',text:'Δεν υπάρχει αναλυτική περιγραφή στην εφαρμογή. Δες περισσότερα στο '}) ;
  if(!d&&!cy) body.append(fb);
  const ci=cy?CY.indexOf(cy):-1; const pic=h('img',{class:'spimg',alt:cy?cy.n:'',hidden:true});
  const det=h('details',{class:'sp'},
    h('summary',{},h('span',{},h('b',{text:cy?((window.LANG==='en'&&cy.e)?cy.e+' ('+cy.n+')':cy.n):(d?d.n:dispName(sp))}),d&&d.warn?h('span',{class:'tag',text:d.warn}):null,(sp.el&&sp.en&&!d)?h('span',{class:'muted',text:' · '+sp.en}):null),h('span',{class:'lat',text:sp.la})),
    h('div',{class:'body'},cy?h('p',{text:cy.t}):null,cy?h('p',{class:'note',text:'Πηγή: «Τα 100 σημαντικότερα είδη ψαριών των κυπριακών θαλασσών», Τμήμα Αλιείας και Θαλασσίων Ερευνών, Κύπρος.'}):null,(d&&cy)?h('h3',{text:'Πρακτικά για το ψάρεμα',style:'margin-top:10px'}):null,d?body:(cy?null:body)));
  det.querySelector('.body').prepend(pic);
  if(ci>=0) det.addEventListener('toggle',()=>{ if(!det.open||pic.src) return; loadFishImgs().then(()=>{const u=(window.FISH_IMG||[])[ci]; if(u){pic.src=u;pic.hidden=false;}}); });
  return det;
}
function renderSpecies(extra){
  const q=$('spQ').value.trim(); const L=$('spList'); L.replaceChildren();
  $('spCount').textContent=(q?'':'Τα 100 είδη των κυπριακών θαλασσών (Τμήμα Αλιείας). ')+'Στη βάση: '+DB.length+' είδη, ενδεικτική λίστα.';
  let list;
  if(!q){
    list=CY.slice().sort((x,y)=>x.n.localeCompare(y.n,'el')).map(c=>({el:c.n,en:c.e,la:c.l}));
    SPECIES.forEach(x=>{ if(!CYL[x.l.toLowerCase()]) list.push({el:x.n,en:'',la:x.l}); });
  }
  else list=searchDB(q,60).concat(Array.isArray(extra)?extra.filter(e=>!DB.some(d=>d.la.toLowerCase()===e.la.toLowerCase())):[]);
  for(const sp of list) L.append(spItem(sp));
  if(!L.children.length) L.append(h('div',{class:'empty',text:'Κανένα είδος δεν ταιριάζει. Δοκίμασε αναζήτηση online.'}));
  $('spOnline').hidden=q.length<3;
}
$('spOnline').addEventListener('click',async()=>{
  const b=$('spOnline'); b.disabled=true; b.textContent='Αναζήτηση…';
  try{ const r=await gbifSearch($('spQ').value.trim()); renderSpecies(r); if(!r.length) toast('Δεν βρέθηκαν ψάρια online.'); }
  catch(e){ toast('Η online αναζήτηση δεν δούλεψε.'); }
  b.disabled=false; b.textContent='Αναζήτηση online (GBIF)';
});
$('spQ').addEventListener('input',()=>renderSpecies());
const TECH=[
 {n:'Βυθού',d:'Καλάμι με μολύβι και ένα ή περισσότερα αγκίστρια κοντά στον πυθμένα. Κατάλληλο για σαργούς, τσιπούρες, λιθρίνια.',g:'Καλάμι 2,4–3 m, πετονιά 0,25–0,35 mm, μολύβι ανάλογα με το ρεύμα.'},
 {n:'Jigging',d:'Κάθετη κίνηση μεταλλικού τεχνητού κοντά σε ύφαλο ή κατωφλι. Καλό για συναγρίδες και μαγιάτικα.',g:'Κοντό καλάμι jigging, μηχανισμός με καλή τριβή, braid, jigs 60–200 g.'},
 {n:'Τρόλινγκ',d:'Τράβηγμα τεχνητών πίσω από το σκάφος με σταθερή ταχύτητα. Για κυνηγούς, λούτσους και άλλα επιφανειακά.',g:'Ταχύτητα περίπου 4–7 κόμβοι, ηγέτες ανθεκτικοί στα δόντια.'},
 {n:'Spinning',d:'Ρίψη και μάζεμα τεχνητών κοντά στη ακτογραμμή ή πάνω από ρηχούς υφάλους. Για λαυράκια και λούτσους.',g:'Καλάμι 2,1–2,7 m, braid 0,15–0,25 mm, ηγέτης fluorocarbon.'},
 {n:'Ζωντανό δόλωμα',d:'Ζωντανό ψαράκι σε αγκίστρι, ελεύθερο ή στον πυθμένα. Για μεγάλα αρπακτικά.',g:'Δυνατό καλάμι, ηγέτης ανάλογα με το είδος, καλή φροντίδα του δολώματος.'}
];
function renderTech(){
  const L=$('g-tech'); L.replaceChildren();
  for(const t of TECH) L.append(h('div',{class:'card'},h('h3',{text:t.n}),h('p',{text:t.d}),h('div',{class:'note',text:'Εξοπλισμός: '+t.g})));
  L.append(h('p',{class:'note',text:'Οι τιμές είναι ενδεικτικές. Προσάρμοσέ τες στο σημείο, το ψάρι-στόχο και το ρεύμα.'}));
}
const CHECKS=['Σωσίβια για όλους στο σκάφος','VHF και φορτισμένο κινητό','Φάρμακα και κουτί πρώτων βοηθειών','Πυρσοί και σήμα κινδύνου','Άγκυρα και αρκετό σχοινί','Καύσιμο με εφεδρεία','Νερό και προστασία από τον ήλιο','Τσιμπίδα και γάντια για αγκάθια','Πρόγνωση καιρού ελεγμένη','Ενημέρωση κάποιου στη στεριά για τη διαδρομή'];
function renderChecks(){
  const saved=lsGet('psaro-checks',{}); const C=$('checks'); C.replaceChildren();
  CHECKS.forEach((t,i)=>{
    const id='ck'+i, cb=h('input',{type:'checkbox',id:id});
    cb.checked=!!saved[i];
    cb.addEventListener('change',()=>{const s2=lsGet('psaro-checks',{});s2[i]=cb.checked;lsSet('psaro-checks',s2);});
    C.append(h('div',{class:'chk'},cb,h('label',{for:id,text:t})));
  });
}
document.querySelectorAll('#tab-guide .seg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#tab-guide .seg button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  for(const g of ['species','tech','law','safety']) $('g-'+g).hidden=(g!==b.dataset.g);
}));

/* ---------- Bites and statistics ---------- */
document.querySelectorAll('#logSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#logSeg button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  for(const g of ['trips','bites','stats']) $('l-'+g).hidden=(g!==b.dataset.l);
}));
const nowLocalInput=()=>nicosiaToday()+'T'+fmt(nicosiaNowMin());
const PT=window.LANG==='en'?{slow:'Falling slowly',stable:'Steady',rise:'Rising',fast:'Falling fast'}:{slow:'Πέφτει αργά',stable:'Σταθερή',rise:'Ανεβαίνει',fast:'Πέφτει απότομα'};
const MOON_LBL=['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα','Πανσέληνος','Φθίνουσα','Τελευταίο τέταρτο','Φθίνων μηνίσκος'];
function biteMs(b){
  const [y,m,d]=(b.date||nicosiaToday()).split('-').map(Number), [hh,mm]=(b.time||'12:00').split(':').map(Number);
  const off=b.tz!=null?b.tz:tzOffsetMin(new Date(Date.UTC(y,m-1,d,12)));
  return Date.UTC(y,m-1,d,hh,mm)-off*60000;
}
function biteMoon(b){let a=((biteMs(b)-REF)/86400000)%SYN; if(a<0)a+=SYN; return Math.floor(a/SYN*8+0.5)%8;}
const norm=t=>(t||'').trim().toLowerCase();

/* quick-log sheet */
let photoBlob=null, curLatin='', sheetFresh=true, editRec=null;
function syncLoc(){
  const m=$('bLocMode').value;
  $('bSpotWrap').hidden=m!=='spot'; $('bPickWrap').hidden=m!=='pick';
  $('bPickTxt').textContent=pickedPt?pickedPt.lat.toFixed(4)+', '+pickedPt.lon.toFixed(4):'Δεν έχει επιλεγεί θέση.';
}
function openSheet(){
  if(sheetFresh){
    $('bWhen').value=nowLocalInput();
    if(cond&&cond.press!=null) $('bPress').value=cond.press;
    sheetFresh=false;
    refreshConditions();
  }
  renderChips(); syncLoc(); updateLaw();
  $('sheet').hidden=false;
}
function closeSheet(keep){ $('sheet').hidden=true; $('bSug').hidden=true; if(editRec&&keep!==true) resetSheet(); }
function resetSheet(){
  $('biteForm').reset(); photoBlob=null; curLatin=''; pickedPt=null; sheetFresh=true; editRec=null;
  $('bPrev').hidden=true; $('bPrevX').hidden=true; $('bAI').hidden=true; $('bAIOut').replaceChildren(); $('bAIMsg').textContent=''; $('bLaw').textContent=''; $('bErr').textContent='';
}
$('fab').addEventListener('click',openSheet);
$('bNew').addEventListener('click',openSheet);
$('bClose').addEventListener('click',()=>closeSheet());
$('sheet').addEventListener('click',e=>{ if(e.target===$('sheet')) closeSheet(); });
$('bLocMode').addEventListener('change',()=>{syncLoc();updateLaw();});
$('bPickBtn').addEventListener('click',()=>{ closeSheet(true); startPick('bite'); });
['bFile','bCam'].forEach(id=>$(id).addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    photoBlob=await resizeImage(f);
    $('bPrev').src=URL.createObjectURL(photoBlob); $('bPrev').hidden=false; $('bPrevX').hidden=false; $('bAI').hidden=false; $('bAIOut').replaceChildren(); $('bAIMsg').textContent='';
  }catch(err){ toast('Η φωτογραφία δεν διαβάστηκε.'); }
  e.target.value='';
}));
$('bPrevX').addEventListener('click',()=>{photoBlob=null;$('bPrev').hidden=true;$('bPrevX').hidden=true;$('bAI').hidden=true;$('bAIOut').replaceChildren();$('bAIMsg').textContent='';});
function renderChips(){
  const bites=Store.get('bites').slice().sort((a,b)=>biteMs(b)-biteMs(a));
  const uniq=(arr,n)=>[...new Set(arr.map(x=>(x||'').trim()).filter(Boolean))].slice(0,n);
  const fill=(el,items,input)=>{el.replaceChildren(); items.forEach(x=>el.append(h('button',{type:'button',class:'chip',text:x,onclick:()=>{input.value=x; if(input===$('bSpecies')){const m=DB.find(d=>dispName(d)===x); curLatin=m?m.la:(bites.find(b=>b.species===x)||{}).latin||''; updateLaw();}}})));};
  fill($('bChipsSp'),uniq(bites.map(b=>b.species),6),$('bSpecies'));
  fill($('bChipsBait'),uniq(bites.map(b=>b.bait),6),$('bBait'));
}
/* species suggestions */
let sugT=null, sugSeq=0;
function showSug(items){
  const box=$('bSug'); box.replaceChildren();
  items.forEach(sp=>box.append(h('button',{type:'button',class:'sugi',onclick:()=>{ $('bSpecies').value=dispName(sp); curLatin=sp.la; box.hidden=true; updateLaw(); }},h('b',{text:dispName(sp)}),h('span',{class:'lat',text:(sp.el&&sp.en?sp.en+' · ':'')+sp.la}))));
  box.hidden=!items.length;
}
$('bSpecies').addEventListener('input',()=>{
  curLatin=''; const q=$('bSpecies').value.trim();
  clearTimeout(sugT);
  if(q.length<2){ $('bSug').hidden=true; return; }
  const local=searchDB(q,8); showSug(local);
  if(q.length>=4&&local.length<4){
    const seq=++sugSeq;
    sugT=setTimeout(async()=>{
      try{ const r=await gbifSearch(q); if(seq!==sugSeq||$('bSpecies').value.trim()!==q) return;
        showSug(local.concat(r.filter(e=>!local.some(d=>d.la.toLowerCase()===e.la.toLowerCase())).slice(0,6))); }catch(e){}
    },500);
  }
});
$('bSpecies').addEventListener('blur',()=>setTimeout(()=>{$('bSug').hidden=true;},200));
$('biteForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=$('biteForm').querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Αποθήκευση…';
  $('bErr').textContent='';
  try{
    const [date,time]=$('bWhen').value.split('T');
    const mode=$('bLocMode').value;
    const editing=editRec;
    const isNow=!editing&&Math.abs(biteMs({date:date,time:time,tz:utcOff()})-Date.now())<90*60000;
    let c=cond;
    if(isNow||(mode==='auto'&&!cond)) c=await refreshConditions();
    let lat=null,lon=null,place='';
    if(mode==='auto'&&c&&c.lat!=null){lat=c.lat;lon=c.lon;}
    else if(mode==='spot'){const sp=Store.get('spots').find(x=>x.id===$('bSpot').value); if(sp){lat=sp.lat;lon=sp.lon;place=sp.name;}}
    else if(mode==='pick'&&pickedPt){lat=pickedPt.lat;lon=pickedPt.lon;}
    else if(mode==='keep'&&editing){lat=editing.lat;lon=editing.lon;place=editing.place||'';}
    const num=id=>$(id).value===''?null:+$(id).value;
    const sName=$('bSpecies').value.trim();
    let rec={date:date,time:(time||'12:00').slice(0,5),tz:utcOff(),species:sName,latin:curLatin||'',bait:$('bBait').value.trim(),tech:$('bTech').value,
      depth:num('bDepth'),kg:num('bKg'),len:num('bLen'),press:num('bPress'),notes:$('bNotes').value.trim(),
      ptrend:isNow?$('dPress').value:null,wind:isNow?+$('dWind').value:null,wave:isNow?+$('dWave').value:null,cloud:isNow?$('dCloud').value:null,
      temp:isNow&&c&&c.temp!=null?c.temp:null,sst:isNow&&c&&c.sst!=null?c.sst:null,
      place:place,lat:lat,lon:lon,photo:!!photoBlob,src:'app'};
    if(editing){ rec=Object.assign({},editing,{date:rec.date,time:rec.time,species:rec.species,latin:rec.latin,bait:rec.bait,tech:rec.tech,depth:rec.depth,kg:rec.kg,len:rec.len,press:rec.press,notes:rec.notes,photo:!!photoBlob||!!editing.photo,lat:lat,lon:lon,place:place}); }
    const id=await Store.save('bites',rec);
    if(photoBlob){ try{await Photos.put(id,photoBlob);}catch(err){ rec.photo=false; await Store.save('bites',Object.assign({},rec,{id:id})); toast('Η φωτογραφία δεν αποθηκεύτηκε.'); } }
    resetSheet(); closeSheet();
    if(editing){ toast('Αποθηκεύτηκε.'); }
    else if(lat!=null){ toast('Αποθηκεύτηκε στον χάρτη'); showOnMap(lat,lon,id); }
    else { toast(mode==='auto'?'Αποθηκεύτηκε, αλλά δεν βρέθηκε θέση.':'Αποθηκεύτηκε χωρίς θέση.'); }
  }catch(err){ $('bErr').textContent='Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'; }
  btn.disabled=false; btn.textContent='Αποθήκευση στον χάρτη';
});
function editBite(b){
  resetSheet(); editRec=b; sheetFresh=false;
  $('bWhen').value=(b.date||nicosiaToday())+'T'+(b.time||'12:00');
  $('bSpecies').value=b.species||''; curLatin=b.latin||'';
  $('bBait').value=b.bait||''; $('bTech').value=b.tech||'';
  for(const [id,k] of [['bDepth','depth'],['bKg','kg'],['bLen','len'],['bPress','press']]) $(id).value=b[k]==null?'':b[k];
  $('bNotes').value=b.notes||'';
  $('bLocMode').value=(typeof b.lat==='number')?'keep':'none';
  renderChips(); syncLoc(); updateLaw(); $('sheet').hidden=false;
}
async function quickBite(){
  const btn=$('bQuick'); btn.disabled=true; toast('Αναζήτηση θέσης…');
  try{
    const c=await refreshConditions();
    if(!c||c.lat==null){ toast('Δεν βρέθηκε θέση.'); return; }
    const rec={date:nicosiaToday(),time:fmt(nicosiaNowMin()),tz:utcOff(),species:'',latin:'',bait:'',tech:'',depth:null,kg:null,len:null,press:c.press,notes:'',
      ptrend:$('dPress').value,wind:+$('dWind').value,wave:+$('dWave').value,cloud:$('dCloud').value,temp:c.temp!=null?c.temp:null,sst:c.sst!=null?c.sst:null,
      place:'',lat:c.lat,lon:c.lon,photo:false,src:'quick'};
    const id=await Store.save('bites',rec);
    toast('Τσίμπημα αποθηκεύτηκε. Πρόσθεσε είδος από Ημερολόγιο → Τσιμπήματα → Επεξεργασία.'); showOnMap(c.lat,c.lon,id);
  }catch(e){ toast('Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'); }
  finally{ btn.disabled=false; }
}
$('bQuick').addEventListener('click',quickBite);
function updateSuggest(){
  const bites=Store.get('bites');
  const sel=$('stSpecies'), cur=sel.value; sel.replaceChildren(h('option',{value:'',text:'Όλα τα είδη'}));
  [...new Set(bites.map(b=>(b.species||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')).forEach(n=>sel.append(h('option',{value:n,text:n})));
  sel.value=[...sel.options].some(o=>o.value===cur)?cur:'';
}
function renderBites(){
  updateSuggest();
  const L=$('biteList'); L.replaceChildren();
  const list=Store.get('bites').slice().sort((a,b)=>biteMs(b)-biteMs(a));
  if(!list.length) L.append(h('div',{class:'empty',text:'Κανένα τσίμπημα ακόμα. Πάτα το + για να καταγράψεις το πρώτο.'}));
  for(const b of list){
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('bites',b.id); if(b.photo) await Photos.del(b.id);}catch(e){}
    });
    const acts=[del];
    acts.unshift(h('button',{class:'btn ghost sm',type:'button',text:'Επεξεργασία',onclick:()=>editBite(b)}));
    if(typeof b.lat==='number') acts.unshift(h('button',{class:'btn ghost sm',type:'button',text:'Χάρτης',onclick:()=>showOnMap(b.lat,b.lon,b.id)}));
    const cd=[b.wind!=null?bft(b.wind)+' Bft':null,b.wave!=null?b.wave+' m κύμα':null,b.press!=null?b.press+' hPa':null,b.ptrend?PT[b.ptrend]:null,MOON_LBL[biteMoon(b)]].filter(Boolean).join(' · ');
    const where=b.place||(typeof b.lat==='number'?b.lat.toFixed(4)+', '+b.lon.toFixed(4):'');
    const img=h('img',{class:'thumb',alt:''}); img.hidden=true; if(b.photo) loadPhoto(b.id,img);
    const td=nicosiaToday(), [ty,tm,tdd]=td.split('-').map(Number), yd=new Date(Date.UTC(ty,tm-1,tdd-1)).toISOString().slice(0,10);
    const dd=b.date===td?(window.LANG==='en'?'Today':'Σήμερα'):b.date===yd?(window.LANG==='en'?'Yesterday':'Χθες'):(b.date?b.date.slice(8,10)+'/'+b.date.slice(5,7):'');
    const when=[dd,b.time].filter(Boolean).join(' · ');
    const sz=[b.kg?b.kg+' kg':null,b.len?b.len+' cm':null].filter(Boolean).join(' · ');
    L.append(h('div',{class:'item bite'},
      h('div',{class:'ihead'},h('b',{class:'ititle',text:b.species||'Άγνωστο'}),h('span',{class:'when mono',text:when})),
      sz?h('div',{class:'isz',text:sz}):null,
      h('div',{class:'meta',text:[b.bait,b.tech,b.depth!=null?b.depth+' m βάθος':null,where].filter(Boolean).join(' · ')}),
      h('div',{class:'meta',text:cd}),img,
      h('div',{class:'acts'},acts)));
  }
  renderChips(); drawMap(); renderReco(); if(typeof renderTrips==='function') renderTrips(); if(typeof renderToday==='function') renderToday();
}
/* recommendation */
function renderReco(){
  const card=$('recoCard'); if(!card) return;
  const all=Store.get('bites').filter(b=>norm(b.bait));
  const body=$('recoBody'); body.replaceChildren();
  if(all.length<5){ card.hidden=false; body.append(h('p',{class:'muted',text:'Μετά από 5 τσιμπήματα με καταγεγραμμένο δόλωμα θα σου προτείνω τι να βάλεις, με βάση σελήνη, πίεση, άνεμο και ώρα. Έχεις '+all.length+'.'})); return; }
  const sm=sunMoon(nicosiaToday()), mi=Math.floor(sm.f*8+0.5)%8, pt=$('dPress').value, wb=w=>w<=5?0:w<=12?1:w<=18?2:3, wnow=wb(+$('dWind').value), blk=Math.floor(nicosiaNowMin()/180);
  const sc=new Map(), sp=new Map();
  for(const b of all){
    const md=Math.abs(biteMoon(b)-mi), mdist=Math.min(md,8-md);
    let w=1+(mdist<=1?1:0)+(b.ptrend===pt?1:0)+(b.wind!=null&&wb(b.wind)===wnow?1:0)+(Math.floor(parseInt((b.time||'12:00').slice(0,2),10)/3)===blk?1:0);
    const k=norm(b.bait); const e=sc.get(k)||{n:b.bait.trim(),w:0,c:0,sp:new Map()};
    e.w+=w; e.c++; if(b.species) e.sp.set(b.species.trim(),(e.sp.get(b.species.trim())||0)+1); sc.set(k,e);
  }
  const top=[...sc.values()].sort((a,b)=>b.w-a.w).slice(0,3);
  card.hidden=false;
  top.forEach((e,i)=>{
    const spc=[...e.sp.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(', ');
    body.append(h('div',{class:'bar',style:'grid-template-columns:auto 1fr'},h('b',{text:(i+1)+'.'}),h('span',{},h('b',{text:e.n}),h('span',{class:'muted',text:' · '+e.c+' τσιμπήματα'+(spc?' · '+spc:'')}))));
  });
  body.append(h('p',{class:'note',style:'margin:8px 0 0',text:'Βασίζεται στο δικό σου ιστορικό και στις τωρινές συνθήκες. Με λίγα δεδομένα είναι ένδειξη, όχι κανόνας.'}));
}
function tally(list,fn){const m=new Map();for(const b of list){const k=fn(b);if(k==null)continue;m.set(k,(m.get(k)||0)+1);}return m;}
function barsCard(title,rows){
  const mxv=Math.max(1,...rows.map(r=>r[1]));
  return h('div',{class:'card'},h('h3',{text:title}),rows.map(r=>{
    const i=h('i'); i.style.width=(r[1]/mxv*100)+'%';
    return h('div',{class:'bar'},h('span',{text:r[0]}),h('span',{class:'t'},i),h('span',{class:'n',text:r[1]}));
  }));
}
function renderStats(){
  const all=Store.get('bites'), sel=$('stSpecies').value;
  const bs=sel?all.filter(b=>norm(b.species)===norm(sel)):all;
  const B=$('stBody'); B.replaceChildren();
  if(!all.length){B.append(h('div',{class:'empty',text:'Τα στατιστικά εμφανίζονται μόλις καταγράψεις τσιμπήματα στην καρτέλα «Τσιμπήματα».'}));return;}
  B.append(h('p',{class:'muted',text:bs.length+' τσιμπήματα'+(bs.length<15?'. Λίγα δεδομένα, δες τα ως ένδειξη και όχι ως κανόνα.':'')}));
  const sorted=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]);
  if(!sel){
    const m=tally(bs,b=>(b.species||'').trim()||null);
    B.append(barsCard('Ανά είδος',sorted(m).slice(0,10)));
  }
  const first=new Map(); bs.forEach(b=>{const k=norm(b.bait); if(k&&!first.has(k)) first.set(k,b.bait.trim());});
  const bm=tally(bs,b=>norm(b.bait)||'—');
  const baitRows=sorted(bm).slice(0,8).map(([k,v])=>[k==='—'?'Χωρίς καταγραφή':first.get(k),v]);
  B.append(barsCard('Με τι τσίμπησε',baitRows));
  const hm=tally(bs,b=>Math.floor(parseInt((b.time||'12:00').slice(0,2),10)/3));
  B.append(barsCard('Ώρα ημέρας',Array.from({length:8},(_,i)=>[pad(i*3)+'–'+pad((i*3+3)%24),hm.get(i)||0])));
  const mm=tally(bs,b=>biteMoon(b));
  B.append(barsCard('Φάση σελήνης',MOON_LBL.map((l,i)=>[l,mm.get(i)||0])));
  const pm=tally(bs,b=>b.ptrend||null);
  if(pm.size) B.append(barsCard('Τάση πίεσης',Object.keys(PT).map(k=>[PT[k],pm.get(k)||0])));
  const wm=tally(bs,b=>b.wind==null?null:bft(b.wind)<=2?0:bft(b.wind)===3?1:bft(b.wind)===4?2:3);
  if(wm.size) B.append(barsCard('Άνεμος',['Bft 0–2','Bft 3','Bft 4','Bft 5+'].map((l,i)=>[l,wm.get(i)||0])));
}
$('stSpecies').addEventListener('input',renderStats);

/* ---------- Live weather and location ---------- */
const COMPASS=window.LANG==='en'?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
const dirName=d=>COMPASS[Math.round((((d%360)+360)%360)/45)%8];
const wdir=c=>c&&c.windDeg!=null?dirName(c.windDeg):((c&&c.windDir)||'');
const numOrNull=v=>typeof v==='number'&&isFinite(v)?v:null;
function getPosition(){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation){rej(new Error('no geolocation'));return;}
    navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}),rej,{enableHighAccuracy:true,timeout:8000,maximumAge:120000});
  });
}
function nearestRef(lat,lon){
  let best=null; const k=Math.cos(lat*Math.PI/180);
  for(const [n,lo,la] of REFS){const d=Math.hypot((lo-lon)*k*111.32,(la-lat)*110.57); if(!best||d<best.d) best={n:n,d:d};}
  return best&&best.d<40?best.n:null;
}
async function fetchJson(url){
  const ac=new AbortController(), t=setTimeout(()=>ac.abort(),9000);
  try{ const r=await fetch(url,{signal:ac.signal}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}
async function fetchConditions(lat,lon){
  const q='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4);
  const [w,m]=await Promise.allSettled([
    fetchJson('https://api.open-meteo.com/v1/forecast?'+q+'&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover&hourly=pressure_msl&past_hours=3&forecast_hours=1&wind_speed_unit=kn&timezone=auto'),
    fetchJson('https://marine-api.open-meteo.com/v1/marine?'+q+'&current=wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction&timezone=auto')
  ]);
  if(w.status!=='fulfilled') throw new Error('weather');
  const c=w.value.current||{}, hp=(w.value.hourly&&w.value.hourly.pressure_msl)||[];
  const press=numOrNull(c.pressure_msl), old=numOrNull(hp[0]);
  let ptrend=null;
  if(press!=null&&old!=null&&hp.length>=3){const d=press-old; ptrend=d<=-3?'fast':d<=-1?'slow':d>=1?'rise':'stable';}
  const cc=numOrNull(c.cloud_cover), ws=numOrNull(c.wind_speed_10m), wd=numOrNull(c.wind_direction_10m);
  const mc=m.status==='fulfilled'?(m.value.current||{}):{};
  const uo=numOrNull(w.value.utc_offset_seconds);
  return {lat:lat,lon:lon,utc:uo==null?null:Math.round(uo/60),temp:numOrNull(c.temperature_2m),press:press==null?null:Math.round(press),ptrend:ptrend,
    wind:ws==null?null:Math.round(ws),windDir:wd==null?null:dirName(wd),windDeg:wd,
    cur:numOrNull(mc.ocean_current_velocity)==null?null:Math.round(mc.ocean_current_velocity*0.539957*100)/100,curDir:numOrNull(mc.ocean_current_direction),waveDir:numOrNull(mc.wave_direction),
    cloud:cc==null?null:cc<20?'clear':cc<70?'part':'over',
    wave:numOrNull(mc.wave_height),wavePeriod:numOrNull(mc.wave_period),sst:numOrNull(mc.sea_surface_temperature)};
}
function setLive(msg){ $('liveSub').textContent=msg; }
function applyConditions(c){
  if(!c) return;
  if(c.wind!=null) $('dWind').value=clamp(c.wind,0,40);
  if(c.wave!=null) $('dWave').value=clamp(Math.round(c.wave*10)/10,0,3);
  if(c.cloud) $('dCloud').value=c.cloud;
  if(c.ptrend&&PT[c.ptrend]) $('dPress').value=c.ptrend;
  if(c.press!=null) $('bPress').value=c.press;
  const near=nearestRef(c.lat,c.lon);
  const parts=[c.wind!=null?bft(c.wind)+' Bft'+(wdir(c)?' '+wdir(c):''):null,c.wave!=null?'κύμα '+c.wave.toFixed(1)+' m'+(c.wavePeriod?' · '+Math.round(c.wavePeriod)+' s':''):'κύμα μη διαθέσιμο',
    c.temp!=null?c.temp.toFixed(0)+'°C αέρας':null,c.sst!=null?c.sst.toFixed(0)+'°C θάλασσα':null,c.press!=null?c.press+' hPa'+(c.ptrend?' · '+PT[c.ptrend].toLowerCase():''):null].filter(Boolean);
  $('liveMain').textContent=parts.join(' · ');
  setLive('Ενημερώθηκε '+(c.date?c.date.split('-').reverse().join('/')+' ':'')+(c.at||'')+' · θέση '+c.lat.toFixed(2)+', '+c.lon.toFixed(2)+(near?' · κοντά σε '+near:''));
  setYou(c.lat,c.lon); renderWx(); checkZoneHere(); document.dispatchEvent(new Event('psaro-cond'));
  renderToday();
}
function renderWx(){
  const el=$('wx'); if(!el) return; el.replaceChildren();
  const sm=sunMoon(nicosiaToday());
  const cell=(l,v)=>h('div',{},h('span',{class:'wl',text:l}),h('b',{text:v}));
  const c=cond||{};
  const dash='–';
  el.append(h('div',{class:'wxg'},
    cell('Σελήνη',Math.round(sm.illum*100)+'%'),cell('Πίεση',c.press!=null?c.press+' hPa':dash),cell('Αέρας',c.temp!=null?Math.round(c.temp)+'°C':dash),
    cell('Θάλασσα',c.sst!=null?Math.round(c.sst)+'°C':dash),cell('Άνεμος',c.wind!=null?bft(c.wind)+' Bft'+(wdir(c)?' '+wdir(c):''):dash),cell('Κύμα',c.wave!=null?c.wave.toFixed(1)+' m':dash)));
}
function refreshConditions(){
  if(refreshing) return refreshing;
  refreshing=(async()=>{
    $('liveRefresh').disabled=true; setLive('Ανανέωση καιρού…');
    try{
      let pos=null; try{ pos=await getPosition(); }catch(e){ if(cond&&cond.lat!=null) pos={lat:cond.lat,lon:cond.lon}; }
      if(!pos){ setLive('Δεν βρέθηκε τοποθεσία. Επίτρεψε την τοποθεσία στον browser και πάτα ανανέωση.'); return cond; }
      const c=await fetchConditions(pos.lat,pos.lon);
      c.at=fmt(nicosiaNowMin()); c.date=nicosiaToday(); cond=c; lsSet('psaro-cond',c); applyConditions(c); return c;
    }catch(e){
      setLive('Ο καιρός δεν φορτώθηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.'); return cond;
    }finally{ $('liveRefresh').disabled=false; refreshing=null; }
  })();
  return refreshing;
}
$('liveRefresh').addEventListener('click',()=>{refreshConditions();});

/* ---------- Law (Cyprus) ---------- */
const MIN=window.MIN_SIZES||{};
function lnk(href,text){return h('a',{href:href,target:'_blank',rel:'noopener',text:text});}
function lawCard(title,items,src){
  return h('div',{class:'card'},h('h3',{text:title}),h('ul',{class:'law'},items.map(x=>h('li',{},x))),src?h('div',{class:'note',style:'margin-top:8px'},'Πηγή: ',src):null);
}
function renderLaw(){
  const L=$('g-law'); L.replaceChildren();
  L.append(h('div',{class:'card'},h('p',{text:'Περίληψη για ερασιτεχνικό ψάρεμα από σκάφος στη Δημοκρατία της Κύπρου, ελεγμένη στις 15/10/2026. Δεν αποτελεί νομική συμβουλή. Οι κανονισμοί αλλάζουν και ισχύει πάντα το κείμενο του νόμου και ό,τι ανακοινώνει το Τμήμα Αλιείας και Θαλασσίων Ερευνών (ΤΑΘΕ). Όπου η πηγή είναι δευτερογενής, το γράφει.'})));
  L.append(lawCard('Όρια ποσότητας (ανά έξοδο και ανά 24ωρο)',[
    'Από σκάφος: 10 kg συνολικά, ή 5 kg και 1 ψάρι οποιουδήποτε βάρους, ανεξάρτητα από τον αριθμό των αδειούχων.',
    'Μακρύπτερος τόνος (Thunnus alalunga) από σκάφος: 3 ψάρια ανά αδειούχο επιβαίνοντα, μέχρι 9 ανά σκάφος. Μαζί με άλλα είδη: 3 μακρύπτερους και 5 kg άλλων ειδών ανά σκάφος.',
    'Ψαροντούφεκο: 5 kg και 1 ψάρι οποιουδήποτε βάρους.',
    'Το ΤΑΘΕ μπορεί να αλλάξει το όριο μόνο για διαγωνισμούς ή τουριστική δραστηριότητα, και μόνο για μακρύπτερο τόνο και λαγοκέφαλο.'
  ],['ΚΔΠ 416/2019, Κανονισμός 17Β(1)(ε) · ',lnk('https://www.cylaw.org/KDP/data/2019_1_416.pdf','κείμενο (cylaw)')]));
  L.append(lawCard('Άδεια και εργαλεία',[
    'Ερασιτεχνική αλιεία με σκάφος απαγορεύεται χωρίς άδεια του ΤΑΘΕ. Η άδεια είναι ατομική και δεν δένεται με συγκεκριμένο σκάφος. Τέλος 35 € (το ίδιο και για ψαροντούφεκο).',
    'Κάθε εργαλείο ή μέθοδος που δεν προβλέπεται από τον νόμο και τους όρους της άδειας απαγορεύεται.',
    'Ψαροπαγίδες: έως 4 στον βυθό, χωρίς σκάφος, εκτός προστατευόμενων περιοχών και περιοχών λουομένων, με ειδική γραπτή άδεια.',
    'Ψαροντούφεκο: άνω των 15 ετών με άδεια (15–17 με συνοδεία ενήλικου κατόχου). Όχι από τη δύση ως την ανατολή του ηλίου, όχι με φωτεινή πηγή, όχι με αναπνευστική συσκευή εκτός των περιοχών του Παραρτήματος VI.',
    'Οι έξοδοι πρέπει να καταγράφονται στην εφαρμογή Cy-FIS του ΤΑΘΕ (δευτερογενής πηγή).'
  ],['ΚΔΠ 416/2019, Κανονισμοί 17, 17Α, 19Α, Παράρτημα IV · ',lnk('https://www.gov.cy/en/service/issue-of-fishing-licence/','gov.cy: άδεια αλιείας'),' · ',lnk('https://cyprus-faq.com/en/south/entertainment/pravila-rybnoi-lovli-na-kipre/','cyprus-faq.com (δευτ.)')]));
  L.append(lawCard('Χειρισμός αλιεύματος',[
    'Απαγορεύεται η πώληση ή εμπορική εκμετάλλευση ερασιτεχνικού αλιεύματος.',
    'Δεν επιτρέπεται να κρατάς ψάρι χωρίς κομμένο το πάνω τμήμα του ουραίου πτερυγίου.',
    'Στο σκάφος επιτρέπεται μόνο εκσπλάχνιση και απολέπιση. Όχι φιλεταρισμός, αποκεφαλισμός ή άλλος καθαρισμός.',
    'Διαγωνισμοί και τουριστική δραστηριότητα απαιτούν γραπτή άδεια.'
  ],['ΚΔΠ 416/2019, Κανονισμός 17Β']));
  const rows=Object.keys(MIN).map(la=>{const c=CYL[la.toLowerCase()]; return [c?c.n:la,la,MIN[la]];}).sort((a,b)=>a[0].localeCompare(b[0],'el'));
  L.append(h('div',{class:'card'},h('h3',{text:'Ελάχιστα μεγέθη (ολικό μήκος)'}),
    h('div',{class:'bar',style:'grid-template-columns:1fr auto;font-weight:600'},h('span',{text:'Είδος'}),h('span',{text:'cm'})),
    rows.map(r=>h('div',{class:'bar',style:'grid-template-columns:1fr auto'},h('span',{},r[0],' ',h('i',{class:'muted',text:r[1]})),h('span',{class:'n',text:String(r[2])}))),
    h('div',{class:'note',style:'margin-top:8px'},'Πηγή: βιβλίο «Τα 100 σημαντικότερα είδη ψαριών των κυπριακών θαλασσών» του ΤΑΘΕ (περίπου 2012), που παραπέμπει σε ευρωπαϊκούς κανονισμούς. Δεν ελέγχθηκε με τον ισχύοντα κατάλογο της ΕΕ (Καν. 2019/1241), άρα επιβεβαίωσε πριν κρατήσεις οριακό ψάρι. Για όσα είδη δεν αναγράφονται, ρώτα το ΤΑΘΕ.')));
  L.append(lawCard('Ειδικά είδη (δευτερογενής πηγή, επιβεβαίωσε)',[
    'Κόκκινος τόνος (Thunnus thynnus): απαγορεύεται η αλιεία, η διατήρηση και η εκφόρτωση όλο τον χρόνο. Ελευθέρωση αμέσως.',
    'Μακρύπτερος τόνος: κλειστή περίοδος 1–31 Μαρτίου και 1 Οκτωβρίου–30 Νοεμβρίου, και ως τυχαίο αλίευμα.',
    'Ξιφίας, καρχαρίες και σελάχια: δεν επιτρέπονται ως ερασιτεχνικό αλίευμα. Ελευθέρωση.',
    'Ένας ορφός (ή συναγρίδα) το πολύ ανά έξοδο ή 24ωρο, ανά αλιέα ή σκάφος.',
    'Λαγοκέφαλος (Lagocephalus sceleratus): τοξικός, δεν τρώγεται, δεν δίνεται και δεν πωλείται (ΤΑΘΕ).'
  ],[lnk('https://cyprus-faq.com/en/south/entertainment/pravila-rybnoi-lovli-na-kipre/','cyprus-faq.com'),' · βιβλίο ΤΑΘΕ για τον λαγοκέφαλο']));
  L.append(h('div',{class:'card'},h('h3',{text:'Περιοχές απαγόρευσης ('+ZONES.length+')'}),
    h('p',{class:'note',text:'Τα όρια είναι από το αρχείο «Fishing_restricted_areas» (KMZ) του Cy-FIS και φαίνονται κόκκινα στον χάρτη. Οι ημερομηνίες ισχύος του αρχείου δεν είναι γνωστές και τα διατάγματα αλλάζουν. Πριν ψαρέψεις κοντά σε προστατευόμενη περιοχή, έλεγξε το Cy-FIS και τον νόμο που αναγράφεται.'}),
    ZONES.slice().sort((x,y)=>x.n.localeCompare(y.n,'el')).map(z=>h('div',{class:'item',style:'margin-top:8px'},h('div',{},h('b',{text:z.n}),h('div',{class:'meta',text:z.d})),h('div',{class:'acts'},h('button',{class:'btn ghost sm',type:'button',text:'Χάρτης',onclick:()=>showZone(z)})))),
    h('div',{class:'note',style:'margin-top:8px'},lnk('https://apps.apple.com/app/id1510935028','Cy-FIS (iPhone)'),' · ',lnk('https://play.google.com/store/apps/details?id=cyprus.dfmr.fishing','Cy-FIS (Android)'))));
  L.append(lawCard('Άλλοι περιορισμοί',[
    'Περιοχές λουομένων: όχι ψαροπαγίδες ή δίχτυα.',
    'Έξι θαλάσσιες προστατευόμενες περιοχές με τεχνητούς υφάλους: καμία αλιεία (δευτερογενής πηγή, ελέγξτε με τη λίστα πάνω).',
    'Μπορεί να υπάρχουν και άλλοι μόνιμοι ή εποχικοί περιορισμοί που δεν είναι στο αρχείο.'
  ],null));
  L.append(h('div',{class:'card'},h('h3',{text:'Πηγές'}),h('ul',{class:'law'},
    [['https://www.cylaw.org/KDP/data/2019_1_416.pdf','Κ.Δ.Π. 416/2019, Αλιεία (Τροποποιητικοί) Κανονισμοί'],['https://www.cylaw.org/KDP/data/2024_1_256.pdf','Κ.Δ.Π. 256/2024, Αλιεία (Τροποποιητικοί) Κανονισμοί'],['https://www.gov.cy/en/service/issue-of-fishing-licence/','gov.cy: άδεια ερασιτεχνικής αλιείας'],['https://www.gov.cy/moa-dfmr/en/','Τμήμα Αλιείας και Θαλασσίων Ερευνών']].map(x=>h('li',{},lnk(x[0],x[1]))))));
}
function latinForName(name){
  if(curLatin) return curLatin;
  const n=strip(name).trim(); if(!n) return '';
  const m=DB.find(d=>strip(dispName(d))===n||(d.el&&strip(d.el)===n)||(d.alt&&strip(d.alt).split(' ').join(' ').includes(n)&&n.length>3));
  return m?m.la:'';
}
function updateLaw(){
  const out=$('bLaw'); const msgs=[];
  const lat=latinForName($('bSpecies').value), len=+$('bLen').value||0, mn=lat&&MIN[lat];
  if(mn&&len&&len<mn) msgs.push('⚠ Κάτω από το ελάχιστο μέγεθος ('+mn+' cm). Ελευθέρωσέ το.');
  else if(mn) msgs.push('Ελάχιστο μέγεθος: '+mn+' cm.');
  if(lat==='Thunnus thynnus') msgs.push('⚠ Ο κόκκινος τόνος απαγορεύεται να κρατηθεί. Ελευθέρωσέ τον (δευτερογενής πηγή).');
  if(lat==='Xiphias gladius') msgs.push('⚠ Ο ξιφίας δεν επιτρέπεται ως ερασιτεχνικό αλίευμα (δευτερογενής πηγή).');
  if(lat==='Lagocephalus sceleratus') msgs.push('⚠ Τοξικός. Μην τον φας και μην τον δώσεις.');
  if(lat==='Thunnus alalunga'){ const mo=+(($('bWhen').value||'').slice(5,7)); if(mo===3||mo===10||mo===11) msgs.push('⚠ Πιθανή κλειστή περίοδος μακρύπτερου (1–31 Μαρτίου, 1 Οκτ.–30 Νοεμβρίου). Έλεγξε με το ΤΑΘΕ.'); }
  { const m=$('bLocMode').value; let p=null;
    if(m==='auto'&&cond&&cond.lat!=null) p=[cond.lat,cond.lon];
    else if(m==='pick'&&pickedPt) p=[pickedPt.lat,pickedPt.lon];
    else if(m==='spot'){ const sp=Store.get('spots').find(x=>x.id===$('bSpot').value); if(sp) p=[sp.lat,sp.lon]; }
    else if(m==='keep'&&editRec&&typeof editRec.lat==='number'){ p=[editRec.lat,editRec.lon]; }
    if(p){ const zz=zonesAt(p[0],p[1]); if(zz.length) msgs.push('⚠ Η θέση είναι μέσα σε περιοχή απαγόρευσης: '+zz.map(zoneText).join(' | ')); } }
  let kg=+$('bKg').value||0; const since=Date.now()-86400000;
  for(const b of Store.get('bites')) if(b.kg&&biteMs(b)>=since) kg+=+b.kg;
  if(kg>0) msgs.push('Καταγεγραμμένα τις τελευταίες 24 ώρες: '+kg.toFixed(1)+' kg. Όριο από σκάφος: 10 kg, ή 5 kg και 1 ψάρι.'+(kg>10?' ⚠ Πάνω από το όριο, αν τα κρατάς όλα.':''));
  out.textContent=msgs.join(' ');
}
$('biteForm').addEventListener('input',updateLaw);

/* ---------- AI fish identification (own API key) ---------- */
const AI_PROMPT='You are helping an angler in Cyprus (eastern Mediterranean). Identify the fish in the photo. Reply with ONLY a JSON array of up to 3 candidates, best first: [{"el":"Greek common name or null","en":"English common name","latin":"Latin name","confidence":0.0-1.0}]. If the photo does not show a fish, reply []. Be honest about uncertainty; do not guess a rare species when a common look-alike fits.';
async function identifyFish(blob){
  const key=lsGet('psaro-akey',''); if(!key) throw new Error('nokey');
  const b64=(await blobToDataUrl(blob)).split(',')[1];
  const ac=new AbortController(), tm=setTimeout(()=>ac.abort(),45000);
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ac.signal,
      headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-5-5',max_tokens:600,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},{type:'text',text:AI_PROMPT}]}]})});
    if(!r.ok){ const e=new Error('http'); e.status=r.status; throw e; }
    const j=await r.json();
    const txt=(j.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
    const m=/\[[\s\S]*\]/.exec(txt); if(!m) throw new Error('parse');
    const arr=JSON.parse(m[0]);
    return Array.isArray(arr)?arr.filter(x=>x&&x.latin).slice(0,3):[];
  } finally { clearTimeout(tm); }
}
$('bAI').addEventListener('click',async()=>{
  const out=$('bAIOut'), msg=$('bAIMsg'), b=$('bAI'); out.replaceChildren(); msg.textContent='';
  if(!photoBlob) return;
  if(!lsGet('psaro-akey','')){ msg.textContent='Βάλε πρώτα το κλειδί API στο Ημερολόγιο → Αναγνώριση ψαριού με AI.'; return; }
  b.disabled=true; b.textContent='Αναγνώριση…';
  try{
    const res=await identifyFish(photoBlob);
    if(!res.length) msg.textContent='Δεν αναγνωρίστηκε ψάρι στη φωτογραφία.';
    else{
      res.forEach(x=>{
        const row=DB.find(d=>d.la.toLowerCase()===String(x.latin).toLowerCase());
        const name=row?dispName(row):(x.el||x.en||x.latin);
        const pct=typeof x.confidence==='number'?' '+Math.round(x.confidence*100)+'%':'';
        out.append(h('button',{type:'button',class:'chip',text:name+' ('+x.latin+')'+pct,onclick:()=>{$('bSpecies').value=name;curLatin=x.latin;updateLaw();}}));
      });
      msg.textContent='Πρόταση AI, μπορεί να είναι λάθος. Μη βασίζεσαι σε αυτήν για το αν επιτρέπεται ή αν τρώγεται ένα ψάρι.';
    }
  }catch(e){
    msg.textContent=e.message==='nokey'?'Λείπει το κλειδί API.':e.status===401?'Το κλειδί API δεν έγινε δεκτό.':e.status===429||e.status===402?'Όριο χρήσης ή υπόλοιπο λογαριασμού: έλεγξε το console.anthropic.com.':e.name==='AbortError'?'Η αναγνώριση άργησε. Δοκίμασε ξανά.':'Η αναγνώριση δεν δούλεψε (σύνδεση, κλειδί ή περιορισμός του browser).';
  }
  b.disabled=false; b.textContent='🔍 Αναγνώριση με AI';
});
$('aiSave').addEventListener('click',()=>{
  const k=$('aiKey').value.trim();
  if(!/^sk-ant-/.test(k)){ $('aiMsg').textContent='Το κλειδί πρέπει να ξεκινά με sk-ant-.'; return; }
  lsSet('psaro-akey',k); $('aiKey').value=''; $('aiMsg').textContent='Το κλειδί αποθηκεύτηκε σε αυτή τη συσκευή.';
});
$('aiClear').addEventListener('click',()=>{ try{localStorage.removeItem('psaro-akey');}catch(e){} $('aiMsg').textContent='Το κλειδί διαγράφηκε.'; });
if(lsGet('psaro-akey','')) $('aiMsg').textContent='Υπάρχει αποθηκευμένο κλειδί.';

/* ---------- CSV ---------- */
function csvDownload(name,head,rows){
  const q=v=>{v=v==null?'':String(v); return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  const txt='\ufeff'+[head].concat(rows).map(r=>r.map(q).join(';')).join('\r\n');
  const a=h('a',{href:URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})),download:name});
  document.body.append(a); a.click(); a.remove();
}
$('csvBites').addEventListener('click',()=>{
  const L=Store.get('bites').slice().sort((a,b)=>biteMs(a)-biteMs(b));
  csvDownload('bitecast-bites-'+nicosiaToday()+'.csv',['Ημερομηνία','Ώρα','Είδος','Λατινικό','Δόλωμα','Τεχνική','Βάθος m','Βάρος kg','Μήκος cm','Πίεση hPa','Τάση πίεσης','Άνεμος Bft','Κύμα m','Θάλασσα °C','Αέρας °C','Σελήνη','Τοποθεσία','Πλάτος','Μήκος','Σημειώσεις'],
    L.map(b=>[b.date,b.time,b.species,b.latin,b.bait,b.tech,b.depth,b.kg,b.len,b.press,b.ptrend?PT[b.ptrend]:'',b.wind==null?'':bft(b.wind),b.wave,b.sst!=null?Math.round(b.sst*10)/10:'',b.temp!=null?Math.round(b.temp*10)/10:'',MOON_LBL[biteMoon(b)],b.place,b.lat,b.lon,b.notes]));
});
$('csvTrips').addEventListener('click',()=>{
  const L=Store.get('trips').slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  csvDownload('bitecast-trips-'+nicosiaToday()+'.csv',['Ημερομηνία','Σημείο','Τεχνική','Είδη','Ψάρια','Βάρος kg','Σημειώσεις'],L.map(t=>[t.date,t.spot,t.tech,t.species,t.count,t.kg,t.notes]));
});

/* ---------- Backup ---------- */
const blobToDataUrl=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b);});
$('expBtn').addEventListener('click',async()=>{
  const btn=$('expBtn'); btn.disabled=true;
  try{
    const bites=Store.get('bites'), photos={};
    for(const b of bites) if(b.photo){ try{const bl=await Photos.get(b.id); if(bl) photos[b.id]=await blobToDataUrl(bl);}catch(e){} }
    const data={app:'psarovarka',v:2,spots:Store.get('spots'),trips:Store.get('trips'),bites:bites,photos:photos};
    const a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),download:'psarovarka-'+nicosiaToday()+'.json'});
    document.body.append(a); a.click(); a.remove();
  }catch(e){ $('impMsg').textContent='Η εξαγωγή απέτυχε.'; }
  btn.disabled=false;
});
$('impFile').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    const d=JSON.parse(await f.text()); let n=0;
    for(const k of ['spots','trips','bites']) for(const it of (Array.isArray(d[k])?d[k]:[])) if(it&&typeof it==='object'){await Store.save(k,it);n++;}
    const ph=d.photos&&typeof d.photos==='object'?d.photos:{};
    for(const id in ph){ try{ const bl=await (await fetch(ph[id])).blob(); await Photos.put(id,bl); }catch(err){} }
    $('impMsg').textContent=n+' εγγραφές εισήχθησαν.';
  }catch(err){ $('impMsg').textContent='Το αρχείο δεν διαβάστηκε.'; }
  e.target.value='';
});

/* ---------- Tabs and init ---------- */
(function(){const ls=document.getElementById('langSel'); if(ls){ ls.value=window.LANG||'el'; ls.addEventListener('change',()=>window.setLang(ls.value)); }})();
function fitMap(){
  const mb=document.querySelector('.mapbox'); if(!mb||mb.offsetParent===null) return;
  const nav=document.querySelector('nav.tabs'), top=mb.getBoundingClientRect().top, nt=nav.getBoundingClientRect().top;
  document.documentElement.style.setProperty('--navh',nav.offsetHeight+'px');
  const hgt=Math.max(300,Math.floor(nt-top-10)); mb.style.height=hgt+'px'; mb.style.minHeight='0';
  if(map) map.invalidateSize();
}
window.fitMap=fitMap;
function switchTab(t2){
  document.querySelectorAll('nav.tabs button[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.tab===t2)));
  for(const n of ['today','fc','map','log','guide']) $('tab-'+n).hidden=(n!==t2);
  window.scrollTo(0,0);
  if(t2==='map'&&map) setTimeout(fitMap,50);
}
document.querySelectorAll('nav.tabs button[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
const today=nicosiaToday();
$('dDate').value=today; $('tDate').value=today;
['dDate','dWind','dWave','dPress','dCloud'].forEach(id=>$(id).addEventListener('input',()=>{renderToday();renderReco();}));
{const tg=$('hdrToggle'), mo=$('hdrMore');
  tg.addEventListener('click',()=>{const o=mo.hidden; mo.hidden=!o; tg.setAttribute('aria-expanded',String(o)); tg.textContent=o?'Όλα ▴':'Όλα ▾';});}
initMap();
window.addEventListener('resize',fitMap); window.addEventListener('orientationchange',()=>setTimeout(fitMap,300));
try{ new ResizeObserver(fitMap).observe(document.querySelector('header.top')); new MutationObserver(()=>setTimeout(fitMap,0)).observe(document.querySelector('.wrap').parentNode,{childList:true}); }catch(e){}
setTimeout(fitMap,100); setTimeout(fitMap,1500);
renderToday(); renderSpecies(); renderTech(); renderChecks(); renderLaw(); renderSpots(); renderTrips(); renderWx();
Store.on('spots',()=>{drawMap();renderSpots();});
Store.on('trips',renderTrips);
Store.on('bites',()=>{renderBites();renderStats();});
Object.assign(window.PsaroCore,{h:h,$:$,fmt:fmt,pad:pad,nicosiaToday:nicosiaToday,nicosiaNowMin:nicosiaNowMin,getPosition:getPosition,getCond:()=>cond,showOnMap:showOnMap,lsGet:lsGet,lsSet:lsSet,switchTab:switchTab,utcMin:()=>utcOff()});
Store.init();
if(cond){ applyConditions(cond); } else { $('liveMain').textContent='Δεν υπάρχουν δεδομένα καιρού ακόμα.'; }
refreshConditions();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&(!cond||cond.date!==nicosiaToday()||Math.abs(nicosiaNowMin()-(parseInt((cond.at||'00:00').slice(0,2),10)*60+parseInt((cond.at||'00:00').slice(3,5),10)))>10)) refreshConditions();
});
setInterval(()=>{ if(document.visibilityState==='visible'&&navigator.onLine!==false) refreshConditions(); },10*60*1000);
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
