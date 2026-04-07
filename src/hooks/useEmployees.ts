import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface Employee {
  id: string;
  name: string;
}

export function useEmployees() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['employees', tenantId],
    queryFn: async (): Promise<Employee[]> => {
      if (!tenantId) return [];

      // Fetch only members of the current tenant
      const { data: members, error: membersError } = await supabase
        .from('tenant_members')
        .select('user_id')
        .eq('tenant_id', tenantId);

      if (membersError) throw membersError;
      if (!members?.length) return [];

      const userIds = members.map(m => m.user_id);

      // Fetch profiles only for tenant members
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });
}
