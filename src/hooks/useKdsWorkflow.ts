import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKdsStations } from './useKdsStations';
import { useKdsStationLogs } from './useKdsStationLogs';
import { useKdsSettings } from './useKdsSettings';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { markItemAsRecentlyMoved } from './useOrders';

interface OrderItem {
  id: string;
  order_id: string;
  current_station_id: string | null;
  station_status: string;
  station_started_at: string | null;
  station_completed_at: string | null;
  product?: { name: string } | null;
  quantity: number;
}

interface OrderData {
  id: string;
  order_items: OrderItem[];
  [key: string]: unknown;
}

export function useKdsWorkflow() {
  const queryClient = useQueryClient();
  const { activeStations, getNextStation, orderStatusStation, orderStatusStations, isLastProductionStation, productionStations } = useKdsStations();
  const { logAction } = useKdsStationLogs();
  const { settings } = useKdsSettings();
  const { user } = useAuth();
  const routingMode = settings.routingMode || 'sequential';
  
  // IDs de todas as estações order_status para verificações
  const orderStatusStationIds = orderStatusStations?.map(s => s.id) || [];

  // Helper: find least-busy item_assembly station (used in smart mode)
  const findLeastBusyPrepStation = async (): Promise<string | null> => {
    const assemblyStations = activeStations.filter(s => s.station_type === 'item_assembly');
    if (assemblyStations.length === 0) return null;
    if (assemblyStations.length === 1) return assemblyStations[0].id;

    const stationIds = assemblyStations.map(s => s.id);
    const { data } = await supabase
      .from('order_items')
      .select('current_station_id')
      .in('current_station_id', stationIds)
      .in('station_status', ['waiting', 'in_progress']);

    const counts: Record<string, number> = {};
    for (const id of stationIds) counts[id] = 0;
    for (const row of data || []) {
      if (row.current_station_id) counts[row.current_station_id] = (counts[row.current_station_id] || 0) + 1;
    }

    let minCount = Infinity;
    let leastBusyId = assemblyStations[0].id;
    for (const id of stationIds) {
      if (counts[id] < minCount) { minCount = counts[id]; leastBusyId = id; }
    }
    return leastBusyId;
  };

  // Next station: sequential or smart based on routing_mode
  const getSmartNextStation = async (currentStationId: string, orderType?: string): Promise<{ id: string; type: string } | null> => {
    const currentStation = activeStations.find(s => s.id === currentStationId);
    if (!currentStation) return null;

    // ORDER_STATUS routing: depends on order_type
    if (currentStation.station_type === 'order_status') {
      if (orderType === 'dine_in') {
        const nextOrderStatus = orderStatusStations
          ?.filter(s => s.is_active && (s.sort_order ?? 0) > (currentStation.sort_order ?? 0))
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
        if (nextOrderStatus) return { id: nextOrderStatus.id, type: 'order_status' };
      }
      return null;
    }

    // SMART mode: special routing by station_type
    if (routingMode === 'smart') {
      if (currentStation.station_type === 'prep_start' || currentStation.is_edge_sector) {
        const prepId = await findLeastBusyPrepStation();
        if (prepId) return { id: prepId, type: 'item_assembly' };
        if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };
        return null;
      }
      if (currentStation.station_type === 'item_assembly') {
        // After assembly, go to next station (oven/dispatch) or order_status
        const next = getNextStation(currentStationId);
        if (next) return { id: next.id, type: next.station_type };
        if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };
        return null;
      }
    }

    // SEQUENTIAL mode (default): follow productionStations by sort_order
    const next = getNextStation(currentStationId);
    if (next) return { id: next.id, type: next.station_type };

    // Last production station → order_status or done
    if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };
    return null;
  };

  // Mover item diretamente para a próxima estação (clique único) - COM ROTEAMENTO INTELIGENTE
  const moveItemToNextStation = useMutation({
    mutationFn: async ({ itemId, currentStationId, orderType }: { itemId: string; currentStationId: string; orderType?: string }) => {
      const now = new Date().toISOString();
      
      // Smart routing with order_type awareness
      const target = await getSmartNextStation(currentStationId, orderType);
      const targetStationId = target?.id || null;

      if (targetStationId) {
        const { error } = await supabase
          .from('order_items')
          .update({
            current_station_id: targetStationId,
            station_status: 'waiting',
            station_started_at: null,
            station_completed_at: now,
          })
          .eq('id', itemId);

        if (error) throw error;
      } else {
        // No next station - mark as done
        const { error } = await supabase
          .from('order_items')
          .update({
            current_station_id: null,
            station_status: 'done',
            station_completed_at: now,
            status: 'delivered',
          })
          .eq('id', itemId);

        if (error) throw error;
      }

      // Logs em paralelo (fire-and-forget)
      Promise.all([
        logAction.mutateAsync({
          orderItemId: itemId,
          stationId: currentStationId,
          action: 'completed',
        }).catch(() => {}),
        targetStationId ? logAction.mutateAsync({
          orderItemId: itemId,
          stationId: targetStationId,
          action: 'entered',
        }).catch(() => {}) : Promise.resolve(),
      ]);

      // Check if order is ready
      if (!targetStationId || target?.type === 'order_status') {
        const { data: itemData } = await supabase
          .from('order_items')
          .select('order_id')
          .eq('id', itemId)
          .single();

        if (itemData?.order_id) {
          const { data: allItems } = await supabase
            .from('order_items')
            .select('id, current_station_id, station_status')
            .eq('order_id', itemData.order_id);

          const allItemsReady = allItems?.every(item => 
            (item.current_station_id && orderStatusStationIds.includes(item.current_station_id)) ||
            item.station_status === 'done'
          );
          
          if (allItemsReady) {
            const { error } = await supabase
              .from('orders')
              .update({ status: 'ready', ready_at: new Date().toISOString() })
              .eq('id', itemData.order_id);
              
            if (error) {
              console.error('Erro ao atualizar status do pedido para ready:', error);
            }
          }
        }
      }

      return { itemId, nextStationId: targetStationId, isComplete: !targetStationId };
    },
    
    // OPTIMISTIC UPDATE
    onMutate: async ({ itemId, currentStationId, orderType }) => {
      // Mark item as recently moved to prevent Realtime from reverting the optimistic update
      markItemAsRecentlyMoved(itemId);
      
      queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData(['orders']);
      
      // Calculate optimistic target based on station type and order_type
      const currentStation = activeStations.find(s => s.id === currentStationId);
      let targetStationId: string | null = null;
      
      if (currentStation?.station_type === 'order_status') {
        // For order_status stations, only dine_in goes to next order_status
        if (orderType === 'dine_in') {
          const nextOrderStatus = orderStatusStations
            ?.filter(s => s.is_active && (s.sort_order ?? 0) > (currentStation.sort_order ?? 0))
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
          targetStationId = nextOrderStatus?.id || null;
        }
        // delivery/takeaway → null (done)
      } else {
        const nextStation = getNextStation(currentStationId);
        targetStationId = nextStation?.id || orderStatusStation?.id || null;
      }
      
      queryClient.setQueryData(['orders'], (old: OrderData[] | undefined) => {
        if (!Array.isArray(old)) return old;
        return old.map(order => ({
          ...order,
          order_items: order.order_items?.map((item: OrderItem) => 
            item.id === itemId 
              ? { 
                  ...item, 
                  current_station_id: targetStationId, 
                  station_status: targetStationId ? 'waiting' : 'done',
                  station_started_at: null,
                }
              : item
          ) || []
        }));
      });
      
      return { previousOrders };
    },
    
    onError: (error, variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      toast.error('Erro ao mover item');
      console.error(error);
    },
    
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sector-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['oven-items'] });
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-history'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-logs'] });
      queryClient.invalidateQueries({ queryKey: ['kds-all-stations-metrics'] });
    },
  });

  // Iniciar item em uma praça (mantido para compatibilidade)
  const startItemAtStation = useMutation({
    mutationFn: async ({ itemId, stationId }: { itemId: string; stationId: string }) => {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('order_items')
        .update({
          current_station_id: stationId,
          station_status: 'in_progress',
          station_started_at: now,
        })
        .eq('id', itemId);

      if (error) throw error;

      // Log fire-and-forget
      logAction.mutateAsync({
        orderItemId: itemId,
        stationId,
        action: 'started',
      }).catch(() => {});

      return { itemId, stationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sector-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['oven-items'] });
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
    onError: (error) => {
      toast.error('Erro ao iniciar item na praça');
      console.error(error);
    },
  });

  // Completar item na praça atual e mover para próxima (mantido para compatibilidade)
  const completeItemAtStation = useMutation({
    mutationFn: async ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
      const now = new Date().toISOString();
      
      // Buscar dados do item para calcular duração
      const { data: item } = await supabase
        .from('order_items')
        .select('station_started_at')
        .eq('id', itemId)
        .single();

      const durationSeconds = item?.station_started_at 
        ? Math.floor((new Date().getTime() - new Date(item.station_started_at).getTime()) / 1000)
        : null;

      // Log fire-and-forget
      logAction.mutateAsync({
        orderItemId: itemId,
        stationId: currentStationId,
        action: 'completed',
        durationSeconds: durationSeconds || undefined,
      }).catch(() => {});

      // Buscar próxima praça
      const nextStation = getNextStation(currentStationId);

      if (nextStation) {
        // Mover para próxima praça
        const { error } = await supabase
          .from('order_items')
          .update({
            current_station_id: nextStation.id,
            station_status: 'waiting',
            station_started_at: null,
            station_completed_at: now,
          })
          .eq('id', itemId);

        if (error) throw error;

        // Log fire-and-forget
        logAction.mutateAsync({
          orderItemId: itemId,
          stationId: nextStation.id,
          action: 'entered',
        }).catch(() => {});

        return { itemId, nextStationId: nextStation.id, isComplete: false };
      } else {
        // Última praça de produção - marcar pedido como ready
        const { data: itemData } = await supabase
          .from('order_items')
          .select('order_id')
          .eq('id', itemId)
          .single();

        // Se tiver estação de status do pedido, mover o item para lá
        if (orderStatusStation) {
          const { error } = await supabase
            .from('order_items')
            .update({
              current_station_id: orderStatusStation.id,
              station_status: 'waiting',
              station_started_at: null,
              station_completed_at: now,
            })
            .eq('id', itemId);

          if (error) throw error;

          // Log fire-and-forget
          logAction.mutateAsync({
            orderItemId: itemId,
            stationId: orderStatusStation.id,
            action: 'entered',
          }).catch(() => {});
        } else {
          // Sem estação de status - marcar item como done diretamente
          const { error } = await supabase
            .from('order_items')
            .update({
              current_station_id: null,
              station_status: 'done',
              station_completed_at: now,
              status: 'delivered',
            })
            .eq('id', itemId);

          if (error) throw error;
        }

        // Verificar se todos os itens do pedido terminaram a produção
        if (itemData?.order_id) {
          const { data: allItems } = await supabase
            .from('order_items')
            .select('id, current_station_id, station_status')
            .eq('order_id', itemData.order_id);

          // Todos estão na estação order_status ou já finalizados
          const allItemsReady = allItems?.every(item => 
            (item.current_station_id && orderStatusStationIds.includes(item.current_station_id)) ||
            item.station_status === 'done'
          );

          if (allItemsReady) {
            // Atualizar pedido para 'ready'
            await supabase
              .from('orders')
              .update({ 
                status: 'ready',
                ready_at: new Date().toISOString()
              })
              .eq('id', itemData.order_id);
          }
        }

        return { itemId, nextStationId: orderStatusStation?.id || null, isComplete: !orderStatusStation };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sector-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['oven-items'] });
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-history'] });
    },
    onError: (error) => {
      toast.error('Erro ao completar item');
      console.error(error);
    },
  });

  // Pular item para próxima praça sem processar
  const skipItemToNextStation = useMutation({
    mutationFn: async ({ itemId, currentStationId, reason }: { itemId: string; currentStationId: string; reason?: string }) => {
      // Log de skip
      await logAction.mutateAsync({
        orderItemId: itemId,
        stationId: currentStationId,
        action: 'skipped',
        notes: reason,
      });

      const nextStation = getNextStation(currentStationId);

      if (nextStation) {
        const { error } = await supabase
          .from('order_items')
          .update({
            current_station_id: nextStation.id,
            station_status: 'waiting',
            station_started_at: null,
          })
          .eq('id', itemId);

        if (error) throw error;

        await logAction.mutateAsync({
          orderItemId: itemId,
          stationId: nextStation.id,
          action: 'entered',
        });
      }

      return { itemId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sector-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['oven-items'] });
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  // Servir um item individualmente (marcar como servido)
  const serveItem = useMutation({
    mutationFn: async (itemId: string) => {
      const now = new Date().toISOString();

      // Buscar dados do item para obter station_id
      const { data: itemData } = await supabase
        .from('order_items')
        .select('current_station_id')
        .eq('id', itemId)
        .single();

      const { error } = await supabase
        .from('order_items')
        .update({
          served_at: now,
        })
        .eq('id', itemId);

      if (error) throw error;

      // Registrar log de servido no histórico
      if (itemData?.current_station_id) {
        logAction.mutateAsync({
          orderItemId: itemId,
          stationId: itemData.current_station_id,
          action: 'completed',
          notes: 'Item servido',
        }).catch(() => {});
      }

      return { itemId, servedAt: now };
    },
    onMutate: (itemId) => {
      queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData(['orders']);
      
      // Optimistic update
      queryClient.setQueryData(['orders'], (old: OrderData[] | undefined) => {
        if (!Array.isArray(old)) return old;
        return old.map(order => ({
          ...order,
          order_items: order.order_items?.map((item: OrderItem) => 
            item.id === itemId 
              ? { ...item, served_at: new Date().toISOString() }
              : item
          ) || []
        }));
      });
      
      return { previousOrders };
    },
    onError: (error, variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      toast.error('Erro ao marcar item como servido');
      console.error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sector-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['oven-items'] });
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-logs'] });
      queryClient.invalidateQueries({ queryKey: ['kds-all-stations-metrics'] });
    },
  });

  // Finalizar pedido na estação de status (marcar como entregue ou mover para próximo despacho)
  const finalizeOrderFromStatus = useMutation({
    mutationFn: async ({ orderId, orderType, currentStationId }: { orderId: string; orderType?: string; currentStationId?: string }) => {
      const now = new Date().toISOString();

      // Se for dine_in, verificar se existe próxima estação order_status
      if (orderType === 'dine_in' && currentStationId) {
        const currentStation = activeStations.find(s => s.id === currentStationId);
        if (currentStation) {
          const nextOrderStatus = orderStatusStations
            ?.filter(s => s.is_active && s.station_type === 'order_status' && (s.sort_order ?? 0) > (currentStation.sort_order ?? 0))
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

          if (nextOrderStatus) {
            // Mover todos os itens para a próxima estação order_status
            const { data: items, error: fetchError } = await supabase
              .from('order_items')
              .select('id, current_station_id')
              .eq('order_id', orderId);

            if (fetchError) throw fetchError;

            await Promise.all((items || []).map(async (item) => {
              if (item.current_station_id) {
                logAction.mutateAsync({
                  orderItemId: item.id,
                  stationId: item.current_station_id,
                  action: 'completed',
                }).catch(() => {});
              }

              await supabase
                .from('order_items')
                .update({
                  current_station_id: nextOrderStatus.id,
                  station_status: 'waiting',
                  station_started_at: null,
                  station_completed_at: now,
                })
                .eq('id', item.id);

              logAction.mutateAsync({
                orderItemId: item.id,
                stationId: nextOrderStatus.id,
                action: 'entered',
              }).catch(() => {});
            }));

            return { orderId, movedToStation: nextOrderStatus.name };
          }
        }
      }

      // Comportamento padrão: finalizar como delivered (delivery/takeaway ou última estação)
      const { data: items, error: fetchError } = await supabase
        .from('order_items')
        .select('id, current_station_id, served_at')
        .eq('order_id', orderId);

      if (fetchError) throw fetchError;

      await Promise.all((items || []).map(async (item) => {
        if (item.current_station_id && orderStatusStationIds.includes(item.current_station_id)) {
          logAction.mutateAsync({
            orderItemId: item.id,
            stationId: item.current_station_id,
            action: 'completed',
          }).catch(() => {});
        }

        await supabase
          .from('order_items')
          .update({
            current_station_id: null,
            station_status: 'done',
            station_completed_at: now,
            status: 'delivered',
            served_at: item.served_at || now,
          })
          .eq('id', item.id);
      }));

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'delivered',
          delivered_at: now
        })
        .eq('id', orderId);

      if (error) throw error;

      return { orderId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sector-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['oven-items'] });
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-logs'] });
      queryClient.invalidateQueries({ queryKey: ['kds-all-stations-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-history'] });
    },
    onError: (error) => {
      toast.error('Erro ao finalizar pedido');
      console.error(error);
    },
  });

  // Iniciar novo pedido no modo linha de produção (sequencial simples)
  const initializeOrderForProductionLine = useMutation({
    mutationFn: async (orderId: string) => {
      if (activeStations.length === 0) throw new Error('Nenhuma praça ativa configurada');

      // Buscar itens do pedido sem estação atribuída
      const { data: items, error: fetchError } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderId)
        .is('current_station_id', null);

      if (fetchError) throw fetchError;

      // First active production station (excluding order_status)
      const productionStationsList = activeStations.filter(s => s.station_type !== 'order_status');
      if (productionStationsList.length === 0) throw new Error('Nenhuma praça de produção ativa');
      const firstStation = productionStationsList[0];

      for (const item of items || []) {
        await supabase
          .from('order_items')
          .update({
            current_station_id: firstStation.id,
            station_status: 'waiting',
            next_sector_id: null,
            has_edge: false,
          })
          .eq('id', item.id);

        await logAction.mutateAsync({
          orderItemId: item.id,
          stationId: firstStation.id,
          action: 'entered',
        }).catch(() => {});
      }

      // Atualizar status do pedido para preparing
      await supabase
        .from('orders')
        .update({ status: 'preparing' })
        .eq('id', orderId);

      return { orderId, itemCount: items?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sector-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['oven-items'] });
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
    onError: (error) => {
      toast.error('Erro ao iniciar pedido');
      console.error(error);
    },
  });

  // Helper para obter itens por praça
  const getItemsByStation = (items: OrderItem[], stationId: string) => {
    return items.filter(item => item.current_station_id === stationId);
  };

  // Helper para obter itens aguardando (sem praça atribuída)
  const getWaitingItems = (items: OrderItem[]) => {
    return items.filter(item => !item.current_station_id && item.station_status !== 'done');
  };

  return {
    moveItemToNextStation,
    startItemAtStation,
    completeItemAtStation,
    skipItemToNextStation,
    initializeOrderForProductionLine,
    finalizeOrderFromStatus,
    serveItem,
    getItemsByStation,
    getWaitingItems,
    orderStatusStation,
  };
}
