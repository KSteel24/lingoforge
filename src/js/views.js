/* Views: Home, Session, Statistik, Einstellungen (Hash-Router). Nur h()/textContent. */
(function (root) {
  'use strict';
  var LF = root.LF, App = LF.App, Game = LF.Game, Sched = LF.Sched, Backup = LF.Backup, Speech = LF.Speech;
  var DB = LF.DB, UI = LF.UI, Ex = LF.Ex, h = UI.h, mount = UI.mount, icon = UI.icon;
  var Views = { flash: '', voiceDismissed: false };
  var LANG_NAMES = { en: 'Englisch', es: 'Spanisch', fr: 'Französisch' };
  var LANG_OPTS = LF.Lib.ENABLED_LANGS.map(function (l) { return { v: l, t: LANG_NAMES[l] }; });

  function go(hash) { if (root.location.hash === hash) Views.render(); else root.location.hash = hash; }
  Views.go = go;

  function seg(label, options, current, onPick) {
    var wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    options.forEach(function (o) {
      wrap.appendChild(h('button', { type: 'button', class: o.v === current ? 'on' : '', 'aria-pressed': o.v === current ? 'true' : 'false',
        onclick: function () { onPick(o.v); } }, o.t));
    });
    return wrap;
  }

  function note(text, cls) { return h('p', { class: 'note ' + (cls || ''), role: 'status' }, text); }

  // ---------- Banner ----------
  Views.renderBanners = function () {
    var host = root.document.getElementById('banners');
    if (!host) return;
    var items = [], s = App.S.settings, lang = s.lang, route = (root.location.hash || '#/home');
    if (App.dbError) items.push(h('div', { class: 'banner bad', role: 'alert' }, h('strong', null, 'Problem: '), App.dbError));
    if (App.updateWorker) {
      items.push(h('div', { class: 'banner info', role: 'status' }, h('span', null, 'Neue Version verfügbar.'),
        h('button', { class: 'btn small', type: 'button', onclick: function () { App.emit('applyUpdate'); } }, 'Jetzt aktualisieren')));
    }
    if (route.indexOf('#/session') !== 0 && !Views.voiceDismissed && !App.hasVoice(lang) && App.S.settings) {
      items.push(h('div', { class: 'banner warn', role: 'status' },
        h('p', null, Speech.supported
          ? 'Keine ' + LANG_NAMES[lang] + '-Stimme gefunden. Hör- und Nachsprech-Übungen werden durch Lese- und Tippübungen ersetzt.'
          : 'Dieser Browser hat keine Sprachausgabe. Hör- und Nachsprech-Übungen werden durch Lese- und Tippübungen ersetzt.'),
        Speech.supported ? h('p', { class: 'sub' }, 'Bessere Stimmen laden: iPhone-Einstellungen > Bedienungshilfen > Gesprochene Inhalte > Stimmen > ' + LANG_NAMES[lang] + ' > Stimme mit "Erweitert" oder "Premium" laden. Danach die App neu öffnen.') : null,
        h('button', { class: 'btn small ghost', type: 'button', onclick: function () { Views.voiceDismissed = true; Views.renderBanners(); } }, 'Ausblenden')));
    }
    if (route.indexOf('#/home') === 0 || route === '' || route === '#') {
      if (Game.backupDue(App.S.meta, Date.now())) {
        items.push(h('div', { class: 'banner info', role: 'status' }, h('span', null, 'Backup fällig: Sichere deinen Fortschritt als Datei.'),
          h('button', { class: 'btn small', type: 'button', onclick: function () { go('#/settings'); } }, 'Zu den Einstellungen')));
      }
    }
    mount(host, items);
  };

  // ---------- Home ----------
  function ring(xp, goal) {
    var R = 52, C = 2 * Math.PI * R, frac = Math.min(1, xp / goal);
    return h('svg', { class: 'ring', viewBox: '0 0 120 120', width: 120, height: 120, role: 'img',
      'aria-label': 'Tagesziel: ' + xp + ' von ' + goal + ' XP' },
      h('circle', { class: 'ring-bg', cx: 60, cy: 60, r: R, fill: 'none', 'stroke-width': 10 }),
      h('circle', { class: 'ring-fg', cx: 60, cy: 60, r: R, fill: 'none', 'stroke-width': 10, 'stroke-linecap': 'round',
        'stroke-dasharray': C.toFixed(2), 'stroke-dashoffset': (C * (1 - frac)).toFixed(2), transform: 'rotate(-90 60 60)' }),
      h('text', { x: 60, y: 58, 'text-anchor': 'middle', class: 'ring-num', 'font-size': 24 }, String(xp)),
      h('text', { x: 60, y: 78, 'text-anchor': 'middle', class: 'ring-sub', 'font-size': 12 }, 'von ' + goal + ' XP'));
  }

  function stat(iconName, value, label) {
    return h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, iconName ? icon(iconName) : null, h('span', null, String(value))), h('div', { class: 'stat-l' }, label));
  }

  function homeView(host) {
    var s = App.S.settings, lang = s.lang, C = App.content(lang), cards = App.cardsFor(lang), now = Date.now();
    var d = App.S.daily[App.today()], xp = d ? d.xp : 0, st = App.streak();
    var due = Sched.dueCount(cards, now), open = Game.unlocked(C, cards, s.unlockAll);
    var units = C.units.map(function (u, i) {
      var us = Game.unitStats(u, cards), pct = Math.round(us.ratio * 100);
      var prev = i > 0 ? Math.round(Game.unitStats(C.units[i - 1], cards).ratio * 100) : 0;
      var label = 'Einheit ' + u.id + ': ' + u.title + '. ' + us.introduced + ' von ' + us.total + ' gelernt, ' + us.mastered + ' gemeistert.' + (open[i] ? '' : ' Gesperrt.');
      return h('button', { type: 'button', class: 'unit' + (open[i] ? '' : ' locked'), disabled: !open[i], 'aria-label': label,
        onclick: function () { Views.startSession({ onlyUnit: u.id }); } },
        h('span', { class: 'unit-n' }, open[i] ? String(u.id) : icon('lock')),
        h('span', { class: 'unit-b' },
          h('span', { class: 'unit-t' }, u.title),
          h('span', { class: 'pbar', 'aria-hidden': 'true' }, h('span', { class: 'fill', style: { width: pct + '%' } })),
          h('span', { class: 'unit-s' }, open[i] ? us.introduced + '/' + us.total + ' gelernt, ' + us.mastered + ' gemeistert'
            : 'Gesperrt: Meistere Einheit ' + (u.id - 1) + ' zu 60 % (aktuell ' + prev + ' %)')));
    });
    mount(host,
      h('header', { class: 'top' }, h('h1', null, 'LingoForge'),
        LANG_OPTS.length > 1 ? seg('Lernsprache', LANG_OPTS.map(function (o) { return { v: o.v, t: o.v.toUpperCase() }; }), lang, function (v) {
          s.lang = v; App.saveSettings(); Views.render();
        }) : null),
      Views.flash ? note(Views.flash) : null,
      h('section', { class: 'card hero' }, ring(xp, s.goal),
        h('div', { class: 'stats' },
          stat('flame', st.current, st.current === 1 ? 'Tag Serie' : 'Tage Serie'),
          stat(null, App.totalXp(), 'XP gesamt'),
          stat(null, due, 'fällig'))),
      h('button', { class: 'btn primary big', type: 'button', onclick: function () { Views.startSession({}); } }, 'Üben'),
      h('h2', null, 'Pfad ' + LANG_NAMES[lang]),
      h('div', { class: 'path' }, units));
    Views.flash = '';
  }

  // ---------- Session ----------
  Views.startSession = function (opts) {
    var s = App.S.settings, lang = s.lang, C = App.content(lang);
    var res = Sched.buildSession({ content: C, cards: App.cardsFor(lang), settings: s, newToday: App.newToday(),
      now: Date.now(), rng: Math.random, hasVoice: App.hasVoice(lang), size: 15, onlyUnit: opts && opts.onlyUnit });
    if (!res.steps.length) {
      Views.flash = 'Gerade ist nichts zu üben. Tippe eine Einheit an oder erhöhe die neuen Items pro Tag in den Einstellungen.';
      Views.render();
      return;
    }
    App.session = { lang: lang, steps: res.steps, i: 0, xp: 0, run: 0, right: 0, wrong: 0, newItems: 0, startedAt: Date.now(), done: false };
    go('#/session');
  };

  function sessionView(host) {
    var S = App.session;
    if (!S) { go('#/home'); return; }
    var lang = S.lang, C = App.content(lang), s = App.S.settings;
    var bar = h('span', { class: 'fill' });
    var stage = h('div', { class: 'stage' });
    mount(host,
      h('header', { class: 'sess-head' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sitzung beenden', onclick: function () { Speech.cancel(); App.session = null; go('#/home'); } }, icon('close')),
        h('div', { class: 'pbar grow', role: 'progressbar', 'aria-label': 'Fortschritt', 'aria-valuemin': 0, 'aria-valuemax': 100 }, bar)),
      stage);

    function progress() {
      var pct = Math.min(100, Math.round(100 * S.i / S.steps.length));
      bar.style.width = pct + '%';
      bar.parentNode.setAttribute('aria-valuenow', String(pct));
    }
    function next() { S.i++; root.scrollTo(0, 0); show(); }

    function show() {
      if (S.i >= S.steps.length) { finish(); return; }
      progress();
      var st = S.steps[S.i], item = C.byId[st.id];
      if (st.type === 'intro') showIntro(st, item); else showEx(st, item);
    }

    function showIntro(st, item) {
      var sp = App.hasVoice(lang) ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Vorlesen', onclick: function () { App.speak(item.audio, lang, false); } }, icon('speaker')) : null;
      var go1 = h('button', { class: 'btn primary big', type: 'button', onclick: function () { App.introduce(lang, item); next(); } }, 'Verstanden');
      mount(stage, h('section', { class: 'ex intro' }, h('p', { class: 'lead' }, 'Neu: Lerne ' + (item.kind === 'word' ? 'diesen Ausdruck' : 'diesen Satz')),
        h('div', { class: 'prompt' }, h('span', { class: 'big', lang: C.tts }, item.tgt), sp),
        h('p', { class: 'sub big2' }, item.de), go1));
      go1.focus();
    }

    function showEx(st, item) {
      var t0 = Date.now(), submitted = false;
      var fb = h('div', { class: 'feedback', hidden: true, 'aria-live': 'polite' });
      var ctx = { item: item, content: C, langCode: lang, bcp: C.tts, rng: Math.random, hasVoice: App.hasVoice(lang),
        speak: function (text, slow) { return App.speak(text, lang, slow); }, card: App.S.cards[item.id],
        submit: function (res) { if (submitted) return; submitted = true; onAnswer(st, item, res, Date.now() - t0, fb); } };
      var ex = Ex.render(st, ctx);
      mount(stage, ex.el, fb);
      if (ex.focus) ex.focus();
    }

    function onAnswer(st, item, res, ms, fb) {
      var scored = !st.retry, rating = 0, rec = null, gained = 0;
      if (scored) {
        rating = Game.rating({ ex: st.ex, item: item, correct: res.correct, check: res.check, hint: res.hint, ms: ms, selfRating: res.selfRating });
        rec = App.recordAnswer(lang, item, rating, { ex: st.ex, ms: ms, hint: res.hint, correct: res.correct });
        S.run = res.correct ? S.run + 1 : 0;
        if (res.correct) S.right++; else S.wrong++;
        if (rec.wasNew) S.newItems++;
        gained = Game.xpForAnswer(res.correct, S.run);
        if (gained) { S.xp += gained; App.addXp(gained, lang); }
      }
      if (!res.correct && (st.tries || 0) < 2) Sched.insertRetry(S.steps, S.i, item, { rng: Math.random, hasVoice: App.hasVoice(lang), tries: st.tries || 0 });
      showFeedback(st, item, res, rec, rating, gained, fb);
    }

    function showFeedback(st, item, res, rec, rating, gained, fb) {
      var near = res.correct && (res.check === 'typo' || res.check === 'accentOnly');
      var title = !res.correct ? 'Nicht ganz' : (near ? 'Fast richtig' : 'Richtig!');
      var last = S.i + 1 >= S.steps.length;
      var easy = null;
      if (rec && res.correct && rating === 3) {
        easy = h('button', { class: 'btn ghost', type: 'button', onclick: function () {
          App.upgradeEasy(rec); easy.disabled = true; easy.textContent = 'Als leicht gemerkt';
        } }, 'Das war leicht');
      }
      var sp = App.hasVoice(lang) ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Vorlesen', onclick: function () { App.speak(item.audio, lang, false); } }, icon('speaker')) : null;
      var nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: next }, last ? 'Fertig' : 'Weiter');
      fb.classList.add(res.correct ? 'ok' : 'bad');
      mount(fb, h('p', { class: 'fb-t' }, title, gained ? h('span', { class: 'xp' }, ' +' + gained + ' XP') : null),
        !res.correct || near ? h('p', { class: 'fb-a' }, 'Richtig: ', h('strong', { lang: C.tts }, item.tgt)) : null,
        h('p', { class: 'sub' }, item.tgt + ' = ' + item.de), st.retry ? h('p', { class: 'sub' }, 'Wiederholung ohne Wertung.') : null,
        h('div', { class: 'row' }, sp, easy, nextBtn));
      fb.hidden = false; fb.removeAttribute('hidden');
      nextBtn.focus();
    }

    function finish() {
      S.done = true; progress();
      var bonus = Game.SESSION_BONUS;
      S.xp += bonus; App.addXp(bonus, lang); App.sessionDone();
      var total = S.right + S.wrong, acc = total ? Math.round(100 * S.right / total) : 100;
      var d = App.S.daily[App.today()], st = App.streak();
      mount(stage, h('section', { class: 'ex summary' }, h('h2', null, 'Geschafft!'),
        h('div', { class: 'stats' }, stat(null, '+' + S.xp, 'XP'), stat(null, acc + ' %', 'richtig'), stat(null, S.newItems, 'neu gelernt')),
        h('p', { class: 'sub' }, S.right + ' richtig, ' + S.wrong + ' falsch. Sitzungsbonus: +' + bonus + ' XP.'),
        h('p', { class: 'sub' }, d && d.goalMet ? 'Tagesziel erreicht. Serie: ' + st.current + ' ' + (st.current === 1 ? 'Tag' : 'Tage') + '.' : 'Tagesziel: ' + (d ? d.xp : 0) + ' von ' + s.goal + ' XP.'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn ghost', type: 'button', onclick: function () { App.session = null; go('#/home'); } }, 'Zur Startseite'),
          h('button', { class: 'btn primary', type: 'button', onclick: function () { App.session = null; Views.startSession({}); } }, 'Noch eine Runde'))));
    }

    show();
  }

  // ---------- Statistik ----------
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  function weekBars(goal) {
    var today = App.today(), days = [], max = goal, i, k;
    for (i = 6; i >= 0; i--) {
      k = Game.addDays(today, -i);
      var d = App.S.daily[k], p = k.split('-');
      days.push({ k: k, xp: d ? d.xp : 0, wd: WD[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] });
      if (d && d.xp > max) max = d.xp;
    }
    var W = 308, H = 150, base = 120, kids = [];
    days.forEach(function (x, idx) {
      var bh = Math.round(100 * x.xp / max), bx = 8 + idx * 43;
      kids.push(h('rect', { class: 'bar', x: bx, y: base - bh, width: 32, height: Math.max(bh, x.xp ? 2 : 0), rx: 4 }));
      kids.push(h('text', { x: bx + 16, y: 138, 'text-anchor': 'middle', class: 'axis', 'font-size': 11 }, x.wd));
      if (x.xp) kids.push(h('text', { x: bx + 16, y: base - bh - 4, 'text-anchor': 'middle', class: 'axis', 'font-size': 10 }, String(x.xp)));
    });
    var gy = base - Math.round(100 * goal / max);
    kids.push(h('line', { class: 'goal-line', x1: 0, x2: W, y1: gy, y2: gy, 'stroke-dasharray': '4 4' }));
    return h.apply(null, ['svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img',
      'aria-label': 'XP der letzten 7 Tage: ' + days.map(function (x) { return x.wd + ' ' + x.xp; }).join(', ') }].concat(kids));
  }

  function heatmap() {
    var today = App.today(), p = today.split('-');
    var dow = (new Date(+p[0], +p[1] - 1, +p[2]).getDay() + 6) % 7, start = Game.addDays(today, -(dow + 77)), max = 1, c, r, k, total = 0;
    for (k in App.S.daily) if (App.S.daily[k].reviews > max) max = App.S.daily[k].reviews;
    var cells = [];
    for (c = 0; c < 12; c++) {
      for (r = 0; r < 7; r++) {
        k = Game.addDays(start, c * 7 + r);
        if (k > today) continue;
        var d = App.S.daily[k], n = d ? d.reviews : 0;
        total += n;
        var a = { x: c * 21, y: r * 21, width: 18, height: 18, rx: 3, class: n ? 'hm' : 'hm e' };
        if (n) a['fill-opacity'] = (0.25 + 0.75 * n / max).toFixed(2);
        cells.push(h('rect', a));
      }
    }
    return h.apply(null, ['svg', { viewBox: '0 0 252 147', width: '100%', role: 'img',
      'aria-label': 'Aktivität der letzten 12 Wochen: ' + total + ' Wiederholungen' }].concat(cells));
  }

  function statsView(host) {
    var s = App.S.settings, lang = s.lang, C = App.content(lang), cards = App.cardsFor(lang), now = Date.now();
    var learning = 0, young = 0, mastered = 0, seen = 0, k;
    for (k in cards) {
      var c = cards[k];
      if (c.state === 0) continue;
      seen++;
      if (c.state === 1 || c.state === 3) learning++; else if (c.stability >= 5) mastered++; else young++;
    }
    var rev7 = 0, revAll = 0, d;
    for (k in App.S.daily) {
      d = App.S.daily[k]; revAll += d.reviews;
      if (k >= Game.addDays(App.today(), -6)) rev7 += d.reviews;
    }
    var st = App.streak();
    var ret = h('strong', null, '...');
    DB.loadLog().then(function (log) {
      var r = Game.retention(log, now, 30);
      ret.textContent = r.value === null ? 'noch keine Daten' : Math.round(r.value * 100) + ' % (' + r.n + ' Wiederholungen, 30 Tage)';
    }).catch(function () { ret.textContent = 'nicht lesbar'; });
    mount(host, h('header', { class: 'top' }, h('h1', null, 'Statistik')),
      h('p', { class: 'sub' }, 'Sprache: ' + LANG_NAMES[lang] + ' (Wechsel auf der Startseite)'),
      h('section', { class: 'card' }, h('div', { class: 'stats' }, stat(null, revAll, 'Wiederholungen'), stat(null, rev7, 'letzte 7 Tage'), stat('flame', st.best, 'beste Serie'))),
      h('section', { class: 'card' }, h('h2', null, 'Behalten'), h('p', null, 'Retention: ', ret),
        h('p', { class: 'sub' }, 'Anteil richtiger Antworten bei Karten, die schon einmal geübt wurden.')),
      h('section', { class: 'card' }, h('h2', null, 'Karten'),
        h('p', null, seen + ' von ' + C.items.length + ' Items gelernt: ' + learning + ' in Lernphase, ' + young + ' jung, ' + mastered + ' gemeistert.')),
      h('section', { class: 'card' }, h('h2', null, 'Diese Woche (XP)'), weekBars(s.goal)),
      h('section', { class: 'card' }, h('h2', null, 'Aktivität (12 Wochen)'), heatmap()));
  }

  // ---------- Einstellungen ----------
  function field(label, control, help) {
    return h('div', { class: 'setting' }, h('label', null, label), control, help ? h('p', { class: 'sub' }, help) : null);
  }

  function range(label, min, max, step, value, fmt, onSave) {
    var out = h('output', null, fmt(value));
    var input = h('input', { type: 'range', min: min, max: max, step: step, value: value, 'aria-label': label });
    input.addEventListener('input', function () { out.textContent = fmt(+input.value); });
    input.addEventListener('change', function () { onSave(+input.value); });
    return h('div', { class: 'range' }, input, out);
  }

  function download(file) {
    var url = root.URL.createObjectURL(file), a = root.document.createElement('a');
    a.href = url; a.download = file.name; root.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { root.URL.revokeObjectURL(url); }, 10000);
  }

  function settingsView(host) {
    var s = App.S.settings, lang = s.lang, C = App.content(lang);
    var status = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
    var importBox = h('div', { class: 'import-box' });
    var wipeBox = h('div', { class: 'wipe-box' });
    var persistTxt = h('p', { class: 'sub' }, 'Speicherstatus wird geprüft ...');
    var estimateTxt = h('p', { class: 'sub' });
    function say(t, bad) { status.textContent = t; status.className = 'note' + (bad ? ' bad' : ''); }
    function save() { App.saveSettings(); }

    var voices = Speech.voicesFor(lang);
    var voiceSel = h('select', { 'aria-label': 'Stimme', disabled: !voices.length, value: s.voices[lang] || '' },
      h('option', { value: '' }, voices.length ? 'Automatisch (beste verfügbare)' : 'Keine Stimme gefunden'),
      voices.map(function (v) { return h('option', { value: v.voiceURI }, v.name + ' (' + v.lang + ')'); }));
    voiceSel.addEventListener('change', function () { s.voices[lang] = voiceSel.value; save(); });

    function doExport() {
      say('Backup wird erstellt ...');
      App.exportJson().then(function (json) {
        var file = new root.File([json], 'lingoforge-backup-' + App.today() + '.json', { type: 'application/json' });
        var nav = root.navigator;
        function ok() { App.markBackup().then(function () { say('Backup erstellt.'); }); }
        if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
          return nav.share({ files: [file], title: 'LingoForge-Backup' }).then(ok, function (err) {
            if (err && err.name === 'AbortError') { say('Teilen abgebrochen. Es wurde kein Backup markiert.'); return; }
            download(file); ok();
          });
        }
        download(file); ok();
      }).catch(function (e) { say('Export fehlgeschlagen: ' + e.message, true); });
    }

    function onFile(ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (f.size > Backup.MAX_BYTES) { say('Datei zu groß (max. 8 MB).', true); return; }
      f.text().then(function (text) {
        var data = Backup.parse(text);
        function apply(mode) {
          mount(importBox);
          say('Import läuft ...');
          App.importData(data, mode).then(function () { say('Import abgeschlossen (' + (mode === 'replace' ? 'ersetzt' : 'zusammengeführt') + ').'); Views.render(); })
            .catch(function (e) { say('Import fehlgeschlagen, nichts geändert: ' + e.message, true); });
        }
        mount(importBox, h('p', null, 'Gefunden: ' + data.cards.length + ' Karten, ' + data.reviewLog.length + ' Verlaufseinträge, ' + data.daily.length + ' Tage.' + (data.discarded ? ' Verworfen (deaktivierte Sprache): ' + data.discarded + '.' : '')),
          h('div', { class: 'row wrap' },
            h('button', { class: 'btn danger', type: 'button', onclick: function () { apply('replace'); } }, 'Ersetzen'),
            h('button', { class: 'btn primary', type: 'button', onclick: function () { apply('merge'); } }, 'Zusammenführen'),
            h('button', { class: 'btn ghost', type: 'button', onclick: function () { mount(importBox); say('Import abgebrochen.'); } }, 'Abbrechen')),
          h('p', { class: 'sub' }, 'Ersetzen löscht den aktuellen Fortschritt. Beides läuft in einer Transaktion: bei einem Fehler bleibt alles unverändert.'));
        say('');
      }).catch(function (e) { mount(importBox); say(e.message, true); });
      ev.target.value = '';
    }

    function armWipe() {
      mount(wipeBox, h('div', { class: 'banner bad' },
        h('p', null, 'Wirklich alles löschen? Fortschritt, Einstellungen, Zwischenspeicher und Service Worker werden entfernt. Danach brauchst du einmal Internet, um die App neu zu laden.'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn danger', type: 'button', onclick: function () {
            say('Lösche ...');
            App.wipeAll().then(function () { mount(wipeBox); say('Alles gelöscht.'); go('#/home'); })
              .catch(function (e) { say('Löschen fehlgeschlagen: ' + e.message, true); });
          } }, 'Ja, endgültig löschen'),
          h('button', { class: 'btn ghost', type: 'button', onclick: function () { mount(wipeBox); } }, 'Abbrechen'))));
    }

    var nav = root.navigator;
    if (nav.storage && nav.storage.persisted) {
      nav.storage.persisted().then(function (p) {
        persistTxt.textContent = p ? 'Dauerhafter Speicher: gewährt. Der Browser löscht deine Daten nicht automatisch bei Speicherknappheit.'
          : 'Dauerhafter Speicher: nicht gewährt. Safari kann Daten von lange nicht geöffneten Webseiten löschen. Zum Home-Bildschirm hinzugefügte Apps sind meist ausgenommen, garantiert ist das nicht. Erstelle regelmäßig ein Backup.';
      }).catch(function () { persistTxt.textContent = 'Speicherstatus nicht abfragbar.'; });
    } else persistTxt.textContent = 'Dieser Browser meldet keinen Speicherstatus. Erstelle regelmäßig ein Backup.';
    if (nav.storage && nav.storage.estimate) {
      nav.storage.estimate().then(function (e) {
        estimateTxt.textContent = 'Belegt: ' + ((e.usage || 0) / 1048576).toFixed(2) + ' MB von etwa ' + Math.round((e.quota || 0) / 1048576) + ' MB Kontingent.';
      }).catch(function () { /* optional */ });
    }

    var lb = App.S.meta.lastBackup;
    mount(host, h('header', { class: 'top' }, h('h1', null, 'Einstellungen')), status,
      h('section', { class: 'card' }, h('h2', null, 'Lernen'),
        LANG_OPTS.length > 1 ? field('Lernsprache', seg('Lernsprache', LANG_OPTS, lang, function (v) { s.lang = v; save(); Views.render(); })) : null,
        field('Tagesziel', seg('Tagesziel', [{ v: 20, t: '20 XP' }, { v: 30, t: '30 XP' }, { v: 50, t: '50 XP' }], s.goal, function (v) { s.goal = v; save(); Views.render(); })),
        field('Neue Items pro Tag', range('Neue Items pro Tag', 0, 30, 1, s.newPerDay, String, function (v) { s.newPerDay = v; save(); }),
          'Bei vielen fälligen Wiederholungen wird die Zahl automatisch gesenkt.'),
        field('Ziel-Retention', range('Ziel-Retention', 80, 97, 1, Math.round(s.retention * 100), function (v) { return v + ' %'; }, function (v) { s.retention = v / 100; save(); }),
          'Höher heißt kürzere Abstände und mehr Wiederholungen.'),
        field('Alle Einheiten freischalten', h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: s.unlockAll, 'aria-label': 'Alle Einheiten freischalten',
          onchange: function (e) { s.unlockAll = e.target.checked; save(); } }), h('span', null, s.unlockAll ? 'Aktiv' : 'Aus (Einheit n+1 ab 60 % von n)')))),
      h('section', { class: 'card' }, h('h2', null, 'Sprachausgabe'),
        field('Stimme (' + LANG_NAMES[lang] + ')', voiceSel),
        field('Tempo', range('Tempo', 0.5, 1.2, 0.05, s.rate, function (v) { return v.toFixed(2) + 'x'; }, function (v) { s.rate = v; save(); })),
        h('button', { class: 'btn ghost', type: 'button', disabled: !App.hasVoice(lang), onclick: function () { App.speak(C.units[0].items[3].audio, lang, false); } }, 'Stimme testen'),
        App.hasVoice(lang) ? null : h('p', { class: 'sub' }, 'Ohne Stimme werden Hör- und Nachsprech-Übungen durch Lese- und Tippübungen ersetzt.')),
      h('section', { class: 'card' }, h('h2', null, 'Darstellung'),
        field('Theme', seg('Theme', [{ v: 'auto', t: 'Automatisch' }, { v: 'light', t: 'Hell' }, { v: 'dark', t: 'Dunkel' }], s.theme, function (v) { s.theme = v; save(); App.applyTheme(); Views.render(); }))),
      h('section', { class: 'card' }, h('h2', null, 'Daten'),
        h('p', { class: 'sub' }, lb ? 'Letztes Backup: ' + new Date(lb).toLocaleString('de-DE') : 'Noch kein Backup erstellt.'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn primary', type: 'button', onclick: doExport }, 'Backup exportieren (JSON)'),
          h('label', { class: 'btn ghost filebtn' }, 'Backup importieren', h('input', { type: 'file', accept: 'application/json,.json', class: 'file', 'aria-label': 'Backup-Datei wählen', onchange: onFile }))),
        importBox,
        h('h3', null, 'Speicher'), persistTxt, estimateTxt,
        h('button', { class: 'btn ghost', type: 'button', onclick: function () {
          if (!nav.storage || !nav.storage.persist) { say('Dieser Browser unterstützt keine Anfrage für dauerhaften Speicher.', true); return; }
          nav.storage.persist().then(function (g) { say(g ? 'Dauerhafter Speicher gewährt.' : 'Nicht gewährt. Safari entscheidet selbst; ein Backup bleibt die sichere Variante.'); Views.render(); });
        } }, 'Dauerhaften Speicher anfragen')),
      h('section', { class: 'card' }, h('h2', null, 'Gefahrenbereich'),
        h('button', { class: 'btn danger', type: 'button', onclick: armWipe }, 'Alles löschen ...'), wipeBox),
      h('section', { class: 'card' }, h('h2', null, 'Über LingoForge'),
        h('p', { class: 'sub' }, 'Alles läuft lokal auf diesem Gerät. Keine Konten, keine Analyse, keine Telemetrie, keine Fremdserver. Spaced Repetition nach FSRS-5 mit Standardgewichten. Lizenz MIT.')));
  }

  // ---------- Router ----------
  var NAV = [{ h: '#/home', t: 'Lernen', i: 'home' }, { h: '#/stats', t: 'Statistik', i: 'chart' }, { h: '#/settings', t: 'Einstellungen', i: 'gear' }];

  Views.render = function () {
    var host = root.document.getElementById('view'), nav = root.document.getElementById('nav');
    var hash = root.location.hash || '#/home', inSession = hash.indexOf('#/session') === 0;
    if (!App.S.settings) return;
    try {
      if (inSession) sessionView(host);
      else if (hash.indexOf('#/stats') === 0) statsView(host);
      else if (hash.indexOf('#/settings') === 0) settingsView(host);
      else homeView(host);
    } catch (e) {
      mount(host, h('div', { class: 'banner bad', role: 'alert' }, 'Anzeigefehler: ' + e.message));
    }
    nav.hidden = inSession;
    if (inSession) nav.setAttribute('hidden', ''); else nav.removeAttribute('hidden');
    mount(nav, NAV.map(function (n) {
      var on = hash.indexOf(n.h) === 0 || (n.h === '#/home' && !/^#\/(stats|settings|session)/.test(hash));
      return h('a', { href: n.h, class: 'navlink' + (on ? ' on' : ''), 'aria-current': on ? 'page' : 'false' }, icon(n.i), h('span', null, n.t));
    }));
    Views.renderBanners();
    if (!inSession) root.scrollTo(0, 0);
  };

  LF.Views = Views;
})(typeof globalThis !== 'undefined' ? globalThis : this);
