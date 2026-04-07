import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: { id: string; name: string; unit: string };
}

export function useRecipeIngredients(recipeId?: string) {
  return useQuery({
    queryKey: ['recipe-ingredients', recipeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('*, ingredient:ingredients(id, name, unit)')
        .eq('recipe_id', recipeId!);
      if (error) throw error;
      return data as RecipeIngredient[];
    },
    enabled: !!recipeId,
  });
}

export function useRecipeIngredientMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const addIngredient = useMutation({
    mutationFn: async ({ recipe_id, ingredient_id, quantity }: { recipe_id: string; ingredient_id: string; quantity: number }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .insert({ recipe_id, ingredient_id, quantity, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-ingredients', vars.recipe_id] });
      toast({ title: 'Ingrediente adicionado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const updateIngredient = useMutation({
    mutationFn: async ({ id, quantity, recipe_id }: { id: string; quantity: number; recipe_id: string }) => {
      const { error } = await supabase.from('recipe_ingredients').update({ quantity }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-ingredients', vars.recipe_id] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const removeIngredient = useMutation({
    mutationFn: async ({ id, recipe_id }: { id: string; recipe_id: string }) => {
      const { error } = await supabase.from('recipe_ingredients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-ingredients', vars.recipe_id] });
      toast({ title: 'Ingrediente removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  return { addIngredient, updateIngredient, removeIngredient };
}
