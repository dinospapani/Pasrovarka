/* Καρτέλα «Πρόγνωση»: 7 ημέρες συνθηκών και δείκτη ψαρέματος, επιλογή τοποθεσίας, ειδοποιήσεις για καλές μέρες. */
(function(){
'use strict';
var PU=window.PsaroUnits;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var C=window.PsaroCore, PF=window.PF; if(!C||!PF||!document.getElementById('tab-fc')) return;
var $=C.$, h=C.h, pad=C.pad, lsGet=C.lsGet, lsSet=C.lsSet, toast=C.toast;
var Cl=function(){ return window.PsaroCloud&&window.PsaroCloud.logged()?window.PsaroCloud:null; };
var places=lsGet('psaro-places',[]); if(!Array.isArray(places)) places=[];
var sel=lsGet('psaro-fcsel','gps');
var nt=Object.assign({on:false,threshold:75,notified:{},server:false,gpsWatch:true,pressure:true},lsGet('psaro-notify',{}));
if(!nt.notified||typeof nt.notified!=='object') nt.notified={};
var fc=null, fcPlace=null, busy=false;
var EN=window.LANG==='en';
var DAYN=EN?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
var DAYS=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
function dl(date){ var dt=new Date(date+'T12:00:00Z'); return DAYS[dt.getUTCDay()]+' '+date.slice(8)+'/'+date.slice(5,7); }
var DIRS=window.LANG==='en'?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dirName(d){ return d==null?'':DIRS[Math.round(d/45)%8]; }
function wxIcon(c){ if(c==null) return '🌤️'; if(c>=95) return '⛈️'; if(c>=80) return '🌦️'; if(c>=61) return '🌧️'; if(c>=51) return '🌦️'; if(c>=45) return '🌫️'; if(c<=1) return '☀️'; if(c===2) return '🌤️'; return '☁️'; }
function wxText(c){ if(c==null) return ''; if(c>=95) return 'Καταιγίδα'; if(c>=80) return 'Μπόρες'; if(c>=61) return 'Βροχή'; if(c>=51) return 'Ψιχάλα'; if(c>=45) return 'Ομίχλη'; if(c<=1) return 'Καθαρός ουρανός'; if(c===2) return 'Λίγα σύννεφα'; return 'Συννεφιά'; }
function fmtMin(m){ m=((Math.round(m)%1440)+1440)%1440; return pad(Math.floor(m/60))+':'+pad(m%60); }
function save(){ lsSet('psaro-places',places); lsSet('psaro-fcsel',sel); lsSet('psaro-notify',nt); }

/* ---------- τοποθεσίες ---------- */
function gps(){
  var c=C.getCond(); if(!c||c.lat==null) return null;
  return {id:'gps',name:EN?'My location':'Η θέση μου',lat:c.lat,lon:c.lon,watch:nt.gpsWatch!==false,gps:true};
}
function allPlaces(){ var g=gps(); return (g?[g]:[]).concat(places); }
function findPlace(id){ return allPlaces().filter(function(p){ return p.id===id; })[0]||null; }
function pid(lat,lon){ return 'p'+Math.round(lat*100)+'_'+Math.round(lon*100); }
function addPlace(name,lat,lon){
  var id=pid(lat,lon), ex=places.filter(function(p){ return p.id===id; })[0];
  if(!ex){ places.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:true}); places=places.slice(0,10); }
  sel=id; save(); renderPlaces(); load(); syncNotify();
}
window.PsaroPlaces={rename:function(id,n){ var q=places.filter(function(x){ return x.id===id; })[0]; if(q){ q.name=n; q.auto=false; save(); renderPlaces(); } },remove:function(id){ var was=sel===id; places=places.filter(function(p){ return p.id!==id; }); if(was) sel='gps'; save(); renderPlaces(); if(was&&!document.getElementById('tab-fc').hidden) load(); syncNotify(); },list:function(){ return places.slice(); },add:function(name,lat,lon){ var id=pid(lat,lon), ex=places.filter(function(p){ return p.id===id; })[0]; if(!ex){ places.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:true}); places=places.slice(0,10); save(); renderPlaces(); ex=places[0]; } return ex; }};
function lpress(b,fn,tap){ /* παρατεταμένο πάτημα = διαγραφή, κανονικό = επιλογή */
  var tm=null, fired=false; function cancel(){ if(tm){ clearTimeout(tm); tm=null; } }
  b.addEventListener('pointerdown',function(){ fired=false; cancel(); tm=setTimeout(function(){ tm=null; fired=true; try{ if(navigator.vibrate) navigator.vibrate(30); }catch(e){} fn(); },650); });
  ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ b.addEventListener(ev,cancel); });
  b.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  b.addEventListener('click',function(e){ if(fired){ fired=false; e.preventDefault(); return; } tap(); });
}
async function delPlace(p){
  if(!p||p.gps) return;
  if(!(await window.PsaroAsk((EN?'Delete ':'Διαγραφή ')+'«'+p.name+'»;',{title:EN?'Delete location':'Διαγραφή τοποθεσίας',ok:EN?'Delete':'Διαγραφή',danger:true}))) return;
  var was=sel===p.id; places=places.filter(function(x){ return x.id!==p.id; }); if(was) sel='gps'; save(); renderPlaces(); if(was) load(); syncNotify();
}
function renderPlaces(){
  var box=$('plChips'); box.replaceChildren();
  var list=allPlaces();
  if(!list.length) box.append(h('span',{class:'note',text:'Πάτα «Η θέση μου» στον χάρτη ή αναζήτησε μια τοποθεσία.'}));
  list.forEach(function(p){
    var b=h('button',{type:'button',class:'chip','aria-pressed':String(p.id===sel),text:p.name});
    if(p.gps) b.classList.add('gpschip');
    if(p.gps) b.addEventListener('click',function(){ sel=p.id; save(); renderPlaces(); load(); });
    else lpress(b,function(){ delPlace(p); },function(){ sel=p.id; save(); renderPlaces(); load(); });
    box.append(b);
  });
}
async function geocode(){
  var q=$('plQ').value.trim(), R=$('plRes'); R.replaceChildren(); if(q.length<2) return; try{ $('plQ').blur(); }catch(e){}
  R.append(h('div',{class:'note',text:'Αναζήτηση…'}));
  try{
    var r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=6&format=json&language='+(window.LANG==='en'?'en':'el'));
    var j=await r.json(); R.replaceChildren(); setTimeout(function(){ try{ R.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){} },250);
    var res=(j&&j.results)||[];
    if(!res.length){ R.append(h('div',{class:'note',text:'Δεν βρέθηκε τοποθεσία.'})); return; }
    res.forEach(function(x){
      var label=[x.name,x.admin1,x.country].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
      var it=h('button',{type:'button',class:'item plres'},h('b',{text:x.name}),h('span',{class:'meta',text:label}));
      it.addEventListener('click',function(){ R.replaceChildren(); $('plQ').value=''; addPlace(x.name,x.latitude,x.longitude); });
      R.append(it);
    });
  }catch(e){ R.replaceChildren(h('div',{class:'note',text:'Η αναζήτηση δεν δούλεψε. Έλεγξε τη σύνδεση.'})); }
}
function showSpots(){
  var box=$('plSpotList'); box.hidden=!box.hidden; if(box.hidden) return; box.replaceChildren();
  var sp=(C.Store.get('spots')||[]).filter(function(s){ return typeof s.lat==='number'&&typeof s.lon==='number'; });
  if(!sp.length) box.append(h('span',{class:'note',text:'Δεν έχεις αποθηκευμένα σημεία με συντεταγμένες.'}));
  sp.forEach(function(s){ var b=h('button',{type:'button',class:'chip',text:s.name||'Σημείο'}); b.addEventListener('click',function(){ box.hidden=true; addPlace(s.name||'Σημείο',s.lat,s.lon); }); box.append(b); });
}

