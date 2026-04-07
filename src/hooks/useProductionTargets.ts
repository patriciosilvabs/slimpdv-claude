import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface IngredientDailyTarget {
  id: string;
  tenant_id: string;
  ingredient_id: string;
  day_of_week: number;
  target_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface TargetWithIngredient extends IngredientDailyTarget {
  ingredient: {
    id: string;
    name: string;
    unit: string;
    current_stock: number | null;
  };
}

// Day names in Portuguese
export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const FULL_DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

export function useProductionTargets(ingredientId?: string) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['production-targets', tenant?.id, ingredientId],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      let query = supabase
        .from('ingredient_daily_targets')
        .select(`
          *,
          ingredient:ingredients(id, name, unit, current_stock)
        `)
        .eq('tenant_id', tenant.id)
        .order('day_of_week');
      
      if (ingredientId) {
        query = query.eq('ingredient_id', ingredientId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as TargetWithIngredient[];
    },
    enabled: !!tenant?.id,
  });
}

// Get targets organized by ingredient for the grid view
export function useProductionTargetsGrid() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['production-targets-grid', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return { ingredients: [], targetsMap: {} };
      
      // Get all ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('id, name, unit, current_stock')
        .eq('tenant_id', tenant.id)
        .order('name');
      
      if (ingredientsError) throw ingredientsError;
      
      // Get all targets
      const { data: targets, error: targetsError } = await supabase
        .from('ingredient_daily_targets')
        .select('*')
        .eq('tenant_id', tenant.id);
      
      if (targetsError) throw targetsError;
      
      // Create a map: ingredient_id -> { day_of_week: target }
      const targetsMap: Record<string, Record<number, IngredientDailyTarget>> = {};
      
      for (const target of targets || []) {
        if (!targetsMap[target.ingredient_id]) {
          targetsMap[target.ingredient_id] = {};
        }
        targetsMap[target.ingredient_id][target.day_of_week] = target;
      }
      
      return { 
        ingredients: ingredients || [], 
        targetsMap 
      };
    },
    enabled: !!tenant?.id,
  });
}

export function useProductionTargetMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();

  const upsertTarget = useMutation({
    mutationFn: async ({ 
      ingredientId, 
      dayOfWeek, 
      targetQuantity 
    }: { 
      ingredientId: string; 
      dayOfWeek: number; 
      targetQuantity: number;
    }) => {
      if (!tenant?.id) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('ingredient_daily_targets')
        .upsert({
          tenant_id: tenant.id,
          ingredient_id: ingredientId,
          day_of_week: dayOfWeek,
          target_quantity: targetQuantity,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,ingredient_id,day_of_week',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-targets'] });
      queryClient.invalidateQueries({ queryKey: ['production-targets-grid'] });
      queryClient.invalidateQueries({ queryKey: ['production-demand'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar meta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const copyDayTargets = useMutation({
    mutationFn: async ({ 
      fromDay, 
      toDay 
    }: { 
      fromDay: number; 
      toDay: number;
    }) => {
      if (!tenant?.id) throw new Error('Tenant não encontrado');
      
      // Get targets from source day
      const { data: sourceTargets, error: fetchError } = await supabase
        .from('ingredient_daily_targets')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('day_of_week', fromDay);
      
      if (fetchError) throw fetchError;
      if (!sourceTargets?.length) {
        throw new Error('Nenhuma meta encontrada no dia de origem');
      }
      
      // Upsert all targets to destination day
      const newTargets = sourceTargets.map(t => ({
        tenant_id: tenant.id,
        ingredient_id: t.ingredient_id,
        day_of_week: toDay,
        target_quantity: t.target_quantity,
        updated_at: new Date().toISOString(),
      }));
      
      const { error: upsertError } = await supabase
        .from('ingredient_daily_targets')
        .upsert(newTargets, {
          onConflict: 'tenant_id,ingredient_id,day_of_week',
        });
      
      if (upsertError) throw upsertError;
      
      return newTargets.length;
    },
    onSuccess: (count, { fromDay, toDay }) => {
      toast({
        title: 'Metas copiadas',
        description: `${count} metas copiadas de ${FULL_DAY_NAMES[fromDay]} para ${FULL_DAY_NAMES[toDay]}`,
      });
      queryClient.invalidateQueries({ queryKey: ['production-targets'] });
      queryClient.invalidateQueries({ queryKey: ['production-targets-grid'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao copiar metas',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTarget = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase
        .from('ingredient_daily_targets')
        .delete()
        .eq('id', targetId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-targets'] });
      queryClient.invalidateQueries({ queryKey: ['production-targets-grid'] });
      queryClient.invalidateQueries({ queryKey: ['production-demand'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover meta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    upsertTarget,
    copyDayTargets,
    deleteTarget,
  };
}
