import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AuditEventType = 'reopen' | 'table_switch' | 'cancellation' | 'item_deletion';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  user_id: string | null;
  user_name: string | null;
  description: string;
  order_id: string | null;
  table_number: number | null;
  value: number | null;
  reason: string | null;
}

interface UseAuditEventsParams {
  startDate?: string;
  endDate?: string;
  types?: AuditEventType[];
  userId?: string;
}

export function useAuditEvents(params: UseAuditEventsParams = {}) {
  const { startDate, endDate, types, userId } = params;

  return useQuery({
    queryKey: ['audit-events', startDate, endDate, types, userId],
    queryFn: async () => {
      const events: AuditEvent[] = [];

      // Fetch reopens
      if (!types || types.includes('reopen')) {
        let reopenQuery = supabase
          .from('order_reopens')
          .select('*, tables:table_id(number)')
          .order('reopened_at', { ascending: false });

        if (startDate) {
          reopenQuery = reopenQuery.gte('reopened_at', startDate);
        }
        if (endDate) {
          reopenQuery = reopenQuery.lte('reopened_at', endDate + 'T23:59:59');
        }
        if (userId) {
          reopenQuery = reopenQuery.eq('reopened_by', userId);
        }

        const { data: reopens } = await reopenQuery;

        if (reopens) {
          // Fetch user names
          const userIds = [...new Set(reopens.map(r => r.reopened_by).filter(Boolean))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

          for (const reopen of reopens) {
            events.push({
              id: reopen.id,
              type: 'reopen',
              timestamp: reopen.reopened_at,
              user_id: reopen.reopened_by,
              user_name: profileMap.get(reopen.reopened_by) || null,
              description: `Reabriu mesa ${(reopen.tables as any)?.number || '?'}`,
              order_id: reopen.order_id,
              table_number: (reopen.tables as any)?.number || null,
              value: reopen.total_value,
              reason: reopen.reason,
            });
          }
        }
      }

      // Fetch table switches
      if (!types || types.includes('table_switch')) {
        let switchQuery = supabase
          .from('table_switches')
          .select('*, from_table:from_table_id(number), to_table:to_table_id(number)')
          .order('switched_at', { ascending: false });

        if (startDate) {
          switchQuery = switchQuery.gte('switched_at', startDate);
        }
        if (endDate) {
          switchQuery = switchQuery.lte('switched_at', endDate + 'T23:59:59');
        }
        if (userId) {
          switchQuery = switchQuery.eq('switched_by', userId);
        }

        const { data: switches } = await switchQuery;

        if (switches) {
          const userIds = [...new Set(switches.map(s => s.switched_by).filter(Boolean))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

          for (const sw of switches) {
            events.push({
              id: sw.id,
              type: 'table_switch',
              timestamp: sw.switched_at,
              user_id: sw.switched_by,
              user_name: profileMap.get(sw.switched_by) || null,
              description: `Trocou mesa ${(sw.from_table as any)?.number} → ${(sw.to_table as any)?.number}`,
              order_id: sw.order_id,
              table_number: (sw.from_table as any)?.number || null,
              value: null,
              reason: sw.reason,
            });
          }
        }
      }

      // Fetch cancelled orders
      if (!types || types.includes('cancellation')) {
        let cancelQuery = supabase
          .from('orders')
          .select('*, tables:table_id(number)')
          .eq('status', 'cancelled')
          .order('updated_at', { ascending: false });

        if (startDate) {
          cancelQuery = cancelQuery.gte('updated_at', startDate);
        }
        if (endDate) {
          cancelQuery = cancelQuery.lte('updated_at', endDate + 'T23:59:59');
        }
        if (userId) {
          cancelQuery = cancelQuery.eq('created_by', userId);
        }

        const { data: cancellations } = await cancelQuery;

        if (cancellations) {
          const userIds = [...new Set(cancellations.map(c => c.created_by).filter(Boolean))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

          for (const cancel of cancellations) {
            events.push({
              id: cancel.id,
              type: 'cancellation',
              timestamp: cancel.updated_at || cancel.created_at || '',
              user_id: cancel.created_by,
              user_name: profileMap.get(cancel.created_by) || null,
              description: cancel.table_id 
                ? `Cancelou pedido da mesa ${(cancel.tables as any)?.number}`
                : `Cancelou pedido ${cancel.order_type === 'delivery' ? 'delivery' : 'balcão'}`,
              order_id: cancel.id,
              table_number: (cancel.tables as any)?.number || null,
              value: cancel.total,
              reason: cancel.notes,
            });
          }
        }
      }

      // Sort all events by timestamp descending
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return events;
    },
  });
}

export function useAuditStats(startDate?: string, endDate?: string) {
  const { data: events } = useAuditEvents({ startDate, endDate });

  const stats = {
    total: events?.length || 0,
    reopens: events?.filter(e => e.type === 'reopen').length || 0,
    switches: events?.filter(e => e.type === 'table_switch').length || 0,
    cancellations: events?.filter(e => e.type === 'cancellation').length || 0,
    totalValue: events?.reduce((sum, e) => sum + (e.value || 0), 0) || 0,
  };

  return stats;
}
