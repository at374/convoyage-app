const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
global.window=global;global.localStorage={getItem(){return null},setItem(){}};
const G=require('../geo.js');const geo=global.CPGeo||G.default||G;
const fakeFetch=(lat,lng,type,extra={})=>async()=>({ok:true,json:async()=>({features:[{geometry:{coordinates:[lng,lat]},properties:{score:0.9,type,...extra}}]})});

test('communes absentes de la table : coordonnées inconnues avant géocodage, adresse ensuite',async()=>{
 const m={to_city:'Archamps',destination:{city:'Archamps',zip:'74160',address:'300 rue Louis Rustin'}};
 const avant=geo.coordonnees(m,'destination');
 assert.ok(!avant||avant.precision==='departement','Archamps absente de la table de villes intégrée');
 const r=await geo.chercherPoint(m,'destination',fakeFetch(46.1,6.1,'housenumber',{housenumber:'300',street:'rue Louis Rustin',city:'Archamps'}));
 assert.equal(r.trouve,true);geo.POINTS[r.cle]=r.point;
 const apres=geo.coordonnees(m,'destination');
 assert.equal(apres.precision,'adresse');assert.equal(apres.lat,46.1);
});

test('adresse de rue sans numéro : le géocodeur reçoit aussi les champs to_address/from_address',async()=>{
 const m={to_city:'Annecy',to_department:'74',to_address:"Avenue d'Aix-les-Bains"};
 assert.equal(geo.aAdresseRue(m,'destination'),true);
 assert.ok(geo.cleAdresse(m,'destination'),'la clé de cache doit inclure l’adresse et la ville');
 const r=await geo.chercherPoint(m,'destination',fakeFetch(45.870166,6.083469,'street'));
 assert.equal(r.trouve,true);assert.equal(r.point.precision,'rue');
 geo.POINTS[r.cle]=r.point;
 assert.deepEqual(geo.coordonnees(m,'destination'),{lat:45.870166,lng:6.083469,precision:'rue'});
 const from={from_city:'Voiron',from_address:'Rue Louis Armand'};
 assert.equal(geo.aAdresseRue(from,'origin'),true);
 assert.ok(geo.cleAdresse(from,'origin'));
});

test('faubourg avec numéro : vérifie exactement le numéro IGN retourné',async()=>{
 const m={to_city:'Annecy',to_department:'74',to_address:'25 faubourg des Balmettes'};
 const exact=await geo.chercherPoint(m,'destination',fakeFetch(45.9,6.12,'housenumber',{
  housenumber:'25',street:'faubourg des Balmettes',city:'Annecy'
 }));
 assert.equal(exact.trouve,true);
 assert.equal(exact.point.precision,'adresse');
 const wrong=await geo.chercherPoint(m,'destination',fakeFetch(45.9,6.12,'housenumber',{
  housenumber:'26',street:'faubourg des Balmettes',city:'Annecy'
 }));
 assert.equal(wrong.trouve,false,'un numéro voisin ne doit pas remplacer le 25 demandé');
});

test('rue sans numéro : un bâtiment voisin ne remplace pas le début de rue',async()=>{
 const m={to_city:'Voiron',to_department:'38',to_address:'Rue Louis Armand'};
 const urls=[];
 const result=await geo.chercherPoint(m,'destination',async url=>{
  urls.push(url);
  return {ok:true,json:async()=>({features:[{geometry:{coordinates:[5.579257,45.381682]},properties:{
   score:0.9,type:'housenumber',housenumber:'12',street:'Rue Louis Armand',city:'Voiron'
  }}]})};
 });
 assert.equal(result.trouve,false,'un point de bâtiment ne représente pas la rue sans numéro');
 assert.ok(urls[0].includes('type=street'),'la requête prioritaire doit cibler le tronçon de rue');
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
 assert.match(bloc,/c\.precision==='ville'&&G\.aAdresseRue\?\.\(mm,cote\)/,
  'une rue présente ne doit pas rester bloquée sur le centre de la commune');
 assert.match(app,/streetNeedsLookup = G\.aAdresseRue/,
  'le cache de la liste doit pouvoir remplacer un ancien centre-ville par le point de rue');
});

test('un GPS incomplet ne bloque pas la recherche automatique des adresses',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.match(app,/const c0 = G\.coordonnees\(m, cote\); if \(c0 && c0\.precision === 'gps'\) continue;/);
 assert.doesNotMatch(app,/const c0 = m\[cote\]; if \(c0 && Number\.isFinite\(Number\(c0\.lat\)\)/);
});

test('les points trouvés depuis la fiche transport sont persistés dans le cache local',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const i=app.indexOf('const startTransportHub=');
 const end=app.indexOf('const gp=gps=>',i);
 const bloc=app.slice(i,end);
 assert.match(bloc,/gpsMem\.pts\[r\.cle\]=r\.point/);
 assert.match(bloc,/ecrireLocal\('cp_gps',gpsMem\)/);
 assert.match(bloc,/delete gpsMem\.rate\[r\.cle\]/);
});
