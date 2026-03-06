// Minimal service worker for PWA installability
// Caches core game files for offline play

var CACHE_NAME = 'fatty-catty-v1';
var CORE_FILES = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_FILES);
    })
  );
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request);
    })
  );
});
