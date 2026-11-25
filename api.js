// Convoyage Ultra — accès au compte en ligne (Supabase : authentification + API REST), sans bibliothèque.
// Le jeton de session est gardé sur l'appareil ; le mot de passe n'est jamais enregistré.
(function (root) {
  'use strict';
  const SESSION = 'cp_session';
  function lireSession() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (_) { return null; } }
  function claims(token) {
    try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
    catch (_) { return {}; }
  }
  class Api {
    constructor(url, cle) {
      this.url = String(url || '').replace(/\/+$/, '');
      this.cle = cle;
      root.CP_CONFIG_ACTIVE = { url: this.url, anonKey: this.cle };
      const saved = lireSession();
      this.session = saved?.project === this.url && saved.stamp && this._sameUser(saved) ? saved : null;
      root.CPAuthenticatedApi = this;
      if (this.session) setTimeout(() => { if (this.connecte) this._partagerNatif(); }, 0);
    }
    _sameUser(s) {
      const c = claims(s?.access_token);
      return !!s?.user_id && c.sub === s.user_id && c.iss === this.url + '/auth/v1';
    }
    _natif() { return root.CPNatif; }
    _partagerNatif() {
      try { this._natif()?.partager(this.url, this.cle, JSON.stringify(this.session)); } catch (_) {}
    }
    get connecte() {
      return !!this.session?.stamp && lireSession()?.stamp === this.session.stamp;
    }
    async _auth(chemin, corps) {
      const r = await fetch(this.url + '/auth/v1/' + chemin, { method: 'POST', headers: { apikey: this.cle, 'content-type': 'application/json' }, body: JSON.stringify(corps) });
      let j = null; try { j = await r.json(); } catch (_) {}
      if (!r.ok) throw Object.assign(new Error(j?.error_description || j?.msg || j?.message || ('Erreur ' + r.status)), { status: r.status });
      return j;
    }
    _garder(j, previous = this.session, replace = true) {
      if (!j?.access_token) return false;
      const next = {
        access_token: j.access_token, refresh_token: j.refresh_token,
        expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000,
        email: j.user?.email || previous?.email || '', user_id: j.user?.id || previous?.user_id || '',
        project: this.url, stamp: replace ? crypto.randomUUID() : previous.stamp
      };
      if (!this._sameUser(next)) throw new Error('Identité de session invalide');
      if (replace) this._verifierCompteAndroid(next);
      else if (!this.connecte || this.session.stamp !== previous.stamp || next.user_id !== previous.user_id) throw new Error('Session modifiée');
      localStorage.setItem(SESSION, JSON.stringify(next));
      this.session = next;
      if (replace) this._partagerNatif();
      return true;
    }
    _verifierCompteAndroid(next) {
      const native = this._natif();
      if (!native) return;
      const key = 'cp_android_owner';
      const owner = this.url + '/' + next.user_id;
      const pinned = localStorage.getItem(key);
      let compatible = !pinned || pinned === owner;
      try {
        if (JSON.parse(native.etat()).compte) {
          const active = JSON.parse(native.session());
          compatible = compatible && this._sameUser({ ...active, user_id: next.user_id });
        }
      } catch (_) { compatible = false; }
      if (!compatible) throw new Error('Cette installation Android est liée à un autre compte. Ouvre Convoyage Ultra dans ton navigateur pour utiliser un autre compte.');
      localStorage.setItem(key, owner);
    }
    _ouvrir(j) {
      if (root.CPAccount && !root.CPAccount.current()) throw new Error('Un autre onglet a changé la session.');
      return this._garder(j);
    }
    async connexion(email, motDePasse) {
      if (!this._ouvrir(await this._auth('token?grant_type=password', { email, password: motDePasse }))) throw new Error('Session absente');
    }
    async creerCompte(email, motDePasse) {
      const j = await this._auth('signup', { email, password: motDePasse });
      return this._ouvrir(j) ? 'connecte' : 'confirmation';
    }
    deconnexion() {
      const previous = this.connecte ? this.session : null;
      if (previous) localStorage.removeItem(SESSION);
      this.session = null;
      if (!previous?.access_token) return Promise.resolve();
      return fetch(this.url + '/auth/v1/logout?scope=local', {
        method: 'POST', headers: { apikey: this.cle, authorization: 'Bearer ' + previous.access_token },
        keepalive: true
      }).catch(() => {});
    }
    async jeton(ancienJeton) {
      if (!this.connecte) throw new Error('Non connecté');
      if (ancienJeton === this.session.access_token || Date.now() > this.session.expires_at - 60000) {
        try { await this._rafraichir(); }
        catch (e) {
          if (e.status === 400 || e.status === 401 || !this.session?.refresh_token && !this._natif()) {
            this.deconnexion();
          }
          throw e;
        }
      }
      if (!this.connecte) throw new Error('Session modifiée');
      return this.session.access_token;
    }
    _rafraichir() {
      if (!this.refreshing) this.refreshing = this._renouveler().finally(() => { this.refreshing = null; });
      return this.refreshing;
    }
    async _renouveler() {
      const previous = this.session;
      if (!this.connecte) throw new Error('Non connecté');
      const saved = lireSession();
      if (saved.access_token !== previous.access_token && this._sameUser(saved)) { this.session = saved; return; }
      const native = this._natif();
      if (native) {
        try {
          const j = JSON.parse(native.session());
          if (this._sameUser({ ...j, user_id: previous.user_id }) && Number(j.expires_at) > Date.now()) {
            this._garder({ ...j, expires_in: (j.expires_at - Date.now()) / 1000 }, previous, false);
            return;
          }
        } catch (_) {}
      }
      if (!previous.refresh_token) throw new Error('Session expirée : reconnecte-toi.');
      const next = await this._auth('token?grant_type=refresh_token', { refresh_token: previous.refresh_token });
      this._garder(next, previous, false);
    }
    async requete(chemin, options = {}, deja = false) {
      const stamp = this.session?.stamp;
      const token = await this.jeton();
      const r = await fetch(this.url + '/rest/v1/' + chemin, { ...options, headers: { apikey: this.cle, authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(options.headers || {}) } });
      if (!this.connecte || this.session.stamp !== stamp) throw new Error('Session modifiée');
      if (r.status === 401 && !deja) { await this.jeton(token); return this.requete(chemin, options, true); }
      if (!r.ok) { let t = ''; try { t = (await r.json()).message || ''; } catch (_) {} throw new Error('Serveur : ' + (t || 'erreur ' + r.status)); }
      if (r.status === 204) return null;
      const txt = await r.text(); return txt ? JSON.parse(txt) : null;
    }
    // V147 : le serveur ne renvoie que 1000 lignes par requête, et la liste est triée de la plus ancienne à la plus récente : les vieilles missions (passées, acceptées, « plus vues ») remplissaient les 1000 places et les missions récentes n'arrivaient jamais. On lit maintenant toutes les pages.
    async missions() {
      const stamp = this.session?.stamp;
      // V302 : on ne télécharge plus les milliers d'anciennes missions « plus vues » (inutiles) : seules restent celles qui ont un devis Hiflow. Ouverture bien plus rapide. Si le serveur refuse ce filtre, on relit tout comme avant.
      const lire = async filtre => {
        const tout = [];
        for (let d = 0; d < 20000; d += 1000) {
          if (!this.connecte || this.session.stamp !== stamp) throw new Error('Session modifiée');
          const page = (await this.requete('missions?select=*' + filtre + '&order=pickup_start.asc.nullslast,fee.desc.nullslast,external_id.asc&limit=1000&offset=' + d)) || [];
          tout.push(...page);
          if (page.length < 1000) break;
        }
        return tout;
      };
      try { return await lire('&or=(status.neq.plus_vue,fees->>devis_numero.not.is.null)'); } catch (_) { return lire(''); }
    }
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
      const token = await this.jeton();
      const r = await fetch(this.url + '/functions/v1/notifier', { method: 'POST', headers: { apikey: this.cle, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
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
