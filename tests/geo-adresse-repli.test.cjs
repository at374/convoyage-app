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

test('un résultat centre-ville ne masque pas le numéro de rue trouvé ensuite',async()=>{
 const adresse={from_city:'Voiron',from_department:'38',origin_address:'Dépôt – 12 rue Exemple 38500 Voiron'};
 const a=fetcher([
  {contient:'Dépôt',type:'municipality',lat:45.36,lng:5.59},
  {contient:'12 rue Exemple',type:'housenumber',lat:45.38,lng:5.58}
 ]);
 const r=await G.chercherPoint(adresse,'origin',a.f);
 assert.deepEqual(r.point,{lat:45.38,lng:5.58,precision:'adresse'});
 assert.equal(a.urls.length,2);
});

test('Voiron : la rue du courriel remplace le centre fourni par la plateforme',async()=>{
 const ville=G.trouverVille('Voiron','38');
 const mission={from_city:'Voiron',from_department:'38',origin_address:'Voiron (38)',
  origin:{lat:ville.lat,lng:ville.lng},mail_info:{depart:{adresse:'Rue Louis Armand, 38500 Voiron'}}};
 const a=fetcher([{contient:'Rue Louis Armand',type:'street',lat:45.381682,lng:5.579257}]);
 assert.equal(G.coordonnees(mission,'origin').precision,'ville');
 const r=await G.chercherPoint(mission,'origin',a.f);
 G.POINTS[r.cle]=r.point;
 try{assert.deepEqual(G.coordonnees(mission,'origin'),{lat:45.381682,lng:5.579257,precision:'rue'});}
 finally{delete G.POINTS[r.cle];}
});


test('Annecy : apostrophe échappée et code postal erroné ne masquent pas le numéro 94',async()=>{
 const m={to_city:'Annecy',to_department:'74',destination_address:"94 avenue d\\'aix les bains, 74000 Annecy"};
 assert.equal(G.adresseDe(m,'destination').a,"94 avenue d'aix les bains, 74000 Annecy");
 const urls=[];
 const r=await G.chercherPoint(m,'destination',async u=>{
  urls.push(decodeURIComponent(u));
  const exact=!u.includes('&postcode=');
  return {ok:true,json:async()=>({features:[{geometry:{coordinates:exact?[6.10477,45.88807]:[6.12846,45.89962]},properties:{score:0.9,type:exact?'housenumber':'municipality',housenumber:exact?'94':undefined}}]})};
 });
 assert.equal(r.trouve,true);
 assert.equal(r.point.precision,'adresse');
 assert.equal(r.point.lat,45.88807);
 assert.ok(urls.every(u=>!u.includes('\\')));
 assert.ok(urls.some(u=>!u.includes('&postcode=')));
});

test('recherche de secours : voie seule puis numéro exact dans la bonne commune',async()=>{
 const m={to_city:'Annecy',to_department:'74',destination_address:"94 avenue d'Aix-les-Bains, 74000 Annecy"};
 const urls=[];
 const feature=(properties)=>({geometry:{coordinates:[6.10477,45.88807]},properties:{score:0.9,...properties}});
 const r=await G.chercherPoint(m,'destination',async u=>{
  urls.push(u);
  const type=new URL(u).searchParams.get('type');
  const features=type==='street'?[feature({type:'street',name:"Avenue d'Aix-les-Bains",city:'Annecy',postcode:'74600'})]:
   type==='housenumber'?[feature({type:'housenumber',housenumber:'92',street:"Avenue d'Aix-les-Bains",city:'Annecy'}),feature({type:'housenumber',housenumber:'94',street:"Avenue d'Aix-les-Bains",city:'Annecy'})]:[];
  return {ok:true,json:async()=>({features})};
 });
 assert.equal(r.trouve,true);
 assert.equal(r.point.precision,'adresse');
 assert.ok(urls.some(u=>u.includes('&type=street')));
 assert.ok(urls.some(u=>u.includes('&type=housenumber')));
});
