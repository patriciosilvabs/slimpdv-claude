import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Truck, User, UtensilsCrossed, Package, Check } from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { useDispatchChecklist } from '@/hooks/useDispatchChecklist';
import { DispatchChecklistDialog } from '@/components/dispatch/DispatchChecklistDialog';

interface OrderItem {
  id: string;
  product_id?: string | null;
  quantity: number;
  notes: string | null;
  fulfillment_type?: string | null;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number; kds_category?: string }>;
  sub_items?: Array<{ id: string; sub_item_index: number; notes: string | null; sub_extras?: Array<{ group_name: string; option_name: string; kds_category?: string }> }> | null;
  served_at?: string | null;
  current_station_id?: string | null;
  station_status?: string;
}

const isFlavorSubExtra = (se: { kds_category?: string; group_name?: string }) =>
  se.kds_category === 'flavor' || (se.group_name && se.group_name.toLowerCase().includes('sabor'));

function getFlavors(extras?: OrderItem['extras'], subItems?: OrderItem['sub_items']): string[] {
  if (extras && extras.length > 0) {
    const flavorExtras = extras.filter(e => e.kds_category === 'flavor');
    if (flavorExtras.length > 0) {
      const total = flavorExtras.length;
      return flavorExtras.map(e => {
        const parts = e.extra_name.split(':');
        const name = parts.length > 1 ? parts[1].trim() : e.extra_name;
        return total > 1 ? `1/${total} ${name}` : name;
      });
    }
    const fallback = extras.filter(e => {
      const lower = e.extra_name.toLowerCase();
      return lower.includes('sabor') && !lower.includes('borda') && !lower.includes('massa');
    });
    if (fallback.length > 0) {
      const total = fallback.length;
      return fallback.map(e => {
        const parts = e.extra_name.split(':');
        const name = parts.length > 1 ? parts[1].trim() : e.extra_name;
        return total > 1 ? `1/${total} ${name}` : name;
      });
    }
  }
  if (subItems && subItems.length > 0) {
    const totalSubs = subItems.length;
    const flavors: string[] = [];
    for (const si of subItems) {
      const fe = (si.sub_extras || []).find(se => isFlavorSubExtra(se));
      if (fe) flavors.push(totalSubs > 1 ? `1/${totalSubs} ${fe.option_name}` : fe.option_name);
    }
    if (flavors.length > 0) return flavors;
  }
  return [];
}

function getBorder(extras?: OrderItem['extras'], subItems?: OrderItem['sub_items']): string | null {
  if (extras) {
    const b = extras.find(e => e.kds_category === 'border')
      || extras.find(e => { const l = e.extra_name.toLowerCase(); return l.includes('borda') || l.includes('massa'); });
    if (b) { const p = b.extra_name.split(':'); return p.length > 1 ? p[1].trim() : b.extra_name; }
  }
  if (subItems) {
    for (const si of subItems) {
      for (const se of si.sub_extras || []) {
        if (se.kds_category === 'border') return se.option_name;
      }
    }
  }
  return null;
}

function getComplements(extras?: OrderItem['extras'], border?: string | null, flavors?: string[], subItems?: OrderItem['sub_items']): string[] {
  const result: string[] = [];
  if (extras) {
    result.push(...extras
      .filter(e => e.kds_category !== 'flavor' && e.kds_category !== 'border')
      .filter(e => { const l = e.extra_name.toLowerCase(); return !l.includes('borda') && !l.includes('massa'); })
      .map(e => { const p = e.extra_name.split(':'); return p.length > 1 ? p[1].trim() : e.extra_name; })
      .filter(n => !border || n.toLowerCase() !== border.toLowerCase()));
  }
  if (subItems) {
    for (const si of subItems) {
      for (const se of si.sub_extras || []) {
        if (isFlavorSubExtra(se) || se.kds_category === 'border') continue;
        if (flavors && flavors.some(f => f.includes(se.option_name))) continue;
        if (!border || se.option_name.toLowerCase() !== border.toLowerCase()) result.push(se.option_name);
      }
    }
  }
  return result;
}

function getItemNotes(item: OrderItem): string | null {
  const mainNotes = item.notes;
  const subNotes = item.sub_items?.filter(si => si.notes).map(si => si.notes).join('; ');
  if (mainNotes && subNotes) return `${mainNotes} | ${subNotes}`;
  return mainNotes || subNotes || null;
}

interface Order {
  id: string;
  status: string;
  customer_name: string | null;
  table?: { number: number } | null;
  order_type: string;
  notes: string | null;
  created_at: string;
  ready_at?: string | null;
  pager_number?: string | null;
}

interface KdsOrderStatusCardProps {
  order: Order;
  items: OrderItem[];
  stationColor: string;
  orderStatusStationId?: string;
  onFinalize: (orderId: string, orderType?: string) => void;
  onServeItem?: (itemId: string) => void;
  isProcessing?: boolean;
}

