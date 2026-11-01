const test=require('node:test'),assert=require('node:assert/strict');
const {quote}=require('../toll-official-catalogue.cjs'),source=require('../data/tolls/official/duplex-a86.json');
const req=(date,time,extra={})=>({date,asOf:'2026-11-01',passageTime:date+'T'+time+':00+01:00',route:'Rueil_Vélizy',vehicleClass:1,badgeDetectedBoth:false,...extra});
test('A86 published intervals cover each minute exactly once for all nine day types and both payment cases',()=>{
 const clock=s=>{const m=/^(\d+)H(\d+)?$/.exec(s);return Number(m[1])*60+Number(m[2]||0);};
 const days=[...new Set(source.rows.map(r=>r[0]))];assert.equal(days.length,9);
 for(const day of days)for(const badge of ['oui','non']){
  const rows=source.rows.filter(r=>r[0]===day&&r[1]===badge);
  for(let minute=0;minute<1440;minute++)assert.equal(rows.filter(r=>minute>=clock(r[2])&&minute<clock(r[3])).length,1,day+' '+badge+' '+minute);
 }
});
test('A86 applies holiday, August, Saturday and holiday-eve precedence from the official guide',()=>{
 const calendar=require('../data/tolls/a86-calendar-2026.json');
 assert.deepEqual(Object.keys(calendar.dates),['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25']);
 for(const [date,type]of [['2026-11-02','Lundi'],['2026-11-06','Vendredi'],['2026-11-10','Veilles de fêtes'],
  ['2026-11-11','Dimanches+Fêtes'],['2026-08-08','Jours ouvrables août'],['2026-08-15','Dimanches+Fêtes'],
  ['2026-12-24','Veilles de fêtes'],['2026-12-26','Samedi'],['2026-12-31','Veilles de fêtes'],
  ['2026-04-03','Vendredi'],['2026-08-09','Dimanches+Fêtes'],['2026-07-13','Veilles de fêtes']]){
  const r=quote(source,req(date,'10:00'));assert.equal(r.dayType,type,date);assert.equal(r.routeVerified,false);
 }
});
test('A86 retains the published direction, badge conditions and exact half-open time boundaries',()=>{
 assert.equal(quote(source,req('2026-11-02','10:00')).amount,9.9);
 assert.equal(quote(source,req('2026-11-02','06:29')).amount,8.3);
 assert.equal(quote(source,req('2026-11-02','06:30')).amount,8.9);
 assert.equal(quote(source,req('2026-11-02','10:00',{route:'Rueil_Vaucresson',badgeDetectedBoth:true})).amount,5.6);
 assert.equal(quote(source,req('2026-11-02','10:00',{route:'Rueil_Vaucresson'})).amount,9.9);
 for(const route of source.headers.slice(4))assert.equal(quote(source,req('2026-11-02','23:59',{route})).status,'official-source-price');
});
test('A86 rejects absent context, stale data, wrong classes, unknown routes and overlapping rows',()=>{
 for(const change of [{badgeDetectedBoth:undefined},{vehicleClass:2},{passageTime:undefined},
  {passageTime:'2026-11-02T10:00:00'},{route:'Velizy_Rueil'},{asOf:'2026-11-09'},{date:'2027-01-01'}])assert.equal(quote(source,req('2026-11-02','10:00',change)).amount,null);
 const s=structuredClone(source);s.rows.push([...s.rows.find(r=>r[0]==='Lundi'&&r[1]==='non'&&r[2]==='10H')]);
 assert.equal(quote(s,req('2026-11-02','10:00')).amount,null);
});
test('A86 handles the repeated French autumn hour and a UTC date change',()=>{
 for(const offset of ['+02:00','+01:00'])assert.equal(quote(source,req('2026-10-25','02:30',{passageTime:'2026-10-25T02:30:00'+offset})).amount,2);
 const r=quote(source,req('2026-11-01','00:30',{passageTime:'2026-10-31T23:30:00Z'}));assert.equal(r.dayType,'Dimanches+Fêtes');assert.equal(r.amount,2);
});
