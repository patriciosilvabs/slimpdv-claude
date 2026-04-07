import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface Recipe {
  id: string;
  name: string;
  description: string | null;
  tenant_id: string | null;
  output_ingredient_id: string | null;
  expected_yield: number;
  created_at: string;
  updated_at: string;
}

export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Recipe[];
    },
  });
}

export function useRecipeMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createRecipe = useMutation({
    mutationFn: async (recipe: { name: string; description?: string; output_ingredient_id?: string; expected_yield?: number }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('recipes')
        .insert({ ...recipe, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: 'Sub-receita criada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar sub-receita', description: error.message, variant: 'destructive' });
    },
  });

  const updateRecipe = useMutation({
    mutationFn: async ({ id, ...recipe }: { id: string; name?: string; description?: string; output_ingredient_id?: string | null; expected_yield?: number }) => {
      const { data, error } = await supabase
        .from('recipes')
        .update(recipe)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: 'Sub-receita atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['product-recipes'] });
      toast({ title: 'Sub-receita excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  return { createRecipe, updateRecipe, deleteRecipe };
}
