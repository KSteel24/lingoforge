/* DB: IndexedDB "lingo" v1 mit speicherinternem Fallback (Fehler werden sichtbar gemeldet). */
(function (root) {
  'use strict';

  var NAME = 'lingo', VERSION = 1;
  var STORES = ['meta', 'settings', 'cards', 'reviewLog', 'progress', 'daily'];
  var db = null;
  var DB = { mode: 'memory', error: null };
  var mem = { meta: {}, settings: {}, cards: {}, reviewLog: [], progress: {}, daily: {}, seq: 0 };

  function friendly(err) {
    var n = err && err.name ? err.name : '';
    if (n === 'QuotaExceededError') return 'Speicher voll: Es ist kein Platz mehr für Lernfortschritt. Exportiere ein Backup und gib Speicher frei.';
    if (n === 'SecurityError' || n === 'InvalidStateError' || n === 'UnknownError') return 'Datenbank nicht verfügbar (z. B. privater Modus oder blockierter Speicher). Fortschritt wird nur im Arbeitsspeicher gehalten.';
    if (n === 'VersionError') return 'Datenbank-Version passt nicht zu dieser App.';
    return 'Datenbankfehler' + (n ? ' (' + n + ')' : '') + '.';
  }

  function fail(err) { var e = new Error(friendly(err)); e.name = (err && err.name) || 'Error'; return e; }

  DB.friendly = friendly;

  DB.open = function () {
    return new Promise(function (resolve) {
      function memory(err) { DB.mode = 'memory'; DB.error = friendly(err); resolve(false); }
      if (!root.indexedDB) return memory({ name: 'SecurityError' });
      var req;
      try { req = root.indexedDB.open(NAME, VERSION); } catch (e) { return memory(e); }
      req.onupgradeneeded = function () {
        var d = req.result;
        d.createObjectStore('meta', { keyPath: 'k' });
        d.createObjectStore('settings', { keyPath: 'k' });
        var cards = d.createObjectStore('cards', { keyPath: 'id' });
        cards.createIndex('lang_due', ['lang', 'due']);
        cards.createIndex('lang_state', ['lang', 'state']);
        cards.createIndex('lang_unit', ['lang', 'unit']);
        d.createObjectStore('reviewLog', { keyPath: 'n', autoIncrement: true });
        d.createObjectStore('progress', { keyPath: ['lang', 'unitId'] });
        d.createObjectStore('daily', { keyPath: 'date' });
      };
      req.onsuccess = function () {
        db = req.result;
        db.onversionchange = function () { db.close(); db = null; DB.mode = 'memory'; };
        DB.mode = 'idb'; DB.error = null; resolve(true);
      };
      req.onerror = function () { memory(req.error); };
      req.onblocked = function () { memory({ name: 'UnknownError' }); };
    });
  };

  function run(names, mode, fn) {
    return new Promise(function (resolve, reject) {
      var tx, out;
      try { tx = db.transaction(names, mode); } catch (e) { return reject(fail(e)); }
      tx.oncomplete = function () { resolve(out); };
      tx.onerror = function () { reject(fail(tx.error)); };
      tx.onabort = function () { reject(fail(tx.error)); };
      try { out = fn(tx); } catch (e) { try { tx.abort(); } catch (x) { /* bereits beendet */ } reject(fail(e)); }
    });
  }

  function values(o) { return Object.keys(o).map(function (k) { return o[k]; }); }

  DB.loadState = function () {
    if (DB.mode !== 'idb') {
      return Promise.resolve({ settings: mem.settings.main || null, meta: mem.meta.main || null,
        cards: values(mem.cards), daily: values(mem.daily), progress: values(mem.progress) });
    }
    var res = {};
    return run(STORES.filter(function (s) { return s !== 'reviewLog'; }), 'readonly', function (tx) {
      tx.objectStore('settings').get('main').onsuccess = function (e) { res.settings = e.target.result || null; };
      tx.objectStore('meta').get('main').onsuccess = function (e) { res.meta = e.target.result || null; };
      tx.objectStore('cards').getAll().onsuccess = function (e) { res.cards = e.target.result; };
      tx.objectStore('daily').getAll().onsuccess = function (e) { res.daily = e.target.result; };
      tx.objectStore('progress').getAll().onsuccess = function (e) { res.progress = e.target.result; };
    }).then(function () { return res; });
  };

  DB.loadLog = function () {
    if (DB.mode !== 'idb') return Promise.resolve(mem.reviewLog.slice());
    var out = [];
    return run(['reviewLog'], 'readonly', function (tx) {
      tx.objectStore('reviewLog').getAll().onsuccess = function (e) { out = e.target.result; };
    }).then(function () { return out; });
  };

  // b: {cards:[], log:[], daily:[], progress:[], settings, meta}; Log-Einträge bekommen n.
  DB.saveBatch = function (b) {
    if (DB.mode !== 'idb') {
      (b.cards || []).forEach(function (c) { mem.cards[c.id] = c; });
      (b.log || []).forEach(function (r) { if (!r.n) r.n = ++mem.seq; var i = mem.reviewLog.findIndex(function (x) { return x.n === r.n; }); if (i >= 0) mem.reviewLog[i] = r; else mem.reviewLog.push(r); });
      (b.daily || []).forEach(function (d) { mem.daily[d.date] = d; });
      (b.progress || []).forEach(function (p) { mem.progress[p.lang + '|' + p.unitId] = p; });
      if (b.settings) mem.settings.main = b.settings;
      if (b.meta) mem.meta.main = b.meta;
      return Promise.resolve();
    }
    var names = ['cards', 'reviewLog', 'daily', 'progress', 'settings', 'meta'];
    return run(names, 'readwrite', function (tx) {
      (b.cards || []).forEach(function (c) { tx.objectStore('cards').put(c); });
      (b.log || []).forEach(function (r) {
        var rq = tx.objectStore('reviewLog').put(r);
        rq.onsuccess = function () { r.n = rq.result; };
      });
      (b.daily || []).forEach(function (d) { tx.objectStore('daily').put(d); });
      (b.progress || []).forEach(function (p) { tx.objectStore('progress').put(p); });
      if (b.settings) tx.objectStore('settings').put(b.settings);
      if (b.meta) tx.objectStore('meta').put(b.meta);
    });
  };

  DB.exportAll = function () {
    return Promise.all([DB.loadState(), DB.loadLog()]).then(function (r) {
      return { settings: r[0].settings, meta: r[0].meta, cards: r[0].cards, reviewLog: r[1], daily: r[0].daily };
    });
  };

  // Ersetzen: alles in EINER Transaktion leeren und neu schreiben.
  DB.replaceAll = function (data, meta) {
    if (DB.mode !== 'idb') {
      mem.cards = {}; mem.reviewLog = []; mem.daily = {}; mem.progress = {}; mem.settings = {}; mem.meta = {};
      return DB.saveBatch({ cards: data.cards, log: data.reviewLog, daily: data.daily, settings: data.settings, meta: meta });
    }
    return run(STORES, 'readwrite', function (tx) {
      STORES.forEach(function (s) { tx.objectStore(s).clear(); });
      data.cards.forEach(function (c) { tx.objectStore('cards').put(c); });
      data.reviewLog.forEach(function (r) { tx.objectStore('reviewLog').add(r); });
      data.daily.forEach(function (d) { tx.objectStore('daily').put(d); });
      if (data.settings) tx.objectStore('settings').put(data.settings);
      if (meta) tx.objectStore('meta').put(meta);
    });
  };

  // Zusammenführen: Lesen und Schreiben in EINER Transaktion. merge = Backup-Modul.
  DB.mergeAll = function (data, Backup) {
    if (DB.mode !== 'idb') {
      var ec = mem.cards, ed = mem.daily;
      return DB.saveBatch({ cards: Backup.mergeCards(ec, data.cards), log: Backup.mergeLog(mem.reviewLog, data.reviewLog).map(function (r) { return Object.assign({}, r); }),
        daily: Backup.mergeDaily(ed, data.daily) });
    }
    return run(['cards', 'reviewLog', 'daily'], 'readwrite', function (tx) {
      var ec = {}, ed = {}, el = [];
      tx.objectStore('cards').getAll().onsuccess = function (e) {
        e.target.result.forEach(function (c) { ec[c.id] = c; });
        tx.objectStore('reviewLog').getAll().onsuccess = function (e2) {
          el = e2.target.result;
          tx.objectStore('daily').getAll().onsuccess = function (e3) {
            e3.target.result.forEach(function (d) { ed[d.date] = d; });
            Backup.mergeCards(ec, data.cards).forEach(function (c) { tx.objectStore('cards').put(c); });
            Backup.mergeLog(el, data.reviewLog).forEach(function (r) { tx.objectStore('reviewLog').add(r); });
            Backup.mergeDaily(ed, data.daily).forEach(function (d) { tx.objectStore('daily').put(d); });
          };
        };
      };
    });
  };

  // Alles löschen: DB, Caches, Service Worker. Lehnt bei Blockade/Fehler ab und prüft danach, dass alles weg ist.
  DB.wipe = function () {
    var steps = [], nav = root.navigator;
    steps.push(new Promise(function (resolve, reject) {
      if (db) { db.close(); db = null; }
      if (!root.indexedDB) return resolve();
      var rq = root.indexedDB.deleteDatabase(NAME);
      rq.onsuccess = function () { resolve(); };
      rq.onerror = function () { reject(new Error('Datenbank konnte nicht gelöscht werden.')); };
      rq.onblocked = function () { reject(new Error('Löschen blockiert: Schließe andere Tabs oder Fenster dieser App und versuche es erneut.')); };
    }).then(function () {
      if (!root.indexedDB || typeof root.indexedDB.databases !== 'function') return;
      return root.indexedDB.databases().then(function (list) {
        if ((list || []).some(function (d) { return d.name === NAME; })) throw new Error('Datenbank ist nach dem Löschen noch vorhanden.');
      });
    }));
    if (root.caches && root.caches.keys) {
      steps.push(root.caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return root.caches.delete(k); })); })
        .then(function () { return root.caches.keys(); })
        .then(function (ks) { if (ks.length) throw new Error('Zwischenspeicher konnte nicht vollständig gelöscht werden.'); }));
    }
    if (nav && nav.serviceWorker && nav.serviceWorker.getRegistrations) {
      steps.push(nav.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })
        .then(function (res) { if (res.some(function (x) { return x === false; })) throw new Error('Service Worker konnte nicht entfernt werden.'); }));
    }
    return Promise.all(steps).then(function () {
      mem = { meta: {}, settings: {}, cards: {}, reviewLog: [], progress: {}, daily: {}, seq: 0 };
      DB.mode = 'memory';
    }, function (e) { throw e instanceof Error ? e : new Error('Löschen fehlgeschlagen.'); });
  };

  root.LF.DB = DB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
