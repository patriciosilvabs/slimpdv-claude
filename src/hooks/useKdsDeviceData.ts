import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { Order, OrderItem, OrderStatus } from './useOrders';

interface DeviceAuth {
  deviceId: string;
  deviceName: string;
  stationId: string | null;
  tenantId: string | null;
  authCode: string;
}

interface KdsDataResult {
  orders: Order[];
  settings: any;
  stations: any[];
}

interface KdsTenantInfoResult {
  tenant_name: string | null;
}

export class DeviceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceAuthError';
  }
}

function isAuthError(error: unknown): boolean {
  if (!error) return false;
  const msg = String((error as any)?.message || error).toLowerCase();
  return msg.includes('401') || msg.includes('unauthorized') || msg.includes('autenticação do dispositivo inválido') || msg.includes('device not found');
}

async function fetchKdsData(deviceAuth: DeviceAuth, action: string, extra: Record<string, any> = {}) {
  console.log('[KDS-data] Fetching:', action, 'device:', deviceAuth.deviceId, 'tenant:', deviceAuth.tenantId, 'hasAuthCode:', !!deviceAuth.authCode);
  
  const { data, error } = await supabase.functions.invoke('kds-data', {
    body: {
      action,
      device_id: deviceAuth.deviceId,
      tenant_id: deviceAuth.tenantId,
      auth_code: deviceAuth.authCode,
      ...extra,
    },
  });

  if (error) {
    // supabase.functions.invoke wraps HTTP errors — check for 401
    const status = (error as any)?.status || (error as any)?.context?.status;
    console.error('[KDS-data] Error:', action, 'status:', status, 'message:', (error as any)?.message);
    if (status === 401 || isAuthError(error)) {
      throw new DeviceAuthError('Credencial do dispositivo inválida');
    }
    throw error;
  }
  if (data?.error) {
    console.error('[KDS-data] Data error:', action, data.error);
    if (isAuthError(data.error)) {
      throw new DeviceAuthError(data.error);
    }
    throw new Error(data.error);
  }
  console.log('[KDS-data] Success:', action);
  return data;
}

/**
 * Hook that fetches KDS data via edge function for device-only authentication.
 * Bypasses RLS since devices don't have a Supabase user session.
 */
export function useKdsDeviceData(deviceAuth: DeviceAuth | null) {
  const queryClient = useQueryClient();
  const isDeviceMode = !!deviceAuth?.tenantId && !!deviceAuth?.deviceId && !!deviceAuth?.authCode;
  const [authError, setAuthError] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);

  // Reset auth error when credentials change
  useEffect(() => {
    setAuthError(false);
  }, [deviceAuth?.deviceId, deviceAuth?.authCode]);

  // Fetch tenant name once on mount (or when device changes) — works for existing sessions
  useEffect(() => {
    if (!isDeviceMode || !deviceAuth) return;
    let cancelled = false;
    fetchKdsData(deviceAuth, 'get_tenant_info')
      .then((result: KdsTenantInfoResult) => {
        if (!cancelled && result?.tenant_name) {
          setTenantName(result.tenant_name);
          // Silently update localStorage so future sessions have it
          try {
            const stored = localStorage.getItem('kds_device_auth');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (!parsed.tenantName) {
                parsed.tenantName = result.tenant_name;
                localStorage.setItem('kds_device_auth', JSON.stringify(parsed));
              }
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* non-critical, ignore */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceAuth?.deviceId, deviceAuth?.authCode]);

  // Fetch all data (orders + settings + stations) in one call
  const { data: allData, isLoading, refetch, error: queryError } = useQuery({
    queryKey: ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId],
    queryFn: async () => {
      if (!deviceAuth) return null;
      const result = await fetchKdsData(deviceAuth, 'get_all', {
        statuses: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
      });
      // Clear auth error on success
      setAuthError(false);
      return result as KdsDataResult;
    },
    enabled: isDeviceMode && !authError,
    refetchInterval: authError ? false : 2000,
    refetchIntervalInBackground: true,
    staleTime: 1000,
    retry: (failureCount, error) => {
      if (error instanceof DeviceAuthError) {
        setAuthError(true);
        return false;
      }
      return failureCount < 3;
    },
  });

  // Mutations for device mode
  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'update_order_status', {
        order_id: orderId,
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  const updateItemStation = useMutation({
    mutationFn: async ({ itemId, stationId, stationStatus }: { itemId: string; stationId?: string; stationStatus?: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'update_item_station', {
        item_id: itemId,
        station_id: stationId,
        station_status: stationStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  // Smart move: routes item to next station with load balancing
  const smartMoveItem = useMutation({
    mutationFn: async ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'smart_move_item', {
        item_id: itemId,
        current_station_id: currentStationId,
      });
    },
    // Optimistic update: remove item from current station immediately
    onMutate: async ({ itemId, currentStationId }) => {
      await queryClient.cancelQueries({ queryKey: ['kds-device-data'] });
      const previous = queryClient.getQueryData(['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId]);

      queryClient.setQueryData(
        ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId],
        (old: KdsDataResult | null | undefined) => {
          if (!old || !Array.isArray(old.orders)) return old;
          return {
            ...old,
            orders: old.orders.map((order: any) => ({
              ...order,
              order_items: Array.isArray(order.order_items)
                ? order.order_items.map((item: any) =>
                    item.id === itemId
                      ? { ...item, current_station_id: '__moving__', station_status: 'moving' }
                      : item
                  )
                : order.order_items,
            })),
          };
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  const logStation = useMutation({
    mutationFn: async (params: { order_item_id: string; station_id: string; action: string; duration_seconds?: number; notes?: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'log_station', params);
    },
  });

  return {
    orders: (allData?.orders || []) as Order[],
    settings: allData?.settings || null,
    stations: allData?.stations || [],
    tenantName,
    isLoading,
    refetch,
    updateOrderStatus,
    updateItemStation,
    smartMoveItem,
    logStation,
    isDeviceMode,
    authError,
  };
}
