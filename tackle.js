/* Εξοπλισμός / Tackle: καλάμια, μουλινέδες, πετονιές, αγκίστρια, τεχνητά. Αποθηκεύεται στη συσκευή (localStorage psaro-tackle). */
(function(){
'use strict';
var C=window.PsaroCore, box=document.getElementById('pTackle'); if(!C||!box) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var TYPES=[
  ['rod',T('Καλάμια','Rods'),T('Καλάμι','Rod'),'🎣',T('Μήκος · δράση · βάρος δολώματος (π.χ. 2,7 m · 20–50 g)','Length · action · lure weight (e.g. 9 ft · 20–50 g)')],
  ['reel',T('Μουλινέδες','Reels'),T('Μουλινέ','Reel'),'⚙️',T('Μέγεθος · σχέση (π.χ. 4000 · 5.2:1)','Size · ratio (e.g. 4000 · 5.2:1)')],
  ['line',T('Πετονιές','Lines'),T('Πετονιά','Line'),'🧵',T('Τύπος · πάχος/lb · μήκος (π.χ. πλεκτή 0,16 mm · 150 m)','Type · mm/lb · length (e.g. braid 0.16 mm · 150 m)')],
  ['hook',T('Αγκίστρια','Hooks'),T('Αγκίστρι','Hook'),'🪝',T('Μέγεθος · τύπος (π.χ. Νο 2/0 · circle)','Size · type (e.g. 2/0 · circle)')],
  ['lure',T('Τεχνητά','Lures'),T('Τεχνητό','Lure'),'🐟',T('Είδος · βάρος · χρώμα (π.χ. jig 40 g · ροζ)','Kind · weight · colour (e.g. jig 40 g · pink)')],
  ['other',T('Άλλα','Other'),T('Άλλο','Other'),'📦',T('Περιγραφή','Description')]
];
var tinfo=function(k){ for(var i=0;i<TYPES.length;i++) if(TYPES[i][0]===k) return TYPES[i]; return TYPES[5]; };
var S=C.Store;
function load(){ return (S.raw('tackle')||[]).slice(); }
function put(o){ return S.save('tackle',o); }
function del(id){ return S.remove('tackle',id); }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function btn(t,cls,fn){ var b=el('button','btn '+(cls||'')+' sm',t); b.type='button'; b.addEventListener('click',fn); return b; }
var fType='all', editing=null;
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
  var bar=el('div','row'); bar.style.cssText='display:flex;gap:8px;align-items:center;margin:6px 0';
  var lab=el('label','f sortsel'); lab.style.cssText='margin:0;flex:1'; lab.append(document.createTextNode(T('Ταξινόμηση','Sort by')));
  var sel=el('select'); [['new',T('Πιο πρόσφατα','Newest')],['name',T('Όνομα','Name')],['type',T('Είδος','Type')]].forEach(function(o){ var op=el('option',null,o[1]); op.value=o[0]; sel.append(op); });
  sel.value=sortKey(); sel.addEventListener('change',function(){ C.lsSet('psaro-sort-tackle',sel.value); render(); }); lab.append(sel);
  var add=btn(T('＋ Νέο','＋ New'),'',function(){ editing={id:null,type:fType==='all'?'rod':fType}; render(); }); add.id='tkNew';
  bar.append(lab,add); box.append(bar);
  if(editing) box.append(form(editing));
  var list=all.filter(function(x){ return fType==='all'||x.type===fType; });
  var k=sortKey();
  list.sort(function(a,b){ if(k==='name') return (a.name||'').localeCompare(b.name||'',EN?'en':'el'); if(k==='type') return (a.type||'').localeCompare(b.type||'')||(a.name||'').localeCompare(b.name||'',EN?'en':'el'); return (b.ts||0)-(a.ts||0); });
  if(!list.length&&!editing){ var e=el('p','note',T('Δεν έχεις προσθέσει εξοπλισμό ακόμα. Πάτα «＋ Νέο» για καλάμι, μουλινέ, πετονιά, αγκίστρια ή τεχνητά.','No tackle yet. Tap “＋ New” to add a rod, reel, line, hooks or lures.')); box.append(e); }
  list.forEach(function(it){
    var ti=tinfo(it.type), card=el('div','item'), head=el('div','ihead');
    head.append(el('b','ititle',ti[3]+' '+(it.name||'—')),el('span','when mono',ti[2])); card.append(head);
    var m=[]; if(it.brand) m.push(it.brand); if(it.spec) m.push(it.spec); if(it.qty) m.push('×'+it.qty);
    if(m.length) card.append(el('div','meta',m.join(' · ')));
    var ub=(S.get('bites')||[]).filter(function(b){ return b.tk&&b.tk.indexOf(it.id)>=0; }), uf=0, ukg=0; ub.forEach(function(b){ uf+=C.bc(b); ukg+=b.rel?0:(+b.kg||0); });
    if(ub.length) card.append(el('div','meta',T('Αλιεύματα: ','Catches: ')+uf+(ukg?' · '+Math.round(ukg*10)/10+' kg':'')));
    if(it.notes) card.append(el('div','meta',it.notes));
    var acts=el('div','acts');
    acts.append(btn(T('Επεξεργασία','Edit'),'ghost',function(){ editing=JSON.parse(JSON.stringify(it)); render(); }),
      btn(T('Διαγραφή','Delete'),'ghost',function(){
        var go=function(){ del(it.id); render(); };
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
      qt=field(T('Ποσότητα','Quantity'),'number',it.qty), nt=field(T('Σημειώσεις','Notes'),'text',it.notes);
  ts.addEventListener('change',function(){ sp.i.placeholder=tinfo(ts.value)[4]; qt.l.hidden=!(ts.value==='hook'||ts.value==='lure'); });
  qt.i.min='0'; qt.i.inputMode='numeric'; qt.l.hidden=!(it.type==='hook'||it.type==='lure');
  f.append(nm.l,br.l,sp.l,qt.l,nt.l);
  var msg=el('p','note'); msg.setAttribute('role','status'); f.append(msg);
  var acts=el('div','acts');
  acts.append(btn(T('Αποθήκευση','Save'),'',function(){
    var name=nm.i.value.trim(); if(!name){ msg.textContent=T('Γράψε ένα όνομα.','Enter a name.'); nm.i.focus(); return; }
    var o={id:it.id||undefined,type:ts.value,name:name,brand:br.i.value.trim(),spec:sp.i.value.trim(),notes:nt.i.value.trim(),ts:it.ts||Date.now()};
    var q=parseInt(qt.i.value,10); if(!qt.l.hidden&&q>0) o.qty=q;
    put(o); editing=null; render();
  }),btn(T('Άκυρο','Cancel'),'ghost',function(){ editing=null; render(); }));
  f.append(acts); return f;
}
var picked=[];
function lastIds(){ var bs=(S.get('bites')||[]).filter(function(b){ return b.tk&&b.tk.length; }); if(!bs.length) return []; bs.sort(function(a,b){ return (b._u||0)-(a._u||0); }); var ex={}; load().forEach(function(x){ ex[x.id]=1; }); return bs[0].tk.filter(function(i){ return ex[i]; }); }
function mount(div,ids){
  if(!div) return; picked=(ids==='last'?lastIds():(ids||[]).slice());
  div.replaceChildren(); var all=load(), wrap=document.getElementById('bTackleWrap');
  if(wrap) wrap.hidden=!all.length;
  all.sort(function(a,b){ return TYPES.map(function(t){return t[0];}).indexOf(a.type)-TYPES.map(function(t){return t[0];}).indexOf(b.type)||(a.name||'').localeCompare(b.name||''); });
  all.forEach(function(it){ var b=el('button','',tinfo(it.type)[3]+' '+(it.name||'—')); b.type='button'; b.setAttribute('aria-pressed',String(picked.indexOf(it.id)>=0));
    b.addEventListener('click',function(){ var i=picked.indexOf(it.id); if(i>=0) picked.splice(i,1); else picked.push(it.id); b.setAttribute('aria-pressed',String(i<0)); }); div.append(b); });
}
function names(){ var m={}; load().forEach(function(x){ m[x.id]=tinfo(x.type)[3]+' '+(x.name||'—'); }); return m; }
window.PsaroTackle={all:load,mount:mount,sel:function(){ return picked.slice(); },names:names};
window.addEventListener('psaro-pview',function(e){ if(e.detail==='tackle'){ editing=null; render(); } });
S.on('tackle',function(){ if(!box.hidden&&!editing) render(); });
render();
})();
