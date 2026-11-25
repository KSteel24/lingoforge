import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [path.join(root, 'build', 'build.mjs')], { stdio: 'pipe' });
const sw = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
const SCOPE = 'https://example.test/app/';

function setup() {
  const listeners = {}, puts = [], matches = [], fetched = [];
  const store = new Map([[SCOPE + 'index.html', 'INDEX'], [SCOPE, 'ROOT']]);
  const cache = { match: async (k, opts) => { matches.push([k, opts]); return store.get(typeof k === 'string' ? k : k.url); },
    put: async (...a) => { puts.push(a); }, addAll: async () => {} };
  const self = { registration: { scope: SCOPE }, location: { origin: 'https://example.test' }, addEventListener: (t, f) => { listeners[t] = f; },
    clients: { claim: async () => {} }, skipWaiting() {} };
  const ctx = { self, caches: { open: async () => cache, keys: async () => [], delete: async () => true }, URL, Request: class { constructor(u) { this.url = u; } },
    fetch: async (r) => { fetched.push(r.url); return 'NET'; }, Promise };
  vm.createContext(ctx); vm.runInContext(sw, ctx);
  const run = async (req) => { let p = null; listeners.fetch({ request: req, respondWith: (x) => { p = x; } }); return { handled: p !== null, value: p ? await p : undefined }; };
  return { run, puts, matches, fetched };
}

test('SW: Navigation und exakte Shell-URLs kommen aus dem Cache', async () => {
  const s = setup();
  assert.equal((await s.run({ method: 'GET', mode: 'navigate', url: SCOPE + '?x=1' })).value, 'INDEX');
  assert.equal((await s.run({ method: 'GET', mode: 'cors', url: SCOPE + 'index.html' })).value, 'INDEX');
  assert.equal((await s.run({ method: 'GET', mode: 'cors', url: SCOPE })).value, 'ROOT');
});

test('SW: andere Pfade, fremde Origins und Nicht-GET werden nicht abgefangen und nie gecacht', async () => {
  const s = setup();
  for (const [m, u] of [['GET', SCOPE + 'index.html?evil=1'], ['GET', SCOPE + 'x.js'], ['GET', 'https://other.test/a'], ['POST', SCOPE + 'index.html']]) {
    assert.equal((await s.run({ method: m, mode: 'cors', url: u })).handled, false, u);
  }
  assert.equal(s.puts.length, 0);
  assert.ok(s.matches.every(([, o]) => o === undefined), 'kein ignoreSearch');
  assert.ok(!/cache\.put|ignoreSearch/.test(sw.replace(/\/\/.*$/gm, '')));
});
