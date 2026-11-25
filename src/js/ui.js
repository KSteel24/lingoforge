/* UI: DOM nur über h(tag, attrs, ...children) mit Attribut-Whitelist, Textknoten, nie HTML-Strings. */
(function (root) {
  'use strict';

  var SV = 'http:' + '//www.w3.org/2000/svg';
  function set(s) { return new Set(s.split(' ')); }
  var TAGS = set('div span p h1 h2 h3 button input select option label ul li a nav main header section footer strong em small textarea output');
  var SVGTAGS = set('svg g rect circle line path text title');
  var ATTRS = set('class id type role title lang value min max step disabled checked selected placeholder for name autocomplete autocapitalize autocorrect spellcheck inputmode tabindex href accept hidden maxlength enterkeyhint');
  var SVGATTRS = set('class role viewBox width height x y x1 y1 x2 y2 cx cy r rx d fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset transform text-anchor font-size fill-opacity focusable preserveAspectRatio');
  var BOOL = set('disabled checked selected hidden');
  var STYLEOK = set('width height --p transform');

  function add(el, c) {
    if (c == null || c === false || c === true) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    if (typeof c === 'object' && c.nodeType) { el.appendChild(c); return; }
    el.appendChild(document.createTextNode(String(c)));
  }

  function h(tag, attrs) {
    var svg = SVGTAGS.has(tag);
    if (!svg && !TAGS.has(tag)) throw new Error('Tag nicht erlaubt: ' + tag);
    var el = svg ? document.createElementNS(SV, tag) : document.createElement(tag);
    var late = null, hasLate = false, k;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (k === 'style') {
          for (var sk in v) {
            if (!STYLEOK.has(sk)) throw new Error('Style nicht erlaubt: ' + sk);
            el.style.setProperty(sk, String(v[sk]));
          }
        } else if (k.indexOf('on') === 0) {
          if (typeof v !== 'function') throw new Error('Handler muss Funktion sein: ' + k);
          el.addEventListener(k.slice(2), v);
        } else if (/^aria-[a-z]+$/.test(k)) {
          el.setAttribute(k, String(v));
        } else if (!(svg ? SVGATTRS : ATTRS).has(k)) {
          throw new Error('Attribut nicht erlaubt: ' + k);
        } else if (v == null || (v === false && BOOL.has(k))) {
          continue;
        } else if (k === 'href') {
          if (typeof v !== 'string' || v.charAt(0) !== '#') throw new Error('href nur als Hash erlaubt');
          el.setAttribute(k, v);
        } else if (k === 'value') {
          late = String(v); hasLate = true;
        } else if (BOOL.has(k)) {
          if (v) el.setAttribute(k, '');
          if (k === 'checked') el.checked = !!v;
        } else {
          el.setAttribute(k, String(v));
        }
      }
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    if (hasLate) { el.value = late; el.setAttribute('value', late); }
    return el;
  }

  function mount(host) {
    var kids = [];
    for (var i = 1; i < arguments.length; i++) kids.push(arguments[i]);
    var flat = [];
    (function f(a) { a.forEach(function (x) { if (Array.isArray(x)) f(x); else if (x != null && x !== false) flat.push(x); }); })(kids);
    host.replaceChildren.apply(host, flat);
  }

  function shuffle(a, rng) {
    var r = a.slice(), i, j, t;
    rng = rng || Math.random;
    for (i = r.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  }

  var ICONS = {
    speaker: ['M4 9v6h4l5 4V5L8 9H4z', 'M16.5 8.5a5 5 0 0 1 0 7', 'M19 6a9 9 0 0 1 0 12'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    home: ['M4 11l8-7 8 7', 'M6 10v9h12v-9'],
    chart: ['M5 20V10', 'M12 20V4', 'M19 20v-7'],
    gear: ['M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1'],
    flame: ['M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z'],
    lock: ['M7 11h10v9H7z', 'M9 11V8a3 3 0 0 1 6 0v3']
  };

  function icon(name, label) {
    var attrs = { viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', focusable: 'false' };
    if (label) { attrs.role = 'img'; attrs['aria-label'] = label; } else attrs['aria-hidden'] = 'true';
    return h.apply(null, ['svg', attrs].concat(ICONS[name].map(function (d) { return h('path', { d: d }); })));
  }

  root.LF.UI = { h: h, mount: mount, shuffle: shuffle, icon: icon };
})(typeof globalThis !== 'undefined' ? globalThis : this);
