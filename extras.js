/* Ασφάλεια εξόδου: δήλωση διαδρομής, ώρα επιστροφής, ειδοποίηση καθυστέρησης, SOS μέσω WhatsApp/SMS. */
(function(){
'use strict';
var C=window.PsaroCore; if(!C||!document.getElementById('safeCard')) return;
var $=C.$, h=C.h, toast=C.toast;
var KEY='psaro-safe';
var BOT='';   /* όνομα του Telegram bot, χωρίς @ (π.χ. BiteCastSafetyBot) */
var Cl=function(){ return window.PsaroCloud&&window.PsaroCloud.logged()?window.PsaroCloud:null; };
function srvMsg(m){ var x=$('sfSrv'); if(x) x.textContent=m||''; }
async function pushTrip(){
  var s=load(), cl=Cl(); if(!s.id||!cl) return;
  try{
    var body={id:s.id,user_name:cl.name()||s.name||'',route:s.route||'',due_at:new Date(s.due).toISOString(),status:s.active?'active':'done',
      last_lat:s.last?s.last.lat:null,last_lon:s.last?s.last.lon:null,last_at:s.last?new Date(s.last.t).toISOString():null};
    if(!s.active) body.status='done';
    var r=await cl.rest('safety_trips',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});
    srvMsg(s.active?'Η δήλωση έφτασε στον server: η επαφή θα ειδοποιηθεί αυτόματα αν δεν γυρίσεις.':'');
    s.synced=true; save(s);
  }catch(err){ var s2=load(); s2.synced=false; save(s2); srvMsg('Δεν έφτασε στον server (ελέγξτε internet ή αν έχει στηθεί ο server). Η υπενθύμιση στο κινητό δουλεύει κανονικά.'); }
}
async function pushContact(){
  var cl=Cl(); if(!cl) return;
  var d=load();
  var body={email:($('sfEmail').value||'').trim()||null,updated_at:new Date().toISOString()};
  if(d.tgCode) body.tg_code=d.tgCode;
  try{ await cl.rest('safety_contacts',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)}); }catch(err){}
}
async function pollTg(){
  var cl=Cl(), d=load(); if(!cl||!BOT) return;
  try{ var r=await cl.rest('safety_contacts?select=tg_chat_id,tg_name'); var j=await r.json(); var c=j&&j[0];
    var st=$('sfTgState'); if(!st) return;
    if(c&&c.tg_chat_id) st.textContent='Συνδέθηκε στο Telegram: '+(c.tg_name||'επαφή')+' ✓';
    else if(d.tgCode) st.textContent='Περιμένουμε να πατήσει η επαφή τον σύνδεσμο και Start. Η σύνδεση ολοκληρώνεται μέσα σε λίγα λεπτά.';
  }catch(err){}
}
function newCode(){ var a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',o=''; for(var i=0;i<10;i++) o+=a[Math.floor(Math.random()*a.length)]; return o; }
function load(){ return C.lsGet(KEY,null)||{}; }
function save(s){ C.lsSet(KEY,s); }
function hm(ms){ var d=new Date(ms+C.utcMin()*60000); return ('0'+d.getUTCHours()).slice(-2)+':'+('0'+d.getUTCMinutes()).slice(-2); }
var timer=null;
function nowUtcMs(){ return Date.now(); }
function localMinToMs(hhmm){
  /* επιστρέφει την επόμενη εμφάνιση της ώρας hh:mm στο ωράριο της τοποθεσίας */
  var p=hhmm.split(':'), off=C.utcMin();
  var nowL=nowUtcMs()+off*60000, d=new Date(nowL);
  var t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),+p[0],+p[1])-off*60000;
  if(t<nowUtcMs()-60000) t+=86400000;
  return t;
}
function mapLink(p){ return p&&p.lat!=null?'https://maps.google.com/?q='+p.lat.toFixed(5)+','+p.lon.toFixed(5):''; }
function plan(s,kind){
  var link=mapLink(s.last);
  var base=(kind==='sos'?'ΒΟΗΘΕΙΑ (BiteCast): ':'Σχέδιο εξόδου (BiteCast): ');
  var t=base+'ψαρεύω με το σκάφος'+(s.route?' – '+s.route:'')+'. Επιστροφή στις '+hm(s.due)+'.';
  if(kind==='sos') t='ΒΟΗΘΕΙΑ (BiteCast): δεν έχω επιστρέψει ακόμα και είχα δηλώσει επιστροφή στις '+hm(s.due)+(s.route?' (διαδρομή: '+s.route+')':'')+'.';
  if(link) t+=' Τελευταία θέση'+(s.last&&s.last.t?' ('+hm(s.last.t)+')':'')+': '+link;
  return t;
}
function send(s,kind,via){
  var text=plan(s,kind), phone=(s.phone||'').replace(/[^\d+]/g,'');
  var digits=phone.replace(/^\+/,'');
  if(via==='wa'&&digits) window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(text),'_blank');
  else if(via==='sms'&&phone) window.location.href='sms:'+phone+'?&body='+encodeURIComponent(text);
  else if(navigator.share) navigator.share({text:text}).catch(function(){});
  else { try{ navigator.clipboard.writeText(text); toast('Αντιγράφηκε το μήνυμα.'); }catch(e){} }
}
async function trackPos(){
  var s=load(); if(!s.active) return;
  try{ var p=await C.getPosition(); s.last={lat:p.lat,lon:p.lon,t:Date.now()}; save(s); render(); pushTrip(); }catch(e){}
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
function render(){
  var s=load(), on=!!s.active, card=$('safeCard');
  $('safeIdle').hidden=on; $('safeActive').hidden=!on;
  card.classList.toggle('live',!!(on&&!late(s))); card.classList.toggle('late',!!late(s));
  if(on){
    $('sfInfo').textContent=(late(s)?'Καθυστερείς. Η επιστροφή ήταν στις ':'Σε έξοδο. Επιστροφή στις ')+hm(s.due);
    $('sfLast').textContent=s.last?('Τελευταία γνωστή θέση: '+hm(s.last.t)+' · '+s.last.lat.toFixed(4)+', '+s.last.lon.toFixed(4)):'Δεν έχει καταγραφεί θέση ακόμα.';
  } else {
    var d=load(); $('sfName').value=d.name||$('sfName').value; $('sfPhone').value=d.phone||$('sfPhone').value; $('sfEmail').value=d.email||$('sfEmail').value; $('sfRoute').value=d.route||'';
    if(!$('sfTime').value){ var t=new Date(Date.now()+C.utcMin()*60000+4*3600000); $('sfTime').value=('0'+t.getUTCHours()).slice(-2)+':00'; }
  }
  bar();
}
function start(){
  var name=$('sfName').value.trim(), phone=$('sfPhone').value.trim(), time=$('sfTime').value, route=$('sfRoute').value.trim();
  if(!time){ $('sfMsg').textContent='Βάλε ώρα επιστροφής.'; return; }
  if(!phone){ $('sfMsg').textContent='Βάλε το τηλέφωνο της επαφής σου για να ετοιμάζεται το μήνυμα.'; return; }
  var old=load(); var s={active:true,id:'trip-'+Date.now().toString(36),name:name,phone:phone,email:$('sfEmail').value.trim(),route:route,due:localMinToMs(time),last:null,start:Date.now(),tgCode:old.tgCode};
  save(s); $('sfMsg').textContent=''; render(); pushContact().then(function(){ return trackPos(); }).then(function(){ pushTrip(); });
  clearInterval(timer); timer=setInterval(tick,60000);
  toast('Καλή έξοδος. Στείλε το σχέδιο στην επαφή σου.');
}
function back(){ var s=load(); s.active=false; save(s); pushTrip(); clearInterval(timer); $('sfMsg').textContent='Καλωσόρισες πίσω.'; render(); toast('Καλωσόρισες πίσω.'); }
function ext(){ var s=load(); s.due=Math.max(s.due,Date.now())+30*60000; save(s); render(); pushTrip(); }
function sos(){
  var s=load(); s.due=Date.now()-60000; save(s); pushTrip();
  var via=confirm('Στείλε μήνυμα βοήθειας με την τελευταία σου θέση.\nOK = WhatsApp, Άκυρο = SMS')?'wa':'sms';
  send(s,'sos',via);
}
function tick(){ var s=load(); if(!s.active){ clearInterval(timer); return; } if(s.synced===false) pushTrip(); if(Math.floor(Date.now()/60000)%10===0) trackPos(); render(); }
if(BOT){ $('sfTgBox').hidden=false; pollTg(); }
$('sfTgLink').addEventListener('click',async function(){
  var d=load(); if(!d.tgCode){ d.tgCode=newCode(); save(d); }
  await pushContact();
  var link='https://t.me/'+BOT+'?start='+d.tgCode;
  var txt='Θέλω να σε έχω επαφή ασφαλείας όταν βγαίνω για ψάρεμα. Πάτα τον σύνδεσμο και μετά Start στο Telegram: '+link;
  if(navigator.share){ navigator.share({text:txt}).catch(function(){}); } else { try{ navigator.clipboard.writeText(txt); toast('Αντιγράφηκε ο σύνδεσμος.'); }catch(err){} }
  $('sfTgState').textContent='Περιμένουμε να πατήσει η επαφή τον σύνδεσμο και Start.'; setTimeout(pollTg,20000);
});
$('sfEmail').addEventListener('change',function(){ pushContact(); });
window.addEventListener('online',function(){ if(load().active) pushTrip(); });
$('sfStart').addEventListener('click',start);
$('sfBack').addEventListener('click',back);
$('sfExt').addEventListener('click',ext);
$('sfShare').addEventListener('click',function(){ var s=load(); var via=(s.phone&&confirm('Στείλε το σχέδιο στην επαφή σου.\nOK = WhatsApp, Άκυρο = SMS'))?'wa':'sms'; send(s,'plan',via); });
$('sfSos').addEventListener('click',function(){ trackPos().then(sos); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ render(); if(load().active) trackPos(); } });
if(load().active){ clearInterval(timer); timer=setInterval(tick,60000); }
render();
})();
