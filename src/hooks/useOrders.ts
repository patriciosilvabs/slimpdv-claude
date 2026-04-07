import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useTenant } from './useTenant';

// Global set of item IDs recently moved via optimistic update — skip Realtime for these
const recentlyMovedItems = new Map<string, number>();

export function markItemAsRecentlyMoved(itemId: string) {
  recentlyMovedItems.set(itemId, Date.now());
  // Auto-cleanup after 5s
  setTimeout(() => recentlyMovedItems.delete(itemId), 5000);
}

function isRecentlyMoved(itemId: string): boolean {
  const ts = recentlyMovedItems.get(itemId);
  if (!ts) return false;
  if (Date.now() - ts > 5000) {
    recentlyMovedItems.delete(itemId);
    return false;
  }
  return true;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'delivering' | 'dispatched';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface OrderItemStation {
  id: string;
  name: string;
  station_type: string;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
}

export interface OrderItemSubExtra {
  id: string;
  group_name: string;
  option_name: string;
  price: number;
  quantity: number;
}

export interface OrderItemSubItem {
  id: string;
  sub_item_index: number;
  notes: string | null;
  sub_extras: OrderItemSubExtra[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variation_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  status: OrderStatus;
  created_at: string;
  added_by?: string | null;
  current_station_id?: string | null;
  station_status?: 'waiting' | 'in_progress' | 'in_oven' | 'ready' | 'dispatched' | 'completed' | 'done' | null;
  served_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  fulfillment_type?: 'takeaway' | 'delivery' | null;
  product?: { name: string; image_url: string | null; dispatch_keywords?: string[] | null };
  variation?: { name: string } | null;
  extras?: { extra_name: string; price: number; kds_category?: string }[] | null;
  current_station?: OrderItemStation | null;
  added_by_profile?: { name: string } | null;
  sub_items?: OrderItemSubItem[] | null;
}

export interface Order {
  id: string;
  table_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  party_size?: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ready_at?: string | null;
  served_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  status_before_cancellation?: OrderStatus | null;
  is_draft?: boolean;
  external_display_id?: string | null;
  external_source?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  pager_number?: string | null;
  service_fee?: number | null;
  additional_fee?: number | null;
  change_for?: number | null;
  fiscal_document?: string | null;
  display_number?: number | null;
  external_customer_id?: string | null;
  external_raw_payload?: unknown;
  delivery_fee?: number | null;
  scheduled_for?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  table?: { number: number } | null;
  order_items?: OrderItem[];
  created_by_profile?: { name: string } | null;
}



export function useOrders(status?: OrderStatus[]) {
  const queryClient = useQueryClient();
  // Stabilize status array reference to prevent infinite re-render loops
  const statusKey = status?.join(',');
  const stableStatus = useMemo(() => status, [statusKey]);

  const query = useQuery({
    queryKey: ['orders', stableStatus],
    // Poll every 10s — LocalSupabaseClient.channel() is a no-op so realtime events never fire;
    // polling ensures KDS and other pages stay up to date without manual refresh.
    refetchInterval: 15000,
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select(`
          *,
          table:tables(number),
          order_items(
            *,
            added_by,
            product:products(name, image_url, dispatch_keywords),
            variation:product_variations(name),
            extras:order_item_extras(extra_name, price, kds_category),
            current_station:kds_stations!order_items_current_station_id_fkey(id, name, station_type, color, icon, sort_order),
            sub_items:order_item_sub_items(id, sub_item_index, notes, sub_extras:order_item_sub_item_extras(id, group_name, option_name, price, quantity, kds_category))
          )
        `)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      
      if (stableStatus && stableStatus.length > 0) {
        q = q.in('status', stableStatus);
      }
      
      const { data: ordersData, error } = await q;
      if (error) throw error;
      console.log('[useOrders] queryFn received', ordersData?.length, 'orders, first order items count:', ordersData?.[0]?.order_items?.length ?? 'N/A');
      
      // Collect all user IDs (order creators + item adders)
      const createdByIds = ordersData?.map(o => o.created_by).filter(Boolean) as string[];
      const addedByIds = ordersData?.flatMap(o => 
        o.order_items?.map((item: { added_by?: string | null }) => item.added_by).filter(Boolean) || []
      ) as string[];
      
      const allUserIds = [...new Set([...createdByIds, ...addedByIds])];
      let profilesMap: Record<string, { name: string }> = {};
      
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', allUserIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { name: p.name };
            return acc;
          }, {} as Record<string, { name: string }>);
        }
      }
      
      // Merge profiles into orders and order items
      const ordersWithProfiles = ordersData?.map(order => {
        const orderItems = (order.order_items || []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          order_id: item.order_id as string,
          product_id: item.product_id as string | null,
          variation_id: item.variation_id as string | null,
          quantity: item.quantity as number,
          unit_price: item.unit_price as number,
          total_price: item.total_price as number,
          notes: item.notes as string | null,
          status: item.status as OrderStatus,
          created_at: item.created_at as string,
          added_by: item.added_by as string | null,
          current_station_id: item.current_station_id as string | null,
          station_status: item.station_status as OrderItem['station_status'],
          served_at: item.served_at as string | null,
          cancelled_at: item.cancelled_at as string | null,
          cancelled_by: item.cancelled_by as string | null,
          cancellation_reason: item.cancellation_reason as string | null,
          product: item.product as { name: string; image_url: string | null; dispatch_keywords?: string[] | null } | undefined,
          variation: item.variation as { name: string } | null,
          extras: item.extras as { extra_name: string; price: number; kds_category?: string }[] | null,
          current_station: item.current_station as OrderItemStation | null,
          added_by_profile: (item.added_by as string) ? profilesMap[item.added_by as string] || null : null,
          sub_items: item.sub_items as OrderItemSubItem[] | null,
          fulfillment_type: (item.fulfillment_type as 'takeaway' | 'delivery' | null) || null,
        })) as OrderItem[];

        return {
          id: order.id,
          table_id: order.table_id,
          order_type: order.order_type as OrderType,
          status: order.status as OrderStatus,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          subtotal: order.subtotal ?? 0,
          discount: order.discount ?? 0,
          total: order.total ?? 0,
          notes: order.notes,
          party_size: order.party_size,
          created_by: order.created_by,
          created_at: order.created_at ?? '',
          updated_at: order.updated_at ?? '',
          ready_at: order.ready_at,
          served_at: order.served_at,
          delivered_at: order.delivered_at,
          cancelled_at: order.cancelled_at,
          cancelled_by: order.cancelled_by,
          cancellation_reason: order.cancellation_reason,
          status_before_cancellation: order.status_before_cancellation as OrderStatus | null,
          is_draft: order.is_draft,
          external_source: order.external_source,
          external_display_id: order.external_display_id,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          pager_number: order.pager_number,
          service_fee: order.service_fee,
          additional_fee: order.additional_fee,
          change_for: order.change_for,
          fiscal_document: order.fiscal_document,
          external_customer_id: order.external_customer_id,
          external_raw_payload: order.external_raw_payload,
          delivery_fee: order.delivery_fee,
          delivery_lat: order.delivery_lat,
          delivery_lng: order.delivery_lng,
          table: (Array.isArray(order.table) ? order.table[0] : order.table) as { number: number } | null,
          order_items: orderItems,
          created_by_profile: order.created_by ? profilesMap[order.created_by] || null : null
        } as Order;
      }) || [];
      
      return ordersWithProfiles;
    },
  });

  // Debounced invalidation to prevent multiple rapid refetches
  const invalidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const debouncedInvalidate = useCallback(() => {
    if (invalidationTimeoutRef.current) {
      clearTimeout(invalidationTimeoutRef.current);
    }
    invalidationTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }, 500); // 500ms debounce
  }, [queryClient]);

  // Helper: does an order match the current view filters?
  const orderMatchesView = useCallback((order: Record<string, unknown>): boolean => {
    if (order.is_draft) return false;
    if (stableStatus && stableStatus.length > 0) {
      return stableStatus.includes(order.status as OrderStatus);
    }
    return true;
  }, [stableStatus]);

  // Immediate invalidation (no debounce) for critical visibility changes
  const immediateInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  useEffect(() => {
    const channelId = `orders-changes-${statusKey || 'all'}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as Record<string, unknown>;
        // Integration orders that arrive already active: immediate invalidation
        if (newOrder.external_source && !newOrder.is_draft && orderMatchesView(newOrder)) {
          immediateInvalidate();
        } else {
          debouncedInvalidate();
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => {
        debouncedInvalidate();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as Record<string, unknown>;
        const oldOrder = payload.old as Record<string, unknown>;

        // Detect draft release: is_draft went from true to false
        const isDraftRelease = oldOrder.is_draft === true && newOrder.is_draft === false;

        // Check if the order already exists in the current cache
        const currentCache = queryClient.getQueryData<Order[]>(['orders', stableStatus]);
        const existsInCache = currentCache?.some(o => o.id === newOrder.id);

        if (isDraftRelease || (!existsInCache && orderMatchesView(newOrder))) {
          // Order just became visible (draft released or now matches filters)
          // Immediate refetch to add it to the list
          immediateInvalidate();
          return;
        }

        if (existsInCache && !orderMatchesView(newOrder)) {
          // Order left the current filter — remove from cache
          const removeFn = (old: Order[] | undefined) => {
            if (!Array.isArray(old)) return old;
            return old.filter(order => order.id !== newOrder.id);
          };
          queryClient.setQueryData(['orders'], removeFn);
          queryClient.setQueryData(['orders', stableStatus], removeFn);
          return;
        }

        // Normal in-place update for orders already in cache
        queryClient.setQueryData(['orders'], (old: Order[] | undefined) => {
          if (!Array.isArray(old)) return old;
          return old.map(order => 
            order.id === newOrder.id 
              ? { ...order, ...newOrder }
              : order
          );
        });
        queryClient.setQueryData(['orders', stableStatus], (old: Order[] | undefined) => {
          if (!Array.isArray(old)) return old;
          return old.map(order => 
            order.id === newOrder.id 
              ? { ...order, ...newOrder }
              : order
          );
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, () => {
        debouncedInvalidate();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'order_items' }, () => {
        debouncedInvalidate();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, async (payload) => {
        // Direct cache update for item changes (most common operation in KDS)
        const updatedItem = payload.new as { 
          id: string; 
          current_station_id?: string | null; 
          station_status?: string; 
          status?: string;
          served_at?: string | null;
        };
        
        // Skip Realtime updates for items recently moved via optimistic update
        // to prevent the "disappear and reappear" loop
        if (isRecentlyMoved(updatedItem.id)) {
          return;
        }
        
        // Se mudou de estação, buscar dados completos da nova estação
        let currentStation: OrderItemStation | null = null;
        if (updatedItem.current_station_id) {
          const { data: stationData } = await supabase
            .from('kds_stations')
            .select('id, name, station_type, color, icon, sort_order')
            .eq('id', updatedItem.current_station_id)
            .maybeSingle();
          
          if (stationData) {
            currentStation = stationData as OrderItemStation;
          }
        }
        
        // Função para atualizar cache com dados completos
        const updateFn = (old: Order[] | undefined) => {
          if (!Array.isArray(old)) return old;
          return old.map(order => ({
            ...order,
            order_items: order.order_items?.map((item: OrderItem) => 
              item.id === updatedItem.id 
                ? { 
                    ...item, 
                    ...updatedItem,
                    current_station: currentStation 
                  }
                : item
            )
          }));
        };
        
        queryClient.setQueryData(['orders'], updateFn);
        queryClient.setQueryData(['orders', stableStatus], updateFn);
      })
      .subscribe();

    return () => {
      if (invalidationTimeoutRef.current) {
        clearTimeout(invalidationTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient, debouncedInvalidate, immediateInvalidate, orderMatchesView, stableStatus, statusKey]);

  return query;
}

export function useOrderMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createOrder = useMutation({
    mutationFn: async (order: Partial<Order>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data: userData } = await supabase.auth.getUser();
      // Strip client-only fields before sending to DB
      const { table, order_items, created_by_profile, external_raw_payload, ...dbOrder } = order;
      const { data, error } = await supabase
        .from('orders')
        .insert({ ...dbOrder, created_by: userData.user?.id, tenant_id: tenantId } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast({ title: 'Pedido criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar pedido', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...order }: Partial<Order> & { id: string }) => {
      const { table, order_items, created_by_profile, external_raw_payload, ...dbOrder } = order;
      const { data, error } = await supabase
        .from('orders')
        .update(dbOrder as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar pedido', description: error.message, variant: 'destructive' });
    },
  });

  const addOrderItem = useMutation({
    mutationFn: async (item: Omit<OrderItem, 'id' | 'created_at' | 'product' | 'added_by' | 'added_by_profile'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      // Obter usuário atual para registrar quem adicionou o item
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;
      
      console.log('[addOrderItem] Inserindo item com added_by:', userId);
      
      const { data, error } = await supabase
        .from('order_items')
        .insert({ 
          ...item, 
          added_by: userId,
          tenant_id: tenantId
        })
        .select()
        .single();
      
      if (error) throw error;

      // Update order totals
      const { data: items } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', item.order_id);
      
      const subtotal = items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
      
      await supabase
        .from('orders')
        .update({ subtotal, total: subtotal })
        .eq('id', item.order_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar item', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrderItem = useMutation({
    mutationFn: async ({ id, order_id, ...item }: Partial<OrderItem> & { id: string; order_id: string }) => {
      const { data, error } = await supabase
        .from('order_items')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Update order totals
      const { data: items } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', order_id);
      
      const subtotal = items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
      
      await supabase
        .from('orders')
        .update({ subtotal, total: subtotal })
        .eq('id', order_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const deleteOrderItem = useMutation({
    mutationFn: async ({ id, order_id }: { id: string; order_id: string }) => {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;

      // Update order totals
      const { data: items } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', order_id);
      
      const subtotal = items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
      
      await supabase
        .from('orders')
        .update({ subtotal, total: subtotal })
        .eq('id', order_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const addOrderItemExtras = useMutation({
    mutationFn: async (extras: { order_item_id: string; extra_name: string; price: number; extra_id?: string | null; kds_category?: string }[]) => {
      if (extras.length === 0) return [];
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const extrasWithTenant = extras.map(e => ({ ...e, tenant_id: tenantId }));
      
      const { data, error } = await supabase
        .from('order_item_extras')
        .insert(extrasWithTenant)
        .select();
      
      if (error) throw error;

      // Reroute item if border detected after extras insertion
      const itemId = extras[0]?.order_item_id;
      if (itemId) {
        await supabase.rpc('reroute_item_if_border', { _item_id: itemId });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar complementos', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation para adicionar sub-items (pizzas individuais de um combo)
  const addOrderItemSubItems = useMutation({
    mutationFn: async (params: {
      order_item_id: string;
      sub_items: {
        sub_item_index: number;
        notes?: string | null;
        extras: {
          group_id?: string | null;
          group_name: string;
          option_id?: string | null;
          option_name: string;
          price: number;
          quantity: number;
        }[];
      }[];
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      if (params.sub_items.length === 0) return [];

      // 1. Inserir os sub-items
      const subItemsToInsert = params.sub_items.map(si => ({
        order_item_id: params.order_item_id,
        sub_item_index: si.sub_item_index,
        notes: si.notes || null,
        tenant_id: tenantId,
      }));

      const { data: insertedSubItems, error: subItemsError } = await supabase
        .from('order_item_sub_items')
        .insert(subItemsToInsert)
        .select();

      if (subItemsError) throw subItemsError;
      if (!insertedSubItems) throw new Error('Falha ao inserir sub-items');

      // 2. Inserir os extras de cada sub-item
      const extrasToInsert: {
        sub_item_id: string;
        group_id: string | null;
        group_name: string;
        option_id: string | null;
        option_name: string;
        price: number;
        quantity: number;
        tenant_id: string;
        kds_category: string;
      }[] = [];

      for (const insertedSubItem of insertedSubItems) {
        const originalSubItem = params.sub_items.find(
          si => si.sub_item_index === insertedSubItem.sub_item_index
        );
        if (originalSubItem && originalSubItem.extras.length > 0) {
          for (const extra of originalSubItem.extras) {
            extrasToInsert.push({
              sub_item_id: insertedSubItem.id,
              group_id: extra.group_id || null,
              group_name: extra.group_name,
              option_id: extra.option_id || null,
              option_name: extra.option_name,
              price: extra.price,
              quantity: extra.quantity,
              tenant_id: tenantId,
              kds_category: (extra as any).kds_category || 'complement',
            });
          }
        }
      }

      if (extrasToInsert.length > 0) {
        const { error: extrasError } = await supabase
          .from('order_item_sub_item_extras')
          .insert(extrasToInsert);

        if (extrasError) throw extrasError;
      }

      // Reroute item if border detected after sub-item extras insertion
      await supabase.rpc('reroute_item_if_border', { _item_id: params.order_item_id });

      return insertedSubItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar sub-items', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation para cancelar item individual
  const cancelOrderItem = useMutation({
    mutationFn: async (params: {
      itemId: string;
      orderId: string;
      reason: string;
      cancelledBy: string;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // 1. Buscar dados completos do item para auditoria (incluindo status para verificar se estava em produção)
      const { data: item, error: itemError } = await supabase
        .from('order_items')
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          station_status,
          served_at,
          current_station_id,
          notes,
          product:products(name),
          variation:product_variations(name),
          extras:order_item_extras(extra_name, price),
          sub_items:order_item_sub_items(id, sub_item_index, notes, sub_extras:order_item_sub_item_extras(option_name))
        `)
        .eq('id', params.itemId)
        .single();
      
      if (itemError) throw itemError;

      // 2. Buscar dados do pedido para auditoria
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          subtotal,
          total,
          discount,
          order_type,
          customer_name,
          table_id,
          table:tables(number)
        `)
        .eq('id', params.orderId)
        .single();

      if (orderError) throw orderError;

      // 3. Marcar item como cancelado
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          status: 'cancelled' as any,
          cancelled_at: new Date().toISOString(),
          cancelled_by: params.cancelledBy,
          cancellation_reason: params.reason,
          current_station_id: null,
          station_status: null
        })
        .eq('id', params.itemId);

      if (updateError) throw updateError;

      // 4. Criar registro de auditoria
      const { error: auditError } = await supabase
        .from('order_item_cancellations')
        .insert({
          order_item_id: params.itemId,
          order_id: params.orderId,
          table_id: order?.table_id || null,
          product_name: (item?.product as any)?.name || 'Produto',
          variation_name: (item?.variation as any)?.name || null,
          quantity: item?.quantity || 1,
          unit_price: item?.unit_price || 0,
          total_price: item?.total_price || 0,
          order_type: order?.order_type || null,
          table_number: (order?.table as any)?.number || null,
          customer_name: order?.customer_name || null,
          cancellation_reason: params.reason,
          cancelled_by: params.cancelledBy,
          tenant_id: tenantId
        });

      if (auditError) {
        console.error('Erro ao criar registro de auditoria:', auditError);
        // Não lançamos erro aqui para não impedir o cancelamento
      }

      // 5. Atualizar total do pedido (subtrair valor do item)
      if (order && item) {
        const newSubtotal = (order.subtotal || 0) - item.total_price;
        const newTotal = newSubtotal - (order.discount || 0);
        
        await supabase
          .from('orders')
          .update({
            subtotal: newSubtotal,
            total: newTotal
          })
          .eq('id', params.orderId);
      }

      // Determinar se o item estava em produção (não estava pronto/servido)
      const wasInProduction = item?.station_status !== 'done' && !item?.served_at;

      return { 
        success: true, 
        wasInProduction,
        itemData: {
          productName: (item?.product as any)?.name || 'Produto',
          variationName: (item?.variation as any)?.name || null,
          quantity: item?.quantity || 1,
          notes: item?.notes || null,
          extras: item?.extras as { extra_name: string; price: number }[] | null,
          subItems: item?.sub_items as { id: string; sub_item_index: number; notes: string | null; sub_extras: { option_name: string }[] }[] | null,
        },
        orderData: {
          orderType: order?.order_type || 'dine_in',
          tableNumber: (order?.table as any)?.number || null,
          customerName: order?.customer_name || null
        }
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Item cancelado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cancelar item', description: error.message, variant: 'destructive' });
    },
  });

  // Batch mutation: insert all items, extras and sub-items in parallel, recalculate total once
  const addOrderItemsBatch = useMutation({
    mutationFn: async (params: {
      order_id: string;
      items: {
        product_id: string;
        variation_id?: string | null;
        quantity: number;
        unit_price: number;
        total_price: number;
        notes?: string | null;
        status: OrderStatus;
        complements?: { group_name: string; option_name: string; option_id?: string; price: number; quantity: number; kds_category?: string }[];
        subItems?: {
          sub_item_index: number;
          notes?: string | null;
          extras: {
            group_id?: string | null;
            group_name: string;
            option_id?: string | null;
            option_name: string;
            price: number;
            quantity: number;
            kds_category?: string;
          }[];
        }[];
      }[];
      keepDraft?: boolean;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;

      // 1. Batch insert all order_items at once
      const itemsToInsert = params.items.map(item => ({
        order_id: params.order_id,
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        notes: item.notes || null,
        status: item.status,
        added_by: userId,
        tenant_id: tenantId,
      }));

      const { data: insertedItems, error: insertError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)
        .select();

      if (insertError) throw insertError;
      if (!insertedItems) throw new Error('Failed to insert items');

      // 2. Flip is_draft so KDS sees the order (unless keepDraft is true)
      if (!params.keepDraft) {
        await supabase
          .from('orders')
          .update({ is_draft: false })
          .eq('id', params.order_id);
      }

      // 3. In parallel: insert all extras, sub-items, and reroute borders
      const parallelOps: Promise<unknown>[] = [];

      for (let idx = 0; idx < insertedItems.length; idx++) {
        const dbItem = insertedItems[idx];
        const srcItem = params.items[idx];

        // Extras (complements)
        if (srcItem.complements && srcItem.complements.length > 0) {
          const extras = srcItem.complements.map(c => ({
            order_item_id: dbItem.id,
            extra_name: `${c.group_name}: ${c.option_name}`,
            price: c.price * c.quantity,
            extra_id: c.option_id || null,
            kds_category: c.kds_category || 'complement',
            tenant_id: tenantId,
          }));
          parallelOps.push(
            (async () => {
              await supabase.from('order_item_extras').insert(extras);
              await supabase.rpc('reroute_item_if_border', { _item_id: dbItem.id });
            })()
          );
        }

        // Sub-items
        if (srcItem.subItems && srcItem.subItems.length > 0) {
          parallelOps.push((async () => {
            const subItemsToInsert = srcItem.subItems!.map(si => ({
              order_item_id: dbItem.id,
              sub_item_index: si.sub_item_index,
              notes: si.notes || null,
              tenant_id: tenantId,
            }));
            const { data: insertedSubItems, error: subError } = await supabase
              .from('order_item_sub_items')
              .insert(subItemsToInsert)
              .select();
            if (subError) { console.error('sub_items insert error', subError); return; }
            if (!insertedSubItems) return;

            const extrasToInsert: any[] = [];
            for (const insertedSub of insertedSubItems) {
              const origSub = srcItem.subItems!.find(s => s.sub_item_index === insertedSub.sub_item_index);
              if (origSub) {
                for (const ex of origSub.extras) {
                  extrasToInsert.push({
                    sub_item_id: insertedSub.id,
                    group_id: ex.group_id || null,
                    group_name: ex.group_name,
                    option_id: ex.option_id || null,
                    option_name: ex.option_name,
                    price: ex.price,
                    quantity: ex.quantity,
                    tenant_id: tenantId,
                    kds_category: ex.kds_category || 'complement',
                  });
                }
              }
            }
            if (extrasToInsert.length > 0) {
              await supabase.from('order_item_sub_item_extras').insert(extrasToInsert);
            }
            await supabase.rpc('reroute_item_if_border', { _item_id: dbItem.id });
          })());
        }
      }

      await Promise.all(parallelOps);

      // 4. Recalculate order total once
      const { data: allItems } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', params.order_id);
      const subtotal = allItems?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
      await supabase
        .from('orders')
        .update({ subtotal, total: subtotal })
        .eq('id', params.order_id);

      return insertedItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar itens', description: error.message, variant: 'destructive' });
    },
  });

  return { createOrder, updateOrder, addOrderItem, addOrderItemExtras, addOrderItemSubItems, updateOrderItem, deleteOrderItem, cancelOrderItem, addOrderItemsBatch };
}