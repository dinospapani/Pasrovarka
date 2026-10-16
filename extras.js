/* Έξοδος και ασφάλεια: Έναρξη/Τέλος εξόδου, ώρα επιστροφής, έλεγχος σιωπής, SOS, επαφή ασφαλείας (στο προφίλ). */
(function(){
'use strict';
var C=window.PsaroCore; if(!C||!document.getElementById('safeCard')) return;
var $=C.$, h=C.h, toast=C.toast;
var KEY='psaro-safe';
var BOT='BiteCastMaydaybot';   /* όνομα του Telegram bot, χωρίς @ */
var Cl=function(){ return window.PsaroCloud&&window.PsaroCloud.logged()?window.PsaroCloud:null; };
function load(){ return C.lsGet(KEY,null)||{}; }
function save(s){ C.lsSet(KEY,s); }
function srvMsg(m){ var x=$('sfSrv'); if(x) x.textContent=m||''; }
function hm(ms){ var d=new Date(ms+C.utcMin()*60000); return ('0'+d.getUTCHours()).slice(-2)+':'+('0'+d.getUTCMinutes()).slice(-2); }
function dur(ms){ var m=Math.max(0,Math.round(ms/60000)), hh=Math.floor(m/60), en=window.LANG==='en', H=en?'h':'ω', M=en?'m':'λ'; return hh?hh+H+' '+('0'+(m%60)).slice(-2)+M:m+M; }
function newCode(){ var a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',o=''; for(var i=0;i<10;i++) o+=a[Math.floor(Math.random()*a.length)]; return o; }
function localMinToMs(hhmm){
  var p=hhmm.split(':'), off=C.utcMin(), nowL=Date.now()+off*60000, d=new Date(nowL);
  var t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),+p[0],+p[1])-off*60000;
  if(t<Date.now()-60000) t+=86400000;
  return t;
}
function mapLink(p){ return p&&p.lat!=null?'https://maps.google.com/?q='+p.lat.toFixed(5)+','+p.lon.toFixed(5):''; }
var batt=null;
try{ if(navigator.getBattery) navigator.getBattery().then(function(b){ batt=b; }).catch(function(){}); }catch(e){}
function battPct(){ return batt&&typeof batt.level==='number'?Math.round(batt.level*100):null; }

/* ---------- επαφή ασφαλείας (προφίλ) ---------- */
function hasContact(d){ return !!(d.phone||d.email||d.tgLinked); }
function readContact(){
  var d=load();
  d.name=$('sfName').value.trim(); d.phone=$('sfPhone').value.trim(); d.email=$('sfEmail').value.trim();
  save(d); return d;
}
function fillContact(){
  var d=load(); $('sfName').value=d.name||''; $('sfPhone').value=d.phone||''; $('sfEmail').value=d.email||'';
}
async function pushContact(){
  var cl=Cl(); if(!cl) return;
  var d=load(), body={email:($('sfEmail').value||'').trim()||null,updated_at:new Date().toISOString()};
  if(d.tgCode) body.tg_code=d.tgCode;
  var full=Object.assign({},body); if(d.selfCode) full.self_code=d.selfCode;
  var H={Prefer:'resolution=merge-duplicates,return=minimal'};
  try{ await cl.rest('safety_contacts',{method:'POST',headers:H,body:JSON.stringify(full)}); }
  catch(err){ try{ await cl.rest('safety_contacts',{method:'POST',headers:H,body:JSON.stringify(body)}); }catch(e2){} }
}
async function pollTg(){
  var cl=Cl(); if(!cl||!BOT) return;
  var j=null;
  try{ var r=await cl.rest('safety_contacts?select=tg_chat_id,tg_name,self_chat_id'); j=await r.json(); }
  catch(err){ try{ var r2=await cl.rest('safety_contacts?select=tg_chat_id,tg_name'); j=await r2.json(); }catch(e2){ return; } }
  var c=j&&j[0], d=load(); d.tgLinked=!!(c&&c.tg_chat_id); d.selfLinked=!!(c&&c.self_chat_id); save(d);
  var st=$('sfTgState'), ss=$('selfTgState');
  if(st){ if(d.tgLinked) st.textContent='Συνδέθηκε στο Telegram: '+(c.tg_name||'επαφή')+' ✓'; else if(d.tgCode) st.textContent='Περιμένουμε να πατήσει η επαφή τον σύνδεσμο και Start. Η σύνδεση ολοκληρώνεται μέσα σε λίγα λεπτά.'; }
  if(ss){ if(d.selfLinked) ss.textContent='Το Telegram σου είναι συνδεδεμένο ✓'; else if(d.selfCode) ss.textContent='Πάτα Start στο Telegram. Η σύνδεση ολοκληρώνεται μέσα σε λίγα λεπτά.'; }
  render();
}

/* ---------- server ---------- */
var extOK=true;
async function pushTrip(){
  var s=load(), cl=Cl(); if(!s.id||!cl) return;
  var base={id:s.id,user_name:cl.name()||'',route:s.route||'',due_at:new Date(s.due).toISOString(),status:s.active?'active':'done',
    last_lat:s.last?s.last.lat:null,last_lon:s.last?s.last.lon:null,last_at:s.last?new Date(s.last.t).toISOString():null};
  var ext=Object.assign({},base,{battery:battPct(),hb_at:new Date().toISOString(),silence_min:s.sil||0});
  var H={Prefer:'resolution=merge-duplicates,return=minimal'};
  try{
    try{ if(!extOK) throw new Error('base'); await cl.rest('safety_trips',{method:'POST',headers:H,body:JSON.stringify(ext)}); }
    catch(e1){ extOK=false; await cl.rest('safety_trips',{method:'POST',headers:H,body:JSON.stringify(base)}); }
    srvMsg(s.active?'Η δήλωση έφτασε στον server: η επαφή θα ειδοποιηθεί αυτόματα αν κάτι δεν πάει καλά.':'');
    s=load(); s.synced=true; save(s);
  }catch(err){ var s2=load(); s2.synced=false; save(s2); srvMsg('Δεν έφτασε στον server (ελέγξτε internet ή αν έχει στηθεί ο server). Η υπενθύμιση στο κινητό δουλεύει κανονικά.'); }
}

/* ---------- μηνύματα ---------- */
function plan(s,kind){
  var link=mapLink(s.last), t;
  if(kind==='sos') t='ΒΟΗΘΕΙΑ (BiteCast): δεν έχω επιστρέψει ακόμα και είχα δηλώσει επιστροφή στις '+hm(s.due)+(s.route?' (διαδρομή: '+s.route+')':'')+'.';
  else t='Σχέδιο εξόδου (BiteCast): ψαρεύω με το σκάφος'+(s.route?' – '+s.route:'')+'. Επιστροφή στις '+hm(s.due)+'.';
  if(link) t+=' Τελευταία θέση'+(s.last&&s.last.t?' ('+hm(s.last.t)+')':'')+': '+link;
  return t;
}
function send(s,kind,via){
  var text=plan(s,kind), phone=(s.phone||'').replace(/[^\d+]/g,''), digits=phone.replace(/^\+/,'');
  if(via==='wa'&&digits) window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(text),'_blank');
  else if(via==='sms'&&phone) window.location.href='sms:'+phone+'?&body='+encodeURIComponent(text);
  else if(navigator.share) navigator.share({text:text}).catch(function(){});
  else { try{ navigator.clipboard.writeText(text); toast('Αντιγράφηκε το μήνυμα.'); }catch(e){} }
}

