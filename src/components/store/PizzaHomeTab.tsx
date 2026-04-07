import { Clock, Star, ChevronRight } from 'lucide-react';
import { StoreData } from '@/hooks/usePublicStore';

interface PizzaHomeTabProps {
  store: StoreData;
  onGoToMenu: () => void;
  featuredProducts: StoreData['products'];
  onSelectProduct: (product: StoreData['products'][0]) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function PizzaHomeTab({ store, onGoToMenu, featuredProducts, onSelectProduct }: PizzaHomeTabProps) {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(356,82%,50%)] via-[hsl(356,75%,45%)] to-[hsl(20,80%,35%)] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-[-40px] w-64 h-64 rounded-full border border-white/20" />
          <div className="absolute bottom-[-20px] left-[-20px] w-40 h-40 rounded-full border border-white/10" />
        </div>

        <div className="relative px-6 pt-12 pb-8 max-w-lg mx-auto">
          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {store.tenant.logo_url ? (
                <img src={store.tenant.logo_url} alt={store.tenant.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-white/30 shadow-lg" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-bold text-xl">
                  {store.tenant.name.charAt(0)}
                </div>
              )}
              <div>
                <h2 className="font-bold text-lg leading-tight">{store.tenant.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-xs bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Aberto
                  </span>
                  <span className="flex items-center gap-0.5 text-xs text-white/80">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    4.8
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main CTA */}
          <div className="space-y-3 mb-8">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
              A melhor pizza<br />no conforto<br />do seu lar
            </h1>
            <div className="flex items-center gap-1.5 text-white/80 text-sm">
              <Clock className="h-4 w-4" />
              <span>Entrega em até 40 min</span>
            </div>
          </div>

          <button
            onClick={onGoToMenu}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-white text-[hsl(356,82%,50%)] font-bold text-base shadow-xl hover:shadow-2xl transition-all active:scale-[0.97]"
          >
            Ver Cardápio
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Decorative pizza circle */}
        <div className="absolute right-[-30px] bottom-[60px] w-40 h-40 rounded-full bg-white/5 flex items-center justify-center text-7xl opacity-30 pointer-events-none">
          🍕
        </div>
      </div>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <div className="px-4 py-6 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>
              🔥 Destaques
            </h3>
            <button onClick={onGoToMenu} className="text-xs font-semibold text-[hsl(var(--store-primary))] flex items-center gap-0.5">
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {featuredProducts.slice(0, 6).map(product => {
              const hasPromo = product.is_promotion && product.promotion_price;
              return (
                <button
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="flex-shrink-0 w-40 snap-start bg-white rounded-2xl shadow-md border overflow-hidden text-left transition-all hover:shadow-lg active:scale-[0.97]"
                  style={{ borderColor: 'hsl(var(--store-border))' }}
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-28 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-28 bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center text-4xl">🍕</div>
                  )}
                  <div className="p-3">
                    <h4 className="text-xs font-bold truncate" style={{ color: 'hsl(var(--store-card-foreground))' }}>{product.name}</h4>
                    <div className="mt-1.5">
                      {hasPromo ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[hsl(var(--store-primary))]">{formatCurrency(product.promotion_price!)}</span>
                          <span className="text-[10px] line-through" style={{ color: 'hsl(var(--store-muted))' }}>{formatCurrency(product.price)}</span>
                        </div>
                      ) : product.price > 0 ? (
                        <span className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{formatCurrency(product.price)}</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'hsl(var(--store-muted))' }}>A partir de...</span>
                      )}
                    </div>
                    {product.label && (
                      <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--store-primary-light))] text-[hsl(var(--store-primary))]">
                        {product.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Promo Banner */}
      <div className="px-4 pb-6 max-w-lg mx-auto w-full">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[hsl(356,82%,50%)] to-[hsl(20,80%,40%)] text-white p-5">
          <div className="relative z-10">
            <span className="text-[10px] uppercase tracking-wider font-bold bg-white/20 rounded-full px-2 py-0.5">Promoção</span>
            <h3 className="text-lg font-extrabold mt-2">Pague com Pix e ganhe 5% OFF</h3>
            <p className="text-xs text-white/70 mt-1">Desconto aplicado no checkout automaticamente</p>
          </div>
          <div className="absolute right-2 bottom-2 text-5xl opacity-20">💰</div>
        </div>
      </div>
    </div>
  );
}
