/* BiteCast 4 · Εργαλεία: παραγάδια, δίχτυα, ζεμπίλια. Ίδια δεδομένα με την κλασική (psaro-gear, bite.gear).
   Ρίψη (διαδρομή) → στη θάλασσα → ανέβασμα (διαδρομή). Τα ψάρια που καταγράφονται στο ανέβασμα συνδέονται με το εργαλείο.
   Η νομιμότητα του εργαλείου είναι ευθύνη του χρήστη. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var KEY='psaro-gear', sortK=ls.get('psaro-sort-gear','new');
var TYPES={ll:{el:'Παραγάδι',en:'Longline',pt:false,c:'#3aa0ff'},net:{el:'Δίχτυ',en:'Net',pt:false,c:'#35c9a7'},trap:{el:'Ζεμπίλι / παγίδα',en:'Trap / pot',pt:true,c:'#b98cff'}};
function tn(t){ var x=TYPES[t]||TYPES.net; return EN?x.en:x.el; }
function G(){ var g=ls.get(KEY,null); if(!g||!Array.isArray(g.items)) g={items:[],seq:{}}; if(!g.seq) g.seq={}; return g; }
function put(g){ ls.set(KEY,g); B.emit('store',KEY); watch(); }
function nm(it){ return it.name||tn(it.type); }
function R(x){ return Math.round(x*1e5)/1e5; }
function dist(a,b){ var r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)*Math.sin(dn/2); return 12742000*Math.asin(Math.min(1,Math.sqrt(x))); }
function len(p){ var m=0; for(var i=1;i<(p||[]).length;i++) m+=dist(p[i-1],p[i]); return m; }
function km(p){ var m=len(p); return m>20?B.num(m/1000,2)+' km':''; }
function dur(ms){ var m=Math.max(0,Math.round(ms/60000)), hh=Math.floor(m/60); return hh?hh+T(' ώρ. ',' h ')+B.pad(m%60)+T(' λ.',' min'):m+T(' λ.',' min'); }
function clock(ms){ var d=new Date(ms); return B.pad(d.getHours())+':'+B.pad(d.getMinutes()); }
function day(ms){ var d=new Date(ms); return B.dateShort(d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate())); }
function active(g){ return (g||G()).items.filter(function(i){ return i.state==='setting'||i.state==='hauling'; })[0]||null; }
function hauling(){ return G().items.filter(function(i){ return i.state==='hauling'; })[0]||null; }
function fishOf(it){ var n=0,kg=0; B.store.raw('bites').forEach(function(b){ if(b.gear===it.id&&!b.miss){ n+=Math.max(1,Math.floor(+b.cnt)||1); kg+=b.rel?0:(+b.kg||0); } }); return {n:n,kg:Math.round(kg*10)/10}; }
function state(it){ return it.state==='done'?T('Ολοκληρώθηκε','Completed'):it.state==='out'?T('Στη θάλασσα','At sea'):it.state==='setting'?T('Σε ρίψη','Setting'):T('Σε ανέβασμα','Hauling'); }
function soak(it){ var s=it.set||{}, hh=it.haul; return (s.ta&&hh&&hh.ta)?hh.ta-s.ta:0; }

/* ---------- θέση και καταγραφή διαδρομής ---------- */
function here(){ return new Promise(function(res){ if(!navigator.geolocation){ res(null); return; }
  navigator.geolocation.getCurrentPosition(function(p){ res([R(p.coords.latitude),R(p.coords.longitude)]); },function(){ res(null); },{enableHighAccuracy:true,timeout:15000,maximumAge:10000}); }); }
