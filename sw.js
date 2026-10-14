// Offline support, network first.
// Online: always fetch fresh files (skipping the browser's own cache), so the phone can never
// end up with a mix of old and new files. Offline: fall back to the last good copy.
// Strava and other sites are never touched.
const CACHE = 'charge-v8';
const SHELL = ['./', 'index.html', 'styles.css?v=8', 'routines.js?v=8', 'plan.js?v=8', 'engine.js?v=8', 'app.js?v=8',
  'manifest.webmanifest', 'icon.svg', 'fit.bundle.js?v=8'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(SHELL.map(u => fetch(u, { cache: 'no-store' }).then(r => r.ok && c.put(u, r)).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(e.request, { cache: 'no-cache' });
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(e.request) ||
        (e.request.mode === 'navigate' ? await cache.match('index.html') : null);
      if (hit) return hit;
      throw err;
    }
  })());
});