/* ---------- πρόγνωση ---------- */
async function load(force){
  var p=findPlace(sel)||allPlaces()[0]; 
  if(!p){ renderFc(null,null,'Χρειάζεται τοποθεσία. Πάτα «Η θέση μου» στον χάρτη ή αναζήτησε μία.'); return; }
  if(p.id!==sel){ sel=p.id; renderPlaces(); }
  var cache=lsGet('psaro-fc7',null);
  if(!force&&cache&&cache.id===p.id&&Date.now()-cache.t<3600e3&&cache.fc){ renderFc(p,cache.fc,'',cache.t); return; }
  if(busy) return; busy=true; $('fcSub').textContent='Φόρτωση…';
  try{
    var f=await PF.getForecast(p.lat,p.lon,null,{days:7});
    lsSet('psaro-fc7',{id:p.id,t:Date.now(),fc:f}); renderFc(p,f,'',Date.now());
  }catch(e){
    try{ console.error('forecast',e); }catch(e0){}
    if(cache&&cache.id===p.id&&cache.fc) renderFc(p,cache.fc,'Δεν φορτώθηκε νέα πρόγνωση. Δείχνω την τελευταία αποθηκευμένη.',cache.t);
    else renderFc(p,null,'Η πρόγνωση δεν φορτώθηκε. Έλεγξε τη σύνδεση.');
  }finally{ busy=false; }
}
function tileEl(l,v){ return h('div',{class:'ft'},h('i',{text:l}),h('b',{text:v})); }
function reason(d){
  if(d.safe) return '';
  var w=d.wx||{}, r=[];
  if(d.why==='night') return 'Δεν απομένει φως.';
  if(w.windMax!=null&&w.windMax>14) r.push((EN?'wind up to ':'άνεμος έως ')+PU.wind(w.windMax));
  if(w.waveMax!=null&&w.waveMax>0.9) r.push((EN?'waves up to ':'κύμα έως ')+PU.wave(w.waveMax));
  if(w.gustMax!=null&&w.gustMax>24) r.push((EN?'gusts up to ':'ριπές έως ')+PU.wind(w.gustMax));
  if(w.code!=null&&w.code>=95) r.push(T('καταιγίδα','thunderstorm'));
  return 'Δεν υπάρχει ασφαλές παράθυρο'+(r.length?': '+r.join(', '):'')+'.';
}
function renderFc(p,f,note,t){
  fc=f; fcPlace=p; try{ window.dispatchEvent(new CustomEvent('psaro-fcloaded',{detail:{place:p,fc:f}})); }catch(e){}
  var D=$('fcDays'), W=$('fcWeek'); D.replaceChildren(); W.replaceChildren();
  $('fcName').textContent=p?p.name:'';
  $('fcSub').textContent=p&&f?('Ενημερώθηκε '+new Date(t||Date.now()).toLocaleTimeString(EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'})+' · '+PsaroCoord.fmt(p.lat,p.lon)):'';
  $('fcNote').textContent=note||'';
  try{ pressCard(p&&f?p:null); }catch(e){}
  var wb=$('fcWatch'), delBtn=$('plDel');
  wb.hidden=!p; delBtn.hidden=!p||!!(p&&p.gps); $('plRen').hidden=delBtn.hidden;
  if(p){ var on=p.watch!==false; wb.setAttribute('aria-pressed',String(on)); wb.textContent=on?'🔔 Ειδοποιήσεις: ναι':'🔕 Ειδοποιήσεις: όχι'; }
  if(!f){ $('fcBest').replaceChildren(); if(note) D.append(h('div',{class:'empty',text:note})); $('fcNote').textContent=''; return; }
  var today=f.nowLocal.slice(0,10), bestD=null;
  f.days.forEach(function(d){ if(d.safe&&(!bestD||d.best>bestD.best)) bestD=d; });
  (function(){ var bx=$('fcBest'); bx.replaceChildren();
    if(!bestD){ bx.classList.add('none'); bx.append(h('span',{class:'fcbn',text:'Καμία ασφαλής μέρα στο εύρος της πρόγνωσης.'})); return; }
    bx.classList.remove('none');
    var tone=bestD.best>=75?'good':bestD.best>=60?'warn':'bad';
    bx.append(h('div',{class:'fcbtx'},h('span',{class:'fcbl',text:'Καλύτερη μέρα'}),h('b',{class:'fcbd',text:dl(bestD.date)}),bestD.win?h('span',{class:'fcbw',text:pad(bestD.win.s)+':00–'+pad((bestD.win.e+1)%24)+':00'}):null),
      h('div',{class:'fcbs '+tone},h('b',{text:String(bestD.best)}),h('span',{text:'Δείκτης'})));
  })();
  f.days.forEach(function(d){
    var dt=new Date(d.date+'T12:00:00Z'), w=d.wx||{};
    var good=d.safe&&d.best>=75, mid=d.safe&&d.best>=60, cls=!d.safe?'none':good?'good':mid?'mid':'bad';
    var col=h('button',{type:'button',class:'wkc','aria-label':dl(d.date)},h('span',{class:'wkv',text:d.safe?String(d.best):'–'}),h('span',{class:'wkbar '+cls,style:'height:'+(d.safe?Math.max(8,d.best):8)+'%'}),h('span',{class:'wkl',text:dl(d.date).split(' ')[0]}));
    col.addEventListener('click',function(){ var el=document.getElementById('fd-'+d.date); if(el){ el.open=true; el.scrollIntoView({behavior:'smooth',block:'start'}); } });
    var lab=(d.date===today?(EN?'Today':'Σήμερα'):DAYN[dt.getUTCDay()])+' '+d.date.slice(8)+'/'+d.date.slice(5,7);
    var sum=h('summary',{},
      h('span',{class:'fdi',text:wxIcon(w.code)}),
      h('span',{class:'fdt'},h('b',{text:lab}),h('span',{class:'meta',text:[w.tmax!=null?PU.tempP(w.tmin)[0]+'–'+PU.temp(w.tmax):null,w.windAvg!=null?PU.wind(w.windAvg)+' '+dirName(w.windDir):null,w.waveAvg!=null?PU.wave(w.waveAvg):null].filter(Boolean).join(' · ')})),
      h('span',{class:'pill '+(d.safe?(good?'good':mid?'warn':'bad'):'bad'),text:d.safe?String(d.best):'–'}),
      h('span',{class:'fdbar '+cls,title:EN?'Fishing index':'Δείκτης ψαρέματος'},h('i',{style:'width:'+(d.safe?Math.max(4,d.best):0)+'%'})));
    var tiles=h('div',{class:'ftiles'},
      tileEl('Καιρός',wxText(w.code)||'–'),
      tileEl('Θερμοκρασία',w.tmax!=null?PU.tempP(w.tmin)[0]+'–'+PU.temp(w.tmax):'–'),
      tileEl('Άνεμος',w.windMax!=null?PU.wind(w.windAvg)+' ('+(EN?'up to ':'έως ')+PU.wind(w.windMax)+')':'–'),
      tileEl('Ριπές',w.gustMax!=null?PU.wind(w.gustMax):'–'),
      tileEl('Βροχή',w.rainMax!=null?w.rainMax+'%'+(w.rainMm>=0.1?' · '+w.rainMm.toFixed(1)+' mm':''):'–'),
      tileEl('Σύννεφα',w.cloudAvg!=null?Math.round(w.cloudAvg)+'%':'–'),
      tileEl('Πίεση',w.pStart!=null?PU.press(w.pEnd)+' '+(w.pEnd-w.pStart>=1.5?'↑':w.pEnd-w.pStart<=-1.5?'↓':'→'):'–'),
      tileEl('Κύμα',w.waveMax!=null?PU.wave(w.waveAvg)+' ('+(EN?'up to ':'έως ')+PU.wave(w.waveMax)+')'+(w.period?' · '+Math.round(w.period)+' s':''):'–'),
      tileEl('Θάλασσα',w.sst!=null?PU.temp(w.sst,1):'–'),
      tileEl('Σελήνη',Math.round(w.illum*100)+'%'),
      tileEl('Ανατολή / Δύση',fmtMin(w.rise)+' / '+fmtMin(w.set)),
      tileEl('Καλύτερο παράθυρο',d.safe&&d.win?pad(d.win.s)+':00–'+pad((d.win.e+1)%24)+':00':'–'));
    var mx=Math.max.apply(null,d.hours.map(function(x){ return x.score; }).concat([1]));
    var bars=h('div',{class:'minibars'}); var byHr={}; d.hours.forEach(function(x){ byHr[x.hr]=x; });
    for(var k=0;k<24;k++){ var x=byHr[k]; bars.append(h('i',{style:'height:'+(x?Math.round(x.score/mx*100):0)+'%;'+(x&&x.safe?'':'opacity:.25'),title:pad(k)+':00'+(x?' · '+x.score:'')})); }
    var det=h('details',{class:'fday',id:'fd-'+d.date},sum,tiles,
      d.safe?null:h('p',{class:'note sfwarn',text:reason(d)}),
      h('div',{class:'label',style:'margin-top:8px',text:'Δείκτης ανά ώρα (00 → 23, αχνές οι ώρες με ανασφαλείς συνθήκες)'}),bars);
    D.append(det);
  });
  $('fcNote').textContent=note||(EN?'Index 0–100 from wind, gusts, waves, pressure, clouds, storms, light and moon. Only hours with wind up to 4 Bft, gusts up to 6 Bft and waves up to 0.9 m count. Local times.':'Δείκτης 0–100 από άνεμο, ριπές, κύμα, πίεση, σύννεφα, καταιγίδες, φως και σελήνη. Μετράνε μόνο ώρες με άνεμο ως 4 Bft, ριπές ως 6 Bft και κύμα ως 0,9 m. Ώρες τοπικές.')
}

/* ---------- γράφημα πίεσης 24 ωρών (ενδεικτικό, μοντέλο Open-Meteo) ---------- */
function pressSeries(p){
  var key='psaro-fcpress', c=lsGet(key,null);
  if(c&&c.id===p.id&&Date.now()-c.t<30*60000&&c.v) return Promise.resolve(c.v);
  var url='https://api.open-meteo.com/v1/forecast?latitude='+(+p.lat).toFixed(3)+'&longitude='+(+p.lon).toFixed(3)+'&hourly=pressure_msl&past_hours=24&forecast_hours=25&timezone=UTC';
  var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },10000);
  return fetch(url,{signal:ac.signal}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }).then(function(j){
    clearTimeout(tm); var ts=(j.hourly&&j.hourly.time)||[], ps=(j.hourly&&j.hourly.pressure_msl)||[], now=-1, out=[];
    for(var i=0;i<ts.length;i++){ if(typeof ps[i]!=='number') continue; var ms=Date.parse(ts[i]+'Z'); out.push([ms,ps[i]]); if(ms<=Date.now()) now=out.length-1; }
    var v={pts:out,now:now}; lsSet(key,{id:p.id,t:Date.now(),v:v}); return v;
  }).catch(function(e){ clearTimeout(tm); if(c&&c.id===p.id&&c.v) return c.v; throw e; });
}
function pressCard(p){
  var box=$('fcPress'); if(!box){ var D=$('fcDays'); if(!D) return; box=h('div',{id:'fcPress',class:'card',style:'margin:10px 0'}); D.parentNode.insertBefore(box,D); }
  box.replaceChildren(); if(!p) { box.hidden=true; return; } box.hidden=false;
  box.append(h('h3',{text:T('Πίεση 24 ωρών','Pressure, 24 h')}),h('p',{class:'note',text:T('Φόρτωση…','Loading…')}));
  pressSeries(p).then(function(v){
    var pts=v.pts, n=v.now; if(!pts.length||n<3){ throw new Error('nodata'); }
    var ns='http://www.w3.org/2000/svg', W=320, H=120, L=6, R=6, TP=10, BT=16;
    var vals=pts.map(function(x){ return x[1]; }), mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals); if(mx-mn<4){ var m=(mx+mn)/2; mn=m-2; mx=m+2; }
    var X=function(i){ return L+(W-L-R)*i/(pts.length-1); }, Y=function(pv){ return TP+(H-TP-BT)*(1-(pv-mn)/(mx-mn)); };
    var svg=document.createElementNS(ns,'svg'); svg.setAttribute('viewBox','0 0 '+W+' '+H); svg.setAttribute('role','img'); svg.setAttribute('aria-label',T('Γράφημα πίεσης','Pressure chart')); svg.style.cssText='width:100%;height:auto;display:block';
    var mk=function(tag,attrs){ var e=document.createElementNS(ns,tag); Object.keys(attrs).forEach(function(k){ e.setAttribute(k,attrs[k]); }); return e; };
    var cs=getComputedStyle(document.documentElement), line=(cs.getPropertyValue('--sea')||'#2b7a8c').trim()||'#2b7a8c', mut=(cs.getPropertyValue('--muted')||'#6b7c86').trim()||'#6b7c86', ink=(cs.getPropertyValue('--ink')||'#0c2b3a').trim()||'#0c2b3a';
    [mn,(mn+mx)/2,mx].forEach(function(g){ svg.append(mk('line',{x1:L,x2:W-R,y1:Y(g),y2:Y(g),stroke:mut,'stroke-opacity':.25,'stroke-width':1})); var t=mk('text',{x:W-R,y:Y(g)-2,'text-anchor':'end','font-size':8,fill:mut}); t.textContent=Math.round(g); svg.append(t); });
    var d1=pts.slice(0,n+1).map(function(x,i){ return (i?'L':'M')+X(i).toFixed(1)+' '+Y(x[1]).toFixed(1); }).join(' '), d2=pts.slice(n).map(function(x,i){ return (i?'L':'M')+X(n+i).toFixed(1)+' '+Y(x[1]).toFixed(1); }).join(' ');
    svg.append(mk('path',{d:d1,fill:'none',stroke:line,'stroke-width':2.2,'stroke-linejoin':'round'}),mk('path',{d:d2,fill:'none',stroke:line,'stroke-width':2.2,'stroke-dasharray':'4 3','stroke-linejoin':'round'}));
    svg.append(mk('line',{x1:X(n),x2:X(n),y1:TP-4,y2:H-BT,stroke:ink,'stroke-width':1,'stroke-dasharray':'2 2'}),mk('circle',{cx:X(n),cy:Y(pts[n][1]),r:3.2,fill:ink}));
    var lab=function(x,txt,anc){ var t=mk('text',{x:x,y:H-3,'text-anchor':anc,'font-size':8,fill:mut}); t.textContent=txt; svg.append(t); };
    lab(L,T('−24 ω','−24 h'),'start'); lab(X(n),T('τώρα','now'),'middle'); lab(W-R,T('+24 ω','+24 h'),'end');
    var dlt=function(a,b){ return pts[b][1]-pts[a][1]; }, fmt=function(d){ return (d>0?'+':d<0?'−':'')+Math.abs(d).toFixed(1)+' hPa'; };
    var back=dlt(Math.max(0,n-3),n), f3=n+3<pts.length?dlt(n,n+3):null, f6=n+6<pts.length?dlt(n,n+6):null;
    var verdict=function(d){ return d<=-3.6?T('πέφτει πολύ γρήγορα','falling very fast'):d<=-2?T('πέφτει γρήγορα','falling fast'):d<=-0.8?T('πέφτει','falling'):d>=2?T('ανεβαίνει γρήγορα','rising fast'):d>=0.8?T('ανεβαίνει','rising'):T('σταθερή','steady'); };
    box.replaceChildren(h('h3',{text:T('Πίεση 24 ωρών','Pressure, 24 h')}),svg,
      h('div',{class:'meta',style:'margin-top:6px',text:T('Τελευταίες 3 ώρες: ','Last 3 h: ')+fmt(back)+' ('+verdict(back)+')'+(f3!=null?' · '+T('επόμενες 3 ώρες: ','next 3 h: ')+fmt(f3):'')+(f6!=null?' · '+T('επόμενες 6 ώρες: ','next 6 h: ')+fmt(f6):'')}),
      h('p',{class:'note',text:T('Συνεχής γραμμή = παρελθόν, διακεκομμένη = πρόγνωση. Ενδεικτικό, από μοντέλο και όχι από βαρόμετρο.','Solid = past, dashed = forecast. Indicative, from a model, not a barometer.')}));
  }).catch(function(){ box.replaceChildren(h('h3',{text:T('Πίεση 24 ωρών','Pressure, 24 h')}),h('p',{class:'note',text:T('Δεν φορτώθηκαν δεδομένα πίεσης.','Pressure data did not load.')})); });
}
/* ---------- ειδοποιήσεις ---------- */
function cfgPlaces(){ return allPlaces().map(function(p){ return {id:p.id,name:p.name,lat:+p.lat.toFixed(3),lon:+p.lon.toFixed(3),watch:p.watch!==false}; }); }
async function writeCfg(){
  var cfg={lang:window.LANG||'el',on:nt.on,threshold:nt.threshold,pressure:nt.pressure!==false,notified:nt.notified,server:!!nt.server,places:cfgPlaces()};
  try{ var c=await caches.open('psaro-cfg'); await c.put(new URL('__cfg',location.href).href,new Response(JSON.stringify(cfg))); }catch(e){}
}
var b64u=function(s){ var p='='.repeat((4-s.length%4)%4), r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(r,function(c){ return c.charCodeAt(0); }); };
async function subId(sub){
  var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub.endpoint));
  return Array.prototype.map.call(new Uint8Array(buf),function(b){ return ('0'+b.toString(16)).slice(-2); }).join('').slice(0,40);
}
async function getSub(create){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!window.VAPID_PUBLIC) return null;
  var reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription();
  if(!sub&&create) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(window.VAPID_PUBLIC)});
  return sub;
}
async function pushServer(){
  var cl=Cl(); if(!cl) return false;
  try{
    var sub=await getSub(true); if(!sub) return false;
    var body={id:await subId(sub),sub:sub.toJSON(),places:cfgPlaces(),threshold:nt.threshold,checked_at:null,updated_at:new Date().toISOString()};
    var H={Prefer:'resolution=merge-duplicates,return=minimal'};
    try{ await cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:nt.pressure!==false},body))}); }
    catch(e1){ await cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(body)}); }
    return true;
  }catch(e){ return false; }
}
async function dropServer(){
  var cl=Cl(); if(!cl) return;
  try{ var sub=await getSub(false); if(sub) await cl.rest('push_subs?id=eq.'+(await subId(sub)),{method:'DELETE'}); }catch(e){}
}
function ntStatus(t){ $('ntMsg').textContent=t; }
function sigOf(){ return JSON.stringify([nt.threshold,allPlaces().map(function(p){ return [p.id,+p.lat.toFixed(2),+p.lon.toFixed(2),p.watch!==false]; })]); }
async function syncNotify(onlyIfChanged){
  save();
  if(!nt.on){ await writeCfg(); return; }
  var sg=sigOf()+(nt.pressure!==false); if(onlyIfChanged&&nt.sig===sg&&nt.server) return; nt.sig=sg;
  var ok=await pushServer(); nt.server=ok; save(); await writeCfg();
  ntStatus(ok?'Ενεργό. Ο server ελέγχει την πρόγνωση περίπου κάθε 3 ώρες και σου στέλνει ειδοποίηση, ακόμα και με κλειστή εφαρμογή.':'Ενεργό μόνο όταν ανοίγεις την εφαρμογή (ή περιοδικά στο παρασκήνιο, αν το επιτρέπει το Android). Για ειδοποιήσεις με κλειστή εφαρμογή χρειάζεται η ρύθμιση του server.');
}
async function showNote(title,body){
  try{
    var reg=await navigator.serviceWorker.getRegistration();
    if(reg) await reg.showNotification(title,{body:body,tag:'psaro-ideal',icon:'icon-192.png',badge:'icon-192.png',data:{url:reg.scope}});
    else new Notification(title,{body:body});
  }catch(e){ try{ new Notification(title,{body:body}); }catch(e2){} }
}
async function localCheck(){
  if(!nt.on||nt.server||!('Notification' in window)||Notification.permission!=='granted') return;
  try{
    var r=await PF.checkPlaces({lang:window.LANG||'el',places:cfgPlaces(),threshold:nt.threshold,pressure:nt.pressure!==false,notified:nt.notified});
    nt.notified=r.notified; save(); await writeCfg();
    if(r.items.length) showNote(r.title,r.body);
  }catch(e){}
}
async function periodic(on){
  try{ var reg=await navigator.serviceWorker.ready; if(!reg.periodicSync) return false;
    if(on) await reg.periodicSync.register('psaro-forecast',{minInterval:12*3600*1000}); else await reg.periodicSync.unregister('psaro-forecast'); return true;
  }catch(e){ return false; }
}
$('ntPress').checked=nt.pressure!==false;
$('ntOn').checked=!!nt.on; $('ntThr').value=String(nt.threshold);
$('ntOn').addEventListener('change',async function(){
  if($('ntOn').checked){
    if(!('Notification' in window)){ $('ntOn').checked=false; ntStatus('Ο browser δεν υποστηρίζει ειδοποιήσεις.'); return; }
    var p=await Notification.requestPermission();
    if(p!=='granted'){ $('ntOn').checked=false; ntStatus('Δεν δόθηκε άδεια ειδοποιήσεων. Επίτρεψέ τες στις ρυθμίσεις του browser.'); return; }
    nt.on=true; nt.notified={}; await syncNotify(); await periodic(true); localCheck();
  } else { nt.on=false; save(); await writeCfg(); await dropServer(); await periodic(false); nt.server=false; save(); ntStatus('Οι ειδοποιήσεις έκλεισαν.'); }
});
$('ntThr').addEventListener('change',async function(){ nt.threshold=+$('ntThr').value; nt.notified={}; save(); if(nt.on){ await syncNotify(); localCheck(); } });
$('ntPress').addEventListener('change',function(){ nt.pressure=$('ntPress').checked; save(); if(nt.on){ syncNotify(); } });
$('ntTest').addEventListener('click',async function(){
  if(!('Notification' in window)){ ntStatus('Ο browser δεν υποστηρίζει ειδοποιήσεις.'); return; }
  var p=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(p!=='granted'){ ntStatus('Δεν δόθηκε άδεια ειδοποιήσεων.'); return; }
  await showNote('Δοκιμή ειδοποίησης','Οι ειδοποιήσεις του BiteCast δουλεύουν.'); ntStatus('Στάλθηκε δοκιμαστική ειδοποίηση.');
});
if(nt.on) ntStatus(nt.server?T('Ενεργό (server).','Active (server).'):T('Ενεργό.','Active.'));

