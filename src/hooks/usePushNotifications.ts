import { useState, useEffect, useCallback } from 'react';

interface PushNotificationSettings {
  enabled: boolean;
  pendingSync: boolean;
  syncComplete: boolean;
  syncError: boolean;
  offlineReminder: boolean;
}

const STORAGE_KEY = 'pdv-push-notification-settings';

const defaultSettings: PushNotificationSettings = {
  enabled: true,
  pendingSync: true,
  syncComplete: true,
  syncError: true,
  offlineReminder: true,
};

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [settings, setSettings] = useState<PushNotificationSettings>(defaultSettings);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      } catch {
        // Use defaults if parsing fails
      }
    }
  }, []);

  // Check support and permission
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      
      // Get service worker registration
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
      });
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<PushNotificationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback(async (
    title: string,
    options?: NotificationOptions & { tag?: string; actions?: { action: string; title: string }[] }
  ): Promise<boolean> => {
    if (!isSupported || permission !== 'granted' || !settings.enabled) {
      return false;
    }

    try {
      // Use service worker for persistent notifications if available
      if (registration) {
        await registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          requireInteraction: true,
          ...options,
        } as NotificationOptions);
      } else {
        // Fallback to regular notification
        new Notification(title, {
          icon: '/pwa-192x192.png',
          ...options,
        });
      }
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }, [isSupported, permission, settings.enabled, registration]);

  const notifyPendingSync = useCallback(async (count: number) => {
    if (!settings.pendingSync) return;
    
    await sendNotification(
      `${count} operação(ões) pendente(s)`,
      {
        body: 'Você está offline. As operações serão sincronizadas quando a conexão for restaurada.',
        tag: 'pending-sync',
        actions: [
          { action: 'view', title: 'Ver detalhes' }
        ]
      }
    );
  }, [settings.pendingSync, sendNotification]);

  const notifySyncStarted = useCallback(async (count: number) => {
    if (!settings.syncComplete) return;
    
    await sendNotification(
      'Sincronização iniciada',
      {
        body: `Sincronizando ${count} operação(ões) pendente(s)...`,
        tag: 'sync-progress',
      }
    );
  }, [settings.syncComplete, sendNotification]);

  const notifySyncComplete = useCallback(async (successCount: number, failCount: number) => {
    if (!settings.syncComplete && !settings.syncError) return;
    
    if (failCount > 0 && settings.syncError) {
      await sendNotification(
        'Sincronização com erros',
        {
          body: `${successCount} operação(ões) sincronizada(s), ${failCount} falhou(aram).`,
          tag: 'sync-complete',
          actions: [
            { action: 'retry', title: 'Tentar novamente' }
          ]
        }
      );
    } else if (settings.syncComplete) {
      await sendNotification(
        'Sincronização concluída',
        {
          body: `${successCount} operação(ões) sincronizada(s) com sucesso!`,
          tag: 'sync-complete',
        }
      );
    }
  }, [settings.syncComplete, settings.syncError, sendNotification]);

  const notifyOfflineWithPending = useCallback(async (count: number) => {
    if (!settings.offlineReminder) return;
    
    await sendNotification(
      'Modo offline ativado',
      {
        body: `Você tem ${count} operação(ões) que será(ão) sincronizada(s) quando a conexão for restaurada.`,
        tag: 'offline-pending',
      }
    );
  }, [settings.offlineReminder, sendNotification]);

  const notifyOldPendingOperations = useCallback(async (count: number) => {
    if (!settings.offlineReminder) return;
    
    await sendNotification(
      'Operações pendentes há muito tempo',
      {
        body: `Você tem ${count} operação(ões) aguardando sincronização há mais de 1 hora.`,
        tag: 'old-pending',
        actions: [
          { action: 'sync', title: 'Sincronizar agora' }
        ]
      }
    );
  }, [settings.offlineReminder, sendNotification]);

  return {
    isSupported,
    permission,
    settings,
    updateSettings,
    requestPermission,
    sendNotification,
    notifyPendingSync,
    notifySyncStarted,
    notifySyncComplete,
    notifyOfflineWithPending,
    notifyOldPendingOperations,
  };
}
