import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface ProductRecipe {
  id: string;
  product_id: string;
  recipe_id: string;
  quantity_multiplier: number;
}

export function useProductRecipesByRecipe(recipeId?: string) {
  return useQuery({
    queryKey: ['product-recipes', recipeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_recipes')
        .select('*')
        .eq('recipe_id', recipeId!);
      if (error) throw error;
      return data as ProductRecipe[];
    },
    enabled: !!recipeId,
  });
}

export function useRecipeProductCounts() {
  return useQuery({
    queryKey: ['recipe-product-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_recipes')
        .select('recipe_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.recipe_id] = (counts[r.recipe_id] || 0) + 1; });
      return counts;
    },
  });
}

export function useRecipeIngredientCounts() {
  return useQuery({
    queryKey: ['recipe-ingredient-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.recipe_id] = (counts[r.recipe_id] || 0) + 1; });
      return counts;
    },
  });
}

export function useProductRecipeMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const linkProducts = useMutation({
    mutationFn: async ({ recipe_id, product_ids }: { recipe_id: string; product_ids: string[] }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const rows = product_ids.map(product_id => ({
        recipe_id,
        product_id,
        tenant_id: tenantId,
        quantity_multiplier: 1,
      }));
      const { error } = await supabase.from('product_recipes').upsert(rows, { onConflict: 'product_id,recipe_id' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipes', vars.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['recipe-product-counts'] });
      toast({ title: 'Produtos vinculados!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const unlinkProducts = useMutation({
    mutationFn: async ({ recipe_id, product_ids }: { recipe_id: string; product_ids: string[] }) => {
      const { error } = await supabase
        .from('product_recipes')
        .delete()
        .eq('recipe_id', recipe_id)
        .in('product_id', product_ids);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipes', vars.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['recipe-product-counts'] });
      toast({ title: 'Produtos desvinculados!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  return { linkProducts, unlinkProducts };
}
