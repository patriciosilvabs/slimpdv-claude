import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export interface UserSector {
  sectorId: string;
  sectorName: string;
  isEdgeSector: boolean;
  ovenTimeMinutes: number;
  stationType: string;
  color: string | null;
  icon: string | null;
}

export function useUserSector(overrideUserId?: string) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const userId = overrideUserId || user?.id;

  return useQuery({
    queryKey: ['user-sector', userId, tenantId],
    queryFn: async (): Promise<UserSector | null> => {
      if (!userId || !tenantId) return null;

      // Buscar sector_id do user_roles
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('sector_id')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .not('sector_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (roleError || !roleData?.sector_id) return null;

      // Buscar dados do setor
      const { data: station, error: stationError } = await supabase
        .from('kds_stations')
        .select('id, name, is_edge_sector, oven_time_minutes, station_type, color, icon')
        .eq('id', roleData.sector_id)
        .single();

      if (stationError || !station) return null;

      return {
        sectorId: station.id,
        sectorName: station.name,
        isEdgeSector: station.is_edge_sector,
        ovenTimeMinutes: station.oven_time_minutes,
        stationType: station.station_type,
        color: station.color,
        icon: station.icon,
      };
    },
    enabled: !!userId && !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}
