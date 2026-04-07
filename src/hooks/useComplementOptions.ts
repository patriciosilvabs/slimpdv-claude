import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface ComplementOption {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  cost_price: number | null;
  internal_code: string | null;
  pdv_code: string | null;
  external_code: string | null;
  auto_calculate_cost: boolean | null;
  enable_stock_control: boolean | null;
  is_active: boolean | null;
  check_on_dispatch: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useComplementOptions(includeInactive = false) {
  return useQuery({
    queryKey: ['complement-options', { includeInactive }],
    queryFn: async () => {
      let query = supabase
        .from('complement_options')
        .select('*')
        .order('sort_order')
        .order('name');
      
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ComplementOption[];
    }
  });
}

export function useComplementOptionsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createOption = useMutation({
    mutationFn: async (option: Omit<ComplementOption, 'id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('complement_options')
        .insert({ ...option, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
      toast({ title: 'Opção criada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar opção', description: error.message, variant: 'destructive' });
    }
  });

  const updateOption = useMutation({
    mutationFn: async ({ id, ...option }: Partial<ComplementOption> & { id: string }) => {
      const { data, error } = await supabase
        .from('complement_options')
        .update(option)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
      toast({ title: 'Opção atualizada' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('complement_options')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
      toast({ title: 'Opção excluída com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir opção', description: error.message, variant: 'destructive' });
    }
  });

  return { createOption, updateOption, deleteOption };
}
