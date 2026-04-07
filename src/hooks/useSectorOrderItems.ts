import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useEffect, useRef, useCallback, useMemo } from 'react';

export interface SectorOrderItemSubExtra {
  group_name: string;
  option_name: string;
  kds_category: string;
}

export interface SectorOrderItemSubItem {
  id: string;
  sub_item_index: number;
  notes: string | null;
  sub_extras: SectorOrderItemSubExtra[];
}

export interface SectorOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variation_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  status: string;
  station_status: string;
  current_station_id: string | null;
  next_sector_id: string | null;
  has_edge: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  oven_entry_at: string | null;
  estimated_exit_at: string | null;
  ready_at: string | null;
  station_started_at: string | null;
  fulfillment_type: string | null;
  created_at: string;
  tenant_id: string;
  order: {
    id: string;
    customer_name: string | null;
    status: string | null;
    order_type: string;
    table_id: string | null;
    party_size: number | null;
    created_at: string;
    notes: string | null;
    external_display_id: string | null;
    pager_number: string | null;
    display_number: number | null;
    table: { number: number } | null;
  } | null;
  product: {
    id: string;
    name: string;
  } | null;
  variation: {
    id: string;
    name: string;
  } | null;
  extras: Array<{
    id: string;
    extra_name: string;
    price: number;
    kds_category: string;
  }>;
  sub_items: SectorOrderItemSubItem[];
}

interface UseSectorOrderItemsOptions {
  sectorId: string | null;
  statuses?: string[];
  displayedItemKinds?: string[];
}

const ORDER_ITEMS_SELECT = `
  *,
  order:orders!order_items_order_id_fkey(id, customer_name, status, order_type, table_id, party_size, created_at, notes, external_display_id, pager_number, display_number, table:tables(number)),
  product:products(id, name),
  variation:product_variations(id, name),
  extras:order_item_extras(id, extra_name, price, kds_category),
  sub_items:order_item_sub_items(id, sub_item_index, notes, sub_extras:order_item_sub_item_extras(group_name, option_name, kds_category))
`;

function mapItems(data: any[]): SectorOrderItem[] {
  return data.map(item => ({
    ...item,
    order: item.order as SectorOrderItem['order'],
    product: item.product as SectorOrderItem['product'],
    variation: item.variation as SectorOrderItem['variation'],
    extras: (item.extras || []) as SectorOrderItem['extras'],
    sub_items: (item.sub_items || []) as SectorOrderItem['sub_items'],
  }));
}

// Debounced realtime invalidation — coalesces rapid events
function useDebouncedInvalidation(queryKey: string[], delay = 300) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stabilize queryKey reference
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;

  const invalidate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: keyRef.current });
    }, delay);
  }, [queryClient, delay]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return invalidate;
}

export function useSectorOrderItems({ sectorId, statuses = ['waiting', 'in_progress'], displayedItemKinds }: UseSectorOrderItemsOptions) {
  const { tenantId } = useTenant();
  const invalidate = useDebouncedInvalidation(['sector-order-items']);

  // Subscribe to realtime — filter by tenant to reduce noise
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`kds-sector-${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        invalidate();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, invalidate]);

  return useQuery({
    queryKey: ['sector-order-items', sectorId, statuses, tenantId],
    queryFn: async (): Promise<SectorOrderItem[]> => {
      if (!sectorId || !tenantId) return [];

      const { data, error } = await supabase
        .from('order_items')
        .select(ORDER_ITEMS_SELECT)
        .eq('current_station_id', sectorId)
        .in('station_status', statuses)
        .eq('tenant_id', tenantId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (error) throw error;
      let items = mapItems(data || []);
      // Filter by displayed_item_kinds if configured
      if (displayedItemKinds && displayedItemKinds.length > 0) {
        items = items.filter(item => {
          const kind = (item as any).item_kind as string | null;
          return kind ? displayedItemKinds.includes(kind) : true;
        });
      }
      return items;
    },
    placeholderData: keepPreviousData,
    staleTime: 1_000,
    refetchInterval: 15_000,
  });
}

// Buscar itens no forno
export function useOvenItems() {
  const { tenantId } = useTenant();
  const invalidate = useDebouncedInvalidation(['oven-items']);

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`kds-oven-${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        invalidate();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, invalidate]);

  return useQuery({
    queryKey: ['oven-items', tenantId],
    queryFn: async (): Promise<SectorOrderItem[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('order_items')
        .select(ORDER_ITEMS_SELECT)
        .in('station_status', ['in_oven', 'ready'])
        .eq('tenant_id', tenantId)
        .neq('status', 'cancelled')
        .order('estimated_exit_at', { ascending: true });

      if (error) throw error;
      return mapItems(data || []);
    },
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
    staleTime: 1_000,
    refetchInterval: 15_000,
  });
}

// Buscar itens "irmãos" de um pedido que ainda não estão prontos
export function useOrderSiblingItems(orderIds: string[], tenantIdOverride?: string | null) {
  const { tenantId: contextTenantId } = useTenant();
  const tenantId = tenantIdOverride || contextTenantId;
  // Stabilize orderIds to avoid unnecessary refetches
  const stableOrderIds = useMemo(() => orderIds, [JSON.stringify(orderIds)]);

  const query = useQuery({
    queryKey: ['sibling-items', stableOrderIds, tenantId],
    queryFn: async (): Promise<SectorOrderItem[]> => {
      if (!tenantId || stableOrderIds.length === 0) return [];

      const { data, error } = await supabase
        .from('order_items')
        .select(ORDER_ITEMS_SELECT)
        .in('order_id', stableOrderIds)
        .not('station_status', 'in', '(in_oven,ready,done,dispatched)')
        .neq('status', 'cancelled')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return mapItems(data || []);
    },
    enabled: !!tenantId && stableOrderIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 2_000,
    refetchInterval: 15_000,
  });

  return {
    ...query,
    data: query.data ?? [],
  };
}

// Buscar TODOS os itens não cancelados de um pedido (para verificar se todos estão prontos)
export function useOrderAllItems(orderIds: string[], tenantIdOverride?: string | null) {
  const { tenantId: contextTenantId } = useTenant();
  const tenantId = tenantIdOverride || contextTenantId;
  const stableOrderIds = useMemo(() => orderIds, [JSON.stringify(orderIds)]);

  const query = useQuery({
    queryKey: ['order-all-items', stableOrderIds, tenantId],
    queryFn: async (): Promise<SectorOrderItem[]> => {
      if (!tenantId || stableOrderIds.length === 0) return [];

      const { data, error } = await supabase
        .from('order_items')
        .select(ORDER_ITEMS_SELECT)
        .in('order_id', stableOrderIds)
        .neq('status', 'cancelled')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return mapItems(data || []);
    },
    enabled: !!tenantId && stableOrderIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 2_000,
    refetchInterval: 15_000,
  });

  return {
    ...query,
    data: query.data ?? [],
  };
}
