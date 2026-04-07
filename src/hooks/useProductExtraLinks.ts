import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface ProductExtraLink {
  id: string;
  product_id: string;
  extra_id: string;
  created_at: string | null;
}

export function useProductExtraLinks(extraId?: string) {
  return useQuery({
    queryKey: ['product-extra-links', extraId],
    queryFn: async () => {
      let query = supabase
        .from('product_extra_links')
        .select('*');
      
      if (extraId) {
        query = query.eq('extra_id', extraId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ProductExtraLink[];
    }
  });
}

export function useExtrasForProduct(productId?: string) {
  return useQuery({
    queryKey: ['extras-for-product', productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from('product_extra_links')
        .select('extra_id, product_extras(*)')
        .eq('product_id', productId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!productId
  });
}

export function useProductExtraLinksMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const linkExtra = useMutation({
    mutationFn: async ({ productId, extraId }: { productId: string; extraId: string }) => {
      const { data, error } = await supabase
        .from('product_extra_links')
        .insert({ product_id: productId, extra_id: extraId, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extra-links'] });
      queryClient.invalidateQueries({ queryKey: ['extras-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao vincular', description: error.message, variant: 'destructive' });
    }
  });

  const unlinkExtra = useMutation({
    mutationFn: async ({ productId, extraId }: { productId: string; extraId: string }) => {
      const { error } = await supabase
        .from('product_extra_links')
        .delete()
        .eq('product_id', productId)
        .eq('extra_id', extraId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extra-links'] });
      queryClient.invalidateQueries({ queryKey: ['extras-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao desvincular', description: error.message, variant: 'destructive' });
    }
  });

  const setLinkedProducts = useMutation({
    mutationFn: async ({ extraId, productIds }: { extraId: string; productIds: string[] }) => {
      // Remove all existing links for this extra
      const { error: deleteError } = await supabase
        .from('product_extra_links')
        .delete()
        .eq('extra_id', extraId);
      
      if (deleteError) throw deleteError;

      // Add new links if any
      if (productIds.length > 0) {
        const links = productIds.map(productId => ({
          product_id: productId,
          extra_id: extraId,
          tenant_id: tenantId
        }));

        const { error: insertError } = await supabase
          .from('product_extra_links')
          .insert(links);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extra-links'] });
      queryClient.invalidateQueries({ queryKey: ['extras-for-product'] });
      toast({ title: 'Vínculos atualizados' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar vínculos', description: error.message, variant: 'destructive' });
    }
  });

  return { linkExtra, unlinkExtra, setLinkedProducts };
}
