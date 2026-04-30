const CACHE_NAME = 'myshoppinglist-cache-v1';

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
  self.skipWaiting(); // Активировать новый SW сразу
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Обработка push-уведомлений (для будущего использования)
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Напоминание о покупках!',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
    tag: 'shopping-reminder',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('Список покупок', options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/') // Открыть приложение
  );
});

// Периодическая проверка напоминаний (Background Sync)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_REMINDERS') {
    const lists = event.data.lists;
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().substring(0, 5);

    lists.forEach((list) => {
      if (list.date === currentDate && list.time === currentTime && !list.notified) {
        self.registration.showNotification('Напоминание о покупках!', {
          body: `Пора за покупками: ${list.name}`,
          icon: '/icon.png',
          badge: '/icon.png',
          vibrate: [300, 100, 300, 100, 300],
          tag: `reminder-${list.id}`,
          requireInteraction: true
        });
      }
    });
  }
});
