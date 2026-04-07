import { useState, useEffect } from 'react';

interface PWAStatus {
  isOnline: boolean;
  isStandalone: boolean;
  serviceWorkerStatus: 'unsupported' | 'installing' | 'waiting' | 'active' | 'error';
  hasBackgroundSync: boolean;
  hasPushNotifications: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function usePWAStatus(): PWAStatus {
  const [status, setStatus] = useState<PWAStatus>({
    isOnline: navigator.onLine,
    isStandalone: false,
    serviceWorkerStatus: 'unsupported',
    hasBackgroundSync: false,
    hasPushNotifications: false,
    registration: null,
  });

  useEffect(() => {
    // Check standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Check for Background Sync support
    const hasBackgroundSync = 'serviceWorker' in navigator && 'SyncManager' in window;

    // Check for Push Notifications support
    const hasPushNotifications = 'serviceWorker' in navigator && 'PushManager' in window;

    setStatus(prev => ({
      ...prev,
      isStandalone,
      hasBackgroundSync,
      hasPushNotifications,
    }));

    // Online/Offline listeners
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Service Worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        setStatus(prev => ({
          ...prev,
          serviceWorkerStatus: 'active',
          registration,
        }));
      }).catch(() => {
        setStatus(prev => ({ ...prev, serviceWorkerStatus: 'error' }));
      });

      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          if (registration.installing) {
            setStatus(prev => ({ ...prev, serviceWorkerStatus: 'installing' }));
          } else if (registration.waiting) {
            setStatus(prev => ({ ...prev, serviceWorkerStatus: 'waiting' }));
          } else if (registration.active) {
            setStatus(prev => ({ 
              ...prev, 
              serviceWorkerStatus: 'active',
              registration 
            }));
          }
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
