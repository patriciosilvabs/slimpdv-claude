import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAudioNotification } from './useAudioNotification';
import { useKdsSettings } from './useKdsSettings';
import { differenceInMinutes } from 'date-fns';

/**
 * Hook para monitorar itens atrasados e tocar som de alerta
 * Verifica periodicamente se há itens acima do tempo limite na estação
 */
export function useItemDelayAlert() {
  const { playItemDelayAlertSound } = useAudioNotification();
  const { settings } = useKdsSettings();
  const lastAlertRef = useRef<number>(0);
  const alertCooldownMs = 60000; // 1 minuto entre alertas

  // Query para buscar itens em estações (não finalizados)
  const { data: activeItems } = useQuery({
    queryKey: ['kds-active-items-for-alert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id,
          station_started_at,
          created_at,
          current_station_id,
          station_status,
          order:orders!inner(status, is_draft)
        `)
        .not('current_station_id', 'is', null)
        .eq('station_status', 'waiting')
        .not('order.status', 'in', '("delivered","cancelled")')
        .eq('order.is_draft', false);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Verifica a cada 30 segundos
    enabled: settings.delayAlertEnabled,
  });

  useEffect(() => {
    if (!settings.delayAlertEnabled || !activeItems?.length) return;

    const now = Date.now();
    const delayThreshold = settings.delayAlertMinutes;

    // Verificar se algum item ultrapassou o tempo limite
    const hasDelayedItems = activeItems.some((item) => {
      const refTime = item.station_started_at || item.created_at;
      if (!refTime) return false;
      const elapsed = differenceInMinutes(new Date(), new Date(refTime));
      return elapsed >= delayThreshold;
    });

    // Tocar som se houver itens atrasados e passou o cooldown
    if (hasDelayedItems && now - lastAlertRef.current > alertCooldownMs) {
      playItemDelayAlertSound();
      lastAlertRef.current = now;
    }
  }, [activeItems, settings.delayAlertEnabled, settings.delayAlertMinutes, playItemDelayAlertSound]);

  return null;
}
