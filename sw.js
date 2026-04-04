const CACHE_NAME = 'finance-v1';

const APP_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/constants.js',
  './js/ui-add.js',
  './js/ui-history.js',
  './js/ui-analytics.js',
  './js/ui-settings.js',
  './js/github-sync.js',
  './js/export.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/idb@8/+esm',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js',
];

// Install: кэшируем все файлы приложения
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: удаляем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first для приложения, network-first для API
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // GitHub API — всегда через сеть
  if (url.includes('api.github.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Кэшируем CDN-библиотеки при первой загрузке
        if (response.ok && CDN_URLS.some(cdn => url.includes(cdn))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Офлайн — возвращаем shell
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
