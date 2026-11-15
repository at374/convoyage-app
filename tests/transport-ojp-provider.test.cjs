'use strict';
/* OJP Suisse (opentransportdata.swiss) : conversion fromOJP(), tarif unique réparti sans sur-compter,
 * dégradation sûre quand les positions GPS de correspondance manquent, et câblage du fournisseur P.ojp
 * (relais serveur ojp-relais, jamais de jeton côté app). */
const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('../transport-mission-hub.js');

const GENEVE={lat:46.2104,lon:6.1424},LAUSANNE={lat:46.5167,lon:6.6333},BERNE={lat:46.9481,lon:7.4474};

function timedLeg(o){return {id:o.id,kind:'timed',from:o.from,to:o.to,fromRef:o.fromRef||null,toRef:o.toRef||null,
 departure:o.departure,arrival:o.arrival,line:o.line||null,operatorRef:o.operatorRef||null,operator:o.operator||null,mode:o.mode||'rail'};}

test('ojpMode : vocabulaire PtMode OJP vers les icônes de l’application',()=>{
 assert.equal(H.ojpMode('rail'),'Train');
 assert.equal(H.ojpMode('bus'),'Bus');
 assert.equal(H.ojpMode('tram'),'Tram');
 assert.equal(H.ojpMode('metro'),'Métro');
 assert.equal(H.ojpMode('coach'),'Car');
 assert.equal(H.ojpMode('funicular'),'Funiculaire');
 assert.equal(H.ojpMode('water'),'boat');
 assert.equal(H.ojpMode('je-ne-sais-quoi'),'Transport');
});

test('fromOJP : trajet direct, tarif plein couvrant tout le trajet',()=>{
 const trip={id:'T1',legs:[timedLeg({id:'L1',from:'Genève',to:'Lausanne',
  departure:'2026-11-16T08:00:00+01:00',arrival:'2026-11-16T08:45:00+01:00',line:'IR15',operator:'CFF',mode:'rail'})]};
 const price={amount:24.00,currency:'CHF',name:'Billet dégressif',authority:'ch:1:NOVA',passenger:'adulte plein tarif',indicative:true};
 const [j]=H.fromOJP([{trip,price}],{origin:GENEVE,destination:LAUSANNE});
 assert.equal(j.source,'OJP Suisse (opentransportdata.swiss)');
 assert.equal(j.legs.length,1);
 assert.equal(j.legs[0].mode,'Train');assert.equal(j.legs[0].provider,'CFF');
 assert.ok(j.legs[0].fromPoint&&j.legs[0].toPoint);
 const prix=H.priceOf(j);
 assert.equal(prix.status,'verified');assert.equal(prix.amounts.CHF,24);
});

test('fromOJP : opérateur absent => CFF par défaut (évite le repli Oùra pour un trajet suisse)',()=>{
 const trip={id:'T2',legs:[timedLeg({id:'L1',from:'Berne',to:'Genève',
  departure:'2026-11-16T09:00:00+01:00',arrival:'2026-11-16T10:30:00+01:00',line:'IC1',mode:'rail'})]};
 const [j]=H.fromOJP([{trip,price:null}],{origin:BERNE,destination:GENEVE});
 assert.equal(j.legs[0].provider,'CFF');
 assert.equal(H.ticketLink(j.legs[0].provider).label,'CFF');
});

test('fromOJP : correspondance — tarif total posé sur la dernière portion, 0 sur les précédentes',()=>{
 const trip={id:'T3',legs:[
  timedLeg({id:'L1',from:'Genève',to:'Berne',departure:'2026-11-16T07:00:00+01:00',arrival:'2026-11-16T08:38:00+01:00',line:'IC1',operator:'CFF'}),
  {id:'X1',kind:'transfer'},
  timedLeg({id:'L2',from:'Berne',to:'Lausanne',departure:'2026-11-16T08:45:00+01:00',arrival:'2026-11-16T09:22:00+01:00',line:'IR15',operator:'CFF'})
 ]};
 const price={amount:49.00,currency:'CHF',name:'Billet',authority:'ch:1:NOVA'};
 const [j]=H.fromOJP([{trip,price}],{origin:GENEVE,destination:LAUSANNE});
 assert.equal(j.legs.length,2);
 assert.equal(j.legs[0].fare.amount,0);
 assert.equal(j.legs[1].fare.amount,49);
 assert.equal(j.legs[0].fare.network,j.legs[1].fare.network);
 assert.equal(H.priceOf(j).amounts.CHF,49);
 // Seules les positions d'origine/destination de la mission sont posées ; l'arrêt de correspondance
 // intermédiaire (Berne) n'a aucune coordonnée OJP : non fabriquée.
 assert.equal(j.legs[0].toPoint,null);assert.equal(j.legs[1].fromPoint,null);
});

