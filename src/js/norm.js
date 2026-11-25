/* Norm: Normalisierung, Toleranzprüfung und Tokenisierung (rein, ohne DOM). */
(function (root) {
  'use strict';

  var PUNCT = /[¿¡.,;:!?"“”„«»()\[\]…]/g;

  // Kanonische Form: NFC, typografische Apostrophe -> ', Ligaturen aufgelöst,
  // Satzzeichen (inkl. Spanisch-Zeichen) und Bindestriche -> Leerzeichen, klein, getrimmt.
  function canon(s) {
    s = String(s == null ? '' : s).normalize('NFC');
    s = s.replace(/[‘’ʼ´`]/g, "'");
    s = s.replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE');
    s = s.replace(PUNCT, ' ').replace(/[‐-―-]/g, ' ');
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Akzente entfernen (NFD), ñ bleibt Buchstabe.
  function fold(s) {
    return String(s).replace(/ñ/g, '\u0001').normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(//g, 'ñ').normalize('NFC');
  }

  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  // Länge <=3: 0, <=7: 1, sonst 2 Tippfehler.
  function maxTypos(len) { return len <= 3 ? 0 : (len <= 7 ? 1 : 2); }

  // Ergebnis: 'exact' | 'accentOnly' | 'typo' | 'wrong'
  // strict:true = keine Tippfehler und keine Akzentabweichung.
  function check(input, item) {
    var cands = [item.tgt].concat(item.alt || []);
    var strict = !!item.strict;
    var ci = canon(input);
    if (!ci) return 'wrong';
    var fi = fold(ci), best = 'wrong';
    for (var k = 0; k < cands.length; k++) {
      var cc = canon(cands[k]);
      if (ci === cc) return 'exact';
      if (strict) continue;
      var fc = fold(cc);
      if (fi === fc) best = 'accentOnly';
      else if (best !== 'accentOnly' && lev(fi, fc) <= maxTypos(fc.length)) best = 'typo';
    }
    return best;
  }

  // Zielsatz in Wörter zerlegen (Rand-Satzzeichen weg, Apostrophe/Bindestriche bleiben).
  function tokenize(s) {
    return String(s).split(/\s+/).map(function (w) {
      return w.replace(/^[¿¡"“«(]+/, '').replace(/[.,;:!?"”»)…]+$/, '');
    }).filter(Boolean);
  }

  // Hinweis: erster Buchstabe je Wort, Rest als Unterstrich.
  function hintMask(tgt) {
    return tokenize(tgt).map(function (w) {
      var out = '', first = true;
      for (var i = 0; i < w.length; i++) {
        var ch = w.charAt(i);
        if (/[\p{L}\p{N}]/u.test(ch)) { out += first ? ch : '_'; first = false; } else out += ch;
      }
      return out;
    }).join(' ');
  }

  var api = { canon: canon, fold: fold, lev: lev, maxTypos: maxTypos, check: check, tokenize: tokenize, hintMask: hintMask };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LF.Norm = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
