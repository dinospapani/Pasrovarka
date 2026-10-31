/* BiteCast 4 · Χάρτης: η θέση σου, τα σημεία σου, τα ψάρια σου, νέο σημείο, πρόγνωση εδώ, πλοήγηση.
   Η έξοδος (ίχνος, ασφάλεια, άγκυρα, MOB) μένει σε μία μόνο υλοποίηση, της κλασικής, γιατί αφορά την ασφάλεια στη θάλασσα. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var root=null, map=null, layers={}, base=null, sea=null, me=null, meAcc=null, watch=null, gSpots=null, gFish=null;
var TILES={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
var cfg=Object.assign({base:'sat',sea:true,spots:true,fish:true},ls.get('psaro-v4-map',{}));
function saveCfg(){ ls.set('psaro-v4-map',cfg); }
function S(){ return B.store; }
var SPT=EN?['Rocks / reef','Sand','Wreck','Ledge / drop-off','Current / open water','Harbour / pier','Other']:['Βράχια / ύφαλος','Άμμος','Ναυάγιο','Ταμπλά / κατωφλι','Ρεύμα / ανοιχτά','Λιμάνι / μώλος','Άλλο'];

/* Leaflet φορτώνεται μόνο όταν ανοίξει ο χάρτης */
var lp=null;
function leaflet(){ if(window.L) return Promise.resolve(window.L); if(lp) return lp;
  lp=new Promise(function(res,rej){ var c=document.createElement('link'); c.rel='stylesheet'; c.href='../leaflet.css'; document.head.appendChild(c);
    var s=document.createElement('script'); s.src='../leaflet.js'; s.onload=function(){ res(window.L); }; s.onerror=rej; document.head.appendChild(s); }); return lp; }

function icon(cls,html){ return L.divIcon({className:'mk '+cls,html:html||'',iconSize:null}); }
function drawBase(){ if(base) map.removeLayer(base); base=L.tileLayer(TILES[cfg.base],{maxZoom:19,maxNativeZoom:cfg.base==='sat'?18:19,attribution:cfg.base==='sat'?'Esri':'© OpenStreetMap'}).addTo(map); base.bringToBack();
  if(sea){ map.removeLayer(sea); sea=null; } if(cfg.sea) sea=L.tileLayer(TILES.sea,{maxZoom:19,maxNativeZoom:18,opacity:.9}).addTo(map); }
function drawData(){
  if(!map) return;
  if(gSpots) map.removeLayer(gSpots); if(gFish) map.removeLayer(gFish);
  gSpots=L.layerGroup(); gFish=L.layerGroup();
  if(cfg.spots) S().raw('spots').forEach(function(sp){ if(typeof sp.lat!=='number') return;
    L.marker([sp.lat,sp.lon],{icon:icon('spot','<i></i><b>'+esc(sp.name||'')+'</b>'),keyboard:true,title:sp.name||''}).on('click',function(){ spotSheet(sp); }).addTo(gSpots); });
  if(cfg.fish){ /* ψάρια στο ίδιο σημείο (±60 m): ένας δείκτης με αριθμό */
    var cells={}; S().raw('bites').forEach(function(b){ if(b.miss||typeof b.lat!=='number') return; var k=Math.round(b.lat*1800)+'_'+Math.round(b.lon*1800); (cells[k]=cells[k]||[]).push(b); });
    Object.keys(cells).forEach(function(k){ var a=cells[k], n=a.reduce(function(s,b){ return s+Math.max(1,Math.floor(+b.cnt)||1); },0), la=0, lo=0; a.forEach(function(b){ la+=b.lat; lo+=b.lon; });
      L.marker([la/a.length,lo/a.length],{icon:icon('fish'+(n>1?' many':''),n>1?'<b>'+n+'</b>':''),title:a.map(function(b){ return b.species; }).join(', ')}).on('click',function(){ fishSheet(a); }).addTo(gFish); }); }
  gFish.addTo(map); gSpots.addTo(map);
  drawGear();
}
var gGear=null;
function drawGear(){ if(!map||!B.gearLayers) return; if(gGear) map.removeLayer(gGear); var show=ls.get('psaro-v4-gearshow',null);
  gGear=L.layerGroup(B.gearLayers(L,show?[show]:null)).addTo(map);
  if(show){ ls.set('psaro-v4-gearshow',null); var g=B.gearOf(show), pts=[]; if(g){ [g.set&&g.set.pts,g.haul&&g.haul.pts].forEach(function(a){ if(a) pts=pts.concat(a); }); } if(pts.length) map.fitBounds(L.latLngBounds(pts),{padding:[60,60],maxZoom:16}); } }
