importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (workbox) {
  console.log('Workbox is loaded');

  // Cache configuration
  const IMAGE_CACHE_NAME = 'firebase-images';
  const STATIC_CACHE_NAME = 'static-assets';
  const DATA_CACHE_NAME = 'menu-data';

  // 1. Cache-First for Firebase Storage Images (30 days)
  workbox.routing.registerRoute(
    ({ url }) => url.origin === 'https://firebasestorage.googleapis.com',
    new workbox.strategies.CacheFirst({
      cacheName: IMAGE_CACHE_NAME,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // 2. Stale-While-Revalidate for local assets and config
  workbox.routing.registerRoute(
    ({ request }) => 
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font' ||
      request.url.includes('firebase-applet-config.json'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: STATIC_CACHE_NAME,
    })
  );

  // 3. Stale-While-Revalidate for any other potential JSON data
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'json',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: DATA_CACHE_NAME,
    })
  );

  // Force activation
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());
} else {
  console.log('Workbox failed to load');
}
