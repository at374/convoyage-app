// Convoyage Ultra V114 — pastille d'état des plateformes (fonctions pures, testées sous Node).
// Entrée : lignes de la table « sources_etat » (une par plateforme, écrites par l'extension à chaque synchronisation).
// Sortie : une couleur globale (vert / orange / rouge / gris) + le détail par plateforme, en français, sans jargon.
(function (root) {
  'use strict';
  const SEUILS = { Hiflow: [45, 120], DriiveMe: [20, 60], PopValet: [120, 480] };   // PopValet : lu seulement quand tu ouvres l'application Pop Valet (V143)   // [vert jusqu'à, orange jusqu'à] en minutes (Hiflow : lu toutes les 30 min par le téléphone, V1.11) ; au-delà : rouge
  const DEFAUT = [15, 45], EXTENSION_MORTE_MIN = 5, ORDRE = { vert: 0, orange: 1, rouge: 2 };
  const heure = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  function duree(min) { min = Math.max(0, Math.round(min)); if (min < 1) return 'moins d’une minute'; if (min < 60) return min + ' min'; const h = Math.floor(min / 60), m = min % 60; return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : ''); }
  function ligne(l, maintenant) {
    const [v, o] = SEUILS[l.platform] || DEFAUT, lu = Date.parse(l.lu_le || ''), age = Number.isFinite(lu) ? (maintenant - lu) / 60000 : null;
    const repos = Date.parse(l.prochain_essai || '') > maintenant ? Date.parse(l.prochain_essai) : null;
    const base = { platform: l.platform, ageMin: age };
    if (age == null) return { ...base, couleur: 'rouge', texte: 'jamais lue' + (l.message ? ' — ' + l.message : '') };
    if (repos) return { ...base, couleur: age > 180 ? 'rouge' : 'orange', texte: 'en pause jusqu’à ' + heure(repos) + ' (la plateforme limite les lectures) — dernière lecture il y a ' + duree(age) };
    if (!l.ok) return { ...base, couleur: age <= o ? 'orange' : 'rouge', texte: (l.message || 'dernière lecture échouée') + ' — dernière lecture réussie il y a ' + duree(age) };
    if (age <= v) return { ...base, couleur: 'vert', texte: 'lue il y a ' + duree(age) };
    return { ...base, couleur: age <= o ? 'orange' : 'rouge', texte: 'pas lue depuis ' + duree(age) };
  }
  // lignes : tableau (peut être vide) ou null si la table n'existe pas encore sur le serveur.
  function etat(lignes, maintenant, options) {
    const now = maintenant == null ? Date.now() : maintenant, opt = options || {};
    if (opt.horsConnexion) return { couleur: 'gris', resume: 'Hors connexion : état des plateformes inconnu', details: [] };
    if (lignes == null) return { couleur: 'gris', resume: 'État inconnu : le serveur n’est pas encore à jour (exécute maj_V114.sql dans Supabase)', details: [] };
    if (!lignes.length) return { couleur: 'gris', resume: 'Aucune plateforme lue pour l’instant : ouvre l’extension sur ton ordinateur ou ton VPS', details: [] };
    const details = lignes.map(l => ligne(l, now)).sort((a, b) => a.platform.localeCompare(b.platform, 'fr'));
    const maj = Math.max(...lignes.map(l => Date.parse(l.maj_le || '') || 0));
    if (maj && (now - maj) / 60000 > EXTENSION_MORTE_MIN) return { couleur: 'rouge', resume: 'L’extension n’a rien envoyé depuis ' + duree((now - maj) / 60000) + ' : ordinateur éteint, Chrome fermé ou connexion coupée ?', details, extensionMuette: true };
    const pire = details.reduce((p, d) => ORDRE[d.couleur] > ORDRE[p] ? d.couleur : p, 'vert');
    const resume = pire === 'vert' ? 'Toutes les plateformes sont à jour' : pire === 'orange' ? 'Lecture ralentie : ' + details.filter(d => d.couleur !== 'vert').map(d => d.platform).join(', ') : 'Problème de lecture : ' + details.filter(d => d.couleur === 'rouge').map(d => d.platform).join(', ');
    return { couleur: pire, resume, details };
  }
  const api = { etat, ligne, duree, SEUILS, EXTENSION_MORTE_MIN };
  root.CPEtat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
