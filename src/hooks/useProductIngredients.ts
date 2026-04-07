import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface ProductIngredient {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: {
    id: string;
    name: string;
    unit: string;
    cost_per_unit: number;
  };
}

export interface ProductWithIngredients {
  id: string;
  name: string;
  price: number;
  ingredients: ProductIngredient[];
  productionCost: number;
}

export function useProductIngredients(productId?: string) {
  return useQuery({
    queryKey: ['product-ingredients', productId],
    queryFn: async () => {
      let query = supabase
        .from('product_ingredients')
        .select(`
          *,
          ingredient:ingredients(id, name, unit, cost_per_unit)
        `);
      
      if (productId) {
        query = query.eq('product_id', productId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ProductIngredient[];
    },
    enabled: productId ? true : false,
  });
}

export function useAllProductsWithIngredients() {
  return useQuery({
    queryKey: ['products-with-ingredients'],
    queryFn: async () => {
      // Get all products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, price')
        .order('name');
      
      if (productsError) throw productsError;

      // Get all product ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('product_ingredients')
        .select(`
          *,
          ingredient:ingredients(id, name, unit, cost_per_unit)
        `);
      
      if (ingredientsError) throw ingredientsError;

      // Map ingredients to products
      const productsWithIngredients: ProductWithIngredients[] = products?.map(product => {
        const productIngredients = ingredients?.filter(i => i.product_id === product.id) || [];
        const productionCost = productIngredients.reduce((sum, pi) => {
          const costPerUnit = pi.ingredient?.cost_per_unit || 0;
          return sum + (costPerUnit * pi.quantity);
        }, 0);

        return {
          id: product.id,
          name: product.name,
          price: product.price,
          ingredients: productIngredients as ProductIngredient[],
          productionCost
        };
      }) || [];

      return productsWithIngredients;
    },
  });
}

export function useProductIngredientMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const addIngredient = useMutation({
    mutationFn: async ({ product_id, ingredient_id, quantity }: { 
      product_id: string; 
      ingredient_id: string; 
      quantity: number 
    }) => {
      const { data, error } = await supabase
        .from('product_ingredients')
        .insert({ product_id, ingredient_id, quantity, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['products-with-ingredients'] });
      toast({ title: 'Ingrediente adicionado à ficha técnica!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar ingrediente', description: error.message, variant: 'destructive' });
    },
  });

  const updateIngredient = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { data, error } = await supabase
        .from('product_ingredients')
        .update({ quantity })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['products-with-ingredients'] });
      toast({ title: 'Quantidade atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const removeIngredient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_ingredients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['products-with-ingredients'] });
      toast({ title: 'Ingrediente removido da ficha técnica!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  return { addIngredient, updateIngredient, removeIngredient };
}
