/* Fsrs: FSRS-5 (Standardgewichte), rein, ohne DOM. */
(function (root) {
  'use strict';

  var W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
    1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
  var DECAY = -0.5, FACTOR = 19 / 81, MAX_INTERVAL = 36500, DAY = 86400000, MIN_S = 0.01;

  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

  function retrievability(t, s) { return Math.pow(1 + FACTOR * t / s, DECAY); }

  // Intervall in Tagen für Ziel-Retention r (bei 0.9 gilt I = S).
  function intervalFor(s, r) { return s / FACTOR * (Math.pow(r || 0.9, 1 / DECAY) - 1); }

  function initS(g, w) { return Math.max(w[g - 1], MIN_S); }
  function initD(g, w) { return clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10); }

  function nextD(d, g, w) {
    var delta = -w[6] * (g - 3);
    var damped = d + delta * (10 - d) / 9;
    return clamp(w[7] * initD(4, w) + (1 - w[7]) * damped, 1, 10);
  }

  function recallS(s, d, r, g, w) {
    var hard = g === 2 ? w[15] : 1, easy = g === 4 ? w[16] : 1;
    return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy);
  }

  function forgetS(s, d, r, w) {
    var v = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
    return Math.min(v, s);
  }

  // Kurzzeit-Stabilität (Wiederholung am selben Tag).
  function shortS(s, g, w) { return s * Math.exp(w[17] * (g - 3 + w[18])); }

  function dayStart(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

  function initCard(id, lang, unit, now) {
    return { id: id, lang: lang, unit: unit, state: 0, due: now || 0, stability: 0, difficulty: 0,
      lastReview: 0, reps: 0, lapses: 0, introducedAt: now || 0 };
  }

  function cardRetrievability(card, now) {
    if (!card.stability || !card.lastReview) return 1;
    return retrievability(Math.max(0, (now - card.lastReview) / DAY), card.stability);
  }

  // State: 0 neu, 1 lernen, 2 wiederholen, 3 neu lernen. Rating 1..4.
  function review(card, rating, now, opts) {
    opts = opts || {};
    var w = opts.w || W, ret = opts.retention || 0.9;
    var c = {}; for (var k in card) if (Object.prototype.hasOwnProperty.call(card, k)) c[k] = card[k];
    var prevS = card.stability, prevD = card.difficulty;
    var elapsed = card.lastReview ? Math.max(0, (now - card.lastReview) / DAY) : 0;
    var s, d;
    if (card.state === 0 || !card.stability) {
      s = initS(rating, w); d = initD(rating, w);
    } else {
      var r = retrievability(elapsed, card.stability);
      d = nextD(card.difficulty, rating, w);
      if (elapsed < 1) s = shortS(card.stability, rating, w);
      else if (rating === 1) s = forgetS(card.stability, card.difficulty, r, w);
      else s = recallS(card.stability, card.difficulty, r, rating, w);
    }
    s = Math.max(s, MIN_S);
    var interval;
    if (rating === 1) {
      c.due = now + 10 * 60000; interval = 0;
    } else {
      interval = clamp(Math.round(intervalFor(s, ret)), 1, MAX_INTERVAL);
      c.due = dayStart(now + interval * DAY);
    }
    if (rating === 1 && card.state === 2) c.lapses = (card.lapses || 0) + 1;
    c.state = rating === 1 ? (card.state === 0 ? 1 : 3) : 2;
    c.stability = s; c.difficulty = d; c.lastReview = now; c.reps = (card.reps || 0) + 1;
    return { card: c, interval: interval, log: { prevS: prevS, prevD: prevD, elapsedDays: elapsed } };
  }

  var api = { W: W, DECAY: DECAY, FACTOR: FACTOR, MAX_INTERVAL: MAX_INTERVAL, DAY: DAY,
    retrievability: retrievability, intervalFor: intervalFor, initS: initS, initD: initD, nextD: nextD,
    recallS: recallS, forgetS: forgetS, shortS: shortS, initCard: initCard, review: review,
    cardRetrievability: cardRetrievability, dayStart: dayStart };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LF.Fsrs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
