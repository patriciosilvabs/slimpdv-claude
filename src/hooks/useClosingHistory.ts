import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaymentMethod } from '@/hooks/useCashRegister';

export interface ClosingRecord {
  id: string;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  table_number: number | null;
  customer_name: string | null;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  payments: {
    payment_method: PaymentMethod;
    amount: number;
  }[];
}

export interface ClosingHistoryFilters {
  dateRange: 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  customStart?: Date;
  customEnd?: Date;
  paymentMethod?: PaymentMethod | 'all';
  minValue?: number;
  maxValue?: number;
  orderType?: 'all' | 'dine_in' | 'takeaway' | 'delivery';
}

function getDateRange(range: ClosingHistoryFilters['dateRange'], customStart?: Date, customEnd?: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (range) {
    case 'today':
      return { start: today, end: now };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      return { start: weekStart, end: now };
    case 'month':
      const monthStart = new Date(today);
      monthStart.setDate(monthStart.getDate() - 30);
      return { start: monthStart, end: now };
    case 'custom':
      return {
        start: customStart || today,
        end: customEnd || now
      };
    default:
      return { start: today, end: now };
  }
}

export function useClosingHistory(filters: ClosingHistoryFilters) {
  return useQuery({
    queryKey: ['closing-history', filters],
    queryFn: async () => {
      const { start, end } = getDateRange(filters.dateRange, filters.customStart, filters.customEnd);
      
      // Query orders with status delivered
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_type,
          table_id,
          customer_name,
          subtotal,
          discount,
          total,
          created_at,
          tables (number)
        `)
        .eq('status', 'delivered')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });
      
      // Apply order type filter
      if (filters.orderType && filters.orderType !== 'all') {
        query = query.eq('order_type', filters.orderType);
      }
      
      // Apply value filters
      if (filters.minValue !== undefined && filters.minValue > 0) {
        query = query.gte('total', filters.minValue);
      }
      if (filters.maxValue !== undefined && filters.maxValue > 0) {
        query = query.lte('total', filters.maxValue);
      }
      
      const { data: orders, error: ordersError } = await query;
      
      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) return [];
      
      // Get payments for these orders
      const orderIds = orders.map(o => o.id);
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('order_id, payment_method, amount')
        .in('order_id', orderIds);
      
      if (paymentsError) throw paymentsError;
      
      // Combine orders with payments
      const result: ClosingRecord[] = orders.map(order => {
        const orderPayments = payments?.filter(p => p.order_id === order.id) || [];
        return {
          id: order.id,
          order_type: order.order_type as 'dine_in' | 'takeaway' | 'delivery',
          table_number: (order.tables as any)?.number || null,
          customer_name: order.customer_name,
          subtotal: order.subtotal || 0,
          discount: order.discount || 0,
          total: order.total || 0,
          created_at: order.created_at,
          payments: orderPayments.map(p => ({
            payment_method: p.payment_method as PaymentMethod,
            amount: Number(p.amount)
          }))
        };
      });
      
      // Filter by payment method if specified
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        return result.filter(r => 
          r.payments.some(p => p.payment_method === filters.paymentMethod)
        );
      }
      
      return result;
    }
  });
}

export function useClosingHistorySummary(data: ClosingRecord[] | undefined) {
  if (!data || data.length === 0) {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      averageTicket: 0,
      totalDiscounts: 0,
      byPaymentMethod: {} as Record<PaymentMethod, number>
    };
  }
  
  const totalRevenue = data.reduce((sum, r) => sum + r.total, 0);
  const totalOrders = data.length;
  const averageTicket = totalRevenue / totalOrders;
  const totalDiscounts = data.reduce((sum, r) => sum + r.discount, 0);
  
  const byPaymentMethod: Record<PaymentMethod, number> = {
    cash: 0,
    credit_card: 0,
    debit_card: 0,
    pix: 0
  };
  
  data.forEach(record => {
    record.payments.forEach(payment => {
      byPaymentMethod[payment.payment_method] += payment.amount;
    });
  });
  
  return {
    totalRevenue,
    totalOrders,
    averageTicket,
    totalDiscounts,
    byPaymentMethod
  };
}
