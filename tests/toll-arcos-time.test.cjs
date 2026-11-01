const test=require('node:test'),assert=require('node:assert/strict');
const {quote,sha256}=require('../toll-official-catalogue.cjs');
const source=require('../data/tolls/official/arcos.json'),rules=require('../data/tolls/arcos-time-bands-2026.json'),holidays=require('../data/tolls/arcos-holidays-2026.json');
const req=(date,time,extra={})=>({date,asOf:'2026-11-01',passageTime:date+'T'+time+':00+01:00',route:'Itthenheim Barrière',vehicleClass:1,...extra});
test('all 26 reviewed ARCOS bands cover every minute of a normal week exactly once',()=>{
 assert.equal(rules.bands.length,26);
 for(let day=0;day<7;day++)for(let minute=0;minute<1440;minute++){
  const matches=rules.bands.filter(b=>b.windows.some(w=>w.days.includes(day)&&minute>=w.fromMinute&&minute<=w.throughMinute));
  assert.equal(matches.length,1,day+' '+minute);
 }
 const published=new Set(source.rows.map(r=>sha256(Buffer.from(r[1]))));
 assert.equal(published.size,26);for(const b of rules.bands)assert.ok(published.has(b.labelSha256));
});
test('ARCOS selects exact weekday, Friday, Saturday and Sunday minute boundaries',()=>{
 for(const [date,bounds]of [['2026-11-02',[['04:59','A'],['05:00','B'],['06:00','C'],['06:30','D'],['07:00','E'],['09:00','F'],['15:30','G'],['16:00','H'],['16:30','I'],['17:30','J'],['18:30','K'],['19:00','L'],['19:30','A'],['20:00','A'],['20:30','A']]],
  ['2026-11-06',[['05:00','M'],['05:30','N'],['06:30','T'],['07:30','U'],['09:00','V'],['14:00','W'],['16:00','E'],['16:30','X'],['18:30','Y'],['19:00','Z'],['20:00','A']]],
  ['2026-11-07',[['05:00','M'],['05:30','N'],['07:00','O'],['09:00','P'],['15:00','Q'],['19:00','R'],['20:30','A']]],
  ['2026-11-01',[['05:00','A'],['06:00','N'],['07:30','S'],['09:00','P'],['19:30','S'],['21:00','M']]]])
  for(const [time,band]of bounds){const r=quote(source,req(date,time));assert.equal(r.timeBand,band,date+' '+time);assert.equal(r.routeVerified,false);}
 assert.equal(quote(source,req('2026-11-02','09:00')).amount,4.4);
 assert.equal(quote(source,req('2026-11-01','09:00')).amount,5.4);
});
test('the 13 tariff holidays include Good Friday and Boxing Day, with Sunday schedules',()=>{
 assert.equal(Object.keys(holidays.dates).length,13);
 for(const date of Object.keys(holidays.dates).filter(d=>d>=source.effectiveFrom)){
  const r=quote(source,req(date,'09:00',{passageTime:date+'T09:00:00+01:00'}));
  // Summer +01:00 is still an explicit instant; the corresponding 10:00 French time is in the same P band.
  assert.equal(r.timeBand,'P',date);assert.equal(r.holidayApplied,true,date);
 }
 assert.ok(holidays.dates['2026-04-03']);assert.ok(holidays.dates['2026-12-26']);
});
test('ARCOS requires a passage instant, exact section, class and heavy-vehicle Euro group',()=>{
 for(const change of [{passageTime:undefined},{passageTime:'2026-11-02T09:00:00'},
  {passageTime:'2026-11-01T09:00:00Z'},{route:'Ittenheim Barrière'},{vehicleClass:3},
  {vehicleClass:3,euroGroup:99},{asOf:'2026-11-09'},{date:'2027-01-01'}])assert.equal(quote(source,req('2026-11-02','09:00',change)).amount,null);
 assert.equal(quote(source,req('2026-11-02','09:00',{vehicleClass:3,euroGroup:0})).status,'official-source-price');
 assert.equal(quote(source,req('2026-11-02','09:00',{vehicleClass:2,route:'Itthenheim Gare Latérale'})).status,'official-source-price');
});
test('a changed published schedule or contradictory amount cannot be treated as reviewed',()=>{
 const s=structuredClone(source);s.rows[0][1]+=' altered';assert.equal(quote(s,req('2026-11-02','09:00')).amount,null);
 const q=structuredClone(source),r=q.rows.find(r=>r[0]==='Itthenheim Barrière'&&r[2]==='1'&&r[3]===4.4);q.rows.push([...r.slice(0,3),99,r[4]]);
 assert.equal(quote(q,req('2026-11-02','09:00')).amount,null);
});
test('national inventory distinguishes named entities, supplementary facilities and completeness',()=>{
 const inv=require('../data/tolls/national-inventory-2026.json');assert.equal(inv.entities.length,22);assert.equal(inv.universeComplete,false);assert.equal(inv.missingNationalTariffs,null);
 assert.equal(new Set(inv.entities.map(e=>e.id)).size,inv.entities.length);
 for(const f of inv.facilities){assert.equal(f.tariffCompletenessVerified,false);if(f.parentEntity)assert.ok(inv.entities.some(e=>e.id===f.parentEntity));}
 const facts=require('../data/tolls/reviewed/special-facilities-2026-11-01.json').facilities.find(f=>f.id==='tunnel-envalira');
 assert.equal(facts.vehicleClassPrices['1'],8.1);assert.equal(facts.vehicleClassPrices['2'],14.2);assert.equal(facts.routeIdentityVerified,false);
});
