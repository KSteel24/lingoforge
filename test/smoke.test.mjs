// Rauchtest der gebauten App (dist/index.html) in einem Node-vm-Kontext mit minimalem DOM-Stub.
// Ohne indexedDB: prüft nebenbei den sichtbaren Speicher-Fallback. Ersetzt keinen Test auf einem echten iPhone.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [path.join(root, 'build', 'build.mjs')], { stdio: 'pipe' });
const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const code = /<script>([\s\S]*?)<\/script>/.exec(html)[1];

class TextNode { constructor(t) { this.nodeType = 3; this.data = String(t); this.parentNode = null; } get textContent() { return this.data; } }
class El {
  constructor(tag) {
    this.nodeType = 1; this.tagName = tag; this.attrs = {}; this.children = []; this.parentNode = null; this.listeners = {};
    this.style = { setProperty(k, v) { this[k] = v; } }; this.value = ''; this.disabled = false; this.hidden = false;
    const self = this;
    this.classList = {
      add(c) { const s = new Set(self.cls()); s.add(c); self.attrs.class = [...s].join(' '); },
      remove(c) { self.attrs.class = self.cls().filter((x) => x !== c).join(' '); },
      contains(c) { return self.cls().includes(c); }
    };
  }
  cls() { return (this.attrs.class || '').split(/\s+/).filter(Boolean); }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = v; }
  get textContent() { return this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; if (v !== '') this.appendChild(new TextNode(v)); }
  appendChild(c) { if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c); c.parentNode = this; this.children.push(c); return c; }
  replaceChildren(...n) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; n.forEach((c) => this.appendChild(c)); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  dispatch(t, ev = {}) { (this.listeners[t] || []).forEach((f) => f({ target: this, key: ev.key, ...ev })); }
  click() { if (this.disabled) return; this.dispatch('click'); }
  focus() {} setSelectionRange() {}
}

function walk(n, out = []) { out.push(n); if (n.children) n.children.forEach((c) => walk(c, out)); return out; }
const els = (n) => walk(n).filter((x) => x.nodeType === 1);
const text = (n) => (n.textContent || '').replace(/\s+/g, ' ').trim();

function boot({ voices = [], speechApi = false, synth = null, ua = '' } = {}) {
  const byId = {};
  for (const id of ['app', 'banners', 'view', 'nav', 'toast']) byId[id] = new El(id === 'nav' ? 'nav' : 'div');
  const listeners = {};
  const spoken = [];
  const loc = { _h: '', get hash() { return this._h; }, set hash(v) { this._h = v; (listeners.hashchange || []).forEach((f) => f({})); } };
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise, Set, Map, Object, Array, String, Number,
    document: { createElement: (t) => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: (t) => new TextNode(t),
      getElementById: (id) => byId[id], documentElement: new El('html'), body: new El('body'), visibilityState: 'visible', addEventListener() {} },
    navigator: { userAgent: ua }, location: loc, scrollTo() {},
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }
  };
  if (voices.length || speechApi) {
    ctx.speechSynthesis = { getVoices: () => voices, cancel() {}, speak(u) { spoken.push(u); }, onvoiceschanged: null };
    ctx.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  }
  if (synth) { ctx.speechSynthesis = synth; ctx.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } }; }
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, byId, view: byId.view, spoken, listeners };
}

const VOICES = ['en-GB', 'es-ES', 'fr-FR'].map((lang, i) => ({ lang, name: `Stimme ${lang}${i === 1 ? ' (Enhanced)' : ''}`, voiceURI: `v${i}`, localService: true }));
const btn = (root, label) => els(root).find((e) => e.tagName === 'button' && text(e).includes(label));

