/* Détection explicite de l'exigence de plaque W, partagée par les vues de mission. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CPPlaqueW = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normaliser = value => String(value == null ? '' : value)
    .normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[\\u00a0\\u202f]/g, ' ')
    .replace(/[\\u2010-\\u2015\\u2212]/g, '-')
    .toLowerCase().replace(/\\s+/g, ' ').trim();
  const POSITIF = /\\bplaques?\\s+(?:(?:d[' ]immatriculation|de garage|garage|professionnelles?)\\s+)?w\\b|\\bw[ -]?garage\\b|\\bimmatriculation\\s+(?:de\\s+)?w\\b/;
  const NEGATIF = /\\b(?:non\\s+(?:requise?|obligatoire|necessaire|demandee?)|pas\\s+(?:de\\s+)?(?:plaque\\s+w|besoin\\s+de\\s+plaque)|sans\\s+plaque\\s+w|plaque\\s+w\\s+(?:facultative|non\\s+requise?|non\\s+obligatoire)|aucune\\s+plaque\\s+w)\\b/;
  const parseVehicle = mission => {
    let vehicle = mission && mission.vehicle;
    if (typeof vehicle === 'string') {
      try { vehicle = JSON.parse(vehicle); } catch (_) { return null; }
    }
    return vehicle && typeof vehicle === 'object' && !Array.isArray(vehicle) ? vehicle : null;
  };
  const strings = value => Array.isArray(value) ? value.filter(x => typeof x === 'string') :
    (typeof value === 'string' ? [value] : []);
  function requiredText(mission) {
    if (!mission || typeof mission !== 'object') return [];
    const vehicle = parseVehicle(mission);
    const values = [];
    if (vehicle) {
      values.push(...strings(vehicle.competences), ...strings(vehicle.required_competences),
        ...strings(vehicle.requiredCompetences), ...strings(vehicle.requirements));
    }
    values.push(...strings(mission.competences), ...strings(mission.required_competences),
      ...strings(mission.requiredCompetences), ...strings(mission.vehicle_requirements),
      ...strings(mission.vehicleRequirements));
    return values.map(normaliser).filter(Boolean);
  }
  function detect(mission) {
    const vehicle = parseVehicle(mission);
    if ((vehicle && vehicle.plaque_w_required === false) ||
        (mission && (mission.plaque_w_required === false || mission.plaqueWRequired === false))) return false;
    const fields = requiredText(mission);
    if (!fields.some(text => POSITIF.test(text))) return false;
    return !fields.some(text => POSITIF.test(text) && NEGATIF.test(text));
  }
  // SVG original V227 conservé à l'identique.
  const SVG = '<div class="plaqueW" title="Plaque W (garage) exigée"><svg viewBox="0 0 520 110" width="150" height="32" role="img" aria-label="Plaque W garage"><rect x="2" y="2" width="516" height="106" rx="14" fill="#f0559f" stroke="#a8326f" stroke-width="3"/><path d="M16 2H62V108H16A14 14 0 0 1 2 94V16A14 14 0 0 1 16 2Z" fill="#1b3fbf"/><text x="32" y="88" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">F</text><text x="292" y="82" font-family="Arial,sans-serif" font-size="72" font-weight="800" fill="#111" text-anchor="middle">W-123-AA</text></svg></div>';
  return { detect, render: mission => detect(mission) ? SVG : '', normaliser };
});
