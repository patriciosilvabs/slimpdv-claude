/**
 * usePushSubscription
 *
 * Manages Web Push (VAPID) subscription lifecycle:
 *  1. Fetches VAPID public key from backend
 *  2. Requests OS notification permission
 *  3. Subscribes the browser via PushManager
 *  4. Saves / removes the subscription endpoint in the backend DB
 *
 * Only runs when the user is authenticated. Safe in KDS device mode
 * (silently skips when no auth_token is present).
 */
import { useState, useEffect, useCallback } from 'react';
import { client as apiClient } from '@/integrations/api/client';

const SUB_STORAGE_KEY = 'pdv_push_subscribed';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export interface PushSubscriptionState {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  loading: boolean;
  error: string | null;
  vapidAvailable: boolean;
}

export function usePushSubscription() {
  const hasToken = !!localStorage.getItem('auth_token');

  const [state, setState] = useState<PushSubscriptionState>({
    supported: false,
    permission: 'default',
    subscribed: localStorage.getItem(SUB_STORAGE_KEY) === 'true',
    loading: false,
    error: null,
    vapidAvailable: false,
  });

  // Detect support + check if VAPID key is configured
  useEffect(() => {
    if (!hasToken) return;
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!supported) {
      setState(s => ({ ...s, supported: false }));
      return;
    }

    setState(s => ({ ...s, supported: true, permission: Notification.permission }));

    // Check if backend has VAPID configured
    apiClient
      .get<{ publicKey: string | null }>('/push/vapid-public-key')
      .then(({ publicKey }) => {
        setState(s => ({ ...s, vapidAvailable: !!publicKey }));
      })
      .catch(() => {
        setState(s => ({ ...s, vapidAvailable: false }));
      });
  }, [hasToken]);

  const subscribe = useCallback(async () => {
    if (!hasToken || !state.supported) return;
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      // 1. Get VAPID public key
      const { publicKey } = await apiClient.get<{ publicKey: string | null }>('/push/vapid-public-key');
      if (!publicKey) {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Servidor não configurado para push. Contate o administrador.',
        }));
        return;
      }

      // 2. Request OS permission
      const permission = await Notification.requestPermission();
      setState(s => ({ ...s, permission }));
      if (permission !== 'granted') {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Permissão de notificação negada. Habilite nas configurações do navegador.',
        }));
        return;
      }

      // 3. Subscribe via PushManager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 4. Save subscription in backend
      const sub = subscription.toJSON();
      await apiClient.post('/push/subscribe', {
        endpoint: sub.endpoint,
        keys: sub.keys,
      });

      localStorage.setItem(SUB_STORAGE_KEY, 'true');
      setState(s => ({ ...s, loading: false, subscribed: true }));
    } catch (err: any) {
      console.error('[push] subscribe error:', err);
      setState(s => ({
        ...s,
        loading: false,
        error: err.message || 'Erro ao ativar notificações push',
      }));
    }
  }, [hasToken, state.supported]);

  const unsubscribe = useCallback(async () => {
    if (!hasToken) return;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Notify backend first
        await apiClient.post('/push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      localStorage.removeItem(SUB_STORAGE_KEY);
      setState(s => ({ ...s, loading: false, subscribed: false }));
    } catch (err: any) {
      setState(s => ({
        ...s,
        loading: false,
        error: err.message || 'Erro ao desativar notificações push',
      }));
    }
  }, [hasToken]);

  return { ...state, subscribe, unsubscribe };
}
