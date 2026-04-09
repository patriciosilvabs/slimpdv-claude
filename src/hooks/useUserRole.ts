import { useQuery } from '@tanstack/react-query';
import { client as apiClient } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export type AppRole = 'admin' | 'cashier' | 'waiter' | 'kitchen' | 'kds' | 'gerente' | 'supervisor';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  tenant_id: string | null;
}

export interface UserWithRoles {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_roles: { role: AppRole }[];
}

export function useUserRole() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  const query = useQuery({
    queryKey: ['user-roles', user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await apiClient.get<UserRole[]>('/user-roles');
      return data || [];
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

export function useAllUsers() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['all-users', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const data = await apiClient.get<{ data: UserWithRoles[] }>('/users');
      return data.data || [];
    },
    enabled: !!tenantId,
  });
}

export function useUserRoleMutations() {
  const assignRole = async (userId: string, role: AppRole) => {
    await apiClient.post('/user-roles', { userId, role });
  };

  const removeRole = async (userId: string, role: AppRole) => {
    await apiClient.delete('/user-roles', { userId, role });
  };

  return { assignRole, removeRole };
}
