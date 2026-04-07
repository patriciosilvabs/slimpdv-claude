import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, getHours, getDay } from 'date-fns';
import { getReportDate, filterOrdersByReportDate } from '@/lib/reportDateUtils';

export type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface SalesReportData {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  salesByPaymentMethod: { method: string; amount: number; count: number }[];
  salesByDay: { date: string; amount: number; count: number }[];
  salesByHour: { hour: number; amount: number; count: number }[];
  
}

interface ProductReportData {
  id: string;
  name: string;
  category: string | null;
  quantitySold: number;
  totalRevenue: number;
}

interface PeakHoursData {
  hour: number;
  dayOfWeek: number;
  orderCount: number;
  totalSales: number;
}

export function getDateRange(range: DateRange, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'custom':
      return { 
        start: customStart ? startOfDay(customStart) : startOfDay(now), 
        end: customEnd ? endOfDay(customEnd) : endOfDay(now) 
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function useSalesReport(range: DateRange, customStart?: Date, customEnd?: Date, employeeId?: string, startHour?: string, endHour?: string) {
  const { start, end } = getDateRange(range, customStart, customEnd);
  
  return useQuery({
    queryKey: ['sales-report', range, customStart?.toISOString(), customEnd?.toISOString(), employeeId, startHour, endHour],
    refetchInterval: 30000,
    queryFn: async (): Promise<SalesReportData> => {
      // Fetch orders that are delivered OR have delivered_at set (covers status inconsistencies)
      // We need a wider date window on created_at since the order may have been created before the filter window
      // but delivered within it. We fetch broadly and filter client-side by report timestamp.
      const wideStart = new Date(start);
      wideStart.setDate(wideStart.getDate() - 7); // look back 7 days for orders created before filter window

      let ordersQuery = supabase
        .from('orders')
        .select('id, total, created_at, delivered_at')
        .or('status.eq.delivered,delivered_at.not.is.null')
        .gte('created_at', wideStart.toISOString())
        .lte('created_at', end.toISOString());
      
      if (employeeId) {
        ordersQuery = ordersQuery.eq('created_by', employeeId);
      }
      
      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;

      // Filter by report timestamp (delivered_at ?? created_at) within the actual date+time range
      const filteredOrders = filterOrdersByReportDate(orders || [], start, end, startHour, endHour);

      // Get payments for these orders
      const orderIds = filteredOrders.map(o => o.id);
      let payments: any[] = [];
      if (orderIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('amount, payment_method, order_id')
          .in('order_id', orderIds);
        if (paymentsError) throw paymentsError;
        payments = paymentsData || [];
      }

      // Calculate totals
      const totalSales = filteredOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalOrders = filteredOrders.length;
      const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

      // Group by payment method
      const paymentMethodMap = new Map<string, { amount: number; count: number }>();
      payments?.forEach(p => {
        const current = paymentMethodMap.get(p.payment_method) || { amount: 0, count: 0 };
        paymentMethodMap.set(p.payment_method, {
          amount: current.amount + Number(p.amount),
          count: current.count + 1
        });
      });
      const salesByPaymentMethod = Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
        method,
        amount: data.amount,
        count: data.count
      }));

      // Group by day — using report timestamp
      const dayMap = new Map<string, { amount: number; count: number }>();
      filteredOrders.forEach(o => {
        const date = format(getReportDate(o), 'yyyy-MM-dd');
        const current = dayMap.get(date) || { amount: 0, count: 0 };
        dayMap.set(date, {
          amount: current.amount + Number(o.total),
          count: current.count + 1
        });
      });
      const salesByDay = Array.from(dayMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Group by hour — using report timestamp
      const hourMap = new Map<number, { amount: number; count: number }>();
      filteredOrders.forEach(o => {
        const hour = getHours(getReportDate(o));
        const current = hourMap.get(hour) || { amount: 0, count: 0 };
        hourMap.set(hour, {
          amount: current.amount + Number(o.total),
          count: current.count + 1
        });
      });
      const salesByHour = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        amount: hourMap.get(h)?.amount || 0,
        count: hourMap.get(h)?.count || 0
      }));

      return {
        totalSales,
        totalOrders,
        averageTicket,
        salesByPaymentMethod,
        salesByDay,
        salesByHour,
      };
    },
  });
}

