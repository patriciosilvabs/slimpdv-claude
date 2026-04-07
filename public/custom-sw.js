// Custom Service Worker — Push Notifications + Background Sync

// ─── Push notifications (when app is closed) ─────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SlimPDV', body: event.data ? event.data.text() : 'Nova notificação' };
  }

  const title = data.title || 'SlimPDV';
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'slimpdv-notification',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: data.requireInteraction !== false,
    silent: false,
    data: data,
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const data = notification.data || {};

  notification.close();

  const urlToOpen = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: action || 'click',
            notificationTag: notification.tag,
            data: data,
          });
          return client.focus();
        }
      }
      // No window open — launch app
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Messages from the main app ───────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SHOW_NOTIFICATION':
    case 'SHOW_SYNC_NOTIFICATION':
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: payload.tag || 'app-notification',
        vibrate: [200, 100, 200],
        requireInteraction: payload.requireInteraction || false,
        actions: payload.actions || [],
        data: payload.data || {},
        silent: false,
      });
      break;

    case 'CLOSE_NOTIFICATION':
      self.registration.getNotifications({ tag: payload.tag }).then((notifications) => {
        notifications.forEach((n) => n.close());
      });
      break;
  }
});

// ─── Background sync ──────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag.startsWith('supabase-')) {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-pending-operations') {
    event.waitUntil(checkPendingOperations());
  }
});

async function checkPendingOperations() {
  try {
    const db = await openDB();
    const count = await countOldPendingOperations(db);
    if (count > 0) {
      await self.registration.showNotification('Operações pendentes', {
        body: `Você tem ${count} operação(ões) aguardando sincronização.`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'pending-reminder',
        actions: [{ action: 'sync', title: 'Sincronizar agora' }],
        data: { url: '/' },
      });
    }
  } catch { /* ignore */ }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pdv-offline-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function countOldPendingOperations(db) {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(['offline-operations'], 'readonly');
      const store = transaction.objectStore('offline-operations');
      const request = store.getAll();
      request.onsuccess = () => {
        const operations = request.result || [];
        const oneHourAgo = Date.now() - 3600000;
        resolve(operations.filter((op) => op.timestamp < oneHourAgo).length);
      };
      request.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}
