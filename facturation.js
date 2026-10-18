// Convoyage Ultra — module Facturation (V224) : fiche par facture et par mission, vérification des totaux, validation, livre des recettes (CSV + PDF imprimable), texte pour Abby et brouillon Abby (si le navigateur l'autorise).
// Règles : jamais de plaque ici ; Abby = brouillon seulement (jamais finalisé ni encaissé) ; livre = factures PAYÉES, à leur date de paiement.
(function (root) {
  'use strict';
  const L = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
  const E = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const arr = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const num = v => { const x = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = v => Number(v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const jourIso = iso => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }) : '?'; };
  const jourCourt = iso => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Paris' }) : '?'; };
  const moisDe = iso => { const d = new Date(iso); if (!Number.isFinite(d.getTime())) return 'inconnu'; return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(d).slice(0, 7); };
  const nomMois = k => { if (k === 'inconnu') return 'Date inconnue'; const t = new Date(k + '-15T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }); return t.charAt(0).toUpperCase() + t.slice(1); };

  const RUBRIQUES = [
    ['carburant', /carb|fuel|essence|gazole/i, 'Frais de carburant'],
    ['peage', /p[ée]age|toll/i, 'Frais de péage autoroute'],
    ['transport', /transp|train|bus|blabla|sncf|covoit|taxi|navette|retour|billet/i, 'Frais de transport'],
    ['hebergement', /h[ée]berg|hotel|nuit/i, "Frais d'hébergement"]
  ];
  function lignesFrais(fees) {
    const m = new Map();
    for (const [c, v] of Object.entries(fees || {})) {
      if (/^(devis|facture)_/.test(c)) continue;
      const x = num(v); if (!x) continue;
      const r = RUBRIQUES.find(q => q[1].test(c)), k = r ? r[0] : 'autre';
      const o = m.get(k) || { cle: k, designation: r ? r[2] : 'Frais exceptionnels', montant: 0, type: 'disbursement' };
      o.montant = arr(o.montant + x); m.set(k, o);
    }
    return [...m.values()];
  }
  const PLAQUE = /[A-Z]{1,2}-?\d{3}-?[A-Z]{2}/;
  function vehicule(m) {
    let v = m.vehicle; if (v && typeof v === 'object') v = v.type || v.category || v.label || '';
    v = String(v || '').replace(PLAQUE, '').trim();
    return v || 'véhicule';
  }
  const lieu = (v, d) => (v || '?') + (d ? ' (FR' + String(d).toUpperCase() + ')' : '');
  // Fiche d'une mission : une ligne de prestation + une ligne par frais (débours).
  function fiche(m) {
    const dt = m.pickup_start || m.delivery_start || m.delivery_end || '';
    const prest = { designation: 'Convoyage ' + vehicule(m) + ' entre ' + lieu(m.from_city, m.from_department) + ' ► ' + lieu(m.to_city, m.to_department) + ' le ' + jourCourt(dt), montant: num(m.fee) || 0, type: 'service_delivery' };
    const frais = lignesFrais(m.fees);
    const total = arr(prest.montant + frais.reduce((s, x) => s + x.montant, 0));
    return { reference: m.external_id, prestation: prest, frais, total, date: dt };
  }
  function texteAbby(f) {
    return ['Mission n° ' + f.reference, f.prestation.designation + ' — ' + eur(f.prestation.montant)]
      .concat(f.frais.map(x => x.designation + ' (débours) — ' + eur(x.montant)))
      .concat(['Total HT : ' + eur(f.total), 'TVA non applicable, art. 293 B du CGI']).join('\n');
  }
  // Vérification : somme des missions rattachées à la facture ↔ montants de la facture Hiflow.
  function missionsDe(fa, missions) {
    return (missions || []).filter(m => m.platform === 'Hiflow' && m.fees && m.fees.facture_id != null && String(m.fees.facture_id) === String(fa.external_id));
  }
  function verifier(fa, missions) {
    const liees = missionsDe(fa, missions), fs = liees.map(fiche);
    const sp = arr(fs.reduce((s, x) => s + x.prestation.montant, 0)), sf = arr(fs.reduce((s, x) => s + x.frais.reduce((t, y) => t + y.montant, 0), 0));
    const fp = num(fa.prestation), ff = num(fa.frais), nb = num(fa.nb_trajets);
    const ecartP = fp == null ? null : arr(sp - fp), ecartF = ff == null ? null : arr(sf - ff), ecartNb = nb == null ? null : liees.length - nb;
    const probleme = [];
    if (!liees.length) probleme.push('aucune mission retrouvée pour cette facture');
    if (ecartNb) probleme.push('missions : ' + liees.length + ' retrouvée(s) pour ' + nb + ' sur la facture');
    if (ecartP) probleme.push('prestations : écart de ' + eur(ecartP));
    if (ecartF) probleme.push('frais : écart de ' + eur(ecartF));
    return { liees, fiches: fs, sp, sf, fp, ff, ecartP, ecartF, ecartNb, probleme, ok: probleme.length === 0 };
  }
  const cle = fa => String(fa.external_id);
  const valides = () => L('cp_fact_ok', {});
  function valider(fa, v) { const t = valides(); if (v) t[cle(fa)] = new Date().toISOString(); else delete t[cle(fa)]; E('cp_fact_ok', t); }

  // Livre des recettes : seulement les factures PAYÉES, à la date de paiement de la plateforme.
  function livre(factures) {
    const l = (factures || []).filter(f => f.statut === 'payee' && f.payee_le).map(f => ({ f, date: f.payee_le, prest: num(f.prestation) || 0, frais: num(f.frais) || 0, total: num(f.total) ?? arr((num(f.prestation) || 0) + (num(f.frais) || 0)) }));
    l.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const mois = new Map();
    for (const x of l) { const k = moisDe(x.date), g = mois.get(k) || { mois: k, lignes: [], prest: 0, frais: 0, total: 0 }; g.lignes.push(x); g.prest = arr(g.prest + x.prest); g.frais = arr(g.frais + x.frais); g.total = arr(g.total + x.total); mois.set(k, g); }
    return [...mois.values()].sort((a, b) => b.mois.localeCompare(a.mois));
  }
  const virg = v => String(arr(v || 0)).replace('.', ',');
  function csv(mois) {
    const r = [['Date de paiement', 'N° facture', 'Client', 'Prestations HT', 'Débours (frais remboursés)', 'Total', 'Mode de paiement']];
    for (const g of mois) for (const x of g.lignes) r.push([jourIso(x.date), x.f.numero || x.f.external_id, 'FREECARS HIFLOW', virg(x.prest), virg(x.frais), virg(x.total), 'Virement']);
    return '﻿' + r.map(l => l.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  }
  function telecharger(nom, texte, type) {
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texte], { type })); a.download = nom; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true; } catch (_) { return false; }
  }
  function pagePdf(titre, corps) {
    return '<!doctype html><meta charset="utf-8"><title>' + esc(titre) + '</title><style>body{font:14px/1.4 Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px}h2{font-size:16px;margin-top:22px}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{border:1px solid #999;padding:5px 7px;text-align:left}td.d,th.d{text-align:right}small{color:#555}@media print{button{display:none}}</style><button onclick="print()">Imprimer / enregistrer en PDF</button>' + corps;
  }
  function ouvrirPage(html) {
    try { const u = URL.createObjectURL(new Blob([html], { type: 'text/html' })); const w = window.open(u, '_blank'); if (w) return true; } catch (_) {}
    return false;
  }
  function pdfLivre(mois) {
    return pagePdf('Livre des recettes', '<h1>Livre des recettes</h1><small>Encaissements enregistrés à la date de paiement par la plateforme (virement). TVA non applicable, art. 293 B du CGI.</small>' +
      mois.map(g => '<h2>' + esc(nomMois(g.mois)) + '</h2><table><tr><th>Date</th><th>N° facture</th><th>Client</th><th class="d">Prestations</th><th class="d">Débours</th><th class="d">Total</th></tr>' + g.lignes.map(x => '<tr><td>' + esc(jourIso(x.date)) + '</td><td>' + esc(x.f.numero || x.f.external_id) + '</td><td>FREECARS HIFLOW</td><td class="d">' + esc(eur(x.prest)) + '</td><td class="d">' + esc(eur(x.frais)) + '</td><td class="d">' + esc(eur(x.total)) + '</td></tr>').join('') + '<tr><th colspan="3">Total du mois</th><th class="d">' + esc(eur(g.prest)) + '</th><th class="d">' + esc(eur(g.frais)) + '</th><th class="d">' + esc(eur(g.total)) + '</th></tr></table>').join(''));
  }
  function pdfFacture(fa, v) {
    return pagePdf('Facture ' + (fa.numero || fa.external_id), '<h1>Facture Hiflow n° ' + esc(fa.numero || fa.external_id) + '</h1><small>Émise le ' + esc(jourIso(fa.emise_le)) + (fa.payee_le ? ' — payée le ' + esc(jourIso(fa.payee_le)) : '') + '</small>' +
      '<table><tr><th>Mission</th><th class="d">Montant</th></tr>' + v.fiches.map(x => '<tr><td><b>' + esc(x.prestation.designation) + '</b><br><small>n° ' + esc(x.reference) + '</small></td><td class="d">' + esc(eur(x.prestation.montant)) + '</td></tr>' + x.frais.map(y => '<tr><td>' + esc(y.designation) + ' (débours)</td><td class="d">' + esc(eur(y.montant)) + '</td></tr>').join('')).join('') +
      '<tr><th>Total</th><th class="d">' + esc(eur(fa.total)) + '</th></tr></table><small>TVA non applicable, art. 293 B du CGI.</small>');
  }

  // ---- Abby (brouillon seulement) : la clé reste sur cet appareil ----
  const ABBY = 'https://api.app-abby.com';
  async function appelAbby(chemin, methode, corps) {
    const k = L('cp_abby_cle', ''); if (!k) throw new Error('Clé Abby non enregistrée');
    const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
    try {
      const r = await fetch(ABBY + chemin, { method: methode || 'GET', headers: { authorization: 'Bearer ' + k, 'content-type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined, signal: c.signal });
      const tx = await r.text(); let j = null; try { j = JSON.parse(tx); } catch (_) {}
      if (!r.ok) throw new Error('Abby a répondu ' + r.status);
      return j;
    } catch (e) { throw new Error(e && e.name === 'AbortError' ? 'Abby ne répond pas (20 s)' : (e && e.message === 'Failed to fetch' ? 'Le navigateur bloque la connexion à Abby (copie le texte à la place)' : (e && e.message) || 'Erreur Abby')); } finally { clearTimeout(t); }
  }
  const liste = r => Array.isArray(r) ? r : ((r && (r.docs || r.data || r.organizations || r.results || r.items)) || []);
  async function testerAbby() {
    const r = liste(await appelAbby('/organizations?search=FREECARS'));
    const c = r.find(x => /freecars|hiflow/i.test(JSON.stringify(x))) || r[0];
    const id = c && (c.id || c._id); if (!id) throw new Error('Connexion Abby OK, mais le client FREECARS est introuvable');
    E('cp_abby_client', id); return id;
  }
  async function brouillon(fi, m) {
    const envoyes = L('cp_abby_envoye', {}), k = m.platform + '|' + m.external_id;
    if (envoyes[k]) throw new Error('Déjà envoyée à Abby');
    let cid = L('cp_abby_client', ''); if (!cid) cid = await testerAbby();
    const f = await appelAbby('/v2/billing/invoice/' + encodeURIComponent(cid), 'POST', {});
    const id = f && (f.id || f._id || (f.billing && f.billing.id)); if (!id) throw new Error('Abby n’a pas renvoyé de numéro de brouillon');
    const lignes = [fi.prestation].concat(fi.frais).map(x => ({ designation: x.designation, quantity: 1, quantityUnit: 'unit', unitPrice: Math.round(x.montant * 100), type: x.type }));
    await appelAbby('/v2/billing/' + encodeURIComponent(id) + '/lines', 'PATCH', { lines: lignes });
    envoyes[k] = { id, le: new Date().toISOString() }; E('cp_abby_envoye', envoyes); return id;
  }

  // ---- Interface ----
  let ctx = null;
  const $id = i => document.getElementById(i);
  const etiq = (cl, t) => '<span class="etiq ' + cl + '">' + esc(t) + '</span>';
  function copier(t, toast) { try { navigator.clipboard.writeText(t).then(() => toast('Texte copié'), () => toast('Copie impossible')); } catch (_) { toast('Copie impossible'); } }
  function ouvrirFeuille(html) { ctx.contenu.innerHTML = html; ctx.feuille.hidden = false; }

  function carteOutils() {
    const fa = ctx.factures || [], vs = valides();
    let ok = 0, ecart = 0, fait = 0;
    for (const f of fa) { const v = verifier(f, ctx.missions); if (vs[cle(f)]) fait++; else if (v.ok) ok++; else ecart++; }
    return '<div class="carte" id="outilsFact"><h2>Contrôle des factures</h2><table class="tableau"><tr><td>Validées par toi</td><td><b>' + fait + '</b></td></tr><tr><td>Sans écart, à valider</td><td><b>' + ok + '</b></td></tr><tr><td>Avec écart à vérifier</td><td><b>' + ecart + '</b></td></tr></table>' +
      '<div class="boutons"><button id="fValTout"' + (ok ? '' : ' disabled') + '>Valider les ' + ok + ' sans écart</button><button class="second" id="fLivre">Livre des recettes</button><button class="second" id="fAbbyReg">Réglage Abby</button></div>' +
      '<p class="doux">Touche une facture ci-dessous pour voir ses missions, la vérification des totaux et le texte à recopier dans Abby.</p></div>';
  }
  function feuilleFacture(fa) {
    const v = verifier(fa, ctx.missions), vs = valides(), val = !!vs[cle(fa)];
    const ligne = (a, b) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>';
    const verif = '<table class="tableau">' + ligne('Prestations — missions / facture', esc(eur(v.sp)) + ' / ' + (v.fp == null ? '?' : esc(eur(v.fp)))) + ligne('Frais — missions / facture', esc(eur(v.sf)) + ' / ' + (v.ff == null ? '?' : esc(eur(v.ff)))) + ligne('Missions — retrouvées / facture', v.liees.length + ' / ' + (fa.nb_trajets == null ? '?' : esc(fa.nb_trajets))) + '</table>' +
      (v.ok ? '<p>' + etiq('ok', 'Aucun écart') + '</p>' : '<p>' + etiq('ko', 'À vérifier') + '</p><ul>' + v.probleme.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>');
    const missions = v.liees.map((m, i) => { const x = v.fiches[i], k = m.platform + '|' + m.external_id, env = L('cp_abby_envoye', {})[k];
      return '<details class="carte"><summary><b>' + esc(lieu(m.from_city, m.from_department)) + ' → ' + esc(lieu(m.to_city, m.to_department)) + '</b> · ' + esc(eur(x.total)) + '</summary><table class="tableau">' + ligne(esc(x.prestation.designation), esc(eur(x.prestation.montant))) + x.frais.map(y => ligne(esc(y.designation) + ' <small>(débours)</small>', esc(eur(y.montant)))).join('') + '</table><p class="doux">Mission n° ' + esc(x.reference) + '</p>' +
        '<div class="boutons"><button class="second" data-cop="' + i + '">Copier pour Abby</button><button data-abby="' + i + '"' + (env ? ' disabled' : '') + '>' + (env ? 'Brouillon déjà créé' : 'Brouillon Abby') + '</button></div></details>'; }).join('');
    ouvrirFeuille('<h2>Facture n° ' + esc(fa.numero || fa.external_id) + '</h2><p>' + esc(jourIso(fa.emise_le)) + ' · ' + esc(eur(fa.total)) + ' · ' + (fa.statut === 'payee' ? etiq('ok', 'payée' + (fa.payee_le ? ' le ' + jourIso(fa.payee_le) : '')) : etiq('nv', 'validée, en attente de paiement')) + '</p>' + verif +
      '<label><input type="checkbox" id="fCoche"' + (val ? ' checked' : '') + '> Facture vérifiée et validée par moi</label>' + missions + '<div class="boutons"><button class="second" id="fPdfF">Version PDF</button></div><p class="doux" id="fMsg"></p>');
    const msg = t => { const e = $id('fMsg'); if (e) e.textContent = t; };
    $id('fCoche').onchange = e => { valider(fa, e.target.checked); ctx.rafraichir(); };
    $id('fPdfF').onclick = () => { if (!ouvrirPage(pdfFacture(fa, v))) msg('Ouverture bloquée : autorise les fenêtres du site, puis réessaie.'); };
    ctx.contenu.querySelectorAll('[data-cop]').forEach(b => b.onclick = () => copier(texteAbby(v.fiches[+b.dataset.cop]), ctx.toast));
    ctx.contenu.querySelectorAll('[data-abby]').forEach(b => b.onclick = async () => { const i = +b.dataset.abby; b.disabled = true; b.textContent = 'Envoi…'; try { await brouillon(v.fiches[i], v.liees[i]); b.textContent = 'Brouillon créé dans Abby'; msg('Brouillon créé : finalise-le toi-même dans Abby.'); } catch (e) { b.disabled = false; b.textContent = 'Brouillon Abby'; msg(e.message); } });
  }
  function feuilleLivre() {
    const mois = livre(ctx.factures);
    ouvrirFeuille('<h2>Livre des recettes</h2><p class="doux">Factures payées par Hiflow, classées à leur date de paiement.</p>' + (mois.length ? mois.map(g => '<div class="carte"><h3>' + esc(nomMois(g.mois)) + '</h3><table class="tableau"><tr><td>Prestations</td><td>' + esc(eur(g.prest)) + '</td></tr><tr><td>Débours</td><td>' + esc(eur(g.frais)) + '</td></tr><tr><td><b>Total encaissé</b></td><td><b>' + esc(eur(g.total)) + '</b></td></tr></table>' + g.lignes.map(x => '<div class="factureLigne"><span>' + esc(jourIso(x.date)) + ' · n° ' + esc(x.f.numero || x.f.external_id) + '</span><span>' + esc(eur(x.total)) + '</span></div>').join('') + '</div>').join('') : '<div class="vide">Aucune facture payée avec une date de paiement.</div>') +
      '<div class="boutons"><button id="fCsv"' + (mois.length ? '' : ' disabled') + '>Exporter en CSV</button><button class="second" id="fPdfL"' + (mois.length ? '' : ' disabled') + '>Version PDF</button></div><p class="doux" id="fMsg"></p>');
    const b1 = $id('fCsv'), b2 = $id('fPdfL');
    if (b1) b1.onclick = () => { if (!telecharger('livre-des-recettes.csv', csv(mois), 'text/csv;charset=utf-8')) $id('fMsg').textContent = 'Téléchargement impossible'; };
    if (b2) b2.onclick = () => { if (!ouvrirPage(pdfLivre(mois))) $id('fMsg').textContent = 'Ouverture bloquée : autorise les fenêtres du site, puis réessaie.'; };
  }
  function feuilleAbby() {
    ouvrirFeuille('<h2>Réglage Abby</h2><p class="doux">La clé (Abby → Paramètres → Intégrations) reste sur cet appareil. Les brouillons ne sont jamais finalisés ni encaissés : tu le fais toi-même dans Abby.</p><input id="fCle" type="password" placeholder="Clé Abby" autocomplete="off" value="' + (L('cp_abby_cle', '') ? '••••••••' : '') + '"><div class="boutons"><button id="fCleOk">Enregistrer et tester</button><button class="danger" id="fCleNon">Effacer</button></div><p class="doux" id="fMsg"></p>');
    $id('fCleOk').onclick = async () => { const v = $id('fCle').value.trim(); if (v && !/^•+$/.test(v)) E('cp_abby_cle', v); $id('fMsg').textContent = 'Test en cours…'; try { await testerAbby(); $id('fMsg').textContent = 'Connexion Abby OK, client FREECARS trouvé.'; } catch (e) { $id('fMsg').textContent = e.message; } };
    $id('fCleNon').onclick = () => { E('cp_abby_cle', ''); E('cp_abby_client', ''); $id('fMsg').textContent = 'Clé effacée de cet appareil.'; };
  }
  // c = { ecran, factures, missions, feuille, contenu, toast, rafraichir }
  function monter(c) {
    ctx = c;
    const haut = document.createElement('div'); haut.innerHTML = carteOutils();
    c.ecran.insertBefore(haut.firstChild, c.ecran.firstChild);
    const vs = valides();
    c.ecran.querySelectorAll('[data-fact]').forEach(el => {
      const fa = (c.factures || []).find(f => cle(f) === el.dataset.fact); if (!fa) return;
      el.style.cursor = 'pointer'; if (vs[cle(fa)]) el.insertAdjacentHTML('beforeend', ' <span class="etiq ok">validée ✓</span>');
      el.onclick = () => { try { feuilleFacture(fa); } catch (e) { c.toast('Facture : erreur ' + (e && e.message)); } };
    });
    const t = $id('fValTout'); if (t) t.onclick = () => { let n = 0; for (const f of c.factures || []) if (!valides()[cle(f)] && verifier(f, c.missions).ok) { valider(f, true); n++; } c.toast(n + ' facture(s) validée(s)'); c.rafraichir(); };
    $id('fLivre').onclick = feuilleLivre; $id('fAbbyReg').onclick = feuilleAbby;
  }
  root.CPFact = { monter, fiche, verifier, livre, csv, texteAbby, lignesFrais, vehicule };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CPFact;
})(typeof globalThis !== 'undefined' ? globalThis : this);
