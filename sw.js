// ============================================================
// Service Worker - Homecare Weight Management PWA
// Strategy: Cache-First untuk assets, Network-First untuk API
// ============================================================

const CACHE_VERSION  = 'hcwm-v1.2.0'; // bumped: workflow Quick Register
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE  = `${CACHE_VERSION}-dynamic`;

// Gunakan path relatif agar kompatibel dengan subfolder hosting
const PRECACHE_URLS = [
  './index.html',
  './assets/css/app.css',
  './assets/js/utils.js',
  './assets/js/db.js',
  './assets/js/api.js',
  './assets/js/sync.js',
  './assets/js/ocr.js',
  './assets/js/ui-ocr.js',
  './assets/js/ui-assessment.js',
  './assets/js/ui-monitoring.js',
  './assets/js/ui-photos.js',
  './assets/js/ui-patient-detail.js',
  './assets/js/ui-patients.js',
  './assets/js/app.js',
];

// ---- INSTALL ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS.filter(u => !u.startsWith('http'))))
      .then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: hapus cache lama ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET dan chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // API calls → Network-First
  if (url.pathname.includes('/api/') || url.pathname.match(/\.(php)$/)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Upload assets → Network-Only
  if (url.pathname.includes('/uploads/')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Tesseract CDN → Network-First + cache
  if (url.hostname.includes('jsdelivr.net') ||
      url.pathname.includes('tesseract') ||
      url.pathname.includes('tessdata')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets → Cache-First
  event.respondWith(cacheFirst(request));
});

// --- Strategy: Cache-First ---
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback untuk HTML pages
    const fallback = await caches.match('/index.html');
    return fallback || new Response('Offline - tidak ada koneksi internet', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// --- Strategy: Network-First ---
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ success: false, message: 'Offline - data tidak tersedia', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ---- BACKGROUND SYNC (untuk push data saat kembali online) ----
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'TRIGGER_SYNC' }));
      })
    );
  }
});

// ---- PUSH NOTIFICATION (opsional, untuk reminder) ----
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Homecare WMS', body: 'Ada notifikasi baru' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-72.png',
      vibrate: [100, 50, 100],
    })
  );
});
