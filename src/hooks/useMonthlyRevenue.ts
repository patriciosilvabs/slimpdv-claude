import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface MonthlyRevenueData {
  month: string;
  monthNum: number;
  currentYear: number;
  lastYear: number;
  variation: number;
}

export function useMonthlyRevenue(months: number = 6) {
  return useQuery({
    queryKey: ['monthly-revenue', months],
    queryFn: async () => {
      const now = new Date();

      // Build all date ranges first, then fetch in parallel
      const ranges = [];
      for (let i = months - 1; i >= 0; i--) {
        const currentDate = subMonths(now, i);
        const lastYearDate = subMonths(currentDate, 12);
        ranges.push({
          currentDate,
          currentStart: startOfMonth(currentDate),
          currentEnd: endOfMonth(currentDate),
          lastStart: startOfMonth(lastYearDate),
          lastEnd: endOfMonth(lastYearDate),
        });
      }

      // Fetch all months in parallel (2 queries per month)
      const results = await Promise.all(
        ranges.map(async (r) => {
          const [{ data: currentOrders }, { data: lastOrders }] = await Promise.all([
            supabase.from('orders').select('total')
              .gte('created_at', r.currentStart.toISOString())
              .lte('created_at', r.currentEnd.toISOString())
              .eq('status', 'delivered'),
            supabase.from('orders').select('total')
              .gte('created_at', r.lastStart.toISOString())
              .lte('created_at', r.lastEnd.toISOString())
              .eq('status', 'delivered'),
          ]);

          const currentYear = currentOrders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
          const lastYear = lastOrders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
          const variation = lastYear > 0 ? ((currentYear - lastYear) / lastYear) * 100 : 0;

          return {
            month: format(r.currentDate, 'MMM', { locale: ptBR }),
            monthNum: r.currentDate.getMonth(),
            currentYear,
            lastYear,
            variation,
          } as MonthlyRevenueData;
        })
      );

      return results;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
