import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKdsSettings } from './useKdsSettings';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface KdsDevice {
  id: string;
  device_id: string;
  name: string;
  station_id: string | null;
  operation_mode: string;
  last_seen_at: string;
  is_active: boolean;
  created_at: string;
}

export function useKdsDevice() {
  const { settings, updateDeviceSettings } = useKdsSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  // Buscar registro do dispositivo no banco sem recriar automaticamente
  const { data: device, isLoading } = useQuery({
    queryKey: ['kds-device', settings.deviceId],
    queryFn: async () => {
      if (!settings.deviceId) return null;

      const { data: existing, error: fetchError } = await supabase
        .from('kds_devices')
        .select('*')
        .eq('device_id', settings.deviceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!existing) {
        return null;
      }

      await supabase
        .from('kds_devices')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', existing.id);

      return existing as KdsDevice;
    },
    enabled: !!settings.deviceId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Atualizar dispositivo no banco quando configurações mudarem
  const updateDevice = useMutation({
    mutationFn: async (updates: Partial<Omit<KdsDevice, 'id' | 'device_id' | 'created_at'>>) => {
      if (!device?.id) return null;

      const { data, error } = await supabase
        .from('kds_devices')
        .update({
          ...updates,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', device.id)
        .select()
        .single();

      if (error) throw error;
      return data as KdsDevice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device', settings.deviceId] });
    },
    onError: (error) => {
      console.error('Error updating KDS device:', error);
    },
  });

  // Sincronizar configurações locais com o banco
  const syncToDatabase = useCallback(() => {
    if (!device) return;

    updateDevice.mutate({
      name: settings.deviceName,
      operation_mode: settings.operationMode,
      station_id: settings.assignedStationId,
    });
  }, [device, settings.deviceName, settings.operationMode, settings.assignedStationId, updateDevice]);

  // Atribuir dispositivo a uma praça
  const assignToStation = useCallback((stationId: string | null) => {
    updateDeviceSettings({ assignedStationId: stationId });
    
    if (device) {
      updateDevice.mutate({ station_id: stationId });
    }

    toast({
      title: stationId ? 'Dispositivo atribuído à praça' : 'Dispositivo desvinculado da praça',
    });
  }, [device, updateDevice, updateDeviceSettings, toast]);

  // Renomear dispositivo
  const renameDevice = useCallback((name: string) => {
    updateDeviceSettings({ deviceName: name });
    
    if (device) {
      updateDevice.mutate({ name });
    }
  }, [device, updateDevice, updateDeviceSettings]);

  // Atualizar heartbeat periodicamente
  useEffect(() => {
    if (!device?.id) return;

    const interval = setInterval(() => {
      supabase
        .from('kds_devices')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', device.id)
        .then();
    }, 60000); // A cada 1 minuto

    return () => clearInterval(interval);
  }, [device?.id]);

  // Buscar todos os dispositivos (para admin)
  const { data: allDevices = [] } = useQuery({
    queryKey: ['kds-devices-all', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('kds_devices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      return data as KdsDevice[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 30, // 30 segundos
  });

  return {
    device,
    allDevices,
    isLoading,
    assignToStation,
    renameDevice,
    syncToDatabase,
    updateDevice,
  };
}
