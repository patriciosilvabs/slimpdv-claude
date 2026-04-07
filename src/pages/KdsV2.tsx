import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useUserSector } from '@/hooks/useUserSector';
import { useSectorPresence } from '@/hooks/useSectorPresence';
import { useSectorOrderItems, useOvenItems, type SectorOrderItem } from '@/hooks/useSectorOrderItems';
import { useKdsStations } from '@/hooks/useKdsStations';
import { useKdsDeviceData } from '@/hooks/useKdsDeviceData';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { SectorQueuePanel } from '@/components/kds/SectorQueuePanel';
import { OvenTimerPanel } from '@/components/kds/OvenTimerPanel';
import { OvenKdsView } from '@/components/kds/OvenKdsView';
import { KdsDeviceLogin, getStoredDeviceAuth, clearDeviceAuth } from '@/components/kds/KdsDeviceLogin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, LogOut, Flame, ChefHat, Maximize2, Minimize2, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import logoSlim from '@/assets/logo-slim.png';
import { APP_VERSION } from '@/lib/appVersion';

export default function KDS() {
  const { user, signOut } = useAuth();
  const { tenantId } = useTenant();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [isDeviceAuth, setIsDeviceAuth] = useState(false);
  const [deviceAuth, setDeviceAuth] = useState<ReturnType<typeof getStoredDeviceAuth>>(null);
  const loginTimestampRef = React.useRef<number>(0);

  // Check for device auth — only use if NO user session exists
  useEffect(() => {
    if (user) {
      // User is authenticated, ignore device auth
      setIsDeviceAuth(false);
      setDeviceAuth(null);
      return;
    }
    const stored = getStoredDeviceAuth();
    if (stored) {
      console.log('[KDS] Restored device auth from storage:', stored.deviceId, stored.deviceName);
      setIsDeviceAuth(true);
      setDeviceAuth(stored);
      // Auto-select device's station
      if (stored.stationId) {
        setSelectedSectorId(stored.stationId);
      }
    }
  }, [user]);

  // Buscar setor do usuário (only when user auth)
  const { data: userSector, isLoading: sectorLoading } = useUserSector();

  // Dados do dispositivo KDS (bypass RLS)
  const deviceData = useKdsDeviceData(isDeviceAuth ? deviceAuth : null);

  // Auto-logout on auth error (with grace period after login)
  useEffect(() => {
    if (deviceData.authError && isDeviceAuth) {
      const elapsed = Date.now() - loginTimestampRef.current;
      // Grace period: don't auto-logout within 10s of login to avoid race conditions
      if (elapsed < 10000) {
        console.warn('[KDS] Auth error within grace period, ignoring. Elapsed:', elapsed, 'ms');
        return;
      }
      console.error('[KDS] Auth error after grace period, forcing logout');
      clearDeviceAuth();
      setIsDeviceAuth(false);
      setDeviceAuth(null);
      setSelectedSectorId(null);
      toast.error('Código do dispositivo expirou ou foi alterado. Faça login novamente.');
    }
  }, [deviceData.authError, isDeviceAuth]);
  
  // Buscar estações via hook normal (user auth)
  const { stations: userStations, isLoading: userStationsLoading } = useKdsStations();

  // Use the right stations source
  const stations = isDeviceAuth ? deviceData.stations : userStations;
  const stationsLoading = isDeviceAuth ? deviceData.isLoading : userStationsLoading;

  // Auto-selecionar primeiro setor ativo se nenhum selecionado
  useEffect(() => {
    if (!selectedSectorId && !userSector && stations && stations.length > 0) {
      const firstActive = stations.find((s: any) => s.is_active);
      if (firstActive) setSelectedSectorId(firstActive.id);
    }
  }, [stations, userSector, selectedSectorId]);
  
  // Setor ativo (do usuário ou selecionado manualmente)
  const activeSectorId = selectedSectorId || userSector?.sectorId || null;
  const activeSector = stations?.find((s: any) => s.id === activeSectorId);
  const isOvenView = activeSector?.station_type === 'oven_expedite';
  const { settings: kdsSettings } = useKdsSettings(isDeviceAuth ? deviceAuth?.tenantId : undefined);
  // For device auth, prefer settings from edge function (bypasses RLS)
  const isDark = isDeviceAuth 
    ? (deviceData.settings?.dark_mode ?? kdsSettings.darkMode)
    : kdsSettings.darkMode;
  const assignedStationId = isDeviceAuth ? deviceAuth?.stationId || null : userSector?.sectorId || null;
  const assignedStation = stations?.find((s: any) => s.id === assignedStationId);
  const isEdgeSector = activeSector?.is_edge_sector || userSector?.isEdgeSector || false;
  const isOvenKds =
    assignedStation?.station_type === 'oven_expedite' ||
    (!assignedStationId && activeSector?.station_type === 'oven_expedite');

  // Presence heartbeat
  const { getOnlineCount } = useSectorPresence(activeSectorId);

  // Itens do setor (user auth)
  const { data: userSectorItems = [], isLoading: userItemsLoading } = useSectorOrderItems({
    sectorId: activeSectorId,
    statuses: ['waiting', 'in_progress'],
  });

  // Itens no forno (user auth)
  const { data: userOvenItems = [], isLoading: userOvenLoading } = useOvenItems();

  // Itens derivados do device auth
  const deviceSectorItems = useMemo(() => {
    if (!isDeviceAuth || !activeSectorId) return [] as SectorOrderItem[];
    const orders = deviceData.orders;
    if (!Array.isArray(orders)) return [] as SectorOrderItem[];

    try {
      return orders
        .flatMap((order) =>
          (Array.isArray(order.order_items) ? order.order_items : [])
            .filter((item) => item.current_station_id === activeSectorId && ['waiting', 'in_progress'].includes(item.station_status || '') && item.status !== 'cancelled' && (order as any).status !== 'cancelled')
            .map((item) => {
              const rawItem = item as any;
              const rawOrder = order as any;

               return {
                ...rawItem,
                fulfillment_type: rawItem.fulfillment_type ?? null,
                order_id: order.id,
                tenant_id: rawItem.tenant_id || deviceAuth?.tenantId || '',
                order: {
                  id: order.id,
                  customer_name: order.customer_name,
                  status: rawOrder.status ?? null,
                  order_type: order.order_type,
                  table_id: order.table_id,
                  party_size: order.party_size ?? null,
                  created_at: order.created_at,
                  notes: order.notes,
                  external_display_id: rawOrder.external_display_id ?? null,
                  display_number: rawOrder.display_number ?? null,
                  table: rawOrder.table ?? null,
                },
                product: rawItem.product
                  ? { id: rawItem.product_id || '', name: rawItem.product.name }
                  : null,
                variation: rawItem.variation
                  ? { id: rawItem.variation_id || '', name: rawItem.variation.name }
                  : null,
                extras: (Array.isArray(rawItem.extras) ? rawItem.extras : []).map((extra: any) => ({
                  id: `${rawItem.id}-${extra.extra_name}`,
                  extra_name: extra.extra_name,
                  price: extra.price,
                  kds_category: extra.kds_category || '',
                })),
                sub_items: (Array.isArray(rawItem.sub_items) ? rawItem.sub_items : []) as SectorOrderItem['sub_items'],
              } as SectorOrderItem;
            })
        )
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch (e) {
      console.error('[KDS] deviceSectorItems mapping error:', e);
      return [] as SectorOrderItem[];
    }
  }, [activeSectorId, deviceAuth?.tenantId, deviceData.orders, isDeviceAuth]);

  const deviceOvenItems = useMemo(() => {
    if (!isDeviceAuth) return [] as SectorOrderItem[];
    const orders = deviceData.orders;
    if (!Array.isArray(orders)) return [] as SectorOrderItem[];

    try {
      return orders
        .flatMap((order) =>
          (Array.isArray(order.order_items) ? order.order_items : [])
            .filter((item) => ['in_oven', 'ready'].includes(item.station_status as string || '') && item.status !== 'cancelled' && (order as any).status !== 'cancelled')
            .map((item) => {
              const rawItem = item as any;
              const rawOrder = order as any;

               return {
                ...rawItem,
                fulfillment_type: rawItem.fulfillment_type ?? null,
                order_id: order.id,
                tenant_id: rawItem.tenant_id || deviceAuth?.tenantId || '',
                order: {
                  id: order.id,
                  customer_name: order.customer_name,
                  status: rawOrder.status ?? null,
                  order_type: order.order_type,
                  table_id: order.table_id,
                  party_size: order.party_size ?? null,
                  created_at: order.created_at,
                  notes: order.notes,
                  external_display_id: rawOrder.external_display_id ?? null,
                  display_number: rawOrder.display_number ?? null,
                  table: rawOrder.table ?? null,
                },
                product: rawItem.product
                  ? { id: rawItem.product_id || '', name: rawItem.product.name }
                  : null,
                variation: rawItem.variation
                  ? { id: rawItem.variation_id || '', name: rawItem.variation.name }
                  : null,
                extras: (Array.isArray(rawItem.extras) ? rawItem.extras : []).map((extra: any) => ({
                  id: `${rawItem.id}-${extra.extra_name}`,
                  extra_name: extra.extra_name,
                  price: extra.price,
                  kds_category: extra.kds_category || '',
                })),
                sub_items: (Array.isArray(rawItem.sub_items) ? rawItem.sub_items : []) as SectorOrderItem['sub_items'],
              } as SectorOrderItem;
            })
        )
        .sort((a, b) => new Date(a.estimated_exit_at || a.created_at).getTime() - new Date(b.estimated_exit_at || b.created_at).getTime());
    } catch (e) {
      console.error('[KDS] deviceOvenItems mapping error:', e);
      return [] as SectorOrderItem[];
    }
  }, [deviceAuth?.tenantId, deviceData.orders, isDeviceAuth]);

  const deviceOrderValidationItems = useMemo(() => {
    if (!isDeviceAuth) return [] as SectorOrderItem[];
    const orders = deviceData.orders;
    if (!Array.isArray(orders)) return [] as SectorOrderItem[];

    try {
      return orders.flatMap((order) =>
        (Array.isArray(order.order_items) ? order.order_items : [])
          .filter((item) => item.status !== 'cancelled')
          .map((item) => {
            const rawItem = item as any;
            const rawOrder = order as any;

            return {
              ...rawItem,
              fulfillment_type: rawItem.fulfillment_type ?? null,
              order_id: order.id,
              tenant_id: rawItem.tenant_id || deviceAuth?.tenantId || '',
              order: {
                id: order.id,
                customer_name: order.customer_name,
                status: rawOrder.status ?? null,
                order_type: order.order_type,
                table_id: order.table_id,
                party_size: order.party_size ?? null,
                created_at: order.created_at,
                notes: order.notes,
                external_display_id: rawOrder.external_display_id ?? null,
                display_number: rawOrder.display_number ?? null,
                table: rawOrder.table ?? null,
              },
              product: rawItem.product
                ? { id: rawItem.product_id || '', name: rawItem.product.name }
                : null,
              variation: rawItem.variation
                ? { id: rawItem.variation_id || '', name: rawItem.variation.name }
                : null,
              extras: (Array.isArray(rawItem.extras) ? rawItem.extras : []).map((extra: any) => ({
                id: `${rawItem.id}-${extra.extra_name}`,
                extra_name: extra.extra_name,
                price: extra.price,
                kds_category: extra.kds_category || '',
              })),
              sub_items: (Array.isArray(rawItem.sub_items) ? rawItem.sub_items : []) as SectorOrderItem['sub_items'],
            } as SectorOrderItem;
          })
      );
    } catch (e) {
      console.error('[KDS] deviceOrderValidationItems mapping error:', e);
      return [] as SectorOrderItem[];
    }
  }, [deviceAuth?.tenantId, deviceData.orders, isDeviceAuth]);

  const deviceSiblingItems = useMemo(
    () => deviceOrderValidationItems.filter((item) => !['in_oven', 'ready', 'done', 'dispatched'].includes(item.station_status || '')),
    [deviceOrderValidationItems]
  );

  const sectorItems = isDeviceAuth ? deviceSectorItems : userSectorItems;
  const itemsLoading = isDeviceAuth ? deviceData.isLoading : userItemsLoading;
  const ovenItems = isDeviceAuth ? deviceOvenItems : userOvenItems;
  const ovenLoading = isDeviceAuth ? deviceData.isLoading : userOvenLoading;

  // Cancellation detection: show alert when items disappear due to order cancellation
  const prevSectorItemsRef = React.useRef<Map<string, { orderId: string; productName: string; orderLabel: string }>>(new Map());
  const prevOvenItemsRef = React.useRef<Map<string, { orderId: string; productName: string; orderLabel: string }>>(new Map());
  const alertedOrderIdsRef = React.useRef<Set<string>>(new Set());

  const cancellationAlertsEnabled = isDeviceAuth
    ? (deviceData.settings?.cancellation_alerts_enabled ?? kdsSettings.cancellationAlertsEnabled)
    : kdsSettings.cancellationAlertsEnabled;

  useEffect(() => {
    const rawOrders = isDeviceAuth ? (deviceData.orders as any[]) : [];
    const prev = prevSectorItemsRef.current;
    const current = new Map(
      sectorItems.map((item) => [
        item.id,
        {
          orderId: item.order_id,
          productName: item.product?.name || 'Item',
          orderLabel: item.order?.customer_name || (item.order?.external_display_id ? `#${item.order.external_display_id}` : 'Pedido'),
        },
      ])
    );

    if (prev.size > 0 && cancellationAlertsEnabled) {
      for (const [itemId, info] of prev) {
        if (!current.has(itemId) && !alertedOrderIdsRef.current.has(info.orderId)) {
          const order = rawOrders.find((o) => o.id === info.orderId);
          if (order?.status === 'cancelled') {
            alertedOrderIdsRef.current.add(info.orderId);
            toast.error(`CANCELADO: ${info.orderLabel}`, {
              description: `${info.productName} removido do KDS`,
              duration: 8000,
            });
          }
        }
      }
    }

    prevSectorItemsRef.current = current;
  }, [sectorItems, cancellationAlertsEnabled, deviceData.orders, isDeviceAuth]);

  useEffect(() => {
    const rawOrders = isDeviceAuth ? (deviceData.orders as any[]) : [];
    const prev = prevOvenItemsRef.current;
    const current = new Map(
      ovenItems.map((item) => [
        item.id,
        {
          orderId: item.order_id,
          productName: item.product?.name || 'Item',
          orderLabel: item.order?.customer_name || (item.order?.external_display_id ? `#${item.order.external_display_id}` : 'Pedido'),
        },
      ])
    );

    if (prev.size > 0 && cancellationAlertsEnabled) {
      for (const [itemId, info] of prev) {
        if (!current.has(itemId) && !alertedOrderIdsRef.current.has(info.orderId)) {
          const order = rawOrders.find((o) => o.id === info.orderId);
          if (order?.status === 'cancelled') {
            alertedOrderIdsRef.current.add(info.orderId);
            toast.error(`CANCELADO: ${info.orderLabel}`, {
              description: `${info.productName} removido do forno`,
              duration: 8000,
            });
          }
        }
      }
    }

    prevOvenItemsRef.current = current;
  }, [ovenItems, cancellationAlertsEnabled, deviceData.orders, isDeviceAuth]);

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Login KDS device
  if (!user && !isDeviceAuth) {
    return <KdsDeviceLogin onLoginSuccess={(device) => {
      console.log('[KDS] Device login success:', device?.device_id, device?.name);
      loginTimestampRef.current = Date.now();
      const stored = getStoredDeviceAuth();
      if (stored) {
        setDeviceAuth(stored);
        setIsDeviceAuth(true);
        if (stored.stationId) setSelectedSectorId(stored.stationId);
      } else {
        console.error('[KDS] getStoredDeviceAuth returned null right after login!');
        toast.error('Erro ao salvar credenciais do dispositivo. Tente novamente.');
      }
    }} />;
  }

  // Loading
  if (sectorLoading || stationsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("h-screen flex flex-col overflow-hidden", isDark ? "bg-zinc-950 text-white" : "bg-background")}>
      {/* Top Bar */}
      <header className={cn(
        "flex items-center justify-between px-4 py-2 border-b shrink-0",
        isDark ? "bg-zinc-900 border-zinc-800" : "bg-card border-border"
      )}>
        <div className="flex items-center gap-3">
          <img src={logoSlim} alt="Slim" className={cn("h-7", isDark && "brightness-200")} />
          <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-muted-foreground")}>v{APP_VERSION}</span>
          {/* Store name for device mode — shows which tenant this KDS is linked to */}
          {isDeviceAuth && (deviceData.tenantName || deviceAuth?.tenantName) && (
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded border",
              isDark
                ? "border-zinc-600 text-zinc-300 bg-zinc-800"
                : "border-slate-300 text-slate-600 bg-slate-50"
            )}>
              🏪 {deviceData.tenantName || deviceAuth?.tenantName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de setor */}
          {stations && stations.length > 0 && (
            <Select value={activeSectorId || ''} onValueChange={setSelectedSectorId}>
              <SelectTrigger className={cn(
                "w-48 h-8 text-sm",
                isDark && "bg-zinc-800 border-zinc-700 text-zinc-200"
              )}>
                <SelectValue placeholder="Selecionar setor..." />
              </SelectTrigger>
              <SelectContent className={isDark ? "bg-zinc-800 border-zinc-700" : ""}>
                {stations.filter(s => s.is_active).map(s => (
                  <SelectItem key={s.id} value={s.id} className={isDark ? "text-zinc-200 focus:bg-zinc-700 focus:text-white" : ""}>
                    <span className="flex items-center gap-2">
                      {s.is_edge_sector ? <Flame className="h-3 w-3 text-orange-500" /> : <ChefHat className="h-3 w-3" />}
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Setor ativo badge */}
          {activeSector && (
            <Badge 
              className="gap-1" 
              style={{ backgroundColor: activeSector.color || undefined }}
            >
              {isEdgeSector ? <Flame className="h-3 w-3" /> : <ChefHat className="h-3 w-3" />}
              {activeSector.name}
            </Badge>
          )}

          {/* Online indicator */}
          {activeSectorId && (
            <Badge variant="outline" className={cn("gap-1", isDark && "border-zinc-700 text-zinc-300")}>
              {getOnlineCount(activeSectorId) > 0 ? (
                <Wifi className="h-3 w-3 text-emerald-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-500" />
              )}
              {getOnlineCount(activeSectorId)} online
            </Badge>
          )}

          <Button size="icon" variant="ghost" className={cn("h-8 w-8", isDark && "text-zinc-300 hover:bg-zinc-800 hover:text-white")} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className={cn("gap-1.5 text-red-500 border-red-500 hover:bg-red-500 hover:text-white", isDark && "border-red-700 hover:bg-red-700")}
            onClick={() => {
              if (isDeviceAuth) {
                clearDeviceAuth();
                setIsDeviceAuth(false);
                setDeviceAuth(null);
                setSelectedSectorId(null);
                toast.success('Dispositivo desconectado');
              } else {
                signOut();
              }
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Content */}
      {!activeSectorId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Selecione um setor</p>
            <p className="text-sm">Escolha o setor no menu acima para ver os itens</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {activeSector?.station_type === 'oven_expedite' ? (
            <div className="flex-1">
              <OvenKdsView
                ovenItems={ovenItems}
                isLoading={ovenLoading}
                stationId={activeSectorId!}
                stationColor={activeSector?.color || null}
                tenantId={tenantId || (isDeviceAuth ? deviceAuth?.tenantId : null) || null}
                darkMode={isDark}
                siblingItemsOverride={isDeviceAuth ? deviceSiblingItems : undefined}
                allOrderItemsOverride={isDeviceAuth ? deviceOrderValidationItems : undefined}
                skipOrderQueries={isDeviceAuth}
                deviceAuth={isDeviceAuth ? deviceAuth : null}
                hideFlavorCategory={kdsSettings.hideFlavorCategoryKds}
              />
            </div>
          ) : (
            <div className="flex-1">
              <SectorQueuePanel
                items={sectorItems}
                isEdgeSector={isEdgeSector}
                sectorName={activeSector?.name || 'Setor'}
                sectorColor={activeSector?.color || null}
                onlineCount={getOnlineCount(activeSectorId)}
                isLoading={itemsLoading}
                darkMode={isDark}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