var wid=null, wl=null;
function watch(){
  var a=active();
  if(!a){ if(wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } if(wl){ try{ wl.release(); }catch(e){} wl=null; } return; }
  /* η οθόνη μένει αναμμένη όσο τρέχει ρίψη ή ανέβασμα (αλλιώς ο browser σταματά το GPS) */
  if(!wl&&navigator.wakeLock&&!document.hidden){ try{ navigator.wakeLock.request('screen').then(function(l){ wl=l; l.addEventListener('release',function(){ wl=null; }); }).catch(function(){}); }catch(e){} }
  if(wid!=null||!navigator.geolocation) return;
  wid=navigator.geolocation.watchPosition(function(p){
    var g=G(), it=active(g); if(!it) return; var c=p.coords; if(c.accuracy&&c.accuracy>60) return;
    var ph=it.state==='setting'?it.set:it.haul, pt=[R(c.latitude),R(c.longitude)], last=ph.pts[ph.pts.length-1];
    if(last){ var d=dist(last,pt); if(d<10||(d>3000&&Date.now()-(ph.lastT||0)<20000)) return; }
    ph.pts.push(pt); ph.lastT=Date.now(); if(ph.pts.length>1500) ph.pts=ph.pts.filter(function(_,i){ return i%2===0; });
    ls.set(KEY,g); B.emit('gear-pos');
  },function(){},{enableHighAccuracy:true,maximumAge:5000,timeout:30000});
}
document.addEventListener('visibilitychange',function(){ if(!document.hidden) watch(); });
setTimeout(watch,1500);

/* ---------- ενέργειες ---------- */
function newId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
function busy(){ if(active()){ B.toast(T('Τελείωσε πρώτα την τρέχουσα ρίψη ή ανέβασμα.','Finish the current set or haul first.')); return true; } return false; }
function startSet(type){ if(busy()) return; here().then(function(p){ if(!p){ B.toast(T('Δεν βρέθηκε θέση GPS. Δοκίμασε ξανά.','No GPS fix. Try again.')); return; }
  var g=G(); g.seq[type]=(g.seq[type]||0)+1; var pt=TYPES[type].pt;
  g.items.push({id:newId(),type:type,name:tn(type)+' '+g.seq[type],state:pt?'out':'setting',set:{a:p,ta:Date.now(),pts:[p],b:pt?p:null,tb:pt?Date.now():null},haul:null});
  put(g); B.toast(pt?T('Τοποθετήθηκε: ','Placed: ')+tn(type)+' '+g.seq[type]:T('Ρίψη: ','Setting: ')+tn(type)+' '+g.seq[type]); }); }
function haulNew(type){ if(busy()) return; here().then(function(p){ if(!p){ B.toast(T('Δεν βρέθηκε θέση GPS. Δοκίμασε ξανά.','No GPS fix. Try again.')); return; }
  var g=G(); g.seq[type]=(g.seq[type]||0)+1;
  g.items.push({id:newId(),type:type,name:tn(type)+' '+g.seq[type],state:'hauling',set:{a:null,ta:null,pts:[],b:null,tb:null,unknown:true},haul:{a:p,ta:Date.now(),pts:[p],b:null,tb:null}});
  put(g); B.toast(T('Ανέβασμα. Τα ψάρια που καταγράφεις θα συνδέονται με αυτό το εργαλείο.','Hauling. Catches you log are linked to this gear.')); }); }
function endSet(id){ here().then(function(p){ var g=G(), it=g.items.filter(function(x){ return x.id===id; })[0]; if(!it) return;
  var pts=it.set.pts; if(p){ var l=pts[pts.length-1]; if(!l||dist(l,p)>3) pts.push(p); it.set.b=p; } else it.set.b=pts[pts.length-1]||it.set.a;
  it.set.tb=Date.now(); it.state='out'; put(g); B.toast(T('Τέλος ρίψης: ','Set finished: ')+nm(it)); }); }
