import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useKdsWorkflow } from '@/hooks/useKdsWorkflow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UtensilsCrossed, CheckCheck, Timer, Check } from 'lucide-react';
import type { SectorOrderItem } from '@/hooks/useSectorOrderItems';

interface Props {
  items: SectorOrderItem[];
  stationId: string;
  stationColor: string | null;
  isLoading?: boolean;
  darkMode?: boolean;
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
  if (minutes < 5) return 'text-zinc-400';
  if (minutes < 10) return 'text-amber-500';
  return 'text-red-500';
}

const isFlavorSubExtra = (se: { kds_category: string; group_name?: string }) =>
  se.kds_category === 'flavor' || (se.group_name && se.group_name.toLowerCase().includes('sabor'));

function getFlavors(extras: SectorOrderItem['extras'], subItems?: SectorOrderItem['sub_items']): string[] {
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

function getBorder(extras: SectorOrderItem['extras'], subItems?: SectorOrderItem['sub_items']): string | null {
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

function getFlavorCountLabel(extras: SectorOrderItem['extras'], subItems?: SectorOrderItem['sub_items']): string | null {
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

function WaiterItemCard({
  item,
  stationId,
  stationColor,
  darkMode,
}: {
  item: SectorOrderItem;
  stationId: string;
  stationColor: string | null;
  darkMode?: boolean;
}) {
  const { serveFromWaiterStation } = useKdsWorkflow();

  const tableNumber = item.order?.table?.number ?? null;
  const displayId = item.order?.external_display_id ||
    (item.order?.display_number ? `#${item.order.display_number}` : `#${item.order?.id?.slice(-4).toUpperCase() || '????'}`);

  const flavors = getFlavors(item.extras, item.sub_items);
  const border = getBorder(item.extras, item.sub_items);
  const flavorCountLabel = getFlavorCountLabel(item.extras, item.sub_items);

  const readableText = darkMode ? 'text-white' : 'text-gray-900';
  const mutedText = darkMode ? 'text-zinc-400' : 'text-gray-500';

  return (
    <div className={cn(
      'rounded-xl border-2 p-4 flex flex-col gap-3 transition-all',
      darkMode ? 'bg-zinc-900 text-white' : 'bg-card text-card-foreground',
      'border-emerald-500',
    )}>
      {/* Status badge */}
      <Badge
        className="w-fit text-white text-xs font-bold"
        style={{ backgroundColor: stationColor || '#10B981' }}
      >
        <UtensilsCrossed className="h-3 w-3 mr-1" />
        SERVIR
      </Badge>

      {/* Header: ID + Mesa + badges + timer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('font-bold text-lg', readableText)}>{displayId}</span>
          {tableNumber !== null && (
            <Badge variant="outline" className="text-xs font-semibold bg-blue-500/20 text-blue-400 border-blue-500/40">
              Mesa {tableNumber}
            </Badge>
          )}
          {flavorCountLabel && (
            <Badge variant="outline" className="text-xs font-semibold bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
              {flavorCountLabel}
            </Badge>
          )}
        </div>
        <span className={cn('text-sm font-mono flex items-center gap-1 flex-shrink-0', getTimerColor(item.order?.created_at || item.created_at))}>
          <Timer className="h-3.5 w-3.5" />
          {getTimeSince(item.order?.created_at || item.created_at)}
        </span>
      </div>

      {/* Notas do pedido */}
      {item.order?.notes && (
        <p className="text-xs text-amber-400 font-medium uppercase">{item.order.notes}</p>
      )}

      {/* Nome do produto */}
      <p className={cn('text-xs', mutedText)}>
        {item.quantity}x {item.product?.name || 'Produto'}
        {item.variation?.name ? ` | ${item.variation.name}` : ''}
      </p>

      {/* Borda */}
      {border && (
        <div>
          <Badge className="bg-orange-600 text-white border-orange-600 text-xs font-bold animate-pulse">
            # # {border}
          </Badge>
        </div>
      )}

      {/* Sabores em destaque */}
      {flavors.length > 0 && (
        <div className={cn('text-4xl font-extrabold uppercase tracking-wide', readableText)}>
          {flavors.map((f, i) => (
            <p key={i}>{f}</p>
          ))}
        </div>
      )}

      {/* Observacoes do item */}
      {item.notes && (
        <span className="inline-flex items-center rounded px-3 py-1.5 text-sm font-bold animate-pulse bg-red-600 text-white">
          OBS: {item.notes}
        </span>
      )}

      {/* Botao Servir */}
      <Button
        className="w-full font-bold text-white gap-2 h-10 mt-1"
        style={{ backgroundColor: stationColor || '#10B981' }}
        disabled={serveFromWaiterStation.isPending}
        onClick={() => serveFromWaiterStation.mutate({ itemId: item.id, stationId })}
      >
        {serveFromWaiterStation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Servir — Mesa {tableNumber ?? '?'}
      </Button>
    </div>
  );
}

export function KdsWaiterServePanel({ items, stationId, stationColor, isLoading, darkMode }: Props) {
  const dineInItems = useMemo(
    () => items.filter(i => i.order?.order_type === 'dine_in'),
    [items]
  );

  const bg = darkMode ? 'bg-zinc-950' : 'bg-gray-50';
  const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
  const textMuted = darkMode ? 'text-zinc-400' : 'text-gray-500';

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', bg)}>
      <div
        className="px-4 py-3 flex items-center gap-3 border-b-[3px]"
        style={{ borderColor: stationColor || '#10B981' }}
      >
        <UtensilsCrossed className="h-5 w-5" style={{ color: stationColor || '#10B981' }} />
        <span className={cn('font-bold text-lg', textPrimary)}>Passa-prato — Aguardando servico</span>
        <Badge
          className="ml-auto text-white font-bold"
          style={{ backgroundColor: stationColor || '#10B981' }}
        >
          {dineInItems.length} {dineInItems.length === 1 ? 'item' : 'itens'}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className={cn('h-8 w-8 animate-spin', textMuted)} />
        </div>
      ) : dineInItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <CheckCheck className={cn('h-16 w-16', textMuted)} />
          <p className={cn('text-lg font-medium', textMuted)}>Nenhum pedido aguardando</p>
          <p className={cn('text-sm', textMuted)}>Tudo servido!</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-min">
          {dineInItems.map(item => (
            <WaiterItemCard
              key={item.id}
              item={item}
              stationId={stationId}
              stationColor={stationColor}
              darkMode={darkMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
