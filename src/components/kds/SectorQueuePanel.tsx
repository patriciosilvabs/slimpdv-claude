import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Flame, ChefHat, Timer, Users, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectorOrderItem } from '@/hooks/useSectorOrderItems';
import { useKdsActions } from '@/hooks/useKdsActions';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SectorQueuePanelProps {
  items: SectorOrderItem[];
  isEdgeSector: boolean;
  sectorName: string;
  sectorColor: string | null;
  onlineCount: number;
  isLoading: boolean;
  darkMode?: boolean;
}

interface SectorItemCardProps {
  item: SectorOrderItem;
  isEdgeSector: boolean;
  darkMode?: boolean;
  isPriority?: boolean;
  onClaim: (itemId: string) => void;
  onSendToOven: (itemId: string) => void;
  onCompleteEdge: (itemId: string, stationId: string | null) => void;
  onOutOfOrderClaim: (itemId: string) => void;
}

function getTimeSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return '0:01';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
  return `0:${String(m).padStart(2, '0')}`;
}

function getReadableTextClass(darkMode?: boolean, muted = false): string {
  if (!darkMode) {
    return muted ? 'text-muted-foreground' : 'text-foreground';
  }

  return muted ? 'text-inherit opacity-70' : 'text-inherit';
}

function getTimerColor(dateStr: string, darkMode?: boolean): string {
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (minutes < 5) return darkMode ? 'text-inherit opacity-70' : 'text-muted-foreground';
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

const SectorItemCard = memo(function SectorItemCard({ item, isEdgeSector, darkMode, isPriority, onClaim, onSendToOven, onCompleteEdge, onOutOfOrderClaim }: SectorItemCardProps) {
  const tableNumber = (item.order as any)?.table?.number ?? null;
  const orderType = getOrderTypeBadge(item.order?.order_type, tableNumber);
  const displayId = item.order?.external_display_id ||
    (item.order?.display_number ? `#${item.order.display_number}` : `#${item.order?.id?.slice(-4).toUpperCase() || '????'}`);
  const flavors = getFlavors(item.extras, item.sub_items);
  const border = getBorder(item.extras, item.sub_items);
  const complements = getComplements(item.extras, item.sub_items, border, flavors);
  const flavorCountLabel = getFlavorCountLabel(item.extras, item.sub_items);
  const isWaiting = item.station_status === 'waiting';
  const isInProgress = item.station_status === 'in_progress';
  const readableTextClass = getReadableTextClass(darkMode);
  const mutedTextClass = getReadableTextClass(darkMode, true);

  return (
    <div className={cn(
      'rounded-xl border-2 p-4 flex flex-col gap-3 transition-all',
      darkMode ? 'bg-zinc-900 text-white' : 'bg-card text-card-foreground',
      isInProgress
        ? darkMode ? 'border-blue-500/60' : 'border-blue-500/50'
        : isPriority && isWaiting
          ? 'border-red-500 ring-2 ring-red-500/30'
          : isWaiting && !isPriority
            ? darkMode ? 'border-zinc-700 opacity-70' : 'border-border opacity-70'
            : darkMode ? 'border-zinc-700' : 'border-border',
    )}>
      {/* Priority / Waiting badge */}
      {isWaiting && isPriority && (
        <Badge className="w-fit bg-red-600 text-white border-red-600 text-xs font-bold animate-pulse">
          🔴 FAZER AGORA
        </Badge>
      )}
      {isWaiting && !isPriority && (
        <Badge variant="outline" className="w-fit text-xs font-semibold text-muted-foreground border-muted-foreground/30">
          ⏳ AGUARDANDO
        </Badge>
      )}

      {/* Header: Order ID + Badge + Timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('font-bold text-lg', readableTextClass)}>
            {displayId}
          </span>
          <Badge variant="outline" className={cn('text-xs font-semibold', orderType.className)}>
            {orderType.label}
          </Badge>
          {flavorCountLabel && (
            <Badge variant="outline" className="text-xs font-semibold bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
              {flavorCountLabel}
            </Badge>
          )}
        </div>
        <span className={cn('text-sm font-mono flex items-center gap-1', getTimerColor(item.order?.created_at || item.created_at, darkMode))}>
          <Timer className="h-3.5 w-3.5" />
          {getTimeSince(item.order?.created_at || item.created_at)}
        </span>
      </div>

      {/* Notes do pedido */}
      {item.order?.notes && (
        <p className="text-xs text-amber-400 font-medium uppercase">{item.order.notes}</p>
      )}

      {/* Product name */}
      <p className={cn('text-xs', mutedTextClass)}>
        {item.quantity}x {item.product?.name || 'Produto'}
        {item.variation?.name ? ` | ${item.variation.name}` : ''}
      </p>

      {/* Fulfillment type badge */}
      {(item as any).fulfillment_type === 'takeaway' && (
        <span className="inline-block text-xs font-bold px-2 py-1 rounded bg-orange-500 text-white animate-pulse w-fit">
          🥡 RETIRADA
        </span>
      )}

      {/* Border badge */}
      {border && (
        <div>
          <Badge className="bg-orange-600 text-white border-orange-600 text-xs font-bold animate-pulse">
            # # {border}
          </Badge>
        </div>
      )}

      {/* Flavors - prominent display */}
      {flavors.length > 0 && (
        <div className={cn('text-4xl font-extrabold uppercase tracking-wide', readableTextClass)}>
          {flavors.map((f, i) => (
            <p key={i}>{f}</p>
          ))}
        </div>
      )}

      {/* Complements */}
      {complements.length > 0 && (
        <p className={cn('text-xs', mutedTextClass)}>{complements.join(', ')}</p>
      )}

      {/* Item notes */}
      {item.notes && (
        <span className="inline-flex items-center rounded px-3 py-1.5 text-sm font-bold animate-pulse bg-red-600 text-white">
          ⚠️ OBS: {item.notes}
        </span>
      )}

      {/* Customer + order type info */}
      <div className={cn('text-xs space-y-0.5', mutedTextClass)}>
        {(item.order?.order_type === 'takeaway' || item.order?.order_type === 'delivery') && item.order?.customer_name && (
          <p className="font-semibold text-sm">{item.order.customer_name}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-1">
        {isWaiting && isPriority && (
          <Button
            className="flex-1 h-11 text-base font-bold gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={() => onClaim(item.id)}
          >
            <Play className="h-4 w-4" /> INICIAR
          </Button>
        )}
        {isWaiting && !isPriority && (
          <Button
            variant="outline"
            className="flex-1 h-11 text-base font-bold gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
            onClick={() => onOutOfOrderClaim(item.id)}
          >
            <AlertTriangle className="h-4 w-4" /> INICIAR
          </Button>
        )}
        {isInProgress && !isEdgeSector && (
          <Button
            className="flex-1 h-11 text-base font-bold gap-2 bg-orange-500 hover:bg-orange-600"
            onClick={() => onSendToOven(item.id)}
          >
            <Flame className="h-4 w-4" /> FORNO
          </Button>
        )}
        {isInProgress && isEdgeSector && (
          <Button
            className="flex-1 h-11 text-base font-bold gap-2 bg-orange-500 hover:bg-orange-600"
            onClick={() => onCompleteEdge(item.id, item.current_station_id)}
          >
            <ChefHat className="h-4 w-4" /> MONTAGEM
          </Button>
        )}
        {(isWaiting || isInProgress) && (
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 border-destructive/50 text-destructive hover:bg-destructive/10 shrink-0"
          >
            <XCircle className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
});

export function SectorQueuePanel({ items, isEdgeSector, sectorName, sectorColor, onlineCount, isLoading, darkMode }: SectorQueuePanelProps) {
  const [, setTick] = useState(0);
  const { claimItem, sendToOven, completeEdge } = useKdsActions();

  // Local state for INSTANT visual transitions — immune to cache refetches
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  // Out-of-order confirmation dialog
  const [outOfOrderItemId, setOutOfOrderItemId] = useState<string | null>(null);

  const safeItems = Array.isArray(items) ? items : [];

  // Cleanup: remove ids that are no longer present (server confirmed) or whose status already changed
  useEffect(() => {
    const currentIds = new Set(safeItems.map(i => i.id));
    setDismissedIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => { if (currentIds.has(id)) next.add(id); });
      return next.size !== prev.size ? next : prev;
    });
    setClaimedIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        const item = safeItems.find(i => i.id === id);
        if (item && item.station_status === 'waiting') next.add(id);
      });
      return next.size !== prev.size ? next : prev;
    });
  }, [safeItems]);

  // Stable callbacks — set local state FIRST (instant), then call mutate
  const handleClaim = useCallback((itemId: string) => {
    setClaimedIds(prev => new Set(prev).add(itemId));
    claimItem.mutate(itemId, {
      onError: () => setClaimedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; }),
    });
  }, [claimItem]);

  const handleSendToOven = useCallback((itemId: string) => {
    setDismissedIds(prev => new Set(prev).add(itemId));
    sendToOven.mutate({ itemId }, {
      onError: () => setDismissedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; }),
    });
  }, [sendToOven]);

  const handleCompleteEdge = useCallback((itemId: string, stationId: string | null) => {
    setDismissedIds(prev => new Set(prev).add(itemId));
    completeEdge.mutate({ itemId, currentStationId: stationId }, {
      onError: () => setDismissedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; }),
    });
  }, [completeEdge]);

  // Apply local overrides: filter dismissed, override claimed status
  const visibleItems = useMemo(() => {
    return safeItems
      .filter(i => !dismissedIds.has(i.id))
      .map(i => claimedIds.has(i.id)
        ? { ...i, station_status: 'in_progress', claimed_by: 'local', claimed_at: new Date().toISOString(), station_started_at: new Date().toISOString() }
        : i
      );
  }, [safeItems, dismissedIds, claimedIds]);

  // Determine priority item: oldest waiting item by created_at
  const priorityItemId = useMemo(() => {
    const waitingItems = visibleItems
      .filter(i => i.station_status === 'waiting')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return waitingItems.length > 0 ? waitingItems[0].id : null;
  }, [visibleItems]);

  // Out-of-order claim handler: show confirmation
  const handleOutOfOrderClaim = useCallback((itemId: string) => {
    setOutOfOrderItemId(itemId);
  }, []);

  // Confirm out-of-order: log + claim
  const confirmOutOfOrder = useCallback(() => {
    if (!outOfOrderItemId) return;
    const item = visibleItems.find(i => i.id === outOfOrderItemId);
    // Fire-and-forget log
    if (item?.current_station_id) {
      supabase.from('kds_station_logs').insert({
        order_item_id: outOfOrderItemId,
        station_id: item.current_station_id,
        action: 'out_of_order',
        notes: `Item iniciado fora da ordem FIFO`,
      }).then(() => {});
    }
    handleClaim(outOfOrderItemId);
    setOutOfOrderItemId(null);
  }, [outOfOrderItemId, visibleItems, handleClaim]);

  // Atualizar timers a cada 30s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const waitingCount = visibleItems.filter(i => i.station_status === 'waiting').length;
  const inProgressCount = visibleItems.filter(i => i.station_status === 'in_progress').length;
  const mutedTextClass = getReadableTextClass(darkMode, true);

  return (
    <div className={cn('flex flex-col h-full', darkMode && 'bg-zinc-950 text-white')}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3 border-b', darkMode ? 'border-zinc-800' : 'border-border')}>
        <div className="flex items-center gap-3">
          <h2
            className={cn('font-bold text-lg', getReadableTextClass(darkMode))}
            style={{ borderLeftColor: sectorColor || undefined, borderLeftWidth: sectorColor ? 4 : 0, paddingLeft: sectorColor ? 8 : 0 }}
          >
            {sectorName}
          </h2>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Users className="h-3 w-3" />
            {onlineCount} online
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {waitingCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {waitingCount} fila
            </Badge>
          )}
          {inProgressCount > 0 && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
              {inProgressCount} em prep.
            </Badge>
          )}
        </div>
      </div>

      {/* Cards grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading && visibleItems.length === 0 ? (
            <div className={cn('text-center py-8', mutedTextClass)}>Carregando...</div>
          ) : visibleItems.length === 0 ? (
            <div className={cn('text-center py-12', mutedTextClass)}>
              <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum item na fila</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {visibleItems.map(item => (
                <SectorItemCard
                  key={item.id}
                  item={item}
                  isEdgeSector={isEdgeSector}
                  darkMode={darkMode}
                  isPriority={item.id === priorityItemId}
                  onClaim={handleClaim}
                  onSendToOven={handleSendToOven}
                  onCompleteEdge={handleCompleteEdge}
                  onOutOfOrderClaim={handleOutOfOrderClaim}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Out-of-order confirmation dialog */}
      <AlertDialog open={!!outOfOrderItemId} onOpenChange={(open) => { if (!open) setOutOfOrderItemId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Item fora da ordem
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está iniciando um item fora da ordem de chegada. O item prioritário ainda está aguardando. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOutOfOrder} className="bg-amber-600 hover:bg-amber-700">
              Continuar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
