import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client as apiClient } from '@/integrations/api/client';

export function useGlobalSettings() {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['global-settings'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return [];
      try {
        const response = await apiClient.get<{ settings: { key: string; value: any }[] }>('/settings');
        return response.settings || [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const getSetting = (key: string): any => {
    const setting = (settings as any[]).find((s: any) => s.key === key);
    return setting?.value ?? null;
  };

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      await apiClient.put(`/settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
    },
  });

  // Handle both boolean true and string "true" for compatibility
  const rawPrintQueue = getSetting('use_print_queue');
  const usePrintQueue = rawPrintQueue === true || rawPrintQueue === 'true';

  const toggleUsePrintQueue = async () => {
    await updateSetting.mutateAsync({ key: 'use_print_queue', value: !usePrintQueue });
  };

  return {
    settings,
    isLoading,
    getSetting,
    updateSetting,
    usePrintQueue,
    toggleUsePrintQueue,
  };
}
