import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export type AppRole = 'admin' | 'cashier' | 'waiter' | 'kitchen' | 'kds' | 'gerente' | 'supervisor';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  tenant_id: string | null;
}

export function useUserRole() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  const query = useQuery({
    queryKey: ['user-roles', user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let queryBuilder = supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);
      
      // Filter by tenant if user belongs to one
      if (tenantId) {
        queryBuilder = queryBuilder.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!user?.id,
  });

  const roles = query.data?.map(r => r.role) || [];
  
  return {
    ...query,
    roles,
    isAdmin: roles.includes('admin'),
    isCashier: roles.includes('cashier'),
    isWaiter: roles.includes('waiter'),
    isKitchen: roles.includes('kitchen'),
    isKds: roles.includes('kds'),
    isGerente: roles.includes('gerente'),
    isSupervisor: roles.includes('supervisor'),
    hasRole: (role: AppRole) => roles.includes(role),
    hasAnyRole: (allowedRoles: AppRole[]) => allowedRoles.some(r => roles.includes(r)),
  };
}

export interface UserWithRoles {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_roles: { role: AppRole }[];
}

export function useAllUsers() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['all-users', tenantId],
    queryFn: async () => {
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
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;

      // Fetch roles filtered by tenant
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        ...profile,
        user_roles: (allRoles || [])
          .filter((role) => role.user_id === profile.id)
          .map((r) => ({ role: r.role as AppRole })),
      }));

      return usersWithRoles;
    },
    enabled: !!tenantId,
  });
}

export function useUserRoleMutations() {
  const { refetch } = useUserRole();

  const assignRole = async (userId: string, role: AppRole, tenantId?: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role, tenant_id: tenantId ?? null });
    
    if (error) throw error;
    refetch();
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);
    
    if (error) throw error;
    refetch();
  };

  return { assignRole, removeRole };
}
