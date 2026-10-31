/* BiteCast 4 · Χάρτης: η θέση σου, τα σημεία σου, τα ψάρια σου, νέο σημείο, πρόγνωση εδώ, πλοήγηση.
   Η έξοδος (ίχνος, ασφάλεια, άγκυρα, MOB) μένει σε μία μόνο υλοποίηση, της κλασικής, γιατί αφορά την ασφάλεια στη θάλασσα. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var root=null, map=null, layers={}, base=null, sea=null, me=null, meAcc=null, watch=null, gSpots=null, gFish=null;
var TILES={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
var cfg=Object.assign({base:'sat',sea:true,spots:true,fish:true,zones:true,depth:false,mpa:false,dams:B.prof()==='lake',wind:false},ls.get('psaro-v4-map',{}));
var DAMS=[
['Κούρης','Kouris',34.7278,32.9178,'check',110],['Ασπρόκρεμμος','Asprokremmos',34.7259,32.5543,'check',53],['Εύρετου','Evretou',34.9757,32.4727,'check',70],
['Κανναβιού','Kannaviou',34.9277,32.5878,'check',75],['Καλαβασός','Kalavasos',34.803972,33.260517,'check',60],['Λεύκαρα','Lefkara',34.8944,33.2956,'check',71],
['Διπόταμος','Dipotamos',34.851618,33.359274,'check',60],['Γερμασόγεια','Germasogeia',34.7439,33.0843,'check',49],['Άχνα','Achna',35.055321,33.814307,'seasonal',16],
['Κούκλια','Kouklia',35.1207,33.7606,'check',6],['Αρμίνου','Arminou',34.8752,32.7371,'check',45],['Πολεμίδια','Polemidia',34.7187,32.9888,'cr',45],
['Ταμασός','Tamasos',35.0167,33.2479,'check',34],['Μαυροκόλυμπος','Mavrokolympos',34.8565,32.4058,'closed',45],['Αργάκα','Argaka',35.0486,32.5022,'closed',41],
['Πώμος','Pomos',35.1449,32.5762,'check',38],['Αγία Μαρίνα','Agia Marina',35.1170,32.5410,'check',33],['Βυζακιά','Vyzakia',35.0615,33.0272,'check',37],
['Ξυλιάτος','Xyliatos',35.0089,33.0372,'closed',42],['Καλοπαναγιώτης','Kalopanagiotis',35.0061,32.8254,'closed',40],['Λύμπια','Lympia',34.97518,33.41907,'closed',12],['Κλήρου-Μαλούντα','Klirou-Malounta',35.0318,33.1727,'check',38],
['Σολέα','Solea',35.06836,32.90120,'check',0]
];
var DST={closed:[T('Κλειστό για ψάρεμα','Closed to fishing'),'poor'],seasonal:[T('Κλειστό 1 Ιαν – 30 Ιουν, μετά μόνο ελευθέρωση.','Closed 1 Jan – 30 Jun, then catch and release only.'),'fair'],cr:[T('Μόνο ελευθέρωση των ψαριών.','Catch and release only.'),'fair'],check:[T('Η άδεια ισχύει μόνο αν το φράγμα έχει δηλωθεί ανοιχτό. Επιβεβαίωσε.','Valid only if the reservoir is declared open. Please confirm.'),'fair']};
var ov={}, LV=null;
function nrm(x){ return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-zα-ω]/g,''); }
function saveCfg(){ ls.set('psaro-v4-map',cfg); }
function S(){ return B.store; }
var SPT=EN?['Rocks / reef','Sand','Wreck','Ledge / drop-off','Current / open water','Harbour / pier','Other']:['Βράχια / ύφαλος','Άμμος','Ναυάγιο','Ταμπλά / κατωφλι','Ρεύμα / ανοιχτά','Λιμάνι / μώλος','Άλλο'];

/* Leaflet φορτώνεται μόνο όταν ανοίξει ο χάρτης */
var lp=null;
function leaflet(){ if(window.L) return Promise.resolve(window.L); if(lp) return lp;
  lp=new Promise(function(res,rej){ var c=document.createElement('link'); c.rel='stylesheet'; c.href='../leaflet.css'; document.head.appendChild(c);
    var s=document.createElement('script'); s.src='../leaflet.js'; s.onload=function(){ res(window.L); }; s.onerror=rej; document.head.appendChild(s);
    if(!window.ZONES){ var z=document.createElement('script'); z.src='../zones.js'; z.onload=function(){ if(map) drawOverlays(); }; document.head.appendChild(z); } }); return lp; }

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
  drawGear(); drawSea();
}
/* έξοδος: διαδρομή, άγκυρα, MOB */
var gSea=null;
function drawSea(){ if(!map) return; if(gSea) map.removeLayer(gSea); gSea=L.layerGroup().addTo(map);
  var t=B.trip&&B.trip.track(); if(t&&t.pts.length>1) L.polyline(t.pts.map(function(p){ return [p[0],p[1]]; }),{color:'#ff8a50',weight:4,opacity:.9}).addTo(gSea);
  var a=B.anchor&&B.anchor(); if(a){ L.circle([a.lat,a.lon],{radius:a.r,color:'#ffb020',weight:2,fillColor:'#ffb020',fillOpacity:.12,dashArray:'6 6'}).addTo(gSea); L.circleMarker([a.lat,a.lon],{radius:6,color:'#fff',weight:2,fillColor:'#ffb020',fillOpacity:1}).addTo(gSea); }
  var fx=(B.trip&&B.trip.fix())||B.lastPos();
  (B.mobs?B.mobs():[]).forEach(function(m){ L.marker([m.lat,m.lon],{icon:icon('mob','<b>MOB</b>')}).on('click',function(){ mobSheet(m); }).addTo(gSea); if(fx) L.polyline([[fx.lat,fx.lon],[m.lat,m.lon]],{color:'#ff3b30',weight:3,dashArray:'6 6'}).addTo(gSea); });
  var on=B.trip&&B.trip.active(); document.body.classList.toggle('maptrip',!!on); var tb=root&&root.querySelector('.tripbtn'); if(tb) tb.hidden=!!on; }
