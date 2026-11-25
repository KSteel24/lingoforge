// Eigenschaftstests für FSRS-5. Es gibt keine Offline-Referenzimplementierung; geprüft werden
// die Formeln aus der Spezifikation und ihre erwarteten Eigenschaften, keine Referenzwerte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const F = require('../src/js/fsrs.js');
const DAY = F.DAY;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

test('Konstanten und Gewichte', () => {
  assert.equal(F.W.length, 19);
  assert.equal(F.DECAY, -0.5);
  near(F.FACTOR, 19 / 81);
  assert.equal(F.MAX_INTERVAL, 36500);
});

test('R(S,S) = 0.9 und R(0,S) = 1, R fällt monoton', () => {
  for (const s of [0.1, 1, 3.17, 15.7, 400]) near(F.retrievability(s, s), 0.9, 1e-12);
  near(F.retrievability(0, 5), 1);
  let prev = 1;
  for (let t = 1; t < 100; t++) { const r = F.retrievability(t, 7); assert.ok(r < prev); prev = r; }
});

test('Intervall bei Retention 0.9 entspricht S, höhere Retention verkürzt', () => {
  for (const s of [0.5, 2, 10, 100]) near(F.intervalFor(s, 0.9), s, 1e-9);
  assert.ok(F.intervalFor(10, 0.97) < F.intervalFor(10, 0.9));
  assert.ok(F.intervalFor(10, 0.8) > F.intervalFor(10, 0.9));
  near(F.retrievability(F.intervalFor(12, 0.85), 12), 0.85, 1e-12);
});

test('Initialwerte: S0 = w[rating-1], D0 nach Formel und in [1,10]', () => {
  for (let g = 1; g <= 4; g++) {
    near(F.initS(g, F.W), F.W[g - 1]);
    near(F.initD(g, F.W), Math.min(10, Math.max(1, F.W[4] - Math.exp(F.W[5] * (g - 1)) + 1)));
    assert.ok(F.initD(g, F.W) >= 1 && F.initD(g, F.W) <= 10);
  }
  assert.ok(F.initD(1, F.W) > F.initD(2, F.W) && F.initD(2, F.W) > F.initD(3, F.W) && F.initD(3, F.W) > F.initD(4, F.W));
});

test('Schwierigkeit: Again erhöht, Easy senkt, Mean-Reversion, immer in [1,10]', () => {
  assert.ok(F.nextD(5, 1, F.W) > 5);
  assert.ok(F.nextD(5, 4, F.W) < 5);
  assert.ok(F.nextD(10, 1, F.W) <= 10 && F.nextD(1, 4, F.W) >= 1);
  const rnd = lcg(7);
  let d = 5;
  for (let i = 0; i < 2000; i++) { d = F.nextD(d, 1 + Math.floor(rnd() * 4), F.W); assert.ok(d >= 1 && d <= 10); }
  // dauerhaft Good konvergiert (kein Wegdriften)
  let x = 9; for (let i = 0; i < 200; i++) x = F.nextD(x, 3, F.W);
  assert.ok(x < 9);
});

test('Stabilität nach Review: Monotonie Again < Hard < Good < Easy, Wachstum bei Good/Easy, Again senkt', () => {
  for (const s of [0.5, 3, 12, 80]) for (const d of [2, 5, 8]) {
    const r = F.retrievability(s, s); // fällig bei Retention 0.9
    const again = F.forgetS(s, d, r, F.W), hard = F.recallS(s, d, r, 2, F.W), good = F.recallS(s, d, r, 3, F.W), easy = F.recallS(s, d, r, 4, F.W);
    assert.ok(again < hard, `again<hard s=${s} d=${d}`);
    assert.ok(hard < good && good < easy, `hard<good<easy s=${s} d=${d}`);
    assert.ok(good > s && easy > s, 'Good/Easy wachsen');
    assert.ok(again < s, 'Again senkt');
    assert.ok(hard >= s, 'Hard senkt nicht');
  }
});

test('Niedrigere Retrievability beim Abruf erhöht den Stabilitätsgewinn (Spacing-Effekt)', () => {
  const s = 10, d = 5;
  assert.ok(F.recallS(s, d, 0.7, 3, F.W) > F.recallS(s, d, 0.95, 3, F.W));
});

test('Höhere Schwierigkeit verlangsamt das Wachstum', () => {
  assert.ok(F.recallS(10, 2, 0.9, 3, F.W) > F.recallS(10, 9, 0.9, 3, F.W));
});

