import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';

export interface UnmappedSale {
  id: string;
  tenant_id: string;
  order_id: string;
  order_item_id: string;
  product_name: string;
  quantity: number;
  created_at: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
}

export function useUnmappedSales(options: {
  onlyUnresolved?: boolean;
  limit?: number;
} = {}) {
  const { tenant } = useTenant();
  const { onlyUnresolved = true, limit = 100 } = options;

  return useQuery({
    queryKey: ['unmapped-sales', tenant?.id, onlyUnresolved, limit],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      let query = supabase
        .from('unmapped_sales')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (onlyUnresolved) {
        query = query.eq('resolved', false);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as UnmappedSale[];
    },
    enabled: !!tenant?.id,
  });
}

export function useUnmappedSalesCount() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['unmapped-sales-count', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return 0;
      
      const { count, error } = await supabase
        .from('unmapped_sales')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('resolved', false);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenant?.id,
  });
}

export function useUnmappedSalesMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const resolveUnmappedSale = useMutation({
    mutationFn: async (saleId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('unmapped_sales')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', saleId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Item marcado como resolvido',
      });
      queryClient.invalidateQueries({ queryKey: ['unmapped-sales'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped-sales-count'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao resolver item',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resolveAll = useMutation({
    mutationFn: async (tenantId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from('unmapped_sales')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('tenant_id', tenantId)
        .eq('resolved', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Todos os itens foram resolvidos',
      });
      queryClient.invalidateQueries({ queryKey: ['unmapped-sales'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped-sales-count'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao resolver itens',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    resolveUnmappedSale,
    resolveAll,
  };
}
