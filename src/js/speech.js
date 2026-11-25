/* Speech: speechSynthesis mit Voice-Discovery, iOS-Härtung und Diagnose. Keine Spracherkennung
   (iOS sendet dabei Audio an Apple). speak() muss synchron aus einer Nutzergeste aufgerufen werden. */
(function (root) {
  'use strict';

  var supported = typeof root.speechSynthesis !== 'undefined' && typeof root.SpeechSynthesisUtterance !== 'undefined';
  var Speech = { supported: supported, voices: [], listeners: [], failed: false, unlocked: false, current: null,
    last: { voice: '', lang: '', text: '', events: [], after: '', after300: '' }, onProblem: null, onEvent: null };

  function load() {
    var vs = [];
    try { vs = root.speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
    if (vs.length !== Speech.voices.length) {
      Speech.voices = Array.prototype.slice.call(vs);
      Speech.listeners.forEach(function (f) { try { f(); } catch (e) { /* Listener-Fehler ignorieren */ } });
    }
  }

  // Polling 10 x 250 ms plus voiceschanged.
  Speech.init = function () {
    if (!supported) return;
    load();
    try { root.speechSynthesis.onvoiceschanged = load; } catch (e) { /* nicht unterstützt */ }
    var n = 0, t = setInterval(function () {
      load(); n++;
      if (n >= 10) clearInterval(t);
    }, 250);
  };

  // es_ES -> es-ES
  function norm(l) { return String(l || '').replace(/_/g, '-'); }
  function prefix(l) { return norm(l).toLowerCase(); }

  Speech.voicesFor = function (lang) {
    return Speech.voices.filter(function (v) { return prefix(v.lang).indexOf(lang) === 0; });
  };

  function score(v) {
    var s = 0, n = (v.name || '') + ' ' + (v.voiceURI || '');
    if (/premium|enhanced|erweitert|verbessert/i.test(n)) s += 4;
    if (/siri/i.test(n)) s += 2;
    if (v.localService) s += 1;
    return s;
  }

  Speech.best = function (lang, uri, tts) {
    var list = Speech.voicesFor(lang);
    if (!list.length) return null;
    if (uri) { for (var i = 0; i < list.length; i++) if (list[i].voiceURI === uri) return list[i]; }
    var want = prefix(tts);
    return list.slice().sort(function (a, b) {
      var sa = score(a) + (prefix(a.lang) === want ? 3 : 0), sb = score(b) + (prefix(b.lang) === want ? 3 : 0);
      return sb - sa;
    })[0];
  };

  // Sprechen wird immer versucht (auch ohne gelistete Stimme: Systemstandard der Sprache).
  Speech.usable = function () { return supported && !Speech.failed; };

  function ev(name, extra) {
    Speech.last.events.push(name + (extra ? ' (' + extra + ')' : ''));
    if (typeof Speech.onEvent === 'function') { try { Speech.onEvent(); } catch (e) { /* UI isoliert */ } }
  }

  function problem(msg) {
    Speech.failed = true;
    if (typeof Speech.onProblem === 'function') { try { Speech.onProblem(msg); } catch (e) { /* UI isoliert */ } }
  }

  function flags(ss) { return 'speaking=' + !!ss.speaking + ', pending=' + !!ss.pending; }

  var HINT = 'Prüfe: Stumm-Schalter an der Seite des iPhones (iOS dämpft die Sprachausgabe, wenn er aktiv ist), Lautstärke und ob für diese Sprache eine Stimme geladen ist (Einstellungen > Bedienungshilfen > Gesprochene Inhalte > Stimmen).';
  Speech.HINT = HINT;

  // Erste Geste: stumme Äußerung "entsperrt" die Sprachausgabe auf iOS.
  Speech.unlock = function () {
    if (!supported || Speech.unlocked) return;
    Speech.unlocked = true;
    try {
      var u = new root.SpeechSynthesisUtterance(' ');
      u.volume = 0;
      root.speechSynthesis.speak(u);
    } catch (e) { /* ignorieren */ }
  };

  // o: {voiceURI, rate, slow, tts}. Liefert true, wenn eine Äußerung abgesetzt wurde.
  Speech.speak = function (text, lang, o) {
    o = o || {};
    if (!supported) return false;
    var ss = root.speechSynthesis, v = Speech.best(lang, o.voiceURI, o.tts), u;
    try {
      u = new root.SpeechSynthesisUtterance(text);
      if (v) u.voice = v;
      u.lang = norm(v ? v.lang : (o.tts || lang));
      u.rate = Math.max(0.3, Math.min(1.5, (o.rate || 0.9) * (o.slow ? 0.6 : 1)));
      u.pitch = 1; u.volume = 1;
    } catch (e) { problem('Sprachausgabe nicht nutzbar.'); return false; }
    var state = { started: false, ended: false };
    Speech.current = u;
    Speech.last = { voice: v ? v.name + ' (' + v.lang + ')' : 'Systemstandard', lang: u.lang, text: text, events: [], after: '', after300: '' };
    u.onstart = function () { state.started = true; Speech.failed = false; ev('start'); };
    u.onend = function () { state.ended = true; Speech.failed = false; ev('end'); };
    u.onerror = function (e) {
      var code = e && e.error ? String(e.error) : 'unbekannt';
      if (code === 'canceled' || code === 'interrupted') { ev('abgebrochen'); return; }
      ev('error', code);
      problem('Sprachausgabe-Fehler (' + code + '). ' + HINT);
    };
    function go() {
      try { ss.resume(); ss.speak(u); } catch (e) { problem('Sprachausgabe nicht nutzbar. ' + HINT); }
      Speech.last.after = flags(ss);
      setTimeout(function () { if (Speech.current === u) { Speech.last.after300 = flags(ss); ev('Status nach 300 ms'); } }, 300);
    }
    // cancel() nur bei laufender/wartender Ausgabe (direkt vor speak() verschluckt iOS sonst die Äußerung).
    if (ss.speaking || ss.pending) {
      try { ss.cancel(); } catch (e) { /* ignorieren */ }
      setTimeout(go, 60);
    } else go();
    setTimeout(function () {
      if (Speech.current === u && !state.started && !state.ended) {
        ev('keine Rückmeldung');
        problem('Es war keine Sprachausgabe zu hören. ' + HINT);
      }
    }, 1500);
    return true;
  };

  Speech.cancel = function () {
    if (!supported) return;
    try { if (root.speechSynthesis.speaking || root.speechSynthesis.pending) root.speechSynthesis.cancel(); } catch (e) { /* ignorieren */ }
  };

  Speech.diag = function (lang) {
    var raw = 0, first = [];
    if (supported) { try { var all = root.speechSynthesis.getVoices() || []; raw = all.length; first = Array.prototype.slice.call(all, 0, 5).map(function (v) { return v.name + ' [' + v.lang + ', ' + (v.localService ? 'lokal' : 'online') + ']'; }); } catch (e) { /* ignorieren */ } }
    return { supported: supported, total: raw, forLang: Speech.voicesFor(lang).length, first: first,
      voice: Speech.last.voice, lang: Speech.last.lang, after: Speech.last.after, after300: Speech.last.after300, events: Speech.last.events.slice() };
  };

  root.LF.Speech = Speech;
})(typeof globalThis !== 'undefined' ? globalThis : this);
