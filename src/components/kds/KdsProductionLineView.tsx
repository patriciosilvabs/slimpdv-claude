import { useMemo, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useKdsStations, type KdsStation } from '@/hooks/useKdsStations';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { useKdsWorkflow } from '@/hooks/useKdsWorkflow';
import { KdsStationCard } from './KdsStationCard';
import { KdsOrderStatusCard } from './KdsOrderStatusCard';
import { KdsStationHistory } from './KdsStationHistory';
import { cn } from '@/lib/utils';
import { Factory, Circle, CheckCircle, Clock, Hourglass, History } from 'lucide-react';
import type { Order as UseOrdersOrder } from '@/hooks/useOrders';
import { isPhantomItem } from './kdsItemFilter';
import { supabase } from '@/integrations/supabase/client';

// Extend the order item type with optional station fields
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
  extras?: Array<{ extra_name: string; price: number }>;
  served_at?: string | null;
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
  order_items?: OrderItem[];
}

interface OverrideSettings {
  assignedStationId?: string | null;
  highlightSpecialBorders?: boolean;
  borderKeywords?: string[];
  showPartySize?: boolean;
  showWaiterName?: boolean;
  compactMode?: boolean;
  timerGreenMinutes?: number;
  timerYellowMinutes?: number;
}

interface KdsProductionLineViewProps {
  orders: UseOrdersOrder[];
  isLoading: boolean;
  overrideTenantId?: string | null;
  overrideStations?: any[];
  overrideSettings?: OverrideSettings;
  overrideWorkflow?: {
    moveItemToNextStation: { mutate: (params: { itemId: string; currentStationId: string }) => void; isPending: boolean };
    skipItemToNextStation: { mutate: (params: { itemId: string; currentStationId: string }) => void };
    finalizeOrderFromStatus: { mutate: (params: { orderId: string; orderType?: string; currentStationId?: string }) => void; isPending: boolean };
    serveItem: { mutate: (itemId: string) => void; isPending: boolean };
  };
}

