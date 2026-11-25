/* Core: App-Zustand (im Speicher) + Persistenz-Schicht. Schreibt nach jeder Antwort. */
(function (root) {
  'use strict';
  var LF = root.LF, Fsrs = LF.Fsrs, Game = LF.Game, Backup = LF.Backup, DB = LF.DB, Speech = LF.Speech;

  var DEFAULTS = { k: 'main', lang: LF.Lib.ENABLED_LANGS[0], goal: 30, newPerDay: 10, retention: 0.9, rate: 0.9, theme: 'auto',
    unlockAll: false, voices: {} };

  var App = {
    S: { settings: null, meta: null, cards: {}, daily: {}, progress: {} },
    dbError: null, session: null, updateWorker: null, handlers: {}
  };

  App.on = function (name, fn) { (App.handlers[name] = App.handlers[name] || []).push(fn); };
  App.emit = function (name, arg) { (App.handlers[name] || []).forEach(function (f) { try { f(arg); } catch (e) { /* UI-Fehler isolieren */ } }); };

  App.setDbError = function (msg) { App.dbError = msg; App.emit('banner'); };

  function applyState(st) {
    var s = Object.assign({}, DEFAULTS, st.settings || {});
    s.voices = Object.assign({}, (st.settings && st.settings.voices) || {});
    s.k = 'main';
    if (LF.Lib.ENABLED_LANGS.indexOf(s.lang) < 0) s.lang = LF.Lib.ENABLED_LANGS[0];
    App.S.settings = s;
    App.S.meta = Object.assign({ k: 'main', firstUse: Date.now(), lastBackup: 0, reviewsAtBackup: 0, totalReviews: 0, sessions: 0 }, st.meta || {});
    App.S.cards = {}; (st.cards || []).forEach(function (c) { App.S.cards[c.id] = c; });
    App.S.daily = {}; (st.daily || []).forEach(function (d) { App.S.daily[d.date] = d; });
    App.S.progress = {}; (st.progress || []).forEach(function (p) { App.S.progress[p.lang + '|' + p.unitId] = p; });
  }

  App.init = function () {
    return DB.open().then(function () { return DB.loadState(); }).catch(function (e) {
      App.setDbError(e.message);
      return { settings: null, meta: null, cards: [], daily: [], progress: [] };
    }).then(function (st) {
      applyState(st);
      if (DB.mode !== 'idb' && DB.error) App.dbError = DB.error;
      App.applyTheme();
      Speech.init();
      Speech.onProblem = function (msg) { App.emit('toast', msg); App.emit('banner'); };
      if (!st.settings || !st.meta) App.persist({ settings: App.S.settings, meta: App.S.meta });
    });
  };

  App.reloadState = function () {
    return DB.loadState().then(function (st) { applyState(st); App.applyTheme(); });
  };

  App.persist = function (batch) {
    return DB.saveBatch(batch).catch(function (e) { App.setDbError(e.message); });
  };

  App.settings = function () { return App.S.settings; };
  App.saveSettings = function () { return App.persist({ settings: App.S.settings }); };
  App.content = function (lang) { return LF.content[lang || App.S.settings.lang]; };
  App.today = function () { return Game.dateKey(Date.now()); };

  App.applyTheme = function () {
    var t = App.S.settings.theme, el = document.documentElement;
    if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
  };

  App.dailyRec = function (lang) {
    var k = App.today(), d = App.S.daily[k];
    if (!d) {
      d = { date: k, lang: lang || App.S.settings.lang, xp: 0, reviews: 0, newItems: 0, correct: 0, wrong: 0, goalMet: false, seconds: 0 };
      App.S.daily[k] = d;
    }
    return d;
  };

  App.newToday = function () { var d = App.S.daily[App.today()]; return d ? d.newItems : 0; };

  App.cardsFor = function (lang) {
    var out = {};
    Object.keys(App.S.cards).forEach(function (id) { if (App.S.cards[id].lang === lang) out[id] = App.S.cards[id]; });
    return out;
  };

  App.progressRec = function (lang, unitId) {
    var c = App.content(lang), unit = c.units[unitId - 1], st = Game.unitStats(unit, App.S.cards);
    var p = { lang: lang, unitId: unitId, introduced: st.introduced, mastered: st.mastered, total: st.total, updatedAt: Date.now() };
    App.S.progress[lang + '|' + unitId] = p;
    return p;
  };

  App.introduce = function (lang, item) {
    if (App.S.cards[item.id]) return Promise.resolve();
    var c = Fsrs.initCard(item.id, lang, item.unit, Date.now());
    App.S.cards[item.id] = c;
    return App.persist({ cards: [c] });
  };

  // info: {ex, ms, hint, correct}
  App.recordAnswer = function (lang, item, rating, info) {
    var now = Date.now(), S = App.S;
    var pre = S.cards[item.id] || Fsrs.initCard(item.id, lang, item.unit, now);
    var wasNew = pre.state === 0;
    var r = Fsrs.review(pre, rating, now, { retention: S.settings.retention });
    S.cards[item.id] = r.card;
    var log = { cardId: item.id, lang: lang, ts: now, rating: rating, exType: info.ex, prevS: r.log.prevS || 0,
      prevD: r.log.prevD || 0, elapsedDays: r.log.elapsedDays, ms: Math.round(info.ms), hintUsed: !!info.hint };
    var d = App.dailyRec(lang);
    d.lang = lang; d.reviews++; if (wasNew) d.newItems++;
    if (info.correct) d.correct++; else d.wrong++;
    d.seconds = Math.round(d.seconds + Math.min(60, info.ms / 1000));
    S.meta.totalReviews = (S.meta.totalReviews || 0) + 1;
    var rec = { pre: pre, card: r.card, log: log, lang: lang, item: item, wasNew: wasNew };
    rec.saved = App.persist({ cards: [r.card], log: [log], daily: [d], progress: [App.progressRec(lang, item.unit)], meta: S.meta });
    return rec;
  };

  // "Das war leicht": erneut mit Rating 4 aus dem Zustand vor der Antwort rechnen.
  App.upgradeEasy = function (rec) {
    return rec.saved.then(function () {
      var r = Fsrs.review(rec.pre, 4, rec.log.ts, { retention: App.S.settings.retention });
      App.S.cards[rec.item.id] = r.card; rec.card = r.card; rec.log.rating = 4;
      var batch = { cards: [r.card], progress: [App.progressRec(rec.lang, rec.item.unit)] };
      if (rec.log.n) batch.log = [rec.log];
      return App.persist(batch);
    });
  };

  App.addXp = function (n, lang) {
    var d = App.dailyRec(lang);
    d.xp += n;
    if (d.xp >= App.S.settings.goal) d.goalMet = true;
    App.persist({ daily: [d] });
    return d;
  };

  App.sessionDone = function () {
    App.S.meta.sessions = (App.S.meta.sessions || 0) + 1;
    App.persist({ meta: App.S.meta });
  };

  App.streak = function () { return Game.streak(App.S.daily, App.today()); };
  App.totalXp = function () { var t = 0; for (var k in App.S.daily) t += App.S.daily[k].xp; return t; };

  App.hasVoice = function () { return Speech.usable(); };
  App.speak = function (text, lang, slow) {
    var s = App.S.settings;
    return Speech.speak(text, lang, { voiceURI: s.voices[lang] || '', rate: s.rate, slow: !!slow, tts: App.content(lang).tts });
  };

  App.exportJson = function () {
    return DB.exportAll().then(function (d) {
      var data = Backup.make({ settings: App.S.settings, cards: d.cards, reviewLog: d.reviewLog, daily: d.daily }, Date.now());
      return JSON.stringify(data);
    });
  };

  App.markBackup = function () {
    App.S.meta.lastBackup = Date.now();
    App.S.meta.reviewsAtBackup = App.S.meta.totalReviews || 0;
    return App.persist({ meta: App.S.meta });
  };

  App.importData = function (data, mode) {
    var meta = Object.assign({}, App.S.meta);
    var p;
    if (mode === 'replace') {
      if (data.settings) data.settings.k = 'main';
      meta.totalReviews = data.reviewLog.length; meta.reviewsAtBackup = meta.totalReviews; meta.lastBackup = Date.now();
      p = DB.replaceAll(data, meta);
    } else {
      p = DB.mergeAll(data, Backup);
    }
    return p.then(function () { return App.reloadState(); }).then(function () {
      if (mode !== 'replace') {
        return DB.loadLog().then(function (log) {
          App.S.meta.totalReviews = log.length;
          App.S.meta.reviewsAtBackup = Math.min(App.S.meta.reviewsAtBackup || 0, log.length);
        });
      }
    }).then(function () {
      var prog = [];
      LF.Lib.ENABLED_LANGS.forEach(function (l) { App.content(l).units.forEach(function (u) { prog.push(App.progressRec(l, u.id)); }); });
      return App.persist({ progress: prog, meta: App.S.meta });
    });
  };

  App.wipeAll = function () {
    return DB.wipe().catch(function (e) { return DB.open().then(function () { throw e; }); }).then(function () { return DB.open(); }).then(function () {
      applyState({}); App.applyTheme(); App.dbError = DB.mode === 'idb' ? null : DB.error; App.session = null;
      App.emit('banner');
      return App.persist({ settings: App.S.settings, meta: App.S.meta });
    });
  };

  LF.App = App;
})(typeof globalThis !== 'undefined' ? globalThis : this);