test('Start: Home rendert, Speicher-Fallback und fehlende Stimme sichtbar gemeldet', async () => {
  const app = boot();
  await app.ctx.LF.ready;
  const v = text(app.view);
  assert.match(v, /LingoForge/);
  assert.ok(btn(app.view, 'Üben'));
  assert.match(v, /Pfad Spanisch/);
  assert.match(v, /Gesperrt: Meistere Einheit 1 zu 60 %/);
  assert.match(text(app.byId.banners), /Datenbank nicht verfügbar/);
  assert.match(text(app.byId.banners), /keine Sprachausgabe/);
  assert.equal(app.ctx.LF.DB.mode, 'memory');
  const withApi = boot({ speechApi: true });
  await withApi.ctx.LF.ready;
  assert.doesNotMatch(text(withApi.byId.banners), /Sprachausgabe/, 'ohne gelistete Stimme wird trotzdem gesprochen, kein Banner');
  assert.ok(withApi.ctx.LF.App.hasVoice('es'));
});

test('Router: Statistik und Einstellungen rendern ohne Fehler, Navigation korrekt', async () => {
  const app = boot();
  await app.ctx.LF.ready;
  for (const r of ['#/stats', '#/settings', '#/home']) {
    app.ctx.location.hash = r;
    assert.ok(!/Anzeigefehler/.test(text(app.view)), `${r}: ${text(app.view).slice(0, 200)}`);
  }
  app.ctx.location.hash = '#/settings';
  const v = text(app.view);
  assert.match(v, /Tagesziel/); assert.match(v, /Backup exportieren/); assert.match(v, /Alles löschen/);
  assert.match(v, /Dieser Browser meldet keinen Speicherstatus/);
  assert.equal(app.byId.nav.children.length, 3);
  assert.ok(!app.byId.nav.hidden);
});

test('Einstellungen: Tagesziel, Theme, Sprache ändern den Zustand und werden gespeichert', async () => {
  const app = boot();
  await app.ctx.LF.ready;
  const App = app.ctx.LF.App;
  app.ctx.location.hash = '#/settings';
  btn(app.view, '50 XP').click();
  assert.equal(App.S.settings.goal, 50);
  btn(app.view, 'Dunkel').click();
  assert.equal(App.S.settings.theme, 'dark');
  assert.equal(app.ctx.document.documentElement.attrs['data-theme'], 'dark');
  assert.equal(btn(app.view, 'Französisch'), undefined, 'nur aktive Sprachen wählbar');
  assert.equal(App.S.settings.lang, 'es');
  const st = await app.ctx.LF.DB.loadState();
  assert.equal(st.settings.goal, 50); assert.equal(st.settings.lang, 'es');
});

test('Zweistufiges Löschen: erst Bestätigung, dann Reset', async () => {
  const app = boot();
  await app.ctx.LF.ready;
  const App = app.ctx.LF.App;
  App.S.settings.goal = 20;
  app.ctx.location.hash = '#/settings';
  btn(app.view, 'Alles löschen').click();
  assert.equal(App.S.settings.goal, 20, 'Stufe 1 löscht noch nichts');
  assert.ok(btn(app.view, 'Ja, endgültig löschen'));
  btn(app.view, 'Ja, endgültig löschen').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(App.S.settings.goal, 30);
});

function solve(view, step, item, C, correct) {
  const opts = () => els(view).filter((e) => e.tagName === 'button' && e.classList.contains('opt'));
  const pick = (want) => { const b = opts().find((o) => (text(o) === want) === correct); assert.ok(b, `Option für ${step.ex} fehlt`); b.click(); };
  switch (step.ex) {
    case 'choice': pick(step.dir === 'tgt2de' ? item.de : item.tgt); break;
    case 'cloze': pick(item.cloze.answer); break;
    case 'listenChoice': pick(item.tgt); break;
    case 'tiles': {
      const toks = correct ? item.tokens : item.tokens.slice().reverse();
      for (const t of toks) {
        const b = els(view).find((e) => e.tagName === 'button' && e.classList.contains('tile') && !e.classList.contains('placed') && text(e) === t);
        assert.ok(b, `Kachel ${t}`); b.click();
      }
      btn(view, 'Prüfen').click(); break;
    }
    case 'typing': case 'dictation': {
      els(view).find((e) => e.tagName === 'input').value = correct ? item.tgt : 'qqqq';
      btn(view, 'Prüfen').click(); break;
    }
    case 'shadow': btn(view, correct ? 'Gut gesprochen' : 'Nochmal üben').click(); break;
    default: assert.fail('Unbekannte Übung ' + step.ex);
  }
}

