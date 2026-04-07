import { useQuery } from '@tanstack/react-query';
import { client as apiClient } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePlatformAdmin() {
  const { user } = useAuth();

  const { data: isPlatformAdmin, isLoading } = useQuery({
    queryKey: ['platform-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      try {
        const response = await apiClient.get('/platform-admin');
        return response.isPlatformAdmin === true;
      } catch (error) {
        console.error('Error checking platform admin:', error);
        return false;
      }
    },
    enabled: !!user?.id,
  });

  return {
    isPlatformAdmin: isPlatformAdmin ?? false,
    isLoading,
  };
}

export interface TenantWithDetails {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner_email?: string;
  owner_name?: string;
  member_count?: number;
  subscription?: {
    id: string;
    status: string;
    plan_id: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    plan?: {
      name: string;
      price_monthly: number;
    };
  } | null;
}

export function usePlatformTenants() {
  return useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      // Buscar tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      // Buscar membros e assinaturas para cada tenant
      const tenantsWithDetails: TenantWithDetails[] = await Promise.all(
        (tenants || []).map(async (tenant) => {
          // Buscar owner
          const { data: owner } = await supabase
            .from('tenant_members')
            .select('user_id')
            .eq('tenant_id', tenant.id)
            .eq('is_owner', true)
            .maybeSingle();

          let ownerProfile = null;
          if (owner?.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', owner.user_id)
              .maybeSingle();
            ownerProfile = profile;
          }

          // Contar membros
          const { count: memberCount } = await supabase
            .from('tenant_members')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          // Buscar assinatura
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select(`
              id,
              status,
              plan_id,
              trial_ends_at,
              current_period_end,
              subscription_plans (
                name,
                price_monthly
              )
            `)
            .eq('tenant_id', tenant.id)
            .maybeSingle();

          return {
            ...tenant,
            owner_name: ownerProfile?.name,
            member_count: memberCount || 0,
            subscription: subscription ? {
              id: subscription.id,
              status: subscription.status || 'inactive',
              plan_id: subscription.plan_id,
              trial_ends_at: subscription.trial_ends_at,
              current_period_end: subscription.current_period_end,
              plan: subscription.subscription_plans as { name: string; price_monthly: number } | undefined,
            } : null,
          };
        })
      );

      return tenantsWithDetails;
    },
  });
}

export function usePlatformSubscriptions() {
  return useQuery({
    queryKey: ['platform-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            price_monthly
          ),
          tenants (
            id,
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      // Total de tenants
      const { count: totalTenants } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      // Tenants ativos
      const { count: activeTenants } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Assinaturas ativas
      const { count: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Em trial
      const { count: trialSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'trialing');

      // Calcular MRR (Monthly Recurring Revenue)
      const { data: activeSubsWithPlans } = await supabase
        .from('subscriptions')
        .select(`
          subscription_plans (
            price_monthly
          )
        `)
        .eq('status', 'active');

      const mrr = (activeSubsWithPlans || []).reduce((acc, sub) => {
        const plan = sub.subscription_plans as { price_monthly: number } | null;
        return acc + (plan?.price_monthly || 0);
      }, 0);

      return {
        totalTenants: totalTenants || 0,
        activeTenants: activeTenants || 0,
        activeSubscriptions: activeSubscriptions || 0,
        trialSubscriptions: trialSubscriptions || 0,
        mrr,
      };
    },
  });
}
