import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TableSwitch {
  id: string;
  order_id: string;
  from_table_id: string;
  to_table_id: string;
  switched_by: string | null;
  switched_at: string;
  reason: string | null;
  from_table?: { number: number } | null;
  to_table?: { number: number } | null;
  switched_by_name?: string | null;
}

export function useTableSwitches(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['table-switches', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<TableSwitch[]> => {
      let query = supabase
        .from('table_switches')
        .select(`
          *,
          from_table:tables!table_switches_from_table_id_fkey(number),
          to_table:tables!table_switches_to_table_id_fkey(number)
        `)
        .order('switched_at', { ascending: false });
      
      if (startDate) {
        query = query.gte('switched_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('switched_at', endDate.toISOString());
      }
      
      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      
      // Fetch profile names for switched_by
      const switches = data || [];
      const userIds = [...new Set(switches.filter(s => s.switched_by).map(s => s.switched_by!))];
      
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        
        profiles?.forEach(p => profileMap.set(p.id, p.name));
      }
      
      return switches.map(s => ({
        ...s,
        switched_by_name: s.switched_by ? profileMap.get(s.switched_by) || null : null,
      })) as TableSwitch[];
    },
  });
}
