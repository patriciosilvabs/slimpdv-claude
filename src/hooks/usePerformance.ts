import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format, parseISO, differenceInDays } from 'date-fns';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface KPIData {
  revenue: number;
  orders: number;
  averageTicket: number;
  revenueVariation: number;
  ordersVariation: number;
  ticketVariation: number;
}

export interface HourlyData {
  hour: string;
  currentPeriod: number;
  previousPeriod: number;
}

export interface RevenueDetails {
  productsTotal: number;
  serviceCharge: number;
  discountsTotal: number;
  netRevenue: number;
}

export interface SegmentData {
  segment: string;
  revenue: number;
  orders: number;
  averageTicket: number;
  percentage: number;
}

export interface EmployeePerformance {
  employeeId: string;
  employeeName: string;
  revenue: number;
  orders: number;
}

// Calculate previous period based on current date range
const getPreviousPeriod = (dateRange: DateRange): DateRange => {
  const daysDiff = differenceInDays(dateRange.end, dateRange.start) + 1;
  return {
    start: subDays(dateRange.start, daysDiff),
    end: subDays(dateRange.end, daysDiff),
  };
};

// Calculate variation percentage
const calcVariation = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export const usePerformanceKPIs = (dateRange: DateRange, filters?: { orderType?: string; paymentMethod?: string }) => {
  return useQuery({
    queryKey: ['performance-kpis', dateRange, filters],
    queryFn: async (): Promise<KPIData> => {
      const previousPeriod = getPreviousPeriod(dateRange);

      // Current period query
      let currentQuery = supabase
        .from('orders')
        .select('id, total, subtotal, discount, order_type')
        .eq('status', 'delivered')
        .gte('created_at', startOfDay(dateRange.start).toISOString())
        .lte('created_at', endOfDay(dateRange.end).toISOString());

      if (filters?.orderType && filters.orderType !== 'all') {
        currentQuery = currentQuery.eq('order_type', filters.orderType as 'dine_in' | 'takeaway' | 'delivery');
      }

      // Previous period query
      let previousQuery = supabase
        .from('orders')
        .select('id, total')
        .eq('status', 'delivered')
        .gte('created_at', startOfDay(previousPeriod.start).toISOString())
        .lte('created_at', endOfDay(previousPeriod.end).toISOString());

      if (filters?.orderType && filters.orderType !== 'all') {
        previousQuery = previousQuery.eq('order_type', filters.orderType as 'dine_in' | 'takeaway' | 'delivery');
      }

      const [currentResult, previousResult] = await Promise.all([
        currentQuery,
        previousQuery,
      ]);

      if (currentResult.error) throw currentResult.error;
      if (previousResult.error) throw previousResult.error;

      const currentOrders = currentResult.data || [];
      const previousOrders = previousResult.data || [];

      // If payment method filter, we need to join with payments
      let filteredCurrentOrders = currentOrders;
      if (filters?.paymentMethod && filters.paymentMethod !== 'all') {
        const { data: payments } = await supabase
          .from('payments')
          .select('order_id')
          .eq('payment_method', filters.paymentMethod as 'cash' | 'credit_card' | 'debit_card' | 'pix');
        
        const paymentOrderIds = new Set(payments?.map(p => p.order_id) || []);
        filteredCurrentOrders = currentOrders.filter(o => paymentOrderIds.has(o.id));
      }

      const currentRevenue = filteredCurrentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const currentCount = filteredCurrentOrders.length;
      const currentTicket = currentCount > 0 ? currentRevenue / currentCount : 0;

      const previousRevenue = previousOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const previousCount = previousOrders.length;
      const previousTicket = previousCount > 0 ? previousRevenue / previousCount : 0;

      return {
        revenue: currentRevenue,
        orders: currentCount,
        averageTicket: currentTicket,
        revenueVariation: calcVariation(currentRevenue, previousRevenue),
        ordersVariation: calcVariation(currentCount, previousCount),
        ticketVariation: calcVariation(currentTicket, previousTicket),
      };
    },
  });
};

