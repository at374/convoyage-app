'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../transport-ojp.js');
const wrap=inner=>'<siri:OJP xmlns:siri="http://www.siri.org.uk/siri" xmlns:ojp="http://www.vdv.de/ojp"><siri:OJPResponse><siri:ServiceDelivery><ojp:OJPLocationInformationDelivery>'+inner+'</ojp:OJPLocationInformationDelivery></siri:ServiceDelivery></siri:OJPResponse></siri:OJP>';
const geo='<ojp:GeoPosition><siri:Longitude>6.14245</siri:Longitude><siri:Latitude>46.21022</siri:Latitude></ojp:GeoPosition>';
const place=(ref,name='Genève')=>'<ojp:Location><ojp:Location><ojp:StopPlace><ojp:StopPlaceRef>'+ref+'</ojp:StopPlaceRef><ojp:StopPlaceName><ojp:Text xml:lang="fr">'+name+'</ojp:Text></ojp:StopPlaceName></ojp:StopPlace><ojp:LocationName><ojp:Text>'+name+'</ojp:Text></ojp:LocationName>'+geo+'</ojp:Location><ojp:Complete>true</ojp:Complete><ojp:Probability>0.9</ojp:Probability></ojp:Location>';
const point=(ref,name='Genève, quai 3')=>'<ojp:Location><ojp:Location><ojp:StopPoint><siri:StopPointRef>'+ref+'</siri:StopPointRef><ojp:StopPointName><ojp:Text>'+name+'</ojp:Text></ojp:StopPointName></ojp:StopPoint>'+geo+'</ojp:Location></ojp:Location>';

