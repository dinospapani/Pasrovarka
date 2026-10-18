/* Φράγματα της Κύπρου (Δημοκρατία της Κύπρου). Θέσεις: κατά προσέγγιση, από τη Wikipedia («List of dams and reservoirs in Cyprus»).
   Όροι: «Conditions for recreational fishing licences in reservoirs» (2023, cyprusfaa.com, βάσει ΚΕΦ. 135). Η κατάσταση ανοιχτό/κλειστό αλλάζει: επιβεβαίωσε στο Τμήμα Αλιείας. */
(function(){
'use strict';
var C=window.PsaroCore, mb=document.querySelector('.mapbtns'); if(!C||!mb||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
/* st: closed = κλειστό, seasonal = εποχιακό, cr = μόνο ελευθέρωση, check = άγνωστη κατάσταση */
var D=[
['Κούρης','Kouris',34.7278,32.9178,'check'],['Ασπρόκρεμμος','Asprokremmos',34.7259,32.5543,'check'],['Εύρετου','Evretou',34.9757,32.4727,'check'],
['Κανναβιού','Kannaviou',34.9277,32.5878,'check'],['Καλαβασός','Kalavasos',34.803972,33.260517,'check'],['Λεύκαρα','Lefkara',34.8944,33.2956,'check'],
['Διπόταμος','Dipotamos',34.851618,33.359274,'check'],['Γερμασόγεια','Germasogeia',34.7439,33.0843,'check'],['Άχνα','Achna',35.055321,33.814307,'seasonal'],
['Κούκλια','Kouklia',35.1207,33.7606,'check'],['Αρμίνου','Arminou',34.8752,32.7371,'check'],['Πολεμίδια','Polemidia',34.7187,32.9888,'cr'],
['Ταμασός','Tamasos',35.0167,33.2479,'check'],['Μαυροκόλυμπος','Mavrokolympos',34.8565,32.4058,'closed'],['Αργάκα','Argaka',35.0486,32.5022,'closed'],
['Πώμος','Pomos',35.1449,32.5762,'check'],['Αγία Μαρίνα','Agia Marina',35.1170,32.5410,'check'],['Βυζακιά','Vyzakia',35.0615,33.0272,'check'],
['Ξυλιάτος','Xyliatos',35.0089,33.0372,'closed'],['Καλοπαναγιώτης','Kalopanagiotis',35.0061,32.8254,'closed'],['Λύμπια','Lympia',34.97518,33.41907,'closed']
];
var layer=L.layerGroup(), on=C.lsGet('psaro-dams',true)!==false;
var ST={
  closed:[T('Κλειστό για ψάρεμα','Closed to fishing'),'bad'],
  seasonal:[T('Κλειστό 1 Ιαν – 30 Ιουν. Μετά, μόνο ελευθέρωση των ψαριών ζωντανών.','Closed 1 Jan – 30 Jun. Otherwise catch and release only.'),'warn'],
  cr:[T('Μόνο ελευθέρωση: τα ψάρια δεν σκοτώνονται ούτε παίρνονται ζωντανά.','Catch and release only: fish must not be killed or taken away alive.'),'warn'],
  check:[T('Η άδεια ισχύει μόνο αν το φράγμα έχει δηλωθεί ανοιχτό. Επιβεβαίωσε.','The licence is valid only if the reservoir is declared open. Please confirm.'),'warn']
};
function pop(d){
  var s=ST[d[4]], w=document.createElement('div'); w.className='pop dampop';
  var b=document.createElement('b'); b.textContent=(EN?d[1]:d[0])+T(' · Φράγμα',' Dam'); w.appendChild(b);
  var st=document.createElement('div'); st.className='damst '+s[1]; st.textContent=s[0]; w.appendChild(st);
  [T('Μόνο από την όχθη. 1 καλάμι, 1 αγκίστρι.','Bank only. 1 rod, 1 hook.'),T('1 ώρα πριν την ανατολή έως 1 ώρα μετά τη δύση.','1 h before sunrise to 1 h after sunset.'),
   T('Λαβράκι, κυπρίνος, ζαντέρ: 2 ανά είδος (30 cm). Πέστροφα 5 (20 cm). Οξύρρυγχος 1 (70 cm). Σύνολο 10.','Bass, carp, zander: 2 each (30 cm). Trout 5 (20 cm). Sturgeon 1 (70 cm). Max 10 in total.')].forEach(function(t){ var m=document.createElement('div'); m.className='meta'; m.textContent=t; w.appendChild(m); });
  var n=document.createElement('div'); n.className='note'; n.textContent=T('Όροι αδειών 2023 (cyprusfaa.com). Θέση κατά προσέγγιση. Επιβεβαίωσε στο Τμήμα Αλιείας.','2023 licence conditions (cyprusfaa.com). Approximate position. Confirm with the Fisheries Department.'); w.appendChild(n);
  return w;
}
D.forEach(function(d){
  var cls='mk-dam '+(d[4]==='closed'?'bad':d[4]==='check'?'':'warn');
  var m=L.marker([d[2],d[3]],{icon:L.divIcon({className:'',html:'<div class="'+cls+'"><svg viewBox="0 0 24 24"><path d="M4 6h16l-2 9H6L4 6z"/><path d="M4 19c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5-1"/></svg></div>',iconSize:[28,28]}),title:EN?d[1]:d[0]});
  m.bindTooltip((EN?d[1]:d[0]),{direction:'right',offset:[12,0],className:'lbl'}); m.bindPopup(function(){ return pop(d); }); m.addTo(layer);
});
var b=document.createElement('button'); b.type='button'; b.id='bDams'; b.className='mbtn'; b.setAttribute('aria-pressed',String(on));
b.setAttribute('aria-label',T('Φράγματα','Dams')); b.title=T('Φράγματα και όροι ψαρέματος','Dams and fishing rules');
b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 5h16l-2 11H6L4 5z"/><path d="M3 20c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0"/></svg>';
var cfg=document.getElementById('bToolsCfg'); if(cfg) mb.insertBefore(b,cfg); else mb.appendChild(b);
if(on) layer.addTo(map);
b.addEventListener('click',function(){
  var v=!map.hasLayer(layer); if(v) layer.addTo(map); else { map.closePopup(); map.removeLayer(layer); }
  b.setAttribute('aria-pressed',String(v)); C.lsSet('psaro-dams',v);
});
window.PsaroDams={list:D};
})();
