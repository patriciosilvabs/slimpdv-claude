import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KdsDeviceLogin, getStoredDeviceAuth, clearDeviceAuth } from '@/components/kds/KdsDeviceLogin';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrders, useOrderMutations, Order } from '@/hooks/useOrders';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, UtensilsCrossed, Store, Truck, Clock, Play, CheckCircle, ChefHat, Volume2, VolumeX, Maximize2, Minimize2, Filter, Timer, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Ban, History, Trash2, CalendarDays, LogOut, Layers, Circle, Check } from 'lucide-react';
import logoSlim from '@/assets/logo-slim.png';
import { APP_VERSION } from '@/lib/appVersion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { useKdsSettings, type KdsGlobalSettings, type KdsOperationMode, type OrderManagementViewMode, type KanbanColumn, type BottleneckSettings } from '@/hooks/useKdsSettings';
import { useKdsStations } from '@/hooks/useKdsStations';
import { useScheduledAnnouncements } from '@/hooks/useScheduledAnnouncements';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { KdsSlaIndicator } from '@/components/kds/KdsSlaIndicator';
import { KdsItemCounter } from '@/components/kds/KdsItemCounter';
import { KdsBorderBadge } from '@/components/kds/KdsBorderHighlight';
import { KdsItemBadges, getFlavorsFromExtras } from '@/components/kds/KdsItemBadges';
import { KdsProductionLineView } from '@/components/kds/KdsProductionLineView';
import { KdsMetricsDashboard } from '@/components/kds/KdsMetricsDashboard';
import { KdsBottleneckIndicator } from '@/components/kds/KdsBottleneckIndicator';
import { useBottleneckAlerts } from '@/hooks/useBottleneckAlerts';
import { useItemDelayAlert } from '@/hooks/useItemDelayAlert';
import { useKdsDeviceData } from '@/hooks/useKdsDeviceData';

type OrderTypeFilter = 'all' | 'table' | 'takeaway' | 'delivery';

interface MetricDataPoint {
  time: string;
  avgWait: number;
}

interface CancellationHistoryItem {
  orderId: string;
  orderNumber: string;
  reason: string;
  cancelledAt: Date;
  confirmedAt: Date;
  items: Array<{ name: string; quantity: number; variation?: string }>;
  origin: string;
  customerName?: string;
}

interface ItemCancellationAlert {
  itemId: string;
  orderId: string;
  productName: string;
  variationName?: string | null;
  quantity: number;
  reason: string;
  cancelledAt: Date;
  origin: string;
}

const FILTER_STORAGE_KEY = 'kds-order-type-filter';
const CANCELLATION_HISTORY_KEY = 'kds-cancellation-history';
const UNCONFIRMED_CANCELLATIONS_KEY = 'kds-unconfirmed-cancellations';
const CONFIRMED_CANCELLATIONS_KEY = 'kds-confirmed-cancellations';
const UNCONFIRMED_ITEM_CANCELLATIONS_KEY = 'kds-unconfirmed-item-cancellations';
const MAX_WAIT_ALERT_THRESHOLD = 25; // minutes
const MAX_WAIT_ALERT_COOLDOWN = 300000; // 5 minutes in ms
const RECENT_CANCELLATION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

type HistoryPeriodFilter = 'today' | '7days' | '30days' | 'all';

// Format time display in hours after 60 minutes
const formatTimeDisplay = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return `${minutes} min`;
};

