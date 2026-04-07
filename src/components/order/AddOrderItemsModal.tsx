import { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useProductVariations } from '@/hooks/useProductVariations';
import { ProductDetailDialog, SelectedComplement, SubItemComplement, PizzaConfig } from './ProductDetailDialog';
import { ShoppingCart, Trash2, Plus, Minus, X, Send, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { usePizzaProducts } from '@/hooks/usePizzaProducts';
import { calculateFullComplementsPrice, ComplementForCalc, SubItemForCalc } from '@/lib/complementPriceUtils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  variation_id?: string | null;
  variation_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  complements: SelectedComplement[];
  combo_name?: string;
  print_sector_id?: string | null;
  subItems?: SubItemComplement[];
  fulfillment_type?: 'takeaway' | 'delivery' | null;
}

interface AddOrderItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (items: CartItem[]) => void;
  tableNumber?: number;
}

export function AddOrderItemsModal({ open, onOpenChange, onSubmit, tableNumber }: AddOrderItemsModalProps) {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: variations } = useProductVariations();
  const { duplicateItems, duplicateItemsMaxQty } = useOrderSettings();
  const { data: pizzaData, isLoading: pizzaDataLoading } = usePizzaProducts();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selecionar primeira categoria automaticamente quando carregar
  const firstCategoryId = categories?.find(c => c.is_active !== false)?.id || null;
  const effectiveCategory = selectedCategory ?? firstCategoryId;
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const pendingProductRef = useRef<any>(null);

  const activeCategories = categories?.filter(c => c.is_active !== false) || [];
  const activeProducts = products?.filter(p => p.is_available !== false) || [];

  const filteredProducts = useMemo(() => {
    let filtered = activeProducts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    } else if (effectiveCategory) {
      filtered = filtered.filter(p => p.category_id === effectiveCategory);
    }
    return filtered;
  }, [activeProducts, searchQuery, effectiveCategory]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);

  const getProductVariations = (productId: string) => {
    return variations?.filter(v => v.product_id === productId && v.is_active !== false) || [];
  };

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
    // Also get price types from subItems
    if (subItems) {
      for (const subItem of subItems) {
        for (const c of subItem.complements) {
          if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
            groupPriceTypes[c.group_id] = c.price_calculation_type;
          }
        }
      }
    }

    // Convert to calc format
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

    // Calculate complements total using price_calculation_type
    const complementsTotal = calculateFullComplementsPrice(sharedComplements, subItemsForCalc, groupPriceTypes);
    
    const productPrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price 
      : product.price;
    const unitPrice = productPrice + complementsTotal;

    if (duplicateItems && quantity > 1 && (duplicateItemsMaxQty === 0 || quantity <= duplicateItemsMaxQty)) {
      // Create separate items when duplicateItems is enabled
      const newItems: CartItem[] = [];
      for (let i = 0; i < quantity; i++) {
        newItems.push({
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
      setCartItems(prev => [...prev, ...newItems]);
    } else {
      const newItem: CartItem = {
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
      };
      setCartItems(prev => [...prev, newItem]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty, total_price: item.unit_price * newQty };
    }));
  };

  const duplicateItem = (itemId: string) => {
    setCartItems(prev => {
      const itemToDuplicate = prev.find(item => item.id === itemId);
      if (!itemToDuplicate) return prev;
      
      const newItem: CartItem = {
        ...itemToDuplicate,
        id: `${itemToDuplicate.product_id}-${Date.now()}`,
        quantity: 1,
        total_price: itemToDuplicate.unit_price,
      };
      
      return [...prev, newItem];
    });
  };

  const removeItem = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSubmit = () => {
    if (cartItems.length === 0) return;
    onSubmit(cartItems);
    setCartItems([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    setCartItems([]);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle>
              {tableNumber ? `Adicionar Pedido - Mesa ${tableNumber}` : 'Adicionar Pedido'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden">
            {/* Left: Categories */}
            <div className="w-44 border-r bg-background flex-shrink-0 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="flex flex-col">
                  {activeCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.id); setSearchQuery(''); }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm transition-colors break-words border-b border-border",
                        effectiveCategory === cat.id && !searchQuery
                          ? "bg-primary text-primary-foreground font-bold"
                          : "hover:bg-muted/50 text-foreground font-normal"
                      )}
                    >
                      {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Center: Products Grid */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search bar */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredProducts.map(product => (
                      <div
                        key={product.id}
                        className="flex flex-col rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all overflow-hidden"
                        onClick={() => handleProductClick(product)}
                      >
                        <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-muted-foreground text-xs">Sem foto</span>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="font-medium text-sm leading-tight break-words">{product.name}</p>
                          <div className="mt-1">
                            {product.is_promotion && product.promotion_price ? (
                              <>
                                <span className="text-primary font-semibold text-sm">
                                  {formatCurrency(product.promotion_price)}
                                </span>
                                <span className="text-muted-foreground line-through text-xs ml-1">
                                  {formatCurrency(product.price)}
                                </span>
                              </>
                            ) : (
                              <span className="text-primary font-semibold text-sm">
                                {formatCurrency(product.price)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="col-span-full text-center py-12 text-muted-foreground">
                        <p>Nenhum produto encontrado</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Right: Cart */}
            <div className="w-72 border-l flex flex-col bg-background flex-shrink-0">
              <div className="p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="font-semibold text-sm">
                    {tableNumber ? `Mesa ${tableNumber}` : 'Carrinho'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{cartItems.length} itens</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
                    <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-sm opacity-60">Adicione itens ao pedido</p>
                  </div>

                ) : (
                  <div className="p-3 space-y-2">
                    {cartItems.map(item => (
                      <div 
                        key={item.id} 
                        className="p-3 bg-muted/50 rounded-lg border space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product_name}</p>
                            {item.variation_name && (
                              <p className="text-xs text-muted-foreground">{item.variation_name}</p>
                            )}
                            {item.complements.length > 0 && (
                              <div className="mt-1">
                                {item.complements.map((c, i) => (
                                  <p key={i} className="text-xs text-muted-foreground">
                                    + {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.option_name}
                                  </p>
                                ))}
                              </div>
                            )}
                            {item.notes && (
                              <p className="text-xs text-muted-foreground italic mt-1">
                                "{item.notes}"
                              </p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => removeItem(item.id)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => duplicateItems ? duplicateItem(item.id) : updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-semibold text-sm">
                            {formatCurrency(item.total_price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="border-t p-3 space-y-3">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(subtotal)}</span>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmit}
                  disabled={cartItems.length === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para Cozinha
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
