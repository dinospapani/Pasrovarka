/* Συντεταγμένες σε μοίρες και δεκαδικά λεπτά (όπως στο GPS/πλότερ): N 35°03.602′  E 32°23.856′
   Δέχεται επίσης: 35 03.602 N · 35°03'36"N · 35.06715 · 3503.602 (NMEA) · ολόκληρο ζεύγος σε ένα πεδίο. */
(function(){
'use strict';
var P=window.PsaroCoord={};
function hemi(v,axis){ return axis==='lat'?(v<0?'S':'N'):(v<0?'W':'E'); }
/* τιμή → «N 35°03.602′» */
P.fmtOne=function(v,axis){
  if(typeof v!=='number'||!isFinite(v)) return '';
  var a=Math.abs(v), d=Math.floor(a), m=(a-d)*60, ms=m.toFixed(3);
  if(parseFloat(ms)>=60){ d+=1; ms='0.000'; }
  var mm=(parseFloat(ms)<10?'0':'')+ms;
  return hemi(v,axis)+' '+(axis==='lat'&&d<10?'0'+d:''+d)+'°'+mm+'′';
};
/* ζεύγος → «N 35°03.602′ E 32°23.856′» */
P.fmt=function(lat,lon){
  if(typeof lat!=='number'||typeof lon!=='number') return '';
  return P.fmtOne(lat,'lat')+'  '+P.fmtOne(lon,'lon');
};
/* κείμενο → δεκαδικές μοίρες (NaN αν δεν είναι έγκυρο) */
P.parse=function(str,axis){
  if(str==null) return NaN;
  var s=String(str).trim().toUpperCase();
  if(!s) return NaN;
  var h=null, mt=s.match(/[NSEW]/g);
  if(mt){ if(mt.length>1) return NaN; h=mt[0]; s=s.replace(/[NSEW]/,' '); }
  if(h){ if(axis==='lat'&&(h==='E'||h==='W')) return NaN; if(axis==='lon'&&(h==='N'||h==='S')) return NaN; }
  var neg=/^\s*[-−–]/.test(s);
  s=s.replace(/,/g,'.').replace(/[°º˚'′’"″”`]/g,' ').replace(/[^0-9.\s]/g,' ');
  var nums=s.match(/\d+(?:\.\d+)?|\.\d+/g); if(!nums||nums.length>3) return NaN;
  nums=nums.map(parseFloat); var v;
  if(nums.length===1){
    var n=nums[0], ip=Math.floor(n), digs=String(ip).length;
    if(/^\s*\d+\.?\d*\s*$/.test(s)&&((axis==='lat'&&digs===4)||(axis==='lon'&&digs===5)||(axis==='lon'&&digs===4&&ip>=1000&&nums[0]>=1000))){ /* NMEA DDMM.mmm */
      var dd=Math.floor(n/100), mm=n-dd*100; if(mm>=60) return NaN; v=dd+mm/60;
    } else v=n;
  } else if(nums.length===2){ if(nums[1]>=60) return NaN; v=nums[0]+nums[1]/60; }
  else { if(nums[1]>=60||nums[2]>=60) return NaN; v=nums[0]+nums[1]/60+nums[2]/3600; }
  if(neg||h==='S'||h==='W') v=-v;
  var lim=axis==='lat'?90:180; if(!(Math.abs(v)<=lim)) return NaN;
  return v;
};
/* «N 35°03.602′ E 32°23.856′» σε ένα πεδίο → [lat,lon] ή null */
P.parsePair=function(str){
  var s=String(str||'').trim(); if(!s) return null;
  var u=s.toUpperCase(), idx=[], i, a, b;
  for(i=0;i<u.length;i++) if('NSEW'.indexOf(u[i])>=0) idx.push(i);
  if(idx.length===2){
    var cut=/^[NSEW]/.test(u)?idx[1]:idx[0]+1; a=s.slice(0,cut); b=s.slice(cut);
    if(/[EW]/.test(u[idx[0]])){ var t=a; a=b; b=t; }
  } else if(!idx.length){ var parts=s.split(/[;/]|,(?=\s*[-−+]?\d)/); if(parts.length===2){ a=parts[0]; b=parts[1]; } else return null; }
  else return null;
  var la=P.parse(a,'lat'), lo=P.parse(b,'lon'); if(isNaN(la)||isNaN(lo)) return null; return [la,lo];
};
/* δέσιμο δύο πεδίων κειμένου. Επικόλληση ζεύγους στο πρώτο πεδίο τα γεμίζει και τα δύο. onChange(lat|null,lon|null) */
P.bind=function(latEl,lonEl,onChange){
  function state(){
    var la=P.parse(latEl.value,'lat'), lo=P.parse(lonEl.value,'lon');
    latEl.classList.toggle('bad',!!latEl.value.trim()&&isNaN(la)); lonEl.classList.toggle('bad',!!lonEl.value.trim()&&isNaN(lo));
    return {la:isNaN(la)?null:la,lo:isNaN(lo)?null:lo};
  }
  function emit(){ var s=state(); if(onChange) onChange(s.la,s.lo); }
  function pair(){ var pr=P.parsePair(latEl.value); if(pr){ latEl.value=P.fmtOne(pr[0],'lat'); lonEl.value=P.fmtOne(pr[1],'lon'); return true; } return false; }
  [latEl,lonEl].forEach(function(el){ el.setAttribute('autocomplete','off'); el.setAttribute('autocapitalize','characters'); el.setAttribute('spellcheck','false'); });
  latEl.addEventListener('input',function(){ if(/[EW]/i.test(latEl.value)&&/[NS]/i.test(latEl.value)) pair(); emit(); });
  lonEl.addEventListener('input',emit);
  latEl.addEventListener('blur',function(){ var v=P.parse(latEl.value,'lat'); if(!isNaN(v)) latEl.value=P.fmtOne(v,'lat'); emit(); });
  lonEl.addEventListener('blur',function(){ var v=P.parse(lonEl.value,'lon'); if(!isNaN(v)) lonEl.value=P.fmtOne(v,'lon'); emit(); });
};
P.set=function(latEl,lonEl,lat,lon){
  latEl.value=typeof lat==='number'?P.fmtOne(lat,'lat'):''; lonEl.value=typeof lon==='number'?P.fmtOne(lon,'lon'):'';
  latEl.classList.remove('bad'); lonEl.classList.remove('bad');
};
P.get=function(latEl,lonEl){ var la=P.parse(latEl.value,'lat'), lo=P.parse(lonEl.value,'lon'); return (isNaN(la)||isNaN(lo))?null:{lat:la,lon:lo}; };
})();
