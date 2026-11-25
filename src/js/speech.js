/* Speech: speechSynthesis mit Voice-Discovery. Keine Spracherkennung (iOS sendet Audio an Apple). */
(function (root) {
  'use strict';

  var supported = typeof root.speechSynthesis !== 'undefined' && typeof root.SpeechSynthesisUtterance !== 'undefined';
  var Speech = { supported: supported, voices: [], listeners: [] };

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

  function prefix(l) { return String(l || '').replace('_', '-').toLowerCase(); }

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

  Speech.has = function (lang) { return supported && Speech.voicesFor(lang).length > 0; };

  // Nur aus einer Nutzergeste aufrufen. o: {voiceURI, rate, slow, tts}
  Speech.speak = function (text, lang, o) {
    o = o || {};
    if (!supported) return false;
    var v = Speech.best(lang, o.voiceURI, o.tts);
    if (!v) return false;
    try {
      root.speechSynthesis.cancel();
      var u = new root.SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang;
      u.rate = Math.max(0.3, Math.min(1.5, (o.rate || 0.9) * (o.slow ? 0.6 : 1)));
      root.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  };

  Speech.cancel = function () { if (supported) { try { root.speechSynthesis.cancel(); } catch (e) { /* ignorieren */ } } };

  root.LF.Speech = Speech;
})(typeof globalThis !== 'undefined' ? globalThis : this);
