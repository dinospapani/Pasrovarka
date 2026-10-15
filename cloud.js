/* Λογαριασμός και συγχρονισμός (Supabase). Χωρίς βιβλιοθήκη, μόνο REST. */
(function(){
'use strict';
var URL_='https://sgfohmqwdwtkhtrebnix.supabase.co', KEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
var C=window.PsaroCore; if(!C) return;
var Store=C.Store, Photos=C.Photos, toast=function(m){ if(C.toast) C.toast(m); };
var $=function(id){return document.getElementById(id);};
var KINDS=['spots','trips','bites'];
var sess=null, busy=false, timer=null, again=false;
function ls(k,v){ try{ if(v===undefined) return JSON.parse(localStorage.getItem(k)); if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){ return null; } }
sess=ls('psaro-sess');

function H(extra){ var h={apikey:KEY,'Content-Type':'application/json'}; if(sess&&sess.access_token) h.Authorization='Bearer '+sess.access_token; else h.Authorization='Bearer '+KEY; for(var k in (extra||{})) h[k]=extra[k]; return h; }
async function auth(path,body){
  var r=await fetch(URL_+'/auth/v1/'+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  var j={}; try{ j=await r.json(); }catch(e){}
  if(!r.ok) throw new Error(j.msg||j.error_description||j.message||j.error||('HTTP '+r.status));
  return j;
}
function setSess(j){
  sess={access_token:j.access_token,refresh_token:j.refresh_token,exp:Date.now()+((j.expires_in||3600)-60)*1000,uid:(j.user&&j.user.id)||(sess&&sess.uid),email:(j.user&&j.user.email)||(sess&&sess.email)};
  ls('psaro-sess',sess);
}
async function ensure(){
  if(!sess) throw new Error('no session');
  if(Date.now()<sess.exp) return;
  var j=await auth('token?grant_type=refresh_token',{refresh_token:sess.refresh_token});
  setSess(j);
}
function errText(e){
  var m=String(e&&e.message||e);
  if(/Invalid login/i.test(m)) return 'Λάθος email ή κωδικός.';
  if(/already registered|already been registered/i.test(m)) return 'Αυτό το email είναι ήδη εγγεγραμμένο. Πάτα Σύνδεση.';
  if(/Email not confirmed/i.test(m)) return 'Επιβεβαίωσε πρώτα το email σου (δες τα εισερχόμενα).';
  if(/least 6|weak|Password should/i.test(m)) return 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.';
  if(/valid email|invalid format/i.test(m)) return 'Γράψε έγκυρο email.';
  if(/rate limit|too many/i.test(m)) return 'Πολλές προσπάθειες. Περίμενε λίγο και δοκίμασε ξανά.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Δεν υπάρχει σύνδεση στο διαδίκτυο.';
  return 'Σφάλμα: '+m;
}

/* ---------- Συγχρονισμός ---------- */
var iso=function(ms){ return new Date(ms).toISOString(); };
async function rest(path,opt){
  await ensure(); opt=opt||{}; opt.headers=H(opt.headers);
  var r=await fetch(URL_+'/rest/v1/'+path,opt);
  if(r.status===401){ var j=await auth('token?grant_type=refresh_token',{refresh_token:sess.refresh_token}); setSess(j); opt.headers=H(opt.headers); r=await fetch(URL_+'/rest/v1/'+path,opt); }
  if(!r.ok) throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,120));
  return r;
}
var pup=ls('psaro-pup')||{};
async function storage(method,path,body,type){
  await ensure(); var h={apikey:KEY,Authorization:'Bearer '+sess.access_token}; if(type){ h['Content-Type']=type; h['x-upsert']='true'; }
  return fetch(URL_+'/storage/v1/object/'+path,{method:method,headers:h,body:body});
}
async function sync(manual){
  if(!sess){ return; }
  if(busy){ again=true; return; }
  if(!navigator.onLine){ if(manual) status('Χωρίς σύνδεση. Θα γίνει όταν συνδεθείς.'); return; }
  busy=true; status('Συγχρονισμός…');
  try{
    // 1) λήψη
    var r=await rest('records?select=kind,id,data,deleted,updated_at&order=updated_at.asc&limit=10000');
    var rows=await r.json(), remote={}, got=0, needPh=[];
    rows.forEach(function(x){ remote[x.kind+'/'+x.id]=x; var u=Date.parse(x.updated_at)||0; if(Store.mergeIn(x.kind,x.id,x.data||{},x.deleted,(x.data&&x.data._u)||u)){ got++; if(x.kind==='bites'&&!x.deleted&&x.data&&x.data.photo) needPh.push(x.id); } });
    if(got) Store.flush();
    // 2) αποστολή όσων είναι νεότερα τοπικά
    var out=[];
    KINDS.forEach(function(k){ Store.get(k).forEach(function(o){ var rm=remote[k+'/'+o.id]; var ru=rm?((rm.data&&rm.data._u)||Date.parse(rm.updated_at)||0):0; if(!rm||(o._u||0)>ru) out.push({kind:k,id:o.id,data:o,deleted:false,updated_at:iso(o._u||Date.now())}); }); });
    Store.tombs().forEach(function(t){ var rm=remote[t.k+'/'+t.id]; var ru=rm?((rm.data&&rm.data._u)||Date.parse(rm.updated_at)||0):0; if(!rm||(!rm.deleted&&t.u>ru)) out.push({kind:t.k,id:t.id,data:{_u:t.u},deleted:true,updated_at:iso(t.u)}); });
    for(var i=0;i<out.length;i+=200) await rest('records',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(out.slice(i,i+200))});
    // 3) φωτογραφίες
    var up=0;
    for(var bi=0;bi<Store.get('bites').length;bi++){ var b=Store.get('bites')[bi]; if(!b.photo||pup[b.id]) continue; var bl=null; try{ bl=await Photos.get(b.id); }catch(e){} if(!bl) continue; var rr=await storage('POST','photos/'+sess.uid+'/'+b.id+'.jpg',bl,'image/jpeg'); if(rr.ok){ pup[b.id]=1; up++; } }
    ls('psaro-pup',pup);
    var dl=0;
    for(var j=0;j<needPh.length;j++){ var id=needPh[j]; var have=null; try{ have=await Photos.get(id); }catch(e){} if(have){ pup[id]=1; continue; } var rs=await storage('GET','authenticated/photos/'+sess.uid+'/'+id+'.jpg'); if(rs.ok){ await Photos.put(id,await rs.blob()); pup[id]=1; dl++; } }
    ls('psaro-pup',pup);
    if(dl) Store.flush();
    ls('psaro-last',Date.now());
    status('Συγχρονίστηκε '+new Date().toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})+(got?' · ήρθαν '+got:'')+(out.length?' · στάλθηκαν '+out.length:''));
  }catch(e){
    if(/HTTP 4(01|03)|JWT/.test(String(e.message))){ status('Η σύνδεση έληξε. Συνδέσου ξανά.'); }
    else if(/relation .*records|PGRST205|HTTP 404/.test(String(e.message))) status('Λείπει η βάση δεδομένων στο Supabase (πίνακας records).');
    else status(errText(e));
  }
  busy=false;
  if(again){ again=false; sched(); }
}
function sched(){ if(!sess) return; clearTimeout(timer); timer=setTimeout(function(){ sync(false); },2500); }
Store.hook(function(k,id){
  if(!sess) return;
  if(k==='bites'){ var still=Store.get('bites').some(function(b){return b.id===id;}); if(!still&&sess){ storage('DELETE','photos/'+sess.uid+'/'+id+'.jpg').catch(function(){}); delete pup[id]; ls('psaro-pup',pup); } }
  sched();
});
window.addEventListener('online',function(){ sched(); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden) sched(); });

