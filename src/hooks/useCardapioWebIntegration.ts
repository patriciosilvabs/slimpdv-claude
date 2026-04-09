import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface CardapioWebIntegration {
  id: string;
  tenant_id: string;
  api_token: string;
  webhook_secret: string | null;
  store_id: string | null;
  is_active: boolean;
  auto_accept: boolean;
  auto_print: boolean;
  auto_kds: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardapioWebProductMapping {
  id: string;
  tenant_id: string;
  cardapioweb_item_id: number;
  cardapioweb_item_name: string;
  local_product_id: string | null;
  local_variation_id: string | null;
  created_at: string;
}

export interface CardapioWebOptionMapping {
  id: string;
  tenant_id: string;
  cardapioweb_option_id: number;
  cardapioweb_option_name: string;
  cardapioweb_group_id: number | null;
  cardapioweb_group_name: string | null;
  local_option_id: string | null;
  local_option_name: string | null;
  local_group_name: string | null;
  created_at: string;
}

export interface CardapioWebLog {
  id: string;
  tenant_id: string;
  event_type: string;
  external_order_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useCardapioWebIntegration() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  // Fetch integration config
  const { data: integration, isLoading, error } = useQuery({
    queryKey: ['cardapioweb-integration', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('cardapioweb_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as CardapioWebIntegration | null;
    },
    enabled: !!tenantId,
  });

  // Save integration
  const saveIntegration = useMutation({
    mutationFn: async (values: {
      api_token: string;
      store_id?: string;
      webhook_secret?: string;
      is_active: boolean;
      auto_accept?: boolean;
      auto_print?: boolean;
      auto_kds?: boolean;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant não encontrado');
      }

      const resp = await supabase.functions.invoke('cardapioweb-save-integration', {
        body: {
          api_token: values.api_token,
          store_id: values.store_id || null,
          webhook_secret: values.webhook_secret || null,
          is_active: values.is_active,
          auto_accept: values.auto_accept ?? true,
          auto_print: values.auto_print ?? true,
          auto_kds: values.auto_kds ?? true,
        },
      });

      if (resp.error) throw new Error(resp.error.message || 'Erro ao salvar integração');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-integration', tenantId] });
      toast.success('Integração salva com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar integração', { description: error.message });
    },
  });

  // Delete integration
  const deleteIntegration = useMutation({
    mutationFn: async () => {
      if (!integration?.id) return;

      const { error } = await supabase
        .from('cardapioweb_integrations')
        .delete()
        .eq('id', integration.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-integration', tenantId] });
      toast.success('Integração removida');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover integração', { description: error.message });
    },
  });

  // Test connection
  const testConnection = useMutation({
    mutationFn: async (apiToken: string) => {
      const { data, error } = await supabase.functions.invoke('cardapioweb-test-connection', {
        body: { api_token: apiToken },
      });

      if (error) {
        console.error('[CardápioWeb] Test connection invoke error:', error);
        throw new Error(error.message || 'Erro ao chamar função de teste');
      }
      if (!data) {
        throw new Error('Sem resposta da função de teste');
      }
      if (!data.success) {
        throw new Error(data.message || 'Falha na conexão');
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success('Conexão bem sucedida!', {
        description: data.merchantName ? `Loja: ${data.merchantName}` : data.message,
      });
    },
    onError: (error: Error) => {
      toast.error('Falha na conexão', { description: error.message });
    },
  });

  return {
    integration,
    isLoading,
    error,
    saveIntegration,
    deleteIntegration,
    testConnection,
  };
}

export function useCardapioWebMappings() {
  const queryClient = useQueryClient();

  // Fetch mappings
  const { data: mappings, isLoading } = useQuery({
    queryKey: ['cardapioweb-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardapioweb_product_mappings')
        .select('*')
        .is('local_product_id', null)
        .order('cardapioweb_item_name');

      if (error) throw error;
      return data as CardapioWebProductMapping[];
    },
  });

  // Update mapping — uses backend endpoint so it also writes cardapioweb_code to products
  const updateMapping = useMutation({
    mutationFn: async ({
      id,
      local_product_id,
      local_variation_id,
    }: {
      id: string;
      local_product_id: string | null;
      local_variation_id: string | null;
    }) => {
      const { error } = await supabase.functions.invoke('cardapioweb-product-mappings', {
        method: 'PATCH',
        body: { id, local_product_id, local_variation_id },
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-mappings'] });
      toast.success('Mapeamento atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar mapeamento', { description: error.message });
    },
  });

  // Delete mapping
  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cardapioweb_product_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-mappings'] });
      toast.success('Mapeamento removido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover mapeamento', { description: error.message });
    },
  });

  return {
    mappings: mappings || [],
    isLoading,
    updateMapping,
    deleteMapping,
  };
}

export interface CardapioWebGroupMapping {
  id: string;
  tenant_id: string;
  cardapioweb_group_id: number;
  cardapioweb_group_name: string;
  local_group_id: string | null;
  local_group_name: string | null;
  kds_category: string | null;
  local_kds_category: string | null;
  created_at: string;
}

export function useCardapioWebGroupMappings() {
  const queryClient = useQueryClient();

  const { data: groupMappings, isLoading } = useQuery({
    queryKey: ['cardapioweb-group-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardapioweb_group_mappings')
        .select('*')
        .is('local_group_id', null)
        .order('cardapioweb_group_name');
      if (error) throw error;
      return (data as CardapioWebGroupMapping[]) || [];
    },
  });

  const updateGroupMapping = useMutation({
    mutationFn: async ({ id, local_group_id, kds_category }: { id: string; local_group_id: string | null; kds_category?: string | null }) => {
      const update: Record<string, unknown> = { local_group_id };
      if (kds_category !== undefined) update.kds_category = kds_category;
      const { error } = await supabase
        .from('cardapioweb_group_mappings')
        .update(update)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-group-mappings'] });
      toast.success('Mapeamento de grupo atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar mapeamento', { description: error.message });
    },
  });

  const deleteGroupMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cardapioweb_group_mappings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-group-mappings'] });
      toast.success('Mapeamento removido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover mapeamento', { description: error.message });
    },
  });

  return { groupMappings: groupMappings || [], isLoading, updateGroupMapping, deleteGroupMapping };
}

