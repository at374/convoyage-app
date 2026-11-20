// Convoyage Ultra V113 — lecture des missions DriiveMe (fonctions pures, testées sous Node, sans DOMParser : le service worker n'en a pas).
// Source : fragment HTML « /fr-FR/component/transport-list?departureCityId=…&page=N » (le même que celui que la page « Rechercher une mission » charge).
// Jamais lu ni gardé : cookie, jeton, nom ou téléphone — seulement le trajet, les dates, le prix et la distance.
(function (root) {
  'use strict';
  const HOTE = 'https://www.driiveme.com';
  const decode = s => String(s == null ? '' : s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
  const propre = s => decode(String(s == null ? '' : s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  const dep = cp => { const s = String(cp); if (/^97[1-6]/.test(s)) return s.slice(0, 3); if (s.startsWith('20')) return Number(s) < 20200 ? '2A' : '2B'; return s.slice(0, 2); };
  // « AAAA-MM-JJ » (ou « JJ/MM/AAAA ») + heure de Paris → instant ISO.
  function iso(jour, h, m) {
    let y, mo, d; let t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour || ''); if (t) { y = +t[1]; mo = +t[2]; d = +t[3]; } else { t = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(jour || ''); if (!t) return null; y = +t[3]; mo = +t[2]; d = +t[1]; }
    for (const off of [1, 2]) {
      const dt = new Date(Date.UTC(y, mo - 1, d, (h || 0) - off, m || 0));
      try { const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(dt); if (parseInt(p, 10) === (h || 0)) return dt.toISOString(); } catch (_) {}
    }
    return new Date(Date.UTC(y, mo - 1, d, (h || 0) - 1, m || 0)).toISOString();
  }
  const bloc = (c, cote) => {   // <span class="departure|arrival"> … title="74600 Seynod">Chambéry (Nord)</span>
    const m = new RegExp('<span class="' + cote + '">[\\s\\S]*?title="(\\d{5})\\s+([^"]*)"[^>]*>([^<]*)<').exec(c);
    return m ? { cp: m[1], ville: propre(m[2]), zone: propre(m[3]) } : null;
  };
  // HTML du fragment → { missions: [...], cartes: n }. Une carte illisible est comptée mais ignorée (jamais de mission inventée).
  function parseListe(html) {
    const parts = String(html || '').split(/<div class="block-trajet\b/).slice(1), missions = []; let locations = 0, indisponibles = 0;
    for (const c of parts) {
      const id = (/-details-(\d{4,12})\.html/.exec(c) || [])[1]; const d = bloc(c, 'departure'), a = bloc(c, 'arrival');
      if (!id || !d || !a) {
        // « Location à 1 € » : pas une mission rémunérée (prix « 1 € » sans <span>, lien vers la connexion, pas de page de détails) → ignorée sans alarme.
        // Trajet déjà « Réservé » (par quelqu'un d'autre) ou « Inaccessible » : plus de bouton « Réserver » ni de page de détails → pas une mission disponible, ignorée sans alarme.
        if (!id && /(?<![A-Za-zÀ-ÿ])(?:R[ée]serv[ée]e?|Inaccessible)(?![A-Za-zÀ-ÿ])/.test(propre(c).slice(-70))) { indisponibles++; continue; }
        if (!id && /class=["']price["'][^>]*>\s*1\s*(?:€|&euro;|&#8364;|&#x20ac;)/i.test(c) && !/class=["']price["'][^>]*>\s*<span/i.test(c)) locations++;
        continue;
      }
      const val = n => { const m = new RegExp('name="' + n + '"\\s+value="([^"]*)"').exec(c); return m ? decode(m[1]) : ''; };
      const href = (/href="(\/fr-FR\/mission\/[^"]+-details-\d+\.html)"/.exec(c) || [])[1] || '';
      const pm = /class=["']price["'][^>]*>\s*<span[^>]*>([\d\s]+)<\/span>\s*,\s*(\d{1,2})/.exec(c);
      const prix = pm ? Number(pm[1].replace(/\s/g, '') + '.' + pm[2].padEnd(2, '0')) : null;
      const km = (/Distance du trajet[\s\S]*?class="value">\s*([\d\s]+)\s*km/.exec(c) || [])[1];
      const duree = (/Dur[ée]e du trajet[\s\S]*?class="value">([^<]+)</.exec(c) || [])[1];
      const fin = /Fin de l(?:'|&#0?39;|&#x27;)offre le<br\s*\/?>\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}):(\d{2})/.exec(c);
      const du = val('filterDateBeginAvailabilityValue'), au = val('filterDateEndAvailabilityValue');
      const client = propre((/propos[ée]e par ([^<]+)</.exec(c) || [])[1] || '');
      missions.push({
        external_id: id, ids: { driiveme: id }, from: d.ville, to: a.ville, from_department: dep(d.cp), to_department: dep(a.cp),
        origin: { city: d.ville, postal_code: d.cp, country: 'France' }, destination: { city: a.ville, postal_code: a.cp, country: 'France' },
        zone_depart: d.zone, zone_arrivee: a.zone,
        dates: { pickup_start: iso(du, 0, 0), pickup_end: iso(au, 23, 59), delivery_end: iso(au, 23, 59) },
        pickup_text: du && au ? (du === au ? du : du + ' → ' + au) : '', offre_fin: fin ? iso(fin[1], +fin[2], +fin[3]) : null,
        fee: prix, fee_key: 'prix', distance_km: km ? Number(km.replace(/\s/g, '')) : null, duration: propre(duree || ''), vehicle: val('filterVehiculeValue') || '',
        client, detail_url: href ? HOTE + href : '', status_raw: 'available'
      });
    }
    return { missions, cartes: parts.length, locations, indisponibles };
  }
  // Réponse de « /fr-FR/search/cities » (JSON) → villes [{ id, nom, cp, dep }].
  function villes(json) {
    const l = json && Array.isArray(json.suggestions) ? json.suggestions : [];
    return l.map(s => { const cp = (/\b(\d{5})\b/.exec(String(s.subName || '')) || [])[1] || ''; return { id: Number(s.id), nom: propre(s.name), cp, dep: cp ? dep(cp) : '' }; }).filter(v => Number.isFinite(v.id) && v.id > 0);
  }
  // La ville de DriiveMe qui représente un département : même nom que le chef-lieu, sinon la première du département.
  function villeDuDepartement(liste, codeDep, chefLieu, norm) {
    const l = (liste || []).filter(v => v.dep === codeDep); if (!l.length) return null;
    return l.find(v => norm(v.nom) === norm(chefLieu)) || l[0];
  }
  // V1.70 : créneaux exacts lus sur la page détail d'une mission (« Départ entre le … / Arrivée entre le … »). La liste ne donne que le jour.
  const MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  function parseDetail(html, base) {
    const h = String(html || ''); const iD = h.search(/D[ée]part entre le/), iA = h.search(/Arriv[ée]e entre le/); if (iD < 0) return null;
    const bm = /^(\d{4})-(\d{2})/.exec(base || ''); const by = bm ? +bm[1] : new Date().getFullYear(), bmo = bm ? +bm[2] : new Date().getMonth() + 1;
    const seg = (a, b) => {
      const t = h.slice(a, b > a ? b : a + 2500); const re = /<span class="strong">\s*(\d{1,2})\s+([^<]+?)\s*<\/span>\s*<br\s*\/?>\s*<span>\s*(\d{1,2}):(\d{2})\s*<\/span>/g; const out = []; let m;
      while ((m = re.exec(t)) && out.length < 2) {
        const mo = MOIS[m[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()]; if (!mo) return null;
        let y = by; if (mo < bmo - 6) y = by + 1; else if (mo > bmo + 6) y = by - 1;
        const r = iso(y + '-' + String(mo).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0'), +m[3], +m[4]); if (!r) return null; out.push(r);
      }
      return out.length === 2 ? out : null;
    };
    const dep = seg(iD, iA > iD ? iA : 0), arr = iA >= 0 ? seg(iA, 0) : null; if (!dep) return null;
    const res = { pickup_start: dep[0], pickup_end: dep[1] }; if (arr) { res.delivery_start = arr[0]; res.delivery_end = arr[1]; } return res;
  }
  // V1.89 : adresse exacte de A et B + véhicule (catégorie, modèle, boîte) lus sur la page détail. On lit le texte de la page : on ne garde jamais le nom de la société / du particulier (première ligne de chaque bloc).
function parseInfos(html) {
const tx = decode(String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n'));
const L = tx.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const nz = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const adr = lignes => {
const l = lignes.filter(s => !/^(Comment |Voir la carte)/i.test(s)); let p = -1; for (let i = l.length - 1; i >= 0; i--) if (/^\d{5}\s+\S/.test(l[i])) { p = i; break; }
if (p < 0) return null; const m = /^(\d{5})\s+(.+)$/.exec(l[p]); const rue = (p >= 2 ? l.slice(1, p) : l.slice(0, p)).join(', ').slice(0, 150);
return { street: rue, postal_code: m[1], city: m[2].slice(0, 80), country: 'France', address: ((rue ? rue + ', ' : '') + l[p]).slice(0, 250) };
};
let A = null, B = null, reprise = null;
const iT = L.findIndex(s => /^Trajet$/i.test(s));
if (iT >= 0) {
let iE = L.findIndex((s, i) => i > iT && /^Disponibilit[ée]$/i.test(s)); if (iE < 0) iE = Math.min(L.length, iT + 45);
const S0 = L.slice(iT + 1, iE), iRes = S0.findIndex(s => /^Restitution$/i.test(s)); const S = iRes >= 0 ? S0.slice(0, iRes) : S0, iA = S.findIndex(s => s === 'A'), iB = S.findIndex(s => s === 'B');
// V270 : « Livraison & Reprise » = 2 étapes (A→B puis B→C) ; la section « Restitution » donne B→C. On la lit à part pour ne jamais prendre C pour l'arrivée de la 1re étape.
if (iRes >= 0) { const R = S0.slice(iRes + 1), jB = R.findIndex(s => s === 'B'), jC = R.findIndex(s => s === 'C'); if (jB >= 0 && jC > jB) { const RO = adr(R.slice(jB + 1, jC)), RD = adr(R.slice(jC + 1)); if (RO && RD) reprise = { origin_address: RO.address, destination_address: RD.address }; } }
if (iA >= 0 && iB > iA) { A = adr(S.slice(iA + 1, iB)); B = adr(S.slice(iB + 1)); }
else { const iR = S.findIndex(s => /^Comment s.y rendre/i.test(s)), iW = S.findIndex(s => /^Comment revenir/i.test(s)); if (iR > 0 && iW > iR) { A = adr(S.slice(0, iR)); B = adr(S.slice(iR + 1, iW)); } }
}
const lireVeh = iV => {
const V = L.slice(iV + 1, iV + 30), lab = /^(categorie|nombre de places|transmission|modele|energie|carburant|motorisation|assurance)/;
const val = re => { const i = V.findIndex(s => s.length < 25 && re.test(nz(s))); if (i < 0) return ''; const v = V[i + 1] || ''; return v && !lab.test(nz(v)) ? v.slice(0, 60) : ''; };
const o = { category: val(/^categorie/), model: val(/^modele/), gearbox: val(/^transmission/), energy: val(/^(energie|carburant|motorisation)/) };
for (const k of Object.keys(o)) if (!o[k]) delete o[k]; return Object.keys(o).length ? o : null;
};
let veh = null; const iV = L.findIndex((s, i) => /^V[ée]hicule(?: [àa] livrer)?$/i.test(s) && L.slice(i + 1, i + 8).some(x => /^Cat[ée]gorie/i.test(x)));
if (iV >= 0) veh = lireVeh(iV);
// V270 : véhicule repris (2e étape) + total de la mission (km, durée) lus dans l'en-tête de la fiche
if (reprise) { const iR = L.findIndex((s, i) => /^V[ée]hicule [àa] reprendre$/i.test(s) && L.slice(i + 1, i + 8).some(x => /^Cat[ée]gorie/i.test(x))); if (iR >= 0) { const vr = lireVeh(iR); if (vr) reprise.vehicle = vr; } const T = L.slice(0, iT >= 0 ? iT : 40); const tk = T.map(s => /^(\d[\d ]*)\s*km$/i.exec(s)).find(Boolean); const td = T.find(s => /^\d+\s*heures?(?:\s*\d+\s*mins?)?$|^\d+\s*mins?$/i.test(s)); if (tk) reprise.total_km = Number(tk[1].replace(/\s/g, '')); if (td) reprise.total_duree = td; veh = Object.assign({}, veh || {}, { reprise }); }
const suites = []; const rxA = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let mm; const src = String(html || '');
while ((mm = rxA.exec(src)) && suites.length < 15) { if (!/list-group-item/.test(mm[1])) continue; const h = /href="([^"]*-details-(\d+)\.html)"/.exec(mm[1]); if (!h || suites.some(z => z.id === h[2])) continue; const tt = decode(mm[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); suites.push({ id: h[2], href: h[1], texte: tt.slice(0, 200) }); }
if (!A && !B && !veh && !suites.length) return null;
const res = {}; if (A) { res.origin_address = A.address; res.origin = { street: A.street, postal_code: A.postal_code, city: A.city, country: A.country }; }
if (B) { res.destination_address = B.address; res.destination = { street: B.street, postal_code: B.postal_code, city: B.city, country: B.country }; }
if (veh) res.vehicle = veh; if (suites.length) res.suites = suites; return res;
}
// V1.99 : une mission « suite possible » construite depuis sa fiche (adresses, véhicule, dates) et le texte du lien (km, durée, prix). Jamais de clic sur Réserver : on lit seulement la page.
function missionSuite(s, html, base) {
const inf = parseInfos(html) || {}; const det = parseDetail(html, base) || null;
const o = inf.origin || {}, d = inf.destination || {}; if (!o.city || !d.city || !s || !s.id) return null;
const p = String(s.texte || '').split('|').map(x => x.trim());
const km = /(\d[\d\s]*)\s*km/.exec(p[1] || ''); const pm = /(\d[\d\s]*)(?:[,.](\d{1,2}))?\s*€/.exec(p[3] || '');
const prix = pm ? Number(pm[1].replace(/\s/g, '') + '.' + String(pm[2] || '0').padEnd(2, '0')) : null;
const du = det && det.pickup_start ? String(det.pickup_start).slice(0, 10) : '', au = det && det.pickup_end ? String(det.pickup_end).slice(0, 10) : du;
return {
external_id: String(s.id), ids: { driiveme: String(s.id) }, from: o.city, to: d.city, from_department: dep(o.postal_code), to_department: dep(d.postal_code),
origin: { ...o }, destination: { ...d }, origin_address: inf.origin_address || '', destination_address: inf.destination_address || '',
dates: det || {}, pickup_text: du ? (du === au ? du : du + ' → ' + au) : '', offre_fin: null,
fee: prix, fee_key: 'prix', distance_km: km ? Number(km[1].replace(/\s/g, '')) : null, duration: p[2] || '', vehicle: inf.vehicle || '',
client: '', detail_url: HOTE + s.href, status_raw: 'available', infos: true, creneau: !!det
};
}
const api = { parseInfos, parseDetail, parseListe, missionSuite, villes, villeDuDepartement, iso, dep, HOTE, TAILLE_PAGE: 20 };
  root.CPDriiveMe = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
