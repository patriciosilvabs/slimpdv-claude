/**
 * Detecta se um item de pedido possui dados de sabor (flavor).
 * Itens sem produto mapeado E sem sabores são considerados "fantasmas"
 * e devem ser ocultados nas views de produção do KDS.
 */

interface FilterableItem {
  product?: { name: string } | null;
  extras?: Array<{ extra_name: string; kds_category?: string }>;
  sub_items?: Array<{
    sub_extras?: Array<{ group_name?: string; option_name: string; kds_category?: string }>;
  }> | null;
}

function hasFlavorData(item: FilterableItem): boolean {
  if (item.extras?.some(e => e.kds_category === 'flavor')) return true;
  if (item.extras?.some(e => e.extra_name.toLowerCase().includes('sabor'))) return true;
  if (item.sub_items?.some(si =>
    si.sub_extras?.some(se =>
      se.kds_category === 'flavor' || se.group_name?.toLowerCase().includes('sabor')
    )
  )) return true;
  return false;
}

/** Retorna true se o item é um "fantasma" — sem produto mapeado e sem sabores */
export function isPhantomItem(item: FilterableItem): boolean {
  return !item.product && !hasFlavorData(item);
}

/** Filtra itens fantasma de uma lista */
export function filterPhantomItems<T extends FilterableItem>(items: T[]): T[] {
  return items.filter(item => !isPhantomItem(item));
}