test('référence simple : le type lu dans la réponse est conservé, avec son espace de noms',()=>{
 const [g]=O.parseLocations(wrap(place('8501008')));
 assert.deepEqual([g.refType,g.ref,g.name,g.lat,g.lon,g.reason],['StopPlaceRef','8501008','Genève',46.21022,6.14245,null]);
 assert.match(O.placeRefXml(g),/<ojp:StopPlaceRef>8501008<\/ojp:StopPlaceRef>/);
 const [p]=O.parseLocations(wrap(point('8501008')));
 assert.equal(p.refType,'StopPointRef');
 // « siri » est l'espace de noms par défaut du document de requête : <StopPointRef> = siri:StopPointRef.
 assert.match(O.placeRefXml(p),/<StopPointRef>8501008<\/StopPointRef>/);
 assert.doesNotMatch(O.placeRefXml(p),/ojp:StopPointRef|StopPlaceRef/);
 assert.match(O.tripRequest(g,p,'2026-11-16T08:00:00Z'),/^<\?xml[^>]*>\n<OJP xmlns="http:\/\/www\.siri\.org\.uk\/siri" xmlns:ojp="http:\/\/www\.vdv\.de\/ojp" version="1\.0">/);
});
test('référence étendue (SLOID) : jamais de type déduit du nombre de segments',()=>{
 // Même identifiant à 4 ou 6 segments : seul l'élément de la réponse décide.
 for(const ref of ['ch:1:sloid:1008','ch:1:sloid:1008:3:4','ch:1:sloid:92321:0:1']){
  assert.equal(O.parseLocations(wrap(place(ref)))[0].refType,'StopPlaceRef',ref);
  assert.equal(O.parseLocations(wrap(point(ref)))[0].refType,'StopPointRef',ref);
  assert.match(O.placeRefXml({refType:'StopPlaceRef',ref,name:'X'}),new RegExp('<ojp:StopPlaceRef>'+ref+'</ojp:StopPlaceRef>'));
  assert.match(O.placeRefXml({refType:'StopPointRef',ref,name:'X'}),new RegExp('<StopPointRef>'+ref+'</StopPointRef>'));
 }
 // Une référence sans type n'en reçoit pas un d'après sa forme.
 assert.equal(O.placeRefXml({ref:'ch:1:sloid:1008:3:4',name:'X'}),null);
 assert.equal(O.placeRefXml({ref:'ch:1:sloid:1008',name:'X'}),null);
});
test('référence invalide : aucune demande de trajet construite',()=>{
 for(const ref of ['','85 01008','<x>','a&b','"8501008"','x'.repeat(121)]){
  assert.equal(O.validRef(ref),false,JSON.stringify(ref));
  assert.equal(O.placeRefXml({refType:'StopPlaceRef',ref,name:'X'}),null);
 }
 assert.equal(O.placeRefXml({refType:'StopPlaceRef',ref:8501008,name:'X'}),null,'référence non textuelle');
 assert.equal(O.placeRefXml({refType:'stopplaceref',ref:'8501008'}),null,'type approximatif refusé');
 assert.equal(O.placeRefXml({refType:'TopographicPlaceRef',ref:'8501008'}),null);
 assert.equal(O.placeRefXml(null),null);
 const ok={refType:'StopPlaceRef',ref:'8501008',name:'Genève'};
 assert.equal(O.tripRequest(ok,{refType:'StopPlaceRef',ref:'bad ref'},'2026-11-16T08:00:00Z'),null);
 assert.equal(O.tripRequest(ok,ok,'pas une date'),null);
 assert.equal(O.UNCONFIRMED,'Transport non confirmé');
});
test('référence ambiguë ou absente : signalée, jamais inventée',()=>{
 const both='<ojp:Location><ojp:Location><ojp:StopPlace><ojp:StopPlaceRef>8501008</ojp:StopPlaceRef></ojp:StopPlace><ojp:StopPoint><siri:StopPointRef>ch:1:sloid:1008:3:4</siri:StopPointRef></ojp:StopPoint></ojp:Location></ojp:Location>';
 const [a]=O.parseLocations(wrap(both));
 assert.deepEqual([a.refType,a.ref],[null,null]);assert.match(a.reason,/ambiguë/);assert.equal(O.placeRefXml(a),null);
 const none='<ojp:Location><ojp:Location><ojp:StopPlace><ojp:StopPlaceName><ojp:Text>Sans référence</ojp:Text></ojp:StopPlaceName></ojp:StopPlace></ojp:Location></ojp:Location>';
 const [n]=O.parseLocations(wrap(none));
 assert.equal(n.refType,null);assert.match(n.reason,/absent/);assert.equal(O.placeRefXml(n),null);
 const bad=O.parseLocations(wrap(place('85 01008')))[0];
 assert.equal(bad.reason,'référence invalide');assert.equal(O.placeRefXml(bad),null);
 assert.deepEqual(O.parseLocations(wrap('')),[]);
});
const tripXml='<ojp:TripResult><ojp:ResultId>ID-1</ojp:ResultId><ojp:Trip><ojp:TripId>ID-1</ojp:TripId><ojp:Duration>PT45M</ojp:Duration><ojp:StartTime>2026-11-16T08:12:00Z</ojp:StartTime><ojp:EndTime>2026-11-16T08:57:00Z</ojp:EndTime><ojp:Transfers>1</ojp:Transfers>'+
 '<ojp:TripLeg><ojp:LegId>1</ojp:LegId><ojp:TimedLeg><ojp:LegBoard><siri:StopPointRef>8501008</siri:StopPointRef><ojp:StopPointName><ojp:Text>Genève</ojp:Text></ojp:StopPointName><ojp:ServiceDeparture><ojp:TimetabledTime>2026-11-16T08:12:00Z</ojp:TimetabledTime></ojp:ServiceDeparture></ojp:LegBoard>'+
 '<ojp:LegAlight><siri:StopPointRef>8501037</siri:StopPointRef><ojp:StopPointName><ojp:Text>Morges</ojp:Text></ojp:StopPointName><ojp:ServiceArrival><ojp:TimetabledTime>2026-11-16T08:40:00Z</ojp:TimetabledTime></ojp:ServiceArrival></ojp:LegAlight>'+
 '<ojp:Service><ojp:Mode><ojp:PtMode>rail</ojp:PtMode></ojp:Mode><ojp:PublishedLineName><ojp:Text>IR90</ojp:Text></ojp:PublishedLineName><ojp:OperatorRef>ojp:11</ojp:OperatorRef></ojp:Service></ojp:TimedLeg></ojp:TripLeg>'+
 '<ojp:TripLeg><ojp:LegId>2</ojp:LegId><ojp:TransferLeg><ojp:TransferMode>walk</ojp:TransferMode></ojp:TransferLeg></ojp:TripLeg>'+
 '<ojp:TripLeg><ojp:LegId>3</ojp:LegId><ojp:TimedLeg><ojp:LegBoard><siri:StopPointRef>8501037</siri:StopPointRef><ojp:StopPointName><ojp:Text>Morges</ojp:Text></ojp:StopPointName><ojp:ServiceDeparture><ojp:TimetabledTime>2026-11-16T08:45:00Z</ojp:TimetabledTime></ojp:ServiceDeparture></ojp:LegBoard>'+
 '<ojp:LegAlight><siri:StopPointRef>8501120</siri:StopPointRef><ojp:StopPointName><ojp:Text>Lausanne</ojp:Text></ojp:StopPointName><ojp:ServiceArrival><ojp:TimetabledTime>2026-11-16T08:57:00Z</ojp:TimetabledTime></ojp:ServiceArrival></ojp:LegAlight>'+
 '<ojp:Service><ojp:Mode><ojp:PtMode>rail</ojp:PtMode></ojp:Mode><ojp:PublishedLineName><ojp:Text>RE33</ojp:Text></ojp:PublishedLineName></ojp:Service></ojp:TimedLeg></ojp:TripLeg></ojp:Trip></ojp:TripResult>';
