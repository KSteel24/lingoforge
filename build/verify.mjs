// Prüft dist/: CSP-Hash, keine externen URLs, Syntax, verbotene Konstrukte. Exit 1 bei Fehler.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };

const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
ok('genau ein Inline-Script, ohne src', scripts.length === 1 && !/<script\b[^>]*\bsrc=/i.test(html));
const code = scripts[0][1];

const hash = 'sha256-' + crypto.createHash('sha256').update(code, 'utf8').digest('base64');
const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '';
ok('CSP-Hash passt zum Inline-Script', csp.includes(`script-src '${hash}'`), hash);
for (const d of ["default-src 'none'", "style-src 'unsafe-inline'", 'img-src data:', 'manifest-src data:', "connect-src 'none'",
  "media-src 'none'", "base-uri 'none'", "form-action 'none'", "worker-src 'self'"]) ok(`CSP enthält ${d}`, csp.includes(d));

ok('keine http(s)-URLs in index.html', !/https?:\/\//i.test(html), (html.match(/https?:\/\/[^\s"')]+/gi) || []).slice(0, 3).join(' '));
ok('keine externen Referenzen (src/href außer data:/#)', ![...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].some((m) => !/^(data:|#)/.test(m[1])));

let decodedBad = [];
for (const m of html.matchAll(/data:[a-z+\/\-]+;base64,([A-Za-z0-9+\/=]+)/g)) {
  const text = Buffer.from(m[1], 'base64').toString('latin1').replace(/xmlns="[^"]*"/g, '');
  if (/https?:\/\//i.test(text)) decodedBad.push(m[0].slice(0, 40));
}
ok('data-URIs ohne URLs (außer SVG-xmlns)', decodedBad.length === 0, decodedBad.join(','));

ok('Syntax: vm.Script', (() => { try { new vm.Script(code); return true; } catch (e) { console.log(e.message); return false; } })());
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-'));
fs.writeFileSync(path.join(tmp, 'inline.js'), code);
fs.writeFileSync(path.join(tmp, 'sw.js'), sw);
for (const f of ['inline.js', 'sw.js']) {
  let pass = true;
  try { execFileSync(process.execPath, ['--check', path.join(tmp, f)], { stdio: 'pipe' }); } catch (e) { pass = false; console.log(String(e.stderr)); }
  ok(`node --check ${f}`, pass);
}
fs.rmSync(tmp, { recursive: true, force: true });

for (const [name, re] of [['eval', /\beval\s*\(/], ['new Function', /new\s+Function\s*\(/], ['innerHTML', /\binnerHTML\b/],
  ['outerHTML', /\bouterHTML\b/], ['insertAdjacentHTML', /insertAdjacentHTML/], ['document.write', /document\.write/],
  ['fetch(', /\bfetch\s*\(/], ['XMLHttpRequest', /XMLHttpRequest/], ['WebSocket', /WebSocket/], ['sendBeacon', /sendBeacon/],
  ['importScripts', /importScripts/], ['localStorage', /localStorage/], ['SpeechRecognition', /SpeechRecognition/i]]) {
  ok(`Script ohne ${name}`, !re.test(code));
}
ok('sw.js: Cache-Name aus Build-Hash eingesetzt', /lingoforge-[0-9a-f]{12}'/.test(sw) && !sw.includes('__BUILD__'));
ok('sw.js: SKIP_WAITING vorhanden, kein skipWaiting im install', sw.includes('SKIP_WAITING') && !/install[\s\S]*?skipWaiting[\s\S]*?activate/.test(sw.split("addEventListener('message'")[0]));
ok('Platzhalter/TODO frei', !/TODO|FIXME|\{\{[A-Z_]+\}\}/.test(html));

console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : '\nalle Prüfungen bestanden');
process.exit(failed ? 1 : 0);
