import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const F = require('../src/js/fsrs.js');
const Game = require('../src/js/game.js');
const Sched = require('../src/js/sched.js');
const Backup = require('../src/js/backup.js');
const es = require('../src/js/content-es.js');

const DAY = 86400000;
const NOW = new Date(2026, 5, 15, 12).getTime();
function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
const settings = { newPerDay: 10, unlockAll: false };

function card(it, over) {
  return { ...F.initCard(it.id, 'es', it.unit, NOW - 10 * DAY), state: 2, stability: 3, difficulty: 5, lastReview: NOW - 4 * DAY,
    due: NOW - DAY, reps: 3, lapses: 0, ...over };
}
function cardsFor(items, over) { const o = {}; items.forEach((it, i) => { o[it.id] = card(it, typeof over === 'function' ? over(i, it) : over); }); return o; }
function session(cards, extra = {}) {
  return Sched.buildSession({ content: es, cards, settings, newToday: 0, now: NOW, rng: lcg(3), hasVoice: true, ...extra });
}

test('Frische Sitzung: <=15 Schritte, nur Einheit 1, Intro vor Übung mit >=3 Abstand', () => {
  const { steps } = session({});
  assert.ok(steps.length >= 12 && steps.length <= 15, `Schritte: ${steps.length}`);
  const intros = steps.filter((s) => s.type === 'intro');
  assert.ok(intros.length >= 4);
  for (const st of steps) assert.equal(es.byId[st.id].unit, 1);
  for (const it of intros) {
    const iIntro = steps.indexOf(it);
    const iEx = steps.findIndex((s, i) => i > iIntro && s.id === it.id && s.type === 'ex');
    assert.ok(iEx - iIntro >= 3, `${it.id}: Abstand ${iEx - iIntro}`);
  }
});

test('Neue Items erst mit Kennenlern-Karte; Übung ist Erkennen (kein Tippen)', () => {
  const { steps } = session({});
  for (const st of steps.filter((s) => s.type === 'ex')) {
    assert.ok(['choice', 'tiles', 'listenChoice'].includes(st.ex), st.ex);
    assert.ok(steps.findIndex((s) => s.id === st.id && s.type === 'intro') < steps.indexOf(st));
  }
});

test('Gleicher Übungstyp nie 3x hintereinander, Item mind. 3 Positionen Abstand (viele Zufallsläufe)', () => {
  const items = es.units[0].items.concat(es.units[1].items);
  for (let seed = 1; seed < 80; seed++) {
    const cards = cardsFor(items, (i) => ({ stability: [0.5, 1, 3, 6, 15, 30][i % 6], due: NOW - (i + 1) * 3600000 }));
    const { steps } = session(cards, { rng: lcg(seed), hasVoice: seed % 2 === 0 });
    const ex = steps.filter((s) => s.type === 'ex' || s.type === undefined).map((s) => s.ex);
    for (let i = 2; i < ex.length; i++) assert.ok(!(ex[i] && ex[i] === ex[i - 1] && ex[i] === ex[i - 2]), `Seed ${seed}: ${ex.join(',')}`);
    steps.forEach((s, i) => {
      const j = steps.findIndex((t, k) => k > i && t.id === s.id);
      if (j > 0) assert.ok(j - i >= 3, `Seed ${seed}: ${s.id} Abstand ${j - i}`);
    });
  }
});

test('Fällige Karten nach niedrigster Retrievability zuerst', () => {
  const items = es.units[0].items.slice(0, 8);
  const cards = cardsFor(items, (i) => ({ lastReview: NOW - (i + 2) * DAY, stability: 3, due: NOW - 1000 }));
  const { steps } = session(cards, { settings: { newPerDay: 0, unlockAll: false } });
  const reviews = steps.filter((s) => s.type === 'ex' && !s.isNew).map((s) => s.id);
  assert.equal(reviews.length, 8);
  const r = (id) => F.cardRetrievability(cards[id], NOW);
  const idx = (id) => items.findIndex((x) => x.id === id);
  // älteste letzte Review (niedrigstes R) steht vor der jüngsten, grob geordnet
  assert.ok(reviews.indexOf(items[7].id) < reviews.indexOf(items[0].id));
  assert.ok(r(items[7].id) < r(items[0].id));
  assert.ok(idx(reviews[0]) >= 4);
});

