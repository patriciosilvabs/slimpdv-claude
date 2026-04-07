import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { KdsSlaIndicator } from './KdsSlaIndicator';
import { KdsItemBadges, getFlavorsFromExtras } from './KdsItemBadges';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, CheckCircle, Package, XCircle, Store, Truck } from 'lucide-react';
import { isToday, format } from 'date-fns';
import type { Order as UseOrdersOrder } from '@/hooks/useOrders';

interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  notes: string | null;
  status: string;
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

interface KdsKanbanReadOnlyProps {
  orders: UseOrdersOrder[];
  isLoading: boolean;
  onMarkDelivered?: (orderId: string) => void;
  onCancelOrder?: (order: Order) => void;
  isMarkingDelivered?: boolean;
}

// Order card component for Kanban view
function KanbanOrderCard({
  order,
  settings,
  onMarkDelivered,
  onCancelOrder,
  isMarkingDelivered,
  showDeliveredButton = false,
}: {
  order: Order;
  settings: { showWaiterName: boolean; compactMode: boolean };
  onMarkDelivered?: (orderId: string) => void;
  onCancelOrder?: (order: Order) => void;
  isMarkingDelivered?: boolean;
  showDeliveredButton?: boolean;
}) {
  const isCompact = settings.compactMode;
  const waiterName = order.order_items?.find(i => i.added_by_profile?.name)?.added_by_profile?.name;
  const itemsToShow = order.order_items?.filter(item => item.status === 'pending' || item.status === 'preparing') || [];
  const displayItems = isCompact ? itemsToShow.slice(0, 3) : itemsToShow.slice(0, 6);
  const hiddenCount = Math.max(0, itemsToShow.length - displayItems.length);

  const getOrderOrigin = () => {
    if (order.order_type === 'delivery') {
      return { icon: Truck, label: 'DELIVERY', color: 'text-purple-500 bg-purple-500/10' };
    }
    if (order.order_type === 'takeaway') {
      return { icon: Store, label: 'BALCÃO', color: 'text-orange-500 bg-orange-500/10' };
    }
    return { icon: Store, label: `MESA ${order.table?.number || '?'}`, color: 'text-blue-500 bg-blue-500/10' };
  };

  const origin = getOrderOrigin();
  const OriginIcon = origin.icon;
  const canMarkDelivered = showDeliveredButton && order.order_type === 'takeaway' && order.status === 'ready';

  return (
    <Card className={cn("shadow-md", isCompact ? "mb-1.5" : "mb-3")}>
      <CardHeader className={cn("pb-2 pt-3 px-4", isCompact && "pb-1 pt-2 px-3")}>
        <div className="flex items-center justify-between">
          <Badge className={cn("py-1 px-2 text-xs font-bold", origin.color, isCompact && "py-0.5 px-1.5")}>
            <OriginIcon className={cn("h-3.5 w-3.5 mr-1", isCompact && "h-3 w-3")} />
            {origin.label}
          </Badge>
          <KdsSlaIndicator createdAt={order.updated_at || order.created_at} size={isCompact ? "sm" : "md"} showBackground />
        </div>
        <div className={cn("flex items-center gap-2 mt-1 text-xs text-muted-foreground", isCompact && "mt-0.5")}>
          <span className="font-mono">#{order.id.slice(-4).toUpperCase()}</span>
          {!isCompact && order.customer_name && (
            <span className="font-medium text-primary">• {order.customer_name}</span>
          )}
          {settings.showWaiterName && waiterName && !isCompact && (
            <span className="text-blue-600">👤 {waiterName}</span>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn("px-4 pb-3", isCompact && "px-3 pb-2")}>
        <div className={cn("space-y-2 mb-3 border rounded-lg p-2 bg-background/50", isCompact && "space-y-1 mb-2 p-1.5")}>
          {displayItems.map((item, idx) => {
            const flavors = getFlavorsFromExtras(item.extras, item.sub_items);
            return (
              <div key={idx} className={cn("text-sm", isCompact && "text-xs")}>
                <div className="flex items-start gap-1">
                  <span className="font-bold text-primary">{item.quantity}x</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
                      {!isCompact && item.variation?.name && (
                        <span className="text-muted-foreground">({item.variation.name})</span>
                      )}
                    </div>
                    
                    {/* Tarjas de borda e observações - SEMPRE animadas */}
                    <KdsItemBadges 
                      notes={item.notes} 
                      extras={item.extras} 
                      compact={isCompact} 
                    />
                    
                    {/* Sabores */}
                    {!isCompact && flavors.length > 0 && (
                      <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        {flavors.map((f, i) => (
                          <p key={i}>🍕 {f}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground text-center">+{hiddenCount} mais...</p>
          )}
        </div>

        {!isCompact && order.notes && (
          <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded p-2 mb-3">
            <strong>Obs:</strong> {order.notes}
          </div>
        )}

        {order.total != null && !isCompact && (
          <div className="text-sm font-semibold text-right pb-2 border-b mb-2">
            Total: R$ {order.total.toFixed(2)}
          </div>
        )}

        {/* Action buttons */}
        {(canMarkDelivered || onCancelOrder) && (
          <div className="flex gap-2">
            {canMarkDelivered && onMarkDelivered && (
              <Button 
                className="flex-1"
                size={isCompact ? "sm" : "default"}
                onClick={() => onMarkDelivered(order.id)}
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
        )}
      </CardContent>
    </Card>
  );
}

export function KdsKanbanReadOnly({ 
  orders, 
  isLoading,
  onMarkDelivered,
  onCancelOrder,
  isMarkingDelivered,
}: KdsKanbanReadOnlyProps) {
  const { settings } = useKdsSettings();

  // Cast orders to local type
  const typedOrders = orders as unknown as Order[];

  // Filter orders - only takeaway and delivery, exclude drafts
  const filteredOrders = useMemo(() => {
    return typedOrders.filter(o => 
      (o as any).is_draft !== true &&
      (o.order_type === 'takeaway' || o.order_type === 'delivery') &&
      (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')
    );
  }, [typedOrders]);

  // Group by status
  const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
  const preparingOrders = settings.kanbanVisibleColumns.includes('pending')
    ? filteredOrders.filter(o => o.status === 'preparing')
    : filteredOrders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const readyOrders = filteredOrders.filter(o => o.status === 'ready');

  // Delivered orders from today
  const deliveredOrdersToday = useMemo(() => {
    return typedOrders
      .filter(o => 
        (o as any).is_draft !== true &&
        (o.order_type === 'takeaway' || o.order_type === 'delivery') &&
        o.status === 'delivered' && 
        isToday(new Date(o.delivered_at || o.updated_at))
      )
      .sort((a, b) => {
        const dateA = new Date(a.delivered_at || a.updated_at);
        const dateB = new Date(b.delivered_at || b.updated_at);
        return dateB.getTime() - dateA.getTime();
      });
  }, [typedOrders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const KanbanColumn = ({ 
    title, 
    orders: columnOrders, 
    icon: Icon, 
    headerColor,
    showDeliveredButton = false,
  }: { 
    title: string; 
    orders: Order[]; 
    icon: React.ElementType;
    headerColor: string;
    showDeliveredButton?: boolean;
  }) => {
    const isCompact = settings.compactMode;
    
    return (
      <div className="flex flex-col h-full">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-lg",
          headerColor,
          isCompact && "px-2 py-1.5"
        )}>
          <Icon className={cn("h-5 w-5", isCompact && "h-4 w-4")} />
          <span className={cn("font-bold", isCompact && "text-sm")}>{title}</span>
          <Badge variant="secondary" className={cn("ml-auto", isCompact && "text-xs px-1.5 py-0")}>
            {columnOrders.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1 bg-muted/30 rounded-b-lg p-2">
          {columnOrders.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Nenhum pedido
            </div>
          ) : (
            columnOrders.map(order => (
              <KanbanOrderCard
                key={order.id}
                order={order}
                settings={{
                  showWaiterName: settings.showWaiterName,
                  compactMode: settings.compactMode,
                }}
                onMarkDelivered={onMarkDelivered}
                onCancelOrder={onCancelOrder}
                isMarkingDelivered={isMarkingDelivered}
                showDeliveredButton={showDeliveredButton}
              />
            ))
          )}
        </ScrollArea>
      </div>
    );
  };

  // Determine which columns to show based on kanbanVisibleColumns
  const visibleColumns = settings.kanbanVisibleColumns;
  const showPending = visibleColumns.includes('pending');
  const showPreparing = visibleColumns.includes('preparing');
  const showReady = visibleColumns.includes('ready');
  const showDeliveredToday = visibleColumns.includes('delivered_today');
  
  // Count visible columns for grid
  const visibleCount = [showPending, showPreparing, showReady, showDeliveredToday].filter(Boolean).length;
  
  const gridCols = visibleCount === 4 
    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    : visibleCount === 3
    ? "grid-cols-1 md:grid-cols-3"
    : visibleCount === 2
    ? "grid-cols-1 md:grid-cols-2"
    : "grid-cols-1";

  return (
    <div className={cn("grid gap-4 h-[calc(100vh-200px)]", gridCols)}>
      {showPending && (
        <KanbanColumn
          title={settings.columnNamePending}
          orders={pendingOrders}
          icon={Clock}
          headerColor="bg-yellow-500 text-yellow-950"
        />
      )}
      {showPreparing && (
        <KanbanColumn
          title={settings.columnNamePreparing}
          orders={preparingOrders}
          icon={ChefHat}
          headerColor="bg-blue-500 text-white"
        />
      )}
      {showReady && (
        <KanbanColumn
          title={settings.columnNameReady}
          orders={readyOrders}
          icon={CheckCircle}
          headerColor="bg-green-500 text-white"
          showDeliveredButton
        />
      )}
      {showDeliveredToday && (
        <KanbanColumn
          title={settings.columnNameDelivered}
          orders={deliveredOrdersToday}
          icon={Package}
          headerColor="bg-gray-500 text-white"
        />
      )}
    </div>
  );
}