function esc(s){ return String(s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* η θέση μου */
function locate(fly){
  if(!navigator.geolocation) return;
  if(watch==null) watch=navigator.geolocation.watchPosition(function(p){ var ll=[p.coords.latitude,p.coords.longitude];
    ls.set('psaro-v4-pos',{lat:+ll[0].toFixed(5),lon:+ll[1].toFixed(5),t:Date.now()});
    if(!me){ me=L.marker(ll,{icon:icon('me','<i></i>'),interactive:false,zIndexOffset:1000}).addTo(map); meAcc=L.circle(ll,{radius:p.coords.accuracy,className:'meacc',interactive:false}).addTo(map); }
    else { me.setLatLng(ll); meAcc.setLatLng(ll).setRadius(p.coords.accuracy); }
    if(fly){ map.setView(ll,Math.max(map.getZoom(),14)); fly=false; } },function(){ if(fly) B.toast(T('Δεν βρέθηκε η θέση σου.','Your position was not found.')); },{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
  else { var p=B.lastPos(); if(p&&fly) map.setView([p.lat,p.lon],Math.max(map.getZoom(),14)); }
}

/* ---------- φύλλα ---------- */
function fishSheet(a){
  if(a.length===1&&B.biteDetail){ B.biteDetail(a[0]); return; }
  var l=h('div',{class:'list'}); a.sort(function(x,y){ return (y.date+y.time).localeCompare(x.date+x.time); }).forEach(function(b){
    l.append(h('button',{class:'li',type:'button',onclick:function(){ sh.close(true); if(B.biteDetail) B.biteDetail(b); }},h('span',{class:'ic'},B.icon('fish')),h('span',{class:'tx'},h('b',{text:(b.species||'')+(+b.cnt>1?' ×'+b.cnt:'')}),h('small',{text:[B.dateShort(b.date)+(b.time?', '+b.time:''),+b.kg?b.kg+' kg':''].filter(Boolean).join(' · ')})))); });
  var sh=B.sheet({title:a.length+' '+T('ψάρια σε αυτό το σημείο','catches at this spot'),body:l});
}
function spotSheet(sp){
  var n=S().raw('bites').filter(function(b){ return !b.miss&&typeof b.lat==='number'&&Math.abs(b.lat-sp.lat)<0.0008&&Math.abs(b.lon-sp.lon)<0.001; }).length;
  var body=h('div',{class:'det'},h('div',{class:'card'},h('div',{class:'rows one'},[[T('Τύπος','Type'),sp.type||'–'],[T('Βάθος','Depth'),sp.depth!=null&&sp.depth!==''?sp.depth+' m':'–'],[T('Ψάρια εδώ','Catches here'),String(n)],[T('Συντεταγμένες','Coordinates'),sp.lat.toFixed(5)+', '+sp.lon.toFixed(5)]].map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  if(sp.notes) body.append(h('div',{class:'card'},h('p',{class:'p',text:sp.notes})));
  body.append(h('div',{class:'acts'},
    h('button',{class:'btn pri',type:'button',text:T('Πρόγνωση εδώ','Forecast here'),onclick:function(){ sh.close(true); fcHere(sp.name||T('Σημείο','Spot'),sp.lat,sp.lon); }}),
    h('a',{class:'btn',href:'https://www.google.com/maps/dir/?api=1&destination='+sp.lat+','+sp.lon,target:'_blank',rel:'noopener',text:T('Οδηγίες','Directions')})),
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Επεξεργασία','Edit'),onclick:function(){ sh.close(true); spotForm(sp); }})));
  var sh=B.sheet({title:(sp.name||T('Σημείο','Spot'))+(sp.priv?' 🔒':''),body:body});
}
function fcHere(name,lat,lon){ var a=ls.get('psaro-places',[])||[], id='p'+Math.round(lat*100)+'_'+Math.round(lon*100);
  if(!a.some(function(p){ return p.id===id; })){ a.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:true}); ls.set('psaro-places',a.slice(0,10)); }
  ls.set('psaro-fcsel',id); location.hash='#forecast'; }
function spotForm(sp,ll){
  var e=sp||null, nm=h('input',{type:'text',maxlength:'60',value:e?e.name||'':'',placeholder:T('π.χ. Ύφαλος Πωμού','e.g. Pomos reef')});
  var ty=h('select',{class:'select'}); SPT.forEach(function(t){ ty.append(h('option',{value:t,text:t})); }); if(e&&e.type) { if(SPT.indexOf(e.type)<0) ty.append(h('option',{value:e.type,text:e.type})); ty.value=e.type; }
  var dp=h('input',{type:'number',min:'0',max:'2000',step:'1',inputmode:'numeric',value:e&&e.depth!=null?e.depth:''}), nt=h('textarea',{rows:'2',maxlength:'400'}); nt.value=e?e.notes||'':'';
  var pv=h('input',{type:'checkbox',checked:!!(e&&e.priv)}), la=e?e.lat:ll.lat, lo=e?e.lon:ll.lng;
  var err=h('p',{class:'err',role:'alert'});
  var f=h('form',{class:'bform',novalidate:true},h('label',{class:'fld'},h('span',{text:T('Όνομα','Name')}),nm),h('label',{class:'fld'},h('span',{text:T('Τύπος','Type')}),ty),h('label',{class:'fld'},h('span',{text:T('Βάθος (m)','Depth (m)')}),dp),
    h('label',{class:'fld'},h('span',{text:T('Σημειώσεις','Notes')}),nt),h('label',{class:'tg'},pv,h('span',{text:T('Ιδιωτικό: δεν το βλέπουν οι φίλοι','Private: friends cannot see it')})),
    h('p',{class:'sub',text:la.toFixed(5)+', '+lo.toFixed(5)}),err,h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση σημείου','Save spot')}),
    e?h('button',{class:'btn full del',type:'button',text:T('Διαγραφή σημείου','Delete spot'),onclick:function(){ B.ask(T('Να διαγραφεί το σημείο «'+(e.name||'')+'»; Τα ψάρια μένουν.','Delete the spot “'+(e.name||'')+'”? Catches stay.'),T('Διαγραφή','Delete'),true).then(function(y){ if(y){ S().remove('spots',e.id); sh.close(); B.toast(T('Το σημείο διαγράφηκε.','Spot deleted.')); drawData(); } }); }}):null);
  f.addEventListener('submit',function(ev){ ev.preventDefault(); var name=nm.value.trim(); if(!name){ err.textContent=T('Γράψε όνομα.','Enter a name.'); nm.focus(); return; }
    var rec=Object.assign({},e||{},{name:name,type:ty.value,lat:+(+la).toFixed(6),lon:+(+lo).toFixed(6),depth:dp.value===''?null:+dp.value,notes:nt.value.trim()}); if(pv.checked) rec.priv=true; else delete rec.priv;
    S().save('spots',rec); sh.close(); drawData(); B.toast(e?T('Το σημείο ενημερώθηκε.','Spot updated.'):T('Το σημείο αποθηκεύτηκε.','Spot saved.')); });
  var sh=B.sheet({title:e?T('Επεξεργασία σημείου','Edit spot'):T('Νέο σημείο','New spot'),body:f,focus:e?null:'input'});
}
function layersSheet(){
  var body=h('div',{class:'bform'});
  body.append(h('div',{class:'fld'},h('span',{text:T('Χάρτης','Map')}),B.seg([['sat',T('Δορυφόρος','Satellite')],['osm',T('Δρόμοι','Streets')]],cfg.base,function(v){ cfg.base=v; saveCfg(); drawBase(); })));
  [['sea',T('Ναυτικά σήματα (OpenSeaMap)','Sea marks (OpenSeaMap)')],['spots',T('Τα σημεία μου','My spots')],['fish',T('Τα ψάρια μου','My catches')]].forEach(function(o){
    body.append(h('label',{class:'tg'},h('input',{type:'checkbox',checked:!!cfg[o[0]],onchange:function(ev){ cfg[o[0]]=ev.target.checked; saveCfg(); if(o[0]==='sea') drawBase(); else drawData(); }}),h('span',{text:o[1]}))); });
  body.append(h('p',{class:'foot',text:T('Νέο σημείο: πάτα παρατεταμένα στον χάρτη. Ο άνεμος, τα βάθη, οι ζώνες προστασίας και τα φράγματα είναι ακόμα στην κλασική έκδοση.','New spot: long-press on the map. Wind, depths, protected zones and reservoirs are still in the classic version.')}));
  B.sheet({title:T('Στρώματα','Layers'),body:body});
}

/* ---------- σελίδα ---------- */
function mount(el){
  root=el; document.body.classList.add('mapon');
  var box=h('div',{class:'mapbox',id:'v4map'});
  var bar=h('div',{class:'mapbar'},
    h('button',{class:'iconbtn',type:'button','aria-label':T('Στρώματα','Layers'),html:B.iconSvg('map'),onclick:layersSheet}),
    h('button',{class:'iconbtn',type:'button','aria-label':T('Η θέση μου','My position'),html:B.iconSvg('gps'),onclick:function(){ locate(true); }}),
    h('button',{class:'iconbtn',type:'button','aria-label':T('Νέο σημείο εδώ','New spot here'),html:B.iconSvg('star'),onclick:function(){ spotForm(null,map.getCenter()); }}),
    h('button',{class:'iconbtn gearbtn',type:'button','aria-label':T('Εργαλεία: παραγάδι, δίχτυ, ζεμπίλι','Gear: longline, net, pot'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/></svg>',onclick:function(){ if(B.gearPanel) B.gearPanel(); }}));
  var sf=ls.get('psaro-safe',{})||{}, on=!!sf.active;
  var trip=h('a',{class:'tripbtn'+(on?' on':''),href:B.classic(on?'?a=map':'?a=trip')},h('span',{text:on?T('Έξοδος σε εξέλιξη: άνοιγμα','Trip in progress: open'):T('Έναρξη εξόδου','Start a trip')}));
  var cross=h('div',{class:'cross','aria-hidden':'true'});
  el.replaceChildren(box,cross,bar,trip);
  leaflet().then(function(){
    if(!root) return;
    var p=B.lastPos(), v=ls.get('psaro-v4-mapview',null);
    map=L.map(box,{zoomControl:false,attributionControl:true,tap:true}).setView(v?[v.lat,v.lon]:(p?[p.lat,p.lon]:[35.0,33.2]),v?v.z:(p?12:9));
    drawBase(); drawData(); locate(false);
    map.on('moveend',function(){ var c=map.getCenter(); ls.set('psaro-v4-mapview',{lat:+c.lat.toFixed(5),lon:+c.lng.toFixed(5),z:map.getZoom()}); });
    map.on('contextmenu',function(e){ spotForm(null,e.latlng); });
    setTimeout(function(){ map.invalidateSize(); },60);
  }).catch(function(){ box.replaceChildren(h('div',{class:'card empty',style:{margin:'80px 16px'}},h('h3',{text:T('Ο χάρτης δεν φορτώθηκε','The map did not load')}),h('p',{text:T('Έλεγξε τη σύνδεση.','Check your connection.')}))); });
}
function unmount(){ document.body.classList.remove('mapon'); if(watch!=null){ try{ navigator.geolocation.clearWatch(watch); }catch(e){} watch=null; } if(map){ map.remove(); map=null; } me=meAcc=base=sea=gSpots=gFish=gGear=null; root=null; }
B.view('map',{title:T('Χάρτης','Map'),mount:mount,unmount:unmount,resume:function(){ if(map){ map.invalidateSize(); drawData(); } }});
B.on('store',function(k){ if(map&&/^psaro-(bites|spots|gear)$/.test(k)) drawData(); });
B.on('gear-pos',function(){ if(map) drawGear(); });
})();
