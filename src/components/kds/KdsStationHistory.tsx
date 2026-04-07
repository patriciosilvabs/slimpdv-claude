import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Clock, MapPin, ChevronDown, ChevronRight, Package, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

interface KdsStationHistoryProps {
  stationId: string;
  stationColor: string;
  tenantId?: string | null;
  deviceAuth?: { deviceId: string; tenantId: string | null; authCode: string } | null;
}

interface ExtraEntry {
  id: string;
  extra_name: string;
  kds_category: string;
  price: number;
}

interface OrderItemEntry {
  id: string;
  quantity: number;
  notes: string | null;
  product: { name: string } | null;
  variation: { name: string } | null;
  extras: ExtraEntry[];
}

interface OrderGroup {
  orderId: string;
  order_type: string;
  customer_name: string | null;
  customer_address: string | null;
  table_number: number | null;
  dispatched_at: string;
  items: OrderItemEntry[];
}

export function KdsStationHistory({ stationId, stationColor, tenantId, deviceAuth }: KdsStationHistoryProps) {
  const isDeviceMode = !!deviceAuth?.deviceId && !!deviceAuth?.tenantId && !!deviceAuth?.authCode;
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [cleared, setCleared] = useState(false);

  const { data: orderGroups = [], isLoading } = useQuery({
    queryKey: ['kds-station-history-grouped', stationId, isDeviceMode ? 'device' : 'user'],
    queryFn: async () => {
      if (isDeviceMode) {
        const { data, error } = await supabase.functions.invoke('kds-data', {
          body: {
            action: 'get_station_history_grouped',
            device_id: deviceAuth!.deviceId,
            tenant_id: deviceAuth!.tenantId,
            auth_code: deviceAuth!.authCode,
            station_id: stationId,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return (data?.orders || []) as OrderGroup[];
      }

      const { data: logs, error } = await supabase
        .from('kds_station_logs')
        .select(`
          id, action, created_at, order_item_id,
          order_item:order_items!kds_station_logs_order_item_id_fkey(order_id)
        `)
        .eq('station_id', stationId)
        .in('action', ['completed', 'marked_ready', 'dispatched'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const orderTimestamps: Record<string, string> = {};
      for (const log of (logs || [])) {
        const orderId = (log as any).order_item?.order_id;
        if (orderId && !orderTimestamps[orderId]) {
          orderTimestamps[orderId] = log.created_at;
        }
      }

      const orderIds = Object.keys(orderTimestamps);
      if (orderIds.length === 0) return [];

      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_type, customer_name, customer_address, table:tables(number)')
        .in('id', orderIds);

      const { data: allItems } = await supabase
        .from('order_items')
        .select('id, quantity, notes, order_id, product:products(name), variation:product_variations(name)')
        .in('order_id', orderIds)
        .neq('status', 'cancelled');

      const allItemIds = (allItems || []).map((i: any) => i.id);
      let extrasMap: Record<string, ExtraEntry[]> = {};
      if (allItemIds.length > 0) {
        const { data: extras } = await supabase
          .from('order_item_extras')
          .select('id, extra_name, kds_category, price, order_item_id')
          .in('order_item_id', allItemIds);

        for (const ex of (extras || []) as any[]) {
          if (!extrasMap[ex.order_item_id]) extrasMap[ex.order_item_id] = [];
          extrasMap[ex.order_item_id].push(ex);
        }
      }

      const ordersMap = (orders || []).reduce((acc: any, o: any) => { acc[o.id] = o; return acc; }, {});

      const groups: OrderGroup[] = orderIds
        .map(orderId => {
          const order = ordersMap[orderId];
          if (!order) return null;
          const orderItems = (allItems || [])
            .filter((i: any) => i.order_id === orderId)
            .map((i: any) => ({
              id: i.id, quantity: i.quantity, notes: i.notes,
              product: i.product, variation: i.variation,
              extras: extrasMap[i.id] || [],
            }));
          return {
            orderId, order_type: order.order_type,
            customer_name: order.customer_name, customer_address: order.customer_address,
            table_number: order.table?.number || null,
            dispatched_at: orderTimestamps[orderId], items: orderItems,
          } as OrderGroup;
        })
        .filter(Boolean) as OrderGroup[];

      groups.sort((a, b) => new Date(b.dispatched_at).getTime() - new Date(a.dispatched_at).getTime());
      return groups.slice(0, 20);
    },
    refetchInterval: 15000,
  });

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (cleared || orderGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2" />
        <p>{cleared ? 'Histórico limpo' : 'Nenhum histórico recente'}</p>
        {cleared && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCleared(false)}>
            Mostrar novamente
          </Button>
        )}
      </div>
    );
  }

  const getOrderLabel = (group: OrderGroup) => {
    if (group.order_type === 'delivery') return 'DELIVERY';
    if (group.order_type === 'takeaway') return 'BALCÃO';
    return `MESA ${group.table_number || '?'}`;
  };

  const getItemPreview = (items: OrderItemEntry[]) => {
    const preview = items.slice(0, 3).map(i => `${i.quantity}x ${i.product?.name || 'Produto'}`).join(' · ');
    const remaining = items.length - 3;
    return remaining > 0 ? `${preview} +${remaining}` : preview;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-sm font-semibold text-muted-foreground">Histórico</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setCleared(true)}>
          <Trash2 className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {orderGroups.map((group) => {
            const isExpanded = expandedOrders.has(group.orderId);
            const totalItems = group.items.reduce((sum, i) => sum + i.quantity, 0);

            return (
              <div key={group.orderId} className="bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
                <button
                  onClick={() => toggleOrder(group.orderId)}
                  className="w-full flex flex-col gap-1 p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 w-full">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                          {getOrderLabel(group)}
                        </Badge>
                        {group.customer_name && (
                          <span className="text-sm font-medium truncate">{group.customer_name}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          ({totalItems} {totalItems === 1 ? 'item' : 'itens'})
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(group.dispatched_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  {/* Item preview — always visible */}
                  <div className="ml-7 text-xs text-muted-foreground truncate">
                    {getItemPreview(group.items)}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-2">
                    {group.order_type === 'delivery' && group.customer_address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{group.customer_address}</span>
                      </div>
                    )}

                    {group.items.map((item) => {
                      const flavors = item.extras.filter(e => e.kds_category === 'flavor');
                      const borders = item.extras.filter(e => e.kds_category === 'border');
                      const complements = item.extras.filter(e => e.kds_category === 'complement');

                      return (
                        <div key={item.id} className="pl-2 border-l-2 border-primary/30">
                          <div className="flex items-center gap-2">
                            <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {item.quantity}x {item.product?.name || 'Produto'}
                            </span>
                            {item.variation?.name && (
                              <span className="text-xs text-muted-foreground">({item.variation.name})</span>
                            )}
                          </div>
                          {flavors.length > 0 && (
                            <div className="mt-0.5 ml-5 space-y-0.5">
                              {flavors.map(f => (
                                <div key={f.id} className="text-xs text-orange-600 dark:text-orange-400">🍕 {f.extra_name}</div>
                              ))}
                            </div>
                          )}
                          {borders.length > 0 && (
                            <div className="mt-0.5 ml-5 space-y-0.5">
                              {borders.map(b => (
                                <div key={b.id} className="text-xs text-amber-600 dark:text-amber-400">🔘 {b.extra_name}</div>
                              ))}
                            </div>
                          )}
                          {complements.length > 0 && (
                            <div className="mt-0.5 ml-5 space-y-0.5">
                              {complements.map(c => (
                                <div key={c.id} className="text-xs text-muted-foreground">➕ {c.extra_name}</div>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-0.5 ml-5 text-xs italic text-yellow-600 dark:text-yellow-400">📝 {item.notes}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
