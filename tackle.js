/* Εξοπλισμός / Tackle: καλάμια, μουλινέδες, πετονιές, αγκίστρια, τεχνητά. Αποθηκεύεται στη συσκευή (localStorage psaro-tackle). */
(function(){
'use strict';
var C=window.PsaroCore, box=document.getElementById('pTackle'); if(!C||!box) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var TYPES=[
  ['rod',T('Καλάμια','Rods'),T('Καλάμι','Rod'),'🎣',T('Μήκος · δράση · βάρος δολώματος (π.χ. 2,7 m · 20–50 g)','Length · action · lure weight (e.g. 9 ft · 20–50 g)')],
  ['reel',T('Μουλινέδες','Reels'),T('Μουλινέ','Reel'),'⚙️',T('Μέγεθος · σχέση (π.χ. 4000 · 5.2:1)','Size · ratio (e.g. 4000 · 5.2:1)')],
  ['line',T('Νήματα','Main lines'),T('Νήμα','Main line'),'🧵',T('Τύπος · πάχος/lb · μήκος (π.χ. πλεκτό PE 1.5 · 150 m)','Type · mm/lb · length (e.g. braid PE 1.5 · 150 m)')],
  ['leader',T('Πετονιές (leader)','Leaders'),T('Πετονιά (leader)','Leader'),'➰',T('Τύπος · πάχος · μήκος (π.χ. fluorocarbon 0,40 mm · 2 m)','Type · mm · length (e.g. fluorocarbon 0.40 mm · 2 m)')],
  ['hook',T('Αγκίστρια','Hooks'),T('Αγκίστρι','Hook'),'🪝',T('Μέγεθος · τύπος (π.χ. Νο 2/0 · circle)','Size · type (e.g. 2/0 · circle)')],
  ['lure',T('Τεχνητά','Lures'),T('Τεχνητό','Lure'),'🐟',T('Είδος · βάρος · χρώμα (π.χ. jig 40 g · ροζ)','Kind · weight · colour (e.g. jig 40 g · pink)')],
  ['set',T('Σετ','Sets'),T('Σετ','Set'),'🧰',T('Σημείωση (π.χ. για ψάρεμα βυθού)','Note (e.g. for bottom fishing)')],
  ['other',T('Άλλα','Other'),T('Άλλο','Other'),'📦',T('Περιγραφή','Description')]
];
var tinfo=function(k){ for(var i=0;i<TYPES.length;i++) if(TYPES[i][0]===k) return TYPES[i]; return TYPES[TYPES.length-1]; };
var S=C.Store;
function load(){ return (S.raw('tackle')||[]).slice(); }
function put(o){ return S.save('tackle',o); }
function del(id){ return S.remove('tackle',id); }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function btn(t,cls,fn){ var b=el('button','btn '+(cls||'')+' sm',t); b.type='button'; b.addEventListener('click',fn); return b; }
var fType='all', editing=null, query='', urls={};
function thumbUrl(id){ var k='tk-'+id; if(urls[k]) return Promise.resolve(urls[k]); return C.Photos.get(k).then(function(bl){ if(!bl) return null; urls[k]=URL.createObjectURL(bl); return urls[k]; }).catch(function(){ return null; }); }
function viewer(u){ var o=el('div','tkview'); var i=el('img'); i.src=u; o.append(i); o.addEventListener('click',function(){ o.remove(); }); document.body.append(o); }
function sortKey(){ var v=C.lsGet('psaro-sort-tackle','new'); return v; }
function render(){
  box.replaceChildren();
  var all=load();
  var chips=el('div','seg'); chips.style.cssText='flex-wrap:wrap;margin:8px 0';
  [['all',T('Όλα','All')]].concat(TYPES.map(function(t){ return [t[0],t[1]]; })).forEach(function(c){
    var n=c[0]==='all'?all.length:all.filter(function(x){ return x.type===c[0]; }).length;
    var b=el('button','',c[1]+(n?' '+n:'')); b.type='button'; b.style.flex='1 0 auto'; b.setAttribute('aria-pressed',String(fType===c[0]));
    b.addEventListener('click',function(){ fType=c[0]; editing=null; render(); }); chips.append(b);
  });
  box.append(chips);
  var bar=el('div','row'); bar.style.cssText='display:flex;gap:8px;align-items:flex-end;margin:6px 0';
  var lab=el('label','f sortsel'); lab.style.cssText='margin:0;flex:1'; lab.append(document.createTextNode(T('Ταξινόμηση','Sort by')));
  var sel=el('select'); [['new',T('Πιο πρόσφατα','Newest')],['name',T('Όνομα','Name')],['type',T('Είδος','Type')]].forEach(function(o){ var op=el('option',null,o[1]); op.value=o[0]; sel.append(op); });
  sel.value=sortKey(); sel.addEventListener('change',function(){ C.lsSet('psaro-sort-tackle',sel.value); render(); }); lab.append(sel);
  var add=btn(T('＋ Νέο','＋ New'),'',function(){ editing={id:null,type:fType==='all'?'rod':fType}; render(); }); add.id='tkNew';
  bar.append(lab,add); box.append(bar);
  if(editing) box.append(form(editing));
  var qs=el('input'); qs.type='search'; qs.placeholder=T('Αναζήτηση…','Search…'); qs.value=query; qs.style.cssText='width:100%;margin:2px 0 8px'; qs.addEventListener('input',function(){ query=qs.value; var p=qs.selectionStart; render(); var n=box.querySelector('input[type=search]'); if(n){ n.focus(); try{ n.setSelectionRange(p,p); }catch(e){} } }); if(all.length>6) box.append(qs);
  var nmap=names();
  var ql=query.trim().toLowerCase();
  var list=all.filter(function(x){ return (fType==='all'||x.type===fType)&&(!ql||((x.name||'')+' '+(x.brand||'')+' '+(x.spec||'')).toLowerCase().indexOf(ql)>=0); });
  var k=sortKey();
  list.sort(function(a,b){ if(k==='name') return (a.name||'').localeCompare(b.name||'',EN?'en':'el'); if(k==='type') return (a.type||'').localeCompare(b.type||'')||(a.name||'').localeCompare(b.name||'',EN?'en':'el'); return (b.ts||0)-(a.ts||0); });
  if(!list.length&&!editing){ var e=el('p','note',T('Δεν έχεις προσθέσει εξοπλισμό ακόμα. Πάτα «＋ Νέο» για καλάμι, μουλινέ, πετονιά, αγκίστρια ή τεχνητά.','No tackle yet. Tap “＋ New” to add a rod, reel, line, hooks or lures.')); box.append(e); }
  list.forEach(function(it){
    var ti=tinfo(it.type), card=el('div','item'), head=el('div','ihead');
    head.append(el('b','ititle',ti[3]+' '+(it.name||'—')),el('span','when mono',ti[2])); card.append(head);
    if(it.photo){ var im=el('img','tkimg'); im.alt=''; im.hidden=true; card.append(im); thumbUrl(it.id).then(function(u){ if(u){ im.src=u; im.hidden=false; im.addEventListener('click',function(){ viewer(u); }); } }); }
    var mem=(it.type==='set')?(it.members||[]).filter(function(i){ return nmap[i]; }):[];
    if(it.type==='set') card.append(el('div','meta',mem.length?mem.map(function(i){ return nmap[i]; }).join(' · '):T('Κανένα στοιχείο','No items')));
    var m=[]; if(it.brand) m.push(it.brand); if(it.spec) m.push(it.spec); if(it.qty) m.push('×'+it.qty);
    if(it.w&&it.w.length) m.push(it.w.join('/')+' g'); if(it.color) m.push(it.color); if(it.sz&&it.sz.length) m.push(it.sz.join('/')); if(it.cord) m.push(it.cord);
    if(m.length) card.append(el('div','meta',m.join(' · ')));
    var ub=(S.get('bites')||[]).filter(function(b){ return it.type==='set'?(mem.length&&b.tk&&mem.every(function(i){ return b.tk.indexOf(i)>=0; })):(b.tk&&b.tk.indexOf(it.id)>=0); }), uf=0, ukg=0; ub.forEach(function(b){ uf+=C.bc(b); ukg+=b.rel?0:(+b.kg||0); });
    if(ub.length) card.append(el('div','meta',T('Αλιεύματα: ','Catches: ')+uf+(ukg?' · '+Math.round(ukg*10)/10+' kg':'')));
    if(it.notes) card.append(el('div','meta',it.notes));
    var today=C.nicosiaToday(), dd=function(a,b){ return Math.round((Date.parse(b)-Date.parse(a))/86400000); };
    if((it.type==='line'||it.type==='leader')&&it.since){ var nd=dd(it.since,today), nt=(S.get('trips')||[]).filter(function(x){ return (x.date||'')>=it.since; }).length, old=it.type==='leader'?(nd>60||nt>15):(nd>180);
      card.append(el('div','meta',T('Από την αλλαγή: ','Since change: ')+nd+T(' ημέρες · ',' days · ')+nt+T(' έξοδοι',' trips')+(old?T(' · 💡 ίσως ώρα για αλλαγή (ενδεικτικά)',' · 💡 may be time to change (rough guide)'):''))); }
    if(it.type==='reel'&&it.svc){ var sd=dd(it.svc,today); card.append(el('div','meta',T('Συντήρηση πριν ','Serviced ')+sd+T(' ημέρες',' days ago')+(sd>90?T(' · 💡 ίσως ώρα για λίπανση (ενδεικτικά)',' · 💡 may need servicing (rough guide)'):''))); }
    if(it.qty!=null&&it.qty<=2&&(it.type==='hook'||it.type==='lure')) card.append(el('div','meta',T('⚠ Σου τελειώνουν','⚠ Running low')));
    if(it.lost) card.append(el('div','meta',T('Χάθηκαν: ','Lost: ')+it.lost));
    var acts=el('div','acts');
    if((it.type==='hook'||it.type==='lure')&&it.qty>0) acts.append(btn(T('Χάθηκε −1','Lost −1'),'ghost',function(){ var o=JSON.parse(JSON.stringify(it)); o.qty=it.qty-1; o.lost=(it.lost||0)+1; put(o); render(); }));
    if(it.type==='reel') acts.append(btn(T('✔ Συντηρήθηκε','✔ Serviced'),'ghost',function(){ var o=JSON.parse(JSON.stringify(it)); o.svc=today; put(o); render(); }));
    if(it.type==='line'||it.type==='leader') acts.append(btn(T('✔ Άλλαξα','✔ Changed'),'ghost',function(){ var o=JSON.parse(JSON.stringify(it)); o.since=today; put(o); render(); }));
    acts.append(btn(T('Επεξεργασία','Edit'),'ghost',function(){ editing=JSON.parse(JSON.stringify(it)); render(); }),
      btn(T('Διαγραφή','Delete'),'ghost',function(){
        var go=function(){ del(it.id); if(it.photo){ try{ C.Photos.del('tk-'+it.id); }catch(e){} } render(); };
        if(window.PsaroAsk) PsaroAsk(T('Διαγραφή «','Delete “')+(it.name||ti[2])+T('»;','”?'),{danger:true,ok:T('Διαγραφή','Delete')}).then(function(ok){ if(ok) go(); }); else go();
      }));
    card.append(acts); box.append(card);
  });
}
function field(label,type,val,ph){ var l=el('label','f'); l.append(document.createTextNode(label)); var i=el('input'); i.type=type||'text'; i.value=val==null?'':val; if(ph) i.placeholder=ph; i.maxLength=120; l.append(i); return {l:l,i:i}; }
function form(it){
  var f=el('div','card'); f.style.margin='8px 0'; f.id='tkForm';
  f.append(el('h3',null,it.id?T('Επεξεργασία','Edit'):T('Νέος εξοπλισμός','New tackle')));
  var ls=el('label','f'); ls.append(document.createTextNode(T('Είδος','Type'))); var ts=el('select'); TYPES.forEach(function(t){ var o=el('option',null,t[2]); o.value=t[0]; ts.append(o); }); ts.value=it.type; ls.append(ts); f.append(ls);
  var nm=field(T('Όνομα','Name'),'text',it.name,T('π.χ. Shimano Vanquish','e.g. Shimano Vanquish')), br=field(T('Μάρκα / μοντέλο','Brand / model'),'text',it.brand), sp=field(T('Χαρακτηριστικά','Specs'),'text',it.spec,tinfo(it.type)[4]),
      qt=field(T('Ποσότητα','Quantity'),'number',it.qty), nt=field(T('Σημειώσεις','Notes'),'text',it.notes),
      wt=field(T('Διαθέσιμα βάρη (g), χωρισμένα με κόμμα','Available weights (g), comma separated'),'text',(it.w||[]).join(', '),'20, 30, 40, 60'),
      co=field(T('Χρώμα','Colour'),'text',it.color,T('π.χ. ροζ, μπλε/ασημί','e.g. pink, blue/silver')),
      hs=field(T('Διαθέσιμα μεγέθη, χωρισμένα με κόμμα','Available sizes, comma separated'),'text',(it.sz||[]).join(', '),'1/0, 2/0, 4/0'), hc=field(T('Νήμα assist (προαιρετικό)','Assist cord (optional)'),'text',it.cord,T('π.χ. PE 3 · 4 cm','e.g. PE 3 · 4 cm')),
      sn=field(T('Τελευταία αλλαγή','Last changed'),'date',it.since), sv=field(T('Τελευταία συντήρηση','Last serviced'),'date',it.svc);
  var dl=el('datalist'); dl.id='tkDL'; nm.i.setAttribute('list','tkDL'); nm.l.append(dl);
  var fillDL=function(){ dl.replaceChildren(); (window.TACKLE_LIB||[]).forEach(function(r){ if(r[0]!==ts.value) return; var o=el('option'); o.value=(r[1]+' '+r[2]).trim(); dl.append(o); }); };
  nm.i.addEventListener('change',function(){ var v=nm.i.value.trim().toLowerCase(); (window.TACKLE_LIB||[]).some(function(r){ if(r[0]===ts.value&&(r[1]+' '+r[2]).trim().toLowerCase()===v){ if(!br.i.value) br.i.value=r[1]; return true; } return false; }); });
  ts.addEventListener('change',function(){ sp.i.placeholder=tinfo(ts.value)[4]; vis(); fillDL(); });
  qt.i.min='0'; qt.i.inputMode='numeric'; wt.i.inputMode='decimal';
  var vis=function(){ var v=ts.value; qt.l.hidden=!(v==='hook'||v==='lure'); wt.l.hidden=v!=='lure'; co.l.hidden=v!=='lure'; hs.l.hidden=v!=='hook'; hc.l.hidden=v!=='hook'; sn.l.hidden=!(v==='line'||v==='leader'); sv.l.hidden=v!=='reel'; };
  vis(); fillDL();
  var memL=el('div','f'), memSel={}, memObj=(it.members||[]).map(function(i){ return load().filter(function(x){ return x.id===i; })[0]; }).filter(Boolean);
  [['rod',T('Καλάμι','Rod')],['reel',T('Μουλινέ','Reel')],['line',T('Νήμα','Main line')],['leader',T('Πετονιά (leader)','Leader')]].forEach(function(ty){
    var l=el('label','f'); l.append(document.createTextNode(ty[1])); var s=el('select'); var o0=el('option',null,ty[0]==='rod'?T('— διάλεξε —','— choose —'):T('— κανένα —','— none —')); o0.value=''; s.append(o0);
    load().filter(function(x){ return x.type===ty[0]; }).sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); }).forEach(function(x){ var o=el('option',null,x.name||'—'); o.value=x.id; s.append(o); });
    var cur=memObj.filter(function(x){ return x.type===ty[0]; })[0]; if(cur) s.value=cur.id; memSel[ty[0]]=s; l.append(s); memL.append(l); });
  var hint=el('p','note',T('Το σετ παίρνει το όνομα του καλαμιού. Πρόσθεσε πρώτα καλάμια, μουλινέδες και νήματα στις αντίστοιχες καρτέλες.','The setup is named after the rod. Add rods, reels and lines in their own tabs first.')); memL.append(hint);
  var setSync=function(){ var s=ts.value==='set'; memL.hidden=!s; br.l.hidden=s; nm.l.hidden=s; sp.l.hidden=s; };
  ts.addEventListener('change',setSync);
  f.append(nm.l,br.l,sp.l,qt.l,wt.l,co.l,hs.l,hc.l,sn.l,sv.l,memL,nt.l); setSync();
  var newBlob=null, rmPhoto=false, pv=el('img','tkimg'), pl=el('div','f'); pv.alt=''; pv.hidden=true;
  pl.append(el('span',null,T('Φωτογραφία','Photo')),pv);
  var prow=el('div','acts'); prow.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:4px';
  var mk=function(label,cap){ var l=el('label','btn ghost sm',label); l.style.cursor='pointer'; var i=el('input'); i.type='file'; i.accept='image/*'; if(cap) i.setAttribute('capture','environment'); i.hidden=true;
    i.addEventListener('change',function(){ var fl=i.files&&i.files[0]; if(!fl) return; (C.resizeImage?C.resizeImage(fl):Promise.resolve(fl)).then(function(bl){ newBlob=bl; rmPhoto=false; pv.src=URL.createObjectURL(bl); pv.hidden=false; rm.hidden=false; }).catch(function(){ msg.textContent=T('Η φωτογραφία δεν διαβάστηκε.','Could not read the photo.'); }); i.value=''; });
    l.append(i); return l; };
  var rm=btn(T('Αφαίρεση','Remove'),'ghost',function(){ newBlob=null; rmPhoto=true; pv.hidden=true; rm.hidden=true; });
  prow.append(mk(T('📷 Κάμερα','📷 Camera'),true),mk(T('🖼 Συλλογή','🖼 Gallery'),false),rm); pl.append(prow); rm.hidden=true;
  if(it.photo&&it.id){ thumbUrl(it.id).then(function(u){ if(u&&!newBlob){ pv.src=u; pv.hidden=false; rm.hidden=false; } }); }
  f.append(pl);
  var msg=el('p','note'); msg.setAttribute('role','status'); f.append(msg);
  var acts=el('div','acts');
  acts.append(btn(T('Αποθήκευση','Save'),'',async function(){
    var isSet=ts.value==='set', name=nm.i.value.trim();
    if(isSet){ var rid=memSel.rod.value; if(!rid){ msg.textContent=T('Διάλεξε καλάμι για το σετ.','Choose a rod for the setup.'); return; } name=(load().filter(function(x){ return x.id===rid; })[0]||{}).name||T('Σετ','Setup'); }
    else if(!name){ msg.textContent=T('Γράψε ένα όνομα.','Enter a name.'); nm.i.focus(); return; }
    var o={id:it.id||undefined,type:ts.value,name:name,brand:br.i.value.trim(),spec:sp.i.value.trim(),notes:nt.i.value.trim(),ts:it.ts||Date.now()};
    var q=parseInt(qt.i.value,10); if(!qt.l.hidden&&q>0) o.qty=q;
    if(o.type==='lure'){ var ws=wt.i.value.split(/[,;\s]+/).map(function(x){ return parseFloat(x.replace(',','.')); }).filter(function(x){ return x>0&&x<5000; }); ws=ws.filter(function(x,i){ return ws.indexOf(x)===i; }).sort(function(a,b){ return a-b; }); if(ws.length) o.w=ws; }
    if(o.type==='lure'&&co.i.value.trim()) o.color=co.i.value.trim();
    if(o.type==='hook'){ var zs=hs.i.value.split(/[,;]+/).map(function(x){ return x.trim(); }).filter(Boolean); zs=zs.filter(function(x,i){ return zs.indexOf(x)===i; }); if(zs.length) o.sz=zs; if(hc.i.value.trim()) o.cord=hc.i.value.trim(); }
    if((o.type==='line'||o.type==='leader')&&sn.i.value) o.since=sn.i.value;
    if(o.type==='reel'&&sv.i.value) o.svc=sv.i.value;
    if(it.lost) o.lost=it.lost;
    if(o.type==='set'){ o.members=['rod','reel','line','leader'].map(function(k){ return memSel[k].value; }).filter(Boolean); o.brand=''; o.spec=''; }
    o.id=o.id||('tk'+Date.now().toString(36)+Math.random().toString(36).slice(2,5));
    try{
      if(newBlob){ await C.Photos.put('tk-'+o.id,newBlob); o.photo=true; urls['tk-'+o.id]=null; }
      else if(rmPhoto){ try{ await C.Photos.del('tk-'+o.id); }catch(e){} urls['tk-'+o.id]=null; }
      else if(it.photo) o.photo=true;
    }catch(e){ msg.textContent=T('Η φωτογραφία δεν αποθηκεύτηκε.','The photo was not saved.'); }
    put(o); editing=null; render();
  }),btn(T('Άκυρο','Cancel'),'ghost',function(){ editing=null; render(); }));
  f.append(acts); return f;
}
var picked=[], pw={}, ph={}, ps={}, TERM={hook:1,lure:1,other:1}, askedD=false;
function union(){ var u=picked.slice(); Object.keys(ph).forEach(function(l){ if(picked.indexOf(l)>=0&&ph[l]&&u.indexOf(ph[l])<0) u.push(ph[l]); }); return u; }
function lastSel(){ var bs=(S.get('bites')||[]).filter(function(b){ return b.tk&&b.tk.length; }); if(!bs.length) return {ids:[],w:{},h:{},s:{}}; bs.sort(function(a,b){ return (b._u||0)-(a._u||0); }); var ex={}; load().forEach(function(x){ ex[x.id]=1; }); var b0=bs[0], w={}, h={}, s={}; Object.keys(b0.tkw||{}).forEach(function(k){ if(ex[k]) w[k]=b0.tkw[k]; }); Object.keys(b0.tkh||{}).forEach(function(k){ if(ex[k]&&ex[b0.tkh[k]]) h[k]=b0.tkh[k]; }); Object.keys(b0.tks||{}).forEach(function(k){ if(ex[k]) s[k]=b0.tks[k]; }); return {ids:b0.tk.filter(function(i){ return ex[i]; }),w:w,h:h,s:s}; }
function memHook(lureId){ var bs=(S.get('bites')||[]).filter(function(b){ return b.tkh&&b.tkh[lureId]; }); if(!bs.length) return null; bs.sort(function(a,b){ return (b._u||0)-(a._u||0); }); var hid=bs[0].tkh[lureId]; if(!load().some(function(x){ return x.id===hid; })) return null; return {h:hid,s:(bs[0].tks||{})[hid]}; }
function mount(div,ids,w,h,s){
  if(!div) return; askedD=false; var L=null; if(ids==='last'){ L=lastSel(); picked=L.ids; pw=L.w; ph=L.h; ps=L.s; } else { picked=(ids||[]).slice(); pw=Object.assign({},w||{}); ph=Object.assign({},h||{}); ps=Object.assign({},s||{}); }
  /* τα αγκίστρια που ανήκουν σε τεχνητό δεν μένουν και ως ξεχωριστή επιλογή */
  var hv={}; Object.keys(ph).forEach(function(l){ hv[ph[l]]=1; }); picked=picked.filter(function(i){ return !hv[i]; });
  var tdiv=document.getElementById('bTerm'), wdiv=document.getElementById('bTkW'), sg=document.getElementById('bTkSug'), wrap=document.getElementById('bTackleWrap');
  div.replaceChildren(); if(tdiv) tdiv.replaceChildren(); if(wdiv) wdiv.replaceChildren();
  var all=load(), order=TYPES.map(function(t){ return t[0]; }), ex={}; all.forEach(function(x){ ex[x.id]=x; });
  var emp=document.getElementById('bTkEmpty'); if(!emp&&wrap){ emp=el('div','note'); emp.id='bTkEmpty'; wrap.append(emp); }
  if(emp){ emp.replaceChildren(); emp.hidden=!!all.length; if(!all.length){ emp.append(document.createTextNode(T('Δεν έχεις εξοπλισμό ακόμα. ','No tackle yet. '))); var gb=el('button','btn ghost sm',T('Πρόσθεσε στο Προφίλ → Εξοπλισμός','Add in Profile → Tackle')); gb.type='button'; gb.addEventListener('click',function(){ var pb=document.getElementById('profBtn'); if(pb) pb.click(); setTimeout(function(){ if(window.PsaroProfView) PsaroProfView.set('tackle'); },80); }); emp.append(gb); } }
  if(wrap){ var sp=wrap.querySelectorAll(':scope>span'); if(sp[0]) sp[0].textContent=T('Καλάμι / σετ','Rod / setup'); if(sp[1]) sp[1].textContent=T('Τερματικό','Terminal tackle'); Array.prototype.forEach.call(sp,function(s2){ s2.hidden=!all.length; }); }
  var rank=function(x){ return x.type==='set'?-1:order.indexOf(x.type); };
  all.sort(function(a,b){ return rank(a)-rank(b)||(a.name||'').localeCompare(b.name||''); });
  var inSet={}; all.forEach(function(x){ if(x.type==='set') (x.members||[]).forEach(function(i){ inSet[i]=1; }); });
  var hooks=all.filter(function(x){ return x.type==='hook'; });
  var btns=[];
  var chipRow=function(label,opts,isOn,onClick){ var row=el('div','tkwrow'); row.append(el('span','note',label)); var cs=el('div','tkchips'); opts.forEach(function(o){ var b=el('button','',o[1]); b.type='button'; b.setAttribute('aria-pressed',String(isOn(o[0]))); b.addEventListener('click',function(){ onClick(o[0]); }); cs.append(b); }); row.append(cs); return row; };
  var refresh=function(){
    var U=union();
    btns.forEach(function(p){ var on=p.it.type==='set'?(p.mem.length>0&&p.mem.every(function(i){ return picked.indexOf(i)>=0; })):U.indexOf(p.it.id)>=0; p.b.setAttribute('aria-pressed',String(on)); });
    if(wdiv){ wdiv.replaceChildren();
      picked.forEach(function(id){ var it=ex[id]; if(!it||it.type!=='lure') return;
        if(it.w&&it.w.length) wdiv.append(chipRow((it.name||'')+' · g',it.w.map(function(g){ return [g,g+' g']; }),function(g){ return pw[id]===g; },function(g){ if(pw[id]===g) delete pw[id]; else pw[id]=g; refresh(); }));
        if(hooks.length) wdiv.append(chipRow((it.name||'')+T(' · αγκίστρι',' · hook'),hooks.map(function(x){ return [x.id,x.name||'—']; }),function(h2){ return ph[id]===h2; },function(h2){ if(ph[id]===h2){ delete ph[id]; } else { ph[id]=h2; if(ex[h2].sz&&ex[h2].sz.length&&!ps[h2]){ var mm=memHook(id); if(mm&&mm.h===h2&&mm.s) ps[h2]=mm.s; } } refresh(); })); });
      union().forEach(function(id){ var it=ex[id]; if(!it||it.type!=='hook'||!it.sz||!it.sz.length) return; wdiv.append(chipRow((it.name||'')+T(' · μέγεθος',' · size'),it.sz.map(function(z){ return [z,z]; }),function(z){ return ps[id]===z; },function(z){ if(ps[id]===z) delete ps[id]; else ps[id]=z; refresh(); })); }); }
    suggest();
  };
  all.forEach(function(it){ var isSet=it.type==='set', mem=isSet?(it.members||[]).filter(function(i){ return ex[i]; }):[];
    if(isSet&&!mem.length) return;
    if(!isSet&&!TERM[it.type]&&inSet[it.id]) return;
    var term=!!TERM[it.type]; var host=term?tdiv:div; if(!host) return;
    var b=el('button','',tinfo(it.type)[3]+' '+(it.name||'—')); b.type='button'; if(isSet) b.className='tkset';
    b.addEventListener('click',function(){
      if(isSet){ var allOn=mem.every(function(i){ return picked.indexOf(i)>=0; });
        if(!allOn) picked=picked.filter(function(i){ return !ex[i]||TERM[ex[i].type]; });
        mem.forEach(function(i){ var k=picked.indexOf(i); if(allOn){ if(k>=0) picked.splice(k,1); } else if(k<0) picked.push(i); }); }
      else if(it.type==='hook'&&Object.keys(ph).some(function(l){ return ph[l]===it.id&&picked.indexOf(l)>=0; })){ Object.keys(ph).forEach(function(l){ if(ph[l]===it.id) delete ph[l]; }); }
      else { var k2=picked.indexOf(it.id);
        if(k2>=0){ picked.splice(k2,1); delete pw[it.id]; if(it.type==='lure') delete ph[it.id]; }
        else { picked.push(it.id); if(it.type==='lure'&&!ph[it.id]){ var mm2=memHook(it.id); if(mm2){ ph[it.id]=mm2.h; if(mm2.s) ps[mm2.h]=mm2.s; } } } }
      refresh(); });
    btns.push({it:it,b:b,mem:mem}); host.append(b); });
  if(tdiv){ var h2=tdiv.previousElementSibling; if(h2&&h2.tagName==='SPAN') h2.hidden=!tdiv.children.length||!all.length; }
  refresh();
}
/* Πρόταση βάρους: ενδεικτικός κανόνας από βάθος, κύμα και άνεμο + τα δικά σου αλιεύματα με κάθε βάρος */
function suggest(){
  var sg=document.getElementById('bTkSug'); if(!sg) return; var msg=[], ex={}, needD=false; load().forEach(function(x){ ex[x.id]=x; });
  var dEl=document.querySelector('input#bDepth'), depth=dEl&&dEl.value!==''?+dEl.value:null, wv=document.getElementById('dWave'), wd=document.getElementById('dWind'), wave=wv?+wv.value:0, wind=wd?+wd.value:0, cd=window.PsaroCond&&PsaroCond(), cur=cd&&cd.cur!=null?+cd.cur:null, dsrc='';
  if(!(depth>0)){ var lm=document.getElementById('bLocMode'), bs_=document.getElementById('bSpot'); if(lm&&lm.value==='spot'&&bs_){ var sp0=(S.get('spots')||[]).filter(function(x){ return x.id===bs_.value; })[0]; if(sp0&&+sp0.depth>0){ depth=+sp0.depth; dsrc=T(' (από το σημείο)',' (from spot)'); } } }
  picked.forEach(function(id){ var it=ex[id]; if(!it||it.type!=='lure'||!it.w||it.w.length<2) return;
    var line='';
    if(depth>0){ var f=1+(wave>=0.6?0.25:0)+(wind>=15?0.2:0)+(cur>=1?0.4:(cur>=0.5?0.2:0)), want=depth*1.2*f, best=it.w.reduce(function(a,g){ return Math.abs(g-want)<Math.abs(a-want)?g:a; },it.w[0]);
      line=T('💡 «','💡 “')+it.name+T('»: δοκίμασε ~','”: try ~')+best+' g ('+T('βάθος ','depth ')+depth+' m'+dsrc+(cur>=0.5?T(', ρεύμα ',', current ')+cur+' kn':'')+(wave>=0.6?T(', κύμα ',', waves ')+wave+' m':'')+(wind>=15?T(', άνεμος ',', wind ')+wind:'')+'). '+T('Ενδεικτικός κανόνας.','Rule of thumb only.'); }
    else { line=T('💡 «','💡 “')+it.name+T('»: βάλε βάθος ή πάτα «Βάθος από χάρτη» για πρόταση βάρους.','”: enter depth or tap “Depth from chart” for a weight suggestion.'); needD=true; }
    var cnt={}; (S.get('bites')||[]).forEach(function(b){ if(b.tkw&&b.tkw[id]) cnt[b.tkw[id]]=(cnt[b.tkw[id]]||0)+C.bc(b); });
    var ks=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }); if(ks.length&&cnt[ks[0]]>=3) line+=' '+T('Στα δικά σου: ','Yours: ')+ks[0]+' g ('+cnt[ks[0]]+T(' ψάρια).',' fish).');
    msg.push(line); });
  if(needD&&!askedD){ askedD=true; try{ window.dispatchEvent(new Event('psaro-needdepth')); }catch(e){} }
  sg.hidden=!msg.length; sg.textContent=msg.join('\n'); sg.style.whiteSpace='pre-line';
}
['bLocMode','bSpot'].forEach(function(i){ var e=document.getElementById(i); if(e) e.addEventListener('change',suggest); });
['bDepth','dWave','dWind'].forEach(function(i){ var e=i==='bDepth'?document.querySelector('input#bDepth'):document.getElementById(i); if(e) e.addEventListener('input',suggest); });
function names(){ var m={}; load().forEach(function(x){ m[x.id]=tinfo(x.type)[3]+' '+(x.name||'—'); }); return m; }
function info(){ var m={}; load().forEach(function(x){ m[x.id]={type:x.type,name:tinfo(x.type)[3]+' '+(x.name||'—')}; }); return m; }
window.PsaroTackle={all:load,last:lastSel,mount:mount,sel:function(){ return union(); },selW:function(){ var o={}; picked.forEach(function(i){ if(pw[i]) o[i]=pw[i]; }); return o; },selH:function(){ var o={}; picked.forEach(function(i){ if(ph[i]) o[i]=ph[i]; }); return o; },selS:function(){ var o={}; union().forEach(function(i){ if(ps[i]) o[i]=ps[i]; }); return o; },names:names,info:info};
window.addEventListener('psaro-pview',function(e){ if(e.detail==='tackle'){ editing=null; render(); } });
S.on('tackle',function(){ if(!box.hidden&&!editing) render(); });
render();
})();
