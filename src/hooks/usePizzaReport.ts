import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange, getDateRange } from './useReports';
import { filterOrdersByReportDate } from '@/lib/reportDateUtils';

interface PizzaSizeData {
  variationName: string;
  quantity: number;
  revenue: number;
}

interface PizzaFlavorData {
  flavorName: string;
  quantity: number;
  revenue: number;
}

interface PizzaCombinationData {
  combination: string;
  count: number;
}

interface FlavorBySizeData {
  flavorName: string;
  sizes: Record<string, number>;
  total: number;
}

export interface PizzaReportData {
  totalPizzas: number;
  totalRevenue: number;
  averageTicket: number;
  bySize: PizzaSizeData[];
  topFlavors: PizzaFlavorData[];
  topCombinations: PizzaCombinationData[];
  flavorBySize: FlavorBySizeData[];
  allSizes: string[];
}

const EMPTY_RESULT: PizzaReportData = { totalPizzas: 0, totalRevenue: 0, averageTicket: 0, bySize: [], topFlavors: [], topCombinations: [], flavorBySize: [], allSizes: [] };

/** Extract the size portion from a group_name like "Grande 35cm | Sabores" */
function extractSizeFromGroupName(groupName: string): string | null {
  if (!groupName) return null;
  const parts = groupName.split('|');
  const candidate = parts[0].trim();
  // Only use if it looks like a size (not empty, not just "Sabores")
  if (candidate && candidate.toLowerCase() !== 'sabores') return candidate;
  return null;
}

