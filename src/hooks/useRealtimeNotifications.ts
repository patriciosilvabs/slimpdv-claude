import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAudioNotification } from './useAudioNotification';
import { toast } from 'sonner';

export function useRealtimeNotifications() {
  const { playNewOrderSound, playNewReservationSound, playOrderReadySound, playStationChangeSound } = useAudioNotification();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Subscribe to orders changes
    const ordersChannel = supabase
      .channel('orders-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newOrder = payload.new as any;
          // Ignore drafts - they're not real orders yet
          if (newOrder.is_draft) return;
          // Skip integration orders — handled by IntegrationAutoHandler
          if (newOrder.external_source) return;
          
          console.log('New order:', payload);
          playNewOrderSound();
          toast.success('Novo Pedido!', {
            description: `Pedido #${newOrder.id?.slice(0, 8)} recebido.`,
          });
        }
      )
      .subscribe();

    // Subscribe to reservations changes
    const reservationsChannel = supabase
      .channel('reservations-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          console.log('New reservation:', payload);
          playNewReservationSound();
          const reservation = payload.new as any;
          toast.success('Nova Reserva!', {
            description: `Reserva de ${reservation.customer_name} para ${reservation.party_size} pessoas.`,
          });
        }
      )
      .subscribe();

    // Subscribe to order_items changes for station transitions
    const orderItemsChannel = supabase
      .channel('order-items-station-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_items',
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Play sound when item moves to a different station
          if (oldData?.current_station_id !== newData?.current_station_id && newData?.current_station_id) {
            playStationChangeSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(orderItemsChannel);
    };
  }, [playNewOrderSound, playNewReservationSound, playOrderReadySound, playStationChangeSound]);
}
