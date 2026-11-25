/* LingoForge Service Worker: Cache-First nur für die Shell-Dateien, Cache-Name aus Build-Hash. */
'use strict';
var CACHE = 'lingoforge-f929728c92b4';
var SHELL = ['./', './index.html'];
var SHELL_URLS = SHELL.map(function (u) { return new URL(u, self.registration.scope).href; });

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('lingoforge-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Ausgeliefert wird nur die Shell (Navigation -> index.html, exakte Shell-URLs). Alles andere geht ungehindert
// ans Netz und wird weder abgefangen noch zwischengespeichert (kein cache.put, kein ignoreSearch).
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var key = null;
  if (req.mode === 'navigate') key = SHELL_URLS[1];
  else if (SHELL_URLS.indexOf(req.url) >= 0) key = req.url;
  if (!key) return;
  event.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (hit) { return hit || fetch(req); });
  }));
});
