import { useState } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { useUserPermissions, PermissionCode } from '@/hooks/useUserPermissions';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useOrderWebhookListener } from '@/hooks/useOrderWebhookListener';
import { IntegrationAutoHandler } from '@/components/IntegrationAutoHandler';
import { useTenantContext } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { PrinterStatusIndicator } from '@/components/PrinterStatusIndicator';
import { TenantSwitcher } from '@/components/TenantSwitcher';
import { Loader2, LayoutDashboard, UtensilsCrossed, ShoppingBag, Package, CreditCard, BarChart3, Settings, LogOut, Menu, X, Store, Users, Kanban, ChefHat, History, Target, UserCircle, Pizza, RotateCcw, Shield, Ban, Crown, Factory, Truck, ExternalLink } from 'lucide-react';
import logoSlim from '@/assets/logo-slim.png';
import { APP_VERSION } from '@/lib/appVersion';
import { AppFooter } from '@/components/layout/AppFooter';
import { ManagerApprovalListener } from '@/components/ManagerApprovalListener';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: AppRole[];
  permission?: PermissionCode;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'cashier', 'waiter'], permission: 'dashboard_view' },
  { name: 'Gestão de Pedidos', href: '/order-management', icon: Kanban, roles: ['admin', 'cashier'], permission: 'orders_view' },
  { name: 'KDS', href: '/kds', icon: ChefHat, roles: ['admin', 'kitchen', 'kds'], permission: 'kds_view' },
  { name: 'Mesas', href: '/tables', icon: UtensilsCrossed, roles: ['admin', 'waiter'], permission: 'tables_view' },
  { name: 'Balcão', href: '/counter', icon: Store, roles: ['admin', 'waiter', 'cashier'], permission: 'counter_view' },
  { name: 'Pedidos', href: '/orders', icon: ShoppingBag, roles: ['admin', 'waiter', 'kitchen', 'cashier'], permission: 'orders_view' },
  { name: 'Cardápio', href: '/menu', icon: Pizza, roles: ['admin', 'waiter', 'kitchen'], permission: 'menu_view' },
  { name: 'Clientes', href: '/customers', icon: Users, roles: ['admin', 'cashier', 'waiter'], permission: 'customers_view' },
  { name: 'Estoque', href: '/stock', icon: Package, roles: ['admin', 'kitchen'], permission: 'stock_view' },
  // { name: 'Produção', href: '/production', icon: Factory, roles: ['admin'], permission: 'production_view' }, // Removed: external CPD integration via API
  { name: 'Caixa', href: '/cash-register', icon: CreditCard, roles: ['admin', 'cashier'], permission: 'cash_register_view' },
  { name: 'Relatórios', href: '/reports', icon: BarChart3, roles: ['admin', 'cashier'], permission: 'reports_view' },
  { name: 'Histórico', href: '/closing-history', icon: History, roles: ['admin', 'cashier'], permission: 'closing_history_view' },
  { name: 'Cancelamentos', href: '/cancellation-history', icon: Ban, roles: ['admin', 'cashier'], permission: 'closing_history_view' },
  { name: 'Reaberturas', href: '/reopen-history', icon: RotateCcw, roles: ['admin'], permission: 'reopen_history_view' },
  { name: 'Auditoria', href: '/audit-dashboard', icon: Shield, roles: ['admin'], permission: 'audit_view' },
  { name: 'Desempenho', href: '/performance', icon: Target, roles: ['admin', 'cashier'], permission: 'performance_view' },
  { name: 'Configurações', href: '/settings', icon: Settings, roles: ['admin'], permission: 'settings_general' },
];

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  cashier: 'Caixa',
  waiter: 'Garçom',
  kitchen: 'Cozinha',
  kds: 'KDS',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive/20 text-destructive',
  cashier: 'bg-primary/20 text-primary',
  waiter: 'bg-info/20 text-info',
  kitchen: 'bg-warning/20 text-warning',
  kds: 'bg-orange-500/20 text-orange-600',
};

