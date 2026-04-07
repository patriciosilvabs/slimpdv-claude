import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  is_insumo: boolean;
  created_at: string;
  updated_at: string;
}

export function useIngredients() {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Ingredient[];
    },
  });
}

export function useLowStockIngredients() {
  return useQuery({
    queryKey: ['ingredients', 'low-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return (data as Ingredient[]).filter(i => i.current_stock <= i.min_stock);
    },
  });
}

export function useIngredientMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createIngredient = useMutation({
    mutationFn: async (ingredient: Omit<Ingredient, 'id' | 'created_at' | 'updated_at' | 'is_insumo'> & { is_insumo?: boolean }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('ingredients')
        .insert({ ...ingredient, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast({ title: 'Ingrediente criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar ingrediente', description: error.message, variant: 'destructive' });
    },
  });

  const updateIngredient = useMutation({
    mutationFn: async ({ id, ...ingredient }: Partial<Ingredient> & { id: string }) => {
      const { data, error } = await supabase
        .from('ingredients')
        .update(ingredient)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast({ title: 'Ingrediente atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar ingrediente', description: error.message, variant: 'destructive' });
    },
  });

  const addStockMovement = useMutation({
    mutationFn: async ({ 
      ingredient_id, 
      movement_type, 
      quantity, 
      notes 
    }: { 
      ingredient_id: string; 
      movement_type: 'entry' | 'exit' | 'adjustment'; 
      quantity: number;
      notes?: string;
    }) => {
      // Get current stock
      const { data: ingredient } = await supabase
        .from('ingredients')
        .select('current_stock')
        .eq('id', ingredient_id)
        .single();
      
      if (!ingredient) throw new Error('Ingrediente não encontrado');

      const previousStock = Number(ingredient.current_stock);
      let newStock = previousStock;

      if (movement_type === 'entry') {
        newStock = previousStock + quantity;
      } else if (movement_type === 'exit') {
        newStock = previousStock - quantity;
      } else {
        newStock = quantity; // adjustment sets absolute value
      }

      const { data: userData } = await supabase.auth.getUser();

      // Create movement record
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          ingredient_id,
          movement_type,
          quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          notes,
          created_by: userData.user?.id,
          tenant_id: tenantId
        });
      
      if (movementError) throw movementError;

      // Update ingredient stock
      const { error: updateError } = await supabase
        .from('ingredients')
        .update({ current_stock: newStock })
        .eq('id', ingredient_id);
      
      if (updateError) throw updateError;

      return { previousStock, newStock };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast({ title: 'Estoque atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar estoque', description: error.message, variant: 'destructive' });
    },
  });

  const deleteIngredient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ingredients')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['products-with-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient-link-counts'] });
      toast({ title: 'Ingrediente excluído com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir ingrediente', description: error.message, variant: 'destructive' });
    },
  });

  return { createIngredient, updateIngredient, addStockMovement, deleteIngredient };
}