const {test}=require('node:test');const assert=require('node:assert/strict');
const G=require('../geo.js');
const mission={from_city:'Ferney-Voltaire',from_department:'01',origin_address:'Aéroport De Genève – Secteur France Route Douanière, 01210 Ferney-Voltaire'};
function fetcher(reponses){const urls=[];return {urls,f:async u=>{urls.push(decodeURIComponent(u));const q=decodeURIComponent(u);
 const hit=reponses.find(r=>q.includes(r.contient)&&(r.commune?q.includes('type=municipality'):!q.includes('type=municipality')));
 return {ok:true,json:async()=>({features:hit?[{geometry:{coordinates:[hit.lng,hit.lat]},properties:{score:hit.score??0.9,type:hit.type,label:'x'}}]:[]})};}};}

test('adresse de lieu non trouvée : repli sur la voie, puis la commune, avec la précision réelle',async()=>{
 const a=fetcher([{contient:'Route Douanière',type:'street',lat:46.2593,lng:6.1066}]);
 const r=await G.chercherPoint(mission,'origin',a.f);
 assert.ok(r&&r.trouve);assert.equal(r.point.precision,'rue');assert.ok(Math.abs(r.point.lat-46.2593)<1e-6);
 assert.ok(a.urls.length>=1);
 const b=fetcher([{contient:'Ferney-Voltaire',type:'municipality',lat:46.2561,lng:6.1081,commune:true}]);
 const r2=await G.chercherPoint(mission,'origin',b.f);
 assert.ok(r2&&r2.trouve);assert.equal(r2.point.precision,'ville');
});

test('aucun résultat : rien d inventé',async()=>{
 const a=fetcher([]);const r=await G.chercherPoint(mission,'origin',a.f);
 assert.equal(!!(r&&r.trouve),false);
});
