'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'server/driiveme-sync-deploy/driiveme-sync.cjs'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'server/driiveme-sync-deploy/001_sync_cycles.sql'), 'utf8');

test('DriiveMe rotation batches stop at the end and cannot skip departments', () => {
  assert.match(source, /passes\.slice\(cur0, Math\.min\(cur0 \+ LOT, passes\.length\)\)/);
  assert.match(source, /const curseurSuivant = connexion \? cur0 : \(cur0 \+ aLire\.length\) % passes\.length/);
});

test('DriiveMe only marks unavailable missions after a complete successful national cycle', () => {
  assert.match(source, /if \(curseurSuivant === 0 && !connexion\)/);
  assert.match(source, /if \(!cycleFailed && depsOk === aLire\.length\)/);
  assert.match(source, /await marquerMissionsAbsentes\(SUPABASE_URL, SERVICE_KEY, USER_ID, cycleStartedAt\)/);
  assert.match(source, /if \(depsOk !== aLire\.length \|\| statut !== 'ok'\) cycleFailed = true/);
});

test('DriiveMe purge is scoped to this user, platform, available missions and old last_seen_at', () => {
  assert.match(source, /user_id: 'eq\.' \+ userId/);
  assert.match(source, /platform: 'eq\.' \+ PLATFORM/);
  assert.match(source, /kind: 'eq\.disponible', status: 'eq\.disponible'/);
  assert.match(source, /last_seen_at: 'lt\.' \+ cycleStartedAt/);
  assert.match(source, /body: JSON\.stringify\(\{ status: 'plus_vue' \}\)/);
});

test('cycle state migration is service-role only and user isolated', () => {
  assert.match(migration, /primary key \(user_id, platform\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.plateforme_sync_cycles from anon, authenticated/i);
  assert.match(migration, /grant all on public\.plateforme_sync_cycles to service_role/i);
});
