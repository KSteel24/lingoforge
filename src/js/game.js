/* Game: Bewertung, XP, Serie, Einheiten-Freischaltung, Statistik (rein). */
(function (root) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(key, n) {
    var p = key.split('-');
    return dateKey(new Date(+p[0], +p[1] - 1, +p[2] + n).getTime());
  }

  // Serie: ein Tag zählt bei goalMet (lokale Zeit). Heute offen -> ab gestern zählen.
  function streak(daily, todayKey) {
    var cur = 0, k = todayKey;
    if (!(daily[k] && daily[k].goalMet)) k = addDays(k, -1);
    while (daily[k] && daily[k].goalMet) { cur++; k = addDays(k, -1); }
    var keys = Object.keys(daily).filter(function (x) { return daily[x].goalMet; }).sort();
    var best = 0, run = 0, prev = null;
    keys.forEach(function (x) {
      run = prev && addDays(prev, 1) === x ? run + 1 : 1;
      if (run > best) best = run;
      prev = x;
    });
    return { current: cur, best: Math.max(best, cur) };
  }

  // Schwellen (ms): slow -> Hard, fast -> Easy (nur Produktion).
  function thresholds(ex, item) {
    var n = item.tokens ? item.tokens.length : 1, len = String(item.tgt).length;
    if (ex === 'tiles') return { slow: 8000 + 3000 * n, fast: 2000 + 1500 * n };
    if (ex === 'typing' || ex === 'dictation') {
      return { slow: Math.min(60000, 10000 + 700 * len), fast: 2500 + 250 * len };
    }
    if (ex === 'shadow') return { slow: 120000, fast: 0 };
    return { slow: 12000, fast: 0 };
  }

  // o: {ex,item,correct,check,hint,ms,easyBtn,selfRating}
  function rating(o) {
    if (o.selfRating) return o.selfRating;
    if (!o.correct) return 1;
    if (o.hint || o.check === 'typo' || o.check === 'accentOnly') return 2;
    var t = thresholds(o.ex, o.item);
    if (o.ms > t.slow) return 2;
    if (o.easyBtn) return 4;
    if (t.fast && o.ms < t.fast && o.check === 'exact') return 4;
    return 3;
  }

  // XP: 10 je richtiger Erstantwort, +5 ab der 3. richtigen in Folge.
  function xpForAnswer(correct, runAfter) { return correct ? 10 + (runAfter >= 3 ? 5 : 0) : 0; }
  var SESSION_BONUS = 20;

  function unitStats(unit, cards) {
    var total = unit.items.length, introduced = 0, mastered = 0;
    unit.items.forEach(function (it) {
      var c = cards[it.id];
      if (c && c.state > 0) {
        introduced++;
        if (c.state === 2 && c.stability >= 5) mastered++;
      }
    });
    return { total: total, introduced: introduced, mastered: mastered, ratio: total ? mastered / total : 0 };
  }

  // Einheit n+1 frei ab 60 % gemeisterter Items von n (oder alles frei).
  function unlocked(content, cards, unlockAll) {
    return content.units.map(function (u, i) {
      if (i === 0 || unlockAll) return true;
      return unitStats(content.units[i - 1], cards).ratio >= 0.6;
    });
  }

  // Anteil Erinnerung bei Wiederholungen (prevS > 0) in den letzten days Tagen.
  function retention(log, now, days) {
    var from = now - days * 86400000, n = 0, ok = 0;
    log.forEach(function (r) {
      if (r.ts >= from && r.prevS > 0) { n++; if (r.rating > 1) ok++; }
    });
    return n ? { n: n, value: ok / n } : { n: 0, value: null };
  }

  // Backup-Erinnerung: >=50 Reviews seit Backup oder >=7 Tage (mit >=1 Review).
  function backupDue(meta, now) {
    var since = (meta.totalReviews || 0) - (meta.reviewsAtBackup || 0);
    var ref = meta.lastBackup || meta.firstUse || now;
    if (since >= 50) return true;
    return since >= 1 && now - ref >= 7 * 86400000;
  }

  var api = { dateKey: dateKey, addDays: addDays, streak: streak, thresholds: thresholds, rating: rating,
    xpForAnswer: xpForAnswer, SESSION_BONUS: SESSION_BONUS, unitStats: unitStats, unlocked: unlocked,
    retention: retention, backupDue: backupDue };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LF.Game = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
