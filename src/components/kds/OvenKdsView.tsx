import { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, Clock, Check, Timer, History, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectorOrderItem, useOrderSiblingItems, useOrderAllItems } from '@/hooks/useSectorOrderItems';
import { useKdsActions } from '@/hooks/useKdsActions';
import { useKdsStations } from '@/hooks/useKdsStations';
import { KdsStationHistory } from '@/components/kds/KdsStationHistory';
import { useDispatchChecklist } from '@/hooks/useDispatchChecklist';
import { DispatchChecklistDialog } from '@/components/dispatch/DispatchChecklistDialog';

interface OvenKdsViewProps {
  ovenItems: SectorOrderItem[];
  isLoading: boolean;
  stationId: string;
  stationColor: string | null;
  tenantId?: string | null;
  darkMode?: boolean;
  siblingItemsOverride?: SectorOrderItem[];
  allOrderItemsOverride?: SectorOrderItem[];
  skipOrderQueries?: boolean;
  deviceAuth?: { deviceId: string; tenantId: string | null; authCode: string } | null;
  hideFlavorCategory?: boolean;
}

interface OrderOvenGroup {
  orderId: string;
  order: SectorOrderItem['order'];
  items: SectorOrderItem[];
}

function getTimeSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return '0:01';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
  return `0:${String(m).padStart(2, '0')}`;
}

function getTimerColor(dateStr: string): string {
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (minutes < 5) return 'text-muted-foreground';
  if (minutes < 10) return 'text-amber-500';
  return 'text-red-500';
}

function getOrderTypeBadge(orderType: string | undefined, tableNumber?: number | null) {
  switch (orderType) {
    case 'delivery':
      return { label: 'Delivery', className: 'bg-purple-500/20 text-purple-400 border-purple-500/40' };
    case 'takeaway':
      return { label: 'Retirada', className: 'bg-orange-500/20 text-orange-400 border-orange-500/40' };
    case 'dine_in':
      return { label: tableNumber ? `Mesa ${tableNumber}` : 'Mesa', className: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
    default:
      return { label: orderType || '', className: 'bg-muted text-muted-foreground' };
  }
}

const isFlavorSubExtra = (se: { kds_category: string; group_name?: string }) =>
  se.kds_category === 'flavor' || (se.group_name && se.group_name.toLowerCase().includes('sabor'));

function getFlavors(extras: Array<{ extra_name: string; kds_category: string }>, subItems?: SectorOrderItem['sub_items']): string[] {
  if (extras && extras.length > 0) {
    const flavorExtras = extras.filter(e => e.kds_category === 'flavor');
    if (flavorExtras.length > 0) {
      const total = flavorExtras.length;
      return flavorExtras.map(e => {
        const parts = e.extra_name.split(':');
        const name = parts.length > 1 ? parts[1].trim() : e.extra_name;
        return total > 1 ? `1/${total} ${name}` : name;
      });
    }
    // Fallback: detect flavors by group name containing "sabor"
    const textFlavors = extras.filter(e => {
      const groupName = e.extra_name.split(':')[0]?.toLowerCase() || '';
      return groupName.includes('sabor');
    });
    if (textFlavors.length > 0) {
      return textFlavors.map(e => {
        const name = e.extra_name.split(':').slice(1).join(':').trim() || e.extra_name;
        return textFlavors.length > 1 ? `1/${textFlavors.length} ${name}` : name;
      });
    }
  }
  if (subItems && subItems.length > 0) {
    const totalSubs = subItems.length;
    const flavors: string[] = [];
    for (const si of subItems) {
      const flavorExtra = (si.sub_extras || []).find(se => isFlavorSubExtra(se));
      if (flavorExtra) {
        flavors.push(totalSubs > 1 ? `1/${totalSubs} ${flavorExtra.option_name}` : flavorExtra.option_name);
      }
    }
    if (flavors.length > 0) return flavors;
  }
  return [];
}

function getBorder(extras: Array<{ extra_name: string; kds_category: string }>, subItems?: SectorOrderItem['sub_items']): string | null {
  if (extras) {
    const borderExtra = extras.find(e => e.kds_category === 'border')
      || extras.find(e => { const l = e.extra_name.toLowerCase(); return l.includes('borda') || l.includes('massa'); });
    if (borderExtra) {
      const parts = borderExtra.extra_name.split(':');
      return parts.length > 1 ? parts[1].trim() : borderExtra.extra_name;
    }
  }
  if (subItems && subItems.length > 0) {
    for (const si of subItems) {
      for (const se of si.sub_extras || []) {
        if (se.kds_category === 'border') return se.option_name;
      }
    }
  }
  return null;
}

function getComplements(extras: Array<{ extra_name: string; kds_category: string }>, subItems?: SectorOrderItem['sub_items'], detectedBorder?: string | null, extractedFlavors?: string[]): string[] {
  const result: string[] = [];
  if (extras) {
    result.push(...extras
      .filter(e => e.kds_category !== 'flavor' && e.kds_category !== 'border')
      .filter(e => {
        const l = e.extra_name.toLowerCase();
        return !l.includes('borda') && !l.includes('massa');
      })
      .map(e => { const p = e.extra_name.split(':'); return p.length > 1 ? p[1].trim() : e.extra_name; })
      .filter(name => !detectedBorder || name.toLowerCase() !== detectedBorder.toLowerCase()));
  }
  if (subItems && subItems.length > 0) {
    for (const si of subItems) {
      for (const se of si.sub_extras || []) {
        if (isFlavorSubExtra(se) || se.kds_category === 'border') continue;
        if (extractedFlavors && extractedFlavors.some(f => f.includes(se.option_name))) continue;
        if (!detectedBorder || se.option_name.toLowerCase() !== detectedBorder.toLowerCase()) {
          result.push(se.option_name);
        }
      }
    }
  }
  return result;
}

function getOvenProgress(item: SectorOrderItem): number {
  if (!item.oven_entry_at || !item.estimated_exit_at) return 0;
  const start = new Date(item.oven_entry_at).getTime();
  const end = new Date(item.estimated_exit_at).getTime();
  const now = Date.now();
  const total = end - start;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, ((now - start) / total) * 100));
}

