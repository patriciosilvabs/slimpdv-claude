/**
 * Extracts extras/flavors from external_raw_payload when structured
 * extras and sub_items are missing (integration orders).
 *
 * Falls back to order.external_raw_payload.items[].options
 * and matches by item name or external_item_id.
 */

interface RawOption {
  name: string;
  quantity: number;
  option_group_name?: string | null;
}

interface RawPayloadItem {
  name: string;
  order_item_id?: number;
  options?: RawOption[];
}

interface RawPayload {
  items?: RawPayloadItem[];
}

interface OrderItemLike {
  product?: { name: string } | null;
  product_name?: string | null;
  external_item_id?: string | null;
  extras?: Array<{ extra_name: string; kds_category?: string }>;
  sub_items?: Array<unknown>;
}

/**
 * Returns a list of formatted extra strings for printing,
 * using the raw payload as fallback when no structured extras exist.
 */
export function getIntegrationExtras(
  item: OrderItemLike,
  externalRawPayload?: RawPayload | null,
): string[] {
  // If structured extras exist, use the standard kds_category-based logic
  const extras = item.extras ?? [];
  const subItems = item.sub_items ?? [];

  if (extras.length > 0 || subItems.length > 0) {
    return []; // caller already handles these
  }

  // No structured data – try raw payload
  if (!externalRawPayload?.items) return [];

  // Match raw item to this order item
  const itemName = item.product?.name ?? item.product_name ?? '';
  const extItemId = item.external_item_id;

  const rawItem = externalRawPayload.items.find(ri => {
    if (extItemId && ri.order_item_id != null && String(ri.order_item_id) === extItemId) return true;
    return ri.name === itemName;
  });

  if (!rawItem?.options?.length) return [];

  return rawItem.options.map(opt => {
    const name = opt.name || '';
    // If name already has fraction (e.g. "1/2 Calabresa (G)"), keep it
    // Strip size suffix like " (G)", " (M)" for cleaner display
    const cleaned = name.replace(/\s*\([A-Z]+\)\s*$/, '').trim();
    return cleaned;
  }).filter(Boolean);
}
