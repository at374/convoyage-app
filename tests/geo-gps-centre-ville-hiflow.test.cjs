const {test}=require('node:test');const assert=require('node:assert/strict');
const G=require('../geo.js');

// 23/11/2026 (Laurent : arrivée GPS jamais détectée à une livraison Albertville) : Hiflow donne parfois pour
// « destination » le centre de la commune, même avec une adresse de rue précise à côté — deux missions avec des
// rues différentes à Albertville partagent exactement le même point. coordonnees() doit alors requalifier ce
// point en « ville » (rayon large) plutôt que « gps » (rayon serré), sans changer les coordonnées elles-mêmes.

test('centre de commune donné comme destination GPS par Hiflow : requalifié « ville », pas « gps »', () => {
 const m = {to_city: 'Albertville', to_department: '73',
  destination: {lat: 45.67766, lng: 6.3918, city: 'Albertville', street: '25 rue raymond bertrand', country: 'France', postal_code: '73200'}};
 const c = G.coordonnees(m, 'destination');
 assert.ok(c);
 assert.equal(c.precision, 'ville');
 // Les coordonnées fournies par la plateforme restent inchangées, seule l'étiquette de précision change.
 assert.ok(Math.abs(c.lat - 45.67766) < 1e-6);
 assert.ok(Math.abs(c.lng - 6.3918) < 1e-6);
});

test('autre mission, même point Hiflow (preuve que c est bien un centre-ville générique) : même requalification', () => {
 const m2 = {to_city: 'Albertville', to_department: '73',
  destination: {lat: 45.67766, lng: 6.3918, city: 'Albertville', street: '1 rue lieutenant gustave eysseric', country: 'France', postal_code: '73200'}};
 const c2 = G.coordonnees(m2, 'destination');
 assert.equal(c2.precision, 'ville');
});

test('un vrai point GPS précis (loin du centre-ville connu) reste étiqueté « gps »', () => {
 const m = {to_city: 'Albertville', to_department: '73',
  destination: {lat: 45.6500, lng: 6.4300, city: 'Albertville', street: '10 chemin isolé', country: 'France', postal_code: '73200'}};
 const c = G.coordonnees(m, 'destination');
 assert.ok(c);
 assert.equal(c.precision, 'gps');
});

test('un point « adresse » déjà mis en cache (rue/adresse précise trouvée) prime toujours sur le centre-ville', () => {
 const m = {to_city: 'Albertville', to_department: '73',
  destination: {lat: 45.67766, lng: 6.3918, city: 'Albertville', street: '25 rue raymond bertrand', country: 'France', postal_code: '73200'}};
 const cle = G.cleAdresse(m, 'destination');
 G.POINTS[cle] = {lat: 45.6812, lng: 6.3765, precision: 'adresse'};
 try {
  const c = G.coordonnees(m, 'destination');
  assert.equal(c.precision, 'adresse');
  assert.ok(Math.abs(c.lat - 45.6812) < 1e-6);
 } finally { delete G.POINTS[cle]; }
});

test('sans adresse de rue (seule la ville est connue) : pas de requalification, comportement inchangé', () => {
 const m = {to_city: 'Albertville', to_department: '73',
  destination: {lat: 45.67766, lng: 6.3918, city: 'Albertville', country: 'France', postal_code: '73200'}};
 const c = G.coordonnees(m, 'destination');
 assert.ok(c);
 // Pas d'adresse de rue exploitable (x.a.length<4 dans centreCommune) : reste « gps » comme avant.
 assert.equal(c.precision, 'gps');
});
