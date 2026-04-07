import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useKdsStations } from '@/hooks/useKdsStations';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { getBadgeColorClasses } from '@/lib/badgeColors';
import { KdsSlaIndicator } from './KdsSlaIndicator';
import { cn } from '@/lib/utils';
import { Factory, Circle, CheckCircle, Package, Clock, XCircle, CheckCheck } from 'lucide-react';
import { differenceInMinutes, isToday, format } from 'date-fns';
import type { Order as UseOrdersOrder } from '@/hooks/useOrders';
import { useState, useEffect } from 'react';
import { useDispatchChecklist } from '@/hooks/useDispatchChecklist';
import { DispatchChecklistDialog } from '@/components/dispatch/DispatchChecklistDialog';
interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  notes: string | null;
  status: string;
  current_station_id?: string | null;
  station_status?: string;
  station_started_at?: string | null;
  created_at: string;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number; kds_category?: string }>;
  added_by_profile?: { name: string } | null;
  sub_items?: Array<{ id: string; sub_item_index: number; notes: string | null; sub_extras?: Array<{ group_name: string; option_name: string; kds_category?: string }> }> | null;
}

interface Order {
  id: string;
  status: string;
  customer_name: string | null;
  table?: { number: number } | null;
  order_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ready_at?: string | null;
  delivered_at?: string | null;
  total?: number | null;
  order_items?: OrderItem[];
}

interface KdsProductionLineReadOnlyProps {
  orders: UseOrdersOrder[];
  isLoading: boolean;
  onMarkDelivered?: (orderId: string) => void;
  onCancelOrder?: (order: Order) => void;
  isMarkingDelivered?: boolean;
}

