import { Badge } from '@/components/ui/badge';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_promotion: boolean;
  promotion_price: number | null;
  label: string | null;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface StoreProductGridProps {
  products: Product[];
  categories: Category[];
  selectedCategory: string | null;
  onSelect: (product: Product) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function StoreProductGrid({ products, categories, selectedCategory, onSelect }: StoreProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-5xl mb-3">🍽️</p>
        <p className="text-sm">Nenhum produto encontrado</p>
      </div>
    );
  }

  // Group products by category for "Todos" view
  if (!selectedCategory) {
    const grouped = categories
      .map(cat => ({
        category: cat,
        items: products.filter(p => p.category_id === cat.id),
      }))
      .filter(g => g.items.length > 0);

    const uncategorized = products.filter(p => !p.category_id || !categories.find(c => c.id === p.category_id));

    return (
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-8">
        {uncategorized.length > 0 && grouped.length === 0 && (
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {uncategorized.map(product => (
                <ProductCard key={product.id} product={product} onSelect={onSelect} />
              ))}
            </div>
          </section>
        )}
        {grouped.map(({ category, items }) => (
          <section key={category.id} id={`cat-${category.id}`}>
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              {category.icon && <span>{category.icon}</span>}
              {category.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map(product => (
                <ProductCard key={product.id} product={product} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map(product => (
          <ProductCard key={product.id} product={product} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const hasPromo = product.is_promotion && product.promotion_price;

  return (
    <button
      onClick={() => onSelect(product)}
      className="w-full flex gap-3 p-3 rounded-xl bg-card border border-border hover:shadow-lg hover:border-amber-300/50 transition-all text-left group"
    >
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start gap-2">
            <h3 className="text-sm font-semibold leading-tight text-foreground group-hover:text-amber-700 transition-colors">
              {product.name}
            </h3>
            {product.label && (
              <Badge className="text-[10px] px-1.5 py-0 flex-shrink-0 bg-amber-100 text-amber-800 border-amber-200">
                {product.label}
              </Badge>
            )}
          </div>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          {hasPromo ? (
            <>
              <span className="text-sm font-bold text-amber-600">{formatCurrency(product.promotion_price!)}</span>
              <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</span>
            </>
          ) : product.price > 0 ? (
            <span className="text-sm font-bold text-foreground">{formatCurrency(product.price)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">A partir de...</span>
          )}
        </div>
      </div>
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-24 h-24 rounded-xl object-cover flex-shrink-0 shadow-sm"
          loading="lazy"
        />
      ) : (
        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center flex-shrink-0 text-3xl">
          🍕
        </div>
      )}
    </button>
  );
}
