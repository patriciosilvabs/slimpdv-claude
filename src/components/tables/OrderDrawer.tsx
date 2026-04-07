import { useState, useMemo, useEffect, useRef } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ProductDetailDialog, SelectedComplement, SubItemComplement, PizzaConfig } from '@/components/order/ProductDetailDialog';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { usePizzaProducts } from '@/hooks/usePizzaProducts';
import { calculateFullComplementsPrice, ComplementForCalc, SubItemForCalc } from '@/lib/complementPriceUtils';
import { CartItem } from '@/components/order/AddOrderItemsModal';
import { X, ShoppingCart, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface OrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber?: number;
  onAddItem: (item: CartItem) => void;
  pendingItemsCount: number;
  cartItems: CartItem[];
  onCartClick: () => void;
}

export function OrderDrawer({ 
  open, 
  onOpenChange, 
  tableNumber,
  onAddItem,
  pendingItemsCount,
  cartItems,
  onCartClick,
}: OrderDrawerProps) {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { duplicateItems, duplicateItemsMaxQty } = useOrderSettings();
  const { data: pizzaData, isLoading: pizzaDataLoading } = usePizzaProducts();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const pendingProductRef = useRef<any>(null);

  const activeCategories = useMemo(() => 
    categories?.filter(c => c.is_active !== false) || [], 
    [categories]
  );
  
  const firstCategoryId = activeCategories[0]?.id || null;
  const effectiveCategory = selectedCategory ?? firstCategoryId;

  const activeProducts = useMemo(() => 
    products?.filter(p => p.is_available !== false) || [],
    [products]
  );

  const filteredProducts = useMemo(() => 
    effectiveCategory
      ? activeProducts.filter(p => p.category_id === effectiveCategory)
      : [],
    [activeProducts, effectiveCategory]
  );

  // Process pending product click once pizzaData loads
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

  // Build pizza config for selected product
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
    // Build group price types map from complements
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

    if (duplicateItems && quantity > 1 && (duplicateItemsMaxQty === 0 || quantity <= duplicateItemsMaxQty)) {
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

  if (!open && !productDialogOpen) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="h-[85vh] flex flex-col relative">
          <DrawerHeader className="border-b px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <DrawerTitle>
                {tableNumber ? `Adicionar Itens - Mesa ${tableNumber}` : 'Adicionar Itens'}
              </DrawerTitle>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DrawerHeader>

          {/* Categories horizontal scroll */}
          <div className="border-b flex-shrink-0 overflow-x-auto">
            <div className="flex gap-2 p-3 min-w-max">
              {activeCategories.map(cat => (
                <Button
                  key={cat.id}
                  variant={effectiveCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.icon && <span className="mr-1">{cat.icon}</span>}
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Products grid */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2">
                {filteredProducts.map(product => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:border-primary transition-colors active:scale-[0.98]"
                    onClick={() => handleProductClick(product)}
                  >
                    <CardContent className="p-2">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-20 object-cover rounded-md mb-2"
                        />
                      ) : (
                        <div className="w-full h-20 bg-muted rounded-md mb-2 flex items-center justify-center">
                          <span className="text-muted-foreground text-xs">Sem foto</span>
                        </div>
                      )}
                      <p className="font-medium text-xs truncate">{product.name}</p>
                      <div className="flex items-center gap-1">
                        {product.is_promotion && product.promotion_price ? (
                          <>
                            <span className="text-muted-foreground line-through text-[10px]">
                              {formatCurrency(product.price)}
                            </span>
                            <span className="text-primary font-semibold text-xs">
                              {formatCurrency(product.promotion_price)}
                            </span>
                          </>
                        ) : (
                          <span className="text-primary font-semibold text-xs">
                            {formatCurrency(product.price)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-muted-foreground">
                    <p className="text-sm">Nenhum produto encontrado</p>
                  </div>
                )}
              </div>
            </div>
            {/* Spacer for CartBar */}
            {cartItems.length > 0 && <div className="h-20" />}
          </ScrollArea>

          {/* CartBar inside drawer */}
          {cartItems.length > 0 && (
            <button
              onClick={onCartClick}
              className={cn(
                "absolute bottom-0 left-0 right-0",
                "bg-primary text-primary-foreground",
                "px-4 py-3 flex items-center justify-between",
                "shadow-[0_-4px_20px_rgba(0,0,0,0.15)]",
                "active:bg-primary/90 transition-colors",
                "safe-area-inset-bottom rounded-b-xl"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="h-6 w-6" />
                  <span className="absolute -top-2 -right-2 bg-background text-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <span className="font-medium">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)} {cartItems.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'itens'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{formatCurrency(cartItems.reduce((sum, item) => sum + item.total_price, 0))}</span>
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>
          )}
        </DrawerContent>
      </Drawer>

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
