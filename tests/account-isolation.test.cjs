const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = name => fs.readFileSync(require.resolve('../' + name + '.js'), 'utf8');
const project = 'https://example.supabase.co';
const token = user => 'a.' + Buffer.from(JSON.stringify({ sub: user, iss: project + '/auth/v1' })).toString('base64url') + '.z';
const auth = user => ({ access_token: token(user), refresh_token: 'refresh-' + user, user: { id: user } });

function browser() {
 const values = new Map();
 const storage = {
  get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
  getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k)
 };
 const page = (fetch, CPNatif) => {
  const tab = vm.createContext({ localStorage: storage, atob, crypto: webcrypto, setTimeout() {}, fetch, CPNatif });
  for (const name of ['account-storage', 'api']) vm.runInContext(source(name), tab);
  return { ...tab.CPAccount, api: new tab.CPApi(project, 'publishable') };
 };
 return { page, storage };
}
const response = j => ({ ok: true, json: async () => j });

test('two accounts keep separate local data, and stale tabs cannot reuse storage', async () => {
 const { page, storage } = browser();
 storage.setItem('cp_cache', 'legacy');
 const fetch = async (url, opts) => response(url.includes('logout') ? {} : auth(JSON.parse(opts.body).email));
 await page(fetch).api.connexion('alice', 'password');
 const alice = page(fetch);
 for (const key of ['cp_cache', 'cp_position', 'cp_factures', 'cp_transport_cache', 'cp_plats_choisies']) alice.storage.setItem(key, 'alice');
 await alice.api.deconnexion();
 assert.equal(alice.storage.getItem('cp_cache'), null);
 await page(fetch).api.connexion('bob', 'password');
 const bob = page(fetch);
 assert.equal(bob.storage.length, 0);
 assert.equal(bob.storage.getItem('cp_cache'), null);
 assert.equal(alice.api.connecte, false);
 alice.storage.setItem('cp_cache', 'late');
 bob.storage.setItem('cp_cache', 'bob');
 assert.equal(bob.storage.getItem('cp_cache'), 'bob');
 await bob.api.deconnexion();
 await page(fetch).api.connexion('alice', 'password');
 assert.equal(page(fetch).storage.getItem('cp_cache'), 'alice');
});

test('a refresh response after logout cannot restore a session', async () => {
 const { page, storage } = browser();
 let finishRefresh;
 const fetch = (url) => url.includes('refresh_token') ? new Promise(resolve => { finishRefresh = resolve; }) : Promise.resolve(response(auth('alice')));
 await page(fetch).api.connexion('alice', 'password');
 const { api } = page(fetch);
 const pending = api.jeton(api.session.access_token);
 await api.deconnexion();
 finishRefresh(response(auth('alice')));
 await assert.rejects(pending, /Session modifiée/);
 assert.equal(storage.getItem('cp_session'), null);
});

test('APK with platform cookies from another account refuses to switch owners', async () => {
 const { page, storage } = browser();
 let shares = 0;
 const native = {
  etat: () => '{"compte":true}', session: () => JSON.stringify(auth('alice')),
  partager() { shares++; }
 };
 const fetch = async (url, opts) => response(auth(JSON.parse(opts.body).email));
 await assert.rejects(page(fetch, native).api.connexion('bob', 'password'), /liée à un autre compte/);
 assert.equal(storage.getItem('cp_session'), null);
 assert.equal(shares, 0);
 await page(fetch, native).api.connexion('alice', 'password');
 assert.equal(shares, 1);
});
