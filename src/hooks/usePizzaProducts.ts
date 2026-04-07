import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FlavorOption } from './useComplementGroups';

export interface PizzaProductConfig {
  maxFlavors: number;
  flavorModalEnabled: boolean;
  flavorModalChannels: string[];
  flavorOptions: FlavorOption[];
}

/**
 * Returns a Set of product IDs that have complement groups with applies_per_unit = true,
 * plus a map of product_id -> PizzaProductConfig with full flavor modal configuration.
 */
export function usePizzaProducts() {
  return useQuery({
    queryKey: ['pizza-products'],
    queryFn: async () => {
      // Get all complement groups with applies_per_unit = true
      const { data: perUnitGroups, error: groupsError } = await supabase
        .from('complement_groups')
        .select('id, unit_count, flavor_modal_enabled, flavor_modal_channels, flavor_options, applicable_flavor_counts')
        .eq('is_active', true)
        .eq('applies_per_unit', true);

      if (groupsError) throw groupsError;
      if (!perUnitGroups || perUnitGroups.length === 0) {
        return { pizzaProductIds: new Set<string>(), maxFlavorsMap: new Map<string, number>(), configMap: new Map<string, PizzaProductConfig>() };
      }

      const groupIds = perUnitGroups.map(g => g.id);
      const groupConfigMap = new Map(perUnitGroups.map(g => [g.id, {
        unitCount: g.unit_count ?? 2,
        flavorModalEnabled: g.flavor_modal_enabled ?? true,
        flavorModalChannels: g.flavor_modal_channels ?? ['delivery', 'counter', 'table'],
        flavorOptions: (g.flavor_options ?? []) as unknown as FlavorOption[],
      }]));

      // Get product links for these groups
      const { data: productGroups, error: pgError } = await supabase
        .from('product_complement_groups')
        .select('product_id, group_id, skip_flavor_modal')
        .in('group_id', groupIds);

      if (pgError) throw pgError;

      const pizzaProductIds = new Set<string>();
      const maxFlavorsMap = new Map<string, number>();
      const configMap = new Map<string, PizzaProductConfig>();

      // Collect all linked per-unit groups per product
      const productGroupsMap = new Map<string, typeof perUnitGroups>();
      for (const pg of productGroups || []) {
        const groupConfig = groupConfigMap.get(pg.group_id);
        if (!groupConfig) continue;
        if (pg.skip_flavor_modal) continue;

        const existing = productGroupsMap.get(pg.product_id) || [];
        const groupData = perUnitGroups.find(g => g.id === pg.group_id);
        if (groupData) existing.push(groupData);
        productGroupsMap.set(pg.product_id, existing);
      }

      for (const [productId, linkedGroups] of productGroupsMap) {
        if (linkedGroups.length === 0) continue;
        pizzaProductIds.add(productId);

        // Collect all applicable_flavor_counts from linked groups
        const availableCounts = new Set<number>();
        for (const g of linkedGroups) {
          const applicable = (g as any).applicable_flavor_counts as number[] | null;
          if (applicable && applicable.length > 0) {
            applicable.forEach(c => availableCounts.add(c));
          } else {
            // If no applicable_flavor_counts, use unit_count
            availableCounts.add(g.unit_count ?? 1);
          }
        }

        // Use the first group's config as base, then filter flavor options
        const baseConfig = groupConfigMap.get(linkedGroups[0].id)!;
        const filteredFlavorOptions = baseConfig.flavorOptions.filter(
          opt => availableCounts.has(opt.count)
        );

        // Use the max from applicable_flavor_counts (not unit_count) so all configured options appear
        const maxFromAvailable = availableCounts.size > 0 ? Math.max(...availableCounts) : Math.max(...linkedGroups.map(g => g.unit_count ?? 1));
        maxFlavorsMap.set(productId, maxFromAvailable);
        
        // Merge flavorModalChannels from all linked groups
        const allChannels = new Set<string>();
        for (const g of linkedGroups) {
          const cfg = groupConfigMap.get(g.id);
          if (cfg) cfg.flavorModalChannels.forEach(c => allChannels.add(c));
        }

        configMap.set(productId, {
          maxFlavors: maxFromAvailable,
          flavorModalEnabled: baseConfig.flavorModalEnabled,
          flavorModalChannels: Array.from(allChannels),
          flavorOptions: filteredFlavorOptions,
        });
      }

      return { pizzaProductIds, maxFlavorsMap, configMap };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