function startHaul(id){ if(busy()) return; here().then(function(p){ if(!p){ B.toast(T('Δεν βρέθηκε θέση GPS. Δοκίμασε ξανά.','No GPS fix. Try again.')); return; }
  var g=G(), it=g.items.filter(function(x){ return x.id===id; })[0]; if(!it) return; it.haul={a:p,ta:Date.now(),pts:[p],b:null,tb:null}; it.state='hauling'; put(g);
  B.toast(T('Ανέβασμα: ','Hauling: ')+nm(it)+T('. Τα ψάρια συνδέονται με αυτό.','. Catches are linked to it.')); }); }
function endHaul(id){ here().then(function(p){ var g=G(), it=g.items.filter(function(x){ return x.id===id; })[0]; if(!it) return;
  var pts=it.haul.pts; if(p){ var l=pts[pts.length-1]; if(!l||dist(l,p)>3) pts.push(p); it.haul.b=p; } else it.haul.b=pts[pts.length-1]||it.haul.a;
  it.haul.tb=Date.now(); it.state='done'; it.done=Date.now(); put(g); var f=fishOf(it); B.toast(nm(it)+': '+f.n+' '+T('ψάρια','catches')+(f.kg?', '+B.num(f.kg,1)+' kg':'')); }); }

/* για τη φόρμα ψαριού: σύνδεση με το εργαλείο που ανεβαίνει τώρα */
B.gearTag=function(rec){ var it=hauling(); if(!it||rec.miss||rec.gear) return rec; rec.gear=it.id; rec.gearName=nm(it); if(!rec.tech) rec.tech=tn(it.type); return rec; };
B.gearOf=function(id){ return G().items.filter(function(x){ return x.id===id; })[0]||null; };

/* ---------- πίνακας ενεργειών (από τον χάρτη) ---------- */
B.gearPanel=function(){
  var g=G(), a=active(g), body=h('div',{class:'bform'}), sh;
  body.append(h('p',{class:'warnbox',text:T('Δίχτυα και παραγάδια είναι συνήθως εργαλεία επαγγελματικής αλιείας. Η καταγραφή δεν νομιμοποιεί το εργαλείο: έλεγξε την ισχύουσα νομοθεσία.','Nets and longlines are usually commercial gear. Logging does not make the gear legal: check the regulations.')}));
  if(a){ var f=fishOf(a), ph=a.state==='setting'?a.set:a.haul;
    body.append(h('div',{class:'card gact'},h('b',{text:(a.state==='setting'?T('Ρίχνεις: ','Setting: '):T('Ανεβάζεις: ','Hauling: '))+nm(a)}),h('p',{class:'sub',text:[km(ph.pts)||'0 km',dur(Date.now()-(ph.ta||Date.now())),a.state==='hauling'?f.n+' '+T('ψάρια','catches'):''].filter(Boolean).join(' · ')}),
      h('div',{class:'acts'},a.state==='hauling'?h('button',{class:'btn',type:'button',text:T('+ Αλίευμα','+ Catch'),onclick:function(){ sh.close(true); B.biteForm(null,{gear:a}); }}):null,
        h('button',{class:'btn pri',type:'button',text:a.state==='setting'?T('Τέλος ρίψης','Finish set'):T('Τέλος ανεβάσματος','Finish haul'),onclick:function(){ sh.close(); if(a.state==='setting') endSet(a.id); else endHaul(a.id); }})))); }
  var out=g.items.filter(function(i){ return i.state==='out'; });
  if(out.length){ body.append(h('h3',{class:'listh',text:T('Στη θάλασσα','At sea')})); var l=h('div',{class:'list'});
    out.forEach(function(it){ l.append(h('div',{class:'li'},h('span',{class:'tx'},h('b',{text:nm(it)}),h('small',{text:T('μέσα ','in ')+dur(Date.now()-(it.set.ta||Date.now()))})),h('button',{class:'btn',type:'button',disabled:!!a,text:T('Ανέβασμα','Haul'),onclick:function(){ sh.close(); startHaul(it.id); }}))); });
    body.append(l); }
  if(!a){ body.append(h('h3',{class:'listh',text:T('Νέα ρίψη','New set')})); var g2=h('div',{class:'acts'}); Object.keys(TYPES).forEach(function(k){ g2.append(h('button',{class:'btn',type:'button',text:tn(k),onclick:function(){ sh.close(); startSet(k); }})); }); body.append(g2);
    body.append(h('h3',{class:'listh',text:T('Ανέβασμα χωρίς καταγραμμένη ρίψη','Haul without a recorded set')})); var g3=h('div',{class:'acts'}); Object.keys(TYPES).forEach(function(k){ g3.append(h('button',{class:'btn',type:'button',text:tn(k),onclick:function(){ sh.close(); haulNew(k); }})); }); body.append(g3); }
  body.append(h('p',{class:'foot',text:T('Όσο τρέχει ρίψη ή ανέβασμα, η οθόνη μένει αναμμένη για να καταγράφεται η διαδρομή.','While a set or haul runs, the screen stays on so the route is recorded.')}));
  sh=B.sheet({title:T('Εργαλεία','Gear'),body:body});
};