export function KdsProductionLineView({ orders, isLoading, overrideTenantId, overrideStations, overrideSettings, overrideWorkflow }: KdsProductionLineViewProps) {
  const { activeStations: hookActiveStations, productionStations: hookProductionStations, orderStatusStation: hookOrderStatusStation, isLoading: stationsLoading } = useKdsStations();
  const { settings: hookSettings } = useKdsSettings(overrideTenantId);
  const hookWorkflow = useKdsWorkflow();

  // Use overrideSettings when provided (device-only mode bypasses RLS)
  const settings = useMemo(() => {
    if (!overrideSettings) return hookSettings;
    return { ...hookSettings, ...overrideSettings };
  }, [hookSettings, overrideSettings]);

  // Use override stations if provided (device-only mode), otherwise use hook data
  const hasOverrideStations = overrideStations && overrideStations.length > 0;
  const activeStations = hasOverrideStations
    ? overrideStations.filter((s: any) => s.is_active)
    : hookActiveStations;
  const productionStations = hasOverrideStations
    ? overrideStations.filter((s: any) => s.is_active && s.station_type !== 'order_status')
    : hookProductionStations;
  // All order_status stations (for general view multi-column dispatch)
  const allOrderStatusStations = hasOverrideStations
    ? overrideStations.filter((s: any) => s.is_active && s.station_type === 'order_status')
    : activeStations.filter(s => s.station_type === 'order_status');
  const orderStatusStation = allOrderStatusStations[0] || null;

  // Use override workflow if provided (device-only mode)
  const workflow = overrideWorkflow || {
    moveItemToNextStation: hookWorkflow.moveItemToNextStation,
    skipItemToNextStation: hookWorkflow.skipItemToNextStation,
    finalizeOrderFromStatus: hookWorkflow.finalizeOrderFromStatus,
    serveItem: hookWorkflow.serveItem,
  };

  // Cast orders to local type for internal use
  const typedOrders = orders as unknown as Order[];

  // Filtrar pedidos - mostra pedidos que têm itens com praça atribuída (pending, preparing, ready)
  const filteredOrders = useMemo(() => {
    // Excluir pedidos em rascunho primeiro
    const nonDraftOrders = typedOrders.filter(o => (o as any).is_draft !== true);

    if (!settings.assignedStationId) {
      // Se não tiver praça atribuída, mostra pedidos que têm itens nas praças (pending, preparing, ready)
      return nonDraftOrders.filter(o => {
        // Sempre inclui se está em preparing ou ready
        if (o.status === 'preparing' || o.status === 'ready') return true;
        // Para pending, só inclui se algum item já tem current_station_id
        if (o.status === 'pending') {
          return o.order_items?.some(item => item.current_station_id !== null);
        }
        return false;
      });
    }

    // Filtrar pedidos que têm itens nesta praça
    return nonDraftOrders.filter(order => {
      return order.order_items?.some(
        item => item.current_station_id === settings.assignedStationId
      );
    });
  }, [typedOrders, settings.assignedStationId]);

  // Pedidos no buffer (aguardando - sem current_station_id ou com status pendente sem praça)
  const bufferOrders = useMemo(() => {
    const nonDraftOrders = typedOrders.filter(o => (o as any).is_draft !== true);
    return nonDraftOrders.filter(order => {
      if (order.status === 'pending') {
        // Pedido pending que não tem nenhum item com station
        const hasStationItems = order.order_items?.some(item => item.current_station_id !== null);
        return !hasStationItems && (order.order_items?.length ?? 0) > 0;
      }
      return false;
    });
  }, [typedOrders]);

  // Explodir itens individualmente por praça (cada item = 1 card separado)
  const itemsByStation = useMemo(() => {
    const map = new Map<string, { order: Order; items: OrderItem[]; totalOrderItems: number }[]>();
    
    activeStations.forEach(station => {
      map.set(station.id, []);
    });

    filteredOrders.forEach(order => {
      // Conta total de itens ativos do pedido nesta praça (para exibir "Item X de Y")
      const allActiveItems = order.order_items?.filter(i => i.status !== 'cancelled') || [];
      
      order.order_items?.forEach(item => {
        // Pular itens fantasma (sem produto mapeado e sem sabores)
        if (isPhantomItem(item)) return;
        if (item.current_station_id && map.has(item.current_station_id)) {
          const stationItems = map.get(item.current_station_id)!;
          // Cada item gera um card separado (para distribuição entre bancadas)
          stationItems.push({ order, items: [item], totalOrderItems: allActiveItems.length });
        }
      });
    });

    return map;
  }, [filteredOrders, activeStations]);

  // Praça atual baseada na configuração do dispositivo
  // Busca primeiro em activeStations, depois em overrideStations como fallback
  const currentStation = settings.assignedStationId 
    ? (activeStations.find(s => s.id === settings.assignedStationId) 
       || overrideStations?.find((s: any) => s.id === settings.assignedStationId)
       || null)
    : null;

  const handleMoveToNext = (itemId: string, stationId: string, orderType?: string) => {
    workflow.moveItemToNextStation.mutate({ itemId, currentStationId: stationId, orderType });
  };

  const handleSkipItem = (itemId: string, stationId: string) => {
    workflow.skipItemToNextStation.mutate({ itemId, currentStationId: stationId });
  };

  const handleFinalizeOrder = (orderId: string, orderType?: string) => {
    // Determine which order_status station the order is currently at
    const order = filteredOrders.find(o => o.id === orderId);
    const currentStationId = order?.order_items?.find(
      item => item.current_station_id && orderStatusStationIds.includes(item.current_station_id)
    )?.current_station_id || orderStatusStation?.id;
    
    workflow.finalizeOrderFromStatus.mutate({ orderId, orderType, currentStationId });
  };

  // IDs de todas as estações order_status
  const orderStatusStationIds = useMemo(() => {
    const allOrderStatusStations = activeStations.filter(s => s.station_type === 'order_status');
    return allOrderStatusStations.map(s => s.id);
  }, [activeStations]);

  const handleServeItem = (itemId: string) => {
    workflow.serveItem.mutate(itemId);
  };

  // Calculate priority item per station: oldest waiting item
  const priorityItemByStation = useMemo(() => {
    const map = new Map<string, string>(); // stationId -> oldest waiting itemId
    for (const [stationId, stationOrders] of itemsByStation) {
      const waitingItems = stationOrders
        .flatMap(so => so.items)
        .filter(item => item.station_status === 'waiting')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (waitingItems.length > 0) {
        map.set(stationId, waitingItems[0].id);
      }
    }
    return map;
  }, [itemsByStation]);

  // Out-of-order log handler
  const handleOutOfOrderLog = useCallback((itemId: string, stationId: string) => {
    supabase.from('kds_station_logs').insert({
      order_item_id: itemId,
      station_id: stationId,
      action: 'out_of_order',
      notes: 'Item movido fora da ordem FIFO',
    }).then(() => {});
  }, []);

  // Pedidos no despacho - per station map for general view (all order_status stations)
  const readyOrdersByStation = useMemo(() => {
    const result = new Map<string, { order: Order; items: OrderItem[] }[]>();
    
    for (const station of allOrderStatusStations) {
      const stationOrders = filteredOrders
        .filter(order => {
          const items = order.order_items || [];
          const activeItems = items.filter(i => i.status !== 'cancelled');
          if (activeItems.length === 0) return false;
          return activeItems.some(item => item.current_station_id === station.id);
        })
        .map(order => {
          const activeItems = (order.order_items || []).filter(i => i.status !== 'cancelled');
          return { order, items: activeItems };
        })
        .filter(entry => entry.items.length > 0);
      
      result.set(station.id, stationOrders);
    }
    
    return result;
  }, [filteredOrders, allOrderStatusStations]);

  // For assigned station view (single station)
  const readyOrdersInStatus = useMemo(() => {
    const targetStationId = (currentStation?.station_type === 'order_status')
      ? currentStation.id
      : orderStatusStation?.id;
    
    if (!targetStationId) return [];
    return readyOrdersByStation.get(targetStationId) || [];
  }, [readyOrdersByStation, currentStation, orderStatusStation]);

  if ((hasOverrideStations ? false : stationsLoading) || isLoading) {
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

  // Se tiver praça atribuída, mostra apenas ela
  if (currentStation) {
    const stationOrders = itemsByStation.get(currentStation.id) || [];
    // Recalculate from filtered orders if not in map (station from overrideStations)
    const effectiveStationOrders = stationOrders.length > 0 ? stationOrders : (() => {
      const result: { order: Order; items: OrderItem[]; totalOrderItems: number }[] = [];
      filteredOrders.forEach(order => {
        const allActiveItems = order.order_items?.filter(i => i.status !== 'cancelled') || [];
        const stationItems = order.order_items?.filter(item => item.current_station_id === currentStation.id) || [];
        // Explodir: cada item vira um card separado
        stationItems.forEach(item => {
          result.push({ order, items: [item], totalOrderItems: allActiveItems.length });
        });
      });
      return result;
    })();
    const stationIndex = activeStations.findIndex(s => s.id === currentStation.id);
    const isFirstStation = stationIndex <= 0;
    const isLastStation = stationIndex === activeStations.length - 1 || stationIndex === -1;

    const isOrderStatusStation = currentStation.station_type === 'order_status';

    return (
      <div className="h-full flex flex-col">
        {/* Header da praça */}
        <div 
          className="flex items-center gap-3 p-4 mb-4 rounded-lg"
          style={{ backgroundColor: currentStation.color + '15' }}
        >
          <div 
            className="h-10 w-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: currentStation.color + '30' }}
          >
            <Circle className="h-5 w-5" style={{ color: currentStation.color, fill: currentStation.color }} />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: currentStation.color }}>
              {currentStation.name}
            </h2>
            <p className="text-sm text-muted-foreground">{currentStation.description}</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {effectiveStationOrders.reduce((acc, o) => acc + o.items.length, 0)} itens
          </Badge>
        </div>

        {isOrderStatusStation ? (
          <Tabs defaultValue="ativos" className="flex-1 flex flex-col">
            <TabsList className="w-fit mb-3">
              <TabsTrigger value="ativos" className="gap-1.5">
                <Circle className="h-3.5 w-3.5" />
                Ativos
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                Histórico
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ativos" className="flex-1 mt-0">
              <ScrollArea className="flex-1">
                {readyOrdersInStatus.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Circle className="h-8 w-8 mb-2" style={{ color: currentStation.color }} />
                    <p>Nenhum pedido no despacho</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {readyOrdersInStatus.map(({ order, items }) => (
                      <KdsOrderStatusCard
                        key={order.id}
                        order={order}
                        items={items}
                        stationColor={currentStation.color}
                        orderStatusStationId={currentStation.id}
                        onFinalize={handleFinalizeOrder}
                        onServeItem={handleServeItem}
                        isProcessing={workflow.finalizeOrderFromStatus.isPending || workflow.serveItem.isPending}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="historico" className="flex-1 mt-0">
              <KdsStationHistory
                stationId={currentStation.id}
                stationColor={currentStation.color}
                tenantId={overrideTenantId}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <ScrollArea className="flex-1">
            {effectiveStationOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Circle className="h-8 w-8 mb-2" style={{ color: currentStation.color }} />
                <p>Nenhum item nesta praça</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {effectiveStationOrders.map(({ order, items, totalOrderItems }) => {
                  const itemId = items[0]?.id;
                  const stationPriorityId = priorityItemByStation.get(currentStation.id);
                  return (
                  <KdsStationCard
                    key={`${itemId}-${currentStation.id}`}
                    order={order}
                    items={items}
                    stationColor={currentStation.color}
                    stationName={currentStation.name}
                    stationType={currentStation.station_type}
                    isFirstStation={isFirstStation}
                    isLastStation={isLastStation}
                    onMoveToNext={(id, orderType) => handleMoveToNext(id, currentStation.id, orderType)}
                    onSkipItem={(id) => handleSkipItem(id, currentStation.id)}
                    isProcessing={workflow.moveItemToNextStation.isPending}
                    overrideSettings={overrideSettings}
                    totalOrderItems={totalOrderItems}
                    isPriority={stationPriorityId ? itemId === stationPriorityId : undefined}
                    onOutOfOrderLog={(id) => handleOutOfOrderLog(id, currentStation.id)}
                  />
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    );
  }

  // Visão geral de todas as praças (quando não tem praça atribuída)
  return (
    <div className="space-y-6">
      {/* Buffer de Espera */}
      {bufferOrders.length > 0 && (
        <div className="p-4 rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Hourglass className="h-5 w-5 text-amber-600 animate-pulse" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              Buffer de Espera
            </span>
            <Badge variant="secondary" className="ml-auto">
              {bufferOrders.length} pedido{bufferOrders.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {bufferOrders.map((order) => (
              <div key={order.id} className="p-3 bg-background rounded-lg border shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    #{order.id.slice(-4).toUpperCase()}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {order.order_type === 'delivery' ? 'DELIVERY' : 
                     order.order_type === 'takeaway' ? 'BALCÃO' : 
                     `MESA ${order.table?.number || '?'}`}
                  </Badge>
                </div>
                {order.customer_name && (
                  <p className="text-sm font-medium truncate">{order.customer_name}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {order.order_items?.length || 0} itens aguardando
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Colunas por praça de produção */}
      <div className={cn(
        "grid gap-6",
        allOrderStatusStations.length > 0
          ? `grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(productionStations.length + allOrderStatusStations.length, 6)}`
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}
      style={{ gridTemplateColumns: `repeat(${Math.min(productionStations.length + allOrderStatusStations.length, 6)}, minmax(0, 1fr))` }}
      >
        {productionStations.map((station, idx) => {
          const stationOrders = itemsByStation.get(station.id) || [];
          const totalItems = stationOrders.reduce((acc, o) => acc + o.items.length, 0);
          const isFirstStation = idx === 0;
          const isLastStation = idx === productionStations.length - 1;

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
                    {stationOrders.map(({ order, items, totalOrderItems }) => {
                      const itemId = items[0]?.id;
                      const stationPriorityId = priorityItemByStation.get(station.id);
                      return (
                      <KdsStationCard
                        key={`${itemId}-${station.id}`}
                        order={order}
                        items={items}
                        stationColor={station.color}
                        stationName={station.name}
                        stationType={station.station_type}
                        isFirstStation={isFirstStation}
                        isLastStation={isLastStation}
                        onMoveToNext={(id, orderType) => handleMoveToNext(id, station.id, orderType)}
                        onSkipItem={(id) => handleSkipItem(id, station.id)}
                        isProcessing={workflow.moveItemToNextStation.isPending}
                        overrideSettings={overrideSettings}
                        totalOrderItems={totalOrderItems}
                        isPriority={stationPriorityId ? itemId === stationPriorityId : undefined}
                        onOutOfOrderLog={(id) => handleOutOfOrderLog(id, station.id)}
                      />
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          );
        })}

        {/* Colunas de Despacho (todas as estações order_status) */}
        {allOrderStatusStations.map((dispatchStation) => {
          const stationOrders = readyOrdersByStation.get(dispatchStation.id) || [];
          return (
            <div key={dispatchStation.id}>
              <div 
                className="flex items-center gap-2 mb-3 p-2 rounded-lg"
                style={{ backgroundColor: dispatchStation.color + '15' }}
              >
                <div 
                  className="h-6 w-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: dispatchStation.color + '30' }}
                >
                  <CheckCircle className="h-3 w-3" style={{ color: dispatchStation.color }} />
                </div>
                <span className="font-semibold text-sm">{dispatchStation.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {stationOrders.length}
                </Badge>
              </div>

              <Tabs defaultValue="ativos" className="flex flex-col">
                <TabsList className="w-fit mb-3">
                  <TabsTrigger value="ativos" className="gap-1.5 text-xs">
                    <Circle className="h-3 w-3" />
                    Ativos
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="gap-1.5 text-xs">
                    <History className="h-3 w-3" />
                    Histórico
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="ativos" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-380px)]">
                    {stationOrders.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        Nenhum pedido pronto
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {stationOrders.map(({ order, items }) => (
                          <KdsOrderStatusCard
                            key={order.id}
                            order={order}
                            items={items}
                            stationColor={dispatchStation.color}
                            orderStatusStationId={dispatchStation.id}
                            onFinalize={handleFinalizeOrder}
                            onServeItem={handleServeItem}
                            isProcessing={workflow.finalizeOrderFromStatus.isPending || workflow.serveItem.isPending}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="historico" className="mt-0">
                  <KdsStationHistory
                    stationId={dispatchStation.id}
                    stationColor={dispatchStation.color}
                    tenantId={overrideTenantId}
                  />
                </TabsContent>
              </Tabs>
            </div>
          );
        })}
      </div>
    </div>
  );
}
