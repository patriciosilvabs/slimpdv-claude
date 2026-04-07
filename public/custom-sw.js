// Custom Service Worker for Push Notifications and Sync handling

// Handle messages from the main app
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SHOW_SYNC_NOTIFICATION':
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: payload.tag || 'sync-notification',
        vibrate: [200, 100, 200],
        requireInteraction: payload.requireInteraction || false,
        actions: payload.actions || [],
        data: payload.data || {},
      });
      break;
      
    case 'CLOSE_NOTIFICATION':
      self.registration.getNotifications({ tag: payload.tag }).then((notifications) => {
        notifications.forEach((notification) => notification.close());
      });
      break;
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const data = notification.data || {};

  notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find an existing window or open a new one
      const urlToOpen = data.url || '/';
      
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Send action to the client
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: action || 'click',
            notificationTag: notification.tag,
            data: data,
          });
          return client.focus();
        }
      }
      
      // No existing window found, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle background sync events
self.addEventListener('sync', (event) => {
  if (event.tag.startsWith('supabase-')) {
    event.waitUntil(
      // The actual sync is handled by Workbox
      // We just notify the user when sync completes
      Promise.resolve().then(() => {
        return self.registration.showNotification('Sincronização em andamento', {
          body: 'Suas operações estão sendo sincronizadas...',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'background-sync',
        });
      })
    );
  }
});

// Periodic background sync for reminders (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-pending-operations') {
    event.waitUntil(checkPendingOperations());
  }
});

async function checkPendingOperations() {
  // This would check IndexedDB for old pending operations
  // and notify the user if there are any
  try {
    const db = await openDB();
    const count = await countOldPendingOperations(db);
    
    if (count > 0) {
      await self.registration.showNotification('Operações pendentes', {
        body: `Você tem ${count} operação(ões) aguardando sincronização.`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'pending-reminder',
        actions: [
          { action: 'sync', title: 'Sincronizar agora' }
        ],
        data: { url: '/' }
      });
    }
  } catch (error) {
    console.error('Error checking pending operations:', error);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pdv-offline-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function countOldPendingOperations(db) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['offline-operations'], 'readonly');
      const store = transaction.objectStore('offline-operations');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const operations = request.result || [];
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const oldOperations = operations.filter(op => op.timestamp < oneHourAgo);
        resolve(oldOperations.length);
      };
      
      request.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}
