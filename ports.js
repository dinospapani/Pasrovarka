/* Λιμάνια, μαρίνες και ράμπες καθέλκυσης πάνω στον χάρτη (OpenStreetMap μέσω Overpass).
   Φορτώνει μόνο ό,τι φαίνεται στην οθόνη (ζουμ 10 και πάνω), κρατά αντίγραφο στη συσκευή και δουλεύει χωρίς σύνδεση για περιοχές που έχεις ήδη δει.
   Τα δεδομένα είναι εθελοντικά και μπορεί να λείπουν ή να είναι παλιά. Έλεγξε επιτόπου. */
(function(){
'use strict';
var C=window.PsaroCore, mb=document.querySelector('.mapbtns'); if(!C||!mb||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='psaro-ports-on', TK='psaro-ports-tiles', ZMIN=10, TILE=0.2, DAYS=30;
var OVP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
var on=C.lsGet(KEY,true)!==false;
var layer=L.layerGroup(), tiles=C.lsGet(TK,{}), mem={}, shown={}, tm=null, warned=0;
if(!tiles||typeof tiles!=='object') tiles={};
var st=document.createElement('style');
st.textContent='.mk-port{width:30px;height:30px;border-radius:50%;background:#fff;border:2px solid #0b5a7a;color:#0b5a7a;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.35)}.mk-port.ramp{border-color:#d9441b;color:#d9441b}.mk-port svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.portpop .pbtns{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.portpop .pb{border:0;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;font-weight:700;background:var(--accent,#d9441b);color:var(--accent-ink,#fff);cursor:pointer;text-decoration:none}.portpop .pb.g{background:var(--line,#dde);color:var(--ink,#123)}.portpop .pk{font-size:12px;opacity:.75;margin-top:2px}';
document.head.appendChild(st);
var ICO={port:'<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M8 11h8"/><path d="M4 14c0 4 3.6 7 8 7s8-3 8-7"/></svg>',ramp:'<svg viewBox="0 0 24 24"><path d="M3 18c4 0 6-6 9-6s5 3 9 3"/><path d="M5 8h9l3 4"/><path d="M3 21c2-1 3.500-1 5.500 0s3.500 1 5.500 0 3.500-1 5.500 0"/></svg>'};
var KIND={marina:T('Μαρίνα','Marina'),port:T('Λιμάνι','Harbour'),ramp:T('Ράμπα καθέλκυσης','Boat ramp')};
function dist(a,b,c,d){ var R=6371,r=Math.PI/180,dl=(c-a)*r,dn=(d-b)*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.sqrt(x)); }
function key(i,j){ return i+'_'+j; }
function ask(q,i){
  if(i>=OVP.length) return Promise.reject(new Error('net'));
  var ctl=window.AbortController?new AbortController():null, t=setTimeout(function(){ if(ctl) ctl.abort(); },9000);
  return fetch(OVP[i],{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ctl?ctl.signal:undefined})
    .then(function(r){ clearTimeout(t); if(!r.ok) throw new Error('http'); return r.json(); }).catch(function(){ clearTimeout(t); return ask(q,i+1); });
}
function load(i,j){
  var k=key(i,j), c=tiles[k]; if(mem[k]) return mem[k];
  if(c&&Date.now()-c.t<DAYS*86400000) return Promise.resolve(c.list);
  var s=(i*TILE).toFixed(3), w=(j*TILE).toFixed(3), n=((i+1)*TILE).toFixed(3), e=((j+1)*TILE).toFixed(3), bb='('+s+','+w+','+n+','+e+')';
  var q='[out:json][timeout:20];(nwr["leisure"="marina"]'+bb+';nwr["harbour"="yes"]'+bb+';nwr["leisure"="slipway"]'+bb+';nwr["seamark:type"~"^(harbour|harbour_basin)$"]'+bb+';);out center tags 200;';
  mem[k]=ask(q,0).then(function(j2){
    var out=[], seen={};
    (j2.elements||[]).forEach(function(x){
      var la=x.lat!=null?x.lat:(x.center&&x.center.lat), lo=x.lon!=null?x.lon:(x.center&&x.center.lon); if(la==null||lo==null) return;
      var tg=x.tags||{}, nm=tg['name:el']||tg.name||tg['name:en']||tg['seamark:name']||'';
      var kind=tg.leisure==='slipway'?'ramp':tg.leisure==='marina'?'marina':'port';
      var dk=(nm||kind)+'|'+la.toFixed(3)+'|'+lo.toFixed(3); if(seen[dk]) return; seen[dk]=1;
      out.push({n:nm,la:+la.toFixed(5),lo:+lo.toFixed(5),k:kind});
    });
    tiles[k]={t:Date.now(),list:out};
    var ks=Object.keys(tiles); if(ks.length>60){ ks.sort(function(a,b){ return tiles[a].t-tiles[b].t; }); ks.slice(0,ks.length-60).forEach(function(x){ delete tiles[x]; }); }
    C.lsSet(TK,tiles); delete mem[k]; return out;
  },function(err){ delete mem[k]; if(c) return c.list; throw err; });
  return mem[k];
}
function pop(p){
  var w=document.createElement('div'); w.className='pop portpop';
  var b=document.createElement('b'); b.textContent=p.n||KIND[p.k]; w.appendChild(b);
  var k=document.createElement('div'); k.className='pk'; var me=C.getCond&&C.getCond();
  k.textContent=KIND[p.k]+(me&&me.lat!=null?' · '+(Math.round(dist(me.lat,me.lon,p.la,p.lo)*10)/10)+' km':''); w.appendChild(k);
  var r=document.createElement('div'); r.className='pbtns';
  var a=document.createElement('button'); a.type='button'; a.className='pb'; a.textContent=T('Λιμάνι αναχώρησης','Departure port');
  a.addEventListener('click',function(){ var sm=window.PsaroSmart; if(sm&&sm.setHome){ sm.setHome({lat:p.la,lon:p.lo,name:p.n||KIND[p.k]}); map.closePopup(); C.toast(T('Λιμάνι: ','Port: ')+(p.n||KIND[p.k])); } });
  var d=document.createElement('a'); d.className='pb g'; d.target='_blank'; d.rel='noopener'; d.textContent=T('Οδηγίες','Directions'); d.href='https://www.google.com/maps/dir/?api=1&destination='+p.la+','+p.lo;
  r.append(a,d); w.appendChild(r); return w;
}
function add(p){
  var id=p.la+','+p.lo+(p.n||''); if(shown[id]) return; shown[id]=1;
  var m=L.marker([p.la,p.lo],{icon:L.divIcon({className:'',html:'<div class="mk-port'+(p.k==='ramp'?' ramp':'')+'">'+(p.k==='ramp'?ICO.ramp:ICO.port)+'</div>',iconSize:[30,30]}),title:p.n||KIND[p.k]});
  if(p.n) m.bindTooltip(p.n,{direction:'right',offset:[14,0],className:'lbl'});
  m.bindPopup(function(){ return pop(p); }); m.addTo(layer);
}
function refresh(){
  if(!on||!map.hasLayer(layer)) return;
  if(map.getZoom()<ZMIN) return;
  var b=map.getBounds(), i0=Math.floor(b.getSouth()/TILE), i1=Math.floor(b.getNorth()/TILE), j0=Math.floor(b.getWest()/TILE), j1=Math.floor(b.getEast()/TILE);
  if((i1-i0+1)*(j1-j0+1)>12) return;
  var jobs=[]; for(var i=i0;i<=i1;i++) for(var j=j0;j<=j1;j++) jobs.push(load(i,j).then(function(l){ l.forEach(add); },function(){ return 'x'; }));
  Promise.all(jobs).then(function(r){ if(r.indexOf('x')>=0&&Date.now()-warned>60000){ warned=Date.now(); C.toast(T('Δεν φορτώθηκαν λιμάνια. Χρειάζεται σύνδεση.','Ports did not load. Needs a connection.')); } });
}
var btn=document.createElement('button'); btn.type='button'; btn.id='bPorts'; btn.className='mbtn'; btn.setAttribute('aria-pressed',String(on));
btn.setAttribute('aria-label',T('Λιμάνια και ράμπες','Ports and ramps')); btn.title=T('Λιμάνια, μαρίνες και ράμπες καθέλκυσης','Ports, marinas and boat ramps');
btn.innerHTML=ICO.port; mb.appendChild(btn);
if(on) layer.addTo(map);
btn.addEventListener('click',function(){
  on=!map.hasLayer(layer); if(on){ layer.addTo(map); refresh(); if(map.getZoom()<ZMIN) C.toast(T('Κάνε ζουμ πιο κοντά για να φανούν τα λιμάνια.','Zoom in to see ports.')); } else { map.closePopup(); map.removeLayer(layer); }
  btn.setAttribute('aria-pressed',String(on)); C.lsSet(KEY,on);
});
map.on('moveend zoomend',function(){ clearTimeout(tm); tm=setTimeout(refresh,700); });
setTimeout(refresh,1500);
})();