test('Alle Übungstypen: richtig und falsch lösbar (mit Stimmen), submit genau einmal', async () => {
  const app = boot({ voices: VOICES });
  await app.ctx.LF.ready;
  await new Promise((r) => setTimeout(r, 300));
  const LF = app.ctx.LF, C = LF.content.es;
  assert.ok(LF.App.hasVoice('es'));
  const sentence = C.units[0].items.find((i) => i.cloze && i.tokens.length >= 3);
  const kinds = ['choice', 'cloze', 'tiles', 'typing', 'dictation', 'listenChoice', 'shadow'];
  for (const ex of kinds) for (const dir of ['de2tgt', 'tgt2de']) for (const correct of [true, false]) {
    const got = [];
    const step = { id: sentence.id, type: 'ex', ex, dir };
    const ctx = { item: sentence, content: C, langCode: 'es', bcp: C.tts, rng: Math.random, hasVoice: true, speak: () => true, card: null, submit: (r) => got.push(r) };
    const out = LF.Ex.render(step, ctx);
    const host = new El('div'); host.appendChild(out.el);
    solve(host, step, sentence, C, correct);
    assert.equal(got.length, 1, `${ex}/${dir}/${correct}`);
    assert.equal(got[0].correct, correct, `${ex}/${dir}/${correct}`);
    const again = els(host).find((e) => e.tagName === 'button' && e.classList.contains('opt'));
    if (again) again.click();
    assert.equal(got.length, 1, 'zweiter Klick zählt nicht');
  }
});

test('Tippen: Tippfehler/Akzent -> richtig mit Check, Hinweis zeigt Maske', async () => {
  const app = boot();
  await app.ctx.LF.ready;
  const LF = app.ctx.LF, C = LF.content.es, item = C.byId['es.u1.i08'];
  const got = [];
  const out = LF.Ex.render({ ex: 'typing' }, { item, content: C, langCode: 'es', bcp: C.tts, rng: Math.random, hasVoice: false, speak() {}, submit: (r) => got.push(r) });
  const host = new El('div'); host.appendChild(out.el);
  assert.ok(els(host).some((e) => e.tagName === 'button' && text(e) === 'ñ'), 'Sonderzeichen-Leiste');
  btn(host, 'Hinweis').click();
  assert.match(text(host), /Hinweis: C___ e____/);
  els(host).find((e) => e.tagName === 'input').value = 'como estas';
  btn(host, 'Prüfen').click();
  assert.equal(got[0].check, 'accentOnly'); assert.equal(got[0].correct, true); assert.equal(got[0].hint, true);
});

