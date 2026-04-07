import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useBusinessRules } from '@/hooks/useBusinessRules';
import { useOpenCashRegister } from '@/hooks/useCashRegister';

export function useOperatorSalesTarget() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { rules } = useBusinessRules();
  const { data: openRegister } = useOpenCashRegister();

  // Determine shift start: use cash register opening time or start of today
  const shiftStart = openRegister?.opened_at
    ? new Date(openRegister.opened_at).toISOString()
    : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const { data: salesData } = useQuery({
    queryKey: ['operator-sales-target', user?.id, shiftStart, tenantId],
    queryFn: async () => {
      if (!user?.id || !tenantId) return { total: 0, orderCount: 0 };

      const { data, error } = await (supabase as any)
        .from('orders')
        .select('total')
        .eq('tenant_id', tenantId)
        .eq('created_by', user.id)
        .neq('status', 'cancelled')
        .gte('created_at', shiftStart);

      if (error) throw error;

      const total = (data || []).reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
      return { total, orderCount: (data || []).length };
    },
    enabled: !!user?.id && !!tenantId && rules.min_sales_target_enabled,
    refetchInterval: 60_000, // refresh every minute
  });

  const target = rules.min_sales_target_amount;
  const current = salesData?.total || 0;
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
  const isEnabled = rules.min_sales_target_enabled;
  const alertThreshold = rules.min_sales_target_alert_percent;
  const isBelowAlert = isEnabled && percent < alertThreshold;

  return {
    isEnabled,
    target,
    current,
    percent,
    isBelowAlert,
    orderCount: salesData?.orderCount || 0,
    alertThreshold,
  };
}