test('Backlog-Dämpfung: >30 fällig -> keine neuen, >15 -> halbes Budget', () => {
  assert.equal(Sched.newBudget(10, 0, 31), 0);
  assert.equal(Sched.newBudget(10, 0, 16), 5);
  assert.equal(Sched.newBudget(10, 0, 15), 10);
  assert.equal(Sched.newBudget(10, 4, 0), 6);
  assert.equal(Sched.newBudget(10, 12, 0), 0);
  const allItems = es.items.slice(0, 40);
  const many = cardsFor(allItems, { due: NOW - 1000 });
  const s1 = session(many, { settings: { newPerDay: 10, unlockAll: true } });
  assert.equal(s1.stats.newItems, 0);
  assert.equal(s1.steps.filter((s) => s.type === 'intro').length, 0);
  const some = cardsFor(es.items.slice(0, 20), { due: NOW - 1000 });
  const s2 = session(some, { settings: { newPerDay: 10, unlockAll: true } });
  assert.equal(s2.stats.budget, 5);
});

test('Mix: ca. 2/3 Wiederholung, 1/3 Neues bei vorhandenen Karten', () => {
  const learned = es.units[0].items.slice(0, 12);
  const cards = cardsFor(learned, (i) => ({ due: NOW - (i + 1) * 3600000 }));
  const { steps, stats } = session(cards, { settings: { newPerDay: 10, unlockAll: true } });
  assert.equal(steps.length, 15);
  assert.equal(stats.newItems, 2);
  const neu = steps.filter((s) => s.type === 'intro' || s.isNew).length;
  assert.equal(neu, 4);
  assert.equal(steps.length - neu, 11);
});

test('Auffüllen mit Frühwiederholung, wenn nichts fällig und keine neuen Items übrig', () => {
  const items = es.units[0].items;
  const cards = cardsFor(items, { due: NOW + 5 * DAY, stability: 8 });
  const { steps } = session(cards, { settings: { newPerDay: 0, unlockAll: false } });
  assert.equal(steps.length, 12);
  assert.ok(steps.every((s) => s.type === 'ex' && !s.isNew));
});

test('Übungstyp nach Stabilität; ohne Stimme keine Hör-/Shadow-Übungen', () => {
  const sentence = es.units[0].items.find((i) => i.kind === 'sentence' && i.cloze && i.tokens.length >= 3);
  const word = es.units[0].items.find((i) => i.kind === 'word');
  const low = Sched.exCandidates(sentence, { state: 2, stability: 1 }, true);
  const mid = Sched.exCandidates(sentence, { state: 2, stability: 5 }, true);
  const high = Sched.exCandidates(sentence, { state: 2, stability: 20 }, true);
  assert.deepEqual(low.sort(), ['choice', 'listenChoice', 'tiles']);
  assert.deepEqual(mid.sort(), ['cloze', 'shadow', 'tiles']);
  assert.deepEqual(high.sort(), ['dictation', 'typing']);
  assert.deepEqual(Sched.exCandidates(sentence, { state: 2, stability: 1 }, false).sort(), ['choice', 'tiles']);
  assert.deepEqual(Sched.exCandidates(sentence, { state: 2, stability: 5 }, false).sort(), ['cloze', 'tiles']);
  assert.deepEqual(Sched.exCandidates(sentence, { state: 2, stability: 20 }, false), ['typing']);
  assert.deepEqual(Sched.exCandidates(word, { state: 2, stability: 5 }, true), ['typing', 'choice']);
  assert.deepEqual(Sched.exCandidates(sentence, null, true).sort(), ['choice', 'listenChoice', 'tiles']);
  for (let seed = 1; seed < 30; seed++) {
    const { steps } = session(cardsFor(es.items.slice(0, 30), (i) => ({ stability: [1, 5, 20][i % 3] })), { hasVoice: false, rng: lcg(seed) });
    for (const s of steps) assert.ok(!['listenChoice', 'shadow', 'dictation'].includes(s.ex), s.ex);
  }
});

test('Einheitenpfad: Einheit 2 erst ab 60 % von 1 gemeistert, Schalter schaltet alles frei', () => {
  const u1 = es.units[0].items;
  const none = Game.unlocked(es, {}, false);
  assert.deepEqual(none, [true, false, false, false, false, false]);
  const k = Math.ceil(u1.length * 0.6);
  const part = cardsFor(u1.slice(0, k - 1), { stability: 8 });
  assert.equal(Game.unlocked(es, part, false)[1], false);
  const enough = cardsFor(u1.slice(0, k), { stability: 8 });
  assert.equal(Game.unlocked(es, enough, false)[1], true);
  assert.equal(Game.unlocked(es, enough, false)[2], false);
  assert.ok(Game.unlocked(es, {}, true).every(Boolean));
  const s = session({}, { settings: { newPerDay: 10, unlockAll: false } });
  assert.ok(s.steps.every((st) => es.byId[st.id].unit === 1));
  const s2 = session({}, { settings: { newPerDay: 10, unlockAll: true } });
  assert.ok(s2.steps.length > 0);
});