/* ---------- κατάσταση εξόδου ---------- */
var timer=null, lastTrack=0;
async function trackPos(){
  var s=load(); if(!s.active) return;
  lastTrack=Date.now();
  try{ var p=await C.getPosition(); s=load(); s.last={lat:p.lat,lon:p.lon,t:Date.now()}; save(s); render(); pushTrip(); }catch(e){ pushTrip(); }
}
function late(s){ return s.active&&Date.now()>s.due; }
function bar(){
  var s=load(), b=$('lateBar');
  if(!late(s)){ if(b) b.remove(); return; }
  if(!b){
    b=h('div',{id:'lateBar',role:'alert'},h('span',{id:'lateTxt',style:'flex:1;min-width:200px'}),
      h('button',{class:'btn sm',type:'button',id:'lbBack',text:'Γύρισα'}),
      h('button',{class:'btn sm ghost',type:'button',id:'lbExt',style:'color:#fff;border-color:#fff',text:'+30 λεπτά'}),
      h('button',{class:'btn sm ghost',type:'button',id:'lbSos',style:'color:#fff;border-color:#fff',text:'Στείλε SOS'}));
    document.body.prepend(b);
    $('lbBack').addEventListener('click',back); $('lbExt').addEventListener('click',ext); $('lbSos').addEventListener('click',function(){ trackPos().then(function(){ sos(); }); });
  }
  $('lateTxt').textContent='Πέρασε η ώρα επιστροφής ('+hm(s.due)+'). Είσαι καλά;';
}
function sessBar(s){
  var b=$('sessBar');
  if(!s.active||late(s)){ if(b) b.remove(); return; }
  if(!b){
    b=h('div',{id:'sessBar'},h('span',{id:'sessTxt'}),h('button',{class:'btn sm',type:'button',id:'sessEnd',text:'Τέλος εξόδου'}));
    var hd=document.querySelector('header.top'); hd.parentNode.insertBefore(b,hd.nextSibling);
    $('sessTxt').addEventListener('click',openSheet);
    $('sessEnd').addEventListener('click',back);
  }
  $('sessTxt').textContent='● Σε έξοδο '+dur(Date.now()-s.start)+' · επιστροφή '+hm(s.due);
}
function wxWarn(s){
  var el=$('sfWx'), c=C.getCond()||{}, msg='';
  if(s.active){
    var w=c.wind, v=c.wave;
    if((w!=null&&w>=27)||(v!=null&&v>=2.5)) msg='Επικίνδυνες συνθήκες ('+(w!=null?window.PF.bft(w)+' Bft άνεμος':'')+(v!=null?(w!=null?', ':'')+v.toFixed(1)+' m κύμα':'')+'). Σκέψου να γυρίσεις.';
    else if((w!=null&&w>=20)||(v!=null&&v>=1.5)) msg='Προσοχή: δυναμώνει ο καιρός ('+(w!=null?window.PF.bft(w)+' Bft άνεμος':'')+(v!=null?(w!=null?', ':'')+v.toFixed(1)+' m κύμα':'')+').';
  }
  el.textContent=msg; el.hidden=!msg;
}
function silNote(d){
  var sel=$('sfSil'), n=$('sfSilNote'); if(!sel) return;
  if(!d.selfLinked){ sel.value='0'; sel.disabled=true; n.textContent=BOT?'Για να ενεργοποιηθεί, σύνδεσε το δικό σου Telegram στο προφίλ. Το BiteCast θα σε ρωτάει «είσαι καλά;» πριν ειδοποιήσει την επαφή σου.':''; }
  else { sel.disabled=false; if(sel.value==='0'&&!sel.dataset.touched) sel.value='60'; n.textContent='Αν δεν υπάρχει σήμα από το κινητό για τόσο, σε ρωτάμε στο Telegram. Αν δεν απαντήσεις σε 15 λεπτά, ειδοποιείται η επαφή σου.'; }
}
function render(){
  var s=load(), on=!!s.active, card=$('safeCard');
  $('safeIdle').hidden=on; $('safeActive').hidden=!on;
  card.classList.toggle('live',!!(on&&!late(s))); card.classList.toggle('late',!!late(s));
  var bd=$('sfBadge'); bd.hidden=!on; bd.className='pill '+(late(s)?'bad':'good'); bd.textContent=late(s)?'Καθυστερείς':'Σε έξοδο';
  if(on){
    $('sfInfo').textContent=(late(s)?'Η επιστροφή ήταν στις ':'Επιστροφή στις ')+hm(s.due)+' · διάρκεια '+dur(Date.now()-s.start);
    $('sfLast').textContent=s.last?('Τελευταία γνωστή θέση: '+hm(s.last.t)+' · '+s.last.lat.toFixed(4)+', '+s.last.lon.toFixed(4)):'Δεν έχει καταγραφεί θέση ακόμα.';
    $('sfMon').textContent='Παρακολούθηση: '+(s.sil?'έλεγχος αν χαθεί το σήμα μετά από '+s.sil+' λεπτά, ':'')+'ειδοποίηση επαφής αν περάσει η ώρα επιστροφής, και αν η μπαταρία πέσει κάτω από 10%.';
  } else {
    var d=load(); $('sfNoC').hidden=hasContact(d); silNote(d);
    if(!$('sfTime').value){ var t=new Date(Date.now()+C.utcMin()*60000+4*3600000); $('sfTime').value=('0'+t.getUTCHours()).slice(-2)+':'+('0'+t.getUTCMinutes()).slice(-2); }
  }
  var tb=$('tripBtn'); tb.textContent=!on?'▶ Έξοδος':(late(s)?'⚠ Καθυστερείς':'● Σε έξοδο'); tb.classList.toggle('on',!!on); tb.classList.toggle('late',!!late(s));
  wxWarn(s); bar(); sessBar(s);
}
function openSheet(){ render(); $('tripSheet').hidden=false; }
function closeSheet(){ $('tripSheet').hidden=true; }
function openForm(){ $('sfMsg').textContent=''; setDur(4); }
function setDur(hrs){
  var t=new Date(Date.now()+C.utcMin()*60000+hrs*3600000);
  $('sfTime').value=('0'+t.getUTCHours()).slice(-2)+':'+('0'+t.getUTCMinutes()).slice(-2);
  Array.prototype.forEach.call(document.querySelectorAll('#sfDur .chip'),function(b){ b.setAttribute('aria-pressed',String(+b.dataset.h===hrs)); });
}
function start(){
  var d=load(), time=$('sfTime').value;
  if(!time){ $('sfMsg').textContent='Βάλε ώρα επιστροφής.'; return; }
  var s=Object.assign({},d,{active:true,id:'trip-'+Date.now().toString(36),route:$('sfRoute').value.trim(),due:localMinToMs(time),last:null,start:Date.now(),startDate:C.nicosiaToday(),sil:+$('sfSil').value||0,synced:undefined});
  save(s); $('sfMsg').textContent=''; render(); closeSheet();
  pushContact().then(function(){ return trackPos(); }).then(function(){ pushTrip(); });
  clearInterval(timer); timer=setInterval(tick,60000);
  toast(window.LANG==='en'?(hasContact(d)?'Have a good trip! Your contact has been notified.':'Have a good trip! You have no safety contact, so you only get a reminder on your phone.'):(hasContact(d)?'Καλή έξοδος! Η επαφή σου ενημερώθηκε.':'Καλή έξοδος! Δεν έχεις επαφή ασφαλείας, θα έχεις μόνο υπενθύμιση στο κινητό.'));
}
function summary(s){
  var from=(s.startDate||'')+' '+hm(s.start), n=0, kg=0, sp={};
  (C.Store.get('bites')||[]).forEach(function(b){ if(b.date&&b.time&&(b.date+' '+b.time)>=from){ n++; kg+=+b.kg||0; if(b.species) sp[b.species]=(sp[b.species]||0)+1; } });
  var top=Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; })[0]||'';
  return {n:n,kg:Math.round(kg*10)/10,species:top};
}
function back(){
  var s=load(); if(!s.active) return;
  var d=Date.now()-s.start, sm=summary(s);
  s.active=false; save(s); pushTrip(); clearInterval(timer);
  $('sfMsg').textContent='Καλωσόρισες πίσω.'; render(); closeSheet();
  var txt='Τέλος εξόδου. Διάρκεια '+dur(d)+'. '+(sm.n?(sm.n===1?'1 τσίμπημα':sm.n+' τσιμπήματα')+', '+sm.kg+' kg.':'Δεν καταγράφηκαν τσιμπήματα.')+'\nΝα καταχωρηθεί η έξοδος στο Ημερολόγιο;';
  if(confirm(txt)){
    C.Store.save('trips',{date:s.startDate||C.nicosiaToday(),spot:s.route||'',tech:'',species:sm.species,count:sm.n,kg:sm.kg,notes:'Καταγραφή από Έναρξη/Τέλος εξόδου ('+dur(d)+')'}).catch(function(){});
    toast('Καταχωρήθηκε στο Ημερολόγιο.');
  } else toast('Καλωσόρισες πίσω.');
}
function ext(){ var s=load(); s.due=Math.max(s.due,Date.now())+30*60000; save(s); render(); pushTrip(); }
function sos(){
  var s=load(); s.due=Date.now()-60000; save(s); pushTrip();
  var via=confirm('Στείλε μήνυμα βοήθειας με την τελευταία σου θέση.\nOK = WhatsApp, Άκυρο = SMS')?'wa':'sms';
  send(s,'sos',via);
}
function tick(){
  var s=load(); if(!s.active){ clearInterval(timer); return; }
  if(s.synced===false) pushTrip();
  if(Date.now()-lastTrack>=180000) trackPos();
  render();
}