export default function KDS() {
  // Device authentication state
  const [deviceAuth, setDeviceAuth] = useState(() => getStoredDeviceAuth());
  const { user } = useAuth();
  
  // Determine if we're in device-only mode (no user session)
  const isDeviceOnlyMode = !!deviceAuth?.tenantId && !!deviceAuth?.deviceId && !user;
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { isAdmin } = useUserRole();
  const isManager = isDeviceOnlyMode ? false : isAdmin; // Device-only mode = not a manager
  
  // Regular data hooks (will return empty when no user session due to RLS)
  const { data: userOrders = [], isLoading: userOrdersLoading, refetch: userRefetch } = useOrders(['pending', 'preparing', 'ready', 'delivered', 'cancelled']);
  const { updateOrder, updateOrderItem } = useOrderMutations();
  
  // Device-only data hook (fetches via edge function, bypassing RLS)
  const deviceData = useKdsDeviceData(isDeviceOnlyMode ? deviceAuth : null);
  
  // Use device data when in device-only mode, otherwise use regular hooks
  const orders = isDeviceOnlyMode ? deviceData.orders : userOrders;
  const isLoading = isDeviceOnlyMode ? deviceData.isLoading : userOrdersLoading;
  const refetch = isDeviceOnlyMode ? deviceData.refetch : userRefetch;
  
  const queryClient = useQueryClient();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [metricsHistory, setMetricsHistory] = useState<MetricDataPoint[]>([]);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [maxWaitAlertCooldown, setMaxWaitAlertCooldown] = useState(false);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>(() => {
    try {
      return (localStorage.getItem(FILTER_STORAGE_KEY) as OrderTypeFilter) || 'all';
    } catch {
      return 'all';
    }
  });
  const { playKdsNewOrderSound, playMaxWaitAlertSound, playOrderCancelledSound, playStationChangeSound, settings } = useAudioNotification();
  const { settings: kdsSettingsFromHook, hasSpecialBorder, updateSettings: updateKdsSettings, updateDeviceSettings } = useKdsSettings(deviceAuth?.tenantId);
  const { activeStations: userActiveStations, productionStations: userProductionStations } = useKdsStations();
  
  // Override settings and stations from device data when in device-only mode
  const kdsSettings = useMemo(() => {
    if (!isDeviceOnlyMode || !deviceData.settings) return kdsSettingsFromHook;
    
    const dbSettings = deviceData.settings;
    return {
      ...kdsSettingsFromHook,
      operationMode: (dbSettings.operation_mode || 'traditional') as KdsOperationMode,
      orderManagementViewMode: (dbSettings.order_management_view_mode || 'follow_kds') as OrderManagementViewMode,
      kanbanVisibleColumns: (dbSettings.kanban_visible_columns || ['pending', 'preparing', 'ready', 'delivered_today']) as KanbanColumn[],
      slaGreenMinutes: dbSettings.sla_green_minutes ?? 8,
      slaYellowMinutes: dbSettings.sla_yellow_minutes ?? 12,
      showPendingColumn: dbSettings.show_pending_column ?? true,
      cancellationAlertInterval: dbSettings.cancellation_alert_interval ?? 3,
      cancellationAlertsEnabled: dbSettings.cancellation_alerts_enabled ?? true,
      autoPrintCancellations: dbSettings.auto_print_cancellations ?? true,
      highlightSpecialBorders: dbSettings.highlight_special_borders ?? true,
      borderKeywords: dbSettings.border_keywords || [],
      showPartySize: dbSettings.show_party_size ?? true,
      compactMode: dbSettings.compact_mode ?? false,
      timerGreenMinutes: dbSettings.timer_green_minutes ?? 5,
      timerYellowMinutes: dbSettings.timer_yellow_minutes ?? 10,
      delayAlertEnabled: dbSettings.delay_alert_enabled ?? true,
      delayAlertMinutes: dbSettings.delay_alert_minutes ?? 10,
      notesBlinkAllStations: dbSettings.notes_blink_all_stations ?? false,
      showWaiterName: dbSettings.show_waiter_name ?? true,
      borderBadgeColor: dbSettings.border_badge_color || 'amber',
      notesBadgeColor: dbSettings.notes_badge_color || 'orange',
      columnNamePending: dbSettings.column_name_pending || 'PENDENTE',
      columnNamePreparing: dbSettings.column_name_preparing || 'EM PREPARO',
      columnNameReady: dbSettings.column_name_ready || 'PRONTO',
      columnNameDelivered: dbSettings.column_name_delivered || 'ENTREGUES HOJE',
    };
  }, [isDeviceOnlyMode, deviceData.settings, kdsSettingsFromHook]);
  
  const activeStations = isDeviceOnlyMode && deviceData.stations.length > 0
    ? deviceData.stations.filter((s: any) => s.is_active)
    : userActiveStations;
  const productionStations = isDeviceOnlyMode && deviceData.stations.length > 0
    ? deviceData.stations.filter((s: any) => s.is_active && s.station_type !== 'order_status')
    : userProductionStations;
  
  // Bottleneck alerts for production line mode
  const isProductionLineMode = kdsSettings.operationMode === 'production_line';
  const { bottlenecks, hasActiveAlerts } = useBottleneckAlerts(isProductionLineMode, soundEnabled);
  
  // Item delay alert (plays sound when items exceed time threshold)
  useItemDelayAlert();
  
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  const previousOrdersRef = useRef<Order[]>([]);
  const initialLoadRef = useRef(true);
  const previousStationItemsRef = useRef<Set<string>>(new Set());
  const stationItemsInitializedRef = useRef(false);
  
  // Unconfirmed cancellations tracking - persists until kitchen confirms (loaded from localStorage)
  const [unconfirmedCancellations, setUnconfirmedCancellations] = useState<Map<string, Order>>(() => {
    try {
      const stored = localStorage.getItem(UNCONFIRMED_CANCELLATIONS_KEY);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        // We'll populate the Map after orders load in an effect
        // For now, just store the IDs as a marker
        return new Map(ids.map(id => [id, null as any]));
      }
    } catch (e) {
      console.error('Error loading unconfirmed cancellations:', e);
    }
    return new Map();
  });
  const cancelledSoundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Cancellation history - persisted in localStorage
  const [cancellationHistory, setCancellationHistory] = useState<CancellationHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(CANCELLATION_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        return parsed.map((item: any) => ({
          ...item,
          cancelledAt: new Date(item.cancelledAt),
          confirmedAt: new Date(item.confirmedAt),
        }));
      }
    } catch (e) {
      console.error('Error loading cancellation history:', e);
    }
    return [];
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<HistoryPeriodFilter>('today');
  
  // Unconfirmed item cancellations tracking
  const [unconfirmedItemCancellations, setUnconfirmedItemCancellations] = useState<Map<string, ItemCancellationAlert>>(() => {
    try {
      const stored = localStorage.getItem(UNCONFIRMED_ITEM_CANCELLATIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(parsed.map((item: any) => [item.itemId, { ...item, cancelledAt: new Date(item.cancelledAt) }]));
      }
    } catch (e) {
      console.error('Error loading unconfirmed item cancellations:', e);
    }
    return new Map();
  });
  const itemCancelledSoundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const canChangeStatus = hasPermission('kds_change_status');
  const lastMetricUpdateRef = useRef<string>('');

  // Calculate order counts for condition-based announcements (needed for hook below)
  const getWaitTimeMinutes = (createdAt: string | null): number => {
    if (!createdAt) return 0;
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  // List for display (includes ready) - only orders with items and not drafts
  const activeOrdersList = orders.filter(o => 
    (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready') &&
    (o.order_items?.length ?? 0) > 0 &&
    o.is_draft !== true
  );
  
  // List for alerts (ONLY pending and preparing - ready orders should not trigger alerts)
  const ordersForAlerts = orders.filter(o => 
    (o.status === 'pending' || o.status === 'preparing') &&
    (o.order_items?.length ?? 0) > 0 &&
    o.is_draft !== true
  );
  
  // Use updated_at for wait time calculation - this resets when new items are added to a ready order
  const waitTimesForAlerts = ordersForAlerts.map(o => getWaitTimeMinutes(o.updated_at || o.created_at));
  const defaultDelayThreshold = 20; // Default minutes to consider order as delayed

  const orderCounts = {
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    total: activeOrdersList.length,
    avgWaitTimeMinutes: waitTimesForAlerts.length > 0 
      ? Math.round(waitTimesForAlerts.reduce((a, b) => a + b, 0) / waitTimesForAlerts.length) 
      : 0,
    maxWaitTimeMinutes: waitTimesForAlerts.length > 0 
      ? Math.max(...waitTimesForAlerts) 
      : 0,
    delayedOrdersCount: waitTimesForAlerts.filter(t => t > defaultDelayThreshold).length
  };

  // Listen for scheduled announcements - MUST be called before any conditional returns
  useScheduledAnnouncements('kds', orderCounts);
  // Helper function to get color status based on metric thresholds
  const getMetricStatus = (type: 'avg' | 'max' | 'delayed', value: number) => {
    if (type === 'avg') {
      if (value < 10) return { color: 'text-green-500', bg: 'bg-green-500/10', status: 'ok' as const };
      if (value < 20) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', status: 'warning' as const };
      return { color: 'text-red-500', bg: 'bg-red-500/10', status: 'critical' as const };
    }
    if (type === 'max') {
      if (value < 15) return { color: 'text-green-500', bg: 'bg-green-500/10', status: 'ok' as const };
      if (value < 25) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', status: 'warning' as const };
      return { color: 'text-red-500', bg: 'bg-red-500/10', status: 'critical' as const };
    }
    // delayed
    if (value === 0) return { color: 'text-green-500', bg: 'bg-green-500/10', status: 'ok' as const };
    if (value <= 3) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', status: 'warning' as const };
    return { color: 'text-red-500', bg: 'bg-red-500/10', status: 'critical' as const };
  };

  // Metrics Panel Component
  const MetricsPanel = () => {
    const avgStatus = getMetricStatus('avg', orderCounts.avgWaitTimeMinutes);
    const maxStatus = getMetricStatus('max', orderCounts.maxWaitTimeMinutes);
    const delayedStatus = getMetricStatus('delayed', orderCounts.delayedOrdersCount);

    if (activeOrdersList.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
        {/* Tempo Médio */}
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded", avgStatus.bg)}>
          <Clock className={cn("h-4 w-4", avgStatus.color)} />
          <span className="text-xs text-muted-foreground">Média:</span>
          <span className={cn("font-bold text-sm", avgStatus.color)}>
            {formatTimeDisplay(orderCounts.avgWaitTimeMinutes)}
          </span>
        </div>
        
        {/* Pedido Mais Antigo */}
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded", maxStatus.bg)}>
          <Timer className={cn("h-4 w-4", maxStatus.color)} />
          <span className="text-xs text-muted-foreground">Máx:</span>
          <span className={cn("font-bold text-sm", maxStatus.color)}>
            {formatTimeDisplay(orderCounts.maxWaitTimeMinutes)}
          </span>
        </div>
        
        {/* Pedidos Atrasados */}
        {orderCounts.delayedOrdersCount > 0 && (
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded",
            delayedStatus.bg,
            delayedStatus.status === 'critical' && "animate-pulse"
          )}>
            <AlertTriangle className={cn("h-4 w-4", delayedStatus.color)} />
            <span className={cn("font-bold text-sm", delayedStatus.color)}>
              {orderCounts.delayedOrdersCount} atrasado{orderCounts.delayedOrdersCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Metrics Chart Component
  const MetricsChart = () => {
    if (metricsHistory.length < 2) {
      return (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          Aguardando dados... (mínimo 2 minutos)
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={metricsHistory}>
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10 }} 
            interval="preserveStartEnd"
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis 
            tick={{ fontSize: 10 }} 
            width={30}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number) => [`${value} min`, 'Tempo Médio']}
          />
          <Line 
            type="monotone" 
            dataKey="avgWait" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // Save filter preference
  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, orderTypeFilter);
  }, [orderTypeFilter]);

  // Filter active orders (pending, preparing, ready) - only orders with items and not drafts
  const activeOrders = useMemo(() => orders.filter(order => {
    const isActive = order.status === 'pending' || order.status === 'preparing' || order.status === 'ready';
    if (!isActive) return false;
    if (order.is_draft === true) return false;
    if ((order.order_items?.length ?? 0) === 0) return false;

    if (orderTypeFilter === 'all') return true;
    if (orderTypeFilter === 'table') return order.order_type === 'dine_in';
    if (orderTypeFilter === 'takeaway') return order.order_type === 'takeaway';
    if (orderTypeFilter === 'delivery') return order.order_type === 'delivery';
    return true;
  }), [orders, orderTypeFilter]);

  // Count by type (unfiltered) - only orders with items and not drafts
  const allActiveOrders = orders.filter(
    order => (order.status === 'pending' || order.status === 'preparing' || order.status === 'ready') &&
             (order.order_items?.length ?? 0) > 0 &&
             order.is_draft !== true
  );
  const tableCount = allActiveOrders.filter(o => o.order_type === 'dine_in').length;
  const takeawayCount = allActiveOrders.filter(o => o.order_type === 'takeaway').length;
  const deliveryCount = allActiveOrders.filter(o => o.order_type === 'delivery').length;

  // Filter orders by assigned station (if set)
  const ordersForDisplay = useMemo(() => {
    if (!kdsSettings.assignedStationId) {
      return activeOrders; // Show all if no station assigned
    }
    
    // Filter orders that have items in this station
    return activeOrders.filter(order => 
      order.order_items?.some(item => 
        item.current_station_id === kdsSettings.assignedStationId
      )
    ).map(order => ({
      ...order,
      // Also filter items within each order to show only those for this station
      order_items: order.order_items?.filter(item => 
        item.current_station_id === kdsSettings.assignedStationId
      )
    }));
  }, [activeOrders, kdsSettings.assignedStationId]);

  const pendingOrders = ordersForDisplay.filter(o => o.status === 'pending');
  // When showPendingColumn is false, merge pending into preparing
  const preparingOrders = kdsSettings.showPendingColumn 
    ? ordersForDisplay.filter(o => o.status === 'preparing')
    : ordersForDisplay.filter(o => o.status === 'pending' || o.status === 'preparing');
  const readyOrders = ordersForDisplay.filter(o => o.status === 'ready');

  // Real-time clock and metrics update
  useEffect(() => {
    // Update every second for clock display in fullscreen
    const clockTimer = isFullscreen ? setInterval(() => {
      setCurrentTime(new Date());
    }, 1000) : null;
    
    // Update every minute for metrics recalculation (even when not fullscreen)
    const metricsTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => {
      if (clockTimer) clearInterval(clockTimer);
      clearInterval(metricsTimer);
    };
  }, [isFullscreen]);

  // Update metrics history every minute
  useEffect(() => {
    const timeKey = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Only add a new point if the minute changed
    if (timeKey !== lastMetricUpdateRef.current) {
      lastMetricUpdateRef.current = timeKey;
      
      setMetricsHistory(prev => {
        const newPoint: MetricDataPoint = {
          time: timeKey,
          avgWait: orderCounts.avgWaitTimeMinutes
        };
        const updated = [...prev, newPoint];
        // Keep only last 120 minutes (2 hours)
        return updated.slice(-120);
      });
    }
  }, [currentTime, orderCounts.avgWaitTimeMinutes]);

  // Max wait alert sound
  useEffect(() => {
    if (
      orderCounts.maxWaitTimeMinutes > MAX_WAIT_ALERT_THRESHOLD && 
      !maxWaitAlertCooldown && 
      soundEnabled && 
      settings.enabled &&
      ordersForAlerts.length > 0
    ) {
      playMaxWaitAlertSound();
      toast.warning(`⚠️ Pedido esperando há mais de ${MAX_WAIT_ALERT_THRESHOLD} minutos!`, { duration: 5000 });
      setMaxWaitAlertCooldown(true);
      setTimeout(() => setMaxWaitAlertCooldown(false), MAX_WAIT_ALERT_COOLDOWN);
    }
  }, [orderCounts.maxWaitTimeMinutes, maxWaitAlertCooldown, soundEnabled, settings.enabled, activeOrdersList.length, playMaxWaitAlertSound]);

  // Sound notification when new items arrive at assigned station
  useEffect(() => {
    if (!kdsSettings.assignedStationId || !soundEnabled || !settings.enabled) return;
    
    // Collect IDs of all items currently in the assigned station
    const currentItemIds = new Set(
      activeOrders.flatMap(order => 
        order.order_items?.filter(item => 
          item.current_station_id === kdsSettings.assignedStationId
        ).map(item => item.id) ?? []
      )
    );
    
    // Check for new items
    let hasNewItems = false;
    currentItemIds.forEach(id => {
      if (!previousStationItemsRef.current.has(id)) {
        hasNewItems = true;
      }
    });
    
    // Play sound only if there are new items and it's not the initial load
    if (hasNewItems && stationItemsInitializedRef.current) {
      playStationChangeSound();
      const stationName = activeStations.find(s => s.id === kdsSettings.assignedStationId)?.name;
      toast.info(`Novo item chegou em ${stationName}!`, { duration: 3000 });
    }
    
    // Mark as initialized and update reference
    stationItemsInitializedRef.current = true;
    previousStationItemsRef.current = currentItemIds;
  }, [activeOrders, kdsSettings.assignedStationId, soundEnabled, settings.enabled, playStationChangeSound, activeStations]);

  // Realtime subscription is now handled in useOrders.ts - removed duplicate here

  // Sound notification for new orders + visual sync notifications + cancellation alerts
  useEffect(() => {
    // Detect status changes from other screens
    if (previousOrdersRef.current.length > 0) {
      orders.forEach(order => {
        const prevOrder = previousOrdersRef.current.find(o => o.id === order.id);
        if (prevOrder && prevOrder.status !== order.status) {
          const statusLabels: Record<string, string> = {
            pending: 'Novo',
            preparing: 'Em Preparo',
            ready: 'Pronto',
            delivered: 'Entregue',
            cancelled: 'Cancelado'
          };
          
          // Check for cancellation - only notify if order was still in production
          // Orders that were ready/delivered don't need to alert the kitchen anymore
          if (order.status === 'cancelled' && prevOrder.status !== 'cancelled') {
            const wasInProduction = prevOrder.status === 'pending' || prevOrder.status === 'preparing';
            const hasItems = (order.order_items?.length ?? 0) > 0;
            
            // Only show cancellation alerts if enabled in settings AND order had items
            // Skip empty orders (waiter opened table but customer left before ordering)
            if (wasInProduction && hasItems && kdsSettings.cancellationAlertsEnabled !== false) {
              // Add to unconfirmed cancellations map - will persist until confirmed
              setUnconfirmedCancellations(prev => {
                const newMap = new Map(prev);
                newMap.set(order.id, order);
                return newMap;
              });
              
              // Persistent toast until confirmed
              toast.error(`🚫 PEDIDO #${order.id.slice(-4).toUpperCase()} CANCELADO!`, { 
                description: (order as any).cancellation_reason || 'Confirme que viu este cancelamento',
                duration: Infinity,
                id: `cancel-${order.id}`,
              });
            }
          } else if (!notifiedOrdersRef.current.has(`${order.id}-${order.status}`)) {
            // Only notify for non-cancellation status changes we didn't trigger
            toast.info(`Pedido #${order.id.slice(-4).toUpperCase()} → ${statusLabels[order.status] || order.status}`);
          }
        }
      });
    }

    // Sound + visual for new orders (pending or preparing depending on settings)
    // Exclude drafts - they're not real orders yet
    const targetStatus = kdsSettings.showPendingColumn ? 'pending' : 'preparing';
    const newOrders = orders.filter(
      o => o.status === targetStatus && !o.is_draft && !notifiedOrdersRef.current.has(o.id)
    );

    if (newOrders.length > 0) {
      if (soundEnabled && settings.enabled) {
        playKdsNewOrderSound();
      }
      toast.success(`🔔 ${newOrders.length} novo(s) pedido(s)!`, { duration: 4000 });
      newOrders.forEach(o => notifiedOrdersRef.current.add(o.id));
    }

    previousOrdersRef.current = [...orders];
    
    // Clean up notifiedOrdersRef: remove IDs of orders that no longer exist
    const currentOrderIds = new Set(orders.map(o => o.id));
    notifiedOrdersRef.current.forEach(id => {
      // Remove both simple ID and status-prefixed IDs for orders that don't exist anymore
      const baseId = id.includes('-') ? id.split('-')[0] : id;
      if (!currentOrderIds.has(baseId) && !currentOrderIds.has(id)) {
        notifiedOrdersRef.current.delete(id);
      }
    });
  }, [orders, soundEnabled, settings.enabled, playKdsNewOrderSound, kdsSettings.showPendingColumn, kdsSettings.cancellationAlertsEnabled]);

  // Detect recent cancellations on initial load and restore unconfirmed ones
  useEffect(() => {
    if (!orders.length || !initialLoadRef.current) return;
    initialLoadRef.current = false;
    
    // Get stored unconfirmed IDs (if any)
    let storedUnconfirmedIds: string[] = [];
    try {
      const stored = localStorage.getItem(UNCONFIRMED_CANCELLATIONS_KEY);
      if (stored) {
        storedUnconfirmedIds = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading stored unconfirmed cancellations:', e);
    }
    
    // Get already confirmed IDs to exclude them
    let confirmedIds: string[] = [];
    try {
      const stored = localStorage.getItem(CONFIRMED_CANCELLATIONS_KEY);
      if (stored) {
        confirmedIds = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading confirmed cancellations:', e);
    }
    
    // Find recently cancelled orders (within 30 minutes) OR orders from localStorage
    const now = Date.now();
    const recentCancellations = orders.filter(o => {
      if (o.status !== 'cancelled') return false;
      
      // IMPORTANT: Skip orders that were already confirmed by the user
      if (confirmedIds.includes(o.id)) return false;
      
      // Skip empty orders (waiter opened table but customer left before ordering)
      if ((o.order_items?.length ?? 0) === 0) return false;
      
      // Check if it was in production when cancelled (pending/preparing)
      // If status_before_cancellation is set, use it; otherwise include for backwards compatibility
      const statusBefore = o.status_before_cancellation;
      if (statusBefore && statusBefore !== 'pending' && statusBefore !== 'preparing') {
        // Order was already ready/delivered when cancelled - kitchen doesn't need to know
        return false;
      }
      
      // Check if it's in the stored unconfirmed list
      if (storedUnconfirmedIds.includes(o.id)) return true;
      
      // Check if it was cancelled recently (within 30 min window)
      const cancelledAt = o.cancelled_at ? new Date(o.cancelled_at).getTime() : 
                          o.updated_at ? new Date(o.updated_at).getTime() : 0;
      const isRecent = (now - cancelledAt) < RECENT_CANCELLATION_WINDOW_MS;
      
      return isRecent;
    });
    
    if (recentCancellations.length > 0 && kdsSettings.cancellationAlertsEnabled !== false) {
      console.log('[KDS] Found unconfirmed cancellations on load:', recentCancellations.length);
      
      setUnconfirmedCancellations(prev => {
        const newMap = new Map(prev);
        recentCancellations.forEach(order => {
          if (!newMap.has(order.id) || !newMap.get(order.id)) {
            newMap.set(order.id, order);
            // Show toast for each
            toast.error(`🚫 PEDIDO #${order.id.slice(-4).toUpperCase()} CANCELADO!`, { 
              description: (order as any).cancellation_reason || 'Confirme que viu este cancelamento',
              duration: Infinity,
              id: `cancel-${order.id}`,
            });
          }
        });
        return newMap;
      });
    }
  }, [orders, kdsSettings.cancellationAlertsEnabled]);

  // Persist unconfirmed cancellations to localStorage
  useEffect(() => {
    const ids = Array.from(unconfirmedCancellations.keys()).filter(id => 
      unconfirmedCancellations.get(id) !== null
    );
    try {
      if (ids.length > 0) {
        localStorage.setItem(UNCONFIRMED_CANCELLATIONS_KEY, JSON.stringify(ids));
      } else {
        localStorage.removeItem(UNCONFIRMED_CANCELLATIONS_KEY);
      }
    } catch (e) {
      console.error('Error persisting unconfirmed cancellations:', e);
    }
  }, [unconfirmedCancellations]);

  // Persist unconfirmed item cancellations to localStorage
  useEffect(() => {
    try {
      if (unconfirmedItemCancellations.size > 0) {
        const items = Array.from(unconfirmedItemCancellations.values());
        localStorage.setItem(UNCONFIRMED_ITEM_CANCELLATIONS_KEY, JSON.stringify(items));
      } else {
        localStorage.removeItem(UNCONFIRMED_ITEM_CANCELLATIONS_KEY);
      }
    } catch (e) {
      console.error('Error persisting unconfirmed item cancellations:', e);
    }
  }, [unconfirmedItemCancellations]);

  // Realtime subscription for item cancellations
  useEffect(() => {
    if (kdsSettings.cancellationAlertsEnabled === false) return;
    
    const channel = supabase
      .channel('kds-item-cancellations')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'order_items',
      }, async (payload) => {
        const newData = payload.new as any;
        const oldData = payload.old as any;
        
        // Detectar cancelamento: cancelled_at mudou de null para um valor
        if (!oldData?.cancelled_at && newData?.cancelled_at) {
          console.log('[KDS] Item cancelado detectado:', newData.id);
          
          // Só alertar se o item ainda estava em produção (não já concluído/despachado)
          // Se station_status é 'done', o item já foi produzido - não faz sentido alertar
          if (newData.station_status === 'done') {
            console.log('[KDS] Item cancelado já estava concluído, ignorando alerta:', newData.id);
            return;
          }
          
          // Se o item está em uma estação order_status, já passou pela produção
          if (newData.current_station_id) {
            const { data: stationData } = await supabase
              .from('kds_stations')
              .select('station_type')
              .eq('id', newData.current_station_id)
              .single();
            
            if (stationData?.station_type === 'order_status') {
              console.log('[KDS] Item cancelado já estava no despacho, ignorando alerta:', newData.id);
              return;
            }
          }
          
          // Buscar dados completos do item cancelado
          const { data: itemData } = await supabase
            .from('order_items')
            .select(`
              id,
              order_id,
              quantity,
              cancellation_reason,
              product:products(name),
              variation:product_variations(name),
              order:orders(order_type, table_id, customer_name, table:tables(number))
            `)
            .eq('id', newData.id)
            .single();
          
          if (itemData) {
            const order = itemData.order as any;
            const origin = order?.order_type === 'delivery' 
              ? 'DELIVERY' 
              : order?.order_type === 'takeaway' 
                ? 'BALCÃO' 
                : `MESA ${order?.table?.number || '?'}`;
            
            const alert: ItemCancellationAlert = {
              itemId: newData.id,
              orderId: itemData.order_id,
              productName: (itemData.product as any)?.name || 'Produto',
              variationName: (itemData.variation as any)?.name,
              quantity: itemData.quantity,
              reason: itemData.cancellation_reason || 'Não informado',
              cancelledAt: new Date(newData.cancelled_at),
              origin
            };
            
            // Adicionar ao mapa de não confirmados
            setUnconfirmedItemCancellations(prev => {
              const newMap = new Map(prev);
              newMap.set(newData.id, alert);
              return newMap;
            });
            
            // Tocar som de alerta
            if (soundEnabled && settings.enabled) {
              playOrderCancelledSound();
            }
            
            // Toast persistente
            toast.error(`🚫 ITEM CANCELADO!`, { 
              description: `${alert.quantity}x ${alert.productName}${alert.variationName ? ` (${alert.variationName})` : ''} - ${alert.origin}`,
              duration: Infinity,
              id: `item-cancel-${newData.id}`,
            });
          }
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [kdsSettings.cancellationAlertsEnabled, soundEnabled, settings.enabled, playOrderCancelledSound]);

  // Sound loop for unconfirmed cancellations (orders + items)
  useEffect(() => {
    const totalUnconfirmed = unconfirmedCancellations.size + unconfirmedItemCancellations.size;
    
    // If there are unconfirmed cancellations, alerts are enabled, and sound is enabled
    if (
      kdsSettings.cancellationAlertsEnabled !== false &&
      totalUnconfirmed > 0 && 
      soundEnabled && 
      settings.enabled
    ) {
      // Play immediately
      playOrderCancelledSound();
      
      // Use configurable interval (convert seconds to ms)
      const intervalMs = (kdsSettings.cancellationAlertInterval || 3) * 1000;
      
      // Start loop
      cancelledSoundIntervalRef.current = setInterval(() => {
        const currentTotal = unconfirmedCancellations.size + unconfirmedItemCancellations.size;
        if (currentTotal > 0) {
          playOrderCancelledSound();
        }
      }, intervalMs);
    }
    
    // Cleanup: stop sound when no more unconfirmed cancellations
    return () => {
      if (cancelledSoundIntervalRef.current) {
        clearInterval(cancelledSoundIntervalRef.current);
        cancelledSoundIntervalRef.current = null;
      }
    };
  }, [unconfirmedCancellations.size, unconfirmedItemCancellations.size, soundEnabled, settings.enabled, playOrderCancelledSound, kdsSettings.cancellationAlertInterval, kdsSettings.cancellationAlertsEnabled]);

  // Device authentication check
  if (!deviceAuth) {
    return (
      <KdsDeviceLogin
        onLoginSuccess={() => {
          const stored = getStoredDeviceAuth();
          setDeviceAuth(stored);
        }}
      />
    );
  }

  // Permission check AFTER all hooks - skip for device-only auth (no user session)
  if (!deviceAuth && !permissionsLoading && !hasPermission('kds_view')) {
    return <AccessDenied permission="kds_view" />;
  }

  // Handler to confirm cancellation was acknowledged
  const handleConfirmCancellation = (orderId: string) => {
    const order = unconfirmedCancellations.get(orderId);
    
    // Save to history before removing
    if (order) {
      const origin = order.order_type === 'delivery' 
        ? 'DELIVERY' 
        : order.order_type === 'takeaway' 
          ? 'BALCÃO' 
          : `MESA ${order.table?.number || '?'}`;
          
      const historyItem: CancellationHistoryItem = {
        orderId: order.id,
        orderNumber: order.id.slice(-4).toUpperCase(),
        reason: (order as any).cancellation_reason || 'Não informado',
        cancelledAt: new Date(order.updated_at || order.created_at),
        confirmedAt: new Date(),
        items: order.order_items?.map(item => ({
          name: item.product?.name || 'Produto',
          quantity: item.quantity,
          variation: item.variation?.name
        })) || [],
        origin,
        customerName: order.customer_name || undefined
      };
      
      setCancellationHistory(prev => {
        const updated = [historyItem, ...prev].slice(0, 100); // Keep max 100 items
        // Persist to localStorage
        try {
          localStorage.setItem(CANCELLATION_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving cancellation history:', e);
        }
        return updated;
      });
    }
    
    // Add to confirmed list so it won't reappear after refresh
    try {
      const stored = localStorage.getItem(CONFIRMED_CANCELLATIONS_KEY);
      const confirmed: string[] = stored ? JSON.parse(stored) : [];
      if (!confirmed.includes(orderId)) {
        confirmed.push(orderId);
        // Keep only last 200 entries to prevent indefinite growth
        const trimmed = confirmed.slice(-200);
        localStorage.setItem(CONFIRMED_CANCELLATIONS_KEY, JSON.stringify(trimmed));
      }
    } catch (e) {
      console.error('Error saving confirmed cancellation:', e);
    }
    
    setUnconfirmedCancellations(prev => {
      const newMap = new Map(prev);
      newMap.delete(orderId);
      return newMap;
    });
    
    // Dismiss the corresponding toast
    toast.dismiss(`cancel-${orderId}`);
    toast.success('Cancelamento confirmado', { duration: 2000 });
  };

  // Handler to confirm item cancellation was acknowledged
  const handleConfirmItemCancellation = (itemId: string) => {
    const item = unconfirmedItemCancellations.get(itemId);
    
    // Save to history before removing
    if (item) {
      const historyItem: CancellationHistoryItem = {
        orderId: item.orderId,
        orderNumber: item.orderId.slice(-4).toUpperCase(),
        reason: item.reason,
        cancelledAt: item.cancelledAt,
        confirmedAt: new Date(),
        items: [{
          name: item.productName,
          quantity: item.quantity,
          variation: item.variationName || undefined
        }],
        origin: item.origin,
      };
      
      setCancellationHistory(prev => {
        const updated = [historyItem, ...prev].slice(0, 100);
        try {
          localStorage.setItem(CANCELLATION_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving cancellation history:', e);
        }
        return updated;
      });
    }
    
    setUnconfirmedItemCancellations(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });
    
    // Dismiss the corresponding toast
    toast.dismiss(`item-cancel-${itemId}`);
    toast.success('Cancelamento de item confirmado', { duration: 2000 });
  };

  // Cancellation History Panel Component with filters
  const CancellationHistoryPanel = () => {
    if (cancellationHistory.length === 0) return null;
    
    // Filter history by period
    const getFilteredHistory = () => {
      const now = new Date();
      return cancellationHistory.filter(item => {
        const itemDate = new Date(item.confirmedAt);
        switch (historyPeriodFilter) {
          case 'today':
            return itemDate.toDateString() === now.toDateString();
          case '7days':
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return itemDate >= sevenDaysAgo;
          case '30days':
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return itemDate >= thirtyDaysAgo;
          default:
            return true;
        }
      });
    };
    
    const filteredHistory = getFilteredHistory();
    
    const handleClearHistory = () => {
      setCancellationHistory([]);
      try {
        localStorage.removeItem(CANCELLATION_HISTORY_KEY);
      } catch (e) {
        console.error('Error clearing cancellation history:', e);
      }
      toast.success('Histórico limpo');
    };
    
    const periodLabels: Record<HistoryPeriodFilter, string> = {
      today: 'Hoje',
      '7days': '7 dias',
      '30days': '30 dias',
      all: 'Todos',
    };
    
    return (
      <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <Badge variant="secondary" className="text-xs">
              {cancellationHistory.length}
            </Badge>
            {isHistoryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-[420px]">
          <Card className="border shadow-lg">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Cancelamentos Confirmados</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={handleClearHistory}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Limpar</span>
                </Button>
              </div>
              <div className="flex gap-1 mt-2">
                {(Object.keys(periodLabels) as HistoryPeriodFilter[]).map((period) => (
                  <Button
                    key={period}
                    variant={historyPeriodFilter === period ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setHistoryPeriodFilter(period)}
                  >
                    {periodLabels[period]}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum cancelamento neste período
                </div>
              ) : (
                <ScrollArea className="max-h-[350px]">
                  <div className="space-y-2">
                    {filteredHistory.map((item, idx) => (
                      <div 
                        key={`${item.orderId}-${idx}`}
                        className="flex flex-col p-2.5 bg-muted/50 rounded text-sm border"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">#{item.orderNumber}</span>
                            <Badge variant="outline" className="text-xs">{item.origin}</Badge>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {item.confirmedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        {item.customerName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Cliente: {item.customerName}
                          </div>
                        )}
                        <div className="text-xs text-destructive mt-1 font-medium">
                          Motivo: {item.reason}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 bg-background/50 p-1.5 rounded">
                          {item.items.map((i, iIdx) => (
                            <div key={iIdx}>
                              {i.quantity}x {i.name}{i.variation ? ` (${i.variation})` : ''}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-muted">
                          <span>Cancelado: {item.cancelledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>Confirmado: {item.confirmedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const handleStartPreparation = async (orderId: string) => {
    try {
      notifiedOrdersRef.current.add(`${orderId}-preparing`);
      await updateOrder.mutateAsync({ id: orderId, status: 'preparing' });
      toast.success('Preparo iniciado!');
    } catch (error) {
      toast.error('Erro ao iniciar preparo');
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      notifiedOrdersRef.current.add(`${orderId}-ready`);
      
      // Mark ALL items in this order as 'delivered' so they don't appear again
      // if the customer adds more items later
      await supabase
        .from('order_items')
        .update({ status: 'delivered' })
        .eq('order_id', orderId);
      
      // Record ready_at timestamp when marking as ready
      await updateOrder.mutateAsync({ 
        id: orderId, 
        status: 'ready',
        ready_at: new Date().toISOString()
      } as any);
      toast.success('Pedido marcado como pronto!');
    } catch (error) {
      toast.error('Erro ao marcar pedido como pronto');
    }
  };

  const getOrderOrigin = (order: Order) => {
    if (order.order_type === 'delivery') {
      return { icon: Truck, label: 'DELIVERY', color: 'text-purple-500 bg-purple-500/10' };
    }
    if (order.order_type === 'takeaway') {
      return { icon: Store, label: 'BALCÃO', color: 'text-orange-500 bg-orange-500/10' };
    }
    return { 
      icon: UtensilsCrossed, 
      label: `MESA ${order.table?.number || '?'}`, 
      color: 'text-blue-500 bg-blue-500/10' 
    };
  };

  const getTimeInfo = (createdAt: string | null) => {
    if (!createdAt) return { text: '--', color: 'text-muted-foreground', bgColor: '' };
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    const timeText = formatTimeDisplay(minutes);
    
    if (minutes < 10) return { text: timeText, color: 'text-green-500', bgColor: 'bg-green-500/10' };
    if (minutes < 20) return { text: timeText, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
    return { text: timeText, color: 'text-red-500', bgColor: 'bg-red-500/10 animate-pulse' };
  };

  const OrderCard = ({ order, showStartButton, showReadyButton }: { 
    order: Order; 
    showStartButton?: boolean;
    showReadyButton?: boolean;
  }) => {
    const origin = getOrderOrigin(order);
    const OriginIcon = origin.icon;
    const isCompact = kdsSettings.compactMode;
    
    // Get items to display based on order status
    // For ready orders, show ready items; for others, show pending/preparing items
    const itemsToShow = order.order_items?.filter(item => {
      if (order.status === 'ready') {
        return item.status === 'ready';
      }
      return item.status === 'pending' || item.status === 'preparing';
    }) || [];
    const totalItems = itemsToShow.length;
    
    // Check if any item has special border
    const hasSpecialBorderItem = itemsToShow.some(item => {
      const itemText = `${item.product?.name || ''} ${item.notes || ''} ${item.extras?.map(e => e.extra_name).join(' ') || ''}`;
      return hasSpecialBorder(itemText);
    });

    // Limit items shown in compact mode
    const displayItems = isCompact ? itemsToShow.slice(0, 3) : itemsToShow;
    const hiddenItemsCount = isCompact ? Math.max(0, itemsToShow.length - 3) : 0;

    return (
      <Card className={cn(
        "shadow-md transition-all",
        isCompact ? "mb-1.5" : "mb-3",
        hasSpecialBorderItem && "ring-2 ring-amber-500 ring-offset-2 ring-offset-background"
      )}>
        <CardHeader className={cn(
          "pb-2 pt-3 px-4",
          isCompact && "pb-1 pt-2 px-3"
        )}>
          <div className="flex items-center justify-between">
            <Badge className={cn("py-1 px-2 text-xs font-bold", origin.color, isCompact && "py-0.5 px-1.5")}>
              <OriginIcon className={cn("h-3.5 w-3.5 mr-1", isCompact && "h-3 w-3")} />
              {origin.label}
            </Badge>
            <KdsSlaIndicator createdAt={order.updated_at || order.created_at} size={isCompact ? "sm" : "md"} showBackground />
          </div>
          <div className={cn("flex items-center gap-2 mt-1 text-xs text-muted-foreground", isCompact && "mt-0.5")}>
            <span className="font-mono">#{order.id.slice(-4).toUpperCase()}</span>
            {!isCompact && order.customer_name && (
              <span className="font-medium text-primary">• {order.customer_name}</span>
            )}
            {isCompact ? (
              totalItems > 0 && <span>{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
            ) : (
              totalItems > 1 && <KdsItemCounter currentIndex={1} totalItems={totalItems} label="Pizza" />
            )}
          </div>
        </CardHeader>
        <CardContent className={cn("px-4 pb-3", isCompact && "px-3 pb-2")}>
          <div className={cn("space-y-2 mb-3 border rounded-lg p-2 bg-background/50", isCompact && "space-y-1 mb-2 p-1.5")}>
            {displayItems.map((item, idx) => {
              const itemText = `${item.product?.name || ''} ${item.notes || ''} ${item.extras?.map(e => e.extra_name).join(' ') || ''}`;
              const flavors = getFlavorsFromExtras(item.extras, item.sub_items);
              
              return (
                <div key={idx} className={cn("text-sm", isCompact && "text-xs")}>
                  <div className="flex items-start gap-1">
                    <span className="font-bold text-primary">{item.quantity}x</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
                        {!isCompact && item.variation?.name && (
                          <span className="text-muted-foreground">({item.variation.name})</span>
                        )}
                      </div>
                      
                      {/* Tarjas de borda e observações - SEMPRE animadas */}
                      <KdsItemBadges 
                        notes={item.notes} 
                        extras={item.extras} 
                        compact={isCompact} 
                      />
                      
                      {/* Sabores */}
                      {!isCompact && flavors.length > 0 && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          {flavors.map((f, i) => (
                            <p key={i}>🍕 {f}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {hiddenItemsCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">+{hiddenItemsCount} mais...</p>
            )}
          </div>
          {!isCompact && order.notes && (
            <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded p-2 mb-3">
              <strong>Obs:</strong> {order.notes}
            </div>
          )}
          <div className="flex gap-2">
            {showStartButton && (
              <Button 
                size={isCompact ? "sm" : "sm"}
                className={cn("flex-1 bg-blue-600 hover:bg-blue-700", isCompact && "h-7 text-xs")}
                onClick={() => handleStartPreparation(order.id)}
              >
                <Play className={cn("h-4 w-4 mr-1", isCompact && "h-3 w-3")} />
                {isCompact ? '▶' : 'Iniciar'}
              </Button>
            )}
            {showReadyButton && (
              <Button 
                size={isCompact ? "sm" : "sm"}
                className={cn("flex-1 bg-green-600 hover:bg-green-700", isCompact && "h-7 text-xs")}
                onClick={() => handleMarkReady(order.id)}
              >
                <CheckCircle className={cn("h-4 w-4 mr-1", isCompact && "h-3 w-3")} />
                {isCompact ? '✓' : 'Pronto'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Cancelled Order Card with blinking animation
  const CancelledOrderCard = ({ order, onConfirm }: { order: Order; onConfirm: () => void }) => {
    const origin = getOrderOrigin(order);
    const OriginIcon = origin.icon;

    return (
      <Card className="mb-3 shadow-lg border-2 border-destructive animate-blink-cancel">
        <CardHeader className="pb-2 pt-3 px-4 bg-destructive/20">
          <div className="flex items-center justify-between">
            <Badge className="bg-destructive text-destructive-foreground py-1 px-2 text-xs font-bold">
              <Ban className="h-3.5 w-3.5 mr-1" />
              CANCELADO
            </Badge>
            <Badge className={cn("py-1 px-2 text-xs font-bold", origin.color)}>
              <OriginIcon className="h-3.5 w-3.5 mr-1" />
              {origin.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="font-mono font-bold">#{order.id.slice(-4).toUpperCase()}</span>
            {order.customer_name && (
              <span className="font-medium">• {order.customer_name}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {/* Cancellation reason */}
          <div className="text-sm text-destructive bg-destructive/10 rounded p-2 mb-3">
            <strong>Motivo:</strong> {(order as any).cancellation_reason || 'Não informado'}
          </div>
          
          {/* Cancelled items */}
          <div className="space-y-1 mb-3 border rounded-lg p-2 bg-background/50 text-sm opacity-75">
            <p className="text-xs text-muted-foreground mb-1">Itens cancelados:</p>
            {order.order_items?.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="font-bold text-muted-foreground">{item.quantity}x</span>
                <span>{item.product?.name || 'Produto'}</span>
                {item.variation?.name && (
                  <span className="text-muted-foreground">({item.variation.name})</span>
                )}
              </div>
            ))}
            {(order.order_items?.length || 0) > 4 && (
              <p className="text-xs text-muted-foreground">
                +{(order.order_items?.length || 0) - 4} mais...
              </p>
            )}
          </div>
          
          {/* Confirmation button */}
          <Button 
            size="lg" 
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
            onClick={onConfirm}
          >
            ✓ CIENTE - CONFIRMAR
          </Button>
        </CardContent>
      </Card>
    );
  };

  const KanbanColumn = ({ 
    title, 
    orders, 
    icon: Icon, 
    headerColor,
    showStartButton,
    showReadyButton
  }: { 
    title: string; 
    orders: Order[]; 
    icon: React.ElementType;
    headerColor: string;
    showStartButton?: boolean;
    showReadyButton?: boolean;
  }) => {
    const isCompact = kdsSettings.compactMode;
    
    return (
      <div className={cn("flex-1", isCompact ? "min-w-[200px] lg:min-w-[240px]" : "min-w-[280px] lg:min-w-[320px]")}>
        <div className={cn("rounded-t-lg p-3 flex items-center justify-between", headerColor, isCompact && "p-2")}>
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", isCompact && "h-4 w-4")} />
            <span className={cn("font-bold", isCompact && "text-sm")}>{title}</span>
          </div>
          <Badge variant="secondary" className={cn("text-base px-2.5 py-0.5", isCompact && "text-sm px-2 py-0")}>
            {orders.length}
          </Badge>
        </div>
        <ScrollArea className={cn(
          "bg-muted/30 rounded-b-lg",
          isCompact ? "p-1.5" : "p-2",
          isFullscreen ? "h-[calc(100vh-200px)]" : "h-[calc(100vh-280px)]"
        )}>
          {orders.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">Nenhum pedido</p>
            </div>
          ) : (
            <div className={cn(isCompact && "grid grid-cols-1 xl:grid-cols-2 gap-1.5")}>
              {orders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  showStartButton={showStartButton}
                  showReadyButton={showReadyButton}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  };

  const KDSContent = () => (
    <div className={cn("p-4 h-full", isFullscreen && "p-6")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <ChefHat className={cn("text-primary", isFullscreen ? "h-10 w-10" : "h-7 w-7")} />
          <div>
            <h1 className={cn("font-bold", isFullscreen ? "text-3xl" : "text-2xl")}>KDS - Cozinha <span className="text-xs font-normal text-muted-foreground">v{APP_VERSION}</span></h1>
            <p className="text-muted-foreground text-sm">
              {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} ativo{activeOrders.length !== 1 ? 's' : ''}
              {orderTypeFilter !== 'all' && ` (filtrado)`}
            </p>
          </div>
          
          {/* Metrics Panel - Desktop inline - ONLY FOR MANAGERS */}
          {isManager && (
            <div className="hidden lg:block">
              <MetricsPanel />
            </div>
          )}
        </div>
        
        {/* Real-time clock (fullscreen only) */}
        {isFullscreen && (
          <div className="text-center">
            <div className="text-3xl font-mono font-bold tracking-wider">
              {currentTime.toLocaleTimeString('pt-BR')}
            </div>
            <div className="text-sm text-muted-foreground capitalize">
              {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2 relative">
          {/* Bottleneck Indicator - Production Line Mode - ONLY FOR MANAGERS */}
          {isManager && isProductionLineMode && bottlenecks && bottlenecks.length > 0 && (
            <KdsBottleneckIndicator 
              bottlenecks={bottlenecks} 
              onOpenDashboard={() => setMetricsDialogOpen(true)} 
            />
          )}
          
          {/* Metrics Dashboard Button - ONLY FOR MANAGERS */}
          {isManager && (
            <KdsMetricsDashboard 
              open={metricsDialogOpen}
              onOpenChange={setMetricsDialogOpen}
            />
          )}
          
          {/* Cancellation History Panel - ONLY FOR MANAGERS */}
          {isManager && <CancellationHistoryPanel />}
          
          {/* Sound Toggle - ONLY FOR MANAGERS */}
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "gap-1.5",
                soundEnabled ? "text-green-600 border-green-600/50" : "text-muted-foreground"
              )}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Som ON' : 'Som OFF'}</span>
            </Button>
          )}
          
          {/* Quick Station Switcher */}
          <div className="flex items-center gap-1.5">
            <Select
              value={kdsSettings.assignedStationId || 'all'}
              onValueChange={(value) => {
                updateDeviceSettings({ 
                  assignedStationId: value === 'all' ? undefined : value 
                });
                // Reset station items tracking when changing stations
                previousStationItemsRef.current = new Set();
                stationItemsInitializedRef.current = false;
              }}
            >
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Todas praças" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Circle className="h-3 w-3 text-muted-foreground" />
                    Todas as praças
                  </span>
                </SelectItem>
                {productionStations.map(station => (
                  <SelectItem key={station.id} value={station.id}>
                    <span className="flex items-center gap-2">
                      <Circle 
                        className="h-3 w-3" 
                        style={{ color: station.color, fill: station.color }}
                      />
                      {station.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Station Badge (when assigned) */}
          {kdsSettings.assignedStationId && (
            <Badge 
              variant="outline" 
              className="hidden md:flex text-sm font-medium border-2"
              style={{ 
                borderColor: activeStations.find(s => s.id === kdsSettings.assignedStationId)?.color,
                color: activeStations.find(s => s.id === kdsSettings.assignedStationId)?.color
              }}
            >
              {activeStations.find(s => s.id === kdsSettings.assignedStationId)?.name}
            </Badge>
          )}
          
          {/* Compact Mode Toggle */}
          <Button
            variant={kdsSettings.compactMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateKdsSettings({ compactMode: !kdsSettings.compactMode })}
            className="gap-1.5"
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">{kdsSettings.compactMode ? 'Compacto' : 'Normal'}</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="gap-1.5"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              clearDeviceAuth();
              setDeviceAuth(null);
            }}
            className="gap-1.5 text-destructive hover:text-destructive"
            title="Sair do KDS e trocar dispositivo"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{deviceAuth?.deviceName ? `${deviceAuth.deviceName} — Sair` : 'Sair KDS'}</span>
          </Button>
        </div>
      </div>

      {/* Metrics Panel - Mobile - ONLY FOR MANAGERS */}
      {isManager && (
        <div className="lg:hidden mb-4">
          <MetricsPanel />
        </div>
      )}

      {/* Metrics Chart (Collapsible) - ONLY FOR MANAGERS */}
      {isManager && activeOrdersList.length > 0 && (
        <Collapsible open={isChartOpen} onOpenChange={setIsChartOpen} className="mb-4">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Evolução do Tempo Médio (últimas 2h)</span>
              </div>
              {isChartOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 bg-muted/50 rounded-lg border">
            <MetricsChart />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Order Type Filter - ONLY FOR MANAGERS */}
      {isManager && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={orderTypeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOrderTypeFilter('all')}
            className="gap-1.5"
          >
            Todos
            <Badge variant="secondary" className="ml-1 text-xs">
              {allActiveOrders.length}
            </Badge>
          </Button>
          <Button
            variant={orderTypeFilter === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOrderTypeFilter('table')}
            className="gap-1.5"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Mesa
            <Badge variant="secondary" className="ml-1 text-xs">
              {tableCount}
            </Badge>
          </Button>
          <Button
            variant={orderTypeFilter === 'takeaway' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOrderTypeFilter('takeaway')}
            className="gap-1.5"
          >
            <Store className="h-3.5 w-3.5" />
            Balcão
            <Badge variant="secondary" className="ml-1 text-xs">
              {takeawayCount}
            </Badge>
          </Button>
          <Button
            variant={orderTypeFilter === 'delivery' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOrderTypeFilter('delivery')}
            className="gap-1.5"
          >
            <Truck className="h-3.5 w-3.5" />
            Delivery
            <Badge variant="secondary" className="ml-1 text-xs">
              {deliveryCount}
            </Badge>
          </Button>
        </div>
      )}

      {/* Unconfirmed Cancellations Alert - Urgent Section */}
      {Array.from(unconfirmedCancellations.values()).filter((o): o is Order => o !== null).length > 0 && (
        <div className="mb-4 p-3 bg-destructive/10 border-2 border-destructive rounded-lg animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-6 w-6 text-destructive animate-bounce" />
            <h2 className="text-lg font-bold text-destructive">
              ⚠️ PEDIDO(S) CANCELADO(S) - ATENÇÃO!
            </h2>
            <Badge variant="destructive" className="ml-auto text-base">
              {Array.from(unconfirmedCancellations.values()).filter(o => o !== null).length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from(unconfirmedCancellations.values())
              .filter((order): order is Order => order !== null)
              .map(order => (
                <CancelledOrderCard 
                  key={order.id} 
                  order={order}
                  onConfirm={() => handleConfirmCancellation(order.id)}
                />
              ))}
          </div>
        </div>
      )}

      {/* Unconfirmed Item Cancellations Alert */}
      {unconfirmedItemCancellations.size > 0 && (
        <div className="mb-4 p-3 bg-orange-500/10 border-2 border-orange-500 rounded-lg animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <Ban className="h-6 w-6 text-orange-500 animate-bounce" />
            <h2 className="text-lg font-bold text-orange-600 dark:text-orange-400">
              ⚠️ ITEM(NS) CANCELADO(S) - CONFIRME!
            </h2>
            <Badge className="ml-auto text-base bg-orange-500 hover:bg-orange-600">
              {unconfirmedItemCancellations.size}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from(unconfirmedItemCancellations.values()).map(item => (
              <Card key={item.itemId} className="bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {item.origin}
                        </Badge>
                      </div>
                      <p className="font-bold text-lg">
                        {item.quantity}x {item.productName}
                        {item.variationName && (
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            ({item.variationName})
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="font-medium">Motivo:</span> {item.reason}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cancelado às {item.cancelledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-orange-500 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900"
                      onClick={() => handleConfirmItemCancellation(item.itemId)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      OK
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Kanban Board or Production Line View */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (isDeviceOnlyMode && !deviceData.settings) ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Carregando configurações...</span>
        </div>
      ) : kdsSettings.operationMode === 'production_line' ? (
        <KdsProductionLineView 
          orders={orders} 
          isLoading={isLoading} 
          overrideTenantId={deviceAuth?.tenantId}
          overrideStations={isDeviceOnlyMode ? deviceData.stations : undefined}
          overrideSettings={isDeviceOnlyMode ? {
            assignedStationId: deviceAuth?.stationId || kdsSettings.assignedStationId,
            highlightSpecialBorders: kdsSettings.highlightSpecialBorders,
            borderKeywords: kdsSettings.borderKeywords,
            showPartySize: kdsSettings.showPartySize,
            showWaiterName: kdsSettings.showWaiterName,
            compactMode: kdsSettings.compactMode,
            timerGreenMinutes: kdsSettings.timerGreenMinutes,
            timerYellowMinutes: kdsSettings.timerYellowMinutes,
          } : undefined}
          overrideWorkflow={isDeviceOnlyMode ? {
            moveItemToNextStation: {
              mutate: ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
                // Use smart routing via edge function (load balancing)
                deviceData.smartMoveItem.mutate({ itemId, currentStationId });
              },
              isPending: deviceData.smartMoveItem.isPending,
            },
            skipItemToNextStation: {
              mutate: ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
                deviceData.smartMoveItem.mutate({ itemId, currentStationId });
              },
            },
            finalizeOrderFromStatus: {
              mutate: ({ orderId }: { orderId: string; orderType?: string; currentStationId?: string }) => {
                deviceData.updateOrderStatus.mutate({ orderId, status: 'delivered' });
              },
              isPending: deviceData.updateOrderStatus.isPending,
            },
            serveItem: {
              mutate: (_itemId: string) => {
                deviceData.refetch();
              },
              isPending: false,
            },
          } : undefined}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kdsSettings.showPendingColumn && (
            <KanbanColumn 
              title={kdsSettings.columnNamePending} 
              orders={pendingOrders} 
              icon={Clock}
              headerColor="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
              showStartButton
            />
          )}
          <KanbanColumn 
            title={kdsSettings.columnNamePreparing} 
            orders={preparingOrders} 
            icon={ChefHat}
            headerColor="bg-blue-500/20 text-blue-700 dark:text-blue-400"
            showReadyButton
            showStartButton={!kdsSettings.showPendingColumn}
          />
          <KanbanColumn 
            title={kdsSettings.columnNameReady} 
            orders={readyOrders} 
            icon={CheckCircle}
            headerColor="bg-green-500/20 text-green-700 dark:text-green-400"
          />
        </div>
      )}
    </div>
  );

  // Header component for employee mode (clean, no sidebar)
  const EmployeeKdsHeader = () => {
    const { user, signOut } = useAuth();
    
    return (
      <header className="fixed top-0 left-0 right-0 h-14 bg-background border-b z-50 flex items-center justify-between px-4">
        {/* Left side - empty for balance */}
        <div className="flex-1" />
        
        {/* Right side - Logo + Profile */}
        <div className="flex items-center gap-4">
          <img 
            src={logoSlim} 
            alt="Logo" 
            className="h-8 object-contain" 
          />
          <span className="text-[10px] text-muted-foreground">v{APP_VERSION}</span>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block">
              {deviceAuth?.deviceName || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Dispositivo'}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                clearDeviceAuth();
                setDeviceAuth(null);
              }}
              title="Desconectar dispositivo"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
    );
  };

  // Fullscreen mode - render without PDVLayout
  if (isFullscreen) {
    return (
      <div className="min-h-screen bg-background">
        <KDSContent />
      </div>
    );
  }

  // Employee mode (non-manager) - render with minimal header, no sidebar
  if (!isManager) {
    return (
      <div className="min-h-screen bg-background">
        <EmployeeKdsHeader />
        <div className="pt-14">
          <KDSContent />
        </div>
      </div>
    );
  }

  // Manager/Admin mode - render with full PDVLayout
  return (
    <PDVLayout>
      <KDSContent />
    </PDVLayout>
  );
}