function mobSheet(m){ var fx=(B.trip&&B.trip.fix())||B.lastPos(), rows=[[T('Ώρα','Time'),new Date(m.t).toTimeString().slice(0,5)],[T('Συντεταγμένες','Coordinates'),m.lat.toFixed(5)+', '+m.lon.toFixed(5)]];
  if(fx){ var R=6371000, r=Math.PI/180, dLa=(m.lat-fx.lat)*r, dLo=(m.lon-fx.lon)*r, x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(fx.lat*r)*Math.cos(m.lat*r)*Math.sin(dLo/2)*Math.sin(dLo/2), d=2*R*Math.asin(Math.min(1,Math.sqrt(x)));
    var y=Math.sin(dLo)*Math.cos(m.lat*r), xx=Math.cos(fx.lat*r)*Math.sin(m.lat*r)-Math.sin(fx.lat*r)*Math.cos(m.lat*r)*Math.cos(dLo), br=(Math.atan2(y,xx)/r+360)%360; rows.push([T('Απόσταση','Distance'),d<1000?Math.round(d)+' m':B.num(d/1852,2)+' nm'],[T('Πορεία','Bearing'),Math.round(br)+'°']); }
  var sh=B.sheet({title:'MOB',body:h('div',null,h('div',{class:'card'},h('div',{class:'rows one'},rows.map(function(q){ return h('div',{class:'row'},h('span',{text:q[0]}),h('b',{text:q[1]})); }))),h('div',{class:'acts'},h('a',{class:'btn pri',href:'https://www.google.com/maps/dir/?api=1&destination='+m.lat+','+m.lon,target:'_blank',rel:'noopener',text:T('Πλοήγηση','Navigate')}),h('button',{class:'btn del',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ B.mobDel(m.t); sh.close(); }})))}); }
var gGear=null;
function drawGear(){ if(!map||!B.gearLayers) return; if(gGear) map.removeLayer(gGear); var show=ls.get('psaro-v4-gearshow',null);
  gGear=L.layerGroup(B.gearLayers(L,show?[show]:null)).addTo(map);
  if(show){ ls.set('psaro-v4-gearshow',null); var g=B.gearOf(show), pts=[]; if(g){ [g.set&&g.set.pts,g.haul&&g.haul.pts].forEach(function(a){ if(a) pts=pts.concat(a); }); } if(pts.length) map.fitBounds(L.latLngBounds(pts),{padding:[60,60],maxZoom:16}); } }
