// 28/11/2026 (Laurent : « trajet piéton » conduisant au « 43 Rue des Epinettes » à Chambéry (73) alors que la
// bonne adresse de la mission est « 453 Rue des Epinettes ») : quand le numéro de rue est séparé du nom de la
// voie par une virgule ou un tiret (« 453, Rue des Epinettes »), au lieu d'une simple espace, l'extraction du
// numéro échouait silencieusement — et la vérification stricte du numéro renvoyé par le géocodeur était alors
// sautée, laissant passer n'importe quelle adresse plausible de la même rue, même avec un numéro différent.
const {test}=require('node:test');const assert=require('node:assert/strict');
const G=require('../geo.js');

const feature=(properties,coords)=>({geometry:{coordinates:coords},properties:{score:0.9,...properties}});

test('numéro séparé par une virgule : un mauvais numéro renvoyé par le géocodeur est rejeté (rien d’inventé)',async()=>{
 const m={to_city:'Chambéry',to_department:'73',destination_address:'453, Rue des Epinettes, 73000 Chambéry'};
 const r=await G.chercherPoint(m,'destination',async()=>({ok:true,json:async()=>({features:[
  feature({type:'housenumber',housenumber:'43',street:'Rue des Epinettes',city:'Chambéry',postcode:'73000'},[5.9140,45.5770])
 ]})}));
 assert.equal(r.trouve,false);
});

test('numéro séparé par une virgule : le bon numéro renvoyé par le géocodeur est accepté',async()=>{
 const m={to_city:'Chambéry',to_department:'73',destination_address:'453, Rue des Epinettes, 73000 Chambéry'};
 const r=await G.chercherPoint(m,'destination',async()=>({ok:true,json:async()=>({features:[
  feature({type:'housenumber',housenumber:'453',street:'Rue des Epinettes',city:'Chambéry',postcode:'73000'},[5.9205,45.5812])
 ]})}));
 assert.ok(r&&r.trouve);
 assert.equal(r.point.precision,'adresse');
 assert.equal(r.point.lat,45.5812);
 assert.equal(r.point.lng,5.9205);
});

test('numéro séparé par un tiret (collé, sans espaces) : même protection',async()=>{
 // Un tiret entouré d'espaces (« 453 - Rue ») est déjà traité ailleurs comme un préfixe de lieu à retirer
 // (ex. « Dépôt – 12 rue Exemple », cf. geo-adresse-repli.test.cjs) : ce n'est pas le cas visé ici.
 const m={to_city:'Chambéry',to_department:'73',destination_address:'453-Rue des Epinettes, 73000 Chambéry'};
 const mauvais=await G.chercherPoint(m,'destination',async()=>({ok:true,json:async()=>({features:[
  feature({type:'housenumber',housenumber:'43',street:'Rue des Epinettes',city:'Chambéry',postcode:'73000'},[5.9140,45.5770])
 ]})}));
 assert.equal(mauvais.trouve,false);
 const bon=await G.chercherPoint(m,'destination',async()=>({ok:true,json:async()=>({features:[
  feature({type:'housenumber',housenumber:'453',street:'Rue des Epinettes',city:'Chambéry',postcode:'73000'},[5.9205,45.5812])
 ]})}));
 assert.ok(bon&&bon.trouve);
 assert.equal(bon.point.lat,45.5812);
});

test('numéro séparé par une virgule sans espace : extraction toujours correcte',async()=>{
 const m={to_city:'Chambéry',to_department:'73',destination_address:'453,Rue des Epinettes, 73000 Chambéry'};
 const r=await G.chercherPoint(m,'destination',async()=>({ok:true,json:async()=>({features:[
  feature({type:'housenumber',housenumber:'43',street:'Rue des Epinettes',city:'Chambéry',postcode:'73000'},[5.9140,45.5770])
 ]})}));
 assert.equal(r.trouve,false);
});

test('toujours correct pour le format espace simple (non régression)',async()=>{
 const m={to_city:'Chambéry',to_department:'73',destination_address:'453 Rue des Epinettes, 73000 Chambéry'};
 const bon=await G.chercherPoint(m,'destination',async()=>({ok:true,json:async()=>({features:[
  feature({type:'housenumber',housenumber:'453',street:'Rue des Epinettes',city:'Chambéry',postcode:'73000'},[5.9205,45.5812])
 ]})}));
 assert.ok(bon&&bon.trouve);
 const mauvais=await G.chercherPoint(m,'destination',async()=>({ok:true,json:async()=>({features:[
  feature({type:'housenumber',housenumber:'43',street:'Rue des Epinettes',city:'Chambéry',postcode:'73000'},[5.9140,45.5770])
 ]})}));
 assert.equal(mauvais.trouve,false);
});
