// Service Worker for EBD com Propósito
// Minimal SW to enable PWA install + badge support

const CACHE_NAME = 'ebd-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Listen for messages from the app (badge updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    const count = event.data.count || 0;
    if (navigator.setAppBadge) {
      if (count > 0) {
        navigator.setAppBadge(count);
      } else {
        navigator.clearAppBadge();
      }
    }
  }
});

// Basic fetch handler (network-first for API, cache-first for assets)
self.addEventListener('fetch', (event) => {
  // Let all requests pass through normally
  return;
});
