/* Ιστορικό ειδοποιήσεων: ό,τι στάλθηκε (server ή τοπικός έλεγχος της εφαρμογής) με όλο το κείμενο.
   Πηγές: 1) ο service worker αποθηκεύει κάθε push στη συσκευή (cache «psaro-cfg», __inbox)
          2) οι ειδοποιήσεις που δείχνει η ίδια η σελίδα (τοπικός έλεγχος) — πιάνονται εδώ
          3) ο πίνακας notif_log στο Supabase (ό,τι έστειλε ο server, ακόμα κι αν δεν έφτασε στο κινητό).
   Άνοιγμα: πάτημα στην ειδοποίηση (#inbox=…), κουμπί στην κάρτα ειδοποιήσεων της Πρόγνωσης, «Ενέργειες» του χάρτη,
   και μέσα σε κάθε έξοδο του Ημερολογίου (ειδοποιήσεις εκείνης της ημέρας). */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var CFG='psaro-cfg', LIST=[], SERVER=[], loaded=false, loading=null, sheet=null, filt='all', focusId=null;
function scopeUrl(){ try{ return new URL('__inbox',(navigator.serviceWorker&&navigator.serviceWorker.controller)?navigator.serviceWorker.controller.scriptURL:location.href).href; }catch(e){ return new URL('__inbox',location.href).href; } }
function keyOf(id){ id=String(id||''); var i=id.indexOf('|'); return i>=0?id.slice(i+1):id; }
function dayOf(iso){ try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Nicosia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso)); }catch(e){ return String(iso||'').slice(0,10); } }
function hmOf(iso){ try{ return new Intl.DateTimeFormat(EN?'en-GB':'el-GR',{timeZone:'Asia/Nicosia',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)); }catch(e){ return ''; } }
async function readLocal(){
  try{ if(!('caches' in window)) return []; var c=await caches.open(CFG), r=await c.match(scopeUrl()); if(!r) return []; var a=await r.json(); return Array.isArray(a)?a:[]; }catch(e){ return []; }
}
async function writeLocal(a){ try{ var c=await caches.open(CFG); await c.put(scopeUrl(),new Response(JSON.stringify(a.slice(0,400)))); }catch(e){} }
async function addLocal(it){ var a=await readLocal(); if(it.id&&a.some(function(x){ return x.id===it.id; })) return; a.unshift(it); await writeLocal(a); }
async function readServer(){
  var cl=window.PsaroCloud; if(!cl||!cl.logged||!cl.logged()) return [];
  try{ var r=await cl.rest('notif_log?select=id,at,kind,title,body,details,place,t&order=at.desc&limit=400'); var a=await r.json(); return Array.isArray(a)?a.map(function(x){ x.src='server'; x.full=x.details||x.body; return x; }):[]; }catch(e){ return []; }
}
function merge(loc,srv){
  var seen={}, out=[];
  loc.concat(srv).forEach(function(x){ if(!x||!x.at) return; var k=keyOf(x.id)||x.at+x.title; if(seen[k]){ if(x.src!=='server') seen[k].dev=true; else seen[k].srv=true; return; } x.dev=x.src!=='server'; x.srv=x.src==='server'; seen[k]=x; out.push(x); });
  out.sort(function(a,b){ return a.at<b.at?1:a.at>b.at?-1:0; });
  return out;
}
function load(){
  if(loading) return loading;
  loading=Promise.all([readLocal(),readServer()]).then(function(r){ SERVER=r[1]; LIST=merge(r[0],r[1]); loaded=true; loading=null; refreshUI(); return LIST; }).catch(function(){ loading=null; return LIST; });
  return loading;
}
function forDay(d){ return LIST.filter(function(x){ return dayOf(x.at)===d; }); }
window.PsaroInbox={load:load,list:function(){ return LIST; },forDay:forDay,open:function(id){ open(id); }};

