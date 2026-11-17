const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
global.window=global;global.localStorage={getItem(){return null},setItem(){}};
const G=require('../geo.js');const geo=global.CPGeo||G.default||G;
const fakeFetch=(lat,lng,type)=>async()=>({ok:true,json:async()=>({features:[{geometry:{coordinates:[lng,lat]},properties:{score:0.9,type}}]})});

test('communes absentes de la table : coordonnées inconnues avant géocodage, adresse ensuite',async()=>{
 const m={to_city:'Archamps',destination:{city:'Archamps',zip:'74160',address:'300 rue Louis Rustin'}};
 const avant=geo.coordonnees(m,'destination');
 assert.ok(!avant||avant.precision==='departement','Archamps absente de la table de villes intégrée');
 const r=await geo.chercherPoint(m,'destination',fakeFetch(46.1,6.1,'housenumber'));
 assert.equal(r.trouve,true);geo.POINTS[r.cle]=r.point;
 const apres=geo.coordonnees(m,'destination');
 assert.equal(apres.precision,'adresse');assert.equal(apres.lat,46.1);
});

test('service d adresses sans résultat : aucun point inventé',async()=>{
 const m={from_city:'Viviers-du-Lac',origin:{city:'Viviers-du-Lac',zip:'73420'}};
 const r=await geo.chercherPoint(m,'origin',async()=>({ok:true,json:async()=>({features:[]})}));
 assert.equal(r.trouve,false);
 const c=geo.coordonnees(m,'origin');assert.ok(!c||c.precision==='departement');
});

test('fiche mission : le géocodage des points manquants précède la recherche de trajets',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const i=app.indexOf('const startTransportHub=');
 const bloc=app.slice(i,app.indexOf('const gp=gps=>',i));
 assert.match(bloc,/G\.chercherPoint\(mm,cote/);
 assert.match(bloc,/panel\.cpGeoTried/);
});