test('onlyUnit beschränkt die Sitzung', () => {
  const s = session({}, { onlyUnit: 2, settings: { newPerDay: 10, unlockAll: true } });
  assert.ok(s.steps.length > 0 && s.steps.every((st) => es.byId[st.id].unit === 2));
});

test('Fehler: Retry 3-4 Positionen später, ohne dreifachen Übungstyp', () => {
  for (let seed = 1; seed < 60; seed++) {
    const { steps } = session(cardsFor(es.units[0].items, { stability: 1 }), { rng: lcg(seed) });
    const idx = 4, item = es.byId[steps[idx].id], before = steps.length;
    const pos = Sched.insertRetry(steps, idx, item, { rng: lcg(seed + 100), hasVoice: true });
    assert.equal(steps.length, before + 1);
    assert.ok(pos - idx === 3 || pos - idx === 4, `Abstand ${pos - idx}`);
    assert.equal(steps[pos].retry, true);
    assert.equal(steps[pos].id, item.id);
    const ex = steps.map((s) => s.ex);
    for (let i = 2; i < ex.length; i++) assert.ok(!(ex[i] && ex[i] === ex[i - 1] && ex[i] === ex[i - 2]), `Seed ${seed}`);
  }
  const short = [{ id: es.items[0].id, type: 'ex', ex: 'choice' }];
  assert.equal(Sched.insertRetry(short, 0, es.items[0], { rng: () => 0.9 }), 1);
});

test('Bewertung: falsch=Again, Hilfe/Tippfehler/Akzent/langsam=Hard, sauber=Good, Easy nur schnell+exakt oder Button', () => {
  const item = es.units[0].items.find((i) => i.tokens.length >= 3);
  const base = { ex: 'typing', item, correct: true, check: 'exact', hint: false, ms: 6000 };
  assert.equal(Game.rating({ ...base, correct: false, check: 'wrong' }), 1);
  assert.equal(Game.rating({ ...base, hint: true }), 2);
  assert.equal(Game.rating({ ...base, check: 'typo' }), 2);
  assert.equal(Game.rating({ ...base, check: 'accentOnly' }), 2);
  assert.equal(Game.rating({ ...base, ms: 200000 }), 2);
  assert.equal(Game.rating(base), 3);
  assert.equal(Game.rating({ ...base, ms: 1000 }), 4);
  assert.equal(Game.rating({ ...base, ms: 1000, check: 'typo' }), 2);
  assert.equal(Game.rating({ ...base, easyBtn: true }), 4);
  assert.equal(Game.rating({ ...base, easyBtn: true, hint: true }), 2);
  assert.equal(Game.rating({ ...base, ex: 'choice', check: null, ms: 300 }), 3, 'Erkennen nie automatisch Easy');
  assert.equal(Game.rating({ ...base, ex: 'cloze', check: null, ms: 300 }), 3);
  assert.equal(Game.rating({ ...base, ex: 'shadow', selfRating: 2 }), 2);
  assert.equal(Game.rating({ ...base, ex: 'shadow', selfRating: 1, correct: false }), 1);
  assert.equal(Game.rating({ ...base, ex: 'tiles', check: 'exact', ms: 800 }), 4);
});

test('XP: 10 je richtig, +5 ab der 3. in Folge, Sessionbonus 20', () => {
  assert.equal(Game.xpForAnswer(true, 1), 10);
  assert.equal(Game.xpForAnswer(true, 2), 10);
  assert.equal(Game.xpForAnswer(true, 3), 15);
  assert.equal(Game.xpForAnswer(false, 0), 0);
  assert.equal(Game.SESSION_BONUS, 20);
});

