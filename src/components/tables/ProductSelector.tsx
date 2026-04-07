import { useState, useMemo, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ProductDetailDialog, SelectedComplement, SubItemComplement, PizzaConfig } from '@/components/order/ProductDetailDialog';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { calculateFullComplementsPrice, ComplementForCalc, SubItemForCalc } from '@/lib/complementPriceUtils';
import { CartItem } from '@/components/order/AddOrderItemsModal';
import { usePizzaProducts } from '@/hooks/usePizzaProducts';
import { cn } from '@/lib/utils';
import { Search, X, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ProductSelectorProps {
  onAddItem: (item: CartItem) => void;
  className?: string;
}

export function ProductSelector({ onAddItem, className }: ProductSelectorProps) {
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: categories } = useCategories();
  const { duplicateItems, duplicateItemsMaxQty } = useOrderSettings();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: pizzaData, isLoading: pizzaDataLoading } = usePizzaProducts();
  const pendingProductRef = useRef<any>(null);

  const activeCategories = useMemo(
    () => categories?.filter(c => c.is_active !== false) || [],
    [categories]
  );

  const firstCategoryId = activeCategories[0]?.id || null;
  const effectiveCategory = selectedCategory ?? firstCategoryId;

  const activeProducts = useMemo(
    () => products?.filter(p => p.is_available !== false) || [],
    [products]
  );

  const filteredProducts = useMemo(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      return activeProducts.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.pdv_code?.toLowerCase().includes(query)
      );
    }

    return effectiveCategory
      ? activeProducts.filter(product => product.category_id === effectiveCategory)
      : [];
  }, [activeProducts, effectiveCategory, searchQuery]);

  useEffect(() => {
    if (!pizzaDataLoading && pendingProductRef.current) {
      const product = pendingProductRef.current;
      pendingProductRef.current = null;
      processProductClick(product);
    }
  }, [pizzaDataLoading]);

  const processProductClick = (product: any) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  const handleProductClick = (product: any) => {
    if (pizzaDataLoading) {
      pendingProductRef.current = product;
      setSelectedProduct(product);
      return;
    }
    processProductClick(product);
  };

  const selectedPizzaConfig: PizzaConfig | undefined = useMemo(() => {
    if (!selectedProduct || !pizzaData) return undefined;
    const config = pizzaData.configMap.get(selectedProduct.id);
    if (!config || !config.flavorModalEnabled || !config.flavorModalChannels.includes('table')) return undefined;
    return {
      flavorOptions: config.flavorOptions,
      maxFlavors: pizzaData.maxFlavorsMap.get(selectedProduct.id) ?? 2,
    };
  }, [selectedProduct, pizzaData]);

  const handleAddProduct = (
    product: any,
    quantity: number,
    complements: SelectedComplement[],
    notes: string,
    subItems?: SubItemComplement[]
  ) => {
    const groupPriceTypes: Record<string, 'sum' | 'average' | 'highest' | 'lowest'> = {};
    for (const c of complements) {
      if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
        groupPriceTypes[c.group_id] = c.price_calculation_type;
      }
    }
    if (subItems) {
      for (const subItem of subItems) {
        for (const c of subItem.complements) {
          if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
            groupPriceTypes[c.group_id] = c.price_calculation_type;
          }
        }
      }
    }

    const sharedComplements: ComplementForCalc[] = complements.map(c => ({
      group_id: c.group_id,
      price: c.price,
      quantity: c.quantity,
    }));
    const subItemsForCalc: SubItemForCalc[] | undefined = subItems?.map(si => ({
      complements: si.complements.map(c => ({
        group_id: c.group_id,
        price: c.price,
        quantity: c.quantity,
      })),
    }));

    const complementsTotal = calculateFullComplementsPrice(sharedComplements, subItemsForCalc, groupPriceTypes);

    const productPrice = product.is_promotion && product.promotion_price
      ? product.promotion_price
      : product.price;
    const unitPrice = productPrice + complementsTotal;

    const shouldDuplicate = duplicateItems && quantity > 1 && (duplicateItemsMaxQty === 0 || quantity <= duplicateItemsMaxQty);

    if (shouldDuplicate) {
      for (let i = 0; i < quantity; i++) {
        onAddItem({
          id: `${product.id}-${Date.now()}-${i}`,
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: unitPrice,
          total_price: unitPrice,
          notes,
          complements,
          print_sector_id: product.print_sector_id,
          subItems,
        });
      }
    } else {
      onAddItem({
        id: `${product.id}-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        notes,
        complements,
        print_sector_id: product.print_sector_id,
        subItems,
      });
    }
  };

  return (
    <>
      <div className={cn('flex h-full min-h-0 bg-background', className)}>
        <div className="w-60 border-r bg-background flex-shrink-0 flex flex-col">
          <div className="px-4 py-5 border-b">
            <h3 className="font-semibold text-lg">Categorias</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {activeCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'w-full text-left px-4 py-4 text-sm transition-colors border-b border-border break-words',
                    effectiveCategory === cat.id
                      ? 'bg-muted font-bold text-foreground'
                      : 'hover:bg-muted/50 text-muted-foreground font-normal'
                  )}
                >
                  {cat.icon && <span className="mr-2">{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b bg-background">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Encontre produtos por nome ou código PDV (Ctrl + b)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {productsLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                      <Skeleton className="w-14 h-14 rounded-md flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhum produto encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all"
                    >
                      <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Sem foto</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm leading-tight break-words uppercase">{product.name}</p>
                        <div className="mt-1">
                          {product.is_promotion && product.promotion_price ? (
                            <>
                              <span className="text-foreground text-sm">
                                {formatCurrency(product.promotion_price)}
                              </span>
                              <span className="text-muted-foreground text-xs ml-1">
                                ({formatCurrency(product.price)})
                              </span>
                            </>
                          ) : (
                            <span className="text-foreground text-sm">
                              {formatCurrency(product.price)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <ProductDetailDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onAdd={handleAddProduct}
        duplicateItems={duplicateItems}
        duplicateItemsMaxQty={duplicateItemsMaxQty}
        channel="table"
        pizzaConfig={selectedPizzaConfig}
      />
    </>
  );
}