/* ---------- σύνδεση events ---------- */
if(BOT){ $('sfTgBox').hidden=false; $('selfTgBox').hidden=false; pollTg(); }
$('sfTgLink').addEventListener('click',async function(){
  var d=readContact(); if(!d.tgCode){ d.tgCode=newCode(); save(d); }
  await pushContact();
  var link='https://t.me/'+BOT+'?start='+d.tgCode;
  var txt='Θέλω να σε έχω επαφή ασφαλείας όταν βγαίνω για ψάρεμα. Πάτα τον σύνδεσμο και μετά Start στο Telegram: '+link;
  if(navigator.share){ navigator.share({text:txt}).catch(function(){}); } else { try{ navigator.clipboard.writeText(txt); toast('Αντιγράφηκε ο σύνδεσμος.'); }catch(err){} }
  $('sfTgState').textContent='Περιμένουμε να πατήσει η επαφή τον σύνδεσμο και Start.'; setTimeout(pollTg,20000); setTimeout(pollTg,90000);
});
$('selfTgLink').addEventListener('click',async function(){
  var d=load(); if(!d.selfCode){ d.selfCode='S'+newCode(); save(d); }
  await pushContact();
  window.open('https://t.me/'+BOT+'?start='+d.selfCode,'_blank');
  $('selfTgState').textContent='Πάτα Start στο Telegram. Η σύνδεση ολοκληρώνεται μέσα σε λίγα λεπτά.'; setTimeout(pollTg,30000); setTimeout(pollTg,120000);
});
['sfName','sfPhone','sfEmail'].forEach(function(id){ $(id).addEventListener('change',function(){ readContact(); pushContact(); render(); }); });
$('sfSave').addEventListener('click',function(){ readContact(); pushContact(); $('sfCMsg').textContent='Αποθηκεύτηκε.'; render(); setTimeout(function(){ $('sfCMsg').textContent=''; },2500); });
$('profBtn').addEventListener('click',function(){ pollTg(); });
$('sfGoProf').addEventListener('click',function(){ closeSheet(); $('profBtn').click(); });
$('tripBtn').addEventListener('click',function(){ if(load().active) openSheet(); else { openForm(); openSheet(); } });
$('tripClose').addEventListener('click',closeSheet);
$('tripSheet').addEventListener('click',function(e){ if(e.target===this) closeSheet(); });
$('sfDur').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(b) setDur(+b.dataset.h); });
$('sfTime').addEventListener('input',function(){ Array.prototype.forEach.call(document.querySelectorAll('#sfDur .chip'),function(b){ b.setAttribute('aria-pressed','false'); }); });
$('sfSil').addEventListener('change',function(){ this.dataset.touched='1'; });
window.addEventListener('online',function(){ if(load().active) pushTrip(); });
$('sfStart').addEventListener('click',start);
$('sfBack').addEventListener('click',back);
$('sfExt').addEventListener('click',ext);
$('sfShare').addEventListener('click',function(){ var s=load(); var via=(s.phone&&confirm('Στείλε το σχέδιο στην επαφή σου.\nOK = WhatsApp, Άκυρο = SMS'))?'wa':'sms'; send(s,'plan',via); });
$('sfSos').addEventListener('click',function(){ trackPos().then(sos); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ render(); if(load().active) trackPos(); } });
if(load().active){ clearInterval(timer); timer=setInterval(tick,60000); }
fillContact(); render();
})();
