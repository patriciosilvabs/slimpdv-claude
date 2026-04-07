import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface ComplementGroupOption {
  id: string;
  group_id: string;
  option_id: string;
  price_override: number | null;
  max_quantity: number | null;
  sort_order: number | null;
  created_at: string | null;
}

export interface OptionWithConfig {
  option_id: string;
  max_quantity?: number;
  price_override?: number | null;
  sort_order?: number;
}

export interface GroupOptionWithDetails extends ComplementGroupOption {
  option: {
    id: string;
    name: string;
    price: number;
    is_active: boolean | null;
  };
}

export function useComplementGroupOptions(groupId?: string) {
  return useQuery({
    queryKey: ['complement-group-options', groupId],
    queryFn: async () => {
      let query = supabase
        .from('complement_group_options')
        .select(`
          *,
          option:complement_options(id, name, price, is_active)
        `)
        .order('sort_order');
      
      if (groupId) {
        query = query.eq('group_id', groupId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as GroupOptionWithDetails[];
    },
    enabled: !!groupId
  });
}

export function useComplementGroupOptionsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const addOptionToGroup = useMutation({
    mutationFn: async (link: { group_id: string; option_id: string; price_override?: number; sort_order?: number }) => {
      const { data, error } = await supabase
        .from('complement_group_options')
        .insert({ ...link, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar opção', description: error.message, variant: 'destructive' });
    }
  });

  const removeOptionFromGroup = useMutation({
    mutationFn: async ({ groupId, optionId }: { groupId: string; optionId: string }) => {
      const { error } = await supabase
        .from('complement_group_options')
        .delete()
        .eq('group_id', groupId)
        .eq('option_id', optionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover opção', description: error.message, variant: 'destructive' });
    }
  });

  const updateGroupOption = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; price_override?: number | null; sort_order?: number }) => {
      const { error } = await supabase
        .from('complement_group_options')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });

  const setGroupOptions = useMutation({
    mutationFn: async ({ groupId, options }: { groupId: string; options: OptionWithConfig[] }) => {
      // Delete existing
      const { error: deleteError } = await supabase
        .from('complement_group_options')
        .delete()
        .eq('group_id', groupId);
      
      if (deleteError) throw deleteError;
      
      // Insert new with all configurations
      if (options.length > 0) {
        const links = options.map((opt, index) => ({
          group_id: groupId,
          option_id: opt.option_id,
          sort_order: opt.sort_order ?? index,
          max_quantity: opt.max_quantity ?? 1,
          price_override: opt.price_override ?? null,
          tenant_id: tenantId
        }));
        
        const { error: insertError } = await supabase
          .from('complement_group_options')
          .insert(links);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar opções', description: error.message, variant: 'destructive' });
    }
  });

  return { addOptionToGroup, removeOptionFromGroup, updateGroupOption, setGroupOptions };
}
