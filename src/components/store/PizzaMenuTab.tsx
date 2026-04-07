import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PizzaProductCard } from './PizzaProductCard';
import { StoreData } from '@/hooks/usePublicStore';
import { cn } from '@/lib/utils';

interface PizzaMenuTabProps {
  store: StoreData;
  onSelectProduct: (product: StoreData['products'][0]) => void;
}

export function PizzaMenuTab({ store, onSelectProduct }: PizzaMenuTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = store.categories || [];
  const products = store.products || [];

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    return filtered;
  }, [products, selectedCategory, searchQuery]);

  const grouped = useMemo(() => {
    if (selectedCategory || searchQuery.trim()) return null;
    return categories
      .map(cat => ({ category: cat, items: products.filter(p => p.category_id === cat.id) }))
      .filter(g => g.items.length > 0);
  }, [categories, products, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-2 max-w-lg mx-auto w-full">
        <h2 className="text-2xl font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Cardápio</h2>
        <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--store-muted))' }}>Escolha sua pizza favorita</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 max-w-lg mx-auto w-full">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'hsl(var(--store-muted))' }} />
          <Input
            placeholder="Buscar no cardápio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-2xl border-0 text-sm font-medium shadow-sm"
            style={{ background: 'white', color: 'hsl(var(--store-card-foreground))' }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 max-w-lg mx-auto w-full">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap",
              !selectedCategory
                ? "bg-[hsl(var(--store-primary))] text-white shadow-md"
                : "bg-white text-[hsl(var(--store-card-foreground))] border"
            )}
            style={selectedCategory ? { borderColor: 'hsl(var(--store-border))' } : undefined}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5",
                selectedCategory === cat.id
                  ? "bg-[hsl(var(--store-primary))] text-white shadow-md"
                  : "bg-white text-[hsl(var(--store-card-foreground))] border"
              )}
              style={selectedCategory !== cat.id ? { borderColor: 'hsl(var(--store-border))' } : undefined}
            >
              {cat.icon && <span className="text-sm">{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product List */}
      <div className="px-4 py-3 max-w-lg mx-auto w-full space-y-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-3">🍽️</span>
            <p className="text-sm font-medium" style={{ color: 'hsl(var(--store-muted))' }}>Nenhum produto encontrado</p>
          </div>
        ) : grouped ? (
          grouped.map(({ category, items }) => (
            <section key={category.id}>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'hsl(var(--store-card-foreground))' }}>
                {category.icon && <span>{category.icon}</span>}
                {category.name}
              </h3>
              <div className="space-y-3">
                {items.map(product => (
                  <PizzaProductCard key={product.id} product={product} onSelect={onSelectProduct} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="space-y-3">
            {filteredProducts.map(product => (
              <PizzaProductCard key={product.id} product={product} onSelect={onSelectProduct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
