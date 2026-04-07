import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface PrintSector {
  id: string;
  name: string;
  description: string | null;
  printer_name: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  icon: string | null;
  color: string | null;
  created_at: string | null;
}

export function usePrintSectors() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ['print-sectors', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('print_sectors')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as PrintSector[];
    },
    enabled: !!tenantId && !tenantLoading,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePrintSectorMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createSector = useMutation({
    mutationFn: async (sector: Omit<PrintSector, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('print_sectors')
        .insert({ ...sector, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-sectors'] });
      toast({ title: 'Setor criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar setor', description: error.message, variant: 'destructive' });
    },
  });

  const updateSector = useMutation({
    mutationFn: async ({ id, ...sector }: Partial<PrintSector> & { id: string }) => {
      const { data, error } = await supabase
        .from('print_sectors')
        .update(sector)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-sectors'] });
      toast({ title: 'Setor atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar setor', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSector = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('print_sectors')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-sectors'] });
      toast({ title: 'Setor excluído!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir setor', description: error.message, variant: 'destructive' });
    },
  });

  return { createSector, updateSector, deleteSector };
}
