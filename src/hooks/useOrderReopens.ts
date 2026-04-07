import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderReopen {
  id: string;
  order_id: string;
  table_id: string | null;
  previous_status: string;
  new_status: string;
  reopened_by: string | null;
  reopened_at: string;
  reason: string | null;
  order_type: string | null;
  customer_name: string | null;
  total_value: number | null;
  table?: { number: number } | null;
  reopened_by_name?: string;
}

export function useOrderReopens(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['order-reopens', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('order_reopens')
        .select('*, table:tables(number)')
        .order('reopened_at', { ascending: false });

      if (startDate) {
        query = query.gte('reopened_at', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('reopened_at', endOfDay.toISOString());
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Fetch user names for reopened_by
      const userIds = [...new Set(data?.filter(r => r.reopened_by).map(r => r.reopened_by) || [])];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

        return data?.map(reopen => ({
          ...reopen,
          reopened_by_name: reopen.reopened_by ? profileMap.get(reopen.reopened_by) || 'Desconhecido' : null,
        })) as OrderReopen[];
      }

      return data as OrderReopen[];
    },
  });
}

export function useOrderReopenMutations() {
  const createReopen = async (data: {
    order_id: string;
    table_id?: string | null;
    previous_status: string;
    new_status: string;
    reopened_by?: string | null;
    reason?: string | null;
    order_type?: string | null;
    customer_name?: string | null;
    total_value?: number | null;
  }) => {
    const { error } = await supabase.from('order_reopens').insert(data);
    if (error) throw error;
  };

  return { createReopen };
}
