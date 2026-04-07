import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/components/order/AddOrderItemsModal';
import { CartItemList } from './CartItemList';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface CartReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  tableNumber?: number;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onDuplicateItem: (itemId: string) => void;
  onToggleFulfillment?: (itemId: string) => void;
  onConfirm: () => void;
  onClearAll: () => void;
  isSubmitting?: boolean;
  duplicateItems?: boolean;
}

export function CartReviewSheet({
  open,
  onOpenChange,
  items,
  tableNumber,
  onRemoveItem,
  onUpdateQuantity,
  onDuplicateItem,
  onToggleFulfillment,
  onConfirm,
  onClearAll,
  isSubmitting = false,
  duplicateItems = false,
}: CartReviewSheetProps) {
  const total = items.reduce((sum, item) => sum + item.total_price, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <SheetTitle className="text-left">
              Revisar Pedido {tableNumber ? `- Mesa ${tableNumber}` : ''}
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Cart items */}
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
            maxHeight="h-full"
          />
        </div>

        {/* Footer */}
        <div className="border-t p-4 space-y-3 flex-shrink-0 bg-background">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </span>
            <div className="text-right">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <p className="text-xl font-bold text-primary">{formatCurrency(total)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={onClearAll}
              disabled={isSubmitting || items.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button 
              className="flex-[2]"
              size="lg"
              onClick={onConfirm}
              disabled={isSubmitting || items.length === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Enviando...' : 'Enviar para Cozinha'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