export function KdsOrderStatusCard({
  order,
  items,
  stationColor,
  orderStatusStationId,
  onFinalize,
  onServeItem,
  isProcessing,
}: KdsOrderStatusCardProps) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const { settings } = useKdsSettings();
  const checklist = useDispatchChecklist(order.id);
  const compact = settings.compactMode;

  // Calcular tempo total de preparo
  const calculatePrepTime = () => {
    if (!order.ready_at) return null;
    const createdAt = new Date(order.created_at);
    const readyAt = new Date(order.ready_at);
    return differenceInMinutes(readyAt, createdAt);
  };

  const prepTimeMinutes = calculatePrepTime();

  // Determinar origem do pedido
  const getOrderOrigin = () => {
    if (order.table?.number) {
      return { icon: UtensilsCrossed, label: `MESA ${order.table.number}` };
    }
    if (order.order_type === 'delivery') {
      return { icon: Truck, label: 'DELIVERY' };
    }
    if (order.order_type === 'takeaway') {
      return { icon: MapPin, label: 'BALCÃO' };
    }
    return { icon: User, label: order.customer_name || 'CLIENTE' };
  };

  const origin = getOrderOrigin();
  const OriginIcon = origin.icon;

  // Verificar se o item já chegou ao despacho (está na estação order_status ou done)
  const isItemAtDispatch = (item: OrderItem) => {
    if (item.served_at) return true;
    if (item.station_status === 'done') return true;
    if (orderStatusStationId && item.current_station_id === orderStatusStationId) return true;
    return false;
  };

  // Contar itens servidos e itens que chegaram ao despacho
  const servedCount = items.filter(item => item.served_at).length;
  const arrivedCount = items.filter(item => isItemAtDispatch(item)).length;
  const totalCount = items.length;
  const allServed = servedCount === totalCount;
  const allArrived = arrivedCount === totalCount;
  const pendingCount = totalCount - arrivedCount;

  return (
    <Card 
      className={cn(
        "overflow-hidden border-2 transition-all duration-300 opacity-90",
        compact ? "text-sm" : "",
        "bg-muted/30"
      )}
      style={{ borderColor: stationColor + '40' }}
    >
      <CardHeader 
        className={cn(
          "py-3 px-4 flex flex-row items-center justify-between space-y-0",
          compact && "py-2 px-3"
        )}
        style={{ backgroundColor: stationColor + '15' }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 
            className={cn("h-5 w-5 fill-current", compact && "h-4 w-4")} 
            style={{ color: stationColor }} 
          />
          <div className="flex items-center gap-2">
            <OriginIcon className={cn("h-4 w-4 text-muted-foreground", compact && "h-3 w-3")} />
            <span className={cn("font-bold", compact && "text-sm")} style={{ color: stationColor }}>
              {origin.label}
            </span>
            {order.pager_number && order.order_type === 'takeaway' && (
              <Badge className={cn(
                "bg-amber-500 text-white border-amber-400 font-bold animate-pulse",
                compact ? "text-sm px-2 py-0.5" : "text-lg px-3 py-1"
              )}>
                📟 PAGER #{order.pager_number}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            className={cn("text-xs font-semibold", compact && "text-[10px] px-1.5")}
            style={{ backgroundColor: stationColor, color: 'white' }}
          >
            {servedCount}/{totalCount} servidos
          </Badge>
          <Badge 
            variant="outline" 
            className={cn("font-mono", compact && "text-xs")}
          >
            #{order.id.slice(-4).toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className={cn("p-4 space-y-3", compact && "p-3 space-y-2")}>
        {/* Tempo total de preparo */}
        {prepTimeMinutes !== null && (
          <div 
            className={cn(
              "flex items-center justify-center gap-2 py-2 rounded-lg",
              compact && "py-1.5"
            )}
            style={{ backgroundColor: stationColor + '20' }}
          >
            <Clock className={cn("h-4 w-4", compact && "h-3 w-3")} style={{ color: stationColor }} />
            <span className={cn("font-bold text-base", compact && "text-sm")} style={{ color: stationColor }}>
              {prepTimeMinutes} min
            </span>
            <span className={cn("text-muted-foreground text-xs", compact && "text-[10px]")}>
              preparo
            </span>
          </div>
        )}

        {/* Tempo desde que ficou pronto */}
        {order.ready_at && (
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" style={{ color: stationColor }} />
            <span>Pronto há {formatDistanceToNow(new Date(order.ready_at), { locale: ptBR })}</span>
          </div>
        )}

        {/* BOTÃO DESPACHAR - no topo, perto do timer */}
        <Button
          size={compact ? "sm" : "lg"}
          onClick={() => {
            if (checklist.length > 0 && allArrived) {
              setChecklistOpen(true);
            } else {
              onFinalize(order.id, order.order_type);
            }
          }}
          disabled={isProcessing || !allArrived}
          className={cn(
            "w-full font-bold text-lg",
            compact && "h-8 text-sm",
            !allArrived && "opacity-40 cursor-not-allowed"
          )}
          style={{ backgroundColor: allArrived ? stationColor : undefined }}
          variant={allArrived ? "default" : "outline"}
        >
          <Package className={cn("h-5 w-5 mr-2", compact && "h-4 w-4 mr-1")} />
          {!allArrived 
            ? `Aguardando ${pendingCount} ${pendingCount === 1 ? 'item' : 'itens'}...`
            : 'DESPACHAR'
          }
        </Button>

        {/* Indicador de itens pendentes em produção */}
        {pendingCount > 0 && (
          <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Clock className={cn("h-4 w-4 text-amber-600 animate-pulse", compact && "h-3 w-3")} />
            <span className={cn("font-semibold text-amber-700 dark:text-amber-400 text-sm", compact && "text-xs")}>
              Aguardando {pendingCount} {pendingCount === 1 ? 'item' : 'itens'} em produção
            </span>
          </div>
        )}

        {/* Lista de itens individuais */}
        <div className={cn("border-t border-border/50 pt-3 space-y-2", compact && "pt-2 space-y-1.5")}>
          {items.map((item) => {
            const arrived = isItemAtDispatch(item);
            const flavors = getFlavors(item.extras, item.sub_items);
            const border = getBorder(item.extras, item.sub_items);
            const complements = getComplements(item.extras, border, flavors, item.sub_items);
            const itemNotes = getItemNotes(item);
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start justify-between gap-2 p-2 rounded-lg border transition-opacity",
                  item.served_at
                    ? "bg-green-500/10 border-green-500/30"
                    : arrived
                      ? "bg-background/50 border-border/50"
                      : "bg-muted/20 border-dashed border-muted-foreground/30 opacity-40",
                  compact && "p-1.5"
                )}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className={cn("flex items-center gap-1.5 flex-wrap", compact && "gap-1")}>
                    <Badge variant="secondary" className={cn("text-xs shrink-0", compact && "text-[10px] px-1")}>
                      x{item.quantity}
                    </Badge>
                    <span className={cn(
                      "font-medium text-sm",
                      compact && "text-xs",
                      item.served_at && "text-green-700 dark:text-green-400",
                      !arrived && "italic text-muted-foreground"
                    )}>
                      {item.product?.name || 'Item'}
                    </span>
                    {item.variation?.name && (
                      <span className={cn("text-xs text-muted-foreground", compact && "text-[10px]")}>
                        ({item.variation.name})
                      </span>
                    )}
                    {item.fulfillment_type === 'takeaway' && (
                      <Badge className="text-[10px] px-1 bg-orange-500 text-white border-orange-500 shrink-0">
                        🥡 Retirada
                      </Badge>
                    )}
                    {!arrived && (
                      <Badge variant="outline" className="text-[10px] px-1 text-amber-600 border-amber-500/50 shrink-0">
                        em produção
                      </Badge>
                    )}
                  </div>
                  {/* Sabores */}
                  {flavors.length > 0 && (
                    <div className={cn("font-bold text-foreground", compact ? "text-sm" : "text-lg")}>
                      {flavors.map((f, i) => <p key={i}>{f}</p>)}
                    </div>
                  )}
                  {/* Borda */}
                  {border && (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold animate-pulse bg-orange-600 text-white">
                      🟡 {border}
                    </span>
                  )}
                  {/* Complementos */}
                  {complements.length > 0 && (
                    <p className="text-xs text-muted-foreground">{complements.join(', ')}</p>
                  )}
                  {/* Observações */}
                  {itemNotes && (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold animate-pulse bg-red-600 text-white">
                      ⚠️ OBS: {itemNotes}
                    </span>
                  )}
                </div>

                <div className="shrink-0 mt-0.5">
                  {item.served_at ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-green-600 border-green-500/50 bg-green-500/10",
                        compact && "text-[10px] px-1.5"
                      )}
                    >
                      <Check className={cn("h-3 w-3 mr-1", compact && "h-2.5 w-2.5")} />
                      {format(new Date(item.served_at), 'HH:mm')}
                    </Badge>
                  ) : arrived ? (
                    <Badge
                      variant="outline"
                      className={cn(compact && "text-xs")}
                      style={{ borderColor: stationColor, color: stationColor }}
                    >
                      <Check className={cn("h-3 w-3 mr-1", compact && "h-2.5 w-2.5")} />
                      Chegou
                    </Badge>
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground/50 animate-pulse" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Nome do cliente se houver */}
        {order.customer_name && !order.table && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{order.customer_name}</span>
          </div>
        )}
      </CardContent>
      <DispatchChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        checklist={checklist}
        orderLabel={`Pedido #${order.id.slice(-4).toUpperCase()}`}
        onConfirm={() => { onFinalize(order.id, order.order_type); setChecklistOpen(false); }}
        isProcessing={isProcessing}
      />
    </Card>
  );
}
