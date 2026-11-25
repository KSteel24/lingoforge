// Baut dist/index.html (eine Datei) und dist/sw.js. Nur Node-Built-ins.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { iconSvg, iconPng } from './icon.mjs';

const root = path.resolve(import.meta.dirname, '..');
const src = (...p) => path.join(root, 'src', ...p);
const read = (f) => fs.readFileSync(f, 'utf8');

// Reihenfolge ist bindend (Abhängigkeiten zuerst).
// Aktive Sprachen stehen an EINER Stelle: ENABLED_LANGS in src/js/content-lib.js.
const ENABLED = createRequire(import.meta.url)(src('js', 'content-lib.js')).ENABLED_LANGS;
const MODULES = ['norm', 'fsrs', 'game', 'sched', 'content-lib', 'backup', ...ENABLED.map((l) => `content-${l}`),
  'db', 'speech', 'ui', 'core', 'ex', 'views', 'main'];

const script = ['var LF = {};'].concat(MODULES.map((m) => read(src('js', `${m}.js`)))).join('\n');
if (/<\/script/i.test(script) || script.includes('<!--')) throw new Error('Script enthält </script oder <!--');

const css = read(src('style.css'));
if (/<\/style/i.test(css)) throw new Error('CSS enthält </style');

const b64 = (buf) => Buffer.from(buf).toString('base64');
const svgUri = 'data:image/svg+xml;base64,' + b64(iconSvg());
const png180 = 'data:image/png;base64,' + b64(iconPng(180));
const png512 = 'data:image/png;base64,' + b64(iconPng(512));

// Kein start_url/scope: relative URLs wären gegen eine data:-URL ungültig; Standard ist die Dokument-URL.
const manifest = {
  name: 'LingoForge', short_name: 'LingoForge', lang: 'de', display: 'standalone',
  background_color: '#12355b', theme_color: '#12355b',
  icons: [
    { src: png180, sizes: '180x180', type: 'image/png' },
    { src: png512, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: svgUri, sizes: 'any', type: 'image/svg+xml' }
  ]
};
const manifestUri = 'data:application/manifest+json;base64,' + b64(JSON.stringify(manifest));

const hash = 'sha256-' + crypto.createHash('sha256').update(script, 'utf8').digest('base64');
const csp = [
  "default-src 'none'", `script-src '${hash}'`, "style-src 'unsafe-inline'", 'img-src data:', 'manifest-src data:',
  "connect-src 'none'", "media-src 'none'", "base-uri 'none'", "form-action 'none'", "worker-src 'self'"
].join('; ');

// Ersetzungen per Funktion (kein $-Muster-Problem).
let html = read(src('shell.html'));
const fill = (key, value) => { html = html.replace(`{{${key}}}`, () => value); };
fill('CSP', csp); fill('ICON_SVG', svgUri); fill('TOUCH_ICON', png180); fill('MANIFEST', manifestUri);
fill('STYLE', css); fill('SCRIPT', script);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unersetzter Platzhalter');

const buildId = crypto.createHash('sha256').update(html, 'utf8').digest('hex').slice(0, 12);
const sw = read(src('sw.js')).replace('__BUILD__', buildId);

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.writeFileSync(path.join(dist, 'sw.js'), sw);
console.log(`dist/index.html ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB, build ${buildId}, CSP ${hash}`);
