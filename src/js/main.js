/* Main: Start, Router, Service-Worker-Update (ohne Zwangsreload), Fehleranzeige. */
(function (root) {
  'use strict';
  var LF = root.LF, App = LF.App, Views = LF.Views;
  var nav = root.navigator;

  function offer(worker) { App.updateWorker = worker; App.emit('banner'); }

  function registerSW() {
    if (!nav.serviceWorker) return;
    var asked = false;
    App.on('applyUpdate', function () {
      asked = true;
      if (App.updateWorker) App.updateWorker.postMessage({ type: 'SKIP_WAITING' });
    });
    nav.serviceWorker.addEventListener('controllerchange', function () { if (asked) root.location.reload(); });
    nav.serviceWorker.register('sw.js').then(function (reg) {
      if (reg.waiting && nav.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && nav.serviceWorker.controller) offer(w); });
      });
      function check() { reg.update().catch(function () { /* offline: kein Update */ }); }
      check();
      root.document.addEventListener('visibilitychange', function () { if (root.document.visibilityState === 'visible') check(); });
    }).catch(function () { /* z. B. kein sicherer Kontext: App läuft ohne Offline-Cache */ });
  }

  function crash(msg) { App.dbError = 'Unerwarteter Fehler: ' + msg; App.emit('banner'); }
  root.addEventListener('error', function (e) { crash(e && e.message ? e.message : 'unbekannt'); });
  root.addEventListener('unhandledrejection', function (e) { crash(e && e.reason && e.reason.message ? e.reason.message : 'unbekannt'); });
  root.addEventListener('hashchange', function () { Views.render(); });
  App.on('banner', function () { Views.renderBanners(); });

  LF.ready = App.init().then(function () {
    Views.render();
    registerSW();
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
