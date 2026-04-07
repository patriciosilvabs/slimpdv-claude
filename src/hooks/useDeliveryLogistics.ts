import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import type { Json } from '@/integrations/supabase/types';

export interface DeliveryLogisticsConfig {
  enabled: boolean;
  buffer_minutes: number;
  strategy: 'disabled' | 'neighborhood' | 'proximity';
  geocoding_provider: string;
  max_group_radius_km: number;
}

const DEFAULT_CONFIG: DeliveryLogisticsConfig = {
  enabled: false,
  buffer_minutes: 3,
  strategy: 'disabled',
  geocoding_provider: 'nominatim',
  max_group_radius_km: 2,
};

export function useDeliveryLogistics() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { getSetting, updateSetting } = useGlobalSettings();

  const rawConfig = getSetting('delivery_logistics');
  const config: DeliveryLogisticsConfig = {
    ...DEFAULT_CONFIG,
    ...(rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig) ? rawConfig as Record<string, unknown> : {}),
  };

  const saveConfig = async (newConfig: Partial<DeliveryLogisticsConfig>) => {
    const merged = { ...config, ...newConfig };
    await updateSetting.mutateAsync({ key: 'delivery_logistics', value: merged as unknown as Json });
  };

  // Release a specific buffered order manually
  const releaseOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('release_buffered_order', { _order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Get count of buffered orders
  const { data: bufferedCount = 0 } = useQuery({
    queryKey: ['buffered-orders-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('logistics_status', 'buffered');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenantId && config.enabled,
    refetchInterval: 10000,
  });

  return {
    config,
    saveConfig,
    releaseOrder,
    bufferedCount,
    isEnabled: config.enabled,
  };
}