/* ---------- χάρτης: γραμμές εργαλείων ---------- */
B.gearLayers=function(L,onlyIds){
  var out=[], g=G();
  g.items.forEach(function(it){ if(onlyIds?onlyIds.indexOf(it.id)<0:it.state==='done') return;
    var c=(TYPES[it.type]||TYPES.net).c, s=it.set||{}, hh=it.haul;
    if(s.pts&&s.pts.length>1) out.push(L.polyline(s.pts,{color:c,weight:4,opacity:.9}));
    if(s.a) out.push(L.circleMarker(s.a,{radius:7,color:'#fff',weight:2,fillColor:'#2e9e5b',fillOpacity:1}).bindTooltip(nm(it)+' · '+T('ρίψη ','set ')+(s.ta?clock(s.ta):'')));
    if(s.b&&(!s.a||s.b[0]!==s.a[0]||s.b[1]!==s.a[1])) out.push(L.circleMarker(s.b,{radius:7,color:'#fff',weight:2,fillColor:'#d33',fillOpacity:1}).bindTooltip(nm(it)+' · '+T('τέλος ρίψης','end of set')));
    if(hh){ if(hh.pts&&hh.pts.length>1) out.push(L.polyline(hh.pts,{color:'#ffd23a',weight:4,opacity:.9,dashArray:'8 8'})); if(hh.a) out.push(L.circleMarker(hh.a,{radius:7,color:'#fff',weight:2,fillColor:'#ffd23a',fillOpacity:1}).bindTooltip(nm(it)+' · '+T('ανέβασμα ','haul ')+clock(hh.ta))); }
  });
  return out;
};

