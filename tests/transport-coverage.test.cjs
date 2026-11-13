const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../transport-coverage.js');
const H=require('../transport-mission-hub.js');
const mem=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};

test('inventaire : 4 états, aucun « Validé en réel » sans diagnostic téléphone, dénominateurs explicites',()=>{
 const inv=C.inventory(null);
 const states=new Set(inv.rows.map(r=>r.state));
 assert.ok(!states.has('Validé en réel'));
 for(const s of states)assert.ok(['Testé sur données enregistrées','Partiellement raccordé','Non raccordé'].includes(s));
 for(const z of inv.zones){assert.ok(z.total>0);assert.equal(z.real,0);assert.ok(z.connected<=z.total);}
 for(const r of inv.rows){assert.ok(r.blocage&&r.action,'blocage et action renseignés : '+r.id);assert.ok(['vérifiés','partiels','manquants'].includes(r.tarif));}
 // TCL, J'y bus, TAM : jamais comptés comme raccordés (TripGo seul ne compte pas)
 for(const id of ['tcl','jybus','tam'])assert.equal(inv.rows.find(r=>r.id===id).state,'Non raccordé');
});

test('« Validé en réel » seulement avec des trajets réels de moins de 30 jours',()=>{
 const n=C.NETWORKS.find(x=>x.id==='synchro');
 const now=Date.parse('2026-11-20T00:00:00Z');
 assert.equal(C.stateOf(n,{networks:{synchro:{trips:3,at:'2026-11-13T09:00:00Z'}}},now),'Validé en réel');
 assert.equal(C.stateOf(n,{networks:{synchro:{trips:0,at:'2026-11-13T09:00:00Z'}}},now),'Partiellement raccordé','0 trajet');
 assert.equal(C.stateOf(n,{networks:{synchro:{trips:3,at:'2026-09-01T09:00:00Z'}}},now),'Partiellement raccordé','trop ancien');
});

test('attribution des trajets aux réseaux par les noms réellement renvoyés',()=>{
 const j=(provider,line,extra={})=>({legs:[{kind:'transit',provider,line}],price:{status:extra.priced?'verified':'unknown'},reasons:extra.reasons||[]});
 const a=C.attribute([{...j('M Réso - Métropole Grenobloise','C1',{priced:true}),legs:[{kind:'transit',provider:'M Réso - Métropole Grenobloise',line:'C1',fromPoint:{lat:45.19,lon:5.71},toPoint:{lat:45.18,lon:5.72}}]},j('Sibra','5'),j('SNCF','TER 17654',{reasons:['marche finale partielle']}),j('Inconnu','Z')]);
 assert.equal(a['mreso-metro'].trips,1);assert.equal(a['mreso-metro'].priced,1);
 assert.equal(a.sibra.trips,1);assert.equal(a.ter.walked,0);
 assert.equal(a['mreso-gresivaudan'],undefined,'trajet urbain grenoblois : ne valide pas le Grésivaudan');
 assert.equal(Object.keys(a).some(k=>k==='tcl'),false);
});

test('diagnostic : moteurs réels simulés ici → rapport chiffré par axe, réseaux vus, erreurs consignées, stockage',async()=>{
 const storage=mem();
 const at=(h,m)=>'2026-11-16T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00+01:00';
 const providers={
  ok:{name:'Mobilités M',enabled:()=>true,run:async task=>[{source:'M',sources:['M'],legs:[{kind:'transit',mode:'Bus',provider:'M Réso - Métropole Grenobloise',line:'C1',
   from:'A',to:'B',fromPoint:task.from,toPoint:task.to,departure:at(8,10),arrival:at(8,40)}]}]},
  ko:{name:'TripGo',enabled:()=>true,run:async()=>{throw new Error('HTTP 401');}}
 };
 const router={route:async(a,b)=>({status:'calculated',distanceMeters:1,durationSeconds:1,geometry:[a,b]})};
 const Grids=require('../transport-fare-grids.js');
 const report=await C.runDiagnostic({hub:H,providers,router,fareFor:Grids.fareFor,storage,axes:C.AXES.filter(a=>a.id==='grenoble-crolles'),when:at(8,0),timeoutMs:2000});
 const a=report.axes[0];
 assert.equal(a.trips,1);assert.equal(a.priced,1,'M réso 2,00 €');assert.equal(a.walked,1);
 assert.equal(a.engines.errors.TripGo,'HTTP 401');
 assert.deepEqual(a.networksSeen,['mreso-metro','mreso-gresivaudan'],'Grenoble (Métropole) → Crolles (Grésivaudan), pas le Voironnais');
 assert.equal(C.inventory(storage).rows.find(r=>r.id==='mreso-metro').state,'Validé en réel');
 assert.match(C.reportText(report,C.inventory(storage)),/Grenoble → Crolles : 1 trajet\(s\), 1 avec prix vérifié/);
});
