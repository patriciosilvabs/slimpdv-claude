import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useCallback } from 'react';

interface TableWaitSettings {
  enabled: boolean;
  thresholdMinutes: number;
  cooldownMinutes: number;
  checkIntervalSeconds: number;
  persistentAlert: boolean;
  kdsIdleEnabled: boolean;
  kdsIdleMinutes: number;
}

const defaultSettings: TableWaitSettings = {
  enabled: true,
  thresholdMinutes: 20,
  cooldownMinutes: 5,
  checkIntervalSeconds: 30,
  persistentAlert: true,
  kdsIdleEnabled: false,
  kdsIdleMinutes: 10,
};

const SETTINGS_KEY = 'table_wait_settings';

export function useTableWaitSettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['table-wait-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return { settings: defaultSettings };

      const { data: record, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        console.error('Error fetching table wait settings:', error);
        return { settings: defaultSettings };
      }

      if (!record) {
        return { settings: defaultSettings };
      }

      const storedValue = record.value as Record<string, unknown>;
      return {
        settings: {
          enabled: typeof storedValue?.enabled === 'boolean' ? storedValue.enabled : defaultSettings.enabled,
          thresholdMinutes: typeof storedValue?.thresholdMinutes === 'number' ? storedValue.thresholdMinutes : defaultSettings.thresholdMinutes,
          cooldownMinutes: typeof storedValue?.cooldownMinutes === 'number' ? storedValue.cooldownMinutes : defaultSettings.cooldownMinutes,
          checkIntervalSeconds: typeof storedValue?.checkIntervalSeconds === 'number' ? storedValue.checkIntervalSeconds : defaultSettings.checkIntervalSeconds,
          persistentAlert: typeof storedValue?.persistentAlert === 'boolean' ? storedValue.persistentAlert : defaultSettings.persistentAlert,
          kdsIdleEnabled: typeof storedValue?.kdsIdleEnabled === 'boolean' ? storedValue.kdsIdleEnabled : defaultSettings.kdsIdleEnabled,
          kdsIdleMinutes: typeof storedValue?.kdsIdleMinutes === 'number' ? storedValue.kdsIdleMinutes : defaultSettings.kdsIdleMinutes,
        },
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<TableWaitSettings>) => {
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
      queryClient.invalidateQueries({ queryKey: ['table-wait-settings', tenantId] });
    },
  });

  const updateSettings = useCallback((updates: Partial<TableWaitSettings>) => {
    updateMutation.mutate(updates);
  }, [updateMutation]);

  return { 
    settings: data?.settings ?? defaultSettings, 
    updateSettings,
    isLoading,
    isSaving: updateMutation.isPending,
  };
}
