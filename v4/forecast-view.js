/* BiteCast 4 · Πρόγνωση
   Μία κατάσταση (state) και μία συνάρτηση σχεδίασης. Ξαναζωγραφίζει μόνο όταν αλλάζει κάτι (τοποθεσία, δεδομένα, επιλογή),
   χωρίς επαναλαμβανόμενους ελέγχους. Το μοντέλο βαθμού είναι το ίδιο με την κλασική έκδοση (../forecast.js). */
(function(){
'use strict';
var B=window.BC, h=B.h, s=B.s, T=B.T, EN=B.EN, ls=B.ls, U=window.PsaroUnits, PF=window.PF;

/* ---------- κατάσταση ---------- */
var st={view:'today',day:null,hour:null,fc:null,t:0,err:'',loading:false,place:null,note:''};
var root=null;

/* ---------- τοποθεσίες (κοινές με την κλασική: psaro-places, psaro-fcsel) ---------- */
function saved(){ var a=ls.get('psaro-places',[]); return Array.isArray(a)?a:[]; }
function gpsPlace(){ var p=B.lastPos(); return p?{id:'gps',name:T('Η θέση μου','My location'),lat:p.lat,lon:p.lon,gps:true}:{id:'gps',name:T('Η θέση μου','My location'),gps:true}; }
function allPlaces(){ return [gpsPlace()].concat(saved()); }
function current(){ var id=ls.get('psaro-fcsel','gps'), a=allPlaces(); return a.filter(function(p){ return p.id===id; })[0]||a[0]; }
function pid(lat,lon){ return 'p'+Math.round(lat*100)+'_'+Math.round(lon*100); }
function select(id){ ls.set('psaro-fcsel',id); st.day=null; st.hour=null; st.view='today'; load(false); }
function addPlace(name,lat,lon){
  var a=saved(), id=pid(lat,lon);
  if(!a.some(function(p){ return p.id===id; })){ a.unshift({id:id,name:name,lat:+(+lat).toFixed(4),lon:+(+lon).toFixed(4),watch:true}); ls.set('psaro-places',a.slice(0,10)); }
  select(id);
}
function delPlace(id){ ls.set('psaro-places',saved().filter(function(p){ return p.id!==id; })); if(ls.get('psaro-fcsel','gps')===id) select('gps'); }

/* είδος-στόχος από «Τι να ψαρέψω» της κλασικής έκδοσης */
function spCfg(){ var n=ls.get('psaro-advsp',''); if(!n) return null; var e=(window.SPKB||[]).filter(function(k){ return k.n===n; })[0]; return e?{n:e.n,l:e.l,sst:e.sst}:{n:n}; }

/* διόρθωση κύματος από τις δικές σου παρατηρήσεις (ίδιος κανόνας με την κλασική, psaro-seaobs) */
function waveFactor(lat,lon){
  var a=ls.get('psaro-seaobs',[]); if(!Array.isArray(a)) return 1;
  var V={'-1':0.75,'0':1,'1':1.3}, now=Date.now(), sw=0, sv=0, n=0;
  a.forEach(function(o){ var dy=(lat-o.lat)*111.2, dx=(lon-o.lon)*111.2*Math.cos(lat*Math.PI/180); if(Math.sqrt(dx*dx+dy*dy)>15) return;
    var w=Math.pow(0.5,(now-o.t)/(180*86400000)); sw+=w; sv+=w*(V[String(o.f)]||1); n++; });
  if(n<2||!sw) return 1; var avg=sv/sw, f=1+(avg-1)*n/(n+2); return Math.max(0.6,Math.min(1.5,f));
}

/* ---------- φόρτωση ---------- */
var busy=null;
function load(force){
  var p=current(); st.place=p; st.err=''; st.note='';
  if(p.gps&&p.lat==null){ st.fc=null; st.loading=true; draw(); B.locate().then(function(pos){ if(pos) load(force); else { st.loading=false; st.err='nopos'; draw(); } }); return; }
  var sp=spCfg(), spk=sp?sp.n:'', cache=ls.get('psaro-fc7',null);
  var fresh=cache&&cache.id===p.id&&(cache.sp||'')===spk&&cache.fc&&Date.now()-cache.t<3600e3;
  if(cache&&cache.id===p.id&&cache.fc){ st.fc=cache.fc; st.t=cache.t; } else { st.fc=null; }
  if(fresh&&!force){ st.loading=false; draw(); return; }
  st.loading=true; draw();
  var my=busy={};
  var f=waveFactor(p.lat,p.lon), ff=Math.abs(f-1)<0.03?null:function(url,o){ return fetch(url,o).then(function(r){
    if(!/marine-api/.test(url)||!r.ok) return r;
    return r.json().then(function(j){ try{ j.hourly.wave_height=j.hourly.wave_height.map(function(v){ return typeof v==='number'?Math.round(v*f*100)/100:v; }); }catch(e){} return {ok:true,status:200,json:function(){ return Promise.resolve(j); }}; }); }); };
  PF.getForecast(p.lat,p.lon,ff,{days:7,sp:sp}).then(function(fc){
    if(busy!==my) return; ls.set('psaro-fc7',{id:p.id,sp:spk,t:Date.now(),fc:fc}); st.fc=fc; st.t=Date.now(); st.loading=false; draw();
  }).catch(function(){
    if(busy!==my) return; st.loading=false;
    if(st.fc) st.note=T('Δεν φορτώθηκε νέα πρόγνωση. Βλέπεις την τελευταία που αποθηκεύτηκε.','No new forecast. Showing the last saved one.');
    else st.err='net';
    draw();
  });
}

/* ---------- βοηθητικά ---------- */
function lvl(sc){ return sc>=70?'good':sc>=50?'fair':'poor'; }
function verdict(d){
  if(!d.safe) return d.why==='night'?T('Δεν μένει φως σήμερα','No daylight left today'):T('Δεν συνιστάται έξοδος','Not a day to go out');
  return d.best>=80?T('Εξαιρετική μέρα για ψάρεμα','Excellent day for fishing'):d.best>=70?T('Καλή μέρα για ψάρεμα','Good day for fishing'):d.best>=50?T('Μέτρια μέρα','Fair day'):T('Δύσκολη μέρα','Tough day');
}
function unsafeWhy(d){
  var w=d.wx||{}, r=[];
  if(w.windMax!=null&&w.windMax>14) r.push(T('άνεμος έως ','wind up to ')+U.wind(w.windMax));
  if(w.waveMax!=null&&w.waveMax>0.9&&B.prof()!=='lake') r.push(T('κύμα έως ','waves up to ')+U.wave(w.waveMax));
  if(w.gustMax!=null&&w.gustMax>24) r.push(T('ριπές έως ','gusts up to ')+U.wind(w.gustMax));
  if(w.code!=null&&w.code>=95) r.push(T('καταιγίδα','thunderstorm'));
  return r.join(', ');
}
function seaTag(hr){
  if(B.prof()==='lake'){ var wl=hr&&hr.wind; return wl==null?null:wl<=10?['good',T('Ήπιος άνεμος','Light wind')]:wl<=16?['fair',T('Μέτριος άνεμος','Moderate wind')]:['poor',T('Δυνατός άνεμος','Strong wind')]; }
  var w=hr&&hr.wave; if(w==null) return null;
  return w<=0.3?['good',T('Ήρεμη θάλασσα','Calm sea')]:w<=0.6?['good',T('Ήπια θάλασσα','Slight sea')]:w<=1?['fair',T('Λίγο κύμα','Some waves')]:w<=1.5?['poor',T('Κυματισμός','Rough')]:['poor',T('Ταραγμένη θάλασσα','Very rough')];
}
var DIRS=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dirTxt(d){ return d==null?'':DIRS[Math.round(d/45)%8]; }
function sky(c){ if(c==null) return ''; return c>=95?T('Καταιγίδα','Thunderstorm'):c>=80?T('Μπόρες','Showers'):c>=61?T('Βροχή','Rain'):c>=51?T('Ψιχάλα','Drizzle'):c>=45?T('Ομίχλη','Fog'):c>=3?T('Συννεφιά','Overcast'):c>=1?T('Λίγα σύννεφα','Partly cloudy'):T('Καθαρός','Clear'); }
function trendTxt(t){ return {fast:T('πέφτει απότομα','falling fast'),slow:T('πέφτει αργά','falling'),rise:T('ανεβαίνει','rising'),stable:T('σταθερή','steady')}[t]||''; }
function moonName(f){ var i=Math.floor(f*8+0.5)%8; return (EN?['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent']:['Νέα σελήνη','Αύξουσα ημισέληνος','Πρώτο τέταρτο','Αύξων αμφίκυρτος','Πανσέληνος','Φθίνων αμφίκυρτος','Τελευταίο τέταρτο','Φθίνουσα ημισέληνος'])[i]; }
function win(d){ return d.win?B.pad(d.win.s)+':00–'+B.pad((d.win.e+1)%24)+':00':''; }
function today(){ return st.fc&&st.fc.nowLocal?st.fc.nowLocal.slice(0,10):null; }
function nowHr(){ return st.fc&&st.fc.nowLocal?+st.fc.nowLocal.slice(11,13):new Date().getHours(); }
function dayOf(date){ var a=(st.fc&&st.fc.days)||[]; return a.filter(function(d){ return d.date===date; })[0]||a[0]; }
function hourOf(d,hr){ return (d.hours||[]).filter(function(x){ return x.hr===hr; })[0]||null; }
function val(p){ return p?[p[0],h('small',{text:p[1]})]:'–'; }
function ago(t){ var m=Math.round((Date.now()-t)/60000); return m<2?T('μόλις τώρα','just now'):m<60?T('πριν ','')+m+T(' λεπτά',' min ago'):T('πριν ','')+Math.round(m/60)+T(' ώρες',' h ago'); }

/* ---------- καμπύλη ημέρας (το κεντρικό στοιχείο) ---------- */
function curve(d,opt){
  opt=opt||{}; var W=opt.w||340, H=opt.h||120, hs=d.hours||[], pad=opt.mini?2:8;
  var svg=s('svg',{viewBox:'0 0 '+W+' '+H,class:opt.mini?'mini':'curve',preserveAspectRatio:'none','aria-hidden':'true'});
  if(!hs.length) return svg;
  var x=function(hr){ return pad+(W-2*pad)*(hr+0.5)/24; }, y=function(sc){ return H-pad-(H-2*pad-(opt.mini?2:14))*Math.max(0,Math.min(100,sc))/100; };
  var gid='g'+Math.random().toString(36).slice(2,7);
  var grad=s('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1},s('stop',{offset:'0','stop-color':'var(--sea)','stop-opacity':opt.mini?.55:.45}),s('stop',{offset:'1','stop-color':'var(--sea)','stop-opacity':0}));
  svg.appendChild(s('defs',null,grad));
  if(!opt.mini){
    /* νύχτα: πιο σκούρο φόντο πριν τα χαράματα και μετά το σούρουπο */
    var r=(d.rise||360)/60, st2=(d.set||1080)/60;
    svg.append(s('rect',{x:0,y:0,width:x(r-0.5),height:H,class:'night'}),s('rect',{x:x(st2-0.5),y:0,width:W-x(st2-0.5),height:H,class:'night'}));
    if(d.win) svg.appendChild(s('rect',{x:x(d.win.s)-(W-2*pad)/48,y:0,width:(d.win.e-d.win.s+1)*(W-2*pad)/24,height:H,class:'band',rx:8}));
  }
  /* ομαλή καμπύλη (Catmull-Rom) */
  var pts=hs.map(function(q){ return [x(q.hr),y(q.score)]; }), dd='M'+pts[0][0]+','+pts[0][1];
  for(var i=0;i<pts.length-1;i++){ var p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    dd+=' C'+(p1[0]+(p2[0]-p0[0])/6)+','+(p1[1]+(p2[1]-p0[1])/6)+' '+(p2[0]-(p3[0]-p1[0])/6)+','+(p2[1]-(p3[1]-p1[1])/6)+' '+p2[0]+','+p2[1]; }
  svg.append(s('path',{d:dd+' L'+pts[pts.length-1][0]+','+H+' L'+pts[0][0]+','+H+' Z',fill:'url(#'+gid+')'}),s('path',{d:dd,class:'line'}));
  if(!opt.mini){
    /* μη ασφαλείς ώρες: κόκκινη γραμμή στη βάση */
    hs.forEach(function(q){ if(!q.safe) svg.appendChild(s('rect',{x:x(q.hr)-(W-2*pad)/48,y:H-4,width:(W-2*pad)/24,height:4,class:'unsafe'})); });
    if(opt.now!=null) svg.appendChild(s('line',{x1:x(opt.now),x2:x(opt.now),y1:4,y2:H,class:'now'}));
    if(opt.sel!=null){ var q=hs.filter(function(z){ return z.hr===opt.sel; })[0]; if(q) svg.append(s('line',{x1:x(q.hr),x2:x(q.hr),y1:0,y2:H,class:'sel'}),s('circle',{cx:x(q.hr),cy:y(q.score),r:5.5,class:'dot'})); }
  }
  svg._x=function(px,w){ var hr=Math.round((px/w*W-pad)/((W-2*pad)/24)-0.5); return Math.max(0,Math.min(23,hr)); };
  return svg;
}

/* ---------- σελίδα ---------- */
function draw(){
  if(!root) return;
  var p=st.place||current(), fc=st.fc, td=today();
  var page=h('div',{class:'page fcpage'});
  var title=st.view==='day'&&fc?B.dayName(st.day,td):T('Πρόγνωση','Forecast');
  var top=h('div',{class:'top'});
  if(st.view==='day'){ var bk=h('button',{class:'iconbtn',type:'button','aria-label':T('Πίσω στις 7 ημέρες','Back to 7 days'),html:B.iconSvg('back'),onclick:function(){ st.view='week'; st.day=null; st.hour=null; draw(); }}); top.append(h('div',{style:{display:'flex',alignItems:'center',gap:'12px',minWidth:0}},bk,h('h1',{class:'lt',text:title}))); }
  else top.append(h('h1',{class:'lt',text:title}));
  var rf=h('button',{class:'iconbtn'+(st.loading&&fc?' spin':''),type:'button','aria-label':T('Ανανέωση πρόγνωσης','Refresh forecast'),html:B.iconSvg('refresh'),onclick:function(){ if(p.gps) B.locate(6000).then(function(){ load(true); }); else load(true); }});
  top.append(rf); page.append(top);
  var pl=h('button',{class:'place',type:'button','aria-label':T('Αλλαγή τοποθεσίας','Change location'),onclick:placeSheet},B.icon(p.gps?'gps':'pin'),h('b',{text:p.name}),h('i',{text:'▾'}));
  page.append(pl);
  if(navigator.onLine===false) page.append(h('div',{class:'offline',text:T('Χωρίς σύνδεση. Βλέπεις την τελευταία πρόγνωση που αποθηκεύτηκε.','Offline. Showing the last saved forecast.')}));
  if(st.view!=='day') page.append(B.seg([['today',T('Σήμερα','Today')],['week',T('7 ημέρες','7 days')]],st.view,function(v){ st.view=v; st.day=null; st.hour=null; draw(); },T('Όψη πρόγνωσης','Forecast view')));

  if(!fc){
    if(st.err==='nopos') page.append(emptyBox(T('Χρειάζεται τοποθεσία','A location is needed'),T('Επίτρεψε την πρόσβαση στη θέση σου ή διάλεξε μια τοποθεσία.','Allow location access or choose a place.'),T('Διάλεξε τοποθεσία','Choose a place'),placeSheet));
    else if(st.err==='net') page.append(emptyBox(T('Η πρόγνωση δεν φορτώθηκε','The forecast did not load'),T('Έλεγξε τη σύνδεση και δοκίμασε ξανά.','Check your connection and try again.'),T('Δοκίμασε ξανά','Try again'),function(){ load(true); }));
    else page.append(skeleton());
  } else if(st.view==='week') week(page,fc);
  else dayView(page,fc,st.view==='day'?dayOf(st.day):dayOf(td));

  if(st.note) page.append(h('p',{class:'foot',text:st.note}));
  if(fc) page.append(h('p',{class:'foot'},T('Ενημέρωση ','Updated ')+ago(st.t)+'. '+T('Καιρός και κύμα από ','Weather and waves from '),h('a',{href:'https://open-meteo.com',target:'_blank',rel:'noopener',text:'Open-Meteo'}),T('. Ενδεικτική πρόγνωση, όχι επίσημη.','. Indicative, not an official forecast.')));
  root.replaceChildren(page);
}
function emptyBox(t,p,btn,fn){ return h('div',{class:'card empty'},h('h3',{text:t}),h('p',{text:p}),h('button',{class:'btn pri',type:'button',text:btn,onclick:fn})); }
function skeleton(){ return h('div',{role:'status','aria-label':T('Φόρτωση πρόγνωσης','Loading forecast')},
  h('div',{class:'hero'},h('div',{class:'sk',style:{height:'22px',width:'60%',marginBottom:'12px'}}),h('div',{class:'sk',style:{height:'44px',width:'45%',marginBottom:'18px'}}),h('div',{class:'sk',style:{height:'120px'}})),
  h('div',{class:'card'},h('div',{class:'sk',style:{height:'150px'}}))); }

/* ---------- μία μέρα ---------- */
function dayView(page,fc,d){
  if(!d) return;
  var td=today(), isToday=d.date===td, nh=nowHr();
  var selH=st.hour!=null?st.hour:(isToday?nh:(d.win?d.win.s:12)), hr=hourOf(d,selH)||hourOf(d,12)||d.hours[0];
  /* κεντρικό: απόφαση, καλύτερη ώρα, καμπύλη της μέρας */
  var hero=h('section',{class:'hero lv-'+(d.safe?lvl(d.best):'poor'),'aria-label':T('Σύνοψη ημέρας','Day summary')});
  var tg=seaTag(isToday?hourOf(d,nh):(d.win?hourOf(d,d.win.s):hr));
  hero.append(h('div',{class:'hv'},h('h2',{text:verdict(d)}),d.safe?h('span',{class:'score',title:T('Δείκτης ψαρέματος','Fishing index'),text:String(d.best)}):null));
  if(d.safe&&d.win) hero.append(h('div',{class:'hw'},h('span',{text:T('Καλύτερη ώρα','Best time')}),h('b',{text:win(d)})));
  else if(!d.safe){ var why=unsafeWhy(d); if(why) hero.append(h('p',{class:'hwhy',text:why.charAt(0).toUpperCase()+why.slice(1)+'.'})); }
  /* σήμερα δεν βγαίνει: δείξε την επόμενη καλή μέρα */
  if(isToday&&(!d.safe||(d.best<50))){ var nx=(fc.days||[]).filter(function(x){ return x.date>d.date&&x.safe&&x.best>=60; })[0];
    if(nx) hero.append(h('button',{class:'next',type:'button',onclick:function(){ st.view='day'; st.day=nx.date; st.hour=null; draw(); try{ window.scrollTo(0,0); }catch(e){} }},
      h('span',{text:T('Επόμενη καλή μέρα','Next good day')}),h('b',{text:B.dayName(nx.date,td)+', '+win(nx)}),h('i',{class:'sc',text:String(nx.best)}))); }
  if(tg) hero.append(h('span',{class:'tag '+tg[0],text:tg[1]}));
  var cv=curve(d,{w:340,h:128,now:isToday?nh:null,sel:selH}), wrap=h('div',{class:'cwrap'});
  wrap.append(cv,h('div',{class:'axis'},['00','06','12','18','24'].map(function(t){ return h('span',{text:t}); })));
  /* σύρσιμο στην καμπύλη: δείχνει την ώρα */
  var pick=function(e){ var r=cv.getBoundingClientRect(), cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left; var hh=cv._x(cx,r.width); if(hh!==st.hour){ st.hour=hh; draw(); var nc=root.querySelector('.cwrap svg'); if(nc&&e.type!=='click') nc.dataset.drag='1'; } };
  cv.addEventListener('click',pick); cv.addEventListener('touchmove',function(e){ pick(e); },{passive:true});
  wrap.setAttribute('role','img'); wrap.setAttribute('aria-label',T('Δείκτης ψαρέματος ανά ώρα','Fishing index by hour'));
  hero.append(wrap);
  if(hr) hero.append(hourLine(hr,d));
  page.append(hero);

  /* συνθήκες για την επιλεγμένη ώρα */
  if(hr){
    var lake=B.prof()==='lake', rows=[
      [T('Άνεμος','Wind'),hr.wind!=null?[U.windP(hr.wind)[0]+' ',h('small',{text:U.windP(hr.wind)[1]+' '+dirTxt(hr.dir)})]:'–'],
      [T('Ριπές','Gusts'),val(U.windP(hr.gust))],
      lake?null:[T('Κύμα','Waves'),hr.wave!=null?[U.waveP(hr.wave)[0],h('small',{text:U.waveP(hr.wave)[1]+(hr.period?' · '+Math.round(hr.period)+' s':'')})]:'–'],
      lake?null:[T('Θάλασσα','Sea temp'),val(U.tempP(hr.sst))],
      [T('Πίεση','Pressure'),hr.pres!=null?[(U.pressP(hr.pres)[1]==='hPa'?String(Math.round(hr.pres)):U.pressP(hr.pres)[0]),h('small',{text:U.pressP(hr.pres)[1]+' '+({fast:'↓↓',slow:'↘',rise:'↗',stable:'→'}[hr.ptrend]||''),title:trendTxt(hr.ptrend)})]:'–'],
      [T('Αέρας','Air temp'),val(U.tempP(hr.temp))],
      [T('Βροχή','Rain'),hr.rain!=null?[String(Math.round(hr.rain)),h('small',{text:'%'})]:'–'],
      [T('Ουρανός','Sky'),sky(hr.code)||'–']
    ].filter(Boolean);
    var c=h('section',{class:'card'},h('h2',{text:(isToday&&selH===nh?T('Τώρα','Now'):T('Στις ','At ')+B.pad(selH)+':00')}));
    c.append(h('div',{class:'rows'},rows.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',null,r[1])); })));
    page.append(c);
  }

  /* γιατί αυτός ο βαθμός */
  var why2=reasons(d); if(why2.length) page.append(h('section',{class:'card'},h('h2',{text:T('Γιατί','Why')}),h('ul',{class:'why'},why2.map(function(r){ return h('li',{class:r[0]},r[1]); }))));

  /* ήλιος και σελήνη */
  var p=st.place||current(), sm=null; try{ sm=PF.sunMoon(d.date,p.lat,p.lon,fc.tz); }catch(e){}
  var ms=h('section',{class:'card'},h('h2',{text:T('Ήλιος και σελήνη','Sun and moon')}));
  var rr=[[T('Ανατολή','Sunrise'),B.hm(d.rise)],[T('Δύση','Sunset'),B.hm(d.set)],[T('Σελήνη','Moon'),moonName(d.f)],[T('Φωτισμός','Illumination'),Math.round(((1-Math.cos(2*Math.PI*d.f))/2)*100)+'%']];
  if(sm){ var mj=(sm.maj||[]).filter(function(m){ return m>=0&&m<1440; }).map(B.hm), mn=(sm.min||[]).filter(function(m){ return m>=0&&m<1440; }).map(B.hm);
    if(mj.length) rr.push([T('Κύριες περίοδοι','Major periods'),mj.join(', ')]); if(mn.length) rr.push([T('Δευτερεύουσες','Minor periods'),mn.join(', ')]); }
  ms.append(h('div',{class:'rows one'},rr.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); })));
  page.append(ms);
}
function hourLine(hr,d){
  var bits=[B.pad(hr.hr)+':00', T('δείκτης ','index ')+hr.score];
  if(hr.wind!=null) bits.push(U.wind(hr.wind)); if(hr.wave!=null&&B.prof()!=='lake') bits.push(U.wave(hr.wave));
  return h('p',{class:'hline'+(hr.safe?'':' unsafe')},bits.join(' · ')+(hr.safe?'':' · '+T('όχι ασφαλής ώρα','not a safe hour')));
}
/* τι βοηθά και τι δυσκολεύει, στις ώρες του καλύτερου παραθύρου */
function reasons(d){
  var hs=(d.hours||[]).filter(function(q){ return d.win?q.hr>=d.win.s&&q.hr<=d.win.e:true; }); if(!hs.length) return [];
  var av=function(k){ var a=hs.map(function(q){ return q[k]; }).filter(function(v){ return typeof v==='number'; }); return a.length?a.reduce(function(x,y){ return x+y; },0)/a.length:null; };
  var out=[], wd=av('wind'), wv=av('wave'), pf=B.prof();
  if(wd!=null) out.push(wd<=12?['up',T('Ήπιος άνεμος ('+U.wind(wd)+')','Light wind ('+U.wind(wd)+')')]:wd<=18?['mid',T('Μέτριος άνεμος ('+U.wind(wd)+')','Moderate wind ('+U.wind(wd)+')')]:['down',T('Δυνατός άνεμος ('+U.wind(wd)+')','Strong wind ('+U.wind(wd)+')')]);
  if(wv!=null&&pf!=='lake') out.push(wv<=(pf==='spear'?0.3:0.5)?['up',T('Χαμηλό κύμα ('+U.wave(wv)+')','Low waves ('+U.wave(wv)+')')]:wv<=1?['mid',T('Λίγο κύμα ('+U.wave(wv)+')','Some waves ('+U.wave(wv)+')')]:['down',T('Ψηλό κύμα ('+U.wave(wv)+')','High waves ('+U.wave(wv)+')')]);
  var tr=hs[0].ptrend; if(tr) out.push(tr==='fast'?['down',T('Η πίεση πέφτει απότομα','Pressure falling fast')]:tr==='rise'?['up',T('Η πίεση ανεβαίνει','Pressure rising')]:['up',T('Σταθερή πίεση','Steady pressure')]);
  if(d.win){ var s0=d.win.s*60, e0=(d.win.e+1)*60, near=function(m){ return m>=s0-60&&m<=e0+60; };
    if(near(d.rise)) out.push(['up',T('Χαράματα μέσα στο παράθυρο','Dawn falls in the window')]);
    if(near(d.set)) out.push(['up',T('Σούρουπο μέσα στο παράθυρο','Dusk falls in the window')]); }
  if(hs.some(function(q){ return q.code!=null&&q.code>=95; })) out.push(['down',T('Πιθανή καταιγίδα','Possible thunderstorm')]);
  return out;
}

/* ---------- 7 ημέρες ---------- */
function week(page,fc){
  var td=today(), list=h('div',{class:'list week'});
  (fc.days||[]).forEach(function(d){
    var lv=d.safe?lvl(d.best):'poor';
    var b=h('button',{class:'li wk lv-'+lv,type:'button',onclick:function(){ st.view='day'; st.day=d.date; st.hour=null; draw(); try{ window.scrollTo(0,0); }catch(e){} }});
    b.append(h('div',{class:'wd'},h('b',{text:B.dayName(d.date,td)}),h('small',{text:B.dateShort(d.date)})));
    b.append(h('div',{class:'wc'},curve(d,{w:120,h:34,mini:true})));
    var info=h('div',{class:'wi'});
    if(d.safe){ info.append(h('b',{class:'ws',text:String(d.best)}),h('small',{text:win(d)})); }
    else info.append(h('b',{class:'ws no',text:'—'}),h('small',{text:d.why==='night'?T('χωρίς φως','no light'):T('μη ασφαλής','unsafe')}));
    b.append(info,B.icon('chev'));
    list.append(b);
  });
  page.append(list);
  var best=(fc.days||[]).filter(function(d){ return d.safe; }).sort(function(a,b){ return b.best-a.best; })[0];
  if(best) page.append(h('p',{class:'foot',text:T('Η καλύτερη μέρα της εβδομάδας: ','Best day this week: ')+B.dayName(best.date,td).toLowerCase()+', '+win(best)+'.'}));
}

/* ---------- επιλογή τοποθεσίας ---------- */
function placeSheet(){
  var body=h('div'), cur=current(), sh;
  var q=h('input',{type:'search',placeholder:T('Αναζήτηση, π.χ. Λεμεσός','Search, e.g. Limassol'),'aria-label':T('Αναζήτηση τοποθεσίας','Search for a place'),enterkeyhint:'search',autocomplete:'off'});
  var res=h('div');
  body.append(h('div',{class:'search'},B.icon('search'),q),res);
  var tm=0; q.addEventListener('input',function(){ clearTimeout(tm); var v=q.value.trim(); if(v.length<2){ res.replaceChildren(); return; } tm=setTimeout(function(){ geo(v); },350); });
  function geo(v){
    res.replaceChildren(h('p',{class:'sub',style:{margin:'10px 4px'},text:T('Αναζήτηση…','Searching…')}));
    fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(v)+'&count=6&format=json&language='+(EN?'en':'el')).then(function(r){ return r.json(); }).then(function(j){
      if(q.value.trim()!==v) return; var a=(j&&j.results)||[];
      if(!a.length){ res.replaceChildren(h('p',{class:'sub',style:{margin:'10px 4px'},text:T('Δεν βρέθηκε τοποθεσία με αυτό το όνομα.','No place found with that name.')})); return; }
      var l=h('div',{class:'list',style:{marginTop:'8px'}});
      a.forEach(function(x){ var lab=[x.admin1,x.country].filter(Boolean).filter(function(v2,i,aa){ return aa.indexOf(v2)===i&&v2!==x.name; }).join(', ');
        l.append(h('button',{class:'li',type:'button',onclick:function(){ sh.close(); addPlace(x.name,x.latitude,x.longitude); }},h('span',{class:'ic'},B.icon('pin')),h('span',{class:'tx'},h('b',{text:x.name}),h('small',{text:lab})))); });
      res.replaceChildren(l);
    }).catch(function(){ res.replaceChildren(h('p',{class:'sub',style:{margin:'10px 4px'},text:T('Η αναζήτηση χρειάζεται σύνδεση.','Search needs a connection.')})); });
  }
  body.append(h('h3',{class:'listh',text:T('Οι τοποθεσίες σου','Your places')}));
  var l=h('div',{class:'list'});
  allPlaces().forEach(function(p){
    var row=h('div',{class:'li',style:{padding:0}});
    var pick=h('button',{class:'li',type:'button',style:{borderBottom:0,flex:1},onclick:function(){ sh.close(); select(p.id); }},h('span',{class:'ic'},B.icon(p.gps?'gps':'pin')),h('span',{class:'tx'},h('b',{text:p.name}),h('small',{text:p.gps?T('Ακολουθεί το κινητό σου','Follows your phone'):(+p.lat).toFixed(3)+', '+(+p.lon).toFixed(3)})),p.id===cur.id?B.icon('check'):null);
    if(p.id===cur.id) pick.lastChild.setAttribute('class','ck');
    row.append(pick);
    if(!p.gps) row.append(h('button',{class:'del',type:'button','aria-label':T('Διαγραφή ','Delete ')+p.name,html:B.iconSvg('trash'),onclick:function(){ B.ask(T('Διαγραφή της τοποθεσίας «'+p.name+'»;','Delete the place “'+p.name+'”?'),T('Διαγραφή','Delete'),true).then(function(y){ if(y){ delPlace(p.id); B.toast(T('Η τοποθεσία διαγράφηκε.','Place deleted.')); } }); }}));
    l.append(row);
  });
  body.append(l);
  var spots=B.records('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'&&typeof x.lon==='number'; });
  if(spots.length){
    body.append(h('h3',{class:'listh',text:T('Από τα σημεία σου','From your spots')}));
    var l2=h('div',{class:'list'});
    spots.slice(0,30).forEach(function(x){ l2.append(h('button',{class:'li',type:'button',onclick:function(){ sh.close(); addPlace(x.name||T('Σημείο','Spot'),x.lat,x.lon); }},h('span',{class:'ic'},B.icon('star')),h('span',{class:'tx'},h('b',{text:x.name||T('Σημείο','Spot')}),h('small',{text:x.type||''})))); });
    body.append(l2);
  }
  sh=B.sheet({title:T('Τοποθεσία','Location'),body:body});
}

/* ---------- σύνδεση με το κέλυφος ---------- */
B.view('forecast',{
  title:T('Πρόγνωση','Forecast'),
  mount:function(el){ root=el; st.view=st.view||'today'; load(false);
    /* η θέση: γρήγορα από την τελευταία γνωστή, μετά ανανέωση στο παρασκήνιο */
    var p=current(); if(p.gps){ var old=B.lastPos(); B.locate(8000).then(function(n){ if(!n) return; if(!old||Math.abs(n.lat-old.lat)+Math.abs(n.lon-old.lon)>0.02) load(true); }); } },
  unmount:function(){ root=null; },
  resume:function(){ if(st.t&&Date.now()-st.t>3600e3) load(true); else draw(); }
});
B.on('store',function(k){ if(!root) return; if(k==='psaro-fcsel'||k==='psaro-places'||k==='psaro-fprof'||k==='psaro-units'){ if(k==='psaro-units'&&U.reload) U.reload(); load(false); } });
window.addEventListener('online',function(){ if(root) load(true); });
window.addEventListener('offline',function(){ if(root) draw(); });
})();