function getTimeRemaining(item: SectorOrderItem): string {
  if (!item.estimated_exit_at) return '--:--';
  const diff = new Date(item.estimated_exit_at).getTime() - Date.now();
  if (diff <= 0) return '00:00';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isOverdue(item: SectorOrderItem): boolean {
  // No timer configured (oven_time_minutes = 0): PRONTO always enabled once item is in oven
  if (!item.estimated_exit_at) return !!item.oven_entry_at;
  return Date.now() > new Date(item.estimated_exit_at).getTime();
}

function hasReadyConfirmation(item: SectorOrderItem): boolean {
  return item.station_status === 'ready';
}

function getFlavorCountLabel(extras?: SectorOrderItem['extras'], subItems?: SectorOrderItem['sub_items']): string | null {
  if (extras && extras.length > 0) {
    const flavorCount = extras.filter(e => e.kds_category === 'flavor').length;
    if (flavorCount > 0) return flavorCount === 1 ? '1 SABOR' : `${flavorCount} SABORES`;
  }
  if (subItems && subItems.length > 0) {
    const count = subItems.length;
    return count === 1 ? '1 SABOR' : `${count} SABORES`;
  }
  return null;
}

/** Timer-only subcomponent — re-renders every 1s without touching parent */
function OvenTimerDisplay({ item }: { item: SectorOrderItem }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const overdue = isOverdue(item);
  const progress = getOvenProgress(item);
  const remaining = getTimeRemaining(item);

  return (
    <div className={cn(
      "p-2 rounded-lg border",
      overdue ? "bg-emerald-900/30 border-emerald-500/40" : "bg-orange-950/40 border-orange-500/30"
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-400 flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> Forno
        </span>
        <span className={cn(
          "font-mono text-sm font-bold",
          overdue ? "text-emerald-400" : "text-orange-400"
        )}>
          <Clock className="h-3.5 w-3.5 inline mr-1" />
          {overdue ? 'PRONTO!' : remaining}
        </span>
      </div>
      <Progress value={progress} className={cn("h-2 bg-zinc-700", overdue && "[&>div]:bg-emerald-500")} />
    </div>
  );
}

/** Simplified item card — no order header, just product + timer + PRONTO */
const OvenItemCard = memo(function OvenItemCard({ item, onMarkReady, isMarkReadyPending, hideFlavorCategory }: { item: SectorOrderItem; onMarkReady: (params: { itemId: string; currentStationId?: string | null }) => void; isMarkReadyPending: boolean; hideFlavorCategory?: boolean }) {
  const flavors = getFlavors(item.extras, item.sub_items);
  const border = getBorder(item.extras, item.sub_items);
  const complements = getComplements(item.extras, item.sub_items, border, flavors);
  const isReady = item.station_status === 'ready';
  const flavorCountLabel = getFlavorCountLabel(item.extras, item.sub_items);
  const orderType = getOrderTypeBadge(item.order?.order_type, (item.order as any)?.table?.number);

  // Re-render periodically so the PRONTO button activates when timer expires
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isReady || !item.estimated_exit_at) return;
    const interval = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(interval);
  }, [isReady, item.estimated_exit_at]);

  const overdue = isOverdue(item);

  return (
    <div className={cn(
      "rounded-lg border-2 p-3 flex flex-col gap-2 transition-all",
      isReady
        ? "border-emerald-500/60 bg-emerald-950/30"
        : "border-orange-500 bg-zinc-900",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={cn("text-xs font-semibold", orderType.className)}>
              {orderType.label}
            </Badge>
            {flavorCountLabel && (
              <Badge className="bg-emerald-600 text-white border-emerald-600 text-[10px] font-bold">
                {flavorCountLabel}
              </Badge>
            )}
          </div>
          {!(hideFlavorCategory && flavors.length > 0) && (
            <p className="text-sm text-zinc-400">{item.product?.name || 'Produto'}</p>
          )}
          {flavors.length > 0 ? (
            flavors.map((f, i) => (
              <p key={i} className="text-3xl font-black text-white">
                {f}{item.variation?.name ? ` (${item.variation.name})` : ''}
              </p>
            ))
          ) : (
            <p className="text-lg font-black text-white">
              {item.quantity}x {item.product?.name || 'Produto'}
              {item.variation?.name ? ` (${item.variation.name})` : ''}
            </p>
          )}
        </div>

        <div className="shrink-0 pt-1">
          {isReady ? (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold gap-1.5 pointer-events-none"
            >
              <Check className="h-4 w-4" /> PRONTO
            </Button>
          ) : (
            <Button
              size="sm"
              className={cn(
                "font-bold gap-1.5",
                overdue
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
              )}
              disabled={!overdue || isMarkReadyPending}
              onClick={() => onMarkReady({ itemId: item.id, currentStationId: item.current_station_id })}
            >
              <Check className="h-4 w-4" /> PRONTO
            </Button>
          )}
        </div>
      </div>

      {border && (
        <Badge className="bg-orange-600 text-white border-orange-600 text-xs font-bold w-fit">
          # {border}
        </Badge>
      )}

      {item.fulfillment_type === 'takeaway' && (
        <Badge className="bg-orange-500 text-white border-orange-500 text-[10px] font-bold w-fit animate-pulse">
          🥡 RETIRADA
        </Badge>
      )}

      {complements.length > 0 && (
        <p className="text-xs text-zinc-400">{complements.join(', ')}</p>
      )}

      {item.notes && (
        <span className="inline-flex items-center rounded px-3 py-1.5 text-sm font-bold animate-pulse bg-red-600 text-white">
          ⚠️ OBS: {item.notes}
        </span>
      )}

      {/* Oven timer — only when timer is configured (estimated_exit_at set) */}
      {!isReady && !!item.estimated_exit_at && <OvenTimerDisplay item={item} />}
    </div>
  );
});

/** Pending sibling card — opaque with waiting animation */
const PendingSiblingCard = memo(function PendingSiblingCard({ item }: { item: SectorOrderItem }) {
  const flavorCountLabel = getFlavorCountLabel(item.extras, item.sub_items);
  const flavors = getFlavors(item.extras || [], item.sub_items);
  const border = getBorder(item.extras || [], item.sub_items);
  const complements = getComplements(item.extras || [], item.sub_items, border, flavors);
  const orderType = getOrderTypeBadge(item.order?.order_type, (item.order as any)?.table?.number);

  return (
    <div className="rounded-lg border-2 border-dashed border-orange-500/30 bg-zinc-900/50 p-3 flex flex-col gap-2 opacity-50">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] font-semibold border-zinc-600 text-zinc-400", orderType.className)}>
            {orderType.label || 'Em produção'}
          </Badge>
          {flavorCountLabel && (
            <Badge className="bg-emerald-600/40 text-emerald-300 border-emerald-600/40 text-[10px] font-bold">
              {flavorCountLabel}
            </Badge>
          )}
        </div>
        <p className="text-sm text-zinc-500">{item.product?.name || 'Produto'}</p>
        {flavors.length > 0 ? (
          flavors.map((f, i) => (
            <p key={i} className="text-lg font-black text-zinc-400">
              {f}{item.variation?.name ? ` (${item.variation.name})` : ''}
            </p>
          ))
        ) : (
          <p className="text-lg font-black text-zinc-400">
            {item.quantity}x {item.product?.name || 'Produto'}
            {item.variation?.name ? ` (${item.variation.name})` : ''}
          </p>
        )}
      </div>

      {border && (
        <Badge className="bg-orange-600/40 text-orange-300 border-orange-600/40 text-xs font-bold w-fit">
          # {border}
        </Badge>
      )}

      {item.fulfillment_type === 'takeaway' && (
        <Badge className="bg-orange-500/40 text-orange-300 border-orange-500/40 text-[10px] font-bold w-fit">
          🥡 RETIRADA
        </Badge>
      )}

      {complements.length > 0 && (
        <p className="text-xs text-zinc-500">{complements.join(', ')}</p>
      )}

      {item.notes && (
        <span className="inline-flex items-center rounded px-3 py-1.5 text-sm font-bold animate-pulse bg-red-600/70 text-white">
          ⚠️ OBS: {item.notes}
        </span>
      )}

      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Aguardando...</span>
      </div>
    </div>
  );
});

/** Order group container with shared header + DESPACHAR */
interface OrderGroupCardProps {
  group: OrderOvenGroup;
  siblings: SectorOrderItem[];
  allOrderItems: SectorOrderItem[];
  allItemsLoading?: boolean;
  onMarkReady: (params: { itemId: string; currentStationId?: string | null }) => void;
  isMarkReadyPending: boolean;
  onDispatch: (itemIds: string[]) => void;
  isDispatchPending: boolean;
  hideFlavorCategory?: boolean;
}

const OrderGroupCard = memo(function OrderGroupCard({ group, siblings, allOrderItems, allItemsLoading, onMarkReady, isMarkReadyPending, onDispatch, isDispatchPending, hideFlavorCategory }: OrderGroupCardProps) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const checklist = useDispatchChecklist(group.orderId);
  const orderType = getOrderTypeBadge(group.order?.order_type, (group.order as any)?.table?.number);
  const displayId = group.order?.external_display_id || `#${group.orderId.slice(-4).toUpperCase()}`;
  
  // Use ALL order items to determine dispatch readiness
  const totalItems = allOrderItems.length;
  const completedStatuses = new Set(['ready', 'dispatched', 'done']);
  const readyCount = allOrderItems.filter((i) => completedStatuses.has(i.station_status || '')).length;
  const orderReady = group.order?.status === 'ready';
  const effectiveReadyCount = orderReady && totalItems > 0 ? totalItems : readyCount;
  const canDispatch = totalItems > 0 && (orderReady || readyCount === totalItems) && !allItemsLoading;

  return (
    <>
    <div className={cn(
      "rounded-xl border-2 overflow-hidden border-orange-500/60 bg-zinc-900 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]",
    )}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-orange-500/30 bg-orange-950/20">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-lg text-white">{displayId}</span>
          <Badge variant="outline" className={cn("text-xs font-semibold", orderType.className)}>
            {orderType.label}
          </Badge>
          {group.order?.customer_name && (
            <span className="text-sm text-zinc-400">{group.order.customer_name}</span>
          )}
          <GroupTimer dateStr={group.order?.created_at || group.items[0]?.created_at} />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-300">
            {effectiveReadyCount}/{totalItems} prontos
          </Badge>
          <Button
            size="sm"
            className={cn(
              "font-bold gap-1.5",
              canDispatch
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-zinc-700 text-zinc-400 opacity-50 cursor-not-allowed"
            )}
            disabled={!canDispatch || isDispatchPending}
            onClick={() => {
              if (canDispatch && checklist.length > 0) {
                setChecklistOpen(true);
              } else if (canDispatch) {
                onDispatch(group.items.map(i => i.id));
              }
            }}
          >
            {allItemsLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</>
            ) : !canDispatch ? (
              <><Package className="h-4 w-4" /> Aguardando {effectiveReadyCount}/{totalItems}</>
            ) : (
              <><Package className="h-4 w-4" /> DESPACHAR</>
            )}
          </Button>
        </div>
      </div>

      {group.order?.notes && (
        <p className="text-xs text-amber-400 font-medium uppercase px-4 pt-2">{group.order.notes}</p>
      )}

      <div className="p-4 flex flex-col gap-4">
        {group.items.map(item => (
          <OvenItemCard
            key={item.id}
            item={item}
            onMarkReady={onMarkReady}
            isMarkReadyPending={isMarkReadyPending}
            hideFlavorCategory={hideFlavorCategory}
          />
        ))}
        {siblings.map(sibling => (
          <PendingSiblingCard key={sibling.id} item={sibling} />
        ))}
      </div>
    </div>
    <DispatchChecklistDialog
      open={checklistOpen}
      onOpenChange={setChecklistOpen}
      checklist={checklist}
      orderLabel={`Pedido ${displayId}`}
      onConfirm={() => { onDispatch(group.items.map(i => i.id)); setChecklistOpen(false); }}
      isProcessing={isDispatchPending}
    />
    </>
  );
});

