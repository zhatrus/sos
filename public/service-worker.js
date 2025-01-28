// Service Worker для обробки push-сповіщень

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  
  try {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        timestamp: new Date(data.timestamp).getTime(),
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: data // Зберігаємо всі дані для подальшого використання
      })
    );
    
  } catch (error) {
    console.error('[Service Worker] Помилка при обробці push-сповіщення:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});