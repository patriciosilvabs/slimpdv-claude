import { useEffect, useRef, useCallback } from 'react';
import { useBottleneckAnalysis, BottleneckInfo } from './useKdsStationLogs';
import { useAudioNotification } from './useAudioNotification';
import { useKdsSettings } from './useKdsSettings';
import { toast } from 'sonner';

const BOTTLENECK_ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutos entre alertas
const BOTTLENECK_STORAGE_KEY = 'kds-bottleneck-alerts';

interface AlertedBottleneck {
  stationId: string;
  severity: BottleneckInfo['severity'];
  alertedAt: number;
}

// Load persisted alerts from sessionStorage
const loadPersistedAlerts = (): Map<string, AlertedBottleneck> => {
  try {
    const stored = sessionStorage.getItem(BOTTLENECK_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.error('Error loading bottleneck alerts:', e);
  }
  return new Map();
};

// Persist alerts to sessionStorage
const persistAlerts = (alerts: Map<string, AlertedBottleneck>) => {
  try {
    const obj = Object.fromEntries(alerts);
    sessionStorage.setItem(BOTTLENECK_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error('Error persisting bottleneck alerts:', e);
  }
};

export function useBottleneckAlerts(enabled: boolean = true, soundEnabled: boolean = true) {
  const { settings } = useKdsSettings();
  const { bottleneckSettings } = settings;
  
  // Pass configured thresholds to the analysis hook
  const { data: bottlenecks } = useBottleneckAnalysis(
    bottleneckSettings.enabled ? {
      defaultMaxQueueSize: bottleneckSettings.defaultMaxQueueSize,
      defaultMaxTimeRatio: bottleneckSettings.defaultMaxTimeRatio,
      stationOverrides: bottleneckSettings.stationOverrides,
    } : undefined
  );
  
  const { playBottleneckAlertSound, settings: audioSettings } = useAudioNotification();
  const alertedBottlenecksRef = useRef<Map<string, AlertedBottleneck>>(loadPersistedAlerts());
  const lastCriticalAlertRef = useRef<number>(0);

  const shouldAlertBottleneck = useCallback((bottleneck: BottleneckInfo): boolean => {
    const now = Date.now();
    const existing = alertedBottlenecksRef.current.get(bottleneck.stationId);

    // Se nunca alertou, pode alertar
    if (!existing) return true;

    // Se a severidade aumentou, pode alertar novamente
    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    if (severityOrder[bottleneck.severity] > severityOrder[existing.severity]) {
      return true;
    }

    // Se passou o cooldown, pode alertar novamente
    if (now - existing.alertedAt > BOTTLENECK_ALERT_COOLDOWN) {
      return true;
    }

    return false;
  }, []);

  const triggerAlert = useCallback((bottleneck: BottleneckInfo) => {
    const now = Date.now();

    // Atualiza registro do alerta
    alertedBottlenecksRef.current.set(bottleneck.stationId, {
      stationId: bottleneck.stationId,
      severity: bottleneck.severity,
      alertedAt: now,
    });
    
    // Persist to sessionStorage
    persistAlerts(alertedBottlenecksRef.current);

    // Toast visual
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    const severityLabel = {
      critical: 'CRÍTICO',
      high: 'ALTO',
      medium: 'MODERADO',
      low: 'BAIXO',
    };

    toast.warning(
      `${severityEmoji[bottleneck.severity]} Gargalo ${severityLabel[bottleneck.severity]}: ${bottleneck.stationName}`,
      {
        description: bottleneck.reason,
        duration: bottleneck.severity === 'critical' ? 10000 : 5000,
        id: `bottleneck-${bottleneck.stationId}`,
      }
    );

    // Som apenas para severidades críticas/altas e respeitando cooldown global
    if (
      soundEnabled &&
      audioSettings.enabled &&
      (bottleneck.severity === 'critical' || bottleneck.severity === 'high') &&
      now - lastCriticalAlertRef.current > 30000 // 30s entre sons
    ) {
      playBottleneckAlertSound();
      lastCriticalAlertRef.current = now;
    }
  }, [soundEnabled, audioSettings.enabled, playBottleneckAlertSound]);

  useEffect(() => {
    if (!enabled || !bottleneckSettings.enabled) {
      // Limpa todos os toasts de gargalo se desabilitado
      alertedBottlenecksRef.current.forEach((_, stationId) => {
        toast.dismiss(`bottleneck-${stationId}`);
      });
      alertedBottlenecksRef.current.clear();
      persistAlerts(alertedBottlenecksRef.current);
      return;
    }
    
    if (!bottlenecks) return;
    
    // Se não há gargalos, limpar todos os toasts e alertas
    if (bottlenecks.length === 0) {
      alertedBottlenecksRef.current.forEach((_, stationId) => {
        toast.dismiss(`bottleneck-${stationId}`);
      });
      alertedBottlenecksRef.current.clear();
      persistAlerts(alertedBottlenecksRef.current);
      return;
    }

    // Set de gargalos significativos atuais (critical ou high)
    const currentSignificantIds = new Set(
      bottlenecks
        .filter(b => b.severity === 'critical' || b.severity === 'high')
        .map(b => b.stationId)
    );

    // Processa gargalos críticos e altos
    const significantBottlenecks = bottlenecks.filter(
      b => b.severity === 'critical' || b.severity === 'high'
    );

    significantBottlenecks.forEach(bottleneck => {
      const existing = alertedBottlenecksRef.current.get(bottleneck.stationId);
      
      // Se severidade diminuiu, limpar toast antigo antes de mostrar novo
      if (existing) {
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        if (severityOrder[bottleneck.severity] < severityOrder[existing.severity]) {
          toast.dismiss(`bottleneck-${bottleneck.stationId}`);
        }
      }
      
      if (shouldAlertBottleneck(bottleneck)) {
        triggerAlert(bottleneck);
      }
    });

    // Limpa alertas antigos para praças que não são mais gargalos significativos
    let hasChanges = false;
    alertedBottlenecksRef.current.forEach((alertedBottleneck, stationId) => {
      if (!currentSignificantIds.has(stationId)) {
        // Remove toast visualmente
        toast.dismiss(`bottleneck-${stationId}`);
        alertedBottlenecksRef.current.delete(stationId);
        hasChanges = true;
      }
    });
    if (hasChanges) {
      persistAlerts(alertedBottlenecksRef.current);
    }
    
    // Cleanup ao desmontar
    return () => {
      alertedBottlenecksRef.current.forEach((_, stationId) => {
        toast.dismiss(`bottleneck-${stationId}`);
      });
    };
  }, [enabled, bottleneckSettings.enabled, bottlenecks, shouldAlertBottleneck, triggerAlert]);

  return {
    bottlenecks,
    hasActiveAlerts: bottlenecks && bottlenecks.some(b => b.severity === 'critical' || b.severity === 'high'),
    criticalCount: bottlenecks?.filter(b => b.severity === 'critical').length || 0,
    highCount: bottlenecks?.filter(b => b.severity === 'high').length || 0,
  };
}
