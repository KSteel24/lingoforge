/* Backup: Export-Format, validierter Import (Whitelist, __proto__-Abwehr, Größenlimit), Merge. */
(function (root) {
  'use strict';
  var Lib = typeof module === 'object' && module.exports ? require('./content-lib.js') : root.LF.Lib;

  var MAX_BYTES = 8 * 1024 * 1024;
  var LIMITS = { reviewLog: 100000 };
  var LANGS = ['en', 'es', 'fr'];
  var ID_RE = /^[a-z]{2}\.u\d{1,2}\.i\d{1,3}$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var BAD = ['__proto__', 'constructor', 'prototype'];

  function fail(msg) { throw new Error(msg); }

  function scan(v, depth) {
    if (depth > 8) fail('Datei zu tief verschachtelt.');
    if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      for (var i = 0; i < keys.length; i++) {
        if (BAD.indexOf(keys[i]) >= 0) fail('Unzulässiger Schlüssel in der Datei.');
        scan(v[keys[i]], depth + 1);
      }
    }
  }

  function num(v, min, max, what) {
    if (typeof v !== 'number' || !isFinite(v) || v < min || v > max) fail('Ungültiger Wert: ' + what);
    return v;
  }
  function int(v, min, max, what) { return Math.round(num(v, min, max, what)); }
  function str(v, re, what) { if (typeof v !== 'string' || !re.test(v)) fail('Ungültiger Wert: ' + what); return v; }
  function lang(v) { if (LANGS.indexOf(v) < 0) fail('Ungültige Sprache.'); return v; }
  function arr(v, max, what) {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > max) fail('Ungültige oder zu große Liste: ' + what);
    return v;
  }
  function obj(v, what) { if (!v || typeof v !== 'object' || Array.isArray(v)) fail('Ungültiger Eintrag: ' + what); return v; }

  function enabled(l) { return Lib.ENABLED_LANGS.indexOf(l) >= 0; }
  function idLang(id, l) { if (id.indexOf(l + '.') !== 0) fail('Karten-ID passt nicht zur Sprache.'); return id; }

  function card(c) {
    obj(c, 'Karte');
    return { id: idLang(str(c.id, ID_RE, 'Karten-ID'), lang(c.lang)), lang: lang(c.lang), unit: int(c.unit, 1, 99, 'Einheit'),
      state: int(c.state, 0, 3, 'Status'), due: num(c.due, 0, 4e12, 'due'),
      stability: num(c.stability, 0, 36500, 'Stabilität'), difficulty: num(c.difficulty, 0, 10, 'Schwierigkeit'),
      lastReview: num(c.lastReview, 0, 4e12, 'lastReview'), reps: int(c.reps, 0, 1e6, 'reps'),
      lapses: int(c.lapses, 0, 1e6, 'lapses'), introducedAt: num(c.introducedAt, 0, 4e12, 'introducedAt') };
  }

  function logRec(r) {
    obj(r, 'Log');
    return { cardId: str(r.cardId, ID_RE, 'Log-Karte'), lang: lang(r.lang), ts: num(r.ts, 0, 4e12, 'ts'),
      rating: int(r.rating, 1, 4, 'rating'), exType: str(r.exType, /^[a-zA-Z]{1,16}$/, 'exType'),
      prevS: num(r.prevS, 0, 36500, 'prevS'), prevD: num(r.prevD, 0, 10, 'prevD'),
      elapsedDays: num(r.elapsedDays, 0, 40000, 'elapsedDays'), ms: num(r.ms, 0, 3.6e6, 'ms'),
      hintUsed: r.hintUsed === true };
  }

  function dailyRec(d) {
    obj(d, 'Tag');
    return { date: str(d.date, DATE_RE, 'Datum'), lang: lang(d.lang), xp: int(d.xp, 0, 1e7, 'xp'),
      reviews: int(d.reviews, 0, 1e7, 'reviews'), newItems: int(d.newItems, 0, 1e7, 'newItems'),
      correct: int(d.correct, 0, 1e7, 'correct'), wrong: int(d.wrong, 0, 1e7, 'wrong'),
      goalMet: d.goalMet === true, seconds: num(d.seconds, 0, 1e8, 'seconds') };
  }

  function settings(s) {
    if (s === undefined) return null;
    obj(s, 'Einstellungen');
    var voices = {};
    if (s.voices !== undefined) {
      obj(s.voices, 'Stimmen');
      LANGS.forEach(function (l) {
        var v = s.voices[l];
        if (typeof v === 'string' && v.length <= 200) voices[l] = v;
      });
    }
    if (['auto', 'light', 'dark'].indexOf(s.theme) < 0) fail('Ungültiges Theme.');
    if ([20, 30, 50].indexOf(s.goal) < 0) fail('Ungültiges Tagesziel.');
    return { k: 'main', lang: enabled(lang(s.lang)) ? s.lang : Lib.ENABLED_LANGS[0], goal: s.goal, newPerDay: int(s.newPerDay, 0, 50, 'newPerDay'),
      retention: num(s.retention, 0.8, 0.97, 'retention'), rate: num(s.rate, 0.4, 1.5, 'rate'),
      theme: s.theme, unlockAll: s.unlockAll === true, voices: voices };
  }

  function make(data, now) {
    return { app: 'LingoForge', version: 1, exportedAt: now, settings: data.settings, cards: data.cards,
      reviewLog: data.reviewLog, daily: data.daily };
  }

  // Wirft Error mit deutscher Meldung. Liefert bereinigte Kopien (nie Originalobjekte).
  function parse(text) {
    if (typeof text !== 'string') fail('Keine Textdatei.');
    if (text.length > MAX_BYTES) fail('Datei zu groß (max. 8 MB).');
    var raw;
    try { raw = JSON.parse(text); } catch (e) { fail('Keine gültige JSON-Datei.'); }
    obj(raw, 'Datei');
    scan(raw, 0);
    if (raw.app !== 'LingoForge' || raw.version !== 1) fail('Das ist kein LingoForge-Backup (Version 1).');
    var all = {
      cards: arr(raw.cards, 5000, 'Karten').map(card),
      reviewLog: arr(raw.reviewLog, LIMITS.reviewLog, 'Verlauf').map(logRec),
      daily: arr(raw.daily, 20000, 'Tage').map(dailyRec)
    };
    // Daten deaktivierter Sprachen werden verworfen (Kopplung an ENABLED_LANGS).
    var out = { settings: settings(raw.settings), discarded: 0 };
    ['cards', 'reviewLog', 'daily'].forEach(function (k) {
      out[k] = all[k].filter(function (x) { return enabled(x.lang); });
      out.discarded += all[k].length - out[k].length;
    });
    var seen = {};
    out.cards.forEach(function (c) { if (seen[c.id]) fail('Doppelte Karten-ID.'); seen[c.id] = 1; });
    return out;
  }

  // Merge: neuere Review gewinnt; Log dedupliziert (cardId+ts); Tage: Maximum je Feld.
  function mergeCards(existing, imported) {
    var put = [];
    imported.forEach(function (c) {
      var e = existing[c.id];
      if (!e || c.lastReview > e.lastReview || (e.state === 0 && c.state > 0)) put.push(c);
    });
    return put;
  }
  function mergeLog(existingLog, imported) {
    var seen = {};
    existingLog.forEach(function (r) { seen[r.cardId + '|' + r.ts] = 1; });
    return imported.filter(function (r) { return !seen[r.cardId + '|' + r.ts]; });
  }
  function mergeDaily(existing, imported) {
    return imported.map(function (d) {
      var e = existing[d.date];
      if (!e) return d;
      return { date: d.date, lang: e.lang, xp: Math.max(e.xp, d.xp), reviews: Math.max(e.reviews, d.reviews),
        newItems: Math.max(e.newItems, d.newItems), correct: Math.max(e.correct, d.correct),
        wrong: Math.max(e.wrong, d.wrong), goalMet: !!(e.goalMet || d.goalMet),
        seconds: Math.max(e.seconds, d.seconds) };
    });
  }

  var api = { MAX_BYTES: MAX_BYTES, LIMITS: LIMITS, make: make, parse: parse, mergeCards: mergeCards, mergeLog: mergeLog,
    mergeDaily: mergeDaily };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LF.Backup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
