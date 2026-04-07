import { Button } from '@/components/ui/button';
import { ShoppingCart, Send, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/components/order/AddOrderItemsModal';
import { CartItemList } from './CartItemList';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface PendingCartPanelProps {
  items: CartItem[];
  tableNumber?: number;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onDuplicateItem: (itemId: string) => void;
  onToggleFulfillment?: (itemId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  duplicateItems?: boolean;
  className?: string;
}

export function PendingCartPanel({
  items,
  tableNumber,
  onRemoveItem,
  onUpdateQuantity,
  onDuplicateItem,
  onToggleFulfillment,
  onConfirm,
  onCancel,
  isSubmitting = false,
  duplicateItems = false,
  className,
}: PendingCartPanelProps) {
  const total = items.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      <div className="p-4 border-b flex items-start justify-between flex-shrink-0">
        <div>
          <h3 className="font-semibold text-lg">Novo pedido</h3>
          {tableNumber ? <p className="text-xs text-muted-foreground mt-1">Mesa {tableNumber}</p> : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 pt-3 pb-1 border-b flex-shrink-0">
        <h4 className="font-semibold text-base text-foreground">Carrinho</h4>
      </div>

      <div className="flex-1 overflow-hidden">
        <CartItemList
          items={items}
          onRemoveItem={onRemoveItem}
          onUpdateQuantity={onUpdateQuantity}
          onDuplicateItem={onDuplicateItem}
          onToggleFulfillment={onToggleFulfillment}
          duplicateItems={duplicateItems}
          showQuantityControls={true}
          showFulfillmentToggle={!!onToggleFulfillment}
          compact={true}
          maxHeight="h-full"
        />
      </div>

      <div className="border-t p-3 space-y-3 flex-shrink-0 bg-background">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>

        <div className="space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={onConfirm}
            disabled={isSubmitting || items.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Enviando...' : 'Enviar para Cozinha'}
          </Button>

          {items.length > 0 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

