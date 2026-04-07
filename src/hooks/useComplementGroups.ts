import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import type { Json } from '@/integrations/supabase/types';

export interface FlavorOption {
  count: number;
  label: string;
  description: string;
}

export interface ComplementGroup {
  id: string;
  name: string;
  description: string | null;
  selection_type: 'single' | 'multiple' | 'multiple_repeat';
  is_required: boolean | null;
  min_selections: number | null;
  max_selections: number | null;
  visibility: string | null;
  channels: string[] | null;
  sort_order: number | null;
  is_active: boolean | null;
  price_calculation_type: 'sum' | 'average' | 'highest' | 'lowest' | null;
  applies_per_unit: boolean | null;
  unit_count: number | null;
  flavor_modal_enabled: boolean | null;
  flavor_modal_channels: string[] | null;
  flavor_options: FlavorOption[] | null;
  applicable_flavor_counts: number[] | null;
  kds_category: 'flavor' | 'border' | 'complement';
  created_at: string | null;
  updated_at: string | null;
}

export function useComplementGroups(includeInactive = false) {
  return useQuery({
    queryKey: ['complement-groups', { includeInactive }],
    queryFn: async () => {
      let query = supabase
        .from('complement_groups')
        .select('*')
        .order('sort_order')
        .order('name');
      
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(d => ({
        ...d,
        flavor_options: (d.flavor_options ?? []) as unknown as FlavorOption[],
      })) as ComplementGroup[];
    }
  });
}

export function useComplementGroupsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createGroup = useMutation({
    mutationFn: async (group: Omit<ComplementGroup, 'id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { flavor_options, ...rest } = group;
      const { data, error } = await supabase
        .from('complement_groups')
        .insert({ ...rest, flavor_options: flavor_options as unknown as Json, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['product-complements'] });
      toast({ title: 'Grupo de complemento criado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar grupo', description: error.message, variant: 'destructive' });
    }
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, ...group }: Partial<ComplementGroup> & { id: string }) => {
      const { flavor_options, ...rest } = group;
      const payload: Record<string, unknown> = { ...rest };
      if (flavor_options !== undefined) {
        payload.flavor_options = flavor_options as unknown as Json;
      }
      const { data, error } = await supabase
        .from('complement_groups')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['product-complements'] });
      toast({ title: 'Grupo atualizado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('complement_groups')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['product-complements'] });
      toast({ title: 'Grupo excluído com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir grupo', description: error.message, variant: 'destructive' });
    }
  });

  return { createGroup, updateGroup, deleteGroup };
}