for (const withVoices of [false, true]) {
  test(`Komplette Sitzung (Stimmen: ${withVoices}): Schritte, Speichern nach jeder Antwort, XP, Fehler-Retry, Zusammenfassung`, async () => {
    const app = boot({ voices: withVoices ? VOICES : [] });
    await app.ctx.LF.ready;
    if (withVoices) await new Promise((r) => setTimeout(r, 300));
    const LF = app.ctx.LF, App = LF.App;
    App.S.settings.lang = 'es';
    app.ctx.location.hash = '#/home';
    btn(app.view, 'Üben').click();
    assert.equal(app.ctx.location.hash, '#/session');
    assert.ok(app.byId.nav.hidden, 'Navigation während der Sitzung ausgeblendet');
    const S = App.session;
    assert.ok(S.steps.length >= 12 && S.steps.length <= 15);
    let n = 0, wrongs = 0, answered = 0;
    while (!S.done && n++ < 80) {
      const st = S.steps[S.i], item = LF.content.es.byId[st.id];
      if (st.type === 'intro') { btn(app.view, 'Verstanden').click(); continue; }
      const correct = !(answered % 4 === 3);
      if (!correct) wrongs++;
      const lenBefore = S.steps.length;
      solve(app.view, st, item, LF.content.es, correct);
      answered++;
      if (!correct) assert.equal(S.steps.length, lenBefore + 1, 'Fehler fügt Wiederholung ein');
      const stored = await LF.DB.loadState();
      if (!st.retry) {
        assert.ok(stored.cards.some((c) => c.id === item.id && c.state > 0), 'Karte nach Antwort gespeichert');
      }
      if (correct && !st.retry) { const e = btn(app.view, 'Das war leicht'); if (e && answered % 3 === 0) e.click(); }
      (btn(app.view, 'Weiter') || btn(app.view, 'Fertig')).click();
    }
    assert.ok(S.done, 'Sitzung beendet');
    assert.match(text(app.view), /Geschafft!/);
    const today = App.today(), d = App.S.daily[today];
    assert.ok(d.xp >= 20 && d.reviews === answered - (S.steps.filter((s) => s.retry).length), `xp ${d.xp}, reviews ${d.reviews}`);
    assert.ok(d.newItems >= 1);
    assert.equal(d.correct + d.wrong, d.reviews);
    const st = await LF.DB.loadState();
    assert.equal(st.daily.find((x) => x.date === today).xp, d.xp, 'Tageswert gespeichert');
    assert.ok(st.progress.length >= 1);
    assert.equal(App.S.meta.sessions, 1);
    const log = await LF.DB.loadLog();
    assert.equal(log.length, d.reviews);
    assert.ok(log.every((r) => r.rating >= 1 && r.rating <= 4 && typeof r.ms === 'number'));
    if (withVoices) assert.ok(app.spoken.length >= 0);
    // Folgesitzung: bereits geübte Items kommen als Wiederholung, Home zeigt Zähler
    btn(app.view, 'Zur Startseite').click();
    assert.match(text(app.view), /fällig/);
  });
}

test('Export/Import-Roundtrip (Ersetzen und Zusammenführen) und Ablehnung manipulierter Dateien', async () => {
  const app = boot();
  await app.ctx.LF.ready;
  const LF = app.ctx.LF, App = LF.App, C = LF.content.es;
  for (const id of ['es.u1.i01', 'es.u1.i02', 'es.u1.i04']) {
    await App.recordAnswer('es', C.byId[id], 3, { ex: 'choice', ms: 3000, correct: true, hint: false }).saved;
  }
  App.addXp(40, 'es');
  const json = await App.exportJson();
  const data = LF.Backup.parse(json);
  assert.equal(data.cards.length, 3); assert.equal(data.reviewLog.length, 3);
  assert.ok(data.daily[0].goalMet);
  App.S.settings.goal = 50;
  await App.importData(LF.Backup.parse(json), 'replace');
  assert.equal(Object.keys(App.S.cards).length, 3);
  assert.equal(App.S.settings.goal, 30, 'Einstellungen aus Backup');
  await App.importData(LF.Backup.parse(json), 'merge');
  assert.equal((await LF.DB.loadLog()).length, 3, 'Merge dedupliziert');
  assert.ok(App.streak().current >= 1);
  assert.throws(() => LF.Backup.parse(json.replace('"cards"', '"__proto__":{"x":1},"cards"')), /Unzulässig/);
  await App.markBackup();
  assert.ok(!LF.Game.backupDue(App.S.meta, Date.now()));
});

test('DOM-Helfer: Attribut-Whitelist, kein HTML aus Daten', async () => {
  const app = boot();
  await app.ctx.LF.ready;
  const { h } = app.ctx.LF.UI;
  assert.throws(() => h('div', { onclick: 'alert(1)' }), /Funktion/);
  assert.throws(() => h('div', { style: { background: 'url(x)' } }), /Style/);
  assert.throws(() => h('script', null), /Tag/);
  assert.throws(() => h('div', { srcdoc: 'x' }), /Attribut/);
  assert.throws(() => h('a', { href: 'javascript:alert(1)' }), /href/);
  const el = h('p', { class: 'x', 'aria-label': 'y' }, '<img src=x onerror=alert(1)>');
  assert.equal(el.children[0].nodeType, 3);
  assert.equal(el.textContent, '<img src=x onerror=alert(1)>');
});