export function useCardapioWebOptionMappings() {
  const queryClient = useQueryClient();

  const { data: optionMappings, isLoading } = useQuery({
    queryKey: ['cardapioweb-option-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardapioweb_option_mappings')
        .select('*')
        .is('local_option_id', null)
        .order('cardapioweb_option_name');
      if (error) throw error;
      return (data as CardapioWebOptionMapping[]) || [];
    },
  });

  const updateOptionMapping = useMutation({
    mutationFn: async ({ id, local_option_id }: { id: string; local_option_id: string | null }) => {
      const { error } = await supabase
        .from('cardapioweb_option_mappings')
        .update({ local_option_id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-option-mappings'] });
      toast.success('Mapeamento de complemento atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar mapeamento', { description: error.message });
    },
  });

  const deleteOptionMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cardapioweb_option_mappings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-option-mappings'] });
      toast.success('Mapeamento removido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover mapeamento', { description: error.message });
    },
  });

  return { optionMappings: optionMappings || [], isLoading, updateOptionMapping, deleteOptionMapping };
}

export function useCardapioWebLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['cardapioweb-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardapioweb_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as CardapioWebLog[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  return {
    logs: logs || [],
    isLoading,
  };
}

export function useSyncOrderStatus() {

  return useMutation({
    mutationFn: async ({
      order_id,
      new_status,
      cancellation_reason,
    }: {
      order_id: string;
      new_status: string;
      cancellation_reason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('cardapioweb-sync-status', {
        body: { order_id, new_status, cancellation_reason },
      });

      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      console.error('[CardápioWeb] Sync error:', error);
      // Don't show error toast - the local update succeeded
    },
  });
}

export interface SyncOrdersResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

export function useSyncOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      start_date,
      end_date,
    }: {
      start_date: string;
      end_date: string;
    }): Promise<SyncOrdersResult> => {
      const { data, error } = await supabase.functions.invoke('cardapioweb-sync-orders', {
        body: { start_date, end_date },
      });

      if (error) throw error;
      return data as SyncOrdersResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-logs'] });
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-mappings'] });
      toast.success('Sincronização concluída!', {
        description: `${data.imported} pedidos importados, ${data.skipped} já existiam.`,
      });
    },
    onError: (error: Error) => {
      console.error('[CardápioWeb] Sync orders error:', error);
      toast.error('Erro na sincronização', { description: error.message });
    },
  });
}
