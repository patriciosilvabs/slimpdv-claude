import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CancellationRecord {
  id: string;
  order_id: string;
  order_type: string | null;
  table_number?: number | null;
  customer_name: string | null;
  total: number | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_by_name?: string | null;
  cancelled_at: string | null;
  created_at: string | null;
}

export interface CancellationFilters {
  dateFrom?: Date;
  dateTo?: Date;
  reason?: string;
  cancelledBy?: string;
  startHour?: string;
  endHour?: string;
}

export function useCancellationHistory(filters: CancellationFilters) {
  return useQuery({
    queryKey: ['cancellation-history', filters],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_type,
          customer_name,
          total,
          cancellation_reason,
          cancelled_by,
          cancelled_at,
          created_at,
          table:tables(number)
        `)
        .eq('status', 'cancelled')
        .not('cancellation_reason', 'is', null)
        .order('cancelled_at', { ascending: false });

      // Date filters
      if (filters.dateFrom) {
        query = query.gte('cancelled_at', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('cancelled_at', endOfDay.toISOString());
      }

      // Reason filter (text search)
      if (filters.reason) {
        query = query.ilike('cancellation_reason', `%${filters.reason}%`);
      }

      // Cancelled by filter
      if (filters.cancelledBy) {
        query = query.eq('cancelled_by', filters.cancelledBy);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by time range
      let filtered = data || [];
      if (filters.startHour && filters.endHour) {
        const [sh, sm] = filters.startHour.split(':').map(Number);
        const [eh, em] = filters.endHour.split(':').map(Number);
        const startMin = sh * 60 + (sm || 0);
        const endMin = eh * 60 + (em || 0);
        filtered = filtered.filter(o => {
          if (!o.cancelled_at) return true;
          const d = new Date(o.cancelled_at);
          const m = d.getHours() * 60 + d.getMinutes();
          return m >= startMin && m <= endMin;
        });
      }

      // Fetch profile names for cancelled_by users
      const userIds = [...new Set(filtered.map(o => o.cancelled_by).filter(Boolean) as string[])];
      let profilesMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.id, p.name]));
        }
      }

      return filtered.map((order): CancellationRecord => ({
        id: order.id,
        order_id: order.id,
        order_type: order.order_type,
        table_number: (order.table as any)?.number || null,
        customer_name: order.customer_name,
        total: order.total,
        cancellation_reason: order.cancellation_reason,
        cancelled_by: order.cancelled_by,
        cancelled_by_name: order.cancelled_by ? profilesMap[order.cancelled_by] || null : null,
        cancelled_at: order.cancelled_at,
        created_at: order.created_at,
      }));
    },
  });
}

export function useCancellationSummary(records: CancellationRecord[]) {
  const totalCancellations = records.length;
  const totalValue = records.reduce((sum, r) => sum + (r.total || 0), 0);

  // Most common reasons
  const reasonCounts = records.reduce((acc, r) => {
    const reason = r.cancellation_reason || 'Não informado';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const mostCommonReason = sortedReasons[0]?.[0] || 'N/A';

  // Cancellations by user
  const userCounts = records.reduce((acc, r) => {
    const user = r.cancelled_by_name || 'Desconhecido';
    acc[user] = (acc[user] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalCancellations,
    totalValue,
    mostCommonReason,
    reasonBreakdown: sortedReasons,
    userBreakdown: Object.entries(userCounts).sort(([, a], [, b]) => b - a),
  };
}
