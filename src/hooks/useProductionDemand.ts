import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useEffect } from 'react';

export interface ProductionDemandItem {
  tenant_id: string;
  store_name: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  day_of_week: number;
  ideal_stock: number;
  current_stock: number;
  to_produce: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface UseProductionDemandOptions {
  tenantId?: string;
  date?: Date;
  enableRealtime?: boolean;
}

export function useProductionDemand(options: UseProductionDemandOptions = {}) {
  const { tenant } = useTenant();
  const { tenantId, date, enableRealtime = true } = options;
  
  const effectiveTenantId = tenantId || tenant?.id;
  const dayOfWeek = date ? date.getDay() : new Date().getDay();

  const query = useQuery({
    queryKey: ['production-demand', effectiveTenantId, dayOfWeek],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      
      // Query the view
      const { data, error } = await supabase
        .from('v_production_demand')
        .select('*')
        .eq('tenant_id', effectiveTenantId);
      
      if (error) throw error;
      
      return (data || []) as ProductionDemandItem[];
    },
    enabled: !!effectiveTenantId,
    refetchInterval: enableRealtime ? 30000 : false, // Refetch every 30s
  });

  // Subscribe to realtime updates for ingredients and targets
  useEffect(() => {
    if (!enableRealtime || !effectiveTenantId) return;

    const channel = supabase
      .channel('production-demand-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ingredients',
          filter: `tenant_id=eq.${effectiveTenantId}`,
        },
        () => {
          query.refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ingredient_daily_targets',
          filter: `tenant_id=eq.${effectiveTenantId}`,
        },
        () => {
          query.refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_movements',
          filter: `tenant_id=eq.${effectiveTenantId}`,
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enableRealtime, effectiveTenantId, query]);

  return query;
}

// Aggregated demand across all tenants (for CPD view)
export function useConsolidatedProductionDemand(options: { enableRealtime?: boolean } = {}) {
  const { enableRealtime = true } = options;
  
  const query = useQuery({
    queryKey: ['consolidated-production-demand'],
    queryFn: async () => {
      // This will only return data the user has access to via RLS
      const { data, error } = await supabase
        .from('v_production_demand')
        .select('*');
      
      if (error) throw error;
      
      return (data || []) as ProductionDemandItem[];
    },
    refetchInterval: enableRealtime ? 30000 : false,
  });

  return query;
}

// Get summary stats for dashboard
export function useProductionDemandSummary() {
  const { data: demand, ...rest } = useConsolidatedProductionDemand();

  const summary = {
    totalItems: demand?.length || 0,
    criticalCount: demand?.filter(d => d.status === 'critical').length || 0,
    warningCount: demand?.filter(d => d.status === 'warning').length || 0,
    okCount: demand?.filter(d => d.status === 'ok').length || 0,
    totalToProduceByIngredient: {} as Record<string, { name: string; unit: string; total: number }>,
    byStore: {} as Record<string, ProductionDemandItem[]>,
  };

  if (demand) {
    // Group by store
    for (const item of demand) {
      if (!summary.byStore[item.store_name]) {
        summary.byStore[item.store_name] = [];
      }
      summary.byStore[item.store_name].push(item);

      // Aggregate by ingredient
      if (!summary.totalToProduceByIngredient[item.ingredient_id]) {
        summary.totalToProduceByIngredient[item.ingredient_id] = {
          name: item.ingredient_name,
          unit: item.unit,
          total: 0,
        };
      }
      summary.totalToProduceByIngredient[item.ingredient_id].total += item.to_produce;
    }
  }

  return { summary, ...rest };
}