/* ---------- Ημερολόγιο › Εργαλεία ---------- */
B.gearLog=function(page,inRange){
  var g=G(), tOf=function(i){ return (i.set&&i.set.ta)||(i.haul&&i.haul.ta)||0; }, sH=function(i){ return soak(i)/3600000; };
  var items=g.items.filter(function(i){ var t=tOf(i); if(!t) return true; var d=new Date(t); return inRange(d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate())); }).sort(function(p,q){
    if(sortK==='old') return tOf(p)-tOf(q);
    if(sortK==='eff'){ var rp=sH(p)>0?fishOf(p).n/sH(p):-1, rq=sH(q)>0?fishOf(q).n/sH(q):-1; return (rq-rp)||(tOf(q)-tOf(p)); }
    if(sortK==='hrs') return (sH(q)-sH(p))||(tOf(q)-tOf(p));
    return tOf(q)-tOf(p); });
  if(!items.length){ page.append(h('div',{class:'card empty'},h('h3',{text:T('Κανένα εργαλείο σε αυτό το διάστημα','No gear in this period')}),h('p',{text:T('Παραγάδια, δίχτυα και ζεμπίλια καταγράφονται από τον χάρτη, με το κουμπί «Εργαλεία».','Longlines, nets and pots are logged from the map, with the “Gear” button.')}),h('a',{class:'btn pri',href:'#map',text:T('Άνοιγμα χάρτη','Open map')}))); return; }
  var tn_=0, tk=0, done=items.filter(function(i){ return i.state==='done'; }); done.forEach(function(i){ var f=fishOf(i); tn_+=f.n; tk+=f.kg; });
  var so=h('select',{class:'select','aria-label':T('Ταξινόμηση','Sort by')}); [['new',T('Νεότερα πρώτα','Newest first')],['old',T('Παλαιότερα πρώτα','Oldest first')],['eff',T('Καλύτερη απόδοση (ψάρια/ώρα)','Best catch rate (catches/hour)')],['hrs',T('Περισσότερες ώρες μέσα','Most hours in water')]].forEach(function(o){ so.append(h('option',{value:o[0],text:o[1]})); });
  so.value=sortK; so.addEventListener('change',function(){ sortK=so.value; ls.set('psaro-sort-gear',sortK); B.emit('store',KEY); });
  page.append(h('p',{class:'sum',text:items.length+' '+T(items.length===1?'εργαλείο':'εργαλεία','gear')+', '+tn_+' '+T('ψάρια','catches')+(tk?', '+B.num(tk,1)+' kg':'')+T(' (ολοκληρωμένα)',' (completed)')}),so);
  var l=h('div',{class:'list',style:{marginTop:'10px'}});
  items.forEach(function(it){ var f=fishOf(it), t=tOf(it), sk=soak(it);
    l.append(h('button',{class:'li triprow',type:'button',onclick:function(){ detail(it.id); }},h('span',{class:'tc'+(f.n?'':' z'),style:{background:(TYPES[it.type]||TYPES.net).c+'33',color:(TYPES[it.type]||TYPES.net).c},text:String(f.n)}),
      h('span',{class:'tx'},h('b',{text:nm(it)}),h('small',{text:[t?day(t):'',state(it),sk?T('μέσα ','soaked ')+dur(sk):'',f.kg?B.num(f.kg,1)+' kg':''].filter(Boolean).join(' · ')})),B.icon('chev'))); });
  page.append(l);
};
function detail(id){
  var it=B.gearOf(id); if(!it) return; var s=it.set||{}, hh=it.haul, f=fishOf(it), sk=soak(it), body=h('div',{class:'det'}), sh;
  var rows=[[T('Τύπος','Type'),tn(it.type)],[T('Κατάσταση','Status'),state(it)],[T('Ρίψη','Set'),s.ta?day(s.ta)+' '+clock(s.ta)+(s.tb?' → '+clock(s.tb):'')+(km(s.pts)?' · '+km(s.pts):''):T('Δεν καταγράφηκε','Not recorded')]];
  if(hh&&hh.ta) rows.push([T('Ανέβασμα','Haul'),day(hh.ta)+' '+clock(hh.ta)+(hh.tb?' → '+clock(hh.tb):'')+(km(hh.pts)?' · '+km(hh.pts):'')]);
  if(sk) rows.push([T('Χρόνος στη θάλασσα','Time in water'),dur(sk)]);
  rows.push([T('Ψάρια','Catches'),f.n+(f.kg?' · '+B.num(f.kg,1)+' kg':'')]);
  if(sk&&f.n) rows.push([T('Απόδοση','Catch rate'),B.num(f.n/(sk/3600000),1)+T(' ψάρια/ώρα',' catches/hour')]);
  body.append(h('div',{class:'card'},h('div',{class:'rows one'},rows.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  if(it.notes) body.append(h('div',{class:'card'},h('p',{class:'p',text:it.notes})));
  var bs=B.store.raw('bites').filter(function(b){ return b.gear===it.id&&!b.miss; });
  if(bs.length){ var l=h('div',{class:'list'}); bs.forEach(function(b){ l.append(h('button',{class:'li',type:'button',onclick:function(){ sh.close(true); if(B.biteDetail) B.biteDetail(b); }},h('span',{class:'tx'},h('b',{text:(b.species||'')+(+b.cnt>1?' ×'+b.cnt:'')}),h('small',{text:[b.time,+b.kg?b.kg+' kg':''].filter(Boolean).join(' · ')})))); }); body.append(h('h3',{class:'listh',text:T('Αλιεύματα','Catches')}),l); }
  body.append(h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('+ Αλίευμα','+ Catch'),onclick:function(){ sh.close(true); B.biteForm(null,{gear:it}); }}),h('a',{class:'btn',href:'#map',onclick:function(){ ls.set('psaro-v4-gearshow',it.id); sh.close(true); },text:T('Στον χάρτη','On the map')})),
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Επεξεργασία','Edit'),onclick:function(){ sh.close(true); edit(it.id); }}),h('button',{class:'btn del',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ B.ask(T('Να διαγραφεί «','Delete “')+nm(it)+T('»; Τα ψάρια του μένουν.','”? Its catches stay.'),T('Διαγραφή','Delete'),true).then(function(y){ if(!y) return; var g=G(); g.items=g.items.filter(function(x){ return x.id!==it.id; }); put(g); sh.close(); B.toast(T('Διαγράφηκε.','Deleted.')); }); }})));
  sh=B.sheet({title:nm(it),body:body});
}
function dtv(ms){ if(!ms) return ''; var d=new Date(ms); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate())+'T'+B.pad(d.getHours())+':'+B.pad(d.getMinutes()); }
function edit(id){
  var it=B.gearOf(id); if(!it) return;
  var nmI=h('input',{type:'text',maxlength:'40',value:it.name||'',placeholder:tn(it.type)}), ty=h('select',{class:'select'}); Object.keys(TYPES).forEach(function(k){ ty.append(h('option',{value:k,text:tn(k)})); }); ty.value=it.type;
  var st=h('input',{type:'datetime-local',value:dtv(it.set&&it.set.ta)}), ht=it.haul&&it.haul.ta?h('input',{type:'datetime-local',value:dtv(it.haul.ta)}):null, nt=h('textarea',{rows:'2',maxlength:'300'}); nt.value=it.notes||'';
  var err=h('p',{class:'err',role:'alert'});
  var f=h('form',{class:'bform',novalidate:true},h('label',{class:'fld'},h('span',{text:T('Όνομα','Name')}),nmI),h('label',{class:'fld'},h('span',{text:T('Τύπος','Type')}),ty),h('label',{class:'fld'},h('span',{text:T('Ώρα ρίψης','Set time')}),st),ht?h('label',{class:'fld'},h('span',{text:T('Ώρα ανεβάσματος','Haul time')}),ht):null,h('label',{class:'fld'},h('span',{text:T('Σημειώσεις','Notes')}),nt),err,h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση','Save')}));
  f.addEventListener('submit',function(ev){ ev.preventDefault(); var sv=st.value?Date.parse(st.value):0, hv=ht&&ht.value?Date.parse(ht.value):0;
    if(hv&&sv&&hv<sv){ err.textContent=T('Το ανέβασμα δεν μπορεί να είναι πριν τη ρίψη.','The haul cannot be before the set.'); return; }
    var g=G(), x=g.items.filter(function(i){ return i.id===id; })[0]; if(!x) return;
    var n=nmI.value.trim().slice(0,40); if(n) x.name=n; else delete x.name; x.type=ty.value;
    if(sv){ x.set=x.set||{}; x.set.ta=sv; delete x.set.unknown; } if(hv&&x.haul) x.haul.ta=hv;
    var tt=nt.value.trim().slice(0,300); if(tt) x.notes=tt; else delete x.notes;
    put(g); sh.close(); B.toast(T('Αποθηκεύτηκε.','Saved.')); });
  var sh=B.sheet({title:T('Επεξεργασία εργαλείου','Edit gear'),body:f});
}
})();
