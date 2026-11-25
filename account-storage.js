// La portée reste attachée à la session qui a ouvert ce document.
(function (root) {
  'use strict';
  const sessionKey = 'cp_session';
  const deviceKeys = new Set(['cp_config', 'cp_apk_vue', 'cp_peages_maj', 'cp_prix_carb']);
  const disk = () => root.localStorage;
  const read = () => {
    try { return JSON.parse(disk().getItem(sessionKey) || 'null'); } catch (_) { return null; }
  };
  const owner = s => s?.project && s?.user_id && s?.access_token ? s.project + '/' + s.user_id : null;
  const identity = s => owner(s) && s.stamp ? owner(s) + '/' + s.stamp : null;
  const active = read();
  const pageIdentity = identity(active);
  const prefix = pageIdentity && 'cp_account:' + encodeURIComponent(owner(active)) + ':';
  const current = () => pageIdentity === identity(read());
  function keyFor(key) {
    if (deviceKeys.has(key)) return key;
    return prefix && current() ? prefix + key : null;
  }
  const storage = {
    getItem(key) { const k = keyFor(key); return k ? disk().getItem(k) : null; },
    setItem(key, value) { const k = keyFor(key); if (k) disk().setItem(k, value); },
    removeItem(key) { const k = keyFor(key); if (k) disk().removeItem(k); },
    key(index) { return keys()[index] || null; },
    get length() { return keys().length; }
  };
  function keys() {
    if (!prefix || !current()) return [];
    const keys = [];
    const store = disk();
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(prefix)) keys.push(k.slice(prefix.length));
    }
    return keys;
  }
  root.CPAccount = { storage, read, identity, current, sessionKey };
  if (typeof module !== 'undefined') module.exports = root.CPAccount;
})(globalThis);