test('Serie aus daily: goalMet zählt, heute offen -> ab gestern, Lücke bricht', () => {
  const k = (n) => Game.addDays('2026-06-15', n);
  const day = (n, met) => [k(n), { date: k(n), goalMet: met }];
  const daily = Object.fromEntries([day(0, true), day(-1, true), day(-2, true), day(-4, true), day(-5, true), day(-6, true), day(-7, true)]);
  assert.deepEqual(Game.streak(daily, k(0)), { current: 3, best: 4 });
  delete daily[k(0)];
  assert.equal(Game.streak(daily, k(0)).current, 2);
  daily[k(-1)].goalMet = false;
  assert.equal(Game.streak(daily, k(0)).current, 0);
  assert.equal(Game.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(Game.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(Game.dateKey(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
});

test('Retention aus Log und Backup-Erinnerung', () => {
  const log = [{ ts: NOW - DAY, prevS: 2, rating: 3 }, { ts: NOW - DAY, prevS: 2, rating: 1 }, { ts: NOW - DAY, prevS: 0, rating: 1 }, { ts: NOW - 40 * DAY, prevS: 5, rating: 1 }];
  assert.deepEqual(Game.retention(log, NOW, 30), { n: 2, value: 0.5 });
  assert.equal(Game.retention([], NOW, 30).value, null);
  assert.equal(Game.backupDue({ totalReviews: 50, reviewsAtBackup: 0, lastBackup: NOW }, NOW), true);
  assert.equal(Game.backupDue({ totalReviews: 10, reviewsAtBackup: 0, lastBackup: NOW - 8 * DAY }, NOW), true);
  assert.equal(Game.backupDue({ totalReviews: 10, reviewsAtBackup: 0, lastBackup: NOW - 2 * DAY }, NOW), false);
  assert.equal(Game.backupDue({ totalReviews: 0, reviewsAtBackup: 0, firstUse: NOW - 30 * DAY }, NOW), false);
  assert.equal(Game.backupDue({ totalReviews: 3, reviewsAtBackup: 0, firstUse: NOW - 8 * DAY }, NOW), true);
});

// ---------- Backup/Import ----------
function validBackup() {
  const c = F.review(F.initCard('es.u1.i01', 'es', 1, NOW), 3, NOW).card;
  return { app: 'LingoForge', version: 1, exportedAt: NOW,
    settings: { k: 'main', lang: 'es', goal: 30, newPerDay: 10, retention: 0.9, rate: 0.9, theme: 'auto', unlockAll: false, voices: { es: 'x' } },
    cards: [c],
    reviewLog: [{ cardId: 'es.u1.i01', lang: 'es', ts: NOW, rating: 3, exType: 'choice', prevS: 0, prevD: 0, elapsedDays: 0, ms: 4000, hintUsed: false }],
    daily: [{ date: '2026-06-15', lang: 'es', xp: 40, reviews: 12, newItems: 4, correct: 10, wrong: 2, goalMet: true, seconds: 300 }] };
}

test('Import: gültiges Backup wird bereinigt übernommen (frische Objekte)', () => {
  const raw = validBackup();
  const out = Backup.parse(JSON.stringify(raw));
  assert.equal(out.cards.length, 1); assert.equal(out.reviewLog.length, 1); assert.equal(out.daily.length, 1);
  assert.equal(out.settings.lang, 'es');
  assert.notEqual(out.cards[0], raw.cards[0]);
  const round = Backup.parse(JSON.stringify(Backup.make({ settings: out.settings, cards: out.cards, reviewLog: out.reviewLog, daily: out.daily }, NOW)));
  assert.deepEqual(round.cards, out.cards);
});

test('Import: __proto__, constructor, prototype werden abgewehrt, kein Prototype-Pollution', () => {
  const evil = '{"app":"LingoForge","version":1,"cards":[],"__proto__":{"polluted":true}}';
  assert.throws(() => Backup.parse(evil), /Unzulässiger Schlüssel/);
  assert.equal({}.polluted, undefined);
  for (const key of ['constructor', 'prototype']) {
    const b = validBackup(); b.settings[key] = { x: 1 };
    assert.throws(() => Backup.parse(JSON.stringify(b)), /Unzulässiger Schlüssel/, key);
  }
  const nested = validBackup(); nested.cards[0] = JSON.parse('{"id":"es.u1.i01","__proto__":{"a":1}}');
  assert.throws(() => Backup.parse(JSON.stringify(nested).replace('"id"', '"__proto__":{"a":1},"id"')), /Unzulässiger Schlüssel/);
  assert.equal({}.a, undefined);
});

test('Import: Größenlimit, Format- und Werteprüfung', () => {
  assert.throws(() => Backup.parse('x'.repeat(Backup.MAX_BYTES + 1)), /zu groß/);
  assert.throws(() => Backup.parse('nope'), /JSON/);
  assert.throws(() => Backup.parse('[]'), /Ungültiger Eintrag/);
  assert.throws(() => Backup.parse('{"app":"Other","version":1}'), /kein LingoForge/);
  assert.throws(() => Backup.parse(JSON.stringify({ ...validBackup(), version: 2 })), /kein LingoForge/);
  const mut = (fn) => { const b = validBackup(); fn(b); return JSON.stringify(b); };
  assert.throws(() => Backup.parse(mut((b) => { b.cards[0].id = 'x'; })), /Karten-ID/);
  assert.throws(() => Backup.parse(mut((b) => { b.cards[0].state = 9; })), /Status/);
  assert.throws(() => Backup.parse(mut((b) => { b.cards[0].stability = -1; })), /Stabilität/);
  assert.throws(() => Backup.parse(mut((b) => { b.cards[0].due = 'morgen'; })), /due/);
  assert.throws(() => Backup.parse(mut((b) => { b.cards.push({ ...b.cards[0] }); })), /Doppelte/);
  assert.throws(() => Backup.parse(mut((b) => { b.reviewLog[0].rating = 7; })), /rating/);
  assert.throws(() => Backup.parse(mut((b) => { b.daily[0].date = '15.06.2026'; })), /Datum/);
  assert.throws(() => Backup.parse(mut((b) => { b.settings.retention = 0.5; })), /retention/);
  assert.throws(() => Backup.parse(mut((b) => { b.settings.theme = 'neon'; })), /Theme/);
  assert.throws(() => Backup.parse(mut((b) => { b.cards = new Array(5001).fill(b.cards[0]); })), /zu große Liste/);
});

test('Import: unbekannte Felder werden verworfen', () => {
  const b = validBackup(); b.cards[0].evil = '<script>'; b.settings.extra = 1;
  const out = Backup.parse(JSON.stringify(b));
  assert.equal('evil' in out.cards[0], false);
  assert.equal('extra' in out.settings, false);
});

test('Merge: neuere Review gewinnt, Log dedupliziert, Tage Maximum', () => {
  const a = F.review(F.initCard('es.u1.i01', 'es', 1, NOW), 3, NOW).card;
  const newer = F.review(a, 3, NOW + 3 * DAY).card;
  const older = F.initCard('es.u1.i02', 'es', 1, NOW);
  assert.equal(Backup.mergeCards({ [a.id]: a }, [newer]).length, 1);
  assert.equal(Backup.mergeCards({ [newer.id]: newer }, [a]).length, 0);
  assert.equal(Backup.mergeCards({}, [older]).length, 1);
  const rec = { cardId: 'es.u1.i01', ts: 5 };
  assert.deepEqual(Backup.mergeLog([rec], [rec, { cardId: 'es.u1.i01', ts: 6 }]).map((r) => r.ts), [6]);
  const d = Backup.mergeDaily({ '2026-06-15': { date: '2026-06-15', lang: 'en', xp: 50, reviews: 5, newItems: 1, correct: 4, wrong: 1, goalMet: false, seconds: 10 } },
    [{ date: '2026-06-15', lang: 'es', xp: 30, reviews: 9, newItems: 0, correct: 8, wrong: 1, goalMet: true, seconds: 5 }]);
  assert.deepEqual([d[0].xp, d[0].reviews, d[0].goalMet, d[0].seconds], [50, 9, true, 10]);
});

// ---------- Red-Team: Sprachkopplung, Limits ----------
test('Import: Daten deaktivierter Sprachen werden verworfen, settings.lang fällt auf es zurück', () => {
  const b = validBackup();
  const fr = F.review(F.initCard('fr.u1.i01', 'fr', 1, NOW), 3, NOW).card;
  b.cards.push(fr);
  b.reviewLog.push({ ...b.reviewLog[0], cardId: 'fr.u1.i01', lang: 'fr' });
  b.daily.push({ ...b.daily[0], date: '2026-06-14', lang: 'fr' });
  b.settings.lang = 'fr';
  const out = Backup.parse(JSON.stringify(b));
  assert.deepEqual([out.cards.length, out.reviewLog.length, out.daily.length], [1, 1, 1]);
  assert.equal(out.discarded, 3);
  assert.ok(out.cards.every((c) => c.lang === 'es'));
  assert.equal(out.settings.lang, 'es');
  b.cards[0].lang = 'xx';
  assert.throws(() => Backup.parse(JSON.stringify(b)), /Sprache/);
  const c = validBackup(); c.cards[0].id = 'fr.u1.i01';
  assert.throws(() => Backup.parse(JSON.stringify(c)), /passt nicht zur Sprache/);
});

test('Import: reviewLog auf 100000 Einträge begrenzt', () => {
  assert.equal(Backup.LIMITS.reviewLog, 100000);
  const b = validBackup(); b.reviewLog = new Array(100001).fill({});
  assert.throws(() => Backup.parse(JSON.stringify(b)), /zu große Liste/);
});
