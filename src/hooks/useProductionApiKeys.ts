import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ProductionApiKey {
  id: string;
  tenant_id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  permissions: {
    demand: boolean;
    ingredients: boolean;
    targets: boolean;
    webhook: boolean;
  };
  last_used_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ProductionApiLog {
  id: string;
  tenant_id: string;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  request_body: unknown;
  response_summary: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'pdv_';
  let key = prefix;
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export function useProductionApiKeys() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['production-api-keys', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('production_api_keys')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to match interface
      return (data || []).map(item => ({
        ...item,
        permissions: (item.permissions || { demand: true, ingredients: true, targets: true, webhook: true }) as ProductionApiKey['permissions'],
      })) as ProductionApiKey[];
    },
    enabled: !!tenantId,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['production-api-logs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('production_api_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as ProductionApiLog[];
    },
    enabled: !!tenantId,
  });

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      if (!tenantId || !user?.id) throw new Error('Missing tenant or user');
      
      const apiKey = generateApiKey();
      
      const { data, error } = await supabase
        .from('production_api_keys')
        .insert({
          tenant_id: tenantId,
          api_key: apiKey,
          name,
          created_by: user.id,
          permissions: {
            demand: true,
            ingredients: true,
            targets: true,
            webhook: true,
          },
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-api-keys'] });
      toast({ title: 'Chave criada', description: 'Nova chave de API gerada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const updateKey = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductionApiKey> }) => {
      const { error } = await supabase
        .from('production_api_keys')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-api-keys'] });
      toast({ title: 'Atualizado', description: 'Chave de API atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('production_api_keys')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-api-keys'] });
      toast({ title: 'Removida', description: 'Chave de API removida!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  return {
    apiKeys,
    logs,
    isLoading,
    logsLoading,
    createKey,
    updateKey,
    deleteKey,
  };
}