/* ---------- Οθόνη λογαριασμού ---------- */
function status(m){ var e=$('acStatus'); if(e) e.textContent=m||''; }
function msg(m,bad){ var e=$('acMsg'); if(e){ e.textContent=m||''; e.style.color=bad?'var(--bad,#b3261e)':''; } }
function render(){
  var inn=!!sess;
  if(!$('acCard')) return;
  $('acOut').hidden=inn; $('acIn').hidden=!inn;
  if(inn){ $('acWho').textContent=sess.email||''; var l=ls('psaro-last'); if(l&&!$('acStatus').textContent) $('acStatus').textContent='Τελευταίος συγχρονισμός '+new Date(l).toLocaleString('el-GR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
}
function localCount(){ return Store.get('spots').length+Store.get('trips').length+Store.get('bites').length; }
async function afterLogin(j){
  var prev=ls('psaro-uid'); setSess(j);
  if(prev&&prev!==sess.uid&&localCount()>0){
    if(!confirm('Σε αυτή τη συσκευή υπάρχουν δεδομένα άλλου λογαριασμού. Να σβηστούν (OK) ή να προστεθούν και στον νέο λογαριασμό (Άκυρο);')){ /* merge */ }
    else { Store.wipe(); pup={}; ls('psaro-pup',pup); }
  }
  ls('psaro-uid',sess.uid); render(); msg('');
  await sync(true);
}
async function doLogin(signup){
  var em=$('acEmail').value.trim(), pw=$('acPass').value;
  if(!em||!pw){ msg('Γράψε email και κωδικό.',true); return; }
  $('acLogin').disabled=$('acSignup').disabled=true; msg(signup?'Δημιουργία λογαριασμού…':'Σύνδεση…');
  try{
    if(signup){
      var j=await auth('signup',{email:em,password:pw});
      if(j.access_token){ await afterLogin(j); }
      else msg('Στάλθηκε email επιβεβαίωσης. Πάτα τον σύνδεσμο και μετά Σύνδεση.');
    }else{
      await afterLogin(await auth('token?grant_type=password',{email:em,password:pw}));
    }
  }catch(e){ msg(errText(e),true); }
  $('acLogin').disabled=$('acSignup').disabled=false;
}
function wire(){
  if(!$('acCard')) return;
  $('acLogin').addEventListener('click',function(){ doLogin(false); });
  $('acSignup').addEventListener('click',function(){ doLogin(true); });
  $('acForgot').addEventListener('click',async function(){
    var em=$('acEmail').value.trim(); if(!em){ msg('Γράψε πρώτα το email σου.',true); return; }
    try{ await auth('recover',{email:em}); msg('Αν υπάρχει λογαριασμός, στάλθηκε email για νέο κωδικό.'); }catch(e){ msg(errText(e),true); }
  });
  $('acSync').addEventListener('click',function(){ sync(true); });
  $('acLogout').addEventListener('click',async function(){
    if(busy) return;
    await sync(true);
    var wipe=confirm('Αποσύνδεση. Να σβηστούν και τα δεδομένα από αυτή τη συσκευή; (Μένουν αποθηκευμένα στον λογαριασμό σου.)');
    try{ await fetch(URL_+'/auth/v1/logout',{method:'POST',headers:H()}); }catch(e){}
    sess=null; ls('psaro-sess',null); ls('psaro-last',null);
    if(wipe){ Store.wipe(); pup={}; ls('psaro-pup',pup); ls('psaro-uid',null); }
    $('acStatus').textContent=''; render();
  });
  render();
  if(sess) setTimeout(function(){ sync(false); },1200);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire); else wire();
})();
