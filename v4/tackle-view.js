/* BiteCast 4 · Εξοπλισμός (#tackle) και αντίγραφο ασφαλείας. Ίδια μορφή με την κλασική (psaro-tackle). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls, root=null, q='', fType='all';
function S(){ return B.store; }
var TY=[['rod',T('Καλάμια','Rods'),T('Καλάμι','Rod')],['reel',T('Μουλινέδες','Reels'),T('Μουλινέ','Reel')],['line',T('Νήματα','Main lines'),T('Νήμα','Main line')],['leader',T('Πετονιές (leader)','Leaders'),T('Πετονιά','Leader')],['hook',T('Αγκίστρια','Hooks'),T('Αγκίστρι','Hook')],['lure',T('Ζόκες / τεχνητά','Jigs / lures'),T('Ζόκα / τεχνητό','Jig / lure')],['acc',T('Αξεσουάρ','Accessories'),T('Αξεσουάρ','Accessory')],
  ['gun',T('Ψαροντούφεκα','Spearguns'),T('Ψαροντούφεκο','Speargun')],['shaft',T('Ακόντια','Shafts'),T('Ακόντιο','Shaft')],['band',T('Λάστιχα','Bands'),T('Λάστιχο','Band')],['float',T('Σημαδούρες','Floats'),T('Σημαδούρα','Float')],['fins',T('Βατραχοπέδιλα','Fins'),T('Βατραχοπέδιλα','Fins')],['mask',T('Μάσκες','Masks'),T('Μάσκα','Mask')],['suit',T('Στολές','Wetsuits'),T('Στολή','Wetsuit')],['weights',T('Βάρη','Weights'),T('Βάρη','Weights')],['knife',T('Μαχαίρια','Knives'),T('Μαχαίρι','Knife')],['watch',T('Ρολόγια','Watches'),T('Ρολόι','Watch')],['set',T('Σετ','Sets'),T('Σετ','Set')],['other',T('Άλλα','Other'),T('Άλλο','Other')]];
function tyN(k,one){ for(var i=0;i<TY.length;i++) if(TY[i][0]===k) return TY[i][one?2:1]; return k; }
function items(){ return S().raw('tackle').filter(function(x){ return !x.deleted; }); }
function uses(id){ return S().raw('bites').filter(function(b){ return !b.miss&&b.tk&&b.tk.indexOf(id)>=0; }).reduce(function(s,b){ return s+Math.max(1,Math.floor(+b.cnt)||1); },0); }

function draw(){
  if(!root) return;
  var page=h('div',{class:'page'}), all=items();
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω στο Προφίλ','Back to Profile'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Εξοπλισμός','Tackle')})),
    h('button',{class:'iconbtn',type:'button','aria-label':T('Νέο κομμάτι','New item'),html:B.iconSvg('plus'),onclick:function(){ form(null); }})));
  var used={}; all.forEach(function(x){ used[x.type]=1; });
  var chips=h('div',{class:'chips'}); [['all',T('Όλα','All')]].concat(TY.filter(function(t){ return used[t[0]]; }).map(function(t){ return [t[0],t[1]]; })).forEach(function(c){ chips.append(h('button',{type:'button',class:'chip','aria-pressed':String(fType===c[0]),text:c[1],onclick:function(){ fType=c[0]; draw(); }})); });
  var qi=h('input',{type:'search',value:q,placeholder:T('Αναζήτηση','Search'),'aria-label':T('Αναζήτηση εξοπλισμού','Search tackle')});
  var box=h('div');
  qi.addEventListener('input',function(){ q=qi.value; fill(); });
  page.append(chips,h('div',{class:'search'},B.icon('search'),qi),box);
  function fill(){
    var ql=q.toLowerCase(), a=all.filter(function(x){ return (fType==='all'||x.type===fType)&&(!ql||[x.name,x.brand,x.spec,x.notes].join(' ').toLowerCase().indexOf(ql)>=0); });
    if(!all.length){ box.replaceChildren(h('div',{class:'card empty'},h('h3',{text:T('Δεν έχεις καταχωρίσει εξοπλισμό','No tackle yet')}),h('p',{text:T('Πρόσθεσε καλάμια, μουλινέ, τεχνητά ή ψαροντούφεκα. Μετά τα διαλέγεις σε κάθε ψάρι.','Add rods, reels, lures or spearguns. Then pick them on each catch.')}),h('button',{class:'btn pri',type:'button',text:T('Νέο κομμάτι','New item'),onclick:function(){ form(null); }}))); return; }
    var groups={}; a.forEach(function(x){ (groups[x.type||'other']=groups[x.type||'other']||[]).push(x); });
    var out=[]; TY.forEach(function(t){ var g=groups[t[0]]; if(!g) return; out.push(h('h3',{class:'listh',text:t[1]+' ('+g.length+')'}));
      var l=h('div',{class:'list'}); g.sort(function(x,y){ return String(x.name).localeCompare(String(y.name)); }).forEach(function(x){ var n=uses(x.id);
        l.append(h('button',{class:'li',type:'button',onclick:function(){ form(x); }},h('span',{class:'tx'},h('b',{text:x.name||''}),h('small',{text:[x.brand,x.spec,x.water==='sea'?T('θάλασσα','sea'):x.water==='fresh'?T('γλυκό νερό','fresh water'):''].filter(Boolean).join(' · ')||' '})),n?h('span',{class:'when',text:n+' '+T('ψάρια','catches')}):null,B.icon('chev'))); });
      out.push(l); });
    if(!out.length) out.push(h('p',{class:'sub',style:{margin:'12px 4px'},text:T('Δεν βρέθηκε κάτι.','Nothing found.')}));
    box.replaceChildren.apply(box,out);
  }
  fill();
  root.replaceChildren(page);
}
function form(it){
  var e=it||null, ty=h('select',{class:'select'}); TY.forEach(function(t){ ty.append(h('option',{value:t[0],text:t[2]})); }); ty.value=e?e.type||'other':(fType!=='all'?fType:(B.prof()==='spear'?'gun':'rod'));
  var nm=h('input',{type:'text',maxlength:'80',value:e?e.name||'':'',placeholder:T('π.χ. Shimano Vanquish','e.g. Shimano Vanquish')}), br=h('input',{type:'text',maxlength:'80',value:e?e.brand||'':''}), sp=h('input',{type:'text',maxlength:'120',value:e?e.spec||'':''}), nt=h('input',{type:'text',maxlength:'300',value:e?e.notes||'':''});
  var wa=h('select',{class:'select'}); [['',T('Θάλασσα και γλυκό νερό','Sea and fresh water')],['sea',T('Μόνο θάλασσα','Sea only')],['fresh',T('Μόνο γλυκό νερό (λίμνη)','Fresh water only (lake)')]].forEach(function(o){ wa.append(h('option',{value:o[0],text:o[1]})); }); wa.value=e&&e.water||'';
  var err=h('p',{class:'err',role:'alert'});
  var f=h('form',{class:'bform',novalidate:true},h('label',{class:'fld'},h('span',{text:T('Είδος','Kind')}),ty),h('label',{class:'fld'},h('span',{text:T('Όνομα','Name')}),nm),h('label',{class:'fld'},h('span',{text:T('Μάρκα / μοντέλο','Brand / model')}),br),
    h('label',{class:'fld'},h('span',{text:T('Χαρακτηριστικά','Specs')}),sp,h('small',{text:T('π.χ. 2,7 m · 20–50 g ή PE 1.5 · 150 m','e.g. 9 ft · 1–2 oz or PE 1.5 · 150 m')})),h('label',{class:'fld'},h('span',{text:T('Νερό','Water')}),wa),h('label',{class:'fld'},h('span',{text:T('Σημειώσεις','Notes')}),nt),
    err,h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση','Save')}),
    e?h('button',{class:'btn full del',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ B.ask(T('Να διαγραφεί «'+(e.name||'')+'»; Τα ψάρια μένουν.','Delete “'+(e.name||'')+'”? Catches stay.'),T('Διαγραφή','Delete'),true).then(function(y){ if(y){ S().remove('tackle',e.id); sh.close(); draw(); B.toast(T('Διαγράφηκε.','Deleted.')); } }); }}):null);
  f.addEventListener('submit',function(ev){ ev.preventDefault(); var name=nm.value.trim(); if(!name){ err.textContent=T('Γράψε όνομα.','Enter a name.'); nm.focus(); return; }
    var rec=Object.assign({},e||{},{type:ty.value,name:name,brand:br.value.trim(),spec:sp.value.trim(),notes:nt.value.trim(),ts:(e&&e.ts)||Date.now()}); if(wa.value) rec.water=wa.value; else delete rec.water;
    if(!e) rec.id='tk'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    S().save('tackle',rec); sh.close(); draw(); B.toast(T('Αποθηκεύτηκε.','Saved.')); });
  var sh=B.sheet({title:e?T('Επεξεργασία','Edit'):T('Νέο κομμάτι','New item'),body:f,focus:e?null:'input'});
}
B.view('tackle',{title:T('Εξοπλισμός','Tackle'),mount:function(el){ root=el; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});

/* ---------- αντίγραφο ασφαλείας (ίδια μορφή αρχείου με την κλασική) ---------- */
function b2u(bl){ return new Promise(function(res){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.readAsDataURL(bl); }); }
B.backup={
  exportAll:function(){
    var bites=S().raw('bites'), photos={}, keys=[]; bites.forEach(function(b){ S().phKeys(b).forEach(function(k){ keys.push(k); }); }); S().raw('tackle').forEach(function(t){ if(t.photo) keys.push('tk-'+t.id); });
    var p=Promise.resolve(); keys.forEach(function(k){ p=p.then(function(){ return S().Photos.get(k).then(function(bl){ if(bl) return b2u(bl).then(function(u){ photos[k]=u; }); }).catch(function(){}); }); });
    return p.then(function(){ var g=ls.get('psaro-gear',null);
      var data={app:'psarovarka',v:2,spots:S().raw('spots'),trips:S().raw('trips'),bites:bites,tackle:S().raw('tackle'),gear:g&&g.items?g.items:[],boat:ls.get('psaro-boat',null),photos:photos};
      var d=new Date(), name='psarovarka-'+d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate())+'.json';
      var a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),download:name}); document.body.append(a); a.click(); a.remove();
      ls.set('psaro-lastbackup',Date.now()); return keys.length; });
  },
  importFile:function(file){
    return file.text().then(function(t){ var d=JSON.parse(t), n=0;
      ['spots','trips','bites','tackle'].forEach(function(k){ (Array.isArray(d[k])?d[k]:[]).forEach(function(it){ if(it&&typeof it==='object'){ S().save(k,it); n++; } }); });
      if(Array.isArray(d.gear)&&d.gear.length){ var g=ls.get('psaro-gear',{})||{}, ex={}; g.items=Array.isArray(g.items)?g.items:[]; g.items.forEach(function(x){ ex[x.id]=1; }); d.gear.forEach(function(x){ if(x&&x.id&&!ex[x.id]){ g.items.push(x); n++; } }); ls.set('psaro-gear',g); }
      if(d.boat&&typeof d.boat==='object'){ ls.set('psaro-boat',d.boat); n++; }
      var ph=d.photos&&typeof d.photos==='object'?d.photos:{}, p=Promise.resolve();
      Object.keys(ph).forEach(function(id){ p=p.then(function(){ return fetch(ph[id]).then(function(r){ return r.blob(); }).then(function(bl){ return S().Photos.put(id,bl); }).catch(function(){}); }); });
      return p.then(function(){ return n; }); });
  }
};
})();
