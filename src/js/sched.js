/* Sched: Sitzungsaufbau (rein). 15 Schritte, Mix Wiederholung/Neues, Interleaving. */
(function (root) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Fsrs = isNode ? require('./fsrs.js') : root.LF.Fsrs;
  var Game = isNode ? require('./game.js') : root.LF.Game;

  function newBudget(newPerDay, doneToday, backlog) {
    var b = Math.max(0, newPerDay - doneToday);
    if (backlog > 30) return 0;
    if (backlog > 15) return Math.floor(b / 2);
    return b;
  }

  function dueCount(cards, now) {
    var n = 0;
    for (var id in cards) if (cards[id].state > 0 && cards[id].due <= now) n++;
    return n;
  }

  function tilesOk(item) { return item.tokens.length >= 2 && item.distractors.length >= 2; }

  // Übungstypen nach Stabilität. card=null/State 0 -> Erkennen.
  function exCandidates(item, card, voice) {
    var s = card && card.state > 0 ? card.stability : 0, word = item.kind === 'word', list = [];
    if (s < 2) {
      list.push('choice');
      if (tilesOk(item) && !word) list.push('tiles');
      if (voice) list.push('listenChoice');
    } else if (s <= 10) {
      if (item.cloze) list.push('cloze');
      if (tilesOk(item)) list.push('tiles');
      if (voice && !word) list.push('shadow');
      if (!list.length) list = ['typing', 'choice'];
    } else {
      list.push('typing');
      if (voice) list.push('dictation');
    }
    return list;
  }

  function pickFrom(list, forbidden, prev, rng) {
    var ok = list.filter(function (e) { return !forbidden(e); });
    if (!ok.length) ok = ['typing', 'choice'].filter(function (e) { return !forbidden(e); });
    var pref = ok.filter(function (e) { return e !== prev; });
    var pool = pref.length ? pref : ok;
    return pool[Math.floor(rng() * pool.length)];
  }

  function assignExercises(steps, o) {
    var h1 = null, h2 = null, rng = o.rng || Math.random;
    steps.forEach(function (st) {
      if (st.type !== 'ex') return;
      var item = o.content.byId[st.id], card = o.cards[st.id];
      var list = exCandidates(item, st.retry ? null : card, o.hasVoice);
      st.ex = pickFrom(list, function (e) { return h1 === e && h2 === e; }, h2, rng);
      var s = card && card.state > 0 ? card.stability : 0;
      st.dir = (st.retry || s < 1) ? 'tgt2de' : 'de2tgt';
      h1 = h2; h2 = st.ex;
    });
    return steps;
  }

  // Fehler: Item 3-4 Positionen später erneut (ohne FSRS-Update). idx = aktuelle Position.
  function insertRetry(steps, idx, item, o) {
    var rng = o.rng || Math.random;
    var pos = Math.min(steps.length, idx + 3 + (rng() < 0.5 ? 0 : 1));
    var list = exCandidates(item, null, o.hasVoice);
    function ex(i) { return steps[i] && steps[i].type === 'ex' ? steps[i].ex : null; }
    function forbidden(e) {
      return (ex(pos - 1) === e && ex(pos - 2) === e) || (ex(pos - 1) === e && ex(pos) === e) ||
        (ex(pos) === e && ex(pos + 1) === e);
    }
    var step = { id: item.id, type: 'ex', retry: true, tries: (o.tries || 0) + 1, dir: 'tgt2de' };
    step.ex = pickFrom(list, forbidden, ex(pos - 1), rng);
    steps.splice(pos, 0, step);
    return pos;
  }

  // Neue Items in Blöcken (>=3 je Block, Rest in den letzten Block): erst alle Intros, dann die Übungen
  // in gleicher Reihenfolge -> Abstand = Blockgröße. Kleine Blöcke bekommen Wiederholungen als Füller.
  // Übrige Wiederholungen werden gleichmäßig davor, dazwischen und danach verteilt.
  function orderSteps(reviews, newIds, content) {
    var rq = reviews.map(function (c) { return { id: c.id, type: 'ex', unit: content.byId[c.id].unit }; });
    var out = [], lastUnit = null, groups = [];
    function push(step) { lastUnit = content.byId[step.id].unit; delete step.unit; out.push(step); }
    function takeReview() {
      var lim = Math.min(4, rq.length);
      for (var k = 0; k < lim; k++) if (rq[k].unit !== lastUnit) return rq.splice(k, 1)[0];
      return rq.shift();
    }
    if (newIds.length < 3) { if (newIds.length) groups.push(newIds.slice()); }
    else {
      var k = Math.floor(newIds.length / 3), at = 0, g;
      for (g = 0; g < k; g++) {
        var size = g === k - 1 ? newIds.length - at : 3;
        groups.push(newIds.slice(at, at + size)); at += size;
      }
    }
    var fillers = 0;
    groups.forEach(function (g) { fillers += Math.max(0, 3 - g.length); });
    var rem = Math.max(0, rq.length - fillers), slots = groups.length + 1;
    for (var s = 0; s < slots; s++) {
      var n = Math.floor(rem / slots) + (s < rem % slots ? 1 : 0);
      while (n-- > 0 && rq.length) push(takeReview());
      if (s < groups.length) {
        var grp = groups[s];
        grp.forEach(function (id) { push({ id: id, type: 'intro' }); });
        for (var f = Math.max(0, 3 - grp.length); f > 0 && rq.length; f--) push(takeReview());
        grp.forEach(function (id) { push({ id: id, type: 'ex', isNew: true }); });
      }
    }
    while (rq.length) push(takeReview());
    return out;
  }

  // o: {content, cards, settings{newPerDay,unlockAll}, newToday, now, rng, hasVoice, size, onlyUnit}
  function buildSession(o) {
    var size = o.size || 15, now = o.now, C = o.content, rng = o.rng || Math.random, cards = o.cards;
    function inUnit(id) { return !o.onlyUnit || C.byId[id].unit === o.onlyUnit; }
    function rOf(c) { return Fsrs.cardRetrievability(c, now); }
    var all = [];
    for (var id in cards) if (C.byId[id] && cards[id].state > 0) all.push(cards[id]);
    var due = all.filter(function (c) { return c.due <= now; }).sort(function (a, b) { return rOf(a) - rOf(b); });
    var backlog = due.length;
    var dueSel = due.filter(function (c) { return inUnit(c.id); });
    var early = all.filter(function (c) { return c.due > now && inUnit(c.id); })
      .sort(function (a, b) { return rOf(a) - rOf(b); });
    var budget = newBudget(o.settings.newPerDay, o.newToday || 0, backlog);
    var open = Game.unlocked(C, cards, !!o.settings.unlockAll);
    var cand = [];
    C.units.forEach(function (u, i) {
      if (!open[i] || (o.onlyUnit && u.id !== o.onlyUnit)) return;
      u.items.forEach(function (it) { if (!cards[it.id] || cards[it.id].state === 0) cand.push(it.id); });
    });
    var nNew = Math.min(budget, cand.length, 2);
    var want = size - 2 * nNew;
    var reviews = dueSel.slice(0, want);
    if (reviews.length < want) reviews = reviews.concat(early.slice(0, want - reviews.length));
    var slots = size - reviews.length - 2 * nNew;
    if (slots >= 2) nNew += Math.max(0, Math.min(Math.floor(slots / 2), budget - nNew, cand.length - nNew));
    var steps = orderSteps(reviews, cand.slice(0, nNew), C);
    assignExercises(steps, { content: C, cards: cards, hasVoice: !!o.hasVoice, rng: rng });
    return { steps: steps, stats: { due: backlog, reviews: reviews.length, newItems: nNew, budget: budget } };
  }

  var api = { newBudget: newBudget, dueCount: dueCount, exCandidates: exCandidates,
    assignExercises: assignExercises, insertRetry: insertRetry, buildSession: buildSession, tilesOk: tilesOk };
  if (isNode) module.exports = api; else root.LF.Sched = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
