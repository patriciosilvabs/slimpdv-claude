import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface ProductVariation {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  price_modifier: number | null;
  is_active: boolean | null;
}

export function useProductVariations(productId?: string) {
  return useQuery({
    queryKey: ['product-variations', productId],
    queryFn: async () => {
      let query = supabase
        .from('product_variations')
        .select('*')
        .order('name');
      
      if (productId) {
        query = query.eq('product_id', productId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ProductVariation[];
    }
  });
}

export function useProductVariationsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createVariation = useMutation({
    mutationFn: async (variation: { product_id: string; name: string; description?: string; price_modifier?: number; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('product_variations')
        .insert({ ...variation, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      toast({ title: 'Variação criada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar variação', description: error.message, variant: 'destructive' });
    }
  });

  const updateVariation = useMutation({
    mutationFn: async ({ id, ...variation }: { id: string; name?: string; description?: string; price_modifier?: number; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('product_variations')
        .update(variation)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      toast({ title: 'Variação atualizada' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });

  const deleteVariation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      toast({ title: 'Variação excluída com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir variação', description: error.message, variant: 'destructive' });
    }
  });

  return { createVariation, updateVariation, deleteVariation };
}
