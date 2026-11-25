/* ContentLib: baut Items aus kompakten Zeilen und validiert Inhalte (rein). */
(function (root) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Norm = isNode ? require('./norm.js') : root.LF.Norm;

  var LANGS = { en: { name: 'Englisch', tts: 'en-GB' }, es: { name: 'Spanisch', tts: 'es-ES' },
    fr: { name: 'Französisch', tts: 'fr-FR' } };

  // Zentrale Schalter: aktive Lernsprachen. Reaktivierung: 'en','fr' ergänzen (Quelldateien bleiben erhalten,
  // build.mjs bindet die content-Dateien dieser Liste ein).
  var ENABLED_LANGS = ['es'];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function makeCloze(tgt, ci, dis) {
    var chunks = tgt.split(/\s+/), chunk = chunks[ci];
    if (chunk === undefined) throw new Error('Cloze-Index außerhalb: ' + tgt);
    var m = /^([¿¡"“«(]*)(.*?)([.,;:!?"”»)…]*)$/.exec(chunk);
    var text = chunks.map(function (c, i) { return i === ci ? m[1] + '___' + m[3] : c; }).join(' ');
    return { text: text, answer: m[2], options: [m[2]].concat(dis.slice(0, 2)) };
  }

  // Zeile: [tgt, de, distraktoren('a b'), clozeIndex, {alt:[], strict:true, audio:''}]
  function build(lang, units) {
    var out = { lang: lang, name: LANGS[lang].name, tts: LANGS[lang].tts, units: [], items: [], byId: {} };
    units.forEach(function (u, ui) {
      var unit = { id: ui + 1, title: u.title, items: [] };
      u.rows.forEach(function (r, ri) {
        var tgt = r[0], dis = r[2] ? r[2].split(' ') : [], ci = r[3] === undefined ? -1 : r[3], ex = r[4] || {};
        var tokens = Norm.tokenize(tgt);
        var item = { id: lang + '.u' + (ui + 1) + '.i' + pad2(ri + 1), unit: ui + 1,
          kind: tokens.length === 1 ? 'word' : 'sentence', tgt: tgt, de: r[1], alt: ex.alt || [],
          tokens: tokens, distractors: dis, cloze: ci >= 0 ? makeCloze(tgt, ci, dis) : null,
          strict: !!ex.strict, audio: ex.audio || tgt };
        unit.items.push(item); out.items.push(item); out.byId[item.id] = item;
      });
      out.units.push(unit);
    });
    return out;
  }

  // Liefert Liste von Fehlermeldungen (leer = gültig).
  function validate(c) {
    var errs = [], seen = {};
    function bad(it, msg) { errs.push((it.id || '?') + ': ' + msg); }
    if (c.units.length !== 6) errs.push(c.lang + ': erwartet 6 Einheiten, gefunden ' + c.units.length);
    c.units.forEach(function (u) {
      if (!u.title) errs.push(c.lang + ' Einheit ' + u.id + ': Titel fehlt');
      if (u.items.length < 10 || u.items.length > 14) errs.push(c.lang + ' Einheit ' + u.id + ': ' + u.items.length + ' Items');
    });
    c.items.forEach(function (it) {
      if (seen[it.id]) bad(it, 'doppelte ID'); seen[it.id] = 1;
      if (!/^[a-z]{2}\.u\d+\.i\d{2}$/.test(it.id)) bad(it, 'ID-Format');
      ['tgt', 'de', 'audio'].forEach(function (f) { if (typeof it[f] !== 'string' || !it[f].trim()) bad(it, 'Feld ' + f + ' fehlt'); });
      if (['word', 'sentence'].indexOf(it.kind) < 0) bad(it, 'kind');
      if (!Array.isArray(it.alt) || !Array.isArray(it.tokens) || !Array.isArray(it.distractors)) { bad(it, 'Arrays fehlen'); return; }
      if (typeof it.strict !== 'boolean') bad(it, 'strict');
      if (Norm.canon(it.tokens.join(' ')) !== Norm.canon(it.tgt)) bad(it, 'tokens passen nicht zu tgt');
      if (it.tokens.length !== it.tgt.split(/\s+/).length) bad(it, 'Tokenzahl weicht von Wortzahl ab');
      if (it.tgt.indexOf('’') >= 0) bad(it, 'typografischer Apostroph in tgt');
      var tokCanon = it.tokens.map(Norm.canon);
      it.distractors.forEach(function (d) {
        if (tokCanon.indexOf(Norm.canon(d)) >= 0) bad(it, 'Distraktor "' + d + '" steckt im Satz');
      });
      if (new Set(it.distractors.map(Norm.canon)).size !== it.distractors.length) bad(it, 'doppelte Distraktoren');
      it.alt.forEach(function (a) { if (Norm.canon(a) === Norm.canon(it.tgt)) bad(it, 'alt gleicht tgt'); });
      if (it.tokens.length >= 3 && (it.distractors.length < 2 || !it.cloze)) bad(it, 'Satz braucht >=2 Distraktoren und Cloze');
      if (it.cloze) {
        var cl = it.cloze;
        if (it.distractors.length < 2) bad(it, 'Cloze braucht >=2 Distraktoren');
        if (cl.text.split('___').length !== 2) bad(it, 'Cloze: genau eine Lücke');
        if (cl.options.indexOf(cl.answer) < 0) bad(it, 'Cloze-Antwort fehlt in Optionen');
        if (new Set(cl.options.map(Norm.canon)).size !== cl.options.length || cl.options.length !== 3) bad(it, 'Cloze-Optionen');
        if (Norm.canon(cl.text.replace('___', cl.answer)) !== Norm.canon(it.tgt)) bad(it, 'Cloze ergibt nicht den Zielsatz');
      }
    });
    return errs;
  }

  var api = { ENABLED_LANGS: ENABLED_LANGS, LANGS: LANGS, build: build, validate: validate, makeCloze: makeCloze };
  if (isNode) module.exports = api; else root.LF.Lib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