/* ειδοποιήσεις που δείχνει η ίδια η σελίδα: αποθήκευση και άνοιγμα με πάτημα */
try{
  var P=window.ServiceWorkerRegistration&&ServiceWorkerRegistration.prototype, orig=P&&P.showNotification;
  if(orig&&!orig.__bc){
    P.showNotification=function(title,opt){
      opt=Object.assign({},opt||{}); var bc=(opt.data&&opt.data.bc)||{}, id=bc.id||('a'+Date.now()+Math.random().toString(36).slice(2,6));
      var kind=bc.kind||(String(opt.tag||'').indexOf('wind')>=0?'wind':String(opt.tag||'').indexOf('sea')>=0?'safety':/πίεσ|pressure/i.test(title)?'pressure':'info');
      addLocal({id:id,at:new Date().toISOString(),kind:kind,title:String(title||'BiteCast'),body:opt.body||'',full:bc.full||opt.body||'',place:bc.place||null,t:bc.t||null,src:'app'}).then(function(){ loaded=false; });
      if(!opt.tag||opt.tag==='psaro-ideal') opt.tag='bc-'+id; opt.renotify=true;
      opt.data=Object.assign({},opt.data||{},{url:(this.scope||location.href.split('#')[0])+'#inbox='+encodeURIComponent(id)});
      return orig.call(this,title,opt);
    };
    P.showNotification.__bc=true;
  }
}catch(e){}