export const useHourlyRevenue = (dateRange: DateRange, groupBy: 'hour' | 'day' = 'hour') => {
  return useQuery({
    queryKey: ['hourly-revenue', dateRange, groupBy],
    queryFn: async (): Promise<HourlyData[]> => {
      const previousPeriod = getPreviousPeriod(dateRange);

      const [currentResult, previousResult] = await Promise.all([
        supabase
          .from('orders')
          .select('total, created_at')
          .eq('status', 'delivered')
          .gte('created_at', startOfDay(dateRange.start).toISOString())
          .lte('created_at', endOfDay(dateRange.end).toISOString()),
        supabase
          .from('orders')
          .select('total, created_at')
          .eq('status', 'delivered')
          .gte('created_at', startOfDay(previousPeriod.start).toISOString())
          .lte('created_at', endOfDay(previousPeriod.end).toISOString()),
      ]);

      if (currentResult.error) throw currentResult.error;
      if (previousResult.error) throw previousResult.error;

      const currentOrders = currentResult.data || [];
      const previousOrders = previousResult.data || [];

      if (groupBy === 'hour') {
        // Group by hour (0-23)
        const hourlyData: HourlyData[] = [];
        for (let i = 0; i < 24; i++) {
          const hourLabel = `${i.toString().padStart(2, '0')}h`;
          
          const currentHourTotal = currentOrders
            .filter(o => {
              const hour = new Date(o.created_at!).getHours();
              return hour === i;
            })
            .reduce((sum, o) => sum + (o.total || 0), 0);

          const previousHourTotal = previousOrders
            .filter(o => {
              const hour = new Date(o.created_at!).getHours();
              return hour === i;
            })
            .reduce((sum, o) => sum + (o.total || 0), 0);

          hourlyData.push({
            hour: hourLabel,
            currentPeriod: currentHourTotal,
            previousPeriod: previousHourTotal,
          });
        }
        return hourlyData;
      } else {
        // Group by day
        const daysDiff = differenceInDays(dateRange.end, dateRange.start) + 1;
        const dailyData: HourlyData[] = [];
        
        for (let i = 0; i < daysDiff; i++) {
          const currentDay = subDays(dateRange.end, daysDiff - 1 - i);
          const previousDay = subDays(previousPeriod.end, daysDiff - 1 - i);
          const dayLabel = format(currentDay, 'dd/MM');

          const currentDayTotal = currentOrders
            .filter(o => {
              const orderDate = format(new Date(o.created_at!), 'yyyy-MM-dd');
              return orderDate === format(currentDay, 'yyyy-MM-dd');
            })
            .reduce((sum, o) => sum + (o.total || 0), 0);

          const previousDayTotal = previousOrders
            .filter(o => {
              const orderDate = format(new Date(o.created_at!), 'yyyy-MM-dd');
              return orderDate === format(previousDay, 'yyyy-MM-dd');
            })
            .reduce((sum, o) => sum + (o.total || 0), 0);

          dailyData.push({
            hour: dayLabel,
            currentPeriod: currentDayTotal,
            previousPeriod: previousDayTotal,
          });
        }
        return dailyData;
      }
    },
  });
};

export const useRevenueDetails = (dateRange: DateRange) => {
  return useQuery({
    queryKey: ['revenue-details', dateRange],
    queryFn: async (): Promise<RevenueDetails> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total, subtotal, discount')
        .eq('status', 'delivered')
        .gte('created_at', startOfDay(dateRange.start).toISOString())
        .lte('created_at', endOfDay(dateRange.end).toISOString());

      if (error) throw error;

      const ordersData = orders || [];
      
      const productsTotal = ordersData.reduce((sum, o) => sum + (o.subtotal || 0), 0);
      const discountsTotal = ordersData.reduce((sum, o) => sum + (o.discount || 0), 0);
      const netRevenue = ordersData.reduce((sum, o) => sum + (o.total || 0), 0);
      
      // Service charge is calculated as difference between total and (subtotal - discount)
      const serviceCharge = netRevenue - (productsTotal - discountsTotal);

      return {
        productsTotal,
        serviceCharge: Math.max(0, serviceCharge),
        discountsTotal,
        netRevenue,
      };
    },
  });
};