export function useProductsReport(range: DateRange, customStart?: Date, customEnd?: Date, employeeId?: string, startHour?: string, endHour?: string) {
  const { start, end } = getDateRange(range, customStart, customEnd);
  
  return useQuery({
    queryKey: ['products-report', range, customStart?.toISOString(), customEnd?.toISOString(), employeeId, startHour, endHour],
    refetchInterval: 30000,
    queryFn: async (): Promise<ProductReportData[]> => {
      const wideStart = new Date(start);
      wideStart.setDate(wideStart.getDate() - 7);

      let ordersQuery = supabase
        .from('orders')
        .select('id, created_at, delivered_at')
        .or('status.eq.delivered,delivered_at.not.is.null')
        .gte('created_at', wideStart.toISOString())
        .lte('created_at', end.toISOString());
      
      if (employeeId) {
        ordersQuery = ordersQuery.eq('created_by', employeeId);
      }
      
      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;

      const filteredOrders = filterOrdersByReportDate(orders || [], start, end, startHour, endHour);

      const orderIds = filteredOrders.map(o => o.id);
      if (orderIds.length === 0) return [];

      // Get order items with products
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          total_price,
          product:products(id, name, category:categories(name))
        `)
        .in('order_id', orderIds);
      
      if (itemsError) throw itemsError;

      // Aggregate by product
      const productMap = new Map<string, ProductReportData>();
      items?.forEach(item => {
        if (!item.product) return;
        const productId = item.product.id;
        const current = productMap.get(productId) || {
          id: productId,
          name: item.product.name,
          category: item.product.category?.name || null,
          quantitySold: 0,
          totalRevenue: 0
        };
        productMap.set(productId, {
          ...current,
          quantitySold: current.quantitySold + item.quantity,
          totalRevenue: current.totalRevenue + Number(item.total_price)
        });
      });

      return Array.from(productMap.values())
        .sort((a, b) => b.quantitySold - a.quantitySold);
    },
  });
}

export function usePeakHoursAnalysis(range: DateRange, customStart?: Date, customEnd?: Date, startHour?: string, endHour?: string) {
  const { start, end } = getDateRange(range, customStart, customEnd);
  
  return useQuery({
    queryKey: ['peak-hours', range, customStart?.toISOString(), customEnd?.toISOString(), startHour, endHour],
    refetchInterval: 30000,
    queryFn: async (): Promise<PeakHoursData[]> => {
      const wideStart = new Date(start);
      wideStart.setDate(wideStart.getDate() - 7);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, delivered_at, total')
        .or('status.eq.delivered,delivered_at.not.is.null')
        .gte('created_at', wideStart.toISOString())
        .lte('created_at', end.toISOString());
      
      if (error) throw error;

      const filtered = filterOrdersByReportDate(orders || [], start, end, startHour, endHour);

      // Group by hour and day of week — using report timestamp
      const heatMap = new Map<string, { count: number; sales: number }>();
      filtered.forEach(order => {
        const date = getReportDate(order);
        const hour = getHours(date);
        const dayOfWeek = getDay(date);
        const key = `${dayOfWeek}-${hour}`;
        const current = heatMap.get(key) || { count: 0, sales: 0 };
        heatMap.set(key, {
          count: current.count + 1,
          sales: current.sales + Number(order.total)
        });
      });

      return Array.from(heatMap.entries()).map(([key, data]) => {
        const [dayOfWeek, hour] = key.split('-').map(Number);
        return {
          hour,
          dayOfWeek,
          orderCount: data.count,
          totalSales: data.sales
        };
      });
    },
  });
}

export function useCashRegisterHistory() {
  return useQuery({
    queryKey: ['cash-register-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          opened_by_profile:profiles!cash_registers_opened_by_fkey(name),
          closed_by_profile:profiles!cash_registers_closed_by_fkey(name)
        `)
        .order('opened_at', { ascending: false })
        .limit(50);
      
      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('cash_registers')
          .select('*')
          .order('opened_at', { ascending: false })
          .limit(50);
        
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    },
  });
}

export function useCashMovements(cashRegisterId?: string) {
  return useQuery({
    queryKey: ['cash-movements', cashRegisterId],
    queryFn: async () => {
      let query = supabase
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (cashRegisterId) {
        query = query.eq('cash_register_id', cashRegisterId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!cashRegisterId,
  });
}

export interface WaiterReportData {
  id: string;
  name: string;
  totalItems: number;
  totalRevenue: number;
  averagePerItem: number;
  orderCount: number;
}

export function useWaiterReport(range: DateRange, customStart?: Date, customEnd?: Date, startHour?: string, endHour?: string) {
  const { start, end } = getDateRange(range, customStart, customEnd);
  
  return useQuery({
    queryKey: ['waiter-report', range, customStart?.toISOString(), customEnd?.toISOString(), startHour, endHour],
    refetchInterval: 30000,
    queryFn: async (): Promise<WaiterReportData[]> => {
      const wideStart = new Date(start);
      wideStart.setDate(wideStart.getDate() - 7);

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, created_at, delivered_at')
        .or('status.eq.delivered,delivered_at.not.is.null')
        .gte('created_at', wideStart.toISOString())
        .lte('created_at', end.toISOString());
      
      if (ordersError) throw ordersError;

      const filtered = filterOrdersByReportDate(orders || [], start, end, startHour, endHour);

      const orderIds = filtered.map(o => o.id);
      if (orderIds.length === 0) return [];

      // Get order items with added_by
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('added_by, quantity, total_price, order_id')
        .in('order_id', orderIds)
        .not('added_by', 'is', null);
      
      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return [];

      // Get unique waiter ids
      const waiterIds = [...new Set(items.map(i => i.added_by).filter(Boolean))] as string[];

      // Get waiter profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', waiterIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

      // Aggregate by waiter
      const waiterMap = new Map<string, { 
        totalItems: number; 
        totalRevenue: number; 
        orders: Set<string>;
      }>();

      items.forEach(item => {
        if (!item.added_by) return;
        const existing = waiterMap.get(item.added_by) || { 
          totalItems: 0, 
          totalRevenue: 0, 
          orders: new Set<string>() 
        };
        existing.totalItems += item.quantity;
        existing.totalRevenue += Number(item.total_price);
        existing.orders.add(item.order_id);
        waiterMap.set(item.added_by, existing);
      });

      return Array.from(waiterMap.entries())
        .map(([id, data]) => ({
          id,
          name: profileMap.get(id) || 'Desconhecido',
          totalItems: data.totalItems,
          totalRevenue: data.totalRevenue,
          averagePerItem: data.totalItems > 0 ? data.totalRevenue / data.totalItems : 0,
          orderCount: data.orders.size,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);
    },
  });
}
