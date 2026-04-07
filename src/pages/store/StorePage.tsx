import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePublicStore, useCreatePublicOrder, CreateOrderPayload } from '@/hooks/usePublicStore';
import { PizzaStoreLayout, StoreTab } from '@/components/store/PizzaStoreLayout';
import { PizzaHomeTab } from '@/components/store/PizzaHomeTab';
import { PizzaMenuTab } from '@/components/store/PizzaMenuTab';
import { PizzaCartTab } from '@/components/store/PizzaCartTab';
import { PizzaProfileTab } from '@/components/store/PizzaProfileTab';
import { PizzaProductDetail } from '@/components/store/PizzaProductDetail';
import { PizzaCheckoutSheet } from '@/components/store/PizzaCheckoutSheet';
import { PizzaOrderStatus } from '@/components/store/PizzaOrderStatus';

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
  image_url?: string | null;
  complements?: Array<{
    option_id: string;
    option_name: string;
    group_name: string;
    price: number;
    quantity: number;
    kds_category?: string;
  }>;
}

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('mesa');

  const { data: store, isLoading, error } = usePublicStore(slug, tableId);
  const createOrder = useCreatePublicOrder();

  const [activeTab, setActiveTab] = useState<StoreTab>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderType, setLastOrderType] = useState<'delivery' | 'takeaway'>('delivery');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  // Pizza config from store data
  const pizzaConfigMap = useMemo(() => {
    if (!store) return new Map<string, { maxFlavors: number; flavorOptions: Array<{ count: number; label: string; description: string }> }>();
    const map = new Map<string, { maxFlavors: number; flavorOptions: Array<{ count: number; label: string; description: string }> }>();
    const perUnitGroups = store.complementGroups.filter(g =>
      g.applies_per_unit && g.flavor_modal_enabled &&
      g.flavor_modal_channels?.includes('delivery')
    );
    if (perUnitGroups.length === 0) return map;
    const productIds = new Set(store.products.map(p => p.id));
    for (const pid of productIds) {
      const linkedGroups = store.productGroups
        .filter(pg => pg.product_id === pid && !pg.skip_flavor_modal)
        .map(pg => perUnitGroups.find(g => g.id === pg.group_id))
        .filter(Boolean) as typeof perUnitGroups;
      if (linkedGroups.length === 0) continue;
      const availableCounts = new Set<number>();
      for (const g of linkedGroups) {
        if (g.applicable_flavor_counts && g.applicable_flavor_counts.length > 0) {
          g.applicable_flavor_counts.forEach(c => availableCounts.add(c));
        } else { availableCounts.add(g.unit_count ?? 1); }
      }
      const maxFlavors = Math.max(...linkedGroups.map(g => g.unit_count ?? 1));
      const baseOptions = linkedGroups[0].flavor_options || [];
      const filteredOptions = baseOptions.filter(opt => availableCounts.has(opt.count));
      const flavorOptions = filteredOptions.length > 0 ? filteredOptions :
        Array.from(availableCounts).sort().map(c => ({ count: c, label: c === 1 ? '1 Sabor' : `${c} Sabores`, description: '' }));
      map.set(pid, { maxFlavors, flavorOptions });
    }
    return map;
  }, [store]);

  const cartTotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const featuredProducts = useMemo(() => {
    if (!store) return [];
    return store.products.filter(p => p.is_featured || p.is_promotion).slice(0, 8);
  }, [store]);

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => [...prev, item]);
  }, []);

  const updateCartItem = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
    } else {
      setCart(prev => prev.map(item =>
        item.id === id ? { ...item, quantity, total_price: item.unit_price * quantity } : item
      ));
    }
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleCheckout = async (data: {
    order_type: 'takeaway' | 'delivery';
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    notes: string;
    payment_method: string;
  }) => {
    if (!slug) return;
    const payload: CreateOrderPayload = {
      slug,
      order_type: tableId ? 'takeaway' : data.order_type,
      customer_name: data.customer_name || undefined,
      customer_phone: data.customer_phone || undefined,
      customer_address: data.customer_address || undefined,
      notes: data.notes || undefined,
      table_id: tableId || undefined,
      payment_method: data.payment_method || undefined,
      items: cart.map(item => ({
        product_id: item.product_id,
        variation_id: item.variation_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
        complements: item.complements?.map(c => ({
          option_id: c.option_id, option_name: c.option_name,
          price: c.price, quantity: c.quantity, kds_category: c.kds_category,
        })),
      })),
    };
    setLastOrderType(tableId ? 'takeaway' : data.order_type);
    const result = await createOrder.mutateAsync(payload);
    setLastOrderId(result.order_id || null);
    setCart([]);
    setCheckoutOpen(false);
    setOrderSuccess(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="pizza-store min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--store-bg))' }}>
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[hsl(var(--store-primary-light))] mx-auto mb-4 flex items-center justify-center animate-pulse">
            <span className="text-4xl">🍕</span>
          </div>
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--store-muted))' }}>Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !store) {
    return (
      <div className="pizza-store min-h-screen flex items-center justify-center p-4" style={{ background: 'hsl(var(--store-bg))' }}>
        <div className="text-center max-w-sm space-y-3">
          <span className="text-5xl block">😕</span>
          <h1 className="text-xl font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Loja não encontrada</h1>
          <p className="text-sm" style={{ color: 'hsl(var(--store-muted))' }}>O link que você acessou não corresponde a nenhuma loja ativa.</p>
        </div>
      </div>
    );
  }

  // Order success
  if (orderSuccess) {
    return (
      <div className="pizza-store">
        <PizzaOrderStatus
          storeName={store.tenant.name}
          isTable={!!tableId}
          orderType={lastOrderType}
          orderId={lastOrderId}
          slug={slug!}
          onNewOrder={() => { setOrderSuccess(false); setLastOrderId(null); setActiveTab('home'); }}
        />
      </div>
    );
  }

  return (
    <PizzaStoreLayout activeTab={activeTab} onTabChange={setActiveTab} cartCount={cartCount}>
      {activeTab === 'home' && (
        <PizzaHomeTab
          store={store}
          onGoToMenu={() => setActiveTab('menu')}
          featuredProducts={featuredProducts}
          onSelectProduct={(p) => { setSelectedProduct(p); }}
        />
      )}

      {activeTab === 'menu' && (
        <PizzaMenuTab store={store} onSelectProduct={(p) => setSelectedProduct(p)} />
      )}

      {activeTab === 'cart' && (
        <PizzaCartTab
          items={cart}
          onUpdateQuantity={updateCartItem}
          onRemove={removeFromCart}
          onCheckout={() => setCheckoutOpen(true)}
          onGoToMenu={() => setActiveTab('menu')}
          total={cartTotal}
        />
      )}

      {activeTab === 'profile' && <PizzaProfileTab />}

      {/* Product detail sheet */}
      {selectedProduct && (
        <PizzaProductDetail
          product={selectedProduct}
          store={store}
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(item) => {
            addToCart(item);
            setSelectedProduct(null);
          }}
          pizzaConfig={pizzaConfigMap.get(selectedProduct.id)}
        />
      )}

      {/* Checkout sheet */}
      <PizzaCheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSubmit={handleCheckout}
        total={cartTotal}
        isTable={!!tableId}
        isLoading={createOrder.isPending}
        storeName={store.tenant.name}
      />
    </PizzaStoreLayout>
  );
}
