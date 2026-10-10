// Convoyage Ultra V78 — géographie (fonctions pures, sans service extérieur ni envoi de données).
// Départements, régions, villes principales ; suggestions dès 3 lettres ; filtres départ / arrivée ;
// distances ESTIMÉES (à vol d'oiseau × coefficient routier) : jamais présentées comme exactes.
(function (root) {
  'use strict';
  const REGIONS = {
    ARA: 'Auvergne-Rhône-Alpes', BFC: 'Bourgogne-Franche-Comté', BRE: 'Bretagne', CVL: 'Centre-Val de Loire', COR: 'Corse',
    GES: 'Grand Est', HDF: 'Hauts-de-France', IDF: 'Île-de-France', NOR: 'Normandie', NAQ: 'Nouvelle-Aquitaine',
    OCC: 'Occitanie', PDL: 'Pays de la Loire', PAC: 'Provence-Alpes-Côte d’Azur',
    GUA: 'Guadeloupe', MTQ: 'Martinique', GUF: 'Guyane', REU: 'La Réunion', MAY: 'Mayotte'
  };
  // code : [nom, région, chef-lieu, latitude, longitude du chef-lieu]
  const D = {
    '01': ['Ain', 'ARA', 'Bourg-en-Bresse', 46.205, 5.226], '02': ['Aisne', 'HDF', 'Laon', 49.564, 3.620], '03': ['Allier', 'ARA', 'Moulins', 46.566, 3.333],
    '04': ['Alpes-de-Haute-Provence', 'PAC', 'Digne-les-Bains', 44.092, 6.236], '05': ['Hautes-Alpes', 'PAC', 'Gap', 44.559, 6.079], '06': ['Alpes-Maritimes', 'PAC', 'Nice', 43.710, 7.262],
    '07': ['Ardèche', 'ARA', 'Privas', 44.735, 4.599], '08': ['Ardennes', 'GES', 'Charleville-Mézières', 49.763, 4.720], '09': ['Ariège', 'OCC', 'Foix', 42.965, 1.607],
    '10': ['Aube', 'GES', 'Troyes', 48.297, 4.074], '11': ['Aude', 'OCC', 'Carcassonne', 43.213, 2.349], '12': ['Aveyron', 'OCC', 'Rodez', 44.350, 2.575],
    '13': ['Bouches-du-Rhône', 'PAC', 'Marseille', 43.296, 5.370], '14': ['Calvados', 'NOR', 'Caen', 49.183, -0.371], '15': ['Cantal', 'ARA', 'Aurillac', 44.926, 2.440],
    '16': ['Charente', 'NAQ', 'Angoulême', 45.648, 0.156], '17': ['Charente-Maritime', 'NAQ', 'La Rochelle', 46.160, -1.151], '18': ['Cher', 'CVL', 'Bourges', 47.081, 2.399],
    '19': ['Corrèze', 'NAQ', 'Tulle', 45.267, 1.772], '2A': ['Corse-du-Sud', 'COR', 'Ajaccio', 41.919, 8.738], '2B': ['Haute-Corse', 'COR', 'Bastia', 42.697, 9.451],
    '21': ['Côte-d’Or', 'BFC', 'Dijon', 47.322, 5.041], '22': ['Côtes-d’Armor', 'BRE', 'Saint-Brieuc', 48.514, -2.765], '23': ['Creuse', 'NAQ', 'Guéret', 46.171, 1.871],
    '24': ['Dordogne', 'NAQ', 'Périgueux', 45.184, 0.721], '25': ['Doubs', 'BFC', 'Besançon', 47.238, 6.024], '26': ['Drôme', 'ARA', 'Valence', 44.933, 4.892],
    '27': ['Eure', 'NOR', 'Évreux', 49.027, 1.151], '28': ['Eure-et-Loir', 'CVL', 'Chartres', 48.446, 1.489], '29': ['Finistère', 'BRE', 'Quimper', 47.996, -4.102],
    '30': ['Gard', 'OCC', 'Nîmes', 43.837, 4.360], '31': ['Haute-Garonne', 'OCC', 'Toulouse', 43.605, 1.444], '32': ['Gers', 'OCC', 'Auch', 43.646, 0.586],
    '33': ['Gironde', 'NAQ', 'Bordeaux', 44.838, -0.579], '34': ['Hérault', 'OCC', 'Montpellier', 43.611, 3.877], '35': ['Ille-et-Vilaine', 'BRE', 'Rennes', 48.117, -1.678],
    '36': ['Indre', 'CVL', 'Châteauroux', 46.810, 1.691], '37': ['Indre-et-Loire', 'CVL', 'Tours', 47.394, 0.685], '38': ['Isère', 'ARA', 'Grenoble', 45.188, 5.724],
    '39': ['Jura', 'BFC', 'Lons-le-Saunier', 46.675, 5.555], '40': ['Landes', 'NAQ', 'Mont-de-Marsan', 43.890, -0.500], '41': ['Loir-et-Cher', 'CVL', 'Blois', 47.586, 1.335],
    '42': ['Loire', 'ARA', 'Saint-Étienne', 45.440, 4.387], '43': ['Haute-Loire', 'ARA', 'Le Puy-en-Velay', 45.043, 3.885], '44': ['Loire-Atlantique', 'PDL', 'Nantes', 47.218, -1.554],
    '45': ['Loiret', 'CVL', 'Orléans', 47.903, 1.909], '46': ['Lot', 'OCC', 'Cahors', 44.448, 1.441], '47': ['Lot-et-Garonne', 'NAQ', 'Agen', 44.203, 0.616],
    '48': ['Lozère', 'OCC', 'Mende', 44.518, 3.500], '49': ['Maine-et-Loire', 'PDL', 'Angers', 47.478, -0.563], '50': ['Manche', 'NOR', 'Saint-Lô', 49.116, -1.091],
    '51': ['Marne', 'GES', 'Châlons-en-Champagne', 48.957, 4.363], '52': ['Haute-Marne', 'GES', 'Chaumont', 48.111, 5.139], '53': ['Mayenne', 'PDL', 'Laval', 48.073, -0.770],
    '54': ['Meurthe-et-Moselle', 'GES', 'Nancy', 48.692, 6.184], '55': ['Meuse', 'GES', 'Bar-le-Duc', 48.773, 5.160], '56': ['Morbihan', 'BRE', 'Vannes', 47.658, -2.760],
    '57': ['Moselle', 'GES', 'Metz', 49.119, 6.176], '58': ['Nièvre', 'BFC', 'Nevers', 46.990, 3.159], '59': ['Nord', 'HDF', 'Lille', 50.629, 3.057],
    '60': ['Oise', 'HDF', 'Beauvais', 49.430, 2.081], '61': ['Orne', 'NOR', 'Alençon', 48.432, 0.091], '62': ['Pas-de-Calais', 'HDF', 'Arras', 50.291, 2.777],
    '63': ['Puy-de-Dôme', 'ARA', 'Clermont-Ferrand', 45.778, 3.087], '64': ['Pyrénées-Atlantiques', 'NAQ', 'Pau', 43.295, -0.371], '65': ['Hautes-Pyrénées', 'OCC', 'Tarbes', 43.233, 0.078],
    '66': ['Pyrénées-Orientales', 'OCC', 'Perpignan', 42.699, 2.895], '67': ['Bas-Rhin', 'GES', 'Strasbourg', 48.573, 7.752], '68': ['Haut-Rhin', 'GES', 'Colmar', 48.079, 7.358],
    '69': ['Rhône', 'ARA', 'Lyon', 45.764, 4.836], '70': ['Haute-Saône', 'BFC', 'Vesoul', 47.622, 6.155], '71': ['Saône-et-Loire', 'BFC', 'Mâcon', 46.307, 4.828],
    '72': ['Sarthe', 'PDL', 'Le Mans', 48.006, 0.199], '73': ['Savoie', 'ARA', 'Chambéry', 45.564, 5.918], '74': ['Haute-Savoie', 'ARA', 'Annecy', 45.899, 6.129],
    '75': ['Paris', 'IDF', 'Paris', 48.857, 2.352], '76': ['Seine-Maritime', 'NOR', 'Rouen', 49.443, 1.099], '77': ['Seine-et-Marne', 'IDF', 'Melun', 48.540, 2.660],
    '78': ['Yvelines', 'IDF', 'Versailles', 48.805, 2.120], '79': ['Deux-Sèvres', 'NAQ', 'Niort', 46.323, -0.465], '80': ['Somme', 'HDF', 'Amiens', 49.894, 2.296],
    '81': ['Tarn', 'OCC', 'Albi', 43.929, 2.148], '82': ['Tarn-et-Garonne', 'OCC', 'Montauban', 44.018, 1.355], '83': ['Var', 'PAC', 'Toulon', 43.124, 5.928],
    '84': ['Vaucluse', 'PAC', 'Avignon', 43.949, 4.806], '85': ['Vendée', 'PDL', 'La Roche-sur-Yon', 46.670, -1.426], '86': ['Vienne', 'NAQ', 'Poitiers', 46.580, 0.340],
    '87': ['Haute-Vienne', 'NAQ', 'Limoges', 45.834, 1.262], '88': ['Vosges', 'GES', 'Épinal', 48.173, 6.450], '89': ['Yonne', 'BFC', 'Auxerre', 47.798, 3.567],
    '90': ['Territoire de Belfort', 'BFC', 'Belfort', 47.640, 6.863], '91': ['Essonne', 'IDF', 'Évry-Courcouronnes', 48.629, 2.441], '92': ['Hauts-de-Seine', 'IDF', 'Nanterre', 48.892, 2.207],
    '93': ['Seine-Saint-Denis', 'IDF', 'Bobigny', 48.908, 2.440], '94': ['Val-de-Marne', 'IDF', 'Créteil', 48.790, 2.455], '95': ['Val-d’Oise', 'IDF', 'Cergy', 49.036, 2.076],
    '971': ['Guadeloupe', 'GUA', 'Basse-Terre', 15.998, -61.726], '972': ['Martinique', 'MTQ', 'Fort-de-France', 14.616, -61.059], '973': ['Guyane', 'GUF', 'Cayenne', 4.922, -52.313],
    '974': ['La Réunion', 'REU', 'Saint-Denis', -20.882, 55.450], '976': ['Mayotte', 'MAY', 'Mamoudzou', -12.781, 45.228]
  };
  // Autres villes utiles au convoyage (grandes villes, aéroports, sites automobiles) : [nom, département, lat, lng].
  const V = [
    ['Villeurbanne', '69', 45.767, 4.880], ['Vénissieux', '69', 45.697, 4.886], ['Saint-Priest', '69', 45.696, 4.944], ['Chaponost', '69', 45.710, 4.742], ['Villefranche-sur-Saône', '69', 45.990, 4.718],
    ['Colombier-Saugnieu', '69', 45.726, 5.108], ['Blyes', '01', 45.845, 5.249], ['Oyonnax', '01', 46.257, 5.655], ['Vienne', '38', 45.525, 4.874], ['Bourgoin-Jallieu', '38', 45.586, 5.274], ['Voiron', '38', 45.364, 5.589],
    ['Annemasse', '74', 46.193, 6.234], ['Thonon-les-Bains', '74', 46.371, 6.479], ['Albertville', '73', 45.676, 6.392], ['Aix-les-Bains', '73', 45.689, 5.915], ['Roanne', '42', 46.036, 4.068],
    ['Vichy', '03', 46.128, 3.426], ['Montluçon', '03', 46.340, 2.603], ['Montélimar', '26', 44.558, 4.751], ['Romans-sur-Isère', '26', 45.043, 5.051],
    ['Chalon-sur-Saône', '71', 46.781, 4.854], ['Beaune', '21', 47.025, 4.840], ['Dole', '39', 47.092, 5.490], ['Pontarlier', '25', 46.904, 6.354], ['Montbéliard', '25', 47.510, 6.798], ['Sochaux', '25', 47.509, 6.829], ['Sens', '89', 48.197, 3.283],
    ['Brest', '29', 48.390, -4.486], ['Morlaix', '29', 48.578, -3.828], ['Lorient', '56', 47.748, -3.370], ['Saint-Malo', '35', 48.649, -2.026], ['Vitré', '35', 48.124, -1.209],
    ['Vierzon', '18', 47.222, 2.069], ['Montargis', '45', 47.998, 2.733], ['Dreux', '28', 48.737, 1.366],
    ['Reims', '51', 49.258, 4.032], ['Épernay', '51', 49.040, 3.959], ['Sedan', '08', 49.702, 4.940], ['Saint-Dizier', '52', 48.638, 4.949], ['Lunéville', '54', 48.589, 6.496],
    ['Thionville', '57', 49.358, 6.168], ['Forbach', '57', 49.188, 6.896], ['Sarreguemines', '57', 49.110, 7.069], ['Haguenau', '67', 48.816, 7.790], ['Mulhouse', '68', 47.750, 7.336],
    ['Roubaix', '59', 50.690, 3.181], ['Tourcoing', '59', 50.724, 3.161], ['Dunkerque', '59', 51.034, 2.377], ['Valenciennes', '59', 50.357, 3.523], ['Douai', '59', 50.370, 3.080], ['Maubeuge', '59', 50.278, 3.972],
    ['Calais', '62', 50.951, 1.858], ['Boulogne-sur-Mer', '62', 50.726, 1.614], ['Lens', '62', 50.432, 2.831], ['Béthune', '62', 50.530, 2.640], ['Abbeville', '80', 50.106, 1.834],
    ['Saint-Quentin', '02', 49.847, 3.287], ['Compiègne', '60', 49.418, 2.826],
    ['Boulogne-Billancourt', '92', 48.835, 2.240], ['Argenteuil', '95', 48.947, 2.248], ['Roissy-en-France', '95', 49.004, 2.517], ['Saint-Denis', '93', 48.936, 2.357], ['Montreuil', '93', 48.864, 2.443],
    ['Orly', '94', 48.743, 2.402], ['Rungis', '94', 48.747, 2.349], ['Massy', '91', 48.730, 2.271], ['Chessy', '77', 48.873, 2.783], ['Meaux', '77', 48.960, 2.879], ['Fontainebleau', '77', 48.405, 2.702],
    ['Poissy', '78', 48.929, 2.046], ['Flins-sur-Seine', '78', 48.965, 1.873], ['Mantes-la-Jolie', '78', 48.991, 1.717],
    ['Le Havre', '76', 49.494, 0.108], ['Dieppe', '76', 49.922, 1.078], ['Cherbourg-en-Cotentin', '50', 49.640, -1.616], ['Granville', '50', 48.838, -1.597], ['Lisieux', '14', 49.146, 0.226], ['Bayeux', '14', 49.276, -0.703], ['Vernon', '27', 49.093, 1.485],
    ['Saint-Nazaire', '44', 47.273, -2.214], ['Cholet', '49', 47.060, -0.879], ['Saumur', '49', 47.260, -0.077], ['Les Sables-d’Olonne', '85', 46.497, -1.783],
    ['Rochefort', '17', 45.942, -0.962], ['Royan', '17', 45.624, -1.029], ['Cognac', '16', 45.696, -0.329], ['Mérignac', '33', 44.838, -0.646], ['Arcachon', '33', 44.658, -1.168], ['Libourne', '33', 44.915, -0.244],
    ['Bergerac', '24', 44.853, 0.483], ['Brive-la-Gaillarde', '19', 45.159, 1.533], ['Châtellerault', '86', 46.817, 0.546], ['Bayonne', '64', 43.493, -1.475], ['Biarritz', '64', 43.483, -1.559],
    ['Blagnac', '31', 43.636, 1.390], ['Castres', '81', 43.606, 2.241], ['Narbonne', '11', 43.184, 3.004], ['Béziers', '34', 43.344, 3.216], ['Sète', '34', 43.403, 3.694], ['Lourdes', '65', 43.095, -0.046],
    ['Alès', '30', 44.125, 4.081], ['Millau', '12', 44.098, 3.078],
    ['Aix-en-Provence', '13', 43.529, 5.447], ['Marignane', '13', 43.416, 5.215], ['Vitrolles', '13', 43.460, 5.249], ['Aubagne', '13', 43.293, 5.571], ['Martigues', '13', 43.405, 5.048], ['Salon-de-Provence', '13', 43.640, 5.097], ['Arles', '13', 43.677, 4.631],
    ['Orange', '84', 44.138, 4.807], ['Carpentras', '84', 44.055, 5.048], ['Cavaillon', '84', 43.837, 5.038],
    ['Cannes', '06', 43.552, 7.017], ['Antibes', '06', 43.580, 7.125], ['Grasse', '06', 43.659, 6.922], ['Menton', '06', 43.775, 7.497], ['Fréjus', '83', 43.433, 6.737], ['Hyères', '83', 43.120, 6.130]
  ];
  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`\-_.]/g, ' ')
    .replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte').replace(/\s+/g, ' ').trim();

  const DEPARTEMENTS = {}; for (const [code, [nom, region, chefLieu, lat, lng]] of Object.entries(D)) DEPARTEMENTS[code] = { code, nom, region, chefLieu, lat, lng };
  const VILLES = [];
  const vu = new Set();
  const ajouterVille = (nom, dep, lat, lng, source) => { const k = norm(nom) + '|' + dep; if (vu.has(k)) return; vu.add(k); VILLES.push({ nom, dep, lat, lng, n: norm(nom), source }); };
  for (const d of Object.values(DEPARTEMENTS)) ajouterVille(d.chefLieu, d.code, d.lat, d.lng, 'reference');
  for (const [nom, dep, lat, lng] of V) ajouterVille(nom, dep, lat, lng, 'reference');

  // Code département à partir de « 69 », « FR-69 », « 2a », « 974 » ou d'un code postal.
  function codeDepartement(v) {
    const s = String(v == null ? '' : v).trim().toUpperCase().replace(/^FR[-\s]?/, '');
    if (DEPARTEMENTS[s]) return s;
    if (/^\d$/.test(s) && DEPARTEMENTS['0' + s]) return '0' + s;
    const cp = s.match(/^(\d{5})$/); if (cp) return departementDuCodePostal(cp[1]);
    return null;
  }
  function departementDuCodePostal(cp) {
    const s = String(cp); if (!/^\d{5}$/.test(s)) return null;
    if (/^97[1-6]/.test(s)) return DEPARTEMENTS[s.slice(0, 3)] ? s.slice(0, 3) : null;
    if (s.startsWith('20')) return Number(s) < 20200 ? '2A' : '2B';
    return DEPARTEMENTS[s.slice(0, 2)] ? s.slice(0, 2) : null;
  }
  const cpDans = t => { const m = String(t || '').match(/\b(\d{5})\b/); return m ? m[1] : null; };

  function trouverVille(nom, dep) {
    const n = norm(nom); if (!n) return null;
    const l = VILLES.filter(v => v.n === n);
    return (dep && l.find(v => v.dep === dep)) || (l.length === 1 || !dep ? l[0] : null) || null;
  }

  // Côté d'une mission : 'origin' (départ) ou 'destination' (arrivée).
  function departementMission(m, cote) {
    const pre = cote === 'origin' ? 'from' : 'to';
    return codeDepartement(m[pre + '_department']) || departementDuCodePostal(cpDans(m[cote + '_address']) || (m[cote] && m[cote].postal_code) || '') ||
      (trouverVille(m[pre + '_city']) || {}).dep || null;
  }
  // Coordonnées : GPS fourni par la plateforme > ville connue > chef-lieu du département. précision indiquée.
  function coordonnees(m, cote) {
    const p = m[cote]; const pre = cote === 'origin' ? 'from' : 'to';
    if (p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && p.lat !== null && p.lng !== null && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(Number(p.lat) === 0 && Number(p.lng) === 0)) return { lat: Number(p.lat), lng: Number(p.lng), precision: 'gps' };
    const dep = departementMission(m, cote);
    const v = trouverVille(m[pre + '_city'] || (p && p.city), dep); if (v) return { lat: v.lat, lng: v.lng, precision: 'ville' };
    if (dep) return { lat: DEPARTEMENTS[dep].lat, lng: DEPARTEMENTS[dep].lng, precision: 'departement' };
    return null;
  }
  function volOiseauKm(a, b) {
    if (!a || !b) return null;
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const COEF_ROUTE = 1.25;   // estimation : distance routière ≈ 1,25 × vol d'oiseau (moyenne française)
  function routeKm(a, b) { const d = volOiseauKm(a, b); return d == null ? null : Math.round(d * COEF_ROUTE); }

  // Villes supplémentaires tirées des missions reçues (GPS si fourni, sinon rattachement au département).
  function villesDesMissions(missions) {
    const out = [], deja = new Set(VILLES.map(v => v.n + '|' + v.dep));
    for (const m of missions || []) for (const cote of ['origin', 'destination']) {
      const nom = m[(cote === 'origin' ? 'from' : 'to') + '_city']; if (!nom) continue;
      const dep = departementMission(m, cote); const k = norm(nom) + '|' + dep; if (deja.has(k)) continue; deja.add(k);
      const c = coordonnees(m, cote);
      out.push({ nom, dep, lat: c ? c.lat : null, lng: c ? c.lng : null, n: norm(nom), source: 'missions', precision: c ? c.precision : null });
    }
    return out;
  }

  // Suggestions : à partir de 3 lettres (ou d'un numéro de département). Villes, départements, régions.
  function suggestions(texte, options = {}) {
    const q = norm(texte), max = options.max || 8;
    const numero = /^(\d{1,3}|2a|2b)$/i.test(String(texte || '').trim());
    if (!numero && q.length < 3) return [];
    const types = options.types || ['ville', 'departement', 'region'];
    const res = [];
    const score = n => { if (n === q) return 0; if (n.startsWith(q)) return 1; if (n.split(' ').some(w => w.startsWith(q))) return 2; if (n.includes(q)) return 3; return -1; };
    if (types.includes('region')) for (const [code, nom] of Object.entries(REGIONS)) { const s = score(norm(nom)); if (s >= 0 && !numero) res.push({ type: 'region', code, libelle: nom, detail: 'région', s: s + 0.2 }); }
    if (types.includes('departement')) for (const d of Object.values(DEPARTEMENTS)) {
      const s = numero ? (d.code.toLowerCase() === String(texte).trim().toLowerCase().padStart(d.code.length === 3 ? 3 : 2, '0') ? 0 : -1) : score(norm(d.nom));
      if (s >= 0) res.push({ type: 'departement', code: d.code, libelle: d.nom + ' (' + d.code + ')', detail: 'département · ' + REGIONS[d.region], s: s + 0.1 });
    }
    if (types.includes('ville') && !numero) for (const v of VILLES.concat(options.villes || [])) {
      const s = score(v.n); if (s >= 0) res.push({ type: 'ville', nom: v.nom, dep: v.dep, lat: v.lat, lng: v.lng, libelle: v.nom + (v.dep ? ' (' + v.dep + ')' : ''), detail: 'ville' + (v.dep && DEPARTEMENTS[v.dep] ? ' · ' + DEPARTEMENTS[v.dep].nom : ''), s: s + 0.3 });
    }
    res.sort((a, b) => a.s - b.s || a.libelle.localeCompare(b.libelle, 'fr'));
    const vus = new Set(); const out = [];
    for (const r of res) { const k = r.type + '|' + r.libelle; if (vus.has(k)) continue; vus.add(k); delete r.s; out.push(r); if (out.length >= max) break; }
    return out;
  }

  // zone : { type:'ville', nom, dep, lat, lng } | { type:'departement', code } | { type:'region', code } ; cote : 'depart' | 'arrivee' | 'tous'
  // rayonKm (villes) : 0 = ville exacte ; sinon distance estimée autour de la ville (si coordonnées connues).
  function correspondCote(m, zone, cote, rayonKm) {
    const c = cote === 'depart' ? 'origin' : 'destination', pre = cote === 'depart' ? 'from' : 'to';
    if (zone.type === 'departement') return departementMission(m, c) === zone.code;
    if (zone.type === 'region') { const d = departementMission(m, c); return !!(d && DEPARTEMENTS[d].region === zone.code); }
    if (zone.type === 'ville') {
      const nomM = norm(m[pre + '_city'] || (m[c] && m[c].city));
      if (nomM && nomM === norm(zone.nom)) { const d = departementMission(m, c); if (!zone.dep || !d || d === zone.dep) return true; }
      if (rayonKm > 0 && zone.lat != null) { const p = coordonnees(m, c); if (p && p.precision !== 'departement') return routeKm(zone, p) <= rayonKm; }
      return false;
    }
    return false;
  }
  function correspond(m, zone, cote, rayonKm) {
    if (cote === 'depart' || cote === 'arrivee') return correspondCote(m, zone, cote, rayonKm);
    return correspondCote(m, zone, 'depart', rayonKm) || correspondCote(m, zone, 'arrivee', rayonKm);
  }
  // Plusieurs zones : une mission est gardée si elle correspond à AU MOINS une zone de départ (s'il y en a)
  // ET à au moins une zone d'arrivée (s'il y en a) ET à au moins une zone « départ ou arrivée » (s'il y en a).
  function filtrer(missions, zones, rayonKm) {
    if (!zones || !zones.length) return missions.slice();
    const groupes = ['depart', 'arrivee', 'tous'].map(c => zones.filter(z => (z.cote || 'tous') === c)).map((l, i) => [['depart', 'arrivee', 'tous'][i], l]).filter(([, l]) => l.length);
    return missions.filter(m => groupes.every(([c, l]) => l.some(z => correspond(m, z, c, rayonKm || 0))));
  }
  function libelleZone(z) {
    if (z.type === 'departement') return DEPARTEMENTS[z.code] ? DEPARTEMENTS[z.code].nom + ' (' + z.code + ')' : z.code;
    if (z.type === 'region') return REGIONS[z.code] || z.code;
    return z.nom + (z.dep ? ' (' + z.dep + ')' : '');
  }
  const api = { REGIONS, DEPARTEMENTS, VILLES, norm, codeDepartement, departementDuCodePostal, trouverVille, departementMission, coordonnees, volOiseauKm, routeKm, COEF_ROUTE, villesDesMissions, suggestions, correspond, filtrer, libelleZone };
  root.CPGeo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