/* ---------- οθόνη ---------- */
var KIND={turn:['↕',T('Καμπή πίεσης','Pressure turn')],pressure:['📉',T('Πίεση','Pressure')],wind:['🌬',T('Άνεμος','Wind')],good:['🎣',T('Καλές μέρες','Good days')],safety:['⚓',T('Ασφάλεια','Safety')],info:['🔔',T('Άλλο','Other')]};
var FILT=[['all',T('Όλες','All')],['p',T('Πίεση','Pressure')],['wind',T('Άνεμος','Wind')],['good',T('Καλές μέρες','Good days')],['other',T('Άλλες','Other')]];
function match(x){ if(filt==='all') return true; if(filt==='p') return x.kind==='turn'||x.kind==='pressure'; if(filt==='other') return ['turn','pressure','wind','good'].indexOf(x.kind)<0; return x.kind===filt; }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function css(){
  if(document.getElementById('ndInboxCss')) return;
  var st=document.createElement('style'); st.id='ndInboxCss';
  st.textContent='#ndInbox{position:fixed;inset:0;z-index:2000;display:flex;flex-direction:column;justify-content:flex-end}#ndInbox[hidden]{display:none}'+
  '#ndInbox .ibk{position:absolute;inset:0;background:#0007}#ndInbox .ipn{position:relative;background:var(--card,var(--bg,#fff));color:var(--ink,#111);border-radius:18px 18px 0 0;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -6px 24px #0004}'+
  '#ndInbox .ihd{display:flex;align-items:center;gap:8px;padding:12px 14px 6px}#ndInbox .ihd h2{flex:1;margin:0;font-size:18px}'+
  '#ndInbox .ich{display:flex;gap:6px;flex-wrap:wrap;padding:0 14px 8px}#ndInbox .ich button{min-height:36px;padding:0 12px;border-radius:18px;border:1px solid var(--line,#8886);background:transparent;color:inherit;font:inherit;font-size:13px}#ndInbox .ich button[aria-pressed=true]{background:var(--accent,#c4401c);color:var(--accent-ink,#fff);border-color:transparent}'+
  '#ndInbox .ils{overflow:auto;padding:0 14px 16px}#ndInbox .iday{font-size:12px;font-weight:700;color:var(--muted,#667);margin:12px 0 4px;text-transform:uppercase;letter-spacing:.04em}'+
  '#ndInbox .iit{border:1px solid var(--line,#8884);border-radius:12px;margin:6px 0;background:var(--surface,transparent)}#ndInbox .iit>button{display:flex;gap:10px;width:100%;text-align:left;background:none;border:0;color:inherit;font:inherit;padding:10px;min-height:44px}'+
  '#ndInbox .iic{font-size:18px;line-height:1.2;flex:none;width:24px;text-align:center}#ndInbox .itx{flex:1;min-width:0}#ndInbox .itt{font-weight:600;font-size:14px}#ndInbox .ibd{font-size:13px;color:var(--muted,#556);margin-top:2px}#ndInbox .itm{font-size:12px;color:var(--muted,#667);flex:none}'+
  '#ndInbox .ifu{padding:0 10px 10px 44px;font-size:13px;white-space:pre-line}#ndInbox .ifu .note{font-size:11px;margin-top:6px}#ndInbox .iit.on{outline:2px solid var(--accent,#c4401c)}'+
  '.nbxd{margin-top:6px}.nbxd summary{cursor:pointer;min-height:28px}.nbxd .nbr{font-size:13px;margin:4px 0;white-space:pre-line}';
  document.head.appendChild(st);
}
function ensure(){
  css(); if(sheet&&sheet.isConnected) return;
  sheet=el('div'); sheet.id='ndInbox'; sheet.hidden=true; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-label',T('Ιστορικό ειδοποιήσεων','Notification history'));
  var bk=el('div','ibk'), pn=el('div','ipn'), hd=el('div','ihd'), h2=el('h2',null,T('Ειδοποιήσεις','Notifications'));
  var rf=el('button','btn ghost sm','↻'); rf.type='button'; rf.setAttribute('aria-label',T('Ανανέωση','Refresh')); rf.addEventListener('click',function(){ loaded=false; load(); });
  var cl=el('button','btn ghost sm','✕'); cl.type='button'; cl.setAttribute('aria-label',T('Κλείσιμο','Close')); cl.addEventListener('click',close);
  hd.append(h2,rf,cl);
  var ch=el('div','ich'); ch.setAttribute('role','group'); ch.setAttribute('aria-label',T('Φίλτρο','Filter'));
  FILT.forEach(function(f){ var b=el('button',null,f[1]); b.type='button'; b.dataset.f=f[0]; b.addEventListener('click',function(){ filt=f[0]; render(); }); ch.append(b); });
  var ls=el('div','ils'); ls.id='ndInboxList';
  pn.append(hd,ch,ls); sheet.append(bk,pn); document.body.append(sheet);
  bk.addEventListener('click',close);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&sheet&&!sheet.hidden) close(); });
}
function render(){
  if(!sheet) return; var ls=document.getElementById('ndInboxList'); if(!ls) return; ls.replaceChildren();
  Array.prototype.forEach.call(sheet.querySelectorAll('.ich button'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.f===filt)); });
  var arr=LIST.filter(match);
  if(!loaded&&!arr.length){ ls.append(el('p','note',T('Φόρτωση…','Loading…'))); return; }
  if(!arr.length){ ls.append(el('p','note',T('Δεν υπάρχουν ειδοποιήσεις ακόμα. Θα εμφανίζονται εδώ όλες όσες σου στέλνει η εφαρμογή, με όλο το κείμενο.','No notifications yet. Everything the app sends you will appear here in full.'))); return; }
  var lastDay='', target=null;
  arr.forEach(function(x){
    var d=dayOf(x.at); if(d!==lastDay){ lastDay=d; var dl; try{ dl=new Intl.DateTimeFormat(EN?'en-GB':'el-GR',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Nicosia'}).format(new Date(x.at)); }catch(e){ dl=d; } ls.append(el('div','iday',dl)); }
    var k=KIND[x.kind]||KIND.info, it=el('div','iit'), bt=el('button'); bt.type='button'; bt.setAttribute('aria-expanded','false');
    var tx=el('div','itx'); tx.append(el('div','itt',x.title),el('div','ibd',x.body||''));
    bt.append(el('span','iic',k[0]),tx,el('span','itm',hmOf(x.at)));
    var fu=el('div','ifu'); fu.hidden=true; fu.append(document.createTextNode(x.full||x.body||''));
    if(x.place&&x.place.lat!=null&&window.PsaroCoord&&window.PsaroCoord.fmt){ try{ fu.append(el('div','note',T('Σημείο: ','Location: ')+(x.place.name?x.place.name+' · ':'')+window.PsaroCoord.fmt(+x.place.lat,+x.place.lon))); }catch(e){} }
    fu.append(el('div','note',(x.srv&&!x.dev)?T('Καταγράφηκε από τον server (μπορεί να μην εμφανίστηκε στο κινητό).','Logged by the server (may not have shown on the phone).'):x.src==='app'?T('Από τον έλεγχο της εφαρμογής.','From the app\'s own check.'):T('Ειδοποίηση push.','Push notification.')));
    bt.addEventListener('click',function(){ var o=fu.hidden; fu.hidden=!o; bt.setAttribute('aria-expanded',String(o)); });
    it.append(bt,fu); ls.append(it);
    if(focusId&&keyOf(x.id)===keyOf(focusId)){ target=it; fu.hidden=false; bt.setAttribute('aria-expanded','true'); it.classList.add('on'); }
  });
  if(target) setTimeout(function(){ try{ target.scrollIntoView({block:'center'}); }catch(e){} },50);
}
function open(id){ focusId=id||null; ensure(); sheet.hidden=false; render(); load().then(render); }
function close(){ if(sheet) sheet.hidden=true; focusId=null; if(/^#inbox/.test(location.hash)) try{ history.replaceState(null,'',location.href.split('#')[0]); }catch(e){} }
function refreshUI(){ if(sheet&&!sheet.hidden) render(); fcButton(); decorateTrips(); }

/* κουμπί στην κάρτα ειδοποιήσεων της Πρόγνωσης */
function fcButton(){
  var msg=document.getElementById('ntMsg'); if(!msg) return;
  var b=document.getElementById('ntInbox');
  if(!b){ b=el('button','btn ghost sm'); b.type='button'; b.id='ntInbox'; b.style.cssText='margin-top:8px;min-height:40px'; b.addEventListener('click',function(){ open(); }); msg.parentNode.insertBefore(b,msg.nextSibling); }
  b.textContent='🔔 '+T('Ιστορικό ειδοποιήσεων','Notification history')+(LIST.length?' ('+LIST.length+')':'');
}
/* κουμπί στις «Ενέργειες» του χάρτη */
(function(){ var mb=document.querySelector('.mapbtns'); if(!mb||document.getElementById('bInbox')) return;
  var b=el('button','mbtn'); b.type='button'; b.id='bInbox'; b.setAttribute('aria-label',T('Ιστορικό ειδοποιήσεων','Notification history')); b.title=b.getAttribute('aria-label');
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>';
  b.addEventListener('click',function(){ open(); }); mb.appendChild(b); })();
/* ειδοποιήσεις της ημέρας μέσα σε κάθε έξοδο του Ημερολογίου */
function decorateTrips(){
  var L=document.getElementById('tripList'), C=window.PsaroCore; if(!L||!C||!C.Store||!LIST.length) return;
  var trips; try{ trips=C.Store.get('trips'); }catch(e){ return; }
  Array.prototype.forEach.call(L.querySelectorAll('.item[data-tid]'),function(item){
    var old=item.querySelector('.nbxd'); var tr=trips.find(function(t){ return t.id===item.dataset.tid; }); if(!tr||!tr.date) return;
    var arr=forDay(tr.date); if(old&&old.dataset.n===String(arr.length)) return; if(old) old.remove(); if(!arr.length) return;
    var d=el('details','trdet nbxd'); d.dataset.n=String(arr.length);
    d.append(el('summary',null,'🔔 '+T('Ειδοποιήσεις εκείνης της ημέρας','Alerts that day')+' ('+arr.length+')'));
    arr.slice().reverse().forEach(function(x){ var r=el('div','nbr'); var b=el('b',null,hmOf(x.at)+' · '+x.title); r.append(b,document.createElement('br'),document.createTextNode(x.full||x.body||'')); d.append(r); });
    var host=item.firstElementChild||item; host.append(d);
  });
}
(function(){ var L=document.getElementById('tripList'); if(!L||!window.MutationObserver) return; var tm=null;
  new MutationObserver(function(){ clearTimeout(tm); tm=setTimeout(function(){ if(loaded) decorateTrips(); else load(); },120); }).observe(L,{childList:true}); })();

/* άνοιγμα από πάτημα σε ειδοποίηση */
function fromHash(){ var m=/#inbox(?:=([^&]*))?/.exec(location.hash||''); if(m) open(m[1]?decodeURIComponent(m[1]):null); }
window.addEventListener('hashchange',fromHash);
try{ if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('message',function(e){ if(e.data&&e.data.inbox){ loaded=false; open(e.data.inbox); } }); }catch(e){}
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ loaded=false; load(); } });
setTimeout(function(){ load(); fromHash(); },300);
})();
