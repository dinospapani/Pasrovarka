/* Ιστορικός καιρός για καταγραφές εκ των υστέρων (Open-Meteo: ERA5 / αναλύσεις μοντέλου).
   Είναι εκτίμηση μοντέλου (~25 km), όχι μέτρηση στο σημείο. Σημειώνεται στο ψάρι ως hist:true. */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var HOUR=3600000, DAY=86400000;
function num(v){ return (typeof v==='number'&&isFinite(v))?v:null; }
function getJson(url,ms){
  var ac=('AbortController' in window)?new AbortController():null, t=setTimeout(function(){ if(ac) ac.abort(); },ms||12000);
  return fetch(url,ac?{signal:ac.signal}:{}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).finally(function(){ clearTimeout(t); });
}
function iso(ms){ return new Date(ms).toISOString().slice(0,10); }
/* ms = στιγμή του ψαριού (UTC ms). Επιστρέφει {wind,wave,press,ptrend,cloud,temp,sst,wavePeriod} ή null. */
function fetchHist(lat,lon,ms){
  var age=Date.now()-ms; if(!(age>0)||typeof lat!=='number'||typeof lon!=='number') return Promise.resolve(null);
  var recent=age<85*DAY, past=Math.min(92,Math.ceil(age/DAY)+2);
  var d1=iso(ms-DAY), d2=iso(ms+HOUR), pos='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&timezone=GMT';
  var wv='temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover', mv='wave_height,wave_period,sea_surface_temperature';
  var wu=recent?'https://api.open-meteo.com/v1/forecast?'+pos+'&hourly='+wv+'&past_days='+past+'&forecast_days=1&wind_speed_unit=kn'
               :'https://archive-api.open-meteo.com/v1/archive?'+pos+'&hourly='+wv+'&start_date='+d1+'&end_date='+d2+'&wind_speed_unit=kn';
  var mu='https://marine-api.open-meteo.com/v1/marine?'+pos+'&hourly='+mv+(recent?'&past_days='+past+'&forecast_days=1':'&start_date='+d1+'&end_date='+d2);
  return Promise.allSettled([getJson(wu),getJson(mu)]).then(function(r){
    if(r[0].status!=='fulfilled') return null;
    var h=(r[0].value&&r[0].value.hourly)||{}, tm=h.time||[]; if(!tm.length) return null;
    var want=new Date(Math.round(ms/HOUR)*HOUR).toISOString().slice(0,13)+':00', i=tm.indexOf(want); if(i<0) return null;
    var press=num(h.pressure_msl&&h.pressure_msl[i]), old=num(h.pressure_msl&&h.pressure_msl[i-3]), ptrend=null;
    if(press!=null&&old!=null){ var d=press-old; ptrend=d<=-3?'fast':d<=-1?'slow':d>=1?'rise':'stable'; }
    var ws=num(h.wind_speed_10m&&h.wind_speed_10m[i]), cc=num(h.cloud_cover&&h.cloud_cover[i]);
    var out={temp:num(h.temperature_2m&&h.temperature_2m[i]),press:press==null?null:Math.round(press),ptrend:ptrend,wind:ws==null?null:Math.round(ws),
      cloud:cc==null?null:cc<20?'clear':cc<70?'part':'over',wave:null,wavePeriod:null,sst:null};
    if(r[1].status==='fulfilled'){
      var m=(r[1].value&&r[1].value.hourly)||{}, mt=m.time||[], j=mt.indexOf(want);
      if(j>=0){ out.wave=num(m.wave_height&&m.wave_height[j]); out.wavePeriod=num(m.wave_period&&m.wave_period[j]); out.sst=num(m.sea_surface_temperature&&m.sea_surface_temperature[j]); }
    }
    if(out.wave!=null) out.wave=Math.round(out.wave*10)/10;
    return out;
  }).catch(function(){ return null; });
}
var KEYS=['wind','wave','press','ptrend','cloud','temp','sst'];
function empty(b){ return KEYS.every(function(k){ return b[k]==null||b[k]===''; }); }
/* καιρός που πιθανόν δεν αντιστοιχεί στην ώρα του ψαριού: η εγγραφή φτιάχτηκε πολύ μετά (ή πριν) την ώρα του ψαριού */
function created(b){ var n=parseInt(String(b.id||'').slice(0,8),36); return (n>1.6e12&&n<2.1e12)?n:null; }
function suspect(b,ms){ if(b.hist||empty(b)) return false; var c=created(b); return c!=null&&Math.abs(c-ms)>90*60000; }
window.PsaroHist={fetch:fetchHist,keys:KEYS,empty:empty};

/* ---- μαζική συμπλήρωση παλιών ψαριών (ρυθμίσεις θάλασσας) ---- */
(window.PsaroSeaRows=window.PsaroSeaRows||[]).push(function(){
  var C=window.PsaroCore; if(!C||!C.Store||!C.biteMs) return null;
  function todo(){ return (C.Store.get('bites')||[]).filter(function(b){ return typeof b.lat==='number'&&typeof b.lon==='number'&&(empty(b)||suspect(b,C.biteMs(b)))&&C.biteMs(b)<Date.now()-90*60000; }); }
  var r=document.createElement('div'); r.className='sprow'; var x=document.createElement('div'); x.className='sptx';
  var b1=document.createElement('b'); b1.textContent=T('Καιρός παλιών ψαριών','Weather for older catches');
  var sp=document.createElement('span'); function txt(){ var n=todo().length; sp.textContent=n?T('Υπάρχουν '+n+' ψάρια με θέση που δεν έχουν καιρό ή έχουν καιρό άλλης ώρας. Θα ενημερωθούν με εκτίμηση ιστορικού.','There are '+n+' catches with a position and no weather, or with weather from another time. They will be updated with a historical estimate.'):T('Όλα τα ψάρια με θέση έχουν καιρό.','All catches with a position already have weather.'); }
  txt(); x.append(b1,sp);
  var bt=document.createElement('button'); bt.type='button'; bt.className='spb acc'; bt.textContent=T('Συμπλήρωση','Fill in');
  bt.addEventListener('click',function(){
    var list=todo(); if(!list.length){ C.toast(T('Δεν υπάρχει κάτι να συμπληρωθεί.','Nothing to fill in.')); return; }
    bt.disabled=true; var done=0, i=0;
    (function next(){
      if(i>=list.length){ bt.disabled=false; bt.textContent=T('Συμπλήρωση','Fill in'); txt(); C.toast(T('Συμπληρώθηκαν '+done+' από '+list.length+'.','Filled '+done+' of '+list.length+'.')); return; }
      var b=list[i++]; bt.textContent=i+'/'+list.length+'…';
      fetchHist(b.lat,b.lon,C.biteMs(b)).then(function(h){
        if(h){ var o=Object.assign({},b); var sus=suspect(b,C.biteMs(b)); KEYS.forEach(function(k){ if(h[k]!=null||sus) o[k]=h[k]==null?null:h[k]; }); if(h.wavePeriod!=null) o.wavePeriod=h.wavePeriod; o.hist=true; return C.Store.save('bites',o).then(function(){ done++; }); }
      }).catch(function(){}).then(function(){ setTimeout(next,350); });
    })();
  });
  r.append(x,bt); return r;
});
})();
