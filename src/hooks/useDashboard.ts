import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  averageTicket: number;
  openTables: number;
  pendingOrders: number;
  lowStockItems: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Today's orders
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total, status')
        .gte('created_at', today.toISOString())
        .is('archived_at', null)
        .neq('status', 'cancelled');

      const totalSales = todayOrders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
      const orderCount = todayOrders?.length || 0;

      // Open tables
      const { data: tables } = await supabase
        .from('tables')
        .select('status')
        .eq('status', 'occupied');

      // Pending orders
      const { data: pending } = await supabase
        .from('orders')
        .select('id')
        .is('archived_at', null)
        .in('status', ['pending', 'preparing']);

      // Low stock
      const { data: ingredients } = await supabase
        .from('ingredients')
        .select('current_stock, min_stock');
      
      const lowStock = ingredients?.filter(i => Number(i.current_stock) <= Number(i.min_stock)).length || 0;

      return {
        todaySales: totalSales,
        todayOrders: orderCount,
        averageTicket: orderCount > 0 ? totalSales / orderCount : 0,
        openTables: tables?.length || 0,
        pendingOrders: pending?.length || 0,
        lowStockItems: lowStock,
      } as DashboardStats;
    },
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000,
  });
}

export function useTopProducts(days: number = 7) {
  return useQuery({
    queryKey: ['top-products', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, total_price, product:products(name)')
        .gte('created_at', startDate.toISOString());

      if (!items) return [];

      // Group by product
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      
      items.forEach((item) => {
        const name = item.product?.name || 'Desconhecido';
        const existing = productMap.get(name) || { quantity: 0, revenue: 0 };
        productMap.set(name, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + Number(item.total_price),
        });
      });

      return Array.from(productMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5) as TopProduct[];
    },
  });
}

export function useSalesChart(days: number = 7) {
  return useQuery({
    queryKey: ['sales-chart', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('total, created_at')
        .gte('created_at', startDate.toISOString())
        .neq('status', 'cancelled');

      if (!orders) return [];

      // Group by day
      const dayMap = new Map<string, number>();
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
        dayMap.set(key, 0);
      }

      orders.forEach((order) => {
        const date = new Date(order.created_at);
        const key = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
        dayMap.set(key, (dayMap.get(key) || 0) + Number(order.total));
      });

      return Array.from(dayMap.entries())
        .map(([name, value]) => ({ name, value }))
        .reverse();
    },
  });
}

export interface TopWaiter {
  id: string;
  name: string;
  itemCount: number;
  totalRevenue: number;
}

export function useTopWaiters(days: number = 7) {
  return useQuery({
    queryKey: ['top-waiters', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get order_items with added_by from delivered orders
      const { data: items } = await supabase
        .from('order_items')
        .select(`
          added_by,
          total_price,
          quantity,
          order:orders!inner(status, created_at)
        `)
        .gte('created_at', startDate.toISOString())
        .not('added_by', 'is', null);

      if (!items) return [];

      // Filter delivered orders only
      const deliveredItems = items.filter(
        (item) => item.order?.status === 'delivered'
      );

      // Get unique waiter ids
      const waiterIds = [...new Set(deliveredItems.map((i) => i.added_by).filter(Boolean))] as string[];

      if (waiterIds.length === 0) return [];

      // Get waiter profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', waiterIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

      // Group by waiter
      const waiterMap = new Map<string, { itemCount: number; revenue: number }>();

      deliveredItems.forEach((item) => {
        if (!item.added_by) return;
        const existing = waiterMap.get(item.added_by) || { itemCount: 0, revenue: 0 };
        waiterMap.set(item.added_by, {
          itemCount: existing.itemCount + item.quantity,
          revenue: existing.revenue + Number(item.total_price),
        });
      });

      return Array.from(waiterMap.entries())
        .map(([id, data]) => ({
          id,
          name: profileMap.get(id) || 'Desconhecido',
          itemCount: data.itemCount,
          totalRevenue: data.revenue,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5) as TopWaiter[];
    },
  });
}