import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface ProductComplementGroup {
  id: string;
  product_id: string;
  group_id: string;
  sort_order: number | null;
  created_at: string | null;
}

export function useProductComplementGroups(groupId?: string) {
  return useQuery({
    queryKey: ['product-complement-groups', groupId],
    queryFn: async () => {
      let query = supabase
        .from('product_complement_groups')
        .select(`
          *,
          product:products(id, name)
        `)
        .order('sort_order');
      
      if (groupId) {
        query = query.eq('group_id', groupId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!groupId
  });
}

export function useGroupsForProduct(productId?: string) {
  return useQuery({
    queryKey: ['groups-for-product', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_complement_groups')
        .select(`
          *,
          group:complement_groups(*)
        `)
        .eq('product_id', productId!)
        .order('sort_order');
      
      if (error) throw error;
      return data;
    },
    enabled: !!productId
  });
}

export function useProductComplementGroupsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const linkGroupToProduct = useMutation({
    mutationFn: async (link: { product_id: string; group_id: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from('product_complement_groups')
        .insert({ ...link, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao vincular grupo', description: error.message, variant: 'destructive' });
    }
  });

  const unlinkGroupFromProduct = useMutation({
    mutationFn: async ({ productId, groupId }: { productId: string; groupId: string }) => {
      const { error } = await supabase
        .from('product_complement_groups')
        .delete()
        .eq('product_id', productId)
        .eq('group_id', groupId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao desvincular', description: error.message, variant: 'destructive' });
    }
  });

  const setProductGroups = useMutation({
    mutationFn: async ({ groupId, productIds }: { groupId: string; productIds: string[] }) => {
      // Delete existing links for this group
      const { error: deleteError } = await supabase
        .from('product_complement_groups')
        .delete()
        .eq('group_id', groupId);
      
      if (deleteError) throw deleteError;
      
      // Insert new links
      if (productIds.length > 0) {
        const links = productIds.map((product_id, index) => ({
          group_id: groupId,
          product_id,
          sort_order: index,
          tenant_id: tenantId
        }));
        
        const { error: insertError } = await supabase
          .from('product_complement_groups')
          .insert(links);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar produtos', description: error.message, variant: 'destructive' });
    }
  });

  const setGroupsForProduct = useMutation({
    mutationFn: async ({ productId, groupIds }: { productId: string; groupIds: string[] }) => {
      // Delete existing links for this product
      const { error: deleteError } = await supabase
        .from('product_complement_groups')
        .delete()
        .eq('product_id', productId);
      
      if (deleteError) throw deleteError;
      
      // Insert new links
      if (groupIds.length > 0) {
        const links = groupIds.map((group_id, index) => ({
          product_id: productId,
          group_id,
          sort_order: index,
          tenant_id: tenantId
        }));
        
        const { error: insertError } = await supabase
          .from('product_complement_groups')
          .insert(links);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar grupos', description: error.message, variant: 'destructive' });
    }
  });

  return { linkGroupToProduct, unlinkGroupFromProduct, setProductGroups, setGroupsForProduct };
}
