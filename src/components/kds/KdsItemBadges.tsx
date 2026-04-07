import { useKdsSettings } from '@/hooks/useKdsSettings';
import { getBadgeColorClasses } from '@/lib/badgeColors';
import { cn } from '@/lib/utils';

interface OrderItemExtra {
  extra_name: string;
  price?: number;
  kds_category?: string;
}

interface KdsItemBadgesProps {
  notes?: string | null;
  extras?: OrderItemExtra[];
  compact?: boolean;
}

// Extrair informação da borda dos extras usando kds_category
const getBorderInfo = (
  extras?: OrderItemExtra[],
  hasSpecialBorder?: (text: string) => boolean,
  highlightEnabled?: boolean
): { text: string; shouldHighlight: boolean } | null => {
  if (!extras || extras.length === 0) return null;
  
  // Primeiro tentar por kds_category
  const borderExtra = extras.find(e => e.kds_category === 'border');
  
  // Fallback: buscar por texto (compatibilidade com pedidos antigos)
  const fallbackBorderExtra = !borderExtra ? extras.find(e => {
    const lower = e.extra_name.toLowerCase();
    return lower.includes('borda') || lower.includes('massa');
  }) : null;
  
  const selectedExtra = borderExtra || fallbackBorderExtra;
  if (!selectedExtra) return null;
  
  // "Massa & Borda: Borda de Chocolate" → "Borda de Chocolate"
  const parts = selectedExtra.extra_name.split(':');
  const borderText = parts.length > 1 ? parts[1].trim() : selectedExtra.extra_name;
  
  // Se encontrou por kds_category, sempre destacar
  if (borderExtra) {
    return { text: borderText, shouldHighlight: true };
  }
  
  // Fallback: verificar por palavras-chave configuradas
  const shouldHighlight = highlightEnabled && hasSpecialBorder 
    ? hasSpecialBorder(borderText) 
    : false;
  
  return { text: borderText, shouldHighlight };
};

const isFlavorSubExtra = (se: { kds_category?: string; group_name?: string }) =>
  se.kds_category === 'flavor' || (se.group_name && se.group_name.toLowerCase().includes('sabor'));

// Extrair sabores dos extras usando kds_category, com fallback para sub_items
export const getFlavorsFromExtras = (
  extras?: OrderItemExtra[],
  subItems?: Array<{ id: string; sub_item_index: number; notes: string | null; sub_extras?: Array<{ group_name: string; option_name: string; kds_category?: string }> }> | null
): string[] => {
  // 1. Tentar extras diretos com kds_category === 'flavor'
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
      return groupName.includes('sabor') && !groupName.includes('borda') && !groupName.includes('massa');
    });
    if (textFlavors.length > 0) {
      return textFlavors.map(e => {
        const name = e.extra_name.split(':').slice(1).join(':').trim() || e.extra_name;
        return textFlavors.length > 1 ? `1/${textFlavors.length} ${name}` : name;
      });
    }
  }

  // 2. Tentar sub_items (pedidos de mesa/loja)
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
};

/**
 * Componente reutilizável para exibir tarjas de borda e observações
 * em itens de pedido. Exibe badges animados com cores configuráveis.
 */
export function KdsItemBadges({ notes, extras, compact = false }: KdsItemBadgesProps) {
  const { settings, hasSpecialBorder } = useKdsSettings();
  
  const borderInfo = getBorderInfo(extras, hasSpecialBorder, settings.highlightSpecialBorders);
  const borderColors = getBadgeColorClasses(settings.borderBadgeColor);
  const notesColors = getBadgeColorClasses(settings.notesBadgeColor);
  
  // Mostra borda se shouldHighlight for true
  const showBorder = borderInfo?.shouldHighlight;
  
  if (!showBorder && !notes) {
    return null;
  }
  
  const sizeClasses = compact 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <div className={cn("flex flex-col gap-1", compact ? "mt-0.5" : "mt-1")}>
      {showBorder && borderInfo && (
        <span className={cn(
          "inline-flex items-center rounded font-bold animate-pulse bg-orange-600 text-white",
          compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-sm"
        )}>
          🟡 {borderInfo.text}
        </span>
      )}
      
      {notes && (
        <span className={cn(
          "inline-flex items-center rounded font-bold animate-pulse bg-red-600 text-white",
          compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-sm"
        )}>
          ⚠️ OBS: {notes}
        </span>
      )}
    </div>
  );
}

/**
 * Exibe apenas o badge de borda (para uso em locais com espaço limitado)
 */
export function KdsBorderOnlyBadge({ extras, compact = false }: { extras?: OrderItemExtra[]; compact?: boolean }) {
  const { settings, hasSpecialBorder } = useKdsSettings();
  
  const borderInfo = getBorderInfo(extras, hasSpecialBorder, settings.highlightSpecialBorders);
  const borderColors = getBadgeColorClasses(settings.borderBadgeColor);
  
  if (!borderInfo?.shouldHighlight) {
    return null;
  }
  
  const sizeClasses = compact 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <span className={cn(
      "inline-flex items-center rounded font-bold animate-pulse bg-orange-600 text-white",
      compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-sm"
    )}>
      🟡 {borderInfo.text}
    </span>
  );
}

/**
 * Exibe apenas o badge de observações (para uso em locais com espaço limitado)
 */
export function KdsNotesOnlyBadge({ notes, compact = false }: { notes?: string | null; compact?: boolean }) {
  const { settings } = useKdsSettings();
  
  const notesColors = getBadgeColorClasses(settings.notesBadgeColor);
  
  if (!notes) {
    return null;
  }
  
  const sizeClasses = compact 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <span className={cn(
      "inline-flex items-center rounded font-bold animate-pulse bg-red-600 text-white",
      compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-sm"
    )}>
      ⚠️ OBS: {notes}
    </span>
  );
}

export { getBorderInfo };