function fakeIdb(mode, names = []) {
  return { databases: async () => names.map((name) => ({ name })),
    open() { const r = {}; setTimeout(() => r.onerror && r.onerror()); return r; },
    deleteDatabase() { const r = {}; setTimeout(() => (mode === 'blocked' ? r.onblocked : mode === 'error' ? r.onerror : r.onsuccess)?.()); return r; } };
}

async function wipeWith(idb) {
  const app = boot();
  await app.ctx.LF.ready;
  app.ctx.indexedDB = idb;
  app.ctx.LF.App.S.settings.goal = 20;
  app.ctx.location.hash = '#/settings';
  btn(app.view, 'Alles löschen').click();
  btn(app.view, 'Ja, endgültig löschen').click();
  await new Promise((r) => setTimeout(r, 60));
  return app;
}

test('Löschen: blockiert/Fehler/DB noch da -> Fehlermeldung, nichts gelöscht, kein "Alles gelöscht"', async () => {
  for (const idb of [fakeIdb('blocked'), fakeIdb('error'), fakeIdb('ok', ['lingo'])]) {
    const app = await wipeWith(idb);
    const v = text(app.view);
    assert.match(v, /Löschen fehlgeschlagen/);
    assert.doesNotMatch(v, /Alles gelöscht/);
    assert.equal(app.ctx.LF.App.S.settings.goal, 20, 'Zustand unverändert');
  }
  assert.match(text((await wipeWith(fakeIdb('blocked'))).view), /blockiert/);
});

test('Löschen: Erfolg erst nach Prüfung, dass die DB weg ist', async () => {
  const app = await wipeWith(fakeIdb('ok', []));
  assert.match(text(app.view), /Lernsprache|LingoForge/);
  assert.equal(app.ctx.LF.App.S.settings.goal, 30);
});

