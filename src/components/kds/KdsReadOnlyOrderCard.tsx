import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Clock, Store, Truck, XCircle, PackageCheck } from 'lucide-react';
import { KdsSlaIndicator } from './KdsSlaIndicator';
import { useDispatchChecklist } from '@/hooks/useDispatchChecklist';
import { filterPhantomItems } from './kdsItemFilter';
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
}

// Combinar observações do item principal com observações dos sub_items
const getItemNotes = (item: OrderItem): string | null => {
  const mainNotes = item.notes;
  const subNotes = item.sub_items
    ?.filter(si => si.notes)
    .map(si => si.notes)
    .join('; ');
  
  if (mainNotes && subNotes) return `${mainNotes} | ${subNotes}`;
  return mainNotes || subNotes || null;
};

interface Order {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  order_type: string | null;
  status: string | null;
  total: number | null;
  created_at: string | null;
  order_items?: OrderItem[];
  table?: { number: number } | null;
  pager_number?: string | null;
}

interface KdsReadOnlyOrderCardProps {
  order: Order;
  onMarkDelivered?: (orderId: string) => void;
  onCancel?: (order: Order) => void;
  canCancel?: boolean;
  isDelivering?: boolean;
}

const isFlavorSubExtra = (se: { kds_category?: string; group_name?: string }) =>
  se.kds_category === 'flavor' || (se.group_name && se.group_name.toLowerCase().includes('sabor'));

// Extrair sabores dos extras usando kds_category
const getFlavors = (extras?: Array<{ extra_name: string; kds_category?: string }>, subItems?: OrderItem['sub_items']): string[] => {
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
    const fallback = extras
      .filter(e => {
        const lower = e.extra_name.toLowerCase();
        return lower.includes('sabor') && !lower.includes('borda') && !lower.includes('massa');
      });
    if (fallback.length > 0) {
      const fallbackTotal = fallback.length;
      return fallback.map(e => {
        const parts = e.extra_name.split(':');
        const name = parts.length > 1 ? parts[1].trim() : e.extra_name;
        return fallbackTotal > 1 ? `1/${fallbackTotal} ${name}` : name;
      });
    }
  }
  if (subItems && subItems.length > 0) {
    const totalSubs = subItems.length;
    const flavors: string[] = [];
    for (const si of subItems) {
      const flavorExtra = (si.sub_extras || []).find(se => isFlavorSubExtra(se));
      if (flavorExtra) {
        flavors.push(totalSubs > 1 ? `1/${totalSubs} ${flavorExtra.option_name}` : flavorExtra.option_name);
      }
    }
    if (flavors.length > 0) return flavors;
  }
  return [];
};

// Extrair bordas dos extras
const getBorder = (extras?: Array<{ extra_name: string; kds_category?: string }>, subItems?: OrderItem['sub_items']): string | null => {
  if (extras) {
    const borderExtra = extras.find(e => e.kds_category === 'border') 
      || extras.find(e => { const l = e.extra_name.toLowerCase(); return l.includes('borda') || l.includes('massa'); });
    if (borderExtra) {
      const parts = borderExtra.extra_name.split(':');
      return parts.length > 1 ? parts[1].trim() : borderExtra.extra_name;
    }
  }
  if (subItems && subItems.length > 0) {
    for (const si of subItems) {
      for (const se of si.sub_extras || []) {
        if (se.kds_category === 'border') return se.option_name;
      }
    }
  }
  return null;
};

// Extrair complementos
const getComplements = (extras?: Array<{ extra_name: string; kds_category?: string }>, detectedBorder?: string | null, extractedFlavors?: string[], subItems?: OrderItem['sub_items']): string[] => {
  const result: string[] = [];
  if (extras) {
    result.push(...extras
      .filter(e => e.kds_category !== 'flavor' && e.kds_category !== 'border')
      .filter(e => {
        const l = e.extra_name.toLowerCase();
        return !l.includes('borda') && !l.includes('massa');
      })
      .map(e => { const p = e.extra_name.split(':'); return p.length > 1 ? p[1].trim() : e.extra_name; })
      .filter(name => !detectedBorder || name.toLowerCase() !== detectedBorder.toLowerCase()));
  }
  if (subItems && subItems.length > 0) {
    for (const si of subItems) {
      for (const se of si.sub_extras || []) {
        if (isFlavorSubExtra(se) || se.kds_category === 'border') continue;
        if (extractedFlavors && extractedFlavors.some(f => f.includes(se.option_name))) continue;
        if (!detectedBorder || se.option_name.toLowerCase() !== detectedBorder.toLowerCase()) {
          result.push(se.option_name);
        }
      }
    }
  }
  return result;
};