function esc(s){ return String(s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* ---------- επιπλέον στρώματα ---------- */
function drawOverlays(){
  if(!map) return;
  Object.keys(ov).forEach(function(k){ if(ov[k]){ map.removeLayer(ov[k]); ov[k]=null; } });
  var WM='https://ows.emodnet-bathymetry.eu/wms';
  if(cfg.depth){ ov.depth=L.layerGroup([L.tileLayer.wms(WM,{layers:'emodnet:mean_multicolour',format:'image/png',transparent:true,opacity:.55,version:'1.3.0',attribution:'EMODnet Bathymetry'}),L.tileLayer.wms(WM,{layers:'emodnet:contours',format:'image/png',transparent:true,version:'1.3.0'})]).addTo(map); }
  if(cfg.mpa){ ov.mpa=L.tileLayer.wms('https://ows.emodnet-humanactivities.eu/wms',{layers:'nationallydesignatedareas',format:'image/png',transparent:true,opacity:.6,version:'1.3.0',attribution:'EMODnet Human Activities'}).addTo(map); }
  if(cfg.zones&&window.ZONES){ ov.zones=L.layerGroup(); window.ZONES.forEach(function(z){ L.polygon(z.p,{color:'#ff3b30',weight:2,fillColor:'#ff3b30',fillOpacity:.18}).on('click',function(){ B.sheet({title:z.n,body:h('div',null,h('p',{class:'p',text:z.d||''}),h('p',{class:'foot',text:T('Περιοχή όπου απαγορεύεται η αλιεία. Πηγή: Τμήμα Αλιείας. Επιβεβαίωνε πάντα την ισχύουσα νομοθεσία.','Area where fishing is prohibited. Source: Department of Fisheries. Always check the current regulations.')}))}); }).addTo(ov.zones); }); ov.zones.addTo(map); }
  if(cfg.dams){ ov.dams=L.layerGroup().addTo(map); var put=function(){ if(!ov.dams) return; ov.dams.clearLayers(); DAMS.forEach(function(d){ var lv=null; if(LV&&LV.dams) for(var n in LV.dams){ if(nrm(n)===nrm(d[0])) lv=LV.dams[n]; }
      L.marker([d[2],d[3]],{icon:icon('dam '+(DST[d[4]]||DST.check)[1],'<b>'+(lv?Math.round(lv.pct)+'%':'')+'</b><i>'+esc(EN?d[1]:d[0])+'</i>')}).on('click',function(){ damSheet(d,lv); }).addTo(ov.dams); }); };
    put(); if(!LV) fetch('../dams_levels.json').then(function(r){ return r.json(); }).then(function(j){ LV=j; put(); }).catch(function(){}); }
  if(cfg.wind) wind();
}
function damSheet(d,lv){
  var st=DST[d[4]]||DST.check, rows=[];
  if(lv){ rows.push([T('Πληρότητα','Fullness'),Math.round(lv.pct)+'%'],[T('Νερό','Water'),B.num(lv.stor,2)+' / '+B.num(lv.cap,2)+T(' εκ. m³',' million m³')]); if(lv.lyPct!=null) rows.push([T('Πέρσι, ίδια μέρα','Same day last year'),Math.round(lv.lyPct)+'%']); }
  B.sheet({title:EN?d[1]:d[0],body:h('div',null,h('p',{class:'tag '+st[1],text:st[0]}),rows.length?h('div',{class:'card',style:{marginTop:'12px'}},h('div',{class:'rows one'},rows.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))):null,
    h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Πρόγνωση εδώ','Forecast here'),onclick:function(){ fcHere(EN?d[1]:d[0],d[2],d[3]); }})),
    h('p',{class:'foot',text:(LV&&LV.date?T('Στάθμη: ','Level: ')+LV.date+T(', Τμήμα Αναπτύξεως Υδάτων. ',', Water Development Department. '):'')+T('Η κατάσταση ανοιχτό/κλειστό αλλάζει· επιβεβαίωσε στο Τμήμα Αλιείας.','Open/closed status changes; confirm with the Department of Fisheries.')}))});
}
/* άνεμος τώρα σε πλέγμα 5×5 της περιοχής που βλέπεις (Open-Meteo) */
var wT=0;
function wind(){
  clearTimeout(wT); wT=setTimeout(function(){ if(!map||!cfg.wind) return; var b=map.getBounds(), la=[], lo=[];
    for(var i=0;i<5;i++) for(var j=0;j<5;j++){ la.push((b.getSouth()+(b.getNorth()-b.getSouth())*(i+0.5)/5).toFixed(3)); lo.push((b.getWest()+(b.getEast()-b.getWest())*(j+0.5)/5).toFixed(3)); }
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+la.join(',')+'&longitude='+lo.join(',')+'&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn').then(function(r){ return r.json(); }).then(function(j){
      if(!map||!cfg.wind) return; var a=Array.isArray(j)?j:[j]; if(ov.wind) map.removeLayer(ov.wind); ov.wind=L.layerGroup().addTo(map);
      a.forEach(function(p){ var c=p.current||{}; if(c.wind_speed_10m==null) return; var kn=c.wind_speed_10m, cls=kn>20?'poor':kn>14?'fair':'good';
        L.marker([p.latitude,p.longitude],{interactive:false,icon:icon('wind '+cls,'<i style="transform:rotate('+((c.wind_direction_10m+180)%360)+'deg)">↑</i><b>'+(window.PsaroUnits?window.PsaroUnits.wind(kn):Math.round(kn)+' kn')+'</b>')}).addTo(ov.wind); });
    }).catch(function(){}); },400);
}

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
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Επεξεργασία','Edit'),onclick:function(){ sh.close(true); spotForm(sp); }}),B.shareSpots?h('button',{class:'btn',type:'button',text:T('Στείλε σε φίλο','Send to a friend'),onclick:function(){ B.shareSpots([sp]); }}):null));
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
  [['sea',T('Ναυτικά σήματα (OpenSeaMap)','Sea marks (OpenSeaMap)')],['spots',T('Τα σημεία μου','My spots')],['fish',T('Τα ψάρια μου','My catches')],['wind',T('Άνεμος τώρα','Wind now')],['depth',T('Βάθη (EMODnet)','Depths (EMODnet)')],['zones',T('Απαγόρευση αλιείας','No-fishing areas')],['mpa',T('Προστατευόμενες περιοχές','Protected areas')],['dams',T('Φράγματα και πληρότητα','Reservoirs and levels')]].forEach(function(o){
    body.append(h('label',{class:'tg'},h('input',{type:'checkbox',checked:!!cfg[o[0]],onchange:function(ev){ cfg[o[0]]=ev.target.checked; saveCfg(); if(o[0]==='sea') drawBase(); else if(o[0]==='spots'||o[0]==='fish') drawData(); else drawOverlays(); }}),h('span',{text:o[1]}))); });
  if(B.shareSpots) body.append(h('button',{class:'btn full',type:'button',text:T('Στείλε όλα τα σημεία μου σε φίλο','Send all my spots to a friend'),onclick:function(){ B.shareSpots(S().raw('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'; })); }}));
  body.append(h('p',{class:'foot',text:T('Νέο σημείο: πάτα παρατεταμένα στον χάρτη. Τα βάθη είναι ενδεικτικά (EMODnet), όχι ναυτικός χάρτης. Ο κινούμενος άνεμος 48 ωρών είναι στην κλασική έκδοση.','New spot: long-press on the map. Depths are indicative (EMODnet), not a nautical chart. The animated 48-hour wind is in the classic version.')}));
  B.sheet({title:T('Στρώματα','Layers'),body:body});
}

