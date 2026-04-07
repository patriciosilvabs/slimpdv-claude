import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { CartItem } from '@/pages/store/StorePage';

interface PizzaCartTabProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  onGoToMenu: () => void;
  total: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function PizzaCartTab({ items, onUpdateQuantity, onRemove, onCheckout, onGoToMenu, total }: PizzaCartTabProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: 'hsl(var(--store-primary-light))' }}>
          <ShoppingBag className="h-10 w-10 text-[hsl(var(--store-primary))]" />
        </div>
        <h3 className="text-xl font-bold mb-1" style={{ color: 'hsl(var(--store-card-foreground))' }}>Sacola vazia</h3>
        <p className="text-sm mb-6" style={{ color: 'hsl(var(--store-muted))' }}>Adicione itens do cardápio para começar</p>
        <button
          onClick={onGoToMenu}
          className="h-12 px-8 rounded-2xl bg-[hsl(var(--store-primary))] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-[0.97]"
        >
          Ver Cardápio
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      <div className="px-4 pt-6 pb-2 max-w-lg mx-auto w-full">
        <h2 className="text-2xl font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Sua Sacola</h2>
        <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--store-muted))' }}>{items.length} {items.length === 1 ? 'item' : 'itens'}</p>
      </div>

      <div className="flex-1 px-4 py-3 max-w-lg mx-auto w-full space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex gap-3 p-3 rounded-2xl bg-white border" style={{ borderColor: 'hsl(var(--store-border))' }}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.product_name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center flex-shrink-0 text-2xl">🍕</div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold truncate" style={{ color: 'hsl(var(--store-card-foreground))' }}>{item.product_name}</h4>
              {item.complements && item.complements.length > 0 && (
                <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'hsl(var(--store-muted))' }}>
                  {item.complements.map(c => c.quantity > 1 ? `${c.quantity}x ${c.option_name}` : c.option_name).join(', ')}
                </p>
              )}
              {item.notes && (
                <p className="text-[11px] italic mt-0.5 truncate text-amber-600">📝 {item.notes}</p>
              )}
              <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center rounded-xl overflow-hidden border" style={{ borderColor: 'hsl(var(--store-border))' }}>
                  <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="h-8 w-8 flex items-center justify-center hover:bg-gray-50 transition-colors">
                    {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-[hsl(var(--store-primary))]" /> : <Minus className="h-3.5 w-3.5" />}
                  </button>
                  <span className="w-8 text-center text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{item.quantity}</span>
                  <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="h-8 w-8 flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-sm font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{formatCurrency(item.total_price)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed bottom checkout bar */}
      <div className="sticky bottom-20 px-4 pb-4 max-w-lg mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-xl border p-4 space-y-3" style={{ borderColor: 'hsl(var(--store-border))' }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium" style={{ color: 'hsl(var(--store-muted))' }}>Total</span>
            <span className="text-xl font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{formatCurrency(total)}</span>
          </div>
          <button
            onClick={onCheckout}
            className="w-full h-14 rounded-2xl bg-[hsl(var(--store-primary))] text-white font-bold text-base shadow-lg hover:shadow-xl transition-all active:scale-[0.97]"
          >
            Confirmar Pedido — {formatCurrency(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