export function KdsReadOnlyOrderCard({
  order,
  onMarkDelivered,
  onCancel,
  canCancel,
  isDelivering,
}: KdsReadOnlyOrderCardProps) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const isDelivery = order.order_type === 'delivery';
  const isTakeaway = order.order_type === 'takeaway';
  const isDineIn = order.order_type === 'dine_in';
  const isReady = order.status === 'ready';
  const isDelivered = order.status === 'delivered';
  
  const checklist = useDispatchChecklist(order.id);
  
  // Mostrar botão "Marcar Entregue" apenas para pedidos de balcão que estão prontos
  const showDeliverButton = isTakeaway && isReady && onMarkDelivered;

  const handleDeliver = () => {
    if (checklist.length > 0) {
      setChecklistOpen(true);
    } else {
      onMarkDelivered?.(order.id);
    }
  };

  return (
    <Card className={cn(
      "shadow-md transition-all hover:shadow-lg",
      isDelivered && "opacity-60"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">#{order.id.slice(-4).toUpperCase()}</span>
            {isDelivery ? (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                <Truck className="h-3 w-3 mr-1" />
                Delivery
              </Badge>
            ) : isDineIn ? (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                Mesa {order.table?.number || '?'}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                <Store className="h-3 w-3 mr-1" />
                Balcão
              </Badge>
            )}
          </div>
          <KdsSlaIndicator createdAt={order.created_at || ''} size="md" showBackground />
        </div>
        
        {/* Customer info */}
        {order.customer_name && (
          <p className="text-sm font-medium mb-1">{order.customer_name}</p>
        )}
        {isDelivery && order.customer_phone && (
          <p className="text-xs text-muted-foreground mb-1">{order.customer_phone}</p>
        )}
        {isDelivery && order.customer_address && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{order.customer_address}</p>
        )}
        
        {/* Items */}
        <div className="border-t border-border pt-2 mt-2">
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filterPhantomItems(order.order_items || []).slice(0, 5).map((item, idx) => {
              const flavors = getFlavors(item.extras, item.sub_items);
              const border = getBorder(item.extras, item.sub_items);
              const complements = getComplements(item.extras, border, flavors, item.sub_items);
              const itemNotes = getItemNotes(item);
              
              return (
                <div key={idx} className="text-sm space-y-1">
                  {item.fulfillment_type === 'takeaway' && (
                    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white">
                      🥡 RETIRADA
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {item.quantity}x {item.product?.name || 'Produto'}
                    {item.variation?.name && (
                      <span> ({item.variation.name})</span>
                    )}
                  </p>
                  {/* Sabores em destaque */}
                  {flavors.length > 0 && (
                    <div className="text-2xl font-bold text-foreground">
                      {flavors.map((f, i) => (
                        <p key={i}>{f}</p>
                      ))}
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
                    <p className="text-xs text-muted-foreground pl-2">
                      {complements.join(', ')}
                    </p>
                  )}
                  {/* Observações */}
                  {itemNotes && (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold animate-pulse bg-red-600 text-white">
                      ⚠️ OBS: {itemNotes}
                    </span>
                  )}
                </div>
              );
            })}
            {(() => { const filtered = filterPhantomItems(order.order_items || []); return filtered.length > 5 ? (
              <p className="text-xs text-muted-foreground">
                +{filtered.length - 5} itens...
              </p>
            ) : null; })()}
          </div>
          {order.pager_number && order.order_type === 'takeaway' && (
            <Badge className="bg-amber-500 text-white border-amber-400 text-base font-bold px-3 py-1 animate-pulse">
              📟 PAGER #{order.pager_number}
            </Badge>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary text-lg">
              R$ {(order.total || 0).toFixed(2)}
            </span>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {/* Botão Marcar Entregue - apenas para Balcão + Pronto */}
            {showDeliverButton && (
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleDeliver}
                disabled={isDelivering}
              >
                <PackageCheck className="h-4 w-4 mr-2" />
                {isDelivering ? 'Processando...' : 'Marcar Entregue'}
              </Button>
            )}
            
            {/* Botão Cancelar */}
            {canCancel && !isDelivered && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:bg-destructive/10"
                onClick={() => onCancel(order)}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancelar Pedido
              </Button>
            )}
          </div>
        </div>
      </CardContent>
      <DispatchChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        checklist={checklist}
        orderLabel={`Pedido #${order.id.slice(-4).toUpperCase()}`}
        onConfirm={() => { onMarkDelivered?.(order.id); setChecklistOpen(false); }}
        isProcessing={isDelivering}
      />
    </Card>
  );
}
