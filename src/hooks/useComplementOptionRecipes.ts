import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface ComplementOptionRecipe {
  id: string;
  complement_option_id: string;
  recipe_id: string;
  quantity_multiplier: number;
}

export function useComplementOptionRecipesByRecipe(recipeId?: string) {
  return useQuery({
    queryKey: ['complement-option-recipes', recipeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('complement_option_recipes')
        .select('*')
        .eq('recipe_id', recipeId!);
      if (error) throw error;
      return data as ComplementOptionRecipe[];
    },
    enabled: !!recipeId,
  });
}

export function useRecipeOptionCounts() {
  return useQuery({
    queryKey: ['recipe-option-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('complement_option_recipes')
        .select('recipe_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.recipe_id] = (counts[r.recipe_id] || 0) + 1; });
      return counts;
    },
  });
}

export function useComplementOptionRecipeMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const linkOptions = useMutation({
    mutationFn: async ({ recipe_id, option_ids, quantity_multiplier = 1 }: { recipe_id: string; option_ids: string[]; quantity_multiplier?: number }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const rows = option_ids.map(complement_option_id => ({
        recipe_id,
        complement_option_id,
        tenant_id: tenantId,
        quantity_multiplier,
      }));
      const { error } = await supabase
        .from('complement_option_recipes')
        .upsert(rows, { onConflict: 'complement_option_id,recipe_id' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['complement-option-recipes', vars.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['recipe-option-counts'] });
      toast({ title: 'Opções vinculadas!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const unlinkOptions = useMutation({
    mutationFn: async ({ recipe_id, option_ids }: { recipe_id: string; option_ids: string[] }) => {
      const { error } = await supabase
        .from('complement_option_recipes')
        .delete()
        .eq('recipe_id', recipe_id)
        .in('complement_option_id', option_ids);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['complement-option-recipes', vars.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['recipe-option-counts'] });
      toast({ title: 'Opções desvinculadas!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  return { linkOptions, unlinkOptions };
}
