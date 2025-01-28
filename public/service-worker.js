// Service Worker для обробки push-сповіщень

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Встановлення');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Активація');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Отримано push подію:', event);
  
  try {
    const data = event.data.json();
    console.log('[Service Worker] Дані push-сповіщення:', data);
    
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
    
    console.log('[Service Worker] Push-сповіщення успішно показано');
  } catch (error) {
    console.error('[Service Worker] Помилка при обробці push-сповіщення:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Користувач клікнув на сповіщення:', event.notification);
  
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