/* ---------- σελίδα ---------- */
function mount(el){
  root=el; document.body.classList.add('mapon'); cfg=Object.assign({base:'sat',sea:true,spots:true,fish:true,zones:true,depth:false,mpa:false,dams:B.prof()==='lake',wind:false},ls.get('psaro-v4-map',{}));
  var box=h('div',{class:'mapbox',id:'v4map'});
  var bar=h('div',{class:'mapbar'},
    h('button',{class:'iconbtn',type:'button','aria-label':T('Στρώματα','Layers'),html:B.iconSvg('map'),onclick:layersSheet}),
    h('button',{class:'iconbtn',type:'button','aria-label':T('Η θέση μου','My position'),html:B.iconSvg('gps'),onclick:function(){ locate(true); }}),
    h('button',{class:'iconbtn',type:'button','aria-label':T('Νέο σημείο εδώ','New spot here'),html:B.iconSvg('star'),onclick:function(){ spotForm(null,map.getCenter()); }}),
    h('button',{class:'iconbtn gearbtn',type:'button','aria-label':T('Εργαλεία: παραγάδι, δίχτυ, ζεμπίλι','Gear: longline, net, pot'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/></svg>',onclick:function(){ if(B.gearPanel) B.gearPanel(); }}));
  var trip=h('button',{class:'tripbtn',type:'button',onclick:function(){ B.tripStart(); }},h('span',{text:T('Έναρξη εξόδου','Start a trip')}));
  var sea=h('div',{class:'seabar'},h('button',{class:'mobbtn',type:'button','aria-label':'MOB',text:'MOB',onclick:function(){ B.mob(); }}),B.voice&&B.voice.ok?h('button',{class:'iconbtn micmap',type:'button','aria-label':T('Φωνητική καταγραφή ψαριού','Voice catch log'),html:B.voice.MIC,onclick:function(){ B.voice.log(); }}):null,h('button',{class:'iconbtn ancbtn',type:'button','aria-label':T('Συναγερμός άγκυρας','Anchor alarm'),text:'⚓',onclick:function(){ if(B.anchor()) B.ask(T('Να σταματήσει ο συναγερμός άγκυρας;','Turn off the anchor alarm?'),T('Σταμάτημα','Turn off')).then(function(y){ if(y) B.anchorOff(); }); else B.anchorOn(); }}));
  var cross=h('div',{class:'cross','aria-hidden':'true'});
  el.replaceChildren(box,cross,bar,trip,sea);
  leaflet().then(function(){
    if(!root) return;
    var p=B.lastPos(), v=ls.get('psaro-v4-mapview',null);
    map=L.map(box,{zoomControl:false,attributionControl:true,tap:true}).setView(v?[v.lat,v.lon]:(p?[p.lat,p.lon]:[35.0,33.2]),v?v.z:(p?12:9));
    drawBase(); drawData(); drawOverlays(); applyPend(); locate(false);
    map.on('moveend',function(){ if(cfg.wind) wind(); var c=map.getCenter(); ls.set('psaro-v4-mapview',{lat:+c.lat.toFixed(5),lon:+c.lng.toFixed(5),z:map.getZoom()}); });
    map.on('contextmenu',function(e){ spotForm(null,e.latlng); });
    setTimeout(function(){ map.invalidateSize(); },60);
  }).catch(function(){ box.replaceChildren(h('div',{class:'card empty',style:{margin:'80px 16px'}},h('h3',{text:T('Ο χάρτης δεν φορτώθηκε','The map did not load')}),h('p',{text:T('Έλεγξε τη σύνδεση.','Check your connection.')}))); });
}
function unmount(){ document.body.classList.remove('mapon'); if(watch!=null){ try{ navigator.geolocation.clearWatch(watch); }catch(e){} watch=null; } if(map){ map.remove(); map=null; } me=meAcc=base=sea=gSpots=gFish=gGear=gSea=gRev=null; ov={}; document.body.classList.remove('maptrip'); root=null; }
/* μετάβαση στον χάρτη σε ένα σημείο (ψάρι, σημείο από φίλο) ή με μια διαδρομή εξόδου */
var pend=null, gRev=null;
function applyPend(){ if(!pend||!map) return false; var q=pend; pend=null;
  if(gRev){ map.removeLayer(gRev); gRev=null; }
  if(q.tr&&q.tr.length>1){ gRev=L.layerGroup([L.polyline(q.tr.map(function(p){ return [p[0],p[1]]; }),{color:'#ff8a50',weight:5,opacity:.95}),L.circleMarker(q.tr[0],{radius:7,color:'#fff',weight:3,fillColor:'#3ddc97',fillOpacity:1}),L.circleMarker(q.tr[q.tr.length-1],{radius:7,color:'#fff',weight:3,fillColor:'#ff4d4d',fillOpacity:1})]).addTo(map); map.fitBounds(L.latLngBounds(q.tr.map(function(p){ return [p[0],p[1]]; })),{padding:[40,40]}); }
  else { map.setView([q.lat,q.lon],q.z||15); gRev=L.layerGroup([L.circleMarker([q.lat,q.lon],{radius:11,color:'#E4572E',weight:3,fillOpacity:.15})]).addTo(map); }
  return true; }
B.mapGo=function(lat,lon,z,tr){ pend={lat:lat,lon:lon,z:z,tr:tr}; if(map&&root) applyPend(); else location.hash='#map'; };

B.view('map',{title:T('Χάρτης','Map'),mount:mount,unmount:unmount,resume:function(){ if(map){ map.invalidateSize(); drawData(); } }});
B.on('store',function(k){ if(map&&/^psaro-(bites|spots|gear)$/.test(k)) drawData(); });
B.on('gear-pos',function(){ if(map) drawGear(); });
['track','anchor','mob','trip'].forEach(function(n){ B.on(n,function(){ if(map) drawSea(); }); });
})();
