// Nova Service Worker — для показа уведомлений и кеширования
const CACHE_NAME = 'nova-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Обработка push-уведомлений (для будущего серверного push)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nova напоминание';
  const options = {
    body: data.body || 'Время выполнить задачу!',
    icon: '/vite.svg',
    badge: '/vite.svg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'nova-reminder',
    data: data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Клик по уведомлению — открыть/фокус на приложении
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
