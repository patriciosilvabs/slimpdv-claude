import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ReplicateMenuParams {
  source_tenant_id: string;
  target_tenant_ids: string[];
  options: {
    categories: boolean;
    products: boolean;
    variations: boolean;
    complement_groups: boolean;
    complement_options: boolean;
  };
}

export interface ReplicationResult {
  success: boolean;
  tenant_id: string;
  tenant_name?: string;
  stats?: {
    categories?: { created: number; updated: number };
    products?: { created: number; updated: number };
    variations?: { created: number; updated: number };
    complement_groups?: { created: number; updated: number };
    complement_options?: { created: number; updated: number };
  };
  error?: string;
}

/**
 * Hook para replicar cardápio entre lojas do mesmo grupo
 */
export function useMenuReplication() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const replicateMenu = useMutation({
    mutationFn: async (params: ReplicateMenuParams): Promise<ReplicationResult[]> => {
      const { data, error } = await supabase.functions.invoke('replicate-menu', {
        body: params
      });
      
      if (error) {
        throw new Error(error.message || 'Erro ao replicar cardápio');
      }
      
      return data.results as ReplicationResult[];
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (successCount > 0 && failCount === 0) {
        toast({
          title: 'Cardápio replicado! 🎉',
          description: `Replicado com sucesso para ${successCount} loja(s).`,
        });
      } else if (successCount > 0 && failCount > 0) {
        toast({
          title: 'Replicação parcial',
          description: `${successCount} loja(s) com sucesso, ${failCount} com erro.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Erro na replicação',
          description: 'Não foi possível replicar para nenhuma loja.',
          variant: 'destructive',
        });
      }
      
      // Invalidar queries de cardápio
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao replicar cardápio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  return { 
    replicateMenu: replicateMenu.mutateAsync,
    isReplicating: replicateMenu.isPending,
  };
}
