/* «Σήμερα»: επιλογή τοποθεσίας για τον καιρό και τον δείκτη, όπως στην Πρόγνωση. Δεν αλλάζει τη θέση που καταγράφεται στα τσιμπήματα. */
(function(){
'use strict';
var C=window.PsaroCore, box=document.getElementById('liveBox'); if(!C||!box||!C.viewPlace) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var sel='gps', open=false;
var top=box.querySelector('.h2top'); if(!top) return;
var lab=top.querySelector('.label'), baseLabel=lab?lab.textContent:'';
var wrap=document.createElement('div'); wrap.id='tdLoc'; top.parentNode.insertBefore(wrap,top.nextSibling);
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function places(){ try{ return window.PsaroPlaces?PsaroPlaces.list():JSON.parse(localStorage.getItem('psaro-places')||'[]'); }catch(e){ return []; } }
function pick(p){ sel=p.gps?'gps':p.id; if(lab) lab.textContent=p.gps?baseLabel:T('Καιρός για: ','Weather for: ')+p.name; C.viewPlace(p); render(); }
function render(){
  wrap.replaceChildren();
  var chips=el('div','chips'); chips.style.marginTop='2px';
  var g=el('button','chip gpschip',T('Η θέση μου','My location')); g.type='button'; g.setAttribute('aria-pressed',String(sel==='gps')); g.addEventListener('click',function(){ pick({gps:true}); }); chips.append(g);
  places().forEach(function(p){ var b=el('button','chip',p.name); b.type='button'; b.setAttribute('aria-pressed',String(sel===p.id)); b.addEventListener('click',function(){ pick(p); }); chips.append(b); });
  var add=el('button','chip',open?T('✕ Κλείσιμο','✕ Close'):T('＋ Τοποθεσία','＋ Location')); add.type='button'; add.addEventListener('click',function(){ open=!open; render(); }); chips.append(add);
  wrap.append(chips);
  if(open){
    var s=el('div','plsearch'); var inp=el('input'); inp.type='search'; inp.maxLength=60; inp.placeholder=T('Αναζήτηση π.χ. Λεμεσός','Search e.g. Limassol'); inp.autocomplete='off';
    var go=el('button','btn',T('Αναζήτηση','Search')); go.type='button'; s.append(inp,go);
    var res=el('div','list'); res.style.marginTop='8px'; var sp=el('div','chips');
    var spots=(C.Store.get('spots')||[]).filter(function(x){ return typeof x.lat==='number'&&typeof x.lon==='number'; });
    if(spots.length){ var sb=el('button','btn ghost sm',T('📍 Από τα σημεία μου','📍 From my spots')); sb.type='button'; sb.style.marginTop='8px'; sb.addEventListener('click',function(){ sp.hidden=!sp.hidden; }); sp.hidden=true;
      spots.forEach(function(x){ var b=el('button','chip',x.name||T('Σημείο','Spot')); b.type='button'; b.addEventListener('click',function(){ choose(x.name||T('Σημείο','Spot'),x.lat,x.lon); }); sp.append(b); });
      wrap.append(s,sb,sp,res); } else wrap.append(s,res);
    var doSearch=function(){
      var q=inp.value.trim(); res.replaceChildren(); if(q.length<2) return; res.append(el('div','note',T('Αναζήτηση…','Searching…')));
      fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=6&format=json&language='+(EN?'en':'el')).then(function(r){ return r.json(); }).then(function(j){
        res.replaceChildren(); var rs=(j&&j.results)||[]; if(!rs.length){ res.append(el('div','note',T('Δεν βρέθηκε τοποθεσία.','No location found.'))); return; }
        rs.forEach(function(x){ var label=[x.name,x.admin1,x.country].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
          var it=el('button','item plres'); it.type='button'; it.append(el('b',null,x.name),el('span','meta',label)); it.addEventListener('click',function(){ choose(x.name,x.latitude,x.longitude); }); res.append(it); });
      }).catch(function(){ res.replaceChildren(el('div','note',T('Η αναζήτηση δεν δούλεψε. Έλεγξε τη σύνδεση.','Search failed. Check your connection.'))); });
    };
    go.addEventListener('click',doSearch); inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); doSearch(); } });
  }
}
function choose(name,lat,lon){
  var p=null; try{ p=window.PsaroPlaces?PsaroPlaces.add(name,lat,lon):null; }catch(e){}
  if(!p) p={id:'t'+Math.round(lat*100)+'_'+Math.round(lon*100),name:name,lat:lat,lon:lon};
  open=false; pick(p);
}
render();
try{ new MutationObserver(function(){ var t=document.getElementById('tab-today'); if(t&&!t.hidden&&!open) render(); }).observe(document.getElementById('tab-today'),{attributes:true,attributeFilter:['hidden']}); }catch(e){}
})();