export const useSegmentAnalysis = (
  dateRange: DateRange, 
  segmentBy: 'payment' | 'orderType' | 'channel' = 'payment'
) => {
  return useQuery({
    queryKey: ['segment-analysis', dateRange, segmentBy],
    queryFn: async (): Promise<SegmentData[]> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total, order_type')
        .eq('status', 'delivered')
        .gte('created_at', startOfDay(dateRange.start).toISOString())
        .lte('created_at', endOfDay(dateRange.end).toISOString());

      if (error) throw error;

      const ordersData = orders || [];
      const totalRevenue = ordersData.reduce((sum, o) => sum + (o.total || 0), 0);

      if (segmentBy === 'payment') {
        // Fetch payments for these orders
        const orderIds = ordersData.map(o => o.id);
        const { data: payments } = await supabase
          .from('payments')
          .select('order_id, payment_method, amount')
          .in('order_id', orderIds);

        const paymentMap = new Map<string, { revenue: number; orders: Set<string> }>();
        
        (payments || []).forEach(p => {
          const method = p.payment_method;
          if (!paymentMap.has(method)) {
            paymentMap.set(method, { revenue: 0, orders: new Set() });
          }
          const entry = paymentMap.get(method)!;
          entry.revenue += p.amount;
          entry.orders.add(p.order_id);
        });

        const methodLabels: Record<string, string> = {
          cash: 'Dinheiro',
          credit_card: 'Cartão de Crédito',
          debit_card: 'Cartão de Débito',
          pix: 'PIX',
        };

        return Array.from(paymentMap.entries()).map(([method, data]) => ({
          segment: methodLabels[method] || method,
          revenue: data.revenue,
          orders: data.orders.size,
          averageTicket: data.orders.size > 0 ? data.revenue / data.orders.size : 0,
          percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        })).sort((a, b) => b.revenue - a.revenue);
      } else {
        // Group by order type
        const typeMap = new Map<string, { revenue: number; count: number }>();
        
        ordersData.forEach(o => {
          const type = o.order_type || 'dine_in';
          if (!typeMap.has(type)) {
            typeMap.set(type, { revenue: 0, count: 0 });
          }
          const entry = typeMap.get(type)!;
          entry.revenue += o.total || 0;
          entry.count += 1;
        });

        const typeLabels: Record<string, string> = {
          dine_in: 'Mesa',
          takeaway: 'Balcão',
          delivery: 'Delivery',
        };

        return Array.from(typeMap.entries()).map(([type, data]) => ({
          segment: typeLabels[type] || type,
          revenue: data.revenue,
          orders: data.count,
          averageTicket: data.count > 0 ? data.revenue / data.count : 0,
          percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        })).sort((a, b) => b.revenue - a.revenue);
      }
    },
  });
};

export const useEmployeePerformance = (dateRange: DateRange) => {
  return useQuery({
    queryKey: ['employee-performance', dateRange],
    queryFn: async (): Promise<{ dineIn: EmployeePerformance[]; delivery: EmployeePerformance[] }> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total, order_type, created_by')
        .eq('status', 'delivered')
        .gte('created_at', startOfDay(dateRange.start).toISOString())
        .lte('created_at', endOfDay(dateRange.end).toISOString());

      if (error) throw error;

      const ordersData = orders || [];

      // Get unique user IDs
      const userIds = [...new Set(ordersData.map(o => o.created_by).filter(Boolean))];
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));

      // Group by employee and order type
      const dineInMap = new Map<string, { revenue: number; count: number; name: string }>();
      const deliveryMap = new Map<string, { revenue: number; count: number; name: string }>();

      ordersData.forEach(o => {
        if (!o.created_by) return;
        
        const map = o.order_type === 'dine_in' ? dineInMap : deliveryMap;
        const employeeName = profileMap.get(o.created_by) || 'Desconhecido';
        
        if (!map.has(o.created_by)) {
          map.set(o.created_by, { revenue: 0, count: 0, name: employeeName });
        }
        const entry = map.get(o.created_by)!;
        entry.revenue += o.total || 0;
        entry.count += 1;
      });

      const toPerformanceArray = (map: Map<string, { revenue: number; count: number; name: string }>): EmployeePerformance[] => {
        return Array.from(map.entries())
          .map(([id, data]) => ({
            employeeId: id,
            employeeName: data.name,
            revenue: data.revenue,
            orders: data.count,
          }))
          .sort((a, b) => b.revenue - a.revenue);
      };

      return {
        dineIn: toPerformanceArray(dineInMap),
        delivery: toPerformanceArray(deliveryMap),
      };
    },
  });
};
