import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type KdsOperationMode = 'traditional' | 'production_line';
export type OrderManagementViewMode = 'follow_kds' | 'kanban' | 'production_line';
export type KanbanColumn = 'pending' | 'preparing' | 'ready' | 'delivered_today';
export type KdsRoutingMode = 'sequential' | 'smart';

export interface BottleneckStationOverride {
  maxQueueSize?: number;
  maxTimeRatio?: number;
  alertsEnabled?: boolean;
}

export interface BottleneckSettings {
  enabled: boolean;
  defaultMaxQueueSize: number;
  defaultMaxTimeRatio: number;
  stationOverrides: Record<string, BottleneckStationOverride>;
}

// Global settings (synced to database)
export interface KdsGlobalSettings {
  operationMode: KdsOperationMode;
  orderManagementViewMode: OrderManagementViewMode;
  kanbanVisibleColumns: KanbanColumn[];
  routingMode: KdsRoutingMode;
  slaGreenMinutes: number;
  slaYellowMinutes: number;
  showPendingColumn: boolean;
  cancellationAlertInterval: number;
  cancellationAlertsEnabled: boolean;
  autoPrintCancellations: boolean;
  highlightSpecialBorders: boolean;
  borderKeywords: string[];
  bottleneckSettings: BottleneckSettings;
  showPartySize: boolean;
  compactMode: boolean;
  darkMode: boolean;
  timerGreenMinutes: number;
  timerYellowMinutes: number;
  delayAlertEnabled: boolean;
  delayAlertMinutes: number;
  notesBlinkAllStations: boolean;
  showWaiterName: boolean;
  borderBadgeColor: string;
  notesBadgeColor: string;
  columnNamePending: string;
  columnNamePreparing: string;
  columnNameReady: string;
  columnNameDelivered: string;
  hideFlavorCategoryKds: boolean;
  dispatchKeywords: string[];
}

// Device-specific settings (stored in localStorage)
export interface KdsDeviceSettings {
  deviceId: string;
  deviceName: string;
  assignedStationId: string | null;
}

// Combined settings interface
export interface KdsSettings extends KdsGlobalSettings, KdsDeviceSettings {}

const DEVICE_STORAGE_KEY = 'pdv_kds_device_settings';

// Generate unique device ID
const generateDeviceId = (): string => {
  const stored = localStorage.getItem('pdv_kds_device_id');
  if (stored) return stored;
  
  const newId = crypto.randomUUID();
  localStorage.setItem('pdv_kds_device_id', newId);
  return newId;
};

const defaultBottleneckSettings: BottleneckSettings = {
  enabled: true,
  defaultMaxQueueSize: 5,
  defaultMaxTimeRatio: 1.5,
  stationOverrides: {},
};

const defaultGlobalSettings: KdsGlobalSettings = {
  operationMode: 'traditional',
  orderManagementViewMode: 'follow_kds',
  routingMode: 'sequential',
  kanbanVisibleColumns: ['pending', 'preparing', 'ready', 'delivered_today'],
  slaGreenMinutes: 8,
  slaYellowMinutes: 12,
  showPendingColumn: true,
  cancellationAlertInterval: 3,
  cancellationAlertsEnabled: true,
  autoPrintCancellations: true,
  highlightSpecialBorders: true,
  borderKeywords: [],
  bottleneckSettings: defaultBottleneckSettings,
  showPartySize: true,
  compactMode: false,
  darkMode: false,
  timerGreenMinutes: 5,
  timerYellowMinutes: 10,
  delayAlertEnabled: true,
  delayAlertMinutes: 10,
  notesBlinkAllStations: false,
  showWaiterName: true,
  borderBadgeColor: 'amber',
  notesBadgeColor: 'orange',
  columnNamePending: 'PENDENTE',
  columnNamePreparing: 'EM PREPARO',
  columnNameReady: 'PRONTO',
  columnNameDelivered: 'ENTREGUES HOJE',
  hideFlavorCategoryKds: false,
  dispatchKeywords: [],
};

const getDeviceSettings = (): KdsDeviceSettings => {
  try {
    const stored = localStorage.getItem(DEVICE_STORAGE_KEY);
    const deviceId = generateDeviceId();
    
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...parsed, deviceId };
    }
    
    return {
      deviceId,
      deviceName: 'KDS Device',
      assignedStationId: null,
    };
  } catch (e) {
    console.error('Error loading device settings:', e);
    return {
      deviceId: generateDeviceId(),
      deviceName: 'KDS Device',
      assignedStationId: null,
    };
  }
};

