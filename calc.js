// Convoyage Ultra — calcul de rentabilité (fonctions pures, partagées par l'application et les tests).
// Estimation affichée comme telle : les frais inconnus restent inconnus, jamais inventés.
(function (root) {
  'use strict';
  const n = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const arr = v => Math.round(v * 100) / 100;
  function dureeHeures(m) {
    const a = Date.parse(m.pickup_start || ''), b = Date.parse(m.delivery_end || m.delivery_start || '');
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    const h = (b - a) / 3600000; return h > 0 && h < 72 ? Math.round(h * 100) / 100 : null;
  }
  // V78 : durée de conduite estimée quand la plateforme ne donne pas l'heure de livraison (distance ÷ 70 km/h + 30 min de remise).
  const VITESSE_CONDUITE = 70;
  function dureeEstimee(m) {
    const h = dureeHeures(m); if (h) return { heures: h, estimee: false };
    const km = n(m.distance_km); if (km != null && km > 0) return { heures: arr(km / VITESSE_CONDUITE + 0.5), estimee: true };
    return { heures: null, estimee: true };
  }
  // Règles par plateforme : aucun remboursement supposé hors catégorie éligible.
  // Hiflow : frais du devis ; carburant supplémentaire seulement après accord.
  const RE_PEAGE = /p[ée]age|toll/i, RE_INCLUS = /exception|except|suppl/i;
  const RE_CARBURANT = /carburant|essence|diesel|gazole|fuel/i;
  const RE_LAVAGE = /lavage|nettoyage|wash/i;
  function fraisRembourses(m) {
    const p = m.platform, fees = m.fees || {};
    const devis = !!fees.devis_numero;
    return Object.entries(fees)
      .filter(([k]) => !/^(devis|facture)_/.test(k) && !/_confirme$|_accord$|_demande$|_demande_effectuee$/.test(k))
      .map(([k,v]) => [k,n(v)]).filter(([,v]) => v != null && v > 0)
      .filter(([k]) => {
        if (TRANSPORT.test(k)) return false; // Traité séparément, Hiflow uniquement.
        if (p === 'Otoqi') return RE_CARBURANT.test(k) || (RE_LAVAGE.test(k) && (m.lavage_demande === true || fees.lavage_demande === true));
        if (p === 'DriiveMe') return RE_PEAGE.test(k) || RE_LAVAGE.test(k);
        if (p === 'PopValet') return RE_CARBURANT.test(k);
        if (p === 'Hiflow') {
          if (RE_CARBURANT.test(k)) return m.carburant_supplementaire_accord === true || fees.carburant_supplementaire_accord === true;
          return devis && (RE_LAVAGE.test(k) || RE_PEAGE.test(k) || RE_INCLUS.test(k));
        }
        return false;
      });
  }
  function peageACharge(m) {
    if (m.platform !== 'Otoqi' && m.platform !== 'PopValet') return { montant: 0, absent: false };
    const e = Object.entries(m.fees || {}).filter(([k]) => RE_PEAGE.test(k)).map(([, v]) => n(v)).filter(x => x !== null);
    return { montant: e.reduce((s, x) => s + x, 0), absent: !e.length };
  }
  // reglages : { taux_cotisations (%), cout_km (€/km à ta charge), prix_minimum }
  function rentabilite(m, reglages) {
    const r = reglages || {}; const fee = n(m.fee);
    if (fee == null) return { connu: false };
    const taux = n(r.taux_cotisations) ?? 21.2;
    const cotisations = Math.round(fee * taux) / 100;
    const km = n(m.distance_km), coutKm = n(r.cout_km) || 0;
    const depenses = coutKm > 0 && km != null ? Math.round(km * coutKm * 100) / 100 : 0;
    const remboursements = fraisRembourses(m).filter(([k]) => !TRANSPORT.test(k)).reduce((s, [, v]) => s + v, 0);   // Seuls les frais éligibles hors transport ; couverture Hiflow traitée séparément.
    const peage = peageACharge(m);
    const net = Math.round((fee - cotisations - depenses - peage.montant) * 100) / 100;
    const h = dureeHeures(m);
    return { connu: true, prestation: fee, remboursements: Math.round(remboursements * 100) / 100, cotisations, taux, depenses, net,
      peageCharge: peage.montant, peageAbsent: peage.absent, heures: h, parHeure: h ? Math.round(net / h * 100) / 100 : null, depensesConnues: coutKm > 0 && km != null };
  }

  // ---------- V78 : rentabilité complète (approche et retour compris) ----------
  // Réglages de liaison (valeurs de travail modifiables) : coût des transports en commun / covoiturage par km,
  // vitesse moyenne porte à porte, domicile (ville uniquement).
  const LIAISON = { cout_transport_km: 0.12, vitesse_liaison: 60 };
  const TRANSPORT = /^(train|taxi|bus|ticket|transport|billet|metro|tram|navette|vtc|avion|flight|plane)$/i;
  function liaison(km, reglages) {
    if (km == null) return null;
    const r = reglages || {};
    const cout = n(r.cout_transport_km) ?? LIAISON.cout_transport_km, v = n(r.vitesse_liaison) || LIAISON.vitesse_liaison;
    if (km < 2) return { km, heures: 0, cout: 0 };   // sur place
    // V137 : transport CHOISI dans les Réglages → prix et durée de CE moyen (sinon estimation générale, comme avant).
    const ch = choixTransport(r);
    if (ch === 'moyenne') { const x = liaisonMoyenne(km, r); if (x) return x; }
    else if (ch === 'moins_cher') { const x = liaisonMoinsChere(km, r, null); if (x) return x; }
    else if (ch) { const m = modeChoisi(r, ch); if (m && (!m.kmMax || km <= m.kmMax)) return { km, mode: m.mode, heures: arr(km / m.vitesse + m.accesH), cout: arr(km * m.coutKm) }; }
    return { km, heures: arr(km / v + 0.33), cout: arr(km * cout) };   // + 20 min d'accès (gare, arrêt)
  }
  // V115 : transport LE MOINS CHER qui arrive à temps. Estimations (pas de prix réels) : covoiturage, bus longue distance, train ; taxi/VTC seulement en dernier recours.
  // Chaque mode = { mode, coutKm, vitesse (km/h), accesH (attente / accès gare, rendez-vous) } ; modifiables via reglages.modes_transport.
  const MODES = [
    { mode: 'covoiturage', coutKm: 0.06, vitesse: 70, accesH: 0.5 },
    { mode: 'bus', coutKm: 0.05, vitesse: 55, accesH: 0.33 },
    { mode: 'flixbus', coutKm: 0.07, vitesse: 75, accesH: 0.5 },                    // V139 : valeurs de travail (car longue distance) : à vérifier sur le site
    { mode: 'blablacar_daily', coutKm: 0.06, vitesse: 60, accesH: 0.5, kmMax: 100 },// V139 : covoiturage du quotidien (trajets courts et réguliers) : valeurs de travail
    { mode: 'train', coutKm: 0.12, vitesse: 100, accesH: 0.33 },
    { mode: 'taxi', coutKm: 1.2, vitesse: 60, accesH: 0.1 }];
  // Cartes SNCF proposées dans les réglages (réduction estimée sur le train ; à vérifier sur SNCF Connect — aucun prix réel n'est lu).
  const CARTES_SNCF = { aucune: { nom: 'Aucune carte', facteur: 1 }, avantage_jeune: { nom: 'Carte Avantage Jeune (12-27 ans)', facteur: 0.7 }, avantage_adulte: { nom: 'Carte Avantage Adulte (27-59 ans ; -30 % surtout week-end ou avec enfant)', facteur: 0.7 }, avantage_senior: { nom: 'Carte Avantage Senior (60 ans et +)', facteur: 0.7 }, illico_liberte: { nom: 'Carte illico LIBERTÉ (TER Auvergne-Rhône-Alpes : -25 % en semaine, -50 % week-end et jours fériés ; estimé à -25 %)', facteur: 0.75 }, liberte: { nom: 'Carte Liberté / abonnement (prix variable, non estimé)', facteur: 1 } };
  const TROTTINETTE = { vitesse: 15, accesH: 0.05, kmMax: 8 };   // trottinette perso : gratuite, courte distance seulement
  const TRANSPORTS_CHOIX = ['moyenne', 'moins_cher', 'covoiturage', 'blablacar_daily', 'flixbus', 'bus', 'train', 'taxi', 'trottinette'];
  const choixTransport = r => { const c = (r && r.transport_choisi) || globalThis.CP_TRANSPORT_CHOISI; return TRANSPORTS_CHOIX.includes(c) ? c : null; };
  function modeChoisi(r, ch) {
    if (ch === 'trottinette') return { mode: 'trottinette', coutKm: 0, vitesse: TROTTINETTE.vitesse, accesH: TROTTINETTE.accesH, kmMax: n(r.trottinette_km_max) || TROTTINETTE.kmMax };
    const f = (CARTES_SNCF[r.carte_sncf] || CARTES_SNCF.aucune).facteur, m = MODES.find(x => x.mode === ch);
    return m ? (m.mode === 'train' ? { ...m, coutKm: Math.round(m.coutKm * f * 1e4) / 1e4 } : m) : null;
  }
  function modesDe(reglages) {
    const r = reglages || {};
    if (Array.isArray(r.modes_transport) && r.modes_transport.length) return r.modes_transport;
    const f = (CARTES_SNCF[r.carte_sncf] || CARTES_SNCF.aucune).facteur;
    const ch = choixTransport(r); if (ch && ch !== 'moins_cher') { const m = modeChoisi(r, ch); if (m) return [m]; }   // V137 : un seul moyen, celui choisi
    // V131 : les bus de villes et villages changent souvent d'horaires et de jours de passage : jamais comptés d'office (case « Compter les bus » dans les Réglages, à cocher seulement si tu as vérifié la ligne).
    const busOk = r.bus_actif === true || globalThis.CP_BUS_ACTIF === true;
    const l = MODES.filter(m => m.mode !== 'bus' || busOk).map(m => m.mode === 'train' ? { ...m, coutKm: Math.round(m.coutKm * f * 1e4) / 1e4 } : m);
    if (r.trottinette === true) l.push({ mode: 'trottinette', coutKm: 0, vitesse: TROTTINETTE.vitesse, accesH: TROTTINETTE.accesH, kmMax: n(r.trottinette_km_max) || TROTTINETTE.kmMax });
    return l;
  }
  // V139 : estimation = MOYENNE des prix et des durées calculés avec les moyens courants (train avec ta carte de réduction, BlaBlaCar, BlaBlaCar Daily, Flixbus, bus/car si la case est cochée) — pas le moins cher : une estimation prudente. Aucun prix réel n'est lu.
  function liaisonMoyenne(km, reglages) {
    const r = { ...(reglages || {}), transport_choisi: 'general' }, f = (CARTES_SNCF[r.carte_sncf] || CARTES_SNCF.aucune).facteur, busOk = r.bus_actif === true || globalThis.CP_BUS_ACTIF === true;
    const l = MODES.filter(m => m.mode !== 'taxi' && (m.mode !== 'bus' || busOk) && (!m.kmMax || km <= m.kmMax)).map(m => m.mode === 'train' ? { ...m, coutKm: m.coutKm * f } : m);
    if (!l.length) return null;
    const c = l.map(m => km * m.coutKm), h = l.map(m => km / m.vitesse + m.accesH), moy = a => a.reduce((x, y) => x + y, 0) / a.length;
    return { km, mode: 'moyenne', heures: arr(moy(h)), cout: arr(moy(c)), nbModes: l.length, modes: l.map(m => m.mode) };
  }
  function liaisonMoinsChere(km, reglages, tempsDispoH) {
    if (km == null) return null;
    if (km < 2) return tempsDispoH != null && tempsDispoH < 0 ? null : { km, heures: 0, cout: 0, mode: 'sur place' };
    const cands = modesDe(reglages).filter(m => !m.kmMax || km <= m.kmMax).map(m => ({ km, mode: m.mode, heures: arr(km / m.vitesse + m.accesH), cout: arr(km * m.coutKm) })).sort((x, y) => x.cout - y.cout || x.heures - y.heures);
    if (tempsDispoH == null) return cands[0];
    return cands.find(x => x.heures <= tempsDispoH) || null;   // null = aucun moyen n'arrive à temps
  }
  // options.approcheKm / options.retourKm : distances estimées (km) depuis / vers le point voulu (domicile ou mission voisine) ;
  // null = inconnu (pas de domicile renseigné ou lieu non localisable) → la ligne reste « inconnue ».
  function rentabiliteComplete(m, reglages, options = {}) {
    const base = rentabilite(m, reglages);
    if (!base.connu) return base;
    const frais = Object.entries(m.fees || {}).filter(([k]) => !/^(devis|facture)_/.test(k) && k !== 'transport_rembourse_confirme').map(([k, v]) => [k, n(v)]).filter(([, v]) => v != null);
    const transportDeclare = arr(frais.filter(([k]) => TRANSPORT.test(k)).reduce((s, [, v]) => s + v, 0));
    const approche = options.approcheLiaison || liaison(n(options.approcheKm), reglages), retour = liaison(n(options.retourKm), reglages);
    const coutTransport = arr((approche ? approche.cout : 0) + (retour ? retour.cout : 0));
    // Les frais remboursés sont avancés puis rendus : effet nul. Seul le transport NON couvert par un remboursement prévu est une dépense.
    // Prudence : le remboursement Hiflow n'est acquis que s'il est explicitement confirmé pour cette mission.
    const transportRembourse = m.platform === 'Hiflow' && (m.transport_rembourse_confirme === true || m.fees?.transport_rembourse_confirme === true);
    const montantPartiel = n(m.transport_rembourse_montant_confirme);
    const transportDevis = m.platform === 'Hiflow' && !!m.fees?.devis_numero
      ? arr(frais.filter(([k]) => TRANSPORT.test(k)).reduce((total, [, v]) => total + Math.max(0, v), 0))
      : 0;
    // Priorité au montant exact inscrit au devis ; ne pas transformer un montant du devis en remboursement illimité.
    const couverture = m.platform !== 'Hiflow' ? 0
      : Math.min(coutTransport, Math.max(0, montantPartiel ?? (transportDevis > 0 ? transportDevis : (m.kind === 'acceptee' && m.fees?.devis_numero ? 0 : (transportRembourse ? coutTransport : 0)))));
    const transportNonCouvert = arr(Math.max(0, coutTransport - couverture));
    // Montant couvert uniquement : un tarif saisi dans fees.train/bus n'est pas un remboursement confirmé.
    const rembTransport = couverture;
    const avances = base.remboursements;
    const depenses = arr(base.depenses + avances + transportNonCouvert + (base.peageCharge || 0));
    const net = arr(base.prestation + base.remboursements - depenses - base.cotisations);
    const duree = dureeEstimee(m);
    const heures = duree.heures == null ? null : arr(duree.heures + (approche ? approche.heures : 0) + (retour ? retour.heures : 0));
    return { ...base, complet: true, approche, retour, rembTransport, transportDeclare, coutTransport, couverture, transportNonCouvert, transportRembourse, fraisAvances: avances, depensesTotales: depenses,
      net, heuresMission: duree.heures, dureeEstimee: duree.estimee, heures, parHeure: heures ? arr(net / heures) : null,
      liaisonsConnues: !!(approche && retour) };
  }
  // V142 : péage estimé par catégorie de véhicule (classes des autoroutes françaises). Base : voiture (classe 1) ≈ 0,09 €/km à péage
  // (tarifs 2026 : Paris-Lyon 41,28 € / ≈ 466 km, Lyon-Marseille 28,17 € / 315 km) ; fourchette 0,08 à 0,11 €/km. Les autres classes sont des
  // multiples indicatifs (classe 2 ≈ 1,5 × la voiture : ordre de grandeur, les barèmes réels varient selon le concessionnaire). Seules les classes 1 et 2 sont affichées : on ne convoie que des voitures et des utilitaires.
  const PEAGE_KM = { bas: 0.08, moyen: 0.09, haut: 0.11 };
  const PEAGE_CLASSES = [
    { classe: 1, nom: 'Voiture, SUV, petit utilitaire', detail: 'hauteur ≤ 2 m, PTAC ≤ 3,5 t', coef: 1 },
    { classe: 2, nom: 'Grand utilitaire, camping-car, voiture + remorque', detail: 'hauteur 2 à 3 m, PTAC ≤ 3,5 t', coef: 1.5 }];
  function estimerPeage(kmPeage) {
    const km = n(kmPeage); if (km == null || km < 0) return null;
    const e = x => Math.round(x * 10) / 10;
    return PEAGE_CLASSES.map(c => ({ classe: c.classe, nom: c.nom, detail: c.detail, euros: e(km * PEAGE_KM.moyen * c.coef), min: e(km * PEAGE_KM.bas * c.coef), max: e(km * PEAGE_KM.haut * c.coef) }));
  }
  const api = { fraisRembourses, peageACharge, estimerPeage, PEAGE_CLASSES, PEAGE_KM, liaisonMoyenne, TRANSPORTS_CHOIX, rentabilite, dureeHeures, dureeEstimee, liaison, liaisonMoinsChere, MODES, CARTES_SNCF, rentabiliteComplete, LIAISON, VITESSE_CONDUITE };
  root.CPCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
