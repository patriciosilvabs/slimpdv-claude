import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useKdsStations } from './useKdsStations';
import { useTenant } from './useTenant';

export interface KdsStationLog {
  id: string;
  order_item_id: string;
  station_id: string;
  action: 'entered' | 'started' | 'completed' | 'skipped';
  performed_by: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
}

export interface StationMetrics {
  stationId: string;
  stationName: string;
  stationColor: string;
  totalCompleted: number;
  averageSeconds: number;
  averageMinutes: number;
  minSeconds: number;
  maxSeconds: number;
  currentQueue: number;
  inProgress: number;
}

export interface PerformanceDataPoint {
  hour: string;
  stationId: string;
  avgSeconds: number;
  count: number;
}

export interface BottleneckInfo {
  stationId: string;
  stationName: string;
  stationColor: string;
  avgTime: number;
  queueSize: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

export function useKdsStationLogs() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  // Registrar ação no log
  const logAction = useMutation({
    mutationFn: async ({
      orderItemId,
      stationId,
      action,
      durationSeconds,
      notes,
    }: {
      orderItemId: string;
      stationId: string;
      action: KdsStationLog['action'];
      durationSeconds?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('kds_station_logs')
        .insert({
          order_item_id: orderItemId,
          station_id: stationId,
          action,
          performed_by: user?.id,
          duration_seconds: durationSeconds,
          notes,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Buscar logs de um item específico
  const useItemLogs = (orderItemId: string) => {
    return useQuery({
      queryKey: ['kds-station-logs', orderItemId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('kds_station_logs')
          .select('*')
          .eq('order_item_id', orderItemId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return data as KdsStationLog[];
      },
      enabled: !!orderItemId,
    });
  };

  // Buscar métricas por praça (últimas 24h)
  const useStationMetrics = (stationId: string) => {
    return useQuery({
      queryKey: ['kds-station-metrics', stationId],
      queryFn: async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data, error } = await supabase
          .from('kds_station_logs')
          .select('*')
          .eq('station_id', stationId)
          .eq('action', 'completed')
          .gte('created_at', yesterday.toISOString());

        if (error) throw error;

        const logs = data as KdsStationLog[];
        const durations = logs
          .map(l => l.duration_seconds)
          .filter((d): d is number => d !== null);

        const averageSeconds = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

        const minSeconds = durations.length > 0 ? Math.min(...durations) : 0;
        const maxSeconds = durations.length > 0 ? Math.max(...durations) : 0;

        return {
          totalCompleted: logs.length,
          averageSeconds,
          minSeconds,
          maxSeconds,
          averageMinutes: Math.round(averageSeconds / 60),
        };
      },
      enabled: !!stationId,
      staleTime: 1000 * 60 * 5, // 5 minutos
    });
  };

  return {
    logAction,
    useItemLogs,
    useStationMetrics,
  };
}

// Hook para métricas consolidadas de todas as praças
export function useAllStationsMetrics() {
  const { activeStations } = useKdsStations();
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['kds-all-stations-metrics', activeStations.map(s => s.id), tenantId],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Buscar logs de completados - filtrado por tenant
      const { data: logsData, error: logsError } = await supabase
        .from('kds_station_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('action', 'completed')
        .gte('created_at', yesterday.toISOString());

      if (logsError) throw logsError;

      // Buscar itens em cada praça (fila atual) - filtrado por tenant e pedidos ativos
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          current_station_id, 
          station_status,
          order:orders!inner(status, is_draft)
        `)
        .eq('tenant_id', tenantId)
        .not('current_station_id', 'is', null)
        .neq('station_status', 'done')
        .not('order.status', 'in', '("delivered","cancelled")')
        .eq('order.is_draft', false);

      if (itemsError) throw itemsError;

      const logs = logsData as KdsStationLog[];
      const items = itemsData || [];

      const metrics: StationMetrics[] = activeStations.map(station => {
        const stationLogs = logs.filter(l => l.station_id === station.id);
        const durations = stationLogs
          .map(l => l.duration_seconds)
          .filter((d): d is number => d !== null);

        const averageSeconds = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

        const queueItems = items.filter(
          i => i.current_station_id === station.id && i.station_status === 'waiting'
        );
        const inProgressItems = items.filter(
          i => i.current_station_id === station.id && i.station_status === 'in_progress'
        );

        return {
          stationId: station.id,
          stationName: station.name,
          stationColor: station.color,
          totalCompleted: stationLogs.length,
          averageSeconds,
          averageMinutes: Math.round(averageSeconds / 60),
          minSeconds: durations.length > 0 ? Math.min(...durations) : 0,
          maxSeconds: durations.length > 0 ? Math.max(...durations) : 0,
          currentQueue: queueItems.length,
          inProgress: inProgressItems.length,
        };
      });

      return metrics;
    },
    enabled: activeStations.length > 0 && !!tenantId,
    staleTime: 1000 * 10, // 10 segundos
    refetchInterval: 1000 * 15, // Atualiza a cada 15 segundos para tempo real
  });
}

// Hook para histórico de performance por hora
export function useStationPerformanceHistory() {
  const { activeStations } = useKdsStations();

  return useQuery({
    queryKey: ['kds-performance-history', activeStations.map(s => s.id)],
    queryFn: async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const { data, error } = await supabase
        .from('kds_station_logs')
        .select('*')
        .eq('action', 'completed')
        .gte('created_at', sixHoursAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const logs = data as KdsStationLog[];

      // Agrupar por hora e praça
      const hourlyData: Record<string, Record<string, { total: number; count: number }>> = {};

      logs.forEach(log => {
        const hour = new Date(log.created_at).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }).split(':')[0] + ':00';

        if (!hourlyData[hour]) hourlyData[hour] = {};
        if (!hourlyData[hour][log.station_id]) {
          hourlyData[hour][log.station_id] = { total: 0, count: 0 };
        }

        if (log.duration_seconds) {
          hourlyData[hour][log.station_id].total += log.duration_seconds;
          hourlyData[hour][log.station_id].count += 1;
        }
      });

      // Converter para array de pontos
      const dataPoints: PerformanceDataPoint[] = [];
      Object.entries(hourlyData).forEach(([hour, stations]) => {
        Object.entries(stations).forEach(([stationId, data]) => {
          dataPoints.push({
            hour,
            stationId,
            avgSeconds: data.count > 0 ? Math.round(data.total / data.count) : 0,
            count: data.count,
          });
        });
      });

      return {
        dataPoints,
        stations: activeStations,
      };
    },
    enabled: activeStations.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

// Hook para análise de gargalos
export function useBottleneckAnalysis(customThresholds?: {
  defaultMaxQueueSize: number;
  defaultMaxTimeRatio: number;
  stationOverrides: Record<string, { maxQueueSize?: number; maxTimeRatio?: number; alertsEnabled?: boolean }>;
}) {
  const { data: metrics } = useAllStationsMetrics();
  const { activeStations } = useKdsStations();

  // Default thresholds if not provided
  const thresholds = customThresholds ?? {
    defaultMaxQueueSize: 5,
    defaultMaxTimeRatio: 1.5,
    stationOverrides: {},
  };

  return useQuery({
    queryKey: ['kds-bottleneck-analysis', metrics, thresholds],
    queryFn: async () => {
      if (!metrics || metrics.length === 0) return [];

      const avgAllStations = metrics.reduce((sum, m) => sum + m.averageSeconds, 0) / metrics.length;
      
      const bottlenecks: BottleneckInfo[] = [];

      metrics.forEach(m => {
        // Get station-specific thresholds or defaults
        const stationOverride = thresholds.stationOverrides[m.stationId];
        
        // Skip if alerts are disabled for this station
        if (stationOverride?.alertsEnabled === false) return;

        const maxQueueSize = stationOverride?.maxQueueSize ?? thresholds.defaultMaxQueueSize;
        const maxTimeRatio = stationOverride?.maxTimeRatio ?? thresholds.defaultMaxTimeRatio;

        let severity: BottleneckInfo['severity'] = 'low';
        let reason = '';

        // Análise de gargalo por tempo usando threshold configurado
        const timeRatio = avgAllStations > 0 ? m.averageSeconds / avgAllStations : 0;
        
        // Calculate severity based on how much it exceeds the configured ratio
        const timeExcessRatio = timeRatio / maxTimeRatio;
        if (timeExcessRatio > 1.4) {
          severity = 'critical';
          reason = `Tempo ${Math.round((timeRatio - 1) * 100)}% acima da média (limite: ${Math.round((maxTimeRatio - 1) * 100)}%)`;
        } else if (timeExcessRatio > 1.15) {
          severity = 'high';
          reason = `Tempo ${Math.round((timeRatio - 1) * 100)}% acima da média`;
        } else if (timeRatio > maxTimeRatio) {
          severity = 'medium';
          reason = `Tempo ${Math.round((timeRatio - 1) * 100)}% acima da média`;
        }

        // Análise de fila acumulada usando threshold configurado
        const queueExcessRatio = m.currentQueue / maxQueueSize;
        if (queueExcessRatio > 1.6) {
          severity = 'critical';
          reason = `Fila com ${m.currentQueue} itens (limite: ${maxQueueSize})`;
        } else if (queueExcessRatio > 1.2) {
          if (severity !== 'critical') severity = 'high';
          reason = reason || `Fila com ${m.currentQueue} itens`;
        } else if (m.currentQueue > maxQueueSize) {
          if (severity === 'low') severity = 'medium';
          reason = reason || `Fila com ${m.currentQueue} itens`;
        }

        if (severity !== 'low') {
          bottlenecks.push({
            stationId: m.stationId,
            stationName: m.stationName,
            stationColor: m.stationColor,
            avgTime: m.averageSeconds,
            queueSize: m.currentQueue,
            severity,
            reason,
          });
        }
      });

      // Ordenar por severidade
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      bottlenecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return bottlenecks;
    },
    enabled: !!metrics && metrics.length > 0,
    staleTime: 1000 * 5, // 5 segundos para reagir rápido
    refetchInterval: 1000 * 10, // Atualiza a cada 10 segundos
  });
}
