import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { useTenant } from './useTenant';

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Reservation {
  id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes: string | null;
  status: ReservationStatus;
  created_at: string;
  created_by: string | null;
  table?: {
    number: number;
    capacity: number;
  };
}

export function useReservations(date?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['reservations', date],
    queryFn: async () => {
      let q = supabase
        .from('reservations')
        .select('*, table:tables(number, capacity)')
        .order('reservation_time');

      if (date) {
        q = q.eq('reservation_date', date);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Reservation[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reservations'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useReservationMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createReservation = useMutation({
    mutationFn: async (reservation: Omit<Reservation, 'id' | 'created_at' | 'table'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('reservations')
        .insert({ ...reservation, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({ title: 'Reserva criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar reserva', description: error.message, variant: 'destructive' });
    },
  });

  const updateReservation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Reservation> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('reservations')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({ title: 'Reserva atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar reserva', description: error.message, variant: 'destructive' });
    },
  });

  const cancelReservation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({ title: 'Reserva cancelada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cancelar reserva', description: error.message, variant: 'destructive' });
    },
  });

  return { createReservation, updateReservation, cancelReservation };
}

export function useTableAvailability(tableId: string, date: string, time: string) {
  return useQuery({
    queryKey: ['table-availability', tableId, date, time],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id')
        .eq('table_id', tableId)
        .eq('reservation_date', date)
        .eq('status', 'confirmed')
        .gte('reservation_time', `${time.split(':')[0]}:00`)
        .lte('reservation_time', `${String(parseInt(time.split(':')[0]) + 2).padStart(2, '0')}:00`);

      if (error) throw error;
      return data.length === 0;
    },
    enabled: !!tableId && !!date && !!time,
  });
}
