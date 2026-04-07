import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface ProductionOrder {
  id: string;
  recipe_id: string;
  tenant_id: string | null;
  produced_by: string | null;
  quantity_produced: number;
  expected_quantity: number;
  loss_quantity: number;
  notes: string | null;
  batch_label: string | null;
  expires_at: string | null;
  created_at: string;
  recipe?: { id: string; name: string; output_ingredient_id: string | null; expected_yield: number };
}

export function useProductionOrders() {
  return useQuery({
    queryKey: ['production-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*, recipe:recipes(id, name, output_ingredient_id, expected_yield)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ProductionOrder[];
    },
  });
}

export function useProductionOrderMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createProductionOrder = useMutation({
    mutationFn: async (params: {
      recipe_id: string;
      quantity_produced: number;
      expected_quantity: number;
      loss_quantity: number;
      batch_label?: string;
      notes?: string;
      expires_at?: string;
      // ingredients to deduct (raw materials) and output ingredient to credit
      ingredientDeductions: { ingredient_id: string; quantity: number; current_stock: number; unit: string }[];
      outputIngredient: { id: string; current_stock: number; unit: string } | null;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { data: userData } = await supabase.auth.getUser();

      // 1. Create the production order
      const { data: order, error: orderError } = await supabase
        .from('production_orders')
        .insert({
          recipe_id: params.recipe_id,
          tenant_id: tenantId,
          produced_by: userData.user?.id,
          quantity_produced: params.quantity_produced,
          expected_quantity: params.expected_quantity,
          loss_quantity: params.loss_quantity,
          batch_label: params.batch_label || null,
          notes: params.notes || null,
          expires_at: params.expires_at || null,
        })
        .select()
        .single();
      if (orderError) throw orderError;

      // 2. Deduct raw materials (stock_movements exit)
      for (const ing of params.ingredientDeductions) {
        let deductQty = ing.quantity;
        if (ing.unit === 'kg') deductQty = deductQty / 1000;

        const newStock = Math.max(0, ing.current_stock - deductQty);

        const { error: mvError } = await supabase
          .from('stock_movements')
          .insert({
            ingredient_id: ing.ingredient_id,
            movement_type: 'exit',
            quantity: deductQty,
            previous_stock: ing.current_stock,
            new_stock: newStock,
            tenant_id: tenantId,
            notes: `Produção - ${params.batch_label || 'Lote'}`,
          });
        if (mvError) throw mvError;

        const { error: upError } = await supabase
          .from('ingredients')
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', ing.ingredient_id);
        if (upError) throw upError;
      }

      // 3. Credit the output ingredient (stock_movements entry)
      if (params.outputIngredient) {
        let creditQty = params.quantity_produced;
        if (params.outputIngredient.unit === 'kg') creditQty = creditQty / 1000;

        const newStock = (params.outputIngredient.current_stock || 0) + creditQty;

        const { error: mvError } = await supabase
          .from('stock_movements')
          .insert({
            ingredient_id: params.outputIngredient.id,
            movement_type: 'entry',
            quantity: creditQty,
            previous_stock: params.outputIngredient.current_stock || 0,
            new_stock: newStock,
            tenant_id: tenantId,
            notes: `Produção - ${params.batch_label || 'Lote'}`,
          });
        if (mvError) throw mvError;

        const { error: upError } = await supabase
          .from('ingredients')
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', params.outputIngredient.id);
        if (upError) throw upError;
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast({ title: 'Produção registrada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar produção', description: error.message, variant: 'destructive' });
    },
  });

  return { createProductionOrder };
}
