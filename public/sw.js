// Service Worker for EBD com Propósito
// PWA support: install, badge, periodic sync

const CACHE_NAME = 'ebd-v2';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Registra periodic sync se disponível
      self.registration.periodicSync && 
        self.registration.periodicSync.register('check-notifications', {
          minInterval: 60 * 1000 // 1 minuto
        }).catch(() => {})
    ])
  );
});

// Listen for messages from the app (badge updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    const count = event.data.count || 0;
    setBadge(count);
  }
});

// Periodic background sync (verifica notificações em background)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkAndUpdateBadge());
  }
});

// Push notification handler (para futuro suporte)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.message || 'Nova notificação',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: data.id || 'notification',
      data: { url: '/dashboard' }
    };
    
    event.waitUntil(
      Promise.all([
        self.registration.showNotification(data.title || 'EBD com Propósito', options),
        checkAndUpdateBadge()
      ])
    );
  }
});

// Clique na notificação push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Funções auxiliares
async function checkAndUpdateBadge() {
  try {
    const response = await fetch('/api/notifications');
    if (response.ok) {
      const notifications = await response.json();
      const unreadCount = notifications.filter(n => !n.isRead).length;
      setBadge(unreadCount);
    }
  } catch (e) {
    // Silenciosamente falha em background
  }
}

function setBadge(count) {
  try {
    if (navigator.setAppBadge) {
      if (count > 0) {
        navigator.setAppBadge(count);
      } else {
        navigator.clearAppBadge();
      }
    }
  } catch (e) {
    // Badge API não disponível neste contexto
  }
}

// Basic fetch handler
self.addEventListener('fetch', (event) => {
  // Let all requests pass through normally
  return;
});