test('fromOJP : aucun prix couvrant tout le trajet => Prix à confirmer (jamais d’estimation)',()=>{
 const trip={id:'T4',legs:[timedLeg({id:'L1',from:'Genève',to:'Lausanne',
  departure:'2026-11-16T08:00:00+01:00',arrival:'2026-11-16T08:45:00+01:00',operator:'CFF'})]};
 const [j]=H.fromOJP([{trip,price:null}],{origin:GENEVE,destination:LAUSANNE});
 assert.equal(H.priceOf(j).status,'unknown');
 assert.equal(H.priceOf(j).label,'Prix à confirmer');
});

test('fromOJP : portion bateau => trajet entier retiré (comme fromSwiss)',()=>{
 const trip={id:'T5',legs:[timedLeg({id:'L1',from:'Genève',to:'Nyon',mode:'water',
  departure:'2026-11-16T08:00:00+01:00',arrival:'2026-11-16T08:50:00+01:00'})]};
 assert.equal(H.fromOJP([{trip,price:null}],{}).length,0);
});

test('fromOJP : trajet sans aucune portion « timed » => retiré',()=>{
 const trip={id:'T6',legs:[{id:'X1',kind:'transfer'}]};
 assert.equal(H.fromOJP([{trip,price:null}],{}).length,0);
 assert.equal(H.fromOJP([{trip:null}],{}).length,0);
});

test('correspondance OJP sans position GPS intermédiaire => Transport non confirmé (jamais fabriquée)',async()=>{
 const trip={id:'T7',legs:[
  timedLeg({id:'L1',from:'Genève',to:'Berne',departure:'2026-11-16T07:00:00+01:00',arrival:'2026-11-16T08:38:00+01:00',operator:'CFF'}),
  {id:'X1',kind:'transfer'},
  timedLeg({id:'L2',from:'Berne',to:'Lausanne',departure:'2026-11-16T08:45:00+01:00',arrival:'2026-11-16T09:22:00+01:00',operator:'CFF'})
 ]};
 const [j]=H.fromOJP([{trip,price:{amount:49,currency:'CHF'}}],{origin:GENEVE,destination:LAUSANNE});
 const task={from:GENEVE,to:LAUSANNE,latestArrival:'2026-11-16T09:40:00+01:00'};
 const done=await H.completeWalks(j,task,null);
 assert.ok(done.missing.some(m=>/positions GPS de correspondance non vérifiées/.test(m)));
 const x=H.assess(done,task);
 assert.equal(x.status,'Transport non confirmé');
});

/* ---------- Fournisseur P.ojp : relais serveur, jamais de jeton côté app ---------- */
function xmlOf(body){return typeof body==='string'?body:'';}
function fakeRoot({locationsXml,tripXml,fareXml,relayStatus=200}){
 const calls=[];
 return {CPTransportOJP:require('../transport-ojp.js'),
  fetch:async(url,options)=>{
   calls.push({url,body:xmlOf(options?.body)});
   const body=xmlOf(options?.body);
   if(relayStatus!==200)return {status:relayStatus,text:async()=>''};
   if(/OJPLocationInformationRequest/.test(body))return {status:200,ok:true,text:async()=>locationsXml};
   if(/OJPTripRequest/.test(body))return {status:200,ok:true,text:async()=>tripXml};
   if(/OJPFareRequest/.test(body))return {status:200,ok:true,text:async()=>fareXml||'<OJP></OJP>'};
   return {status:404,text:async()=>''};
  },calls};
}
const SESSION={url:'https://ozjouxdjhgoprsbefhjq.supabase.co',cle:'anon',accessToken:'tok'};
const loc=(name,ref)=>'<Location><StopPoint><StopPointRef>'+ref+'</StopPointRef><StopPointName><Text>'+name+'</Text></StopPointName></StopPoint></Location>';

test('P.ojp désactivé sans session (relais non connecté)',()=>{
 const root=fakeRoot({locationsXml:'',tripXml:'',fareXml:''});
 const providers=H.makeProviders(root,{fetcher:root.fetch});
 const task={from:GENEVE,to:LAUSANNE,fromCity:'Genève',toCity:'Lausanne'};
 assert.equal(providers.ojp.enabled(task),false);
});

test('P.ojp désactivé hors zone suisse même avec session',()=>{
 const root=fakeRoot({locationsXml:'',tripXml:'',fareXml:''});
 const providers=H.makeProviders(root,{fetcher:root.fetch,ojpSession:SESSION});
 const task={from:{lat:45.7640,lon:4.8357},to:{lat:45.1885,lon:5.7245},fromCity:'Lyon',toCity:'Grenoble'};
 assert.equal(providers.ojp.enabled(task),false);
});