const fare=(from,to,price,extra='')=>'<ojp:FareResult><ojp:TripFareResult><ojp:FromTripLegIdRef>'+from+'</ojp:FromTripLegIdRef><ojp:ToTripLegIdRef>'+to+'</ojp:ToTripLegIdRef><ojp:FareProduct><ojp:FareProductId>x</ojp:FareProductId><ojp:FareProductName>Billet</ojp:FareProductName><ojp:FareAuthorityRef>ch:1:NOVA</ojp:FareAuthorityRef><ojp:Price>'+price+'</ojp:Price><ojp:Currency>CHF</ojp:Currency><ojp:TravelClass>second</ojp:TravelClass>'+extra+'</ojp:FareProduct></ojp:TripFareResult></ojp:FareResult>';
test('trajet : portions, lignes et horaires lus ; bloc Trip recopié tel quel dans la demande de prix',()=>{
 const [t]=O.parseTrips(tripXml);
 assert.deepEqual(t.legs.map(l=>l.kind),['timed','transfer','timed']);
 assert.deepEqual([t.legs[0].from,t.legs[0].to,t.legs[0].line,t.legs[0].departure,t.legs[2].to,t.legs[2].arrival],['Genève','Morges','IR90','2026-11-16T08:12:00Z','Lausanne','2026-11-16T08:57:00Z']);
 const req=O.fareRequest(t);assert.ok(req.includes(t.xml));assert.match(req,/<ojp:FareAuthorityFilter>ch:1:NOVA<\/ojp:FareAuthorityFilter>/);
 assert.equal(O.fareRequest({}),null);
});
test('prix OJP Fare : affiché seulement s’il couvre le trajet complet',()=>{
 const [t]=O.parseTrips(tripXml);
 assert.deepEqual(O.parseFare(fare(1,3,'23.40'),t).price,{amount:23.4,currency:'CHF',name:'Billet',authority:'ch:1:NOVA',fromId:'1',toId:'3'});
 assert.equal(O.parseFare(fare(1,1,'12.00'),t).price,null,'première portion seule');
 assert.equal(O.parseFare(fare(3,3,'6.00'),t).price,null,'dernière portion seule');
 assert.equal(O.parseFare(fare(1,1,'12.00')+fare(3,3,'6.00'),t).price,null,'jamais d’addition de prix partiels');
 assert.equal(O.parseFare(fare(1,3,'11.70','<ojp:RequiredCard>HalfFare</ojp:RequiredCard>'),t).price,null,'demi-tarif refusé');
 assert.equal(O.parseFare(fare(1,3,'0'),t).price,null);assert.equal(O.parseFare(fare(1,3,'abc'),t).price,null);
 assert.equal(O.parseFare(fare(9,3,'23.40'),t).price,null,'portion inconnue');
 assert.equal(O.parseFare('<x/>',t).price,null);assert.equal(O.parseFare(fare(1,3,'23.40'),{legs:[]}).price,null);
 // Entre deux offres complètes, la moins chère en plein tarif 2e classe.
 assert.equal(O.parseFare(fare(1,3,'25.00')+fare(1,3,'23.40'),t).price.amount,23.4);
});
test('appel HTTP : jeton obligatoire, jamais repris dans les erreurs',async()=>{
 await assert.rejects(O.post(O.ENDPOINT,'<x/>','',async()=>{}),/Jeton OJP absent/);
 const secret='SECRET-TOKEN-123';let seen;
 const fail=async(u,o)=>{seen=o;return {ok:false,status:403,text:async()=>'<e>Forbidden</e>'};};
 await assert.rejects(O.post(O.ENDPOINT,'<x/>',secret,fail),e=>/HTTP 403/.test(e.message)&&!e.message.includes(secret));
 assert.equal(seen.headers.Authorization,'Bearer '+secret);assert.equal(seen.method,'POST');
});
