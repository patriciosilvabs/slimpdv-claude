import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export interface KdsStation {
  id: string;
  name: string;
  station_type: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  is_edge_sector: boolean;
  oven_time_minutes: number;
  displayed_item_kinds: string[];
  created_at: string;
  updated_at: string;
}

export type StationType = 'prep_start' | 'item_assembly' | 'assembly' | 'oven_expedite' | 'order_status' | 'waiter_serve' | 'custom';

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  prep_start: 'Em preparação',
  item_assembly: 'Item em montagem',
  assembly: 'Em Produção',
  oven_expedite: 'Item em Finalização',
  order_status: 'Item Pronto',
  waiter_serve: 'Servir — Garçom',
  custom: 'Personalizada',
};

export function useKdsStations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ['kds-stations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('kds_stations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as KdsStation[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const activeStations = useMemo(() => stations.filter(s => s.is_active), [stations]);
  
  // Estações de produção (exclui order_status e waiter_serve)
  const productionStations = useMemo(() => activeStations.filter(s => s.station_type !== 'order_status' && s.station_type !== 'waiter_serve'), [activeStations]);

  // Estações de status do pedido (pode haver múltiplas)
  const orderStatusStations = useMemo(() => activeStations.filter(s => s.station_type === 'order_status'), [activeStations]);

  // Primeira estação de status (para compatibilidade)
  const orderStatusStation = orderStatusStations[0];

  // Estação do garçom (passa-prato)
  const waiterServeStation = useMemo(() => activeStations.find(s => s.station_type === 'waiter_serve'), [activeStations]);

  const createStation = useMutation({
    mutationFn: async (station: Omit<KdsStation, 'id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('kds_stations')
        .insert({ ...station, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      toast({ title: 'Praça criada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar praça', description: error.message, variant: 'destructive' });
    },
  });

  const updateStation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KdsStation> & { id: string }) => {
      const { data, error } = await supabase
        .from('kds_stations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      toast({ title: 'Praça atualizada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar praça', description: error.message, variant: 'destructive' });
    },
  });

  const deleteStation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kds_stations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      toast({ title: 'Praça excluída com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir praça', description: error.message, variant: 'destructive' });
    },
  });

  const toggleStationActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('kds_stations')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
    },
  });

  // Buscar praça por tipo
  const getStationByType = (type: StationType): KdsStation | undefined => {
    return stations.find(s => s.station_type === type && s.is_active);
  };

  // Buscar próxima praça na sequência (apenas praças de produção)
  const getNextStation = (currentStationId: string): KdsStation | undefined => {
    const currentIndex = productionStations.findIndex(s => s.id === currentStationId);
    if (currentIndex === -1 || currentIndex >= productionStations.length - 1) return undefined;
    return productionStations[currentIndex + 1];
  };
  
  // Verificar se é a última estação de produção
  const isLastProductionStation = (stationId: string): boolean => {
    const currentIndex = productionStations.findIndex(s => s.id === stationId);
    return currentIndex === productionStations.length - 1;
  };

  const reorderStations = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('kds_stations')
          .update({ sort_order: index })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      toast({ title: 'Ordem das praças atualizada' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao reordenar praças', description: error.message, variant: 'destructive' });
    },
  });

  return {
    stations,
    activeStations,
    productionStations,
    orderStatusStation,
    orderStatusStations,
    waiterServeStation,
    isLoading,
    error,
    createStation,
    updateStation,
    deleteStation,
    toggleStationActive,
    reorderStations,
    getStationByType,
    getNextStation,
    isLastProductionStation,
  };
}