test('P.ojp : résolution des lieux puis trajet direct via le relais, prix complet retenu',async()=>{
 const tripXml='<OJP><OJPTripDelivery><TripResult><ResultId>T1</ResultId><Trip>'+
  '<TripLeg><LegId>L1</LegId><TimedLeg><LegBoard><siri:StopPointRef>8587057</siri:StopPointRef><StopPointName><Text>Genève</Text></StopPointName>'+
  '<ServiceDeparture><TimetabledTime>2026-11-16T08:00:00Z</TimetabledTime></ServiceDeparture></LegBoard>'+
  '<LegAlight><siri:StopPointRef>8501120</siri:StopPointRef><StopPointName><Text>Lausanne</Text></StopPointName>'+
  '<ServiceArrival><TimetabledTime>2026-11-16T08:45:00Z</TimetabledTime></ServiceArrival></LegAlight>'+
  '<Service><PublishedLineName><Text>IR15</Text></PublishedLineName><OperatorName><Text>CFF</Text></OperatorName><Mode><PtMode>rail</PtMode></Mode></Service>'+
  '</TimedLeg></TripLeg></Trip><Duration>PT45M</Duration><Transfers>0</Transfers></TripResult></OJPTripDelivery></OJP>';
 const fareXml='<OJP><OJPFareDelivery><TripFareResult><FromTripLegIdRef>L1</FromTripLegIdRef><ToTripLegIdRef>L1</ToTripLegIdRef>'+
  '<FareProduct><Price>24.00</Price><Currency>CHF</Currency><TravelClass>second</TravelClass><FareProductName><Text>Billet</Text></FareProductName>'+
  '<FareAuthorityRef>ch:1:NOVA</FareAuthorityRef></FareProduct></TripFareResult></OJPFareDelivery></OJP>';
 const root=fakeRoot({locationsXml:loc('Genève','8587057'),tripXml,fareXml});
 const providers=H.makeProviders(root,{fetcher:root.fetch,ojpSession:SESSION});
 const task={from:GENEVE,to:LAUSANNE,fromCity:'Genève',toCity:'Lausanne',earliestDeparture:'2026-11-16T07:30:00+01:00'};
 assert.equal(providers.ojp.enabled(task),true);
 const journeys=await providers.ojp.run(task);
 assert.equal(journeys.length,1);
 assert.equal(journeys[0].legs[0].provider,'CFF');
 assert.equal(H.priceOf(journeys[0]).amounts.CHF,24);
});

test('P.ojp : trajet renvoyé par OJP avant la fenêtre demandée => écarté (bruit en moins, assess() n’a plus à trancher)',async()=>{
 const tripXml='<OJP><OJPTripDelivery><TripResult><ResultId>T1</ResultId><Trip>'+
  '<TripLeg><LegId>L1</LegId><TimedLeg><LegBoard><siri:StopPointRef>8587057</siri:StopPointRef><StopPointName><Text>Genève</Text></StopPointName>'+
  '<ServiceDeparture><TimetabledTime>2026-11-16T06:00:00Z</TimetabledTime></ServiceDeparture></LegBoard>'+ // avant earliestDeparture (07:30 Paris = 06:30 UTC)
  '<LegAlight><siri:StopPointRef>8501120</siri:StopPointRef><StopPointName><Text>Lausanne</Text></StopPointName>'+
  '<ServiceArrival><TimetabledTime>2026-11-16T06:45:00Z</TimetabledTime></ServiceArrival></LegAlight>'+
  '<Service><PublishedLineName><Text>IR15</Text></PublishedLineName><OperatorName><Text>CFF</Text></OperatorName><Mode><PtMode>rail</PtMode></Mode></Service>'+
  '</TimedLeg></TripLeg></Trip><Duration>PT45M</Duration><Transfers>0</Transfers></TripResult></OJPTripDelivery></OJP>';
 const root=fakeRoot({locationsXml:loc('Genève','8587057'),tripXml,fareXml:'<OJP></OJP>'});
 const providers=H.makeProviders(root,{fetcher:root.fetch,ojpSession:SESSION});
 const task={from:GENEVE,to:LAUSANNE,fromCity:'Genève',toCity:'Lausanne',earliestDeparture:'2026-11-16T07:30:00+01:00'};
 const journeys=await providers.ojp.run(task);
 assert.deepEqual(journeys,[]);
});

test('P.ojp : relais indisponible (404) => aucun trajet, dégradation silencieuse',async()=>{
 const root=fakeRoot({locationsXml:'',tripXml:'',fareXml:'',relayStatus:404});
 const providers=H.makeProviders(root,{fetcher:root.fetch,ojpSession:SESSION});
 const task={from:GENEVE,to:LAUSANNE,fromCity:'Genève',toCity:'Lausanne',earliestDeparture:'2026-11-16T07:30:00+01:00'};
 const journeys=await providers.ojp.run(task);
 assert.deepEqual(journeys,[]);
});

test('P.ojp : lieu non résolu (nom inconnu) => aucun trajet, jamais de référence fabriquée',async()=>{
 const root=fakeRoot({locationsXml:'',tripXml:'',fareXml:''});
 const providers=H.makeProviders(root,{fetcher:root.fetch,ojpSession:SESSION});
 const task={from:GENEVE,to:LAUSANNE,fromCity:'Ville Inconnue',toCity:'Lausanne',earliestDeparture:'2026-11-16T07:30:00+01:00'};
 const journeys=await providers.ojp.run(task);
 assert.deepEqual(journeys,[]);
});
