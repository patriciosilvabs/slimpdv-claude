import type { SubItemComplement } from '@/components/order/ProductDetailDialog';

/**
 * Converts pizza sub-items (individual pizza units with their flavors)
 * into a flat array of strings suitable for the `extras` field in print data.
 */
export function flattenSubItemsToExtras(subItems?: SubItemComplement[]): string[] {
  if (!subItems || subItems.length === 0) return [];
  const result: string[] = [];
  const total = subItems.length;
  const fractionPrefix = total > 1 ? `1/${total} ` : '';
  for (const si of subItems) {
    result.push(`🍕 PIZZA ${si.sub_item_index}:`);
    for (const c of si.complements) {
      const qtyPrefix = c.quantity > 1 ? `${c.quantity}x ` : '';
      result.push(`  ${fractionPrefix}${qtyPrefix}${c.option_name}`);
    }
    if (si.sub_item_notes) {
      result.push(`  OBS: ${si.sub_item_notes}`);
    }
  }
  return result;
}

/**
 * Builds the full extras array for a cart item, combining regular complements
 * and pizza sub-items (flavors).
 */
export function buildPrintExtras(
  complements?: { option_name: string }[],
  subItems?: SubItemComplement[]
): string[] | undefined {
  const complementExtras = complements?.map(c => c.option_name) || [];
  const subItemExtras = flattenSubItemsToExtras(subItems);
  const all = [...complementExtras, ...subItemExtras];
  return all.length > 0 ? all : undefined;
}