export default function PDVLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { roles, isLoading: rolesLoading } = useUserRole();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { allTenants, isLoading: tenantLoading } = useTenantContext();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize realtime notifications
  useRealtimeNotifications();
  useOrderWebhookListener();

  // Auto-handler for integration orders
  const integrationAutoHandler = <IntegrationAutoHandler />;

  if (loading || rolesLoading || permissionsLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Filter navigation based on user roles AND permissions
  // If user has no roles, show all items (first user setup scenario)
  const filteredNavigation = roles.length === 0 
    ? navigation 
    : navigation.filter(item => {
        // Check role first
        const hasRole = item.roles.some(role => roles.includes(role));
        if (!hasRole) return false;
        
        // Then check permission if defined
        if (item.permission) {
          return hasPermission(item.permission);
        }
        
        return true;
      });

  // Get primary role to display
  const primaryRole = roles[0] as AppRole | undefined;

  return (
    <div className="min-h-screen bg-background">
      {integrationAutoHandler}
      {/* Mobile header */}
      <header className="xl:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <div className="flex items-center ml-4">
            <img src={logoSlim} alt="slim" className="max-h-10 max-w-full object-contain" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OfflineIndicator />
          <PrinterStatusIndicator />
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-52 bg-sidebar border-r border-sidebar-border z-40 transform transition-transform duration-300 ease-in-out xl:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "xl:block"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-center px-4 border-b border-sidebar-border">
            <img src={logoSlim} alt="slim - Sistema para Restaurante" className="max-h-12 max-w-full object-contain" />
          </div>

          {/* Tenant Switcher - only show if multiple tenants */}
          {allTenants.length > 1 && (
            <div className="px-3 py-2 border-b border-sidebar-border">
              <TenantSwitcher />
            </div>
          )}

          {/* Status indicators for desktop */}
          <div className="hidden xl:flex px-4 py-2 border-b border-sidebar-border gap-2">
            <OfflineIndicator />
            <PrinterStatusIndicator />
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Delivery Hub Section - admin only */}
            {(roles.length === 0 || roles.includes('admin')) && (
              <div className="px-3 mt-4 pt-4 border-t border-sidebar-border">
                <p className="px-3 text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-wider mb-2">Delivery Hub</p>
                <button
                  onClick={() => { window.open('https://courier-pay-palooza.lovable.app', '_blank'); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
                >
                  <Truck className="h-5 w-5" />
                  <span className="flex-1 text-left">Delivery Pay</span>
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-500 text-[10px] px-1.5 py-0">Novo</Badge>
                  <ExternalLink className="h-3.5 w-3.5 opacity-50" />
                </button>
              </div>
            )}
          </ScrollArea>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sidebar-foreground font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground text-sm font-medium truncate">
                  {user.user_metadata?.name || 'Usuário'}
                </p>
                <div className="flex items-center gap-1">
                  {primaryRole ? (
                    <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', roleColors[primaryRole])}>
                      {roleLabels[primaryRole]}
                    </Badge>
                  ) : (
                    <span className="text-sidebar-foreground/60 text-xs truncate">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {isPlatformAdmin && (
              <Link to="/platform" onClick={() => setSidebarOpen(false)}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-amber-500 hover:text-amber-400 hover:bg-sidebar-accent mb-1"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Gestão da Plataforma
                </Button>
              </Link>
            )}
            <Link to="/profile" onClick={() => setSidebarOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent mb-1"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Meu Perfil
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
            <p className="text-[10px] text-sidebar-foreground/40 text-center mt-2">v{APP_VERSION}</p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 xl:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="xl:ml-52 min-h-screen pt-16 xl:pt-0 pb-5">
        <div className="p-4 xl:p-6">
          {children}
        </div>
      </main>
      <ManagerApprovalListener />
      <AppFooter />
    </div>
  );
}
