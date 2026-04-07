import { Home, UtensilsCrossed, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StoreTab = 'home' | 'menu' | 'cart' | 'profile';

interface PizzaStoreLayoutProps {
  activeTab: StoreTab;
  onTabChange: (tab: StoreTab) => void;
  cartCount: number;
  children: React.ReactNode;
}

const tabs: Array<{ id: StoreTab; label: string; icon: React.ElementType }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'menu', label: 'Cardápio', icon: UtensilsCrossed },
  { id: 'cart', label: 'Carrinho', icon: ShoppingBag },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function PizzaStoreLayout({ activeTab, onTabChange, cartCount, children }: PizzaStoreLayoutProps) {
  return (
    <div className="pizza-store min-h-screen flex flex-col" style={{ background: 'hsl(var(--store-bg))' }}>
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur-lg" style={{ borderColor: 'hsl(var(--store-border))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-around h-16">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all relative",
                  isActive ? "text-[hsl(var(--store-primary))]" : "text-[hsl(var(--store-muted))]"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} strokeWidth={isActive ? 2.5 : 1.8} />
                  {tab.id === 'cart' && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-[hsl(var(--store-primary))] text-white text-[9px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-0.5">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] font-medium", isActive && "font-bold")}>{tab.label}</span>
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[hsl(var(--store-primary))]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