const saveDeviceSettings = (settings: KdsDeviceSettings) => {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving device settings:', e);
  }
};

// Parse bottleneck settings from database JSON
const parseBottleneckSettings = (dbSettings: unknown): BottleneckSettings => {
  if (!dbSettings || typeof dbSettings !== 'object') {
    return defaultBottleneckSettings;
  }
  
  const settings = dbSettings as Record<string, unknown>;
  return {
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : defaultBottleneckSettings.enabled,
    defaultMaxQueueSize: typeof settings.defaultMaxQueueSize === 'number' ? settings.defaultMaxQueueSize : defaultBottleneckSettings.defaultMaxQueueSize,
    defaultMaxTimeRatio: typeof settings.defaultMaxTimeRatio === 'number' ? settings.defaultMaxTimeRatio : defaultBottleneckSettings.defaultMaxTimeRatio,
    stationOverrides: (settings.stationOverrides as Record<string, BottleneckStationOverride>) || {},
  };
};

export function useKdsSettings(overrideTenantId?: string | null) {
  const queryClient = useQueryClient();
  const [deviceSettings, setDeviceSettings] = useState<KdsDeviceSettings>(getDeviceSettings);

  // Get tenant_id for current user
  const { data: userTenantId } = useQuery({
    queryKey: ['user-tenant-id'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_tenant_id');
      if (error) throw error;
      return data as string | null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Use override tenant ID (from device auth) as fallback
  const tenantId = userTenantId || overrideTenantId || null;

  // Fetch global settings from database filtered by tenant
  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['kds-global-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('kds_global_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching KDS global settings:', error);
        throw error;
      }

      return data;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 10, // 10 seconds — KDS needs fast setting updates
    refetchInterval: 1000 * 30, // Poll every 30s for cross-device sync
  });

  // Parse global settings from database - usando 'in' operator para preservar valores explícitos
  const globalSettings: KdsGlobalSettings = useMemo(() => {
    if (!dbSettings) return defaultGlobalSettings;

    // Helper para verificar se chave existe e pegar valor
    const getVal = <T>(dbKey: string, defaultVal: T): T => {
      return dbKey in dbSettings ? (dbSettings as any)[dbKey] : defaultVal;
    };

    return {
      operationMode: getVal('operation_mode', defaultGlobalSettings.operationMode) as KdsOperationMode,
      orderManagementViewMode: getVal('order_management_view_mode', defaultGlobalSettings.orderManagementViewMode) as OrderManagementViewMode,
      routingMode: getVal('routing_mode', defaultGlobalSettings.routingMode) as KdsRoutingMode,
      kanbanVisibleColumns: getVal('kanban_visible_columns', defaultGlobalSettings.kanbanVisibleColumns) as KanbanColumn[],
      slaGreenMinutes: getVal('sla_green_minutes', defaultGlobalSettings.slaGreenMinutes),
      slaYellowMinutes: getVal('sla_yellow_minutes', defaultGlobalSettings.slaYellowMinutes),
      showPendingColumn: getVal('show_pending_column', defaultGlobalSettings.showPendingColumn),
      cancellationAlertInterval: getVal('cancellation_alert_interval', defaultGlobalSettings.cancellationAlertInterval),
      cancellationAlertsEnabled: getVal('cancellation_alerts_enabled', defaultGlobalSettings.cancellationAlertsEnabled),
      autoPrintCancellations: getVal('auto_print_cancellations', defaultGlobalSettings.autoPrintCancellations),
      highlightSpecialBorders: getVal('highlight_special_borders', defaultGlobalSettings.highlightSpecialBorders),
      borderKeywords: getVal('border_keywords', defaultGlobalSettings.borderKeywords),
      bottleneckSettings: parseBottleneckSettings(dbSettings.bottleneck_settings),
      showPartySize: getVal('show_party_size', defaultGlobalSettings.showPartySize),
      compactMode: getVal('compact_mode', defaultGlobalSettings.compactMode),
      darkMode: getVal('dark_mode', defaultGlobalSettings.darkMode),
      timerGreenMinutes: getVal('timer_green_minutes', defaultGlobalSettings.timerGreenMinutes),
      timerYellowMinutes: getVal('timer_yellow_minutes', defaultGlobalSettings.timerYellowMinutes),
      delayAlertEnabled: getVal('delay_alert_enabled', defaultGlobalSettings.delayAlertEnabled),
      delayAlertMinutes: getVal('delay_alert_minutes', defaultGlobalSettings.delayAlertMinutes),
      notesBlinkAllStations: getVal('notes_blink_all_stations', defaultGlobalSettings.notesBlinkAllStations),
      showWaiterName: getVal('show_waiter_name', defaultGlobalSettings.showWaiterName),
      borderBadgeColor: getVal('border_badge_color', defaultGlobalSettings.borderBadgeColor),
      notesBadgeColor: getVal('notes_badge_color', defaultGlobalSettings.notesBadgeColor),
      columnNamePending: getVal('column_name_pending', defaultGlobalSettings.columnNamePending),
      columnNamePreparing: getVal('column_name_preparing', defaultGlobalSettings.columnNamePreparing),
      columnNameReady: getVal('column_name_ready', defaultGlobalSettings.columnNameReady),
      columnNameDelivered: getVal('column_name_delivered', defaultGlobalSettings.columnNameDelivered),
      hideFlavorCategoryKds: getVal('hide_flavor_category_kds', defaultGlobalSettings.hideFlavorCategoryKds),
      dispatchKeywords: getVal('dispatch_keywords', defaultGlobalSettings.dispatchKeywords) ?? [],
    };
  }, [dbSettings]);

  // Combined settings
  const settings: KdsSettings = useMemo(() => ({
    ...globalSettings,
    ...deviceSettings,
  }), [globalSettings, deviceSettings]);

  // Mutation to update global settings in database
  const updateGlobalMutation = useMutation({
    mutationFn: async (updates: Partial<KdsGlobalSettings>) => {
      if (!tenantId) throw new Error('No tenant ID available');

      const dbUpdates: Record<string, unknown> = {
        tenant_id: tenantId,
      };
      
      if (updates.operationMode !== undefined) dbUpdates.operation_mode = updates.operationMode;
      if (updates.orderManagementViewMode !== undefined) dbUpdates.order_management_view_mode = updates.orderManagementViewMode;
      if (updates.routingMode !== undefined) dbUpdates.routing_mode = updates.routingMode;
      if (updates.kanbanVisibleColumns !== undefined) dbUpdates.kanban_visible_columns = updates.kanbanVisibleColumns;
      if (updates.slaGreenMinutes !== undefined) dbUpdates.sla_green_minutes = updates.slaGreenMinutes;
      if (updates.slaYellowMinutes !== undefined) dbUpdates.sla_yellow_minutes = updates.slaYellowMinutes;
      if (updates.showPendingColumn !== undefined) dbUpdates.show_pending_column = updates.showPendingColumn;
      if (updates.cancellationAlertInterval !== undefined) dbUpdates.cancellation_alert_interval = updates.cancellationAlertInterval;
      if (updates.cancellationAlertsEnabled !== undefined) dbUpdates.cancellation_alerts_enabled = updates.cancellationAlertsEnabled;
      if (updates.autoPrintCancellations !== undefined) dbUpdates.auto_print_cancellations = updates.autoPrintCancellations;
      if (updates.highlightSpecialBorders !== undefined) dbUpdates.highlight_special_borders = updates.highlightSpecialBorders;
      if (updates.borderKeywords !== undefined) dbUpdates.border_keywords = updates.borderKeywords;
      if (updates.bottleneckSettings !== undefined) dbUpdates.bottleneck_settings = updates.bottleneckSettings;
      if (updates.showPartySize !== undefined) dbUpdates.show_party_size = updates.showPartySize;
      if (updates.compactMode !== undefined) dbUpdates.compact_mode = updates.compactMode;
      if (updates.darkMode !== undefined) dbUpdates.dark_mode = updates.darkMode;
      if (updates.timerGreenMinutes !== undefined) dbUpdates.timer_green_minutes = updates.timerGreenMinutes;
      if (updates.timerYellowMinutes !== undefined) dbUpdates.timer_yellow_minutes = updates.timerYellowMinutes;
      if (updates.delayAlertEnabled !== undefined) dbUpdates.delay_alert_enabled = updates.delayAlertEnabled;
      if (updates.delayAlertMinutes !== undefined) dbUpdates.delay_alert_minutes = updates.delayAlertMinutes;
      if (updates.notesBlinkAllStations !== undefined) dbUpdates.notes_blink_all_stations = updates.notesBlinkAllStations;
      if (updates.showWaiterName !== undefined) dbUpdates.show_waiter_name = updates.showWaiterName;
      if (updates.borderBadgeColor !== undefined) dbUpdates.border_badge_color = updates.borderBadgeColor;
      if (updates.columnNamePending !== undefined) dbUpdates.column_name_pending = updates.columnNamePending;
      if (updates.columnNamePreparing !== undefined) dbUpdates.column_name_preparing = updates.columnNamePreparing;
      if (updates.columnNameReady !== undefined) dbUpdates.column_name_ready = updates.columnNameReady;
      if (updates.columnNameDelivered !== undefined) dbUpdates.column_name_delivered = updates.columnNameDelivered;
      if (updates.notesBadgeColor !== undefined) dbUpdates.notes_badge_color = updates.notesBadgeColor;
      if (updates.hideFlavorCategoryKds !== undefined) dbUpdates.hide_flavor_category_kds = updates.hideFlavorCategoryKds;
      if (updates.dispatchKeywords !== undefined) dbUpdates.dispatch_keywords = updates.dispatchKeywords;

      // Check if record exists for this tenant
      if (dbSettings?.id) {
        // Update existing record
        const { error } = await supabase
          .from('kds_global_settings')
          .update(dbUpdates)
          .eq('id', dbSettings.id);

        if (error) throw error;
      } else {
        // Insert new record for this tenant with all default values
        const bottleneckData = updates.bottleneckSettings ?? defaultGlobalSettings.bottleneckSettings;
        const insertData = {
          tenant_id: tenantId,
          operation_mode: updates.operationMode ?? defaultGlobalSettings.operationMode,
          order_management_view_mode: updates.orderManagementViewMode ?? defaultGlobalSettings.orderManagementViewMode,
          routing_mode: updates.routingMode ?? defaultGlobalSettings.routingMode,
          kanban_visible_columns: updates.kanbanVisibleColumns ?? defaultGlobalSettings.kanbanVisibleColumns,
          sla_green_minutes: updates.slaGreenMinutes ?? defaultGlobalSettings.slaGreenMinutes,
          sla_yellow_minutes: updates.slaYellowMinutes ?? defaultGlobalSettings.slaYellowMinutes,
          show_pending_column: updates.showPendingColumn ?? defaultGlobalSettings.showPendingColumn,
          cancellation_alert_interval: updates.cancellationAlertInterval ?? defaultGlobalSettings.cancellationAlertInterval,
          cancellation_alerts_enabled: updates.cancellationAlertsEnabled ?? defaultGlobalSettings.cancellationAlertsEnabled,
          auto_print_cancellations: updates.autoPrintCancellations ?? defaultGlobalSettings.autoPrintCancellations,
          highlight_special_borders: updates.highlightSpecialBorders ?? defaultGlobalSettings.highlightSpecialBorders,
          border_keywords: updates.borderKeywords ?? defaultGlobalSettings.borderKeywords,
          bottleneck_settings: JSON.parse(JSON.stringify(bottleneckData)),
          show_party_size: updates.showPartySize ?? defaultGlobalSettings.showPartySize,
          compact_mode: updates.compactMode ?? defaultGlobalSettings.compactMode,
          dark_mode: updates.darkMode ?? defaultGlobalSettings.darkMode,
          timer_green_minutes: updates.timerGreenMinutes ?? defaultGlobalSettings.timerGreenMinutes,
          timer_yellow_minutes: updates.timerYellowMinutes ?? defaultGlobalSettings.timerYellowMinutes,
          delay_alert_enabled: updates.delayAlertEnabled ?? defaultGlobalSettings.delayAlertEnabled,
          delay_alert_minutes: updates.delayAlertMinutes ?? defaultGlobalSettings.delayAlertMinutes,
          notes_blink_all_stations: updates.notesBlinkAllStations ?? defaultGlobalSettings.notesBlinkAllStations,
          show_waiter_name: updates.showWaiterName ?? defaultGlobalSettings.showWaiterName,
          border_badge_color: updates.borderBadgeColor ?? defaultGlobalSettings.borderBadgeColor,
          column_name_pending: updates.columnNamePending ?? defaultGlobalSettings.columnNamePending,
          column_name_preparing: updates.columnNamePreparing ?? defaultGlobalSettings.columnNamePreparing,
          column_name_ready: updates.columnNameReady ?? defaultGlobalSettings.columnNameReady,
          column_name_delivered: updates.columnNameDelivered ?? defaultGlobalSettings.columnNameDelivered,
          notes_badge_color: updates.notesBadgeColor ?? defaultGlobalSettings.notesBadgeColor,
          hide_flavor_category_kds: updates.hideFlavorCategoryKds ?? defaultGlobalSettings.hideFlavorCategoryKds,
        };

        const { error } = await supabase
          .from('kds_global_settings')
          .insert([insertData]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-global-settings', tenantId] });
    },
  });

  // Update global settings (synced to database)
  const updateSettings = useCallback((updates: Partial<KdsSettings>) => {
    // Separate device-specific from global settings
    const deviceUpdates: Partial<KdsDeviceSettings> = {};
    const globalUpdates: Partial<KdsGlobalSettings> = {};

    if (updates.deviceName !== undefined) deviceUpdates.deviceName = updates.deviceName;
    if (updates.assignedStationId !== undefined) deviceUpdates.assignedStationId = updates.assignedStationId;

    if (updates.operationMode !== undefined) globalUpdates.operationMode = updates.operationMode;
    if (updates.orderManagementViewMode !== undefined) globalUpdates.orderManagementViewMode = updates.orderManagementViewMode;
    if (updates.routingMode !== undefined) globalUpdates.routingMode = updates.routingMode;
    if (updates.kanbanVisibleColumns !== undefined) globalUpdates.kanbanVisibleColumns = updates.kanbanVisibleColumns;
    if (updates.slaGreenMinutes !== undefined) globalUpdates.slaGreenMinutes = updates.slaGreenMinutes;
    if (updates.slaYellowMinutes !== undefined) globalUpdates.slaYellowMinutes = updates.slaYellowMinutes;
    if (updates.showPendingColumn !== undefined) globalUpdates.showPendingColumn = updates.showPendingColumn;
    if (updates.cancellationAlertInterval !== undefined) globalUpdates.cancellationAlertInterval = updates.cancellationAlertInterval;
    if (updates.cancellationAlertsEnabled !== undefined) globalUpdates.cancellationAlertsEnabled = updates.cancellationAlertsEnabled;
    if (updates.autoPrintCancellations !== undefined) globalUpdates.autoPrintCancellations = updates.autoPrintCancellations;
    if (updates.highlightSpecialBorders !== undefined) globalUpdates.highlightSpecialBorders = updates.highlightSpecialBorders;
    if (updates.borderKeywords !== undefined) globalUpdates.borderKeywords = updates.borderKeywords;
    if (updates.bottleneckSettings !== undefined) globalUpdates.bottleneckSettings = updates.bottleneckSettings;
    if (updates.showPartySize !== undefined) globalUpdates.showPartySize = updates.showPartySize;
    if (updates.compactMode !== undefined) globalUpdates.compactMode = updates.compactMode;
    if (updates.darkMode !== undefined) globalUpdates.darkMode = updates.darkMode;
    if (updates.timerGreenMinutes !== undefined) globalUpdates.timerGreenMinutes = updates.timerGreenMinutes;
    if (updates.timerYellowMinutes !== undefined) globalUpdates.timerYellowMinutes = updates.timerYellowMinutes;
    if (updates.delayAlertEnabled !== undefined) globalUpdates.delayAlertEnabled = updates.delayAlertEnabled;
    if (updates.delayAlertMinutes !== undefined) globalUpdates.delayAlertMinutes = updates.delayAlertMinutes;
    if (updates.notesBlinkAllStations !== undefined) globalUpdates.notesBlinkAllStations = updates.notesBlinkAllStations;
    if (updates.showWaiterName !== undefined) globalUpdates.showWaiterName = updates.showWaiterName;
    if (updates.borderBadgeColor !== undefined) globalUpdates.borderBadgeColor = updates.borderBadgeColor;
    if (updates.columnNamePending !== undefined) globalUpdates.columnNamePending = updates.columnNamePending;
    if (updates.columnNamePreparing !== undefined) globalUpdates.columnNamePreparing = updates.columnNamePreparing;
    if (updates.columnNameReady !== undefined) globalUpdates.columnNameReady = updates.columnNameReady;
    if (updates.columnNameDelivered !== undefined) globalUpdates.columnNameDelivered = updates.columnNameDelivered;
    if (updates.notesBadgeColor !== undefined) globalUpdates.notesBadgeColor = updates.notesBadgeColor;
    if (updates.hideFlavorCategoryKds !== undefined) globalUpdates.hideFlavorCategoryKds = updates.hideFlavorCategoryKds;

    // Update device settings locally
    if (Object.keys(deviceUpdates).length > 0) {
      setDeviceSettings(prev => {
        const newSettings = { ...prev, ...deviceUpdates };
        saveDeviceSettings(newSettings);
        return newSettings;
      });
    }

    // Update global settings in database
    if (Object.keys(globalUpdates).length > 0) {
      updateGlobalMutation.mutate(globalUpdates);
    }
  }, [updateGlobalMutation]);

  // Update device-specific settings only
  const updateDeviceSettings = useCallback((updates: Partial<KdsDeviceSettings>) => {
    setDeviceSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveDeviceSettings(newSettings);
      return newSettings;
    });
  }, []);

  // Update bottleneck settings
  const updateBottleneckSettings = useCallback((updates: Partial<BottleneckSettings>) => {
    const newBottleneckSettings = { ...globalSettings.bottleneckSettings, ...updates };
    updateGlobalMutation.mutate({ bottleneckSettings: newBottleneckSettings });
  }, [globalSettings.bottleneckSettings, updateGlobalMutation]);

  // Update station override
  const updateStationOverride = useCallback((stationId: string, override: BottleneckStationOverride | null) => {
    const newOverrides = { ...globalSettings.bottleneckSettings.stationOverrides };
    if (override === null) {
      delete newOverrides[stationId];
    } else {
      newOverrides[stationId] = { ...newOverrides[stationId], ...override };
    }
    
    updateBottleneckSettings({ stationOverrides: newOverrides });
  }, [globalSettings.bottleneckSettings.stationOverrides, updateBottleneckSettings]);

  // Set up realtime subscription for global settings changes
  useEffect(() => {
    if (!tenantId) return;
    
    const channel = supabase
      .channel('kds-global-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kds_global_settings',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['kds-global-settings', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId]);

  // Helper to get initial order status based on settings
  const getInitialOrderStatus = useCallback((): 'pending' | 'preparing' => {
    return settings.showPendingColumn ? 'pending' : 'preparing';
  }, [settings.showPendingColumn]);

  // Helper to calculate SLA color based on time
  const getSlaColor = useCallback((minutesElapsed: number): 'green' | 'yellow' | 'red' => {
    if (minutesElapsed <= settings.slaGreenMinutes) return 'green';
    if (minutesElapsed <= settings.slaYellowMinutes) return 'yellow';
    return 'red';
  }, [settings.slaGreenMinutes, settings.slaYellowMinutes]);

  // Helper to check if text contains special border
  const hasSpecialBorder = useCallback((text: string): boolean => {
    if (!settings.highlightSpecialBorders || !text) return false;
    const lowerText = text.toLowerCase();
    return settings.borderKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }, [settings.highlightSpecialBorders, settings.borderKeywords]);

  // Helper to get station thresholds (with override or default)
  const getStationThresholds = useCallback((stationId: string) => {
    const override = settings.bottleneckSettings.stationOverrides[stationId];
    return {
      maxQueueSize: override?.maxQueueSize ?? settings.bottleneckSettings.defaultMaxQueueSize,
      maxTimeRatio: override?.maxTimeRatio ?? settings.bottleneckSettings.defaultMaxTimeRatio,
      alertsEnabled: override?.alertsEnabled ?? true,
    };
  }, [settings.bottleneckSettings]);

  // Check if in production line mode
  const isProductionLineMode = settings.operationMode === 'production_line';

  return {
    settings,
    isLoading,
    updateSettings,
    updateDeviceSettings,
    updateBottleneckSettings,
    updateStationOverride,
    getInitialOrderStatus,
    getSlaColor,
    hasSpecialBorder,
    getStationThresholds,
    isProductionLineMode,
  };
}
