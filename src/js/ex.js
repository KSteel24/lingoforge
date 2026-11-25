/* Ex: Übungen (tiles, cloze, choice, listen, shadow, typing). Jede ruft ctx.submit(result) genau einmal. */
(function (root) {
  'use strict';
  var LF = root.LF, Norm = LF.Norm, UI = LF.UI, h = UI.h, mount = UI.mount, shuffle = UI.shuffle, icon = UI.icon;

  var SPECIAL = {
    es: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'],
    fr: ['é', 'è', 'ê', 'à', 'â', 'ç', 'ô', 'î', 'û', 'ï', 'œ'],
    en: []
  };

  // n Distraktoren aus anderen Items (gleiche Einheit/Art bevorzugt), eindeutige Texte.
  function pickOthers(ctx, it, n, get) {
    var C = ctx.content, seen = {}, out = [];
    seen[Norm.canon(get(it))] = 1;
    var others = C.items.filter(function (i) { return i.id !== it.id; });
    var lists = [
      others.filter(function (i) { return i.unit === it.unit && i.kind === it.kind; }),
      others.filter(function (i) { return i.kind === it.kind; }),
      others
    ];
    lists.forEach(function (list) {
      shuffle(list, ctx.rng).forEach(function (i) {
        if (out.length >= n) return;
        var t = get(i), k = Norm.canon(t);
        if (seen[k]) return;
        seen[k] = 1; out.push(t);
      });
    });
    return out;
  }

  function speakBtn(ctx, text, label) {
    if (!ctx.hasVoice) return null;
    return h('button', { class: 'icon-btn', type: 'button', 'aria-label': label || 'Vorlesen',
      onclick: function () { ctx.speak(text, false); } }, icon('speaker'));
  }

  function optionList(ctx, options, correct, lang, label) {
    var locked = false, btns = [];
    var wrap = h('div', { class: 'opts', role: 'group', 'aria-label': label });
    options.forEach(function (text) {
      var b = h('button', { class: 'opt', type: 'button', lang: lang, onclick: function () {
        if (locked) return;
        locked = true;
        var ok = text === correct;
        b.classList.add(ok ? 'good' : 'bad');
        btns.forEach(function (x) { x.btn.disabled = true; if (x.text === correct) x.btn.classList.add('good'); });
        ctx.submit({ correct: ok, check: null, hint: false, answer: text });
      } }, text);
      btns.push({ btn: b, text: text });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function choice(step, ctx) {
    var it = ctx.item, rev = step.dir === 'tgt2de', lang = ctx.bcp;
    var get = rev ? function (i) { return i.de; } : function (i) { return i.tgt; };
    var correct = get(it);
    var opts = shuffle([correct].concat(pickOthers(ctx, it, 3, get)), ctx.rng);
    var prompt = rev
      ? h('div', { class: 'prompt' }, h('span', { class: 'big', lang: lang }, it.tgt), speakBtn(ctx, it.audio))
      : h('div', { class: 'prompt' }, h('span', { class: 'big' }, it.de));
    return { el: h('section', { class: 'ex' },
      h('p', { class: 'lead' }, rev ? 'Was bedeutet das?' : 'Wähle die richtige Übersetzung'),
      prompt, optionList(ctx, opts, correct, rev ? null : lang, 'Antworten')), focus: null };
  }

  function cloze(step, ctx) {
    var it = ctx.item, cl = it.cloze, lang = ctx.bcp, parts = cl.text.split('___');
    var blank = h('span', { class: 'blank', 'aria-label': 'Lücke' }, '___');
    var sentence = h('p', { class: 'big', lang: lang }, parts[0], blank, parts[1]);
    var wrapped = { submit: function (r) { blank.textContent = cl.answer; blank.classList.add(r.correct ? 'good' : 'bad'); ctx.submit(r); },
      content: ctx.content, rng: ctx.rng };
    var list = optionList(wrapped, shuffle(cl.options, ctx.rng), cl.answer, lang, 'Wörter zur Auswahl');
    return { el: h('section', { class: 'ex' }, h('p', { class: 'lead' }, 'Ergänze die Lücke'), sentence,
      h('p', { class: 'sub' }, it.de), speakBtn(ctx, it.audio), list), focus: null };
  }

  function tiles(step, ctx) {
    var it = ctx.item, lang = ctx.bcp, done = false, hint = false, hintId = -1;
    var pool = shuffle(it.tokens.concat(it.distractors.slice(0, 3)), ctx.rng).map(function (t, i) { return { t: t, id: i, used: false }; });
    var placed = [];
    var ans = h('div', { class: 'slots', role: 'group', 'aria-label': 'Deine Antwort', 'aria-live': 'polite' });
    var bank = h('div', { class: 'bank', role: 'group', 'aria-label': 'Wörter zur Auswahl' });
    var checkBtn = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: verify }, 'Prüfen');
    var hintBtn = h('button', { class: 'btn ghost', type: 'button', onclick: function () {
      if (done) return;
      hint = true;
      hintId = -1;
      for (var i = 0; i < placed.length; i++) if (placed[i].t !== it.tokens[i]) { hintId = placed[i].id; break; }
      if (hintId < 0) {
        var want = it.tokens[placed.length];
        pool.forEach(function (p) { if (hintId < 0 && !p.used && p.t === want) hintId = p.id; });
      }
      redraw();
    } }, 'Hinweis');

    function redraw() {
      mount(ans, placed.map(function (p) {
        return h('button', { class: 'tile placed' + (p.id === hintId ? ' hint' : ''), type: 'button', lang: lang,
          'aria-label': p.t + ', zurück in die Auswahl', onclick: function () {
            if (done) return;
            p.used = false; placed.splice(placed.indexOf(p), 1); hintId = -1; redraw();
          } }, p.t);
      }));
      mount(bank, pool.map(function (p) {
        if (p.used) return h('span', { class: 'tile ghost', 'aria-hidden': 'true' }, p.t);
        return h('button', { class: 'tile' + (p.id === hintId ? ' hint' : ''), type: 'button', lang: lang, onclick: function () {
          if (done) return;
          p.used = true; placed.push(p); hintId = -1; redraw();
        } }, p.t);
      }));
      checkBtn.disabled = done || placed.length === 0;
    }

    function verify() {
      if (done || !placed.length) return;
      done = true;
      var joined = placed.map(function (p) { return p.t; }).join(' ');
      var ok = Norm.check(joined, { tgt: it.tgt, alt: it.alt, strict: true }) === 'exact';
      checkBtn.disabled = true; hintBtn.disabled = true;
      ans.classList.add(ok ? 'good' : 'bad');
      ctx.submit({ correct: ok, check: ok ? 'exact' : 'wrong', hint: hint, answer: joined });
    }

    redraw();
    return { el: h('section', { class: 'ex' }, h('p', { class: 'lead' }, 'Übersetze'),
      h('div', { class: 'prompt' }, h('span', { class: 'big' }, it.de)), ans, bank,
      h('div', { class: 'row' }, hintBtn, checkBtn)), focus: null };
  }

  function typing(step, ctx, dictation) {
    var it = ctx.item, lang = ctx.bcp, done = false, hint = false;
    var input = h('input', { type: 'text', class: 'field', lang: lang, autocapitalize: 'off', autocorrect: 'off',
      autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Deine Antwort' });
    var hintLine = h('p', { class: 'sub hintline', 'aria-live': 'polite' });
    var shown = false;
    var checkBtn = h('button', { class: 'btn primary', type: 'button', onclick: verify }, 'Prüfen');
    var hintBtn = h('button', { class: 'btn ghost', type: 'button', onclick: function () {
      if (done) return;
      hint = true; hintLine.textContent = 'Hinweis: ' + Norm.hintMask(it.tgt);
    } }, 'Hinweis');
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') verify(); });

    function verify() {
      if (done) return;
      var val = input.value;
      if (!val.trim()) return;
      done = true;
      var check = Norm.check(val, it);
      input.disabled = true; checkBtn.disabled = true; hintBtn.disabled = true;
      ctx.submit({ correct: check !== 'wrong', check: check, hint: hint, answer: val });
    }

    var special = (SPECIAL[ctx.langCode] || []).map(function (ch) {
      return h('button', { class: 'key', type: 'button', 'aria-label': 'Zeichen ' + ch, onclick: function () {
        if (done) return;
        var v = input.value, s = typeof input.selectionStart === 'number' ? input.selectionStart : v.length;
        var e = typeof input.selectionEnd === 'number' ? input.selectionEnd : s;
        input.value = v.slice(0, s) + ch + v.slice(e);
        if (input.setSelectionRange) input.setSelectionRange(s + 1, s + 1);
        input.focus();
      } }, ch);
    });

    var head;
    if (dictation) {
      var reveal = h('button', { class: 'btn ghost', type: 'button', onclick: function () {
        if (done || shown) return;
        shown = true; hint = true; hintLine.textContent = 'Text: ' + it.tgt;
      } }, 'Text zeigen');
      head = [h('p', { class: 'lead' }, 'Hör zu und schreibe auf, was du hörst'),
        h('div', { class: 'row' }, h('button', { class: 'btn play', type: 'button', onclick: function () { ctx.speak(it.audio, false); } }, icon('speaker'), ' Anhören'),
          h('button', { class: 'btn ghost', type: 'button', onclick: function () { ctx.speak(it.audio, true); } }, 'Langsam'), reveal),
        h('p', { class: 'sub' }, 'Kein Ton? Prüfe Lautstärke und den Ton-an-Schalter.')];
    } else {
      head = [h('p', { class: 'lead' }, 'Schreibe auf ' + ctx.content.name), h('div', { class: 'prompt' }, h('span', { class: 'big' }, it.de))];
    }
    return { el: h('section', { class: 'ex' }, head, input, special.length ? h('div', { class: 'keys', role: 'group', 'aria-label': 'Sonderzeichen' }, special) : null,
      hintLine, h('div', { class: 'row' }, hintBtn, checkBtn)), focus: function () { input.focus(); } };
  }

  function listenChoice(step, ctx) {
    var it = ctx.item, lang = ctx.bcp, shown = false;
    var opts = shuffle([it.tgt].concat(pickOthers(ctx, it, 3, function (i) { return i.tgt; })), ctx.rng);
    var textLine = h('p', { class: 'sub', 'aria-live': 'polite' });
    var wrapped = { submit: function (r) { r.hint = shown; ctx.submit(r); }, content: ctx.content, rng: ctx.rng };
    return { el: h('section', { class: 'ex' }, h('p', { class: 'lead' }, 'Hör zu und wähle, was du hörst'),
      h('div', { class: 'row' }, h('button', { class: 'btn play', type: 'button', onclick: function () { ctx.speak(it.audio, false); } }, icon('speaker'), ' Anhören'),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { ctx.speak(it.audio, true); } }, 'Langsam'),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { shown = true; textLine.textContent = 'Übersetzung: ' + it.de; } }, 'Übersetzung zeigen')),
      textLine, h('p', { class: 'sub' }, 'Kein Ton? Prüfe Lautstärke und den Ton-an-Schalter.'),
      optionList(wrapped, opts, it.tgt, lang, 'Antworten')), focus: null };
  }

  function shadow(step, ctx) {
    var it = ctx.item, lang = ctx.bcp, done = false;
    function rate(r) {
      return h('button', { class: 'btn ' + (r === 3 ? 'primary' : 'ghost'), type: 'button', onclick: function () {
        if (done) return;
        done = true;
        ctx.submit({ correct: r > 1, check: null, hint: false, selfRating: r, answer: '' });
      } }, r === 1 ? 'Nochmal üben' : (r === 2 ? 'Fast richtig' : 'Gut gesprochen'));
    }
    return { el: h('section', { class: 'ex' }, h('p', { class: 'lead' }, 'Nachsprechen'),
      h('div', { class: 'prompt' }, h('span', { class: 'big', lang: lang }, it.tgt)), h('p', { class: 'sub' }, it.de),
      h('div', { class: 'row' }, h('button', { class: 'btn play', type: 'button', onclick: function () { ctx.speak(it.audio, false); } }, icon('speaker'), ' Anhören'),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { ctx.speak(it.audio, true); } }, 'Langsam')),
      h('p', { class: 'sub' }, 'Sprich den Satz laut nach und bewerte dich selbst. Es wird nichts aufgezeichnet und es gibt keine Spracherkennung.'),
      h('div', { class: 'row wrap' }, rate(1), rate(2), rate(3))), focus: null };
  }

  function render(step, ctx) {
    switch (step.ex) {
      case 'choice': return choice(step, ctx);
      case 'cloze': return cloze(step, ctx);
      case 'tiles': return tiles(step, ctx);
      case 'typing': return typing(step, ctx, false);
      case 'dictation': return typing(step, ctx, true);
      case 'listenChoice': return listenChoice(step, ctx);
      case 'shadow': return shadow(step, ctx);
      default: throw new Error('Unbekannte Übung: ' + step.ex);
    }
  }

  LF.Ex = { render: render, pickOthers: pickOthers, SPECIAL: SPECIAL };
})(typeof globalThis !== 'undefined' ? globalThis : this);
