import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/pages/store/StorePage';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';

interface StoreCartProps {
  items: CartItem[];
  open: boolean;
  onClose: () => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  total: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function StoreCart({ items, open, onClose, onUpdateQuantity, onRemove, onCheckout, total }: StoreCartProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-500" />
            Sua Sacola ({items.length})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-16 w-16 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium">Sacola vazia</p>
              <p className="text-xs mt-1">Adicione itens do cardápio</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex gap-3 p-3 rounded-xl border border-border bg-card">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.product_name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 text-xl">🍕</div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold truncate">{item.product_name}</h4>
                  {item.complements && item.complements.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.complements.map(c => c.quantity > 1 ? `${c.quantity}x ${c.option_name}` : c.option_name).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-amber-700 italic mt-0.5 truncate">
                      📝 {item.notes}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-border rounded-lg">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-l-lg transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-r-lg transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{formatCurrency(item.total_price)}</span>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border p-4 space-y-3 bg-card flex-shrink-0">
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <Button
              onClick={onCheckout}
              className="w-full h-13 text-base font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
            >
              Finalizar Pedido
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
