import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KdsSlaIndicator } from './KdsSlaIndicator';
import { KdsItemCounter } from './KdsItemCounter';
import { KdsItemBadges, getFlavorsFromExtras } from './KdsItemBadges';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { cn } from '@/lib/utils';
import { CheckCircle, Circle, Layers, Flame, ChefHat, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { filterPhantomItems } from './kdsItemFilter';
import { differenceInMinutes } from 'date-fns';
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

// Timer visual para tempo na estação
function StationTimer({ 
  startedAt, 
  createdAt,
  greenMinutes = 5,
  yellowMinutes = 10
}: { 
  startedAt?: string | null; 
  createdAt: string;
  greenMinutes?: number;
  yellowMinutes?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  
  const referenceTime = startedAt || createdAt;
  
  useEffect(() => {
    if (!referenceTime) return;
    
    const updateElapsed = () => {
      const minutes = differenceInMinutes(new Date(), new Date(referenceTime));
      setElapsed(Math.max(0, minutes));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [referenceTime]);
  
  const colorClass = elapsed < greenMinutes 
    ? 'text-green-600 bg-green-500/10' 
    : elapsed < yellowMinutes 
      ? 'text-yellow-600 bg-yellow-500/10' 
      : 'text-red-600 bg-red-500/10';
  
  return (
    <div className={cn("inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded", colorClass)}>
      <Clock className="h-3 w-3" />
      <span>{elapsed}min</span>
    </div>
  );
}

interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  notes: string | null;
  status: string;
  current_station_id?: string | null;
  station_status?: string;
  station_started_at?: string | null;
  created_at: string;
  fulfillment_type?: string | null;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number; kds_category?: string }>;
  added_by_profile?: { name: string } | null;
  sub_items?: Array<{ id: string; sub_item_index: number; notes: string | null; sub_extras?: Array<{ group_name: string; option_name: string; kds_category?: string }> }> | null;
}

// Combinar observações do item principal com observações dos sub_items
const getItemNotes = (item: OrderItem): string | null => {
  const mainNotes = item.notes;
  const subNotes = item.sub_items
    ?.filter(si => si.notes)
    .map(si => si.notes)
    .join('; ');
  
  if (mainNotes && subNotes) return `${mainNotes} | ${subNotes}`;
  return mainNotes || subNotes || null;
};

interface Order {
  id: string;
  customer_name: string | null;
  table?: { number: number } | null;
  order_type: string;
  notes: string | null;
  party_size?: number | null;
  created_at: string;
  updated_at: string;
  pager_number?: string | null;
}

interface KdsStationCardOverrideSettings {
  highlightSpecialBorders?: boolean;
  borderKeywords?: string[];
  showPartySize?: boolean;
  showWaiterName?: boolean;
}

interface KdsStationCardProps {
  order: Order;
  items: OrderItem[];
  stationColor: string;
  stationName: string;
  stationType: string;
  isFirstStation?: boolean;
  isLastStation?: boolean;
  onMoveToNext: (itemId: string, orderType: string) => void;
  onSkipItem?: (itemId: string) => void;
  isProcessing?: boolean;
  compact?: boolean;
  overrideSettings?: KdsStationCardOverrideSettings;
  totalOrderItems?: number;
  isPriority?: boolean;
  onOutOfOrderLog?: (itemId: string) => void;
}

const STATION_ICONS = {
  prep_start: Circle,
  item_assembly: Layers,
  assembly: ChefHat,
  oven_expedite: Flame,
  order_status: CheckCircle,
  custom: ChefHat,
};

const isFlavorSubExtra = (se: { kds_category?: string; group_name?: string }) =>
  se.kds_category === 'flavor' || (se.group_name && se.group_name.toLowerCase().includes('sabor'));

// Extrair sabores: primeiro tenta extras do item, depois sub_extras dos sub_items
const getFlavors = (item: OrderItem): string[] => {
  const mainFlavors = getFlavorsFromExtras(item.extras);
  if (mainFlavors.length > 0) return mainFlavors;
  
  if (item.sub_items && item.sub_items.length > 0) {
    const totalSubs = item.sub_items.length;
    const flavors: string[] = [];
    for (const si of item.sub_items) {
      const flavorExtra = (si.sub_extras || []).find(se => isFlavorSubExtra(se));
      if (flavorExtra) {
        flavors.push(totalSubs > 1 ? `1/${totalSubs} ${flavorExtra.option_name}` : flavorExtra.option_name);
      }
    }
    if (flavors.length > 0) return flavors;
  }
  
  return [];
};

// Extrair complementos (extras que não são sabor nem borda)
const getComplements = (item: OrderItem, detectedBorder?: string | null, extractedFlavors?: string[]): string[] => {
  const complements: string[] = [];
  item.extras?.filter(e => 
    e.kds_category !== 'flavor' && e.kds_category !== 'border'
  ).filter(e => {
    const l = e.extra_name.toLowerCase();
    return !l.includes('borda') && !l.includes('massa');
  }).forEach(e => {
    const parts = e.extra_name.split(':');
    const name = parts.length > 1 ? parts[1].trim() : e.extra_name;
    if (!detectedBorder || name.toLowerCase() !== detectedBorder.toLowerCase()) {
      complements.push(name);
    }
  });
  item.sub_items?.flatMap(si => si.sub_extras || [])
    .filter(se => !isFlavorSubExtra(se) && se.kds_category !== 'border')
    .forEach(se => {
      if (extractedFlavors && extractedFlavors.some(f => f.includes(se.option_name))) return;
      const parts = se.option_name.split(':');
      const name = parts.length > 1 ? parts[1].trim() : se.option_name;
      if (!detectedBorder || name.toLowerCase() !== detectedBorder.toLowerCase()) {
        complements.push(name);
      }
    });
  return complements;
};

export function KdsStationCard({
  order,
  items,
  stationColor,
  stationName,
  stationType,
  isFirstStation,
  isLastStation,
  onMoveToNext,
  onSkipItem,
  isProcessing,
  compact = false,
  overrideSettings,
  totalOrderItems,
  isPriority,
  onOutOfOrderLog,
}: KdsStationCardProps) {
  // Estado para debounce de cliques por item
  const [clickedItems, setClickedItems] = useState<Set<string>>(new Set());
  const clickTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Out-of-order confirmation
  const [outOfOrderItemId, setOutOfOrderItemId] = useState<string | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clickTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Handler otimizado com debounce visual
  const handleMoveToNext = useCallback((itemId: string) => {
    // Ignora se já foi clicado recentemente
    if (clickedItems.has(itemId)) return;
    
    // Marca como clicado imediatamente (feedback visual instantâneo)
    setClickedItems(prev => new Set(prev).add(itemId));
    
    // Chama a ação passando o order_type do pedido
    onMoveToNext(itemId, order.order_type);
    
    // Reset após 3000ms (tempo suficiente para a ação completar)
    const timeout = setTimeout(() => {
      setClickedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      clickTimeouts.current.delete(itemId);
    }, 3000);
    
    clickTimeouts.current.set(itemId, timeout);
  }, [clickedItems, onMoveToNext]);

  // Handle out-of-order move: log then proceed
  const handleOutOfOrderConfirm = useCallback(() => {
    if (!outOfOrderItemId) return;
    onOutOfOrderLog?.(outOfOrderItemId);
    handleMoveToNext(outOfOrderItemId);
    setOutOfOrderItemId(null);
  }, [outOfOrderItemId, onOutOfOrderLog, handleMoveToNext]);
  // Filtrar itens fantasma (sem produto mapeado e sem sabores)
  items = filterPhantomItems(items);
  
  const { hasSpecialBorder: hookHasSpecialBorder, settings: hookSettings } = useKdsSettings();
  
  // Use overrideSettings when provided (device-only mode bypasses RLS)
  const settings = overrideSettings ? { ...hookSettings, ...overrideSettings } : hookSettings;
  const hasSpecialBorder = useCallback((text: string) => {
    const keywords = overrideSettings?.borderKeywords ?? settings.borderKeywords;
    if (!keywords || keywords.length === 0) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
  }, [overrideSettings?.borderKeywords, settings.borderKeywords]);
  
  const StationIcon = STATION_ICONS[stationType as keyof typeof STATION_ICONS] || ChefHat;
  
  // Verificar se há borda especial
  const hasSpecialBorderInItems = items.some(item => {
    const itemText = `${item.product?.name || ''} ${item.notes || ''} ${item.extras?.map(e => e.extra_name).join(' ') || ''}`;
    return hasSpecialBorder(itemText);
  });

  // Exibir observações do pedido + quantidade de pessoas se configurado
  const displayOrderNotes = useMemo(() => {
    const partySizeText = settings.showPartySize && order.party_size 
      ? `${order.party_size} pessoas` 
      : null;
    
    if (partySizeText && order.notes) {
      return `${partySizeText} - ${order.notes}`;
    }
    return partySizeText || order.notes || null;
  }, [order.notes, order.party_size, settings.showPartySize]);

  // Obter o primeiro garçom dos itens para exibir no cabeçalho
  const waiterName = items.find(i => i.added_by_profile?.name)?.added_by_profile?.name;

  const getOrderOriginLabel = () => {
    if (order.order_type === 'delivery') return 'DELIVERY';
    if (order.order_type === 'takeaway') return 'BALCÃO';
    return `MESA ${order.table?.number || '?'}`;
  };

  // Check if any item in the order has takeaway fulfillment override
  const hasTakeawayItems = items.some(i => i.fulfillment_type === 'takeaway');

  // Renderização contextual de item baseada no tipo da estação
    const renderItemContent = (item: OrderItem) => {
    const flavors = getFlavors(item);
    const borderText = item.extras?.find(e => e.kds_category === 'border')?.extra_name 
      || item.extras?.find(e => { const l = e.extra_name.toLowerCase(); return l.includes('borda') || l.includes('massa'); })?.extra_name;
    const borderName = borderText ? (borderText.split(':').length > 1 ? borderText.split(':')[1].trim() : borderText) : null;
    const complements = getComplements(item, borderName, flavors);
    const itemNotes = getItemNotes(item);
    
    return (
      <div className="flex-1 min-w-0 space-y-1">
        {/* Badge RETIRADA para itens com fulfillment_type takeaway */}
        {item.fulfillment_type === 'takeaway' && (
          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white animate-pulse">
            🥡 RETIRADA
          </span>
        )}
        
        {/* Quantidade + Produto (texto menor, subtítulo) — ocultar se hideFlavorCategoryKds e tem sabores */}
        {!(settings.hideFlavorCategoryKds && flavors.length > 0) && (
          <p className="text-xs text-muted-foreground">
            {item.quantity}x {item.product?.name || 'Produto'}
            {item.variation?.name ? ` | ${item.variation.name}` : ''}
          </p>
        )}
        
        {/* SABORES em texto GRANDE e BOLD */}
        {flavors.length > 0 && (
          <div className={cn(
            "font-bold text-foreground",
            compact ? "text-3xl" : "text-5xl"
          )}>
            {flavors.map((f, i) => (
              <p key={i}>{f}</p>
            ))}
          </div>
        )}
        
        {/* Borda + Observações (badges piscantes) */}
        <KdsItemBadges notes={itemNotes} extras={item.extras} compact={compact} />
        
        {/* Complementos em texto normal */}
        {complements.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {complements.join(', ')}
          </p>
        )}
      </div>
    );
  };

  // Determine if items are waiting (for priority logic)
  const hasWaitingItems = items.some(i => i.station_status === 'waiting');

  return (
    <>
    <Card className={cn(
      "shadow-md transition-all",
      hasSpecialBorderInItems && "ring-2 ring-amber-500",
      isPriority && hasWaitingItems && "ring-2 ring-red-500",
      !isPriority && hasWaitingItems && isPriority === false && "opacity-70",
      compact && "shadow-sm"
    )}>
      <CardHeader 
        className={cn("pb-2 pt-3 px-4", compact && "pb-1 pt-2 px-3")}
        style={{ borderTop: `3px solid ${isPriority && hasWaitingItems ? '#ef4444' : stationColor}` }}
      >
        {/* Priority badge */}
        {hasWaitingItems && isPriority && (
          <Badge className="w-fit bg-red-600 text-white border-red-600 text-xs font-bold animate-pulse mb-1">
            🔴 FAZER AGORA
          </Badge>
        )}
        {hasWaitingItems && isPriority === false && (
          <Badge variant="outline" className="w-fit text-xs font-semibold text-muted-foreground border-muted-foreground/30 mb-1">
            ⏳ AGUARDANDO
          </Badge>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className={cn("h-7 w-7 rounded-full flex items-center justify-center", compact && "h-5 w-5")}
              style={{ backgroundColor: stationColor + '20' }}
            >
              <StationIcon className={cn("h-4 w-4", compact && "h-3 w-3")} style={{ color: stationColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("font-semibold text-sm", compact && "text-xs")}>{getOrderOriginLabel()}</span>
                {order.pager_number && order.order_type === 'takeaway' && (
                  <Badge className={cn(
                    "bg-amber-500 text-white border-amber-400 font-bold animate-pulse",
                    compact ? "text-[10px] px-1.5" : "text-xs px-2"
                  )}>
                    📟 #{order.pager_number}
                  </Badge>
                )}
                {settings.showWaiterName && waiterName && !compact && (
                  <span className="text-xs text-blue-600">👤 {waiterName}</span>
                )}
              </div>
              <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", compact && "hidden")}>
                <span className="font-mono">#{order.id.slice(-4).toUpperCase()}</span>
              </div>
            </div>
          </div>
          <KdsSlaIndicator createdAt={order.created_at} size={compact ? "sm" : "md"} showBackground />
        </div>
        
        {!compact && order.customer_name && (
          <p className="text-xs text-primary font-medium mt-1">{order.customer_name}</p>
        )}
        
        {!compact && <KdsItemCounter currentIndex={1} totalItems={totalOrderItems ?? items.length} />}
        {compact && (totalOrderItems ?? items.length) > 1 && (
          <span className="text-xs text-muted-foreground">Item de {totalOrderItems ?? items.length}</span>
        )}
      </CardHeader>
      
      <CardContent className={cn("px-4 pb-3 space-y-3", compact && "px-3 pb-2 space-y-2")}>
        {/* Itens */}
        <div className={cn("space-y-2", compact && "space-y-1")}>
          {(compact ? items.slice(0, 3) : items).map((item) => (
            <div 
              key={item.id} 
              className={cn(
                "p-2 bg-muted/50 rounded-lg border",
                compact && "p-1.5"
              )}
            >
              {renderItemContent(item)}
              
              {/* If not priority and waiting, show warning-styled button */}
              {isPriority === false && item.station_status === 'waiting' ? (
                <Button 
                  size={compact ? "sm" : "default"}
                  variant="outline"
                  onClick={() => setOutOfOrderItemId(item.id)}
                  disabled={clickedItems.has(item.id)}
                  className={cn(
                    "w-full mt-3 transition-all duration-150 border-amber-500/50 text-amber-600 hover:bg-amber-500/10", 
                    compact && "h-8 text-xs mt-2",
                  )}
                >
                  <AlertTriangle className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
                  {isLastStation ? 'Pronto' : 'Próximo'}
                </Button>
              ) : (
                <Button 
                  size={compact ? "sm" : "default"}
                  onClick={() => handleMoveToNext(item.id)}
                  disabled={clickedItems.has(item.id)}
                  className={cn(
                    "w-full mt-3 transition-all duration-150", 
                    compact && "h-8 text-xs mt-2",
                    clickedItems.has(item.id) && "opacity-50 scale-95"
                  )}
                  style={{ backgroundColor: stationColor }}
                >
                  {clickedItems.has(item.id) ? (
                    <>
                      <CheckCircle className={cn("h-4 w-4 mr-2 animate-pulse", compact && "h-3 w-3 mr-1")} />
                      Movendo...
                    </>
                  ) : isLastStation ? (
                    <>
                      <CheckCircle className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
                      Pronto
                    </>
                  ) : (
                    <>
                      <ArrowRight className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
                      Próximo
                    </>
                  )}
                </Button>
              )}
            </div>
          ))}
          {compact && items.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">+{items.length - 3} mais...</p>
          )}
        </div>
        
        {/* Observações do pedido */}
        {!compact && displayOrderNotes && (
          <div className="text-xs text-orange-600 bg-orange-500/10 rounded p-2">
            <strong>Obs pedido:</strong> {displayOrderNotes}
          </div>
        )}
      </CardContent>
    </Card>

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
          <AlertDialogAction onClick={handleOutOfOrderConfirm} className="bg-amber-600 hover:bg-amber-700">
            Continuar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}