/** Timer in group header — re-renders every 30s, isolated */
function GroupTimer({ dateStr }: { dateStr: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={cn('text-sm font-mono flex items-center gap-1', getTimerColor(dateStr))}>
      <Timer className="h-3.5 w-3.5" />
      {getTimeSince(dateStr)}
    </span>
  );
}

export function OvenKdsView({
  ovenItems,
  isLoading,
  stationId,
  stationColor,
  tenantId,
  darkMode = true,
  siblingItemsOverride,
  allOrderItemsOverride,
  skipOrderQueries = false,
  deviceAuth,
  hideFlavorCategory,
}: OvenKdsViewProps) {
  const { markReady, dispatchOvenItems } = useKdsActions();
  const { waiterServeStation } = useKdsStations();
  const safeOvenItems = Array.isArray(ovenItems) ? ovenItems : [];

  // Local state for INSTANT visual transitions — immune to cache refetches
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());

  // Cleanup: remove ids confirmed by server
  useEffect(() => {
    const currentIds = new Set(safeOvenItems.map(i => i.id));
    setDispatchedIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => { if (currentIds.has(id)) next.add(id); });
      return next.size !== prev.size ? next : prev;
    });
    setReadyIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        const item = safeOvenItems.find(i => i.id === id);
        if (item && item.station_status !== 'ready' && !item.ready_at) next.add(id);
      });
      return next.size !== prev.size ? next : prev;
    });
  }, [safeOvenItems]);

  // Apply local overrides: filter dispatched, override ready status
  const visibleItems = useMemo(() => {
    return safeOvenItems
      .filter(i => !dispatchedIds.has(i.id))
      .map(i => readyIds.has(i.id)
        ? { ...i, station_status: 'ready', ready_at: i.ready_at || new Date().toISOString(), status: 'ready' }
        : i
      );
  }, [safeOvenItems, dispatchedIds, readyIds]);

  const groups: OrderOvenGroup[] = useMemo(() => {
    const map = new Map<string, OrderOvenGroup>();
    for (const item of visibleItems) {
      if (!map.has(item.order_id)) {
        map.set(item.order_id, { orderId: item.order_id, order: item.order, items: [] });
      }
      map.get(item.order_id)!.items.push(item);
    }
    return Array.from(map.values());
  }, [visibleItems]);

  const orderIds = useMemo(() => groups.map(g => g.orderId), [groups]);
  const siblingQuery = useOrderSiblingItems(skipOrderQueries ? [] : orderIds, tenantId);
  const allItemsQuery = useOrderAllItems(skipOrderQueries ? [] : orderIds, tenantId);

  const siblingItems = siblingItemsOverride ?? siblingQuery.data ?? [];
  const allOrderItems = allOrderItemsOverride ?? allItemsQuery.data ?? [];
  const allItemsLoading = skipOrderQueries ? false : allItemsQuery.isLoading;

  const handleMarkReady = useCallback((params: { itemId: string; currentStationId?: string | null }) => {
    setReadyIds(prev => new Set(prev).add(params.itemId));
    markReady.mutate(params, {
      onError: () => setReadyIds(prev => { const n = new Set(prev); n.delete(params.itemId); return n; }),
    });
  }, [markReady]);

  const handleDispatch = useCallback((ids: string[]) => {
    setDispatchedIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    dispatchOvenItems.mutate({ itemIds: ids, waiterServeStationId: waiterServeStation?.id ?? null }, {
      onError: () => setDispatchedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; }),
    });
  }, [dispatchOvenItems, waiterServeStation]);

  return (
    <div className={cn("flex flex-col h-full", darkMode ? "bg-zinc-950 text-white" : "bg-background text-foreground")}>
      <Tabs defaultValue="forno" className="flex flex-col h-full">
        <div className={cn("flex items-center justify-between px-4 py-2 border-b shrink-0", darkMode ? "border-zinc-800" : "border-border")}>
          <TabsList className={darkMode ? "bg-zinc-800/80" : ""}>
            <TabsTrigger value="forno" className={cn("gap-1.5", darkMode && "data-[state=active]:bg-orange-600 data-[state=active]:text-white text-zinc-300")}>
              <Flame className="h-4 w-4" />
              Forno
              <Badge className={cn("ml-1 text-xs h-5 px-1.5 border-0", darkMode ? "bg-zinc-700 text-zinc-200" : "bg-muted text-muted-foreground")}>{visibleItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="historico" className={cn("gap-1.5", darkMode && "data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400")}>
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="forno" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {isLoading && visibleItems.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={cn("h-8 w-8 animate-spin", darkMode ? "text-zinc-500" : "text-muted-foreground")} />
                </div>
              ) : visibleItems.length === 0 ? (
                <div className={cn("flex flex-col items-center justify-center py-16", darkMode ? "text-zinc-500" : "text-muted-foreground")}>
                  <Flame className="h-16 w-16 mb-4 opacity-20" />
                  <p className="text-lg">Nenhum item no forno</p>
                </div>
              ) : (
                groups.map(group => {
                  // Apply local readyIds override to allOrderItems for this group
                  const groupAllItems = allOrderItems
                    .filter(i => i.order_id === group.orderId)
                    .map(i => readyIds.has(i.id) ? { ...i, station_status: 'ready' } : i);
                  return (
                    <OrderGroupCard
                      key={group.orderId}
                      group={group}
                       siblings={siblingItems.filter(s => s.order_id === group.orderId)}
                      allOrderItems={groupAllItems}
                      allItemsLoading={allItemsLoading}
                      onMarkReady={handleMarkReady}
                      isMarkReadyPending={false}
                      onDispatch={handleDispatch}
                      isDispatchPending={false}
                      hideFlavorCategory={hideFlavorCategory}
                    />
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="historico" className="flex-1 mt-0 overflow-hidden p-4">
          <KdsStationHistory stationId={stationId} stationColor={stationColor || ''} tenantId={tenantId} deviceAuth={deviceAuth} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