test('Kurzzeit-Stabilität (selber Tag) monoton in Rating', () => {
  const s = 2;
  const v = [1, 2, 3, 4].map((g) => F.shortS(s, g, F.W));
  assert.ok(v[0] < v[1] && v[1] < v[2] && v[2] < v[3]);
  assert.ok(v[0] < s && v[2] > s);
});

test('review: erstes Rating setzt S/D aus Tabelle, State und Fälligkeit', () => {
  const t0 = new Date(2026, 0, 10, 15, 30).getTime();
  for (let g = 1; g <= 4; g++) {
    const c = F.initCard('es.u1.i01', 'es', 1, t0);
    const { card, interval } = F.review(c, g, t0);
    near(card.stability, F.W[g - 1]);
    near(card.difficulty, F.initD(g, F.W));
    assert.equal(card.reps, 1);
    assert.equal(card.lastReview, t0);
    if (g === 1) { assert.equal(card.state, 1); assert.equal(interval, 0); assert.equal(card.due, t0 + 600000); }
    else {
      assert.equal(card.state, 2);
      assert.ok(interval >= 1 && card.due > t0);
      assert.equal(new Date(card.due).getHours(), 0); // Fälligkeit zu Tagesbeginn (lokal)
    }
  }
  assert.equal(F.review(F.initCard('x.u1.i01', 'es', 1, t0), 4, t0).interval, Math.round(F.W[3]));
});

test('review: Intervall nie über 36500 Tage, mindestens 1', () => {
  const t0 = Date.now();
  let c = { ...F.initCard('a.u1.i01', 'es', 1, t0), state: 2, stability: 1e6, difficulty: 3, lastReview: t0 - 400 * DAY, reps: 5 };
  const r = F.review(c, 4, t0);
  assert.ok(r.interval <= 36500);
  const low = F.review({ ...c, stability: 0.01 }, 2, t0);
  assert.ok(low.interval >= 1);
});

test('review: Zeitplan mit lauter Good erzeugt wachsende Intervalle, Lapse zählt', () => {
  let now = new Date(2026, 2, 1, 9).getTime();
  let c = F.initCard('es.u1.i02', 'es', 1, now);
  let last = 0;
  for (let i = 0; i < 8; i++) {
    const r = F.review(c, 3, now);
    c = r.card;
    if (i > 0) assert.ok(r.interval >= last, `Intervall ${i}: ${r.interval} < ${last}`);
    last = r.interval;
    now = c.due + 3600000; // eine Stunde nach Fälligkeit
  }
  assert.ok(last > 20, `Intervall nach 8 Good: ${last}`);
  const s0 = c.stability, l0 = c.lapses;
  const f = F.review(c, 1, now);
  assert.equal(f.card.state, 3);
  assert.equal(f.card.lapses, l0 + 1);
  assert.ok(f.card.stability < s0);
  assert.equal(f.card.due, now + 600000);
});

test('review: Wiederholung am selben Tag nutzt Kurzzeit-Formel', () => {
  const t0 = new Date(2026, 4, 5, 10).getTime();
  const c1 = F.review(F.initCard('e.u1.i01', 'es', 1, t0), 3, t0).card;
  const t1 = t0 + 3600000;
  const c2 = F.review(c1, 3, t1).card;
  near(c2.stability, F.shortS(c1.stability, 3, F.W), 1e-9);
  assert.ok(c2.stability > c1.stability);
});

test('Eigenschaft über zufällige Verläufe: S>0, D in [1,10], due > lastReview, Zustand gültig', () => {
  const rnd = lcg(42);
  for (let run = 0; run < 50; run++) {
    let now = Date.now();
    let c = F.initCard('f.u1.i01', 'es', 1, now);
    for (let i = 0; i < 60; i++) {
      const g = 1 + Math.floor(rnd() * 4);
      c = F.review(c, g, now, { retention: 0.8 + rnd() * 0.17 }).card;
      assert.ok(c.stability > 0 && Number.isFinite(c.stability));
      assert.ok(c.difficulty >= 1 && c.difficulty <= 10);
      assert.ok(c.due > c.lastReview);
      assert.ok([1, 2, 3].includes(c.state));
      now = c.due + Math.floor(rnd() * 5 * DAY);
    }
  }
});

test('review verändert das Eingabeobjekt nicht', () => {
  const c = F.initCard('z.u1.i01', 'es', 1, 1000);
  const snap = JSON.stringify(c);
  F.review(c, 3, 5000);
  assert.equal(JSON.stringify(c), snap);
});
