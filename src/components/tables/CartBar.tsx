import { ShoppingCart, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/components/order/AddOrderItemsModal';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface CartBarProps {
  items: CartItem[];
  onClick: () => void;
  className?: string;
}

export function CartBar({ items, onClick, className }: CartBarProps) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.total_price, 0);

  if (items.length === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-primary text-primary-foreground",
        "px-4 py-3 flex items-center justify-between",
        "shadow-[0_-4px_20px_rgba(0,0,0,0.15)]",
        "active:bg-primary/90 transition-colors",
        "safe-area-inset-bottom",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-background text-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {itemCount}
          </span>
        </div>
        <span className="font-medium">
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="font-bold text-lg">{formatCurrency(total)}</span>
        <ChevronRight className="h-5 w-5" />
      </div>
    </button>
  );
}
