import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredDeviceAuth, clearDeviceAuth } from '@/components/kds/KdsDeviceLogin';
import { DeviceAuthError } from '@/hooks/useKdsDeviceData';
import { toast } from 'sonner';
import type { SectorOrderItem } from './useSectorOrderItems';

interface StationActionParams {
  itemId: string;
  currentStationId?: string | null;
}

export function useKdsActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const getValidDeviceAuth = () => {
    const deviceAuth = getStoredDeviceAuth();
    if (deviceAuth?.deviceId && deviceAuth?.tenantId && deviceAuth?.authCode) {
      return deviceAuth;
    }
    return null;
  };

  const invokeDeviceAction = async (action: string, extra: Record<string, unknown> = {}) => {
    const deviceAuth = getValidDeviceAuth();
    if (!deviceAuth) {
      throw new Error('Não autenticado — dispositivo sem credenciais válidas');
    }

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
      const status = (error as any)?.status || (error as any)?.context?.status;
      if (status === 401) {
        clearDeviceAuth();
        throw new DeviceAuthError('Sessão do dispositivo expirada');
      }
      throw error;
    }
    if (data?.error) {
      const msg = String(data.error).toLowerCase();
      if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('auth_code')) {
        clearDeviceAuth();
        throw new DeviceAuthError(data.error);
      }
      throw new Error(data.error);
    }
    return data;
  };

  // Helper: snapshot + patch only ARRAY queries — avoids runtime errors on object-shaped caches
  const snapshotAndPatch = (
    keys: string[][],
    patchFn: (items: SectorOrderItem[] | undefined) => SectorOrderItem[] | undefined
  ) => {
    const snapshots = new Map<string, unknown>();

    for (const key of keys) {
      queryClient.getQueriesData<unknown>({ queryKey: key }).forEach(([qk, data]) => {
        snapshots.set(JSON.stringify(qk), data);

        if (Array.isArray(data)) {
          queryClient.setQueryData(qk, patchFn(data as SectorOrderItem[]));
        }
      });
    }

    // Cancel in-flight queries in background (fire-and-forget) to prevent overwrite
    Promise.all(keys.map(k => queryClient.cancelQueries({ queryKey: k }))).catch(() => {});

    return snapshots;
  };

  const restoreSnapshots = (snapshots: Map<string, unknown>) => {
    snapshots.forEach((data, keyStr) => {
      try {
        const key = JSON.parse(keyStr);
        queryClient.setQueryData(key, data);
      } catch (e) {
        console.error('[KDS] restoreSnapshots parse error', e);
      }
    });
  };

  // Claim (INICIAR)
  const claimItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (user?.id) {
        const { data, error } = await supabase.rpc('claim_order_item', {
          _item_id: itemId,
          _user_id: user.id,
        });
        if (error) throw error;
        return data;
      }
      return invokeDeviceAction('claim_item', { item_id: itemId });
    },
    onMutate: (itemId) => {
      const startedAt = new Date().toISOString();
      const snapshots = snapshotAndPatch(
        [['sector-order-items'], ['kds-device-data']],
        (old) => old?.map(i => i.id === itemId ? {
          ...i,
          station_status: 'in_progress',
          claimed_by: user?.id || 'device',
          claimed_at: startedAt,
          station_started_at: startedAt,
        } : i)
      );
      return { snapshots };
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['sector-order-items'] });
      queryClient.refetchQueries({ queryKey: ['kds-device-data'] });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.snapshots) restoreSnapshots(context.snapshots);
      toast.error(error.message || 'Erro ao iniciar item');
    },
  });

  // Complete edge preparation (MONTAGEM)
  const completeEdge = useMutation({
    mutationFn: async ({ itemId }: StationActionParams) => {
      if (user?.id) {
        const { data, error } = await supabase.rpc('complete_edge_preparation', {
          _item_id: itemId,
          _user_id: user.id,
        });
        if (error) throw error;
        return data;
      }
      return invokeDeviceAction('complete_edge', { item_id: itemId });
    },
    onMutate: ({ itemId }) => {
      const snapshots = snapshotAndPatch(
        [['sector-order-items']],
        (old) => old?.filter(i => i.id !== itemId)
      );
      return { snapshots };
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['sector-order-items'] });
      queryClient.refetchQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.snapshots) restoreSnapshots(context.snapshots);
      toast.error(error.message || 'Erro ao finalizar borda');
    },
  });

  // Send to oven (FORNO) — separate patches for sector (remove) and oven (add)
  const sendToOven = useMutation({
    mutationFn: async ({ itemId, ovenMinutes }: { itemId: string; ovenMinutes?: number }) => {
      if (user?.id) {
        const { data, error } = await supabase.rpc('send_to_oven', {
          _item_id: itemId,
          _user_id: user.id,
          _oven_minutes: ovenMinutes || null,
        });
        if (error) throw error;
        return data;
      }
      return invokeDeviceAction('send_to_oven', {
        item_id: itemId,
        oven_minutes: ovenMinutes ?? null,
      });
    },
    onMutate: ({ itemId }) => {
      const now = new Date().toISOString();

      // Remove from sector view
      const sectorSnapshots = snapshotAndPatch(
        [['sector-order-items']],
        (old) => old?.filter(i => i.id !== itemId)
      );

      // Update in oven view (if item already exists there, update status)
      const ovenSnapshots = snapshotAndPatch(
        [['oven-items']],
        (old) => {
          if (!old) return old;
          const exists = old.some(i => i.id === itemId);
          if (exists) {
            return old.map(i => i.id === itemId ? {
              ...i,
              station_status: 'in_oven',
              oven_entry_at: now,
            } : i);
          }
          return old;
        }
      );

      // Merge snapshots
      const snapshots = new Map<string, unknown>();
      sectorSnapshots.forEach((v, k) => snapshots.set(k, v));
      ovenSnapshots.forEach((v, k) => snapshots.set(k, v));

      return { snapshots };
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['sector-order-items'] });
      queryClient.refetchQueries({ queryKey: ['oven-items'] });
      queryClient.refetchQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.snapshots) restoreSnapshots(context.snapshots);
      toast.error(error.message || 'Erro ao enviar ao forno');
    },
  });

  // Mark ready (PRONTO)
  const markReady = useMutation({
    mutationFn: async ({ itemId }: StationActionParams) => {
      if (user?.id) {
        const { data, error } = await supabase.rpc('mark_item_ready', {
          _item_id: itemId,
          _user_id: user.id,
        });
        if (error) throw error;

        // Get order_id for this item
        const { data: itemData } = await supabase
          .from('order_items')
          .select('order_id')
          .eq('id', itemId)
          .single();
        if (itemData?.order_id) {
          // Explicitly trigger order completion check (mark_item_ready only updates item, not order)
          await supabase.rpc('check_order_completion', { _order_id: itemData.order_id });

          // Now fetch updated order status
          const { data: orderData } = await supabase
            .from('orders')
            .select('status, external_source')
            .eq('id', itemData.order_id)
            .single();
          if (orderData?.status === 'ready' && orderData?.external_source === 'cardapioweb') {
            supabase.functions.invoke('cardapioweb-sync-status', {
              body: { order_id: itemData.order_id, new_status: 'ready' },
            }).catch(err => console.error('[KdsActions] CardápioWeb sync failed:', err));
          }
        }

        return data;
      }
      return invokeDeviceAction('mark_item_ready', { item_id: itemId });
    },
    onMutate: ({ itemId }) => {
      const snapshots = snapshotAndPatch(
        [['oven-items'], ['sector-order-items']],
        (old) => old?.map(i => i.id === itemId ? {
          ...i,
          station_status: 'ready',
          ready_at: new Date().toISOString(),
          status: 'ready',
        } : i)
      );
      return { snapshots };
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['oven-items'] });
      queryClient.refetchQueries({ queryKey: ['sibling-items'] });
      queryClient.refetchQueries({ queryKey: ['order-all-items'] });
      queryClient.refetchQueries({ queryKey: ['kds-device-data'] });
      queryClient.refetchQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.snapshots) restoreSnapshots(context.snapshots);
      toast.error(error.message || 'Erro ao marcar como pronto');
    },
  });

  // Redistribute offline sector items
  const redistribute = useMutation({
    mutationFn: async (tenantId: string) => {
      const { data, error } = await supabase.rpc('redistribute_offline_sector_items', {
        _tenant_id: tenantId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['sector-order-items'] });
      queryClient.refetchQueries({ queryKey: ['kds-device-data'] });
    },
  });

  // Dispatch oven items (DESPACHAR)
  const dispatchOvenItems = useMutation({
    mutationFn: async ({ itemIds, waiterServeStationId }: { itemIds: string[]; waiterServeStationId?: string | null }) => {
      if (user?.id) {
        // Fetch items with order_type to route dine_in to waiter_serve
        const { data: items, error: fetchError } = await supabase
          .from('order_items')
          .select('id, order_id, current_station_id, tenant_id, order:orders(order_type)')
          .in('id', itemIds);
        if (fetchError) throw fetchError;

        const now = new Date().toISOString();

        // Split: dine_in (with waiter_serve configured) vs others
        const dineInIds = waiterServeStationId
          ? (items || []).filter(i => (i.order as any)?.order_type === 'dine_in').map(i => i.id)
          : [];
        const otherIds = (items || []).filter(i => !dineInIds.includes(i.id)).map(i => i.id);

        // Route dine_in to waiter_serve station
        if (dineInIds.length > 0 && waiterServeStationId) {
          const { error } = await supabase
            .from('order_items')
            .update({
              current_station_id: waiterServeStationId,
              station_status: 'waiting',
              station_started_at: null,
              station_completed_at: now,
            })
            .in('id', dineInIds);
          if (error) throw error;
        }

        // Dispatch non-dine_in items normally
        if (otherIds.length > 0) {
          const { error } = await supabase
            .from('order_items')
            .update({
              current_station_id: null,
              station_status: 'dispatched',
              station_completed_at: now,
            })
            .in('id', otherIds);
          if (error) throw error;
        }

        if (items && items.length > 0) {
          // Fire-and-forget logs
          const logs = items
            .filter(i => i.current_station_id)
            .map(i => ({
              order_item_id: i.id,
              station_id: i.current_station_id!,
              action: 'dispatched',
              performed_by: user.id,
              tenant_id: i.tenant_id,
            }));
          if (logs.length > 0) {
            supabase.from('kds_station_logs').insert(logs).then(() => {});
          }

          // Parallelize order completion checks
          const orderIds = [...new Set(items.map(i => i.order_id))];
          await Promise.all(
            orderIds.map(orderId => supabase.rpc('check_order_completion', { _order_id: orderId }))
          );

          // Sync CardapioWeb for any orders that became ready
          for (const orderId of orderIds) {
            const { data: orderData } = await supabase
              .from('orders')
              .select('status, external_source')
              .eq('id', orderId)
              .single();
            if (orderData?.status === 'ready' && orderData?.external_source === 'cardapioweb') {
              supabase.functions.invoke('cardapioweb-sync-status', {
                body: { order_id: orderId, new_status: 'ready' },
              }).catch(err => console.error('[KdsActions] CardápioWeb sync failed:', err));
            }
          }
        }
        return true;
      }
      return invokeDeviceAction('dispatch_oven_items', { item_ids: itemIds });
    },
    onMutate: ({ itemIds }) => {
      const idSet = new Set(itemIds);
      const snapshots = snapshotAndPatch(
        [['oven-items']],
        (old) => old?.filter(i => !idSet.has(i.id))
      );
      return { snapshots };
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['oven-items'] });
      queryClient.refetchQueries({ queryKey: ['sibling-items'] });
      queryClient.refetchQueries({ queryKey: ['orders'] });
      queryClient.refetchQueries({ queryKey: ['kds-station-history'] });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.snapshots) restoreSnapshots(context.snapshots);
      toast.error(error.message || 'Erro ao despachar itens');
    },
  });

  return {
    claimItem,
    completeEdge,
    sendToOven,
    markReady,
    dispatchOvenItems,
    redistribute,
  };
}
