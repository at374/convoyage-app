/* Dated TPG 271 fare reference, limited to evidenced Swiss API stop identities. */
(function(root){
'use strict';
const SOURCE='https://tpg.ch/sites/default/files/2026-08/LIT_271_Grille_tarifaire_2026_0.pdf';
const STOPS=new Map([
 ['1402653',[46.368608,6.479809,'Thonon',10.30]],['1400018',[46.367902,6.471886,'Thonon',10.30]],
 ['1400397',[46.363209,6.462103,'Thonon',10.30]],['1400515',[46.360128,6.455752,'Thonon',10.30]],
 ['1400024',[46.352546,6.439789,'Thonon',10.30]],['1400839',[46.3441,6.415265,'Margencel',8.60]],
 ['1400026',[46.338159,6.403829,'Sciez',7.80]],['1400028',[46.335498,6.397766,'Sciez',7.80]],
 ['1400030',[46.334766,6.394433,'Sciez',7.80]],['1401093',[46.333011,6.385557,'Sciez',7.80]],
 ['1401095',[46.331888,6.37387,'Sciez',7.80]],['1400032',[46.32669,6.357395,'Sciez',7.80]],
 ['1400847',[46.318867,6.331012,'Massongy',7.10]],['1400036',[46.308257,6.310027,'Douvaine',6.60]],
 ['1400608',[46.306153,6.302499,'Douvaine',6.60]],['1400038',[46.304919,6.299337,'Douvaine',6.60]],
 ['1400606',[46.300941,6.285575,'Douvaine',6.60]],
 ['8587059',[46.211585,6.172378,'Genève',null]],['8592883',[46.202291,6.156011,'Genève',null]],
 ['8587061',[46.201862,6.152813,'Genève',null]]
]);
function pin(id,point){
 const stop=STOPS.get(id);if(!stop||typeof point?.lat!=='number'||typeof point?.lon!=='number'||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return null;
 const m=Math.hypot((point.lat-stop[0])*111195,(point.lon-stop[1])*111195*Math.cos(stop[0]*Math.PI/180));return m<=50?stop:null;
}
function reference(itinerary){
 if(!itinerary||itinerary.detailsIncomplete||!Array.isArray(itinerary.sections)||itinerary.sections.length!==1)return null;
 const leg=itinerary.sections[0];if(leg?.line!=='271'||leg.mode!=='B')return null;
 const a=pin(leg.fromId,leg.fromPoint),b=pin(leg.toId,leg.toPoint);if(!a||!b)return null;
 const french=a[2]==='Genève'?b:b[2]==='Genève'?a:null;
 if(!french||french[2]==='Genève'||!Number.isFinite(french[3]))return null;
 const instant=Date.parse(leg.departure||itinerary.departure);if(!Number.isFinite(instant))return null;
 const date=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 const day=date.year+'-'+date.month+'-'+date.day;if(day<'2026-11-07'||day>'2026-12-12')return null;
 return {line:'271',amount:french[3],currency:'EUR',source:SOURCE,product:'parcours',fareVerified:false,serviceConfirmed:false,stopMappingVerified:true};
}
const api={reference,SOURCE};if(typeof module==='object'&&module.exports)module.exports=api;root.CP271Fares=api;
})(typeof window!=='undefined'?window:globalThis);
