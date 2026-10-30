/* v31z401: Φίλοι. Κοινή χρήση ψαριών και σημείων με φίλους (μόνο ανάγνωση).
   Βάση: friends.sql στο Supabase (πίνακες friends, friend_invites, συνάρτηση redeem_friend, κανόνες ανάγνωσης).
   Ο καθένας επιλέγει αν δείχνει τα δικά του σε κάθε φίλο. Ό,τι σημειώνεται «Ιδιωτικό» δεν φαίνεται ποτέ.
   Τα δεδομένα των φίλων ΔΕΝ μπαίνουν στο δικό σου Ημερολόγιο: φαίνονται μόνο σε ξεχωριστό επίπεδο του χάρτη. */
(function(){
'use strict';
var C=window.PsaroCore; if(!C) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var $=function(i){ return document.getElementById(i); };
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function ls(k,v){ try{ if(v===undefined){ var x=localStorage.getItem(k); return x==null?null:JSON.parse(x); } if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){ return null; } }
function CL(){ return window.PsaroCloud; }
function logged(){ var c=CL(); return !!(c&&c.logged&&c.logged()); }
function me(){ var c=CL(); return c&&c.uid?c.uid():''; }
var COLORS=['#8e44ad','#d35400','#16a085','#c0392b','#2c3e50','#b8860b'];
var S=ls('psaro-fr')||{list:[],data:{},at:0}; if(!S.list) S.list=[]; if(!S.data) S.data={};
function save(){ try{ localStorage.setItem('psaro-fr',JSON.stringify(S)); }catch(e){ try{ localStorage.setItem('psaro-fr',JSON.stringify({list:S.list,data:{},at:0})); }catch(x){} } ls('psaro-fr-on',S.list.length>0); }
function mapOn(){ return ls('psaro-fr-map')!==false; }
function col(uid){ var i=S.list.findIndex(function(f){ return f.uid===uid; }); return COLORS[(i<0?0:i)%COLORS.length]; }
function ini(n){ n=String(n||'?').trim(); var p=n.split(/\s+/); return ((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase(); }
function errMsg(e){ var m=String(e&&e.message||e); if(/PGRST20[25]|relation .*friend|404|function .*redeem_friend/i.test(m)) return T('Λείπει η βάση φίλων στο Supabase: τρέξε το friends.sql.','The friends database is missing in Supabase: run friends.sql.');
  var j=/"message":"([^"]+)"/.exec(m); if(j) return j[1]; if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return T('Δεν υπάρχει σύνδεση.','No connection.'); return m.slice(0,140); }

/* ---------- δεδομένα ---------- */
async function loadFriends(){
  var r=await CL().rest('friends?select=owner,viewer,owner_name,viewer_name,share'), rows=await r.json(), u=me(), M={};
  rows.forEach(function(x){
    if(x.viewer===u){ var f=M[x.owner]||(M[x.owner]={uid:x.owner}); f.name=x.owner_name||f.name; f.theyShare=!!x.share; }
    if(x.owner===u){ var g=M[x.viewer]||(M[x.viewer]={uid:x.viewer}); g.name=g.name||x.viewer_name; g.mine=!!x.share; if(!g.name) g.name=x.viewer_name; }
  });
  var old={}; S.list.forEach(function(f){ old[f.uid]=f; });
  S.list=Object.keys(M).map(function(k){ var f=M[k]; if(!f.name) f.name=(old[k]&&old[k].name)||T('Φίλος','Friend'); if(f.mine==null) f.mine=true; return f; });
  Object.keys(S.data).forEach(function(k){ if(!M[k]) delete S.data[k]; });
  save();
}
async function loadData(){
  var ids=S.list.filter(function(f){ return f.theyShare; }).map(function(f){ return f.uid; });
  S.data={};
  if(ids.length){
    var r=await CL().rest('records?select=user_id,kind,id,data&user_id=in.('+ids.join(',')+')&kind=in.(bites,spots)&deleted=eq.false&limit=20000'), rows=await r.json();
    rows.forEach(function(x){ if(!x.data||x.data.priv) return; var d=S.data[x.user_id]||(S.data[x.user_id]={bites:[],spots:[]}); var o=Object.assign({},x.data,{id:x.id});
      if(x.kind==='bites'&&!o.miss&&typeof o.lat==='number'&&typeof o.lon==='number') d.bites.push(o); else if(x.kind==='spots'&&typeof o.lat==='number') d.spots.push(o); });
  }
  S.at=Date.now(); save(); draw();
}
var busy=false;
async function refresh(force){
  if(busy||!logged()) return; if(!force&&Date.now()-(S.at||0)<20*60000){ draw(); return; }
  busy=true; status(T('Ανανέωση…','Refreshing…'));
  try{ await loadFriends(); await loadData(); status(''); }catch(e){ status(errMsg(e),true); }
  finally{ busy=false; render(); }
}

/* ---------- χάρτης ---------- */
var layer=null, wired=false;
function draw(){
  var map=C.map&&C.map(); if(!map||typeof L==='undefined') return;
  if(!layer) layer=L.layerGroup();
  if(!wired){ wired=true; map.on('zoomend',function(){ if(!map._popup||!map.hasLayer(map._popup)) draw(); }); }
  layer.clearLayers();
  if(!mapOn()||!S.list.length){ if(map.hasLayer(layer)) map.removeLayer(layer); return; }
  if(!map.hasLayer(layer)) layer.addTo(map);
  var z=map.getZoom(), G=[];
  S.list.forEach(function(f){ var d=S.data[f.uid]; if(!d) return;
    (d.spots||[]).forEach(function(sp){ var m=L.marker([sp.lat,sp.lon],{icon:L.divIcon({className:'',html:'<div class="mk-frs" style="--fc:'+col(f.uid)+'"><span>'+ini(f.name)+'</span></div>',iconSize:[20,20]}),title:(sp.name||'')+' · '+f.name});
      m.bindPopup(function(){ return spotPop(f,sp); },{maxWidth:260}); m.addTo(layer); });
    (d.bites||[]).forEach(function(b){ var p=map.project([b.lat,b.lon],z), g=null;
      for(var i=0;i<G.length;i++){ if(Math.hypot(G[i].p.x-p.x,G[i].p.y-p.y)<=30){ g=G[i]; break; } }
      if(!g){ g={p:p,bs:[]}; G.push(g); } g.bs.push({f:f,b:b}); });
  });
  G.forEach(function(g){
    if(g.bs.length===1){ var x=g.bs[0];
      var m=L.marker([x.b.lat,x.b.lon],{icon:L.divIcon({className:'',html:'<div class="mk-frb" style="--fc:'+col(x.f.uid)+'"><span>'+ini(x.f.name)+'</span></div>',iconSize:[28,28]}),title:(x.b.species||'')+' · '+x.f.name,zIndexOffset:-50});
      m.bindPopup(function(){ return bitePop(x.f,x.b); },{minWidth:200,maxWidth:260,className:'fishpopw'}); m.on('popupopen',function(e){ photo(x.f,x.b,e.popup.getElement()); }); m.addTo(layer); return; }
    var lat=0,lon=0; g.bs.forEach(function(x){ lat+=x.b.lat; lon+=x.b.lon; }); lat/=g.bs.length; lon/=g.bs.length;
    var n=g.bs.reduce(function(a,x){ return a+(+x.b.cnt>1?+x.b.cnt:1); },0), fs={}; g.bs.forEach(function(x){ fs[x.f.uid]=1; }); var one=Object.keys(fs).length===1?g.bs[0].f:null;
    var m=L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="mk-frg" style="--fc:'+(one?col(one.uid):'#6c3483')+'"><span>'+(one?ini(one.name):'👥')+'</span><b>'+n+'</b></div>',iconSize:[34,34]}),zIndexOffset:-40});
    m.bindPopup(function(){ return groupPop(g.bs); },{minWidth:240,maxWidth:300,className:'fishpopw'}); m.addTo(layer);
  });
}
function fmtD(b){ var d=new Date((b.date||'2000-01-01')+'T12:00:00Z'), DN=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρι','Τετ','Πέμ','Παρ','Σάβ']; return DN[d.getUTCDay()]+' '+d.getUTCDate()+'/'+(d.getUTCMonth()+1)+'/'+String(d.getUTCFullYear()).slice(2)+(b.time?' '+b.time:''); }
function cond(b){ var U=window.PsaroUnits, P={slow:T('πίεση πέφτει αργά','pressure falling slowly'),fast:T('πίεση πέφτει γρήγορα','pressure falling fast'),stable:T('σταθερή πίεση','steady pressure'),rise:T('πίεση ανεβαίνει','pressure rising')};
  return [b.wind!=null&&U?U.wind(b.wind):null,b.wave!=null&&U?U.wave(b.wave)+T(' κύμα',' waves'):null,b.ptrend?P[b.ptrend]:null,b.sst!=null&&U?U.temp(b.sst)+T(' θάλασσα',' sea'):null].filter(Boolean).join(' · '); }
function bitePop(f,b){
  var w=el('div','pop fishpop frpop'), im=el('img','pimg'); im.hidden=true; w.append(im);
  var who=el('div','frwho'); who.style.setProperty('--fc',col(f.uid)); who.textContent=T('Του φίλου σου ','Your friend ')+f.name; w.append(who);
  var cnt=+b.cnt>1?+b.cnt:1; w.append(el('b','',(b.species||T('Άγνωστο','Unknown'))+(cnt>1?' ×'+cnt:'')));
  w.append(el('div','meta mono',fmtD(b)));
  var sz=[b.kg?b.kg+' kg':null,b.len?b.len+' cm':null,b.depth!=null?b.depth+' m':null].filter(Boolean).join(' · '); if(sz) w.append(el('div','',sz));
  if(b.bait||b.tech) w.append(el('div','meta',[b.bait,b.tech].filter(Boolean).join(' · ')));
  var cd=cond(b); if(cd) w.append(el('div','meta',cd));
  if(b.place) w.append(el('div','meta',b.place));
  try{ w.append(el('div','meta mono',window.PsaroCoord.fmt(b.lat,b.lon))); }catch(e){}
  var row=el('div','row pbtns'); row.style.marginTop='6px';
  var sv=el('button','btn sm',T('Αποθήκευση ως σημείο μου','Save as my spot')); sv.type='button';
  sv.addEventListener('click',function(){ C.Store.save('spots',{name:(b.place||b.species||T('Σημείο','Spot'))+' ('+f.name+')',type:'',lat:b.lat,lon:b.lon,depth:b.depth!=null?b.depth:null,notes:T('Από φίλο: ','From a friend: ')+f.name+' · '+(b.species||'')+' '+fmtD(b)}).then(function(){ sv.disabled=true; sv.textContent=T('Αποθηκεύτηκε ✓','Saved ✓'); }); });
  row.append(sv); w.append(row); return w;
}
function spotPop(f,sp){
  var w=el('div','pop'); var who=el('div','frwho'); who.style.setProperty('--fc',col(f.uid)); who.textContent=T('Σημείο του ','Spot of ')+f.name; w.append(who);
  w.append(el('b','',sp.name||T('Σημείο','Spot'))); if(sp.depth!=null) w.append(el('div','meta',sp.depth+' m')); if(sp.notes) w.append(el('div','meta',sp.notes));
  try{ w.append(el('div','meta mono',window.PsaroCoord.fmt(sp.lat,sp.lon))); }catch(e){}
  var row=el('div','row pbtns'); row.style.marginTop='6px'; var sv=el('button','btn sm',T('Αποθήκευση στα σημεία μου','Save to my spots')); sv.type='button';
  sv.addEventListener('click',function(){ C.Store.save('spots',{name:(sp.name||T('Σημείο','Spot'))+' ('+f.name+')',type:sp.type||'',lat:sp.lat,lon:sp.lon,depth:sp.depth!=null?sp.depth:null,notes:(sp.notes?sp.notes+' · ':'')+T('Από φίλο: ','From a friend: ')+f.name}).then(function(){ sv.disabled=true; sv.textContent=T('Αποθηκεύτηκε ✓','Saved ✓'); }); });
  row.append(sv); w.append(row); return w;
}
function groupPop(xs){
  xs=xs.slice().sort(function(a,b){ return String(b.b.date+(b.b.time||'')).localeCompare(String(a.b.date+(a.b.time||''))); });
  var w=el('div','pop frgpop'), fs={}; xs.forEach(function(x){ fs[x.f.name]=1; });
  w.append(el('b','',Object.keys(fs).join(', ')+' · '+xs.length+T(' ψάρια',' fish')));
  var sp={}; xs.forEach(function(x){ var k=x.b.species||'?'; sp[k]=(sp[k]||0)+1; }); w.append(el('div','meta',Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; }).slice(0,4).map(function(k){ return k+' ×'+sp[k]; }).join(', ')));
  var ls2=el('div','hotlist'); ls2.style.maxHeight='42vh'; ls2.style.overflow='auto';
  xs.slice(0,60).forEach(function(x){ var r=el('button','hotrow'); r.type='button';
    var ic=el('span','hotth frth',ini(x.f.name)); ic.style.setProperty('--fc',col(x.f.uid)); r.append(ic);
    var tx=el('span','hottx'); tx.append(el('b','',(x.b.species||'?')+(x.b.kg?' · '+x.b.kg+' kg':'')),el('small','',fmtD(x.b)+' · '+x.f.name)); r.append(tx);
    r.addEventListener('click',function(e){ e.stopPropagation(); var map=C.map(); map.closePopup(); var p=L.popup({minWidth:200,maxWidth:260,className:'fishpopw'}).setLatLng([x.b.lat,x.b.lon]).setContent(bitePop(x.f,x.b)).openOn(map); setTimeout(function(){ photo(x.f,x.b,p.getElement()); },30); });
    ls2.append(r); });
  w.append(ls2); return w;
}
var PH={};
async function photo(f,b,root){
  if(!b.photo||!root) return; var im=root.querySelector('img.pimg'); if(!im) return;
  try{ var k=f.uid+'/'+b.id; if(!PH[k]){ var r=await CL().storage('GET','authenticated/photos/'+f.uid+'/'+b.id+'.jpg'); if(!r.ok) return; PH[k]=URL.createObjectURL(await r.blob()); }
    im.src=PH[k]; im.hidden=false; }catch(e){}
}

/* ---------- κάρτα στις Ρυθμίσεις ---------- */
var card=null, stEl=null;
function status(t,bad){ if(stEl){ stEl.textContent=t||''; stEl.style.color=bad?'#c8332b':''; } }
function code(){ var A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s=''; var a=new Uint32Array(8); try{ crypto.getRandomValues(a); }catch(e){ for(var i=0;i<8;i++) a[i]=Math.random()*1e9; } for(var j=0;j<8;j++) s+=A[a[j]%A.length]; return s; }
async function invite(out){
  var c=code(); out.replaceChildren(el('p','note',T('Δημιουργία…','Creating…')));
  try{ await CL().rest('friend_invites',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({code:c,name:(CL().name&&CL().name())||''})});
    out.replaceChildren(); var big=el('div','frcode',c.slice(0,4)+'-'+c.slice(4)); out.append(big,el('p','note',T('Στείλε τον κωδικό στον φίλο σου. Ισχύει 48 ώρες και για μία σύνδεση. Ο φίλος τον γράφει στο «Έχω κωδικό».','Send the code to your friend. It is valid for 48 hours and one use. Your friend enters it under “I have a code”.')));
    var sh=el('button','btn sm',T('Αποστολή','Share')); sh.type='button'; var txt=T('BiteCast: κωδικός φίλου ','BiteCast friend code ')+c.slice(0,4)+'-'+c.slice(4)+T('\nΆνοιξε BiteCast → Προφίλ → Ρυθμίσεις → Φίλοι → Έχω κωδικό.','\nOpen BiteCast → Profile → Settings → Friends → I have a code.');
    sh.addEventListener('click',function(){ if(navigator.share) navigator.share({text:txt}).catch(function(){}); else if(navigator.clipboard) navigator.clipboard.writeText(txt).then(function(){ sh.textContent=T('Αντιγράφηκε ✓','Copied ✓'); }); });
    out.append(sh);
  }catch(e){ out.replaceChildren(el('p','note',errMsg(e))); }
}
async function redeem(v,out){
  v=String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,''); if(v.length<6){ out.textContent=T('Γράψε τον κωδικό, π.χ. ABCD-EFGH.','Enter the code, e.g. ABCD-EFGH.'); return; }
  out.textContent=T('Σύνδεση…','Connecting…');
  try{ var r=await CL().rest('rpc/redeem_friend',{method:'POST',body:JSON.stringify({p_code:v,p_name:(CL().name&&CL().name())||''})}), j=await r.json();
    out.textContent=T('Έγινε! Είσαι φίλος με ','Done! You are now friends with ')+((j&&j.name)||T('τον φίλο σου','your friend'))+'.'; await refresh(true);
  }catch(e){ out.textContent=errMsg(e); }
}
async function setShare(f,v){ try{ await CL().rest('friends?owner=eq.'+me()+'&viewer=eq.'+f.uid,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({share:v})}); f.mine=v; save(); status(v?T('Ο ','')+f.name+T(' βλέπει τα δικά σου.',' can see yours.'):T('Ο ','')+f.name+T(' δεν βλέπει πια τα δικά σου.',' can no longer see yours.')); }catch(e){ status(errMsg(e),true); render(); } }
async function remove(f){
  var ok=window.PsaroAsk?await window.PsaroAsk(f.name,{title:T('Αφαίρεση φίλου;','Remove friend?'),ok:T('Αφαίρεση','Remove'),cancel:T('Άκυρο','Cancel'),danger:true}):confirm(f.name);
  if(!ok) return;
  try{ await CL().rest('friends?owner=eq.'+me()+'&viewer=eq.'+f.uid,{method:'DELETE',headers:{Prefer:'return=minimal'}}); await CL().rest('friends?owner=eq.'+f.uid+'&viewer=eq.'+me(),{method:'DELETE',headers:{Prefer:'return=minimal'}}); await refresh(true); }catch(e){ status(errMsg(e),true); }
}
function render(){
  var ps=$('pSettings'); if(!ps) return;
  if(!card){ card=el('div','card setcard'); card.id='frCard'; var anchor=[].slice.call(ps.querySelectorAll('.card')).find(function(c){ return /Συγχρονισμός|Sync/.test((c.querySelector('h3')||{}).textContent||''); }); if(anchor&&anchor.nextSibling) ps.insertBefore(card,anchor.nextSibling); else ps.appendChild(card); }
  card.replaceChildren(el('h3','',T('Φίλοι','Friends')));
  if(!logged()){ card.append(el('p','note',T('Συνδέσου στον λογαριασμό σου για να μοιράζεσαι ψάρια και σημεία με φίλους.','Sign in to share fish and spots with friends.'))); return; }
  card.append(el('p','note',T('Οι φίλοι βλέπουν τα ψάρια, τις φωτογραφίες και τα σημεία σου στον χάρτη τους, μόνο για ανάγνωση. Ό,τι σημειώσεις «Ιδιωτικό» δεν το βλέπει κανείς. Τα δικά τους δεν μπαίνουν στο Ημερολόγιό σου.','Friends see your fish, photos and spots on their map, read-only. Anything marked “Private” is never shown. Theirs never enter your Log.')));
  var ls3=el('div','frlist');
  if(!S.list.length) ls3.append(el('p','meta',T('Δεν έχεις φίλους ακόμα.','No friends yet.')));
  S.list.forEach(function(f){
    var r=el('div','frrow'), av=el('span','frav',ini(f.name)); av.style.setProperty('--fc',col(f.uid));
    var d=S.data[f.uid], info=el('div','frinf'); info.append(el('b','',f.name),el('small','',f.theyShare?((d?d.bites.length:0)+T(' ψάρια · ',' fish · ')+(d?d.spots.length:0)+((d&&d.spots.length===1)?T(' σημείο',' spot'):T(' σημεία',' spots'))):T('δεν μοιράζεται τα δικά του','is not sharing theirs')));
    var lb=el('label','frsh'), cb=el('input'); cb.type='checkbox'; cb.checked=f.mine!==false; cb.addEventListener('change',function(){ setShare(f,cb.checked); }); lb.append(cb,el('span','',T('Βλέπει τα δικά μου','Sees mine')));
    var rm=el('button','btn ghost sm',T('Αφαίρεση','Remove')); rm.type='button'; rm.addEventListener('click',function(){ remove(f); });
    r.append(av,info,lb,rm); ls3.append(r); });
  card.append(ls3);
  var mp=el('label','chk'), mc=el('input'); mc.type='checkbox'; mc.checked=mapOn(); mc.addEventListener('change',function(){ ls('psaro-fr-map',mc.checked); draw(); }); mp.append(mc,el('span','',T('Ψάρια και σημεία φίλων στον χάρτη','Friends’ fish and spots on the map'))); mp.style.cssText='display:flex;gap:10px;align-items:center;margin:8px 0';
  card.append(mp);
  var row=el('div','row'), inv=el('button','btn sm acc',T('Πρόσκληση φίλου','Invite a friend')); inv.type='button';
  var ref=el('button','btn sm ghost',T('Ανανέωση','Refresh')); ref.type='button'; ref.addEventListener('click',function(){ refresh(true); });
  row.append(inv,ref); card.append(row);
  var out=el('div','frout'); card.append(out); inv.addEventListener('click',function(){ invite(out); });
  var hv=el('label','f',T('Έχω κωδικό','I have a code')), sp=el('span','inl'), inp=el('input'); inp.type='text'; inp.placeholder='ABCD-EFGH'; inp.autocapitalize='characters'; inp.maxLength=12;
  var go=el('button','btn sm',T('Σύνδεση','Connect')); go.type='button'; var res=el('p','note'); go.addEventListener('click',function(){ redeem(inp.value,res); });
  sp.append(inp,go); hv.append(sp); card.append(hv,res);
  stEl=el('p','note'); card.append(stEl);
  if(S.at) stEl.textContent=T('Ενημερώθηκε ','Updated ')+new Date(S.at).toLocaleTimeString(EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'});
}
var st=document.createElement('style');
st.textContent='.mk-frb,.mk-frg,.mk-frs{display:grid;place-items:center;border-radius:50%;background:var(--fc);color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);font:700 11px system-ui,sans-serif}'+
 '.mk-frb{width:28px;height:28px;border-radius:50% 50% 50% 4px}.mk-frs{width:20px;height:20px;font-size:8.5px;border-radius:4px;opacity:.92}.mk-frg{position:relative;width:34px;height:34px;font-size:12px}'+
 '.mk-frg b{position:absolute;right:-7px;top:-7px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#fff;color:var(--fc);font:800 11px/18px system-ui,sans-serif;border:1.5px solid var(--fc);box-sizing:border-box}'+
 '.frwho{display:table;margin-bottom:4px;padding:2px 8px;border-radius:10px;background:var(--fc);color:#fff;font:600 11.5px system-ui,sans-serif}'+
 '.frth{display:grid;place-items:center;background:var(--fc)!important;color:#fff;font:700 12px system-ui,sans-serif}'+
 '#frCard .frrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.18);flex-wrap:wrap}'+
 '#frCard .frav{width:34px;height:34px;border-radius:50%;background:var(--fc);color:#fff;display:grid;place-items:center;font:700 13px system-ui,sans-serif;flex:0 0 34px}'+
 '#frCard .frinf{flex:1;min-width:120px;display:flex;flex-direction:column}#frCard .frinf small{opacity:.7;font-size:12px}'+
 '#frCard .frsh{display:flex;align-items:center;gap:6px;font-size:12.5px}#frCard .frcode{font:800 26px/1.2 ui-monospace,monospace;letter-spacing:.12em;margin:8px 0 2px}';
document.head.appendChild(st);
function boot(){ render(); draw(); refresh(false); }
if(window.ndEvery) window.ndEvery(function(){ refresh(false); },20*60000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden) refresh(false); });
window.addEventListener('psaro-login',function(){ refresh(true); });
setTimeout(boot,1500);
window.PsaroFriends={refresh:refresh,draw:draw,state:function(){ return S; }};
})();