/* ---------- events ---------- */
$('plGo').addEventListener('click',geocode);
$('plQ').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); geocode(); } });
$('plSpots').addEventListener('click',showSpots);
$('plMap').addEventListener('click',function(){ window.dispatchEvent(new Event('psaro-pickfc')); });
async function revName(lat,lon){
  var pts=[[0,0],[.03,0],[-.03,0],[0,.03],[0,-.03]];
  for(var i=0;i<pts.length;i++){
    try{
      var r=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language='+(EN?'en':'el')+'&lat='+(lat+pts[i][0])+'&lon='+(lon+pts[i][1]));
      if(!r.ok) continue; var j=await r.json(); if(!j||j.error) continue;
      var a=j.address||{}, n=a.suburb||a.village||a.town||a.city||a.hamlet||a.neighbourhood||a.municipality||j.name||'';
      if(n) return (i?(EN?'Near ':'Κοντά: '):'')+n;
    }catch(e){ return ''; }
  }
  return '';
}
window.addEventListener('psaro-fcpick',function(e){
  var d=e.detail, id=pid(d.lat,d.lon), had=places.some(function(p){ return p.id===id; });
  addPlace((EN?'Point ':'Σημείο ')+PsaroCoord.fmt(d.lat,d.lon),d.lat,d.lon);
  if(had) return;
  var p=places.filter(function(x){ return x.id===id; })[0]; if(p) p.auto=true;
  revName(d.lat,d.lon).then(function(n){
    var q=places.filter(function(x){ return x.id===id; })[0];
    if(n&&q&&q.auto){ q.name=n; save(); renderPlaces(); if(sel===id) renderFc(fcPlace&&findPlace(sel),fc,'',Date.now()); syncNotify(); }
  });
});
$('fcRefresh').addEventListener('click',function(){ load(true); });
$('fcWatch').addEventListener('click',function(){
  var p=findPlace(sel); if(!p) return;
  if(p.gps) nt.gpsWatch=!(nt.gpsWatch!==false); else p.watch=!(p.watch!==false);
  save(); renderPlaces(); renderFc(fcPlace&&findPlace(sel),fc,'',Date.now()); syncNotify();
});
$('plRen').addEventListener('click',async function(){
  var p=places.filter(function(x){ return x.id===sel; })[0]; if(!p) return;
  var n=await window.PsaroAsk.prompt(EN?'Location name':'Όνομα τοποθεσίας',{value:p.name,title:EN?'Rename location':'Μετονομασία τοποθεσίας',ok:EN?'Save':'Αποθήκευση',max:40}); if(n==null) return; n=n.trim().slice(0,40); if(!n) return;
  p.name=n; p.auto=false; save(); renderPlaces(); renderFc(fcPlace&&findPlace(sel),fc,'',Date.now()); syncNotify();
});
$('plDel').addEventListener('click',async function(){
  var p=findPlace(sel); if(p&&!(await window.PsaroAsk((EN?'Delete ':'Διαγραφή ')+'«'+p.name+'»;',{title:EN?'Delete location':'Διαγραφή τοποθεσίας',ok:EN?'Delete':'Διαγραφή',danger:true}))) return;
  places=places.filter(function(p){ return p.id!==sel; }); sel='gps'; save(); renderPlaces(); load(); syncNotify();
});
document.querySelectorAll('nav.tabs button[data-tab="fc"]').forEach(function(b){ b.addEventListener('click',function(){ renderPlaces(); load(); }); });
document.addEventListener('psaro-cond',function(){ renderPlaces(); if(!document.getElementById('tab-fc').hidden) load(); else if(sel==='gps') { /* θα φορτώσει όταν ανοίξει */ } if(nt.on) syncNotify(true); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden) localCheck(); });
renderPlaces(); 
setTimeout(function(){ if(nt.on) { writeCfg(); localCheck(); } },3000);
})();
