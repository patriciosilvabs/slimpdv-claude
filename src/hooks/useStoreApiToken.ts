import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export interface StoreApiToken {
  id: string;
  tenant_id: string;
  api_token: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useStoreApiToken() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: token, isLoading } = useQuery({
    queryKey: ['store-api-token', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-api-token?tenant_id=${tenantId}`,
        { headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) return null;
      const result = await res.json();
      return result.token as StoreApiToken | null;
    },
    enabled: !!tenantId,
  });

  const generateToken = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase.functions.invoke('store-api-token', {
        body: { tenant_id: tenantId, action: 'create' },
      });
      if (error) throw error;
      return (data as any).token as StoreApiToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-api-token'] });
      toast({ title: 'Token criado', description: 'Token de API gerado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const regenerateToken = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase.functions.invoke('store-api-token', {
        body: { tenant_id: tenantId, action: 'regenerate' },
      });
      if (error) throw error;
      return (data as any).token as StoreApiToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-api-token'] });
      toast({ title: 'Token regenerado', description: 'Novo token de API gerado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  return { token, isLoading, generateToken, regenerateToken };
}
