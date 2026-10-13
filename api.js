// Convoyage Ultra — accès au compte en ligne (Supabase : authentification + API REST), sans bibliothèque.
// Le jeton de session est gardé sur l'appareil ; le mot de passe n'est jamais enregistré.
(function (root) {
  'use strict';
  const SESSION = 'cp_session';
  function lireSession() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (_) { return null; } }
  function ecrireSession(s) { try { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); } catch (_) {} }
  class Api {
    constructor(url, cle) { this.url = String(url || '').replace(/\/+$/, ''); this.cle = cle; this.session = lireSession(); if (this.session) setTimeout(() => this._partagerNatif(), 0); }
    // V145 : dans l'application Android, le compte n'est saisi qu'une fois ici ; la lecture des plateformes le reçoit (CPNatif), et c'est elle qui renouvelle la session.
    _natif() { try { const N = root.CPNatif; return N && JSON.parse(N.etat()).compte ? N : null; } catch (_) { return null; } }
    _partagerNatif() { try { const N = root.CPNatif; if (N && this.session && this.session.access_token && !JSON.parse(N.etat()).compte) N.partager(this.url, this.cle, JSON.stringify(this.session)); } catch (_) {} }
    get connecte() { return !!this.session?.access_token; }
    async _auth(chemin, corps) {
      const r = await fetch(this.url + '/auth/v1/' + chemin, { method: 'POST', headers: { apikey: this.cle, 'content-type': 'application/json' }, body: JSON.stringify(corps) });
      let j = null; try { j = await r.json(); } catch (_) {}
      if (!r.ok) throw new Error(j?.error_description || j?.msg || j?.message || ('Erreur ' + r.status));
      return j;
    }
    _garder(j) {
      if (!j?.access_token) return false;
      this.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000, email: j.user?.email || '', user_id: j.user?.id || '' };
      ecrireSession(this.session); this._partagerNatif(); return true;
    }
    async connexion(email, motDePasse) { this._garder(await this._auth('token?grant_type=password', { email, password: motDePasse })); }
    async creerCompte(email, motDePasse) { const j = await this._auth('signup', { email, password: motDePasse }); return this._garder(j) ? 'connecte' : 'confirmation'; }
    deconnexion() { this.session = null; ecrireSession(null); }
    async _rafraichir() {
      const N = this._natif();
      if (N) { try { const j = JSON.parse(N.session()); if (j && j.access_token) { this.session = { access_token: j.access_token, refresh_token: '', expires_at: j.expires_at, email: j.email || this.session?.email || '', user_id: j.user_id || this.session?.user_id || '' }; ecrireSession(this.session); return; } } catch (_) {} this.deconnexion(); throw new Error('Session expirée : reconnecte-toi.'); }
      if (!this.session?.refresh_token) throw new Error('Session expirée');
      try { this._garder(await this._auth('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token })); }
      catch (e) { this.deconnexion(); throw new Error('Session expirée : reconnecte-toi.'); }
    }
    async requete(chemin, options = {}, deja = false) {
      if (!this.connecte) throw new Error('Non connecté');
      if (this.session.expires_at && Date.now() > this.session.expires_at - 60000) await this._rafraichir();
      const r = await fetch(this.url + '/rest/v1/' + chemin, { ...options, headers: { apikey: this.cle, authorization: 'Bearer ' + this.session.access_token, 'content-type': 'application/json', ...(options.headers || {}) } });
      if (r.status === 401 && !deja) { await this._rafraichir(); return this.requete(chemin, options, true); }
      if (!r.ok) { let t = ''; try { t = (await r.json()).message || ''; } catch (_) {} throw new Error('Serveur : ' + (t || 'erreur ' + r.status)); }
      if (r.status === 204) return null;
      const txt = await r.text(); return txt ? JSON.parse(txt) : null;
    }
    missions() { return this.requete('missions?select=*&order=pickup_start.asc.nullslast,fee.desc.nullslast'); }
    alertes() { return this.requete('alertes?select=*&order=created_at.desc&limit=100'); }
    // V96 : factures validées / payées. Serveur pas encore mis à jour (maj_V96.sql) → liste vide, sans erreur.
    async factures() { try { return (await this.requete('factures?select=*&order=emise_le.desc.nullslast&limit=500')) || []; } catch (_) { return null; } }
    // V114 : état de lecture des plateformes (envoyé par l'extension). Table absente (maj_V114.sql pas exécuté) → null.
    async sourcesEtat() { try { return (await this.requete('sources_etat?select=*')) || []; } catch (_) { return null; } }
    marquerLues() { return this.requete('alertes?lue=eq.false', { method: 'PATCH', body: JSON.stringify({ lue: true }), headers: { prefer: 'return=minimal' } }); }
    marquerLue(id) { return this.requete('alertes?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ lue: true }), headers: { prefer: 'return=minimal' } }); }
    async reglages() { const r = await this.requete('reglages?select=*'); return (r && r[0]) || null; }
    async enregistrerReglages(v) {
      const envoi = w => this.requete('reglages?on_conflict=user_id', { method: 'POST', body: JSON.stringify([{ ...w, user_id: this.session.user_id }]), headers: { prefer: 'resolution=merge-duplicates,return=minimal' } });
      try { return await envoi(v); } catch (e) {
        // V115 : serveur pas encore mis à jour (maj_V115.sql) → on enregistre le reste et on le dit clairement
        if (!('carte_sncf' in v) || !/carte_sncf|trottinette|column|colonne/i.test(String(e && e.message || e))) throw e;
        const { carte_sncf, trottinette, ...reste } = v; await envoi(reste); throw new Error('Réglages enregistrés, SAUF carte SNCF et trottinette : exécute maj_V115.sql dans Supabase.');
      }
    }
    effacerMesDonnees() { return this.requete('rpc/effacer_mes_donnees', { method: 'POST', body: '{}' }); }
    // ---------- V77 : notifications ----------
    async fonction(action) {
      if (!this.connecte) throw new Error('Non connecté');
      if (this.session.expires_at && Date.now() > this.session.expires_at - 60000) await this._rafraichir();
      const r = await fetch(this.url + '/functions/v1/notifier', { method: 'POST', headers: { apikey: this.cle, authorization: 'Bearer ' + this.session.access_token, 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      if (r.status === 404) throw new Error('La fonction de notification n’est pas encore installée sur ton serveur (voir GUIDE_NOTIFICATIONS.txt).');
      let j = null; try { j = await r.json(); } catch (_) {}
      if (!r.ok || !j?.ok) throw new Error(j?.erreur || ('Serveur de notifications : erreur ' + r.status));
      return j;
    }
    async cleNotifications() { return (await this.fonction('cle')).cle_publique; }
    testNotification() { return this.fonction('test'); }
    abonnerPush(a) { return this.requete('push_abonnements?on_conflict=endpoint', { method: 'POST', body: JSON.stringify([a]), headers: { prefer: 'resolution=merge-duplicates,return=minimal' } }); }
    desabonnerPush(endpoint) { return this.requete('push_abonnements?endpoint=eq.' + encodeURIComponent(endpoint), { method: 'DELETE', headers: { prefer: 'return=minimal' } }); }
  }
  root.CPApi = Api;
  if (typeof module !== 'undefined' && module.exports) module.exports = Api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
