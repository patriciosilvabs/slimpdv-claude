import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  preparation_time: number;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  category?: { name: string };
  cost_price: number | null;
  internal_code: string | null;
  pdv_code: string | null;
  is_featured: boolean | null;
  is_promotion: boolean | null;
  promotion_price: number | null;
  label: string | null;
  print_sector_id: string | null;
  print_sector?: { id: string; name: string; printer_name: string | null; icon: string; color: string } | null;
  unit_type: string;
  adults_only: boolean;
  hide_observation_field: boolean;
  available_for: string[];
  allowed_times: any[];
  promotional_price_schedules: any[] | null;
  dispatch_keywords: string[];
}

export function useProducts(includeInactive = false) {
  return useQuery({
    queryKey: ['products', { includeInactive }],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, category:categories(name), print_sector:print_sectors(id, name, printer_name, icon, color)')
        .order('sort_order', { ascending: true })
        .order('name');
      
      if (!includeInactive) {
        query = query.eq('is_available', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createProduct = useMutation({
    mutationFn: async (product: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category'>> & { name: string; price: number }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('products')
        .insert({ ...product, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar produto', description: error.message, variant: 'destructive' });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar produto', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto excluído com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir produto', description: error.message, variant: 'destructive' });
    },
  });

  const updateSortOrder = useMutation({
    mutationFn: async (items: Array<{ id: string; sort_order: number }>) => {
      for (const item of items) {
        const { error } = await supabase
          .from('products')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao reordenar', description: error.message, variant: 'destructive' });
    },
  });

  return { createProduct, updateProduct, deleteProduct, updateSortOrder };
}