export function usePizzaReport(range: DateRange, customStart?: Date, customEnd?: Date, startHour?: string, endHour?: string) {
  const { start, end } = getDateRange(range, customStart, customEnd);

  return useQuery({
    queryKey: ['pizza-report', range, customStart?.toISOString(), customEnd?.toISOString(), startHour, endHour],
    refetchInterval: 30000,
    queryFn: async (): Promise<PizzaReportData> => {
      // Wider window to catch orders created before but delivered within the filter
      const wideStart = new Date(start);
      wideStart.setDate(wideStart.getDate() - 7);

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, created_at, delivered_at')
        .or('status.eq.delivered,delivered_at.not.is.null')
        .gte('created_at', wideStart.toISOString())
        .lte('created_at', end.toISOString());

      if (ordersError) throw ordersError;
      
      const filtered = filterOrdersByReportDate(orders || [], start, end, startHour, endHour);

      const orderIds = filtered.map(o => o.id);
      if (orderIds.length === 0) return EMPTY_RESULT;

      // 2. Get all order_item_extras with kds_category='flavor' to identify pizza items
      const { data: flavorExtras, error: extrasError } = await supabase
        .from('order_item_extras')
        .select('order_item_id, extra_name, price')
        .eq('kds_category', 'flavor')
        .limit(5000);

      if (extrasError) throw extrasError;

      // Also check sub_item_extras for flavor — include group_name for size fallback
      const { data: subFlavorExtras } = await supabase
        .from('order_item_sub_item_extras')
        .select('sub_item_id, option_name, price, group_name, sub_item:order_item_sub_items(order_item_id)')
        .eq('kds_category', 'flavor')
        .limit(5000);

      // Build set of order_item_ids that have flavors
      const flavorItemIds = new Set<string>();
      const itemFlavorsMap = new Map<string, { name: string; price: number }[]>();
      // Fallback size extracted from group_name per order_item_id
      const itemSizeFallback = new Map<string, string>();

      flavorExtras?.forEach(e => {
        flavorItemIds.add(e.order_item_id);
        const existing = itemFlavorsMap.get(e.order_item_id) || [];
        existing.push({ name: e.extra_name, price: Number(e.price) });
        itemFlavorsMap.set(e.order_item_id, existing);
      });

      subFlavorExtras?.forEach(e => {
        const itemId = (e.sub_item as any)?.order_item_id;
        if (!itemId) return;
        flavorItemIds.add(itemId);
        const existing = itemFlavorsMap.get(itemId) || [];
        existing.push({ name: e.option_name, price: Number(e.price) });
        itemFlavorsMap.set(itemId, existing);

        // Extract size from group_name as fallback
        if (!itemSizeFallback.has(itemId) && e.group_name) {
          const size = extractSizeFromGroupName(e.group_name);
          if (size) itemSizeFallback.set(itemId, size);
        }
      });

      if (flavorItemIds.size === 0) return EMPTY_RESULT;

      // 3. Get the order_items that are pizzas and belong to our orders
      const pizzaItemIds = Array.from(flavorItemIds);
      const chunks: string[][] = [];
      for (let i = 0; i < pizzaItemIds.length; i += 200) {
        chunks.push(pizzaItemIds.slice(i, i + 200));
      }

      interface PizzaItem {
        id: string;
        order_id: string;
        quantity: number;
        total_price: number;
        variation_id: string | null;
      }

      let allPizzaItems: PizzaItem[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from('order_items')
          .select('id, order_id, quantity, total_price, variation_id')
          .in('id', chunk)
          .in('order_id', orderIds)
          .is('cancelled_at', null);

        if (error) throw error;
        if (data) allPizzaItems = allPizzaItems.concat(data);
      }

      if (allPizzaItems.length === 0) return EMPTY_RESULT;

      // 4. Get variation names for sizes
      const variationIds = [...new Set(allPizzaItems.map(i => i.variation_id).filter(Boolean))] as string[];
      let variationMap = new Map<string, string>();
      if (variationIds.length > 0) {
        const { data: variations } = await supabase
          .from('product_variations')
          .select('id, name')
          .in('id', variationIds);
        variations?.forEach(v => variationMap.set(v.id, v.name));
      }

      // Helper: resolve size name for an item (variation → fallback from group_name → "Sem tamanho")
      const getSizeName = (item: PizzaItem): string => {
        if (item.variation_id) {
          const vName = variationMap.get(item.variation_id);
          if (vName) return vName;
        }
        return itemSizeFallback.get(item.id) || 'Sem tamanho';
      };

      // 5. Aggregate
      const validItems = allPizzaItems.filter(i => orderIds.includes(i.order_id));
      const totalPizzas = validItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalRevenue = validItems.reduce((sum, i) => sum + Number(i.total_price), 0);
      const averageTicket = totalPizzas > 0 ? totalRevenue / totalPizzas : 0;

      // By size
      const sizeMap = new Map<string, { quantity: number; revenue: number }>();
      validItems.forEach(item => {
        const sizeName = getSizeName(item);
        const cur = sizeMap.get(sizeName) || { quantity: 0, revenue: 0 };
        sizeMap.set(sizeName, { quantity: cur.quantity + item.quantity, revenue: cur.revenue + Number(item.total_price) });
      });
      const bySize = Array.from(sizeMap.entries())
        .map(([variationName, d]) => ({ variationName, ...d }))
        .sort((a, b) => b.quantity - a.quantity);

      // Top flavors — use FRACTIONAL quantity (item.quantity / numFlavors)
      const flavorMap = new Map<string, { quantity: number; revenue: number }>();
      validItems.forEach(item => {
        const flavors = itemFlavorsMap.get(item.id) || [];
        const numFlavors = flavors.length || 1;
        const fractionalQty = item.quantity / numFlavors;
        const revenuePerFlavor = Number(item.total_price) / numFlavors;
        flavors.forEach(f => {
          const cur = flavorMap.get(f.name) || { quantity: 0, revenue: 0 };
          flavorMap.set(f.name, { quantity: cur.quantity + fractionalQty, revenue: cur.revenue + revenuePerFlavor });
        });
      });
      const topFlavors = Array.from(flavorMap.entries())
        .map(([flavorName, d]) => ({ flavorName, ...d }))
        .sort((a, b) => b.quantity - a.quantity);

      // Combinations (2+ flavors)
      const comboMap = new Map<string, number>();
      validItems.forEach(item => {
        const flavors = itemFlavorsMap.get(item.id) || [];
        if (flavors.length >= 2) {
          const key = flavors.map(f => f.name).sort().join(' + ');
          comboMap.set(key, (comboMap.get(key) || 0) + item.quantity);
        }
      });
      const topCombinations = Array.from(comboMap.entries())
        .map(([combination, count]) => ({ combination, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // Flavor by size cross-reference — fractional quantity
      const flavorSizeMap = new Map<string, Record<string, number>>();
      const allSizesSet = new Set<string>();
      validItems.forEach(item => {
        const sizeName = getSizeName(item);
        allSizesSet.add(sizeName);
        const flavors = itemFlavorsMap.get(item.id) || [];
        const numFlavors = flavors.length || 1;
        const fractionalQty = item.quantity / numFlavors;
        flavors.forEach(f => {
          const cur = flavorSizeMap.get(f.name) || {};
          cur[sizeName] = (cur[sizeName] || 0) + fractionalQty;
          flavorSizeMap.set(f.name, cur);
        });
      });
      const allSizes = Array.from(allSizesSet);
      const flavorBySize = Array.from(flavorSizeMap.entries())
        .map(([flavorName, sizes]) => ({
          flavorName,
          sizes,
          total: Object.values(sizes).reduce((s, v) => s + v, 0),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 30);

      return { totalPizzas, totalRevenue, averageTicket, bySize, topFlavors, topCombinations, flavorBySize, allSizes };
    },
  });
}