// Timer component for station time
function StationTimer({ 
  startedAt, 
  createdAt,
  greenMinutes = 5,
  yellowMinutes = 10
}: { 
  startedAt?: string | null; 
  createdAt: string;
  greenMinutes?: number;
  yellowMinutes?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  
  const referenceTime = startedAt || createdAt;
  
  useEffect(() => {
    if (!referenceTime) return;
    
    const updateElapsed = () => {
      const minutes = differenceInMinutes(new Date(), new Date(referenceTime));
      setElapsed(Math.max(0, minutes));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [referenceTime]);
  
  const colorClass = elapsed < greenMinutes 
    ? 'text-green-600 bg-green-500/10' 
    : elapsed < yellowMinutes 
      ? 'text-yellow-600 bg-yellow-500/10' 
      : 'text-red-600 bg-red-500/10';
  
  return (
    <div className={cn("inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded", colorClass)}>
      <Clock className="h-3 w-3" />
      <span>{elapsed}min</span>
    </div>
  );
}

// Read-only item card component
function ReadOnlyItemCard({
  order,
  items,
  stationColor,
  settings,
}: {
  order: Order;
  items: OrderItem[];
  stationColor: string;
  settings: { timerGreenMinutes: number; timerYellowMinutes: number; showWaiterName: boolean; borderBadgeColor: string; notesBadgeColor: string };
}) {
  const borderColors = getBadgeColorClasses(settings.borderBadgeColor);
  const notesColors = getBadgeColorClasses(settings.notesBadgeColor);
  
  // Obter o primeiro garçom dos itens para exibir no cabeçalho
  const waiterName = items.find(i => i.added_by_profile?.name)?.added_by_profile?.name;
  
  const getOrderOriginLabel = () => {
    if (order.order_type === 'delivery') return 'DELIVERY';
    if (order.order_type === 'takeaway') return 'BALCÃO';
    return `MESA ${order.table?.number || '?'}`;
  };

  const getFlavors = (item: OrderItem): string[] => {
    const extras = item.extras;
    if (extras && extras.length > 0) {
      const flavorExtras = extras.filter(e => e.kds_category === 'flavor');
      if (flavorExtras.length > 0) {
        return flavorExtras.map(e => {
          const parts = e.extra_name.split(':');
          return parts.length > 1 ? parts[1].trim() : e.extra_name;
        });
      }
      const fallback = extras.filter(e => {
        const lower = e.extra_name.toLowerCase();
        return lower.includes('sabor') && !lower.includes('borda') && !lower.includes('massa');
      });
      if (fallback.length > 0) {
        return fallback.map(e => {
          const parts = e.extra_name.split(':');
          return parts.length > 1 ? parts[1].trim() : e.extra_name;
        });
      }
    }
    // Fallback: sub_items
    if (item.sub_items && item.sub_items.length > 0) {
      const totalSubs = item.sub_items.length;
      const flavors: string[] = [];
      for (const si of item.sub_items) {
        for (const se of si.sub_extras || []) {
          if (se.kds_category === 'flavor') {
            flavors.push(totalSubs > 1 ? `1/${totalSubs} ${se.option_name}` : se.option_name);
          }
        }
      }
      if (flavors.length > 0) return flavors;
      if (totalSubs > 1) {
        for (const si of item.sub_items) {
          const firstExtra = (si.sub_extras || [])[0];
          if (firstExtra) {
            flavors.push(`1/${totalSubs} ${firstExtra.option_name}`);
          }
        }
        if (flavors.length > 0) return flavors;
      }
    }
    return [];
  };

  // Extrair informação da borda dos extras usando kds_category
  const getBorderInfo = (extras?: Array<{ extra_name: string; kds_category?: string }>): string | null => {
    if (!extras || extras.length === 0) return null;
    
    // Primeiro por kds_category
    const borderExtra = extras.find(e => e.kds_category === 'border');
    
    // Fallback: por texto
    const fallbackExtra = !borderExtra ? extras.find(e => {
      const lower = e.extra_name.toLowerCase();
      return lower.includes('borda') || lower.includes('massa');
    }) : null;
    
    const selectedExtra = borderExtra || fallbackExtra;
    if (!selectedExtra) return null;
    
    const parts = selectedExtra.extra_name.split(':');
    return parts.length > 1 ? parts[1].trim() : selectedExtra.extra_name;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader 
        className="pb-2 pt-3 px-3"
        style={{ borderTop: `3px solid ${stationColor}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={order.order_type === 'delivery' ? 'default' : 'secondary'} className="text-xs">
              {getOrderOriginLabel()}
            </Badge>
            {settings.showWaiterName && waiterName && (
              <span className="text-xs text-blue-600">👤 {waiterName}</span>
            )}
            <span className="text-xs font-mono text-muted-foreground">
              #{order.id.slice(-4).toUpperCase()}
            </span>
          </div>
          <KdsSlaIndicator createdAt={order.created_at} size="sm" showBackground />
        </div>
        {order.customer_name && (
          <p className="text-xs text-primary font-medium mt-1">{order.customer_name}</p>
        )}
      </CardHeader>
      
      <CardContent className="px-3 pb-3 space-y-2">
        {items.map((item) => {
           const flavors = getFlavors(item);
          const borderInfo = getBorderInfo(item.extras);
          return (
            <div key={item.id} className="p-2 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-primary">{item.quantity}x</span>
                <span className="font-medium text-sm truncate">{item.product?.name || 'Produto'}</span>
                {item.variation?.name && (
                  <span className="text-xs text-muted-foreground">({item.variation.name})</span>
                )}
              </div>
              {/* BORDA - SEMPRE pisca */}
              {borderInfo && (
                <div className="mt-1">
                  <span className="inline-flex px-2 py-0.5 rounded font-bold text-xs relative overflow-hidden animate-pulse">
                    <span className={cn("absolute inset-0", borderColors.bg)}></span>
                    <span className={cn("relative z-10", borderColors.text)}>🟡 {borderInfo}</span>
                  </span>
                </div>
              )}
              {flavors.length > 0 && (
                <div className="text-xs text-blue-600 mt-0.5">
                  {flavors.map((f, i) => (
                    <p key={i}>🍕 {f}</p>
                  ))}
                </div>
              )}
              {/* OBSERVAÇÕES - SEMPRE pisca */}
              {item.notes && (
                <div className="mt-1">
                  <span className="inline-flex px-2 py-0.5 rounded font-bold text-xs relative overflow-hidden animate-pulse">
                    <span className={cn("absolute inset-0", notesColors.bg)}></span>
                    <span className={cn("relative z-10", notesColors.text)}>📝 {item.notes}</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Ready order card with action buttons
function ReadyOrderCard({
  order,
  items,
  stationColor,
  settings,
  onMarkDelivered,
  onCancelOrder,
  isMarkingDelivered,
}: {
  order: Order;
  items: OrderItem[];
  stationColor: string;
  settings: { timerGreenMinutes: number; timerYellowMinutes: number; showWaiterName: boolean; borderBadgeColor: string; notesBadgeColor: string };
  onMarkDelivered?: (orderId: string) => void;
  onCancelOrder?: (order: Order) => void;
  isMarkingDelivered?: boolean;
}) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const checklist = useDispatchChecklist(order.id);
  const borderColors = getBadgeColorClasses(settings.borderBadgeColor);
  const notesColors = getBadgeColorClasses(settings.notesBadgeColor);
  
  // Obter o primeiro garçom dos itens para exibir no cabeçalho
  const waiterName = items.find(i => i.added_by_profile?.name)?.added_by_profile?.name;
  
  const getOrderOriginLabel = () => {
    if (order.order_type === 'delivery') return 'DELIVERY';
    if (order.order_type === 'takeaway') return 'BALCÃO';
    return `MESA ${order.table?.number || '?'}`;
  };

  const canMarkDelivered = order.order_type === 'takeaway' && order.status === 'ready';

  const getFlavors = (item: OrderItem): string[] => {
    const extras = item.extras;
    if (extras && extras.length > 0) {
      const flavorExtras = extras.filter(e => e.kds_category === 'flavor');
      if (flavorExtras.length > 0) {
        return flavorExtras.map(e => {
          const parts = e.extra_name.split(':');
          return parts.length > 1 ? parts[1].trim() : e.extra_name;
        });
      }
      const fallback = extras.filter(e => {
        const lower = e.extra_name.toLowerCase();
        return lower.includes('sabor') && !lower.includes('borda') && !lower.includes('massa');
      });
      if (fallback.length > 0) {
        return fallback.map(e => {
          const parts = e.extra_name.split(':');
          return parts.length > 1 ? parts[1].trim() : e.extra_name;
        });
      }
    }
    if (item.sub_items && item.sub_items.length > 0) {
      const totalSubs = item.sub_items.length;
      const flavors: string[] = [];
      for (const si of item.sub_items) {
        for (const se of si.sub_extras || []) {
          if (se.kds_category === 'flavor') {
            flavors.push(totalSubs > 1 ? `1/${totalSubs} ${se.option_name}` : se.option_name);
          }
        }
      }
      if (flavors.length > 0) return flavors;
      if (totalSubs > 1) {
        for (const si of item.sub_items) {
          const firstExtra = (si.sub_extras || [])[0];
          if (firstExtra) {
            flavors.push(`1/${totalSubs} ${firstExtra.option_name}`);
          }
        }
        if (flavors.length > 0) return flavors;
      }
    }
    return [];
  };

  const getBorderInfo = (extras?: Array<{ extra_name: string; kds_category?: string }>): string | null => {
    if (!extras || extras.length === 0) return null;
    const borderExtra = extras.find(e => e.kds_category === 'border');
    const fallbackExtra = !borderExtra ? extras.find(e => {
      const lower = e.extra_name.toLowerCase();
      return lower.includes('borda') || lower.includes('massa');
    }) : null;
    const selectedExtra = borderExtra || fallbackExtra;
    if (!selectedExtra) return null;
    const parts = selectedExtra.extra_name.split(':');
    return parts.length > 1 ? parts[1].trim() : selectedExtra.extra_name;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader 
        className="pb-2 pt-3 px-3"
        style={{ borderTop: `3px solid ${stationColor}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={order.order_type === 'delivery' ? 'default' : 'secondary'} className="text-xs">
              {getOrderOriginLabel()}
            </Badge>
            {settings.showWaiterName && waiterName && (
              <span className="text-xs text-blue-600">👤 {waiterName}</span>
            )}
            <span className="text-xs font-mono text-muted-foreground">
              #{order.id.slice(-4).toUpperCase()}
            </span>
          </div>
          <KdsSlaIndicator createdAt={order.created_at} size="sm" showBackground />
        </div>
        {order.customer_name && (
          <p className="text-xs text-primary font-medium mt-1">{order.customer_name}</p>
        )}
      </CardHeader>
      
      <CardContent className="px-3 pb-3 space-y-2">
        {items.slice(0, 5).map((item) => {
          const flavors = getFlavors(item);
          const borderInfo = getBorderInfo(item.extras);
          return (
            <div key={item.id} className="p-2 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-primary">{item.quantity}x</span>
                <span className="font-medium text-sm truncate">{item.product?.name || 'Produto'}</span>
                {item.variation?.name && (
                  <span className="text-xs text-muted-foreground">({item.variation.name})</span>
                )}
              </div>
              {/* BORDA - SEMPRE pisca */}
              {borderInfo && (
                <div className="mt-1">
                  <span className="inline-flex px-2 py-0.5 rounded font-bold text-xs relative overflow-hidden animate-pulse">
                    <span className={cn("absolute inset-0", borderColors.bg)}></span>
                    <span className={cn("relative z-10", borderColors.text)}>🟡 {borderInfo}</span>
                  </span>
                </div>
              )}
              {flavors.length > 0 && (
                <div className="text-xs text-blue-600 mt-0.5">
                  {flavors.map((f, i) => (
                    <p key={i}>🍕 {f}</p>
                  ))}
                </div>
              )}
              {/* OBSERVAÇÕES - SEMPRE pisca */}
              {item.notes && (
                <div className="mt-1">
                  <span className="inline-flex px-2 py-0.5 rounded font-bold text-xs relative overflow-hidden animate-pulse">
                    <span className={cn("absolute inset-0", notesColors.bg)}></span>
                    <span className={cn("relative z-10", notesColors.text)}>📝 {item.notes}</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {items.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">+{items.length - 5} itens</p>
        )}

        {order.total != null && (
          <div className="text-sm font-semibold text-right pt-1 border-t">
            Total: R$ {order.total.toFixed(2)}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {canMarkDelivered && onMarkDelivered && (
            <Button 
              className="flex-1"
              onClick={() => {
                if (checklist.length > 0) {
                  setChecklistOpen(true);
                } else {
                  onMarkDelivered(order.id);
                }
              }}
              disabled={isMarkingDelivered}
            >
              <Package className="h-4 w-4 mr-2" />
              Marcar Entregue
            </Button>
          )}
          {onCancelOrder && order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Button 
              variant="destructive"
              size="icon"
              onClick={() => onCancelOrder(order)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
      <DispatchChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        checklist={checklist}
        orderLabel={`Pedido #${order.id.slice(-4).toUpperCase()}`}
        onConfirm={() => { onMarkDelivered?.(order.id); setChecklistOpen(false); }}
        isProcessing={isMarkingDelivered}
      />
    </Card>
  );
}
export function KdsProductionLineReadOnly({ 
  orders, 
  isLoading,
  onMarkDelivered,
  onCancelOrder,
  isMarkingDelivered,
}: KdsProductionLineReadOnlyProps) {
  const { activeStations, productionStations, orderStatusStation, isLoading: stationsLoading } = useKdsStations();
  const { settings } = useKdsSettings();

  // Cast orders to local type
  const typedOrders = orders as unknown as Order[];

  // Filter orders - only takeaway and delivery, exclude drafts
  const filteredOrders = useMemo(() => {
    return typedOrders.filter(o => 
      (o as any).is_draft !== true &&
      (o.order_type === 'takeaway' || o.order_type === 'delivery') &&
      (o.status === 'preparing' || o.status === 'ready' || o.status === 'delivered')
    );
  }, [typedOrders]);

  // Delivered orders from today for review
  const deliveredOrdersToday = useMemo(() => {
    return filteredOrders
      .filter(o => o.status === 'delivered' && isToday(new Date(o.delivered_at || o.updated_at)))
      .sort((a, b) => {
        const dateA = new Date(a.delivered_at || a.updated_at);
        const dateB = new Date(b.delivered_at || b.updated_at);
        return dateB.getTime() - dateA.getTime(); // Most recent first
      });
  }, [filteredOrders]);

  // Group items by station
  const itemsByStation = useMemo(() => {
    const map = new Map<string, { order: Order; items: OrderItem[] }[]>();
    
    activeStations.forEach(station => {
      map.set(station.id, []);
    });

    filteredOrders.forEach(order => {
      order.order_items?.forEach(item => {
        if (item.current_station_id && map.has(item.current_station_id)) {
          const stationItems = map.get(item.current_station_id)!;
          const existingEntry = stationItems.find(e => e.order.id === order.id);
          
          if (existingEntry) {
            existingEntry.items.push(item);
          } else {
            stationItems.push({ order, items: [item] });
          }
        }
      });
    });

    return map;
  }, [filteredOrders, activeStations]);

  // Ready orders in status station
  // Aparece quando QUALQUER item chega ao order_status (reagrupamento visual)
  const readyOrdersInStatus = useMemo(() => {
    if (!orderStatusStation) return [];
    
    return filteredOrders
      .filter(order => {
        if (order.status !== 'ready') return false;
        const items = order.order_items || [];
        const activeItems = items.filter(i => i.status !== 'cancelled');
        if (activeItems.length === 0) return false;
        
        // Mostra se pelo menos 1 item chegou ao order_status ou está done
        return activeItems.some(
          item => item.current_station_id === orderStatusStation.id || item.station_status === 'done'
        );
      })
      .map(order => {
        const activeItems = (order.order_items || []).filter(i => i.status !== 'cancelled');
        return { order, items: activeItems };
      })
      .filter(entry => entry.items.length > 0);
  }, [filteredOrders, orderStatusStation]);

  if (stationsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (activeStations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Factory className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg">Nenhuma praça configurada</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Configure praças de produção em Configurações → Praças
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Columns by production station */}
      <div className={cn(
        "grid gap-6",
        orderStatusStation 
          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-5" 
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      )}>
        {productionStations.map((station) => {
          const stationOrders = itemsByStation.get(station.id) || [];
          const totalItems = stationOrders.reduce((acc, o) => acc + o.items.length, 0);

          return (
            <div key={station.id}>
              <div 
                className="flex items-center gap-2 mb-3 p-2 rounded-lg"
                style={{ backgroundColor: station.color + '15' }}
              >
                <div 
                  className="h-6 w-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: station.color + '30' }}
                >
                  <Circle className="h-3 w-3" style={{ color: station.color, fill: station.color }} />
                </div>
                <span className="font-semibold text-sm">{station.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {totalItems}
                </Badge>
              </div>

              <ScrollArea className="h-[calc(100vh-320px)]">
                {stationOrders.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Nenhum item
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stationOrders.map(({ order, items }) => (
                      <ReadOnlyItemCard
                        key={`${order.id}-${station.id}`}
                        order={order}
                        items={items}
                        stationColor={station.color || '#3B82F6'}
                        settings={{
                          timerGreenMinutes: settings.timerGreenMinutes,
                          timerYellowMinutes: settings.timerYellowMinutes,
                          showWaiterName: settings.showWaiterName,
                          borderBadgeColor: settings.borderBadgeColor,
                          notesBadgeColor: settings.notesBadgeColor,
                        }}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          );
        })}

        {/* Order Status Column (Ready orders) */}
        {orderStatusStation && (
          <div>
            <div 
              className="flex items-center gap-2 mb-3 p-2 rounded-lg"
              style={{ backgroundColor: orderStatusStation.color + '15' }}
            >
              <div 
                className="h-6 w-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: orderStatusStation.color + '30' }}
              >
                <CheckCircle className="h-3 w-3" style={{ color: orderStatusStation.color }} />
              </div>
              <span className="font-semibold text-sm">{orderStatusStation.name}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {readyOrdersInStatus.length}
              </Badge>
            </div>

            <ScrollArea className="h-[calc(100vh-320px)]">
              {readyOrdersInStatus.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Nenhum pedido pronto
                </div>
              ) : (
                <div className="space-y-3">
                  {readyOrdersInStatus.map(({ order, items }) => (
                    <ReadyOrderCard
                      key={order.id}
                      order={order}
                      items={items}
                      stationColor={orderStatusStation.color || '#22C55E'}
                      settings={{
                        timerGreenMinutes: settings.timerGreenMinutes,
                        timerYellowMinutes: settings.timerYellowMinutes,
                        showWaiterName: settings.showWaiterName,
                        borderBadgeColor: settings.borderBadgeColor,
                        notesBadgeColor: settings.notesBadgeColor,
                      }}
                      onMarkDelivered={onMarkDelivered}
                      onCancelOrder={onCancelOrder}
                      isMarkingDelivered={isMarkingDelivered}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Delivered Orders Column (Today only) */}
        <div>
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-green-500/10">
            <div className="h-6 w-6 rounded-full flex items-center justify-center bg-green-500/30">
              <CheckCheck className="h-3 w-3 text-green-600" />
            </div>
            <span className="font-semibold text-sm">{settings.columnNameDelivered}</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {deliveredOrdersToday.length}
            </Badge>
          </div>

          <ScrollArea className="h-[calc(100vh-320px)]">
            {deliveredOrdersToday.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                Nenhum pedido entregue hoje
              </div>
            ) : (
              <div className="space-y-3">
                {deliveredOrdersToday.map((order) => (
                  <Card key={order.id} className="shadow-sm opacity-80">
                    <CardHeader 
                      className="pb-2 pt-3 px-3"
                      style={{ borderTop: '3px solid #22C55E' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            {order.order_type === 'delivery' ? 'DELIVERY' : 'BALCÃO'}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">
                            #{order.id.slice(-4).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCheck className="h-3 w-3" />
                          {format(new Date(order.delivered_at || order.updated_at), 'HH:mm')}
                        </div>
                      </div>
                      {order.customer_name && (
                        <p className="text-xs text-muted-foreground mt-1">{order.customer_name}</p>
                      )}
                    </CardHeader>
                    
                    <CardContent className="px-3 pb-3">
                      <div className="space-y-1">
                        {order.order_items?.slice(0, 3).map((item) => (
                          <div key={item.id} className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="font-medium">{item.quantity}x</span>
                            <span className="truncate">{item.product?.name || 'Produto'}</span>
                          </div>
                        ))}
                        {(order.order_items?.length || 0) > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{(order.order_items?.length || 0) - 3} itens
                          </p>
                        )}
                      </div>
                      {order.total != null && (
                        <div className="text-sm font-semibold text-right pt-2 border-t mt-2 text-green-600">
                          R$ {order.total.toFixed(2)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
