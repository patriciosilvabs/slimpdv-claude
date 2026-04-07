import { StoreData } from '@/hooks/usePublicStore';

interface PizzaProductCardProps {
  product: StoreData['products'][0];
  onSelect: (product: StoreData['products'][0]) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function PizzaProductCard({ product, onSelect }: PizzaProductCardProps) {
  const hasPromo = product.is_promotion && product.promotion_price;

  return (
    <button
      onClick={() => onSelect(product)}
      className="w-full flex gap-3 p-3 rounded-2xl bg-white border text-left group transition-all hover:shadow-lg active:scale-[0.98]"
      style={{ borderColor: 'hsl(var(--store-border))' }}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start gap-2">
            <h4 className="text-sm font-bold leading-tight" style={{ color: 'hsl(var(--store-card-foreground))' }}>
              {product.name}
            </h4>
            {product.is_featured && (
              <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--store-primary-light))] text-[hsl(var(--store-primary))]">
                ★ Mais vendido
              </span>
            )}
          </div>
          {product.label && !product.is_featured && (
            <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
              {product.label}
            </span>
          )}
          {product.description && (
            <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: 'hsl(var(--store-muted))' }}>
              {product.description}
            </p>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          {hasPromo ? (
            <>
              <span className="text-sm font-extrabold text-[hsl(var(--store-primary))]">{formatCurrency(product.promotion_price!)}</span>
              <span className="text-xs line-through" style={{ color: 'hsl(var(--store-muted))' }}>{formatCurrency(product.price)}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                {Math.round(((product.price - product.promotion_price!) / product.price) * 100)}% OFF
              </span>
            </>
          ) : product.price > 0 ? (
            <span className="text-sm font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{formatCurrency(product.price)}</span>
          ) : (
            <span className="text-xs font-medium" style={{ color: 'hsl(var(--store-muted))' }}>A partir de...</span>
          )}
        </div>
      </div>

      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-24 h-24 rounded-2xl object-cover flex-shrink-0 shadow-sm"
          loading="lazy"
        />
      ) : (
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center flex-shrink-0 text-4xl">
          🍕
        </div>
      )}
    </button>
  );
}
