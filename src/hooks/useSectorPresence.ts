import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

const HEARTBEAT_INTERVAL = 10_000; // 10 seconds

export interface SectorPresenceEntry {
  sector_id: string;
  user_id: string;
  is_online: boolean;
  last_seen_at: string;
  device_id: string | null;
}

export function useSectorPresence(sectorId: string | null) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!sectorId || !user?.id || !tenantId) return;
    
    await supabase.rpc('upsert_sector_presence', {
      _sector_id: sectorId,
      _user_id: user.id,
      _tenant_id: tenantId,
      _device_id: null,
    });
  }, [sectorId, user?.id, tenantId]);

  // Start heartbeat on mount
  useEffect(() => {
    if (!sectorId || !user?.id || !tenantId) return;

    // Send immediately
    sendHeartbeat();

    // Then every 10s
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      // Mark offline on unmount
      if (sectorId && user?.id) {
        supabase
          .from('sector_presence')
          .update({ is_online: false })
          .eq('sector_id', sectorId)
          .eq('user_id', user.id)
          .then(() => {});
      }
    };
  }, [sectorId, user?.id, tenantId, sendHeartbeat]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('sector-presence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sector_presence',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['sector-presence', tenantId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  // Query all presence data
  const presenceQuery = useQuery({
    queryKey: ['sector-presence', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('sector_presence')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_online', true);
      
      if (error) throw error;
      return (data || []) as SectorPresenceEntry[];
    },
    enabled: !!tenantId,
    refetchInterval: 15_000,
  });

  // Count online operators per sector
  const getOnlineCount = useCallback((targetSectorId: string) => {
    const now = Date.now();
    return (presenceQuery.data || []).filter(p => 
      p.sector_id === targetSectorId && 
      p.is_online && 
      (now - new Date(p.last_seen_at).getTime()) < 35_000
    ).length;
  }, [presenceQuery.data]);

  return {
    ...presenceQuery,
    getOnlineCount,
    sendHeartbeat,
  };
}
