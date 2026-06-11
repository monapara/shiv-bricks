const CACHE_NAME = 'shiv-bricks-v13';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './filter.js',
  './exportPDF.js',
  './manifest.json',
  './mahadev.jpg',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error('Caching failed:', err))
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Let Firebase / Google backend calls (auth + Firestore sync) go straight to
  // the network -- never cache or intercept them.
  if (url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('firebaseapp.com') ||
      url.hostname.endsWith('google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAME }).then(response => {
      return response || fetch(event.request);
    }).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html', { cacheName: CACHE_NAME });
      }
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      // Remove every older Shiv Bricks cache (V1 and test builds) so only this one remains.
      names.filter(n => n.startsWith('shiv-bricks-') && n !== CACHE_NAME)
           .map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});
