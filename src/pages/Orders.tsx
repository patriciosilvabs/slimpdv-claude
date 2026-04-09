import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOrders, Order, OrderStatus } from '@/hooks/useOrders';
import { Clock, ChefHat, CheckCircle, XCircle, Printer, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { printKitchenReceipt } from '@/components/kitchen/KitchenReceipt';
import { Badge } from '@/components/ui/badge';
import { usePrinterOptional } from '@/contexts/PrinterContext';

const statusConfig: Record<OrderStatus, { label: string; icon: any; color: string }> = {
  pending: { label: 'Pendente', icon: Clock, color: 'bg-warning text-warning-foreground' },
  preparing: { label: 'Preparando', icon: ChefHat, color: 'bg-info text-info-foreground' },
  ready: { label: 'Pronto', icon: CheckCircle, color: 'bg-accent text-accent-foreground' },
  delivered: { label: 'Entregue', icon: CheckCircle, color: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', icon: XCircle, color: 'bg-destructive text-destructive-foreground' },
  delivering: { label: 'Em Entrega', icon: Package, color: 'bg-info text-info-foreground' },
  dispatched: { label: 'Despachado', icon: Package, color: 'bg-accent text-accent-foreground' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function Orders() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Buscar apenas pedidos do histórico (delivered + cancelled)
  const historyStatuses: OrderStatus[] = ['delivered', 'cancelled'];
  const { data: historyOrders } = useOrders(historyStatuses);
  const printer = usePrinterOptional();

  if (!permissionsLoading && !hasPermission('orders_view')) {
    return <AccessDenied permission="orders_view" />;
  }

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos</h1>
            <p className="text-muted-foreground">Histórico de pedidos do estabelecimento</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-3">
              {historyOrders?.map((order) => {
                const config = statusConfig[order.status];
                const Icon = config.icon;
                return (
                  <Card
                    key={order.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      selectedOrder?.id === order.id && 'ring-2 ring-primary'
                    )}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg', config.color)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {order.table?.number ? `Mesa ${order.table.number}` :
                               order.customer_name || `#${order.id.slice(0, 8)}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.order_items?.length || 0} itens • {config.label}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleTimeString('pt-BR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {(!historyOrders || historyOrders.length === 0) && (
                <p className="text-center py-12 text-muted-foreground">
                  Nenhum pedido encontrado
                </p>
              )}
            </div>
          </div>

          {/* Order Details */}
          <div className="space-y-4">
            {selectedOrder ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {selectedOrder.table?.number ? `Mesa ${selectedOrder.table.number}` :
                       selectedOrder.customer_name || `Pedido #${selectedOrder.id.slice(0, 8)}`}
                    </CardTitle>
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      statusConfig[selectedOrder.status].color
                    )}>
                      {statusConfig[selectedOrder.status].label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Items */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedOrder.order_items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.product?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.unit_price)}
                          </p>
                          {item.notes?.startsWith('[Combo:') && (
                            <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                              <Package className="h-3 w-3 mr-1" />
                              {item.notes.replace('[Combo: ', '').replace(']', '')}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium">{formatCurrency(item.total_price)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(selectedOrder.total)}
                    </span>
                  </div>

                  {/* Print Button */}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => printKitchenReceipt(selectedOrder, '80mm', printer)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Comanda
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Selecione um pedido para ver os detalhes</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PDVLayout>
  );
}