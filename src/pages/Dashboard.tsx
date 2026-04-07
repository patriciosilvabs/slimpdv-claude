import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStats, useTopProducts, useSalesChart, useTopWaiters } from '@/hooks/useDashboard';
import { useMonthlyRevenue } from '@/hooks/useMonthlyRevenue';
import { useOrders } from '@/hooks/useOrders';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { DollarSign, ShoppingBag, Users, AlertTriangle, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { APP_VERSION } from '@/lib/appVersion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function Dashboard() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: topProducts } = useTopProducts(7);
  const { data: salesChart } = useSalesChart(7);
  const { data: recentOrders } = useOrders(['pending', 'preparing']);
  const { data: monthlyRevenue } = useMonthlyRevenue(6);
  const { data: topWaiters } = useTopWaiters(7);

  // Calculate current month totals and variation
  const currentMonthData = monthlyRevenue?.[monthlyRevenue.length - 1];
  const monthVariation = currentMonthData?.variation || 0;

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('dashboard_view')) {
    return <AccessDenied permission="dashboard_view" />;
  }

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl xl:text-2xl font-bold text-foreground">Dashboard</h1>
            <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-full">v{APP_VERSION}</span>
          </div>
          <p className="text-muted-foreground">Visão geral do seu negócio</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {statsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="p-2 bg-muted rounded-lg h-9 w-9" />
                    <div className="space-y-2">
                      <div className="h-3 w-16 bg-muted rounded" />
                      <div className="h-5 w-20 bg-muted rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendas Hoje</p>
                  <p className="text-lg font-bold">{formatCurrency(stats?.todaySales || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info/10 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pedidos Hoje</p>
                  <p className="text-lg font-bold">{stats?.todayOrders || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  <p className="text-lg font-bold">{formatCurrency(stats?.averageTicket || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/30 rounded-lg">
                  <Users className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mesas Ocupadas</p>
                  <p className="text-lg font-bold">{stats?.openTables || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pedidos Pendentes</p>
                  <p className="text-lg font-bold">{stats?.pendingOrders || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estoque Baixo</p>
                  <p className="text-lg font-bold">{stats?.lowStockItems || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
            </>
          )}
        </div>

        {/* Monthly Revenue Comparison */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Faturamento Mensal Comparativo</CardTitle>
              {currentMonthData && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                  monthVariation >= 0 
                    ? 'bg-accent/10 text-accent' 
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {monthVariation >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {monthVariation.toFixed(1)}% vs ano anterior
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'currentYear' ? 'Ano Atual' : 'Ano Anterior'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend 
                    formatter={(value) => value === 'currentYear' ? 'Ano Atual' : 'Ano Anterior'}
                  />
                  <Bar dataKey="currentYear" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lastYear" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Charts and Lists */}
        <div className="grid xl:grid-cols-2 gap-6">
          {/* Sales Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vendas dos Últimos 7 Dias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesChart || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Produtos Mais Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts?.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.quantity} vendidos</p>
                    </div>
                    <p className="font-semibold text-primary">{formatCurrency(product.revenue)}</p>
                  </div>
                ))}
                {(!topProducts || topProducts.length === 0) && (
                  <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Waiters Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-warning" />
                Ranking de Garçons (7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topWaiters?.map((waiter, index) => (
                  <div key={waiter.id} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-warning/20 text-warning' :
                      index === 1 ? 'bg-muted text-muted-foreground' :
                      index === 2 ? 'bg-accent/20 text-accent' :
                      'bg-muted/50 text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{waiter.name}</p>
                      <p className="text-sm text-muted-foreground">{waiter.itemCount} itens vendidos</p>
                    </div>
                    <p className="font-semibold text-primary">{formatCurrency(waiter.totalRevenue)}</p>
                  </div>
                ))}
                {(!topWaiters || topWaiters.length === 0) && (
                  <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pedidos em Andamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders?.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 'pending' ? 'bg-warning text-warning-foreground' :
                      order.status === 'preparing' ? 'bg-info text-info-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {order.status === 'pending' ? 'Pendente' : 
                       order.status === 'preparing' ? 'Preparando' : order.status}
                    </div>
                    <div>
                      <p className="font-medium">
                        {order.table?.number ? `Mesa ${order.table.number}` : 
                         order.customer_name || `Pedido #${order.id.slice(0, 8)}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.order_items?.length || 0} itens
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">{formatCurrency(order.total)}</p>
                </div>
              ))}
              {(!recentOrders || recentOrders.length === 0) && (
                <p className="text-muted-foreground text-center py-8">Nenhum pedido em andamento</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
}
