import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useCallback } from 'react';

interface IdleTableSettings {
  enabled: boolean;
  thresholdMinutes: number;
  autoClose: boolean;
  includeDeliveredOrders: boolean;
}

const defaultSettings: IdleTableSettings = {
  enabled: true,
  thresholdMinutes: 15,
  autoClose: false,
  includeDeliveredOrders: false,
};

const SETTINGS_KEY = 'idle_table_settings';

export function useIdleTableSettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['idle-table-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return { settings: defaultSettings };

      const { data: record, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        console.error('Error fetching idle table settings:', error);
        return { settings: defaultSettings };
      }

      if (!record) {
        return { settings: defaultSettings };
      }

      // Merge inteligente: usa 'in' operator para preservar valores explícitos
      const storedValue = record.value as Record<string, unknown>;
      return {
        settings: {
          enabled: 'enabled' in storedValue ? !!storedValue.enabled : defaultSettings.enabled,
          thresholdMinutes: 'thresholdMinutes' in storedValue && typeof storedValue.thresholdMinutes === 'number' 
            ? storedValue.thresholdMinutes : defaultSettings.thresholdMinutes,
          autoClose: 'autoClose' in storedValue ? !!storedValue.autoClose : defaultSettings.autoClose,
          includeDeliveredOrders: 'includeDeliveredOrders' in storedValue 
            ? !!storedValue.includeDeliveredOrders : defaultSettings.includeDeliveredOrders,
        },
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<IdleTableSettings>) => {
      if (!tenantId) throw new Error('No tenant ID');

      const currentSettings = data?.settings ?? defaultSettings;
      const newSettings = { ...currentSettings, ...updates };

      const { error } = await supabase
        .from('global_settings')
        .upsert(
          {
            tenant_id: tenantId,
            key: SETTINGS_KEY,
            value: newSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,key' }
        );

      if (error) throw error;
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idle-table-settings', tenantId] });
    },
  });

  const updateSettings = useCallback((updates: Partial<IdleTableSettings>) => {
    updateMutation.mutate(updates);
  }, [updateMutation]);

  return { 
    settings: data?.settings ?? defaultSettings, 
    updateSettings,
    isLoading,
    isSaving: updateMutation.isPending,
  };
}
