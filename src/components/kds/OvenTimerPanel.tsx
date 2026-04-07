import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Flame, Package, Clock, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectorOrderItem, useOrderSiblingItems } from '@/hooks/useSectorOrderItems';
import { useKdsActions } from '@/hooks/useKdsActions';

interface OvenTimerPanelProps {
  ovenItems: SectorOrderItem[];
  isLoading: boolean;
}

interface OrderOvenGroup {
  orderId: string;
  order: SectorOrderItem['order'];
  items: SectorOrderItem[];
}

function getOvenProgress(item: SectorOrderItem): number {
  if (!item.oven_entry_at || !item.estimated_exit_at) return 0;
  const start = new Date(item.oven_entry_at).getTime();
  const end = new Date(item.estimated_exit_at).getTime();
  const now = Date.now();
  const total = end - start;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, ((now - start) / total) * 100));
}

function getTimeRemaining(item: SectorOrderItem): string {
  if (!item.estimated_exit_at) return '--:--';
  const diff = new Date(item.estimated_exit_at).getTime() - Date.now();
  if (diff <= 0) return '00:00';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isOverdue(item: SectorOrderItem): boolean {
  if (!item.estimated_exit_at) return false;
  return Date.now() > new Date(item.estimated_exit_at).getTime();
}

export function OvenTimerPanel({ ovenItems, isLoading }: OvenTimerPanelProps) {
  const { markReady } = useKdsActions();
  const [, setTick] = useState(0);

  // Atualizar timers a cada segundo
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Agrupar por pedido
  const groups: OrderOvenGroup[] = useMemo(() => {
    const map = new Map<string, OrderOvenGroup>();
    for (const item of ovenItems) {
      if (!map.has(item.order_id)) {
        map.set(item.order_id, { orderId: item.order_id, order: item.order, items: [] });
      }
      map.get(item.order_id)!.items.push(item);
    }
    return Array.from(map.values());
  }, [ovenItems]);

  // Buscar itens irmãos
  const orderIds = groups.map(g => g.orderId);
  const { data: siblingItems = [] } = useOrderSiblingItems(orderIds);

  const getSiblingsForOrder = (orderId: string) =>
    siblingItems.filter(s => s.order_id === orderId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Flame className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg">Nenhum item no forno</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="h-5 w-5 text-red-500" />
          <h2 className="font-bold text-lg">Forno / Despacho</h2>
          <Badge variant="secondary">{ovenItems.length} item(ns)</Badge>
        </div>

        {groups.map(group => {
          const siblings = getSiblingsForOrder(group.orderId);
          const allItemsReady = group.items.every(i => isOverdue(i));
          const hasPendingSiblings = siblings.length > 0;
          const canDispatch = allItemsReady && !hasPendingSiblings;

          return (
            <Card key={group.orderId} className={cn(
              "border-border/50",
              canDispatch && "ring-2 ring-emerald-500/50"
            )}>
              <CardHeader className="py-2 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {group.order?.external_display_id || `#${group.orderId.slice(0, 6)}`}
                    </span>
                    {group.order?.order_type === 'dine_in' && (group.order as any)?.table?.number && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-xs font-bold">
                        Mesa {(group.order as any).table.number}
                      </Badge>
                    )}
                    {(group.order?.order_type === 'takeaway' || group.order?.order_type === 'delivery') && group.order?.customer_name && (
                      <span className="text-sm text-muted-foreground">{group.order.customer_name}</span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {group.order?.order_type === 'delivery' ? '🛵' :
                     group.order?.order_type === 'takeaway' ? '🥡' : '🍽️'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="py-2 px-3 space-y-2">
                {/* Itens no forno */}
                {group.items.map(item => {
                  const progress = getOvenProgress(item);
                  const remaining = getTimeRemaining(item);
                  const overdue = isOverdue(item);

                  return (
                    <div key={item.id} className={cn(
                      "p-2 rounded-lg border",
                      overdue ? "bg-red-500/10 border-red-500/30" : "bg-orange-500/5 border-orange-500/20"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {item.quantity}x {item.product?.name}
                          {item.variation && ` (${item.variation.name})`}
                        </span>
                        <span className={cn(
                          "font-mono text-sm font-bold",
                          overdue ? "text-red-500 animate-pulse" : "text-orange-500"
                        )}>
                          <Clock className="h-3.5 w-3.5 inline mr-1" />
                          {remaining}
                        </span>
                      </div>
                      <Progress 
                        value={progress} 
                        className={cn("h-2", overdue && "[&>div]:bg-red-500")} 
                      />
                    </div>
                  );
                })}

                {/* Itens irmãos aguardando */}
                {siblings.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-dashed">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Aguardando em outros setores:
                    </p>
                    {siblings.map(sibling => (
                      <div key={sibling.id} className="text-xs text-muted-foreground/60 pl-4">
                        • {sibling.quantity}x {sibling.product?.name}
                        {sibling.variation && ` (${sibling.variation.name})`}
                        <span className="ml-1">— {sibling.station_status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botão DESPACHAR */}
                <div className="mt-2 pt-2 border-t">
                  {group.items.map(item => (
                    <Button
                      key={item.id}
                      size="sm"
                      className={cn(
                        "w-full mb-1 gap-1",
                        isOverdue(item) 
                          ? "bg-emerald-600 hover:bg-emerald-700" 
                          : "bg-muted text-muted-foreground"
                      )}
                      disabled={!isOverdue(item) || markReady.isPending}
                      onClick={() => markReady.mutate({ itemId: item.id, currentStationId: item.current_station_id })}
                    >
                      {isOverdue(item) ? (
                        <>
                          <Check className="h-4 w-4" /> PRONTO
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4" /> Aguardando forno...
                        </>
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
