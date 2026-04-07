import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { useTenant } from './useTenant';

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'bill_requested';

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  position_x: number;
  position_y: number;
  created_at: string;
}

export function useTables() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('number');
      
      if (error) throw error;
      return data as Table[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tables'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useTableMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createTable = useMutation({
    mutationFn: async (table: Omit<Table, 'id' | 'created_at'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('tables')
        .insert({ ...table, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast({ title: 'Mesa criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar mesa', description: error.message, variant: 'destructive' });
    },
  });

  const updateTable = useMutation({
    mutationFn: async ({ id, ...table }: Partial<Table> & { id: string }) => {
      const { data, error } = await supabase
        .from('tables')
        .update(table)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar mesa', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast({ title: 'Mesa excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir mesa', description: error.message, variant: 'destructive' });
    },
  });

  return { createTable, updateTable, deleteTable };
}