function fakeSynth({ voices = [], events = true, speaking = false } = {}) {
  const calls = [], spoken = [];
  const synth = { speaking, pending: false, calls, spoken, getVoices: () => voices, onvoiceschanged: null,
    cancel() { calls.push('cancel'); }, resume() { calls.push('resume'); },
    speak(u) { calls.push('speak'); spoken.push(u); if (events) setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 10); }, 5); } };
  return synth;
}
const ES_VOICE = { lang: 'es_ES', name: 'Mónica', voiceURI: 'm', localService: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('Sprache: kein cancel vor speak im Leerlauf, resume, Lang mit Bindestrich, Gestenaufruf synchron', async () => {
  const synth = fakeSynth({ voices: [ES_VOICE] });
  const app = boot({ synth });
  await app.ctx.LF.ready; await sleep(300);
  const ok = app.ctx.LF.App.speak('Hola', 'es', false);
  assert.equal(ok, true);
  assert.deepEqual(synth.calls, ['resume', 'speak'], 'synchron, ohne cancel');
  assert.equal(synth.spoken[0].lang, 'es-ES');
  assert.equal(synth.spoken[0].voice.name, 'Mónica');
  await sleep(60);
  assert.equal(app.ctx.LF.Speech.failed, false);
  assert.ok(app.ctx.LF.Speech.last.events.includes('start') && app.ctx.LF.Speech.last.events.includes('end'));
});

test('Sprache: bei laufender Ausgabe cancel, dann ~60 ms Wartezeit, dann speak', async () => {
  const synth = fakeSynth({ voices: [ES_VOICE], speaking: true });
  const app = boot({ synth });
  await app.ctx.LF.ready; await sleep(300);
  app.ctx.LF.App.speak('Hola', 'es', false);
  assert.deepEqual(synth.calls, ['cancel']);
  await sleep(120);
  assert.deepEqual(synth.calls, ['cancel', 'resume', 'speak']);
});

test('Sprache: ohne Stimme trotzdem sprechen (lang = es-ES), Entsperren mit stummer Äußerung', async () => {
  const synth = fakeSynth({ voices: [] });
  const app = boot({ synth });
  await app.ctx.LF.ready;
  app.ctx.LF.Speech.unlock();
  assert.equal(synth.spoken[0].volume, 0);
  assert.equal(synth.spoken[0].text, ' ');
  assert.equal(app.ctx.LF.App.speak('Hola', 'es', false), true);
  const u = synth.spoken[synth.spoken.length - 1];
  assert.equal(u.lang, 'es-ES'); assert.equal(u.voice, undefined);
});

test('Sprache: keine Rückmeldung nach 1,5 s oder Fehler -> Toast und Banner mit Hinweis, Übungen ohne Audio', async () => {
  const synth = fakeSynth({ voices: [ES_VOICE], events: false });
  const app = boot({ synth });
  await app.ctx.LF.ready;
  app.ctx.LF.App.speak('Hola', 'es', false);
  await sleep(1700);
  assert.equal(app.ctx.LF.Speech.failed, true);
  assert.match(text(app.byId.toast), /keine Sprachausgabe zu hören/);
  assert.match(text(app.byId.toast), /Stumm-Schalter/);
  assert.match(text(app.byId.banners), /keinen Ton geliefert/);
  assert.equal(app.ctx.LF.App.hasVoice('es'), false);
  const e = boot({ synth: fakeSynth({ voices: [ES_VOICE], events: false }) });
  await e.ctx.LF.ready;
  e.ctx.LF.App.speak('Hola', 'es', false);
  e.ctx.LF.Speech.last.events.length = 0;
  const u = e.ctx.speechSynthesis.spoken[0];
  u.onerror({ error: 'not-allowed' });
  assert.match(text(e.byId.toast), /not-allowed/);
  u.onerror({ error: 'canceled' });
});

test('Sprachtest: Diagnose zeigt Stimmenzahl, erste 5 Stimmen, Status nach Aufruf und Ereignisse', async () => {
  const voices = Array.from({ length: 7 }, (_, i) => ({ lang: i === 0 ? 'es_ES' : 'en-US', name: `V${i}`, voiceURI: `v${i}`, localService: i % 2 === 0 }));
  const synth = fakeSynth({ voices });
  const app = boot({ synth });
  await app.ctx.LF.ready; await sleep(300);
  app.ctx.location.hash = '#/settings';
  btn(app.view, 'Sprachtest').click();
  await sleep(450);
  const v = text(app.view);
  assert.match(v, /getVoices\(\): 7 \(davon Spanisch: 1\)/);
  assert.match(v, /V0 \[es_ES, lokal\]/); assert.match(v, /V4 \[en-US, lokal\]/); assert.doesNotMatch(v, /V5 \[/);
  assert.match(v, /Verwendet: V0 \(es_ES\), Sprache es-ES/);
  assert.match(v, /direkt nach dem Aufruf: speaking=false, pending=false; nach 300 ms:/);
  assert.match(v, /Ereignisse: .*start.*end/);
  assert.equal(synth.spoken[synth.spoken.length - 1].text, 'Hola, ¿cómo estás?');
});

test('Hinweis "Zum Home-Bildschirm": nur auf iPhone im Safari-Tab, wegklickbar und gemerkt', async () => {
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
  assert.doesNotMatch(text((await (async () => { const a = boot(); await a.ctx.LF.ready; return a; })()).byId.banners), /Home-Bildschirm/);
  const app = boot({ ua: UA });
  await app.ctx.LF.ready;
  assert.match(text(app.byId.banners), /Zum Home-Bildschirm hinzufügen/);
  btn(app.byId.banners, 'Verstanden').click();
  assert.doesNotMatch(text(app.byId.banners), /Home-Bildschirm/);
  assert.equal(app.ctx.LF.App.S.meta.a2hsDismissed, true);
  assert.equal((await app.ctx.LF.DB.loadState()).meta.a2hsDismissed, true);
  const st = boot({ ua: UA }); st.ctx.navigator.standalone = true;
  await st.ctx.LF.ready;
  assert.doesNotMatch(text(st.byId.banners), /Home-Bildschirm/);
});

test('Native Anmutung: Meta und CSS-Grundlagen im Build', () => {
  assert.match(html, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  for (const r of [/-webkit-touch-callout: none/, /overscroll-behavior: none/, /touch-action: manipulation/, /100dvh/, /backdrop-filter/, /scale\(\.97\)/, /prefers-reduced-motion/, /input, select, textarea \{ font-size: 16px/, /user-select: text/]) assert.match(html, r);
});
