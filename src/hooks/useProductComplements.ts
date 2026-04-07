import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GroupWithOptions {
  id: string;
  name: string;
  description: string | null;
  selection_type: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  applies_per_unit: boolean;
  unit_count: number;
  price_calculation_type: string;
  visibility: string;
  channels: string[];
  applicable_flavor_counts: number[] | null;
  kds_category: 'flavor' | 'border' | 'complement';
  options: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    price_override: number | null;
    max_quantity: number;
    image_url: string | null;
  }[];
}

export function useProductComplements(
  productId: string | undefined,
  channel?: 'counter' | 'delivery' | 'table'
) {
  return useQuery({
    queryKey: ['product-complements', productId, channel],
    queryFn: async (): Promise<GroupWithOptions[]> => {
      if (!productId) return [];

      const { data: productGroups = [], error: productGroupsError } = await supabase
        .from('product_complement_groups')
        .select('group_id, sort_order')
        .eq('product_id', productId)
        .order('sort_order');

      if (productGroupsError) throw productGroupsError;
      if (productGroups.length === 0) return [];

      const linkedGroupIds = productGroups.map(pg => pg.group_id);

      const [groupsResult, groupOptionsResult] = await Promise.all([
        supabase
          .from('complement_groups')
          .select('*')
          .in('id', linkedGroupIds)
          .eq('is_active', true),
        supabase
          .from('complement_group_options')
          .select('*')
          .in('group_id', linkedGroupIds)
          .order('group_id')
          .order('sort_order'),
      ]);

      if (groupsResult.error) throw groupsResult.error;
      if (groupOptionsResult.error) throw groupOptionsResult.error;

      const allGroups = groupsResult.data || [];
      const allGroupOptions = groupOptionsResult.data || [];
      const optionIds = [...new Set(allGroupOptions.map(go => go.option_id))];

      const { data: allOptions = [], error: optionsError } = optionIds.length > 0
        ? await supabase
            .from('complement_options')
            .select('*')
            .in('id', optionIds)
            .eq('is_active', true)
        : { data: [], error: null };

      if (optionsError) throw optionsError;

      const filteredGroups = allGroups.filter(group => {
        if (channel && group.channels) {
          const channelMap: Record<string, string> = {
            counter: 'counter',
            delivery: 'delivery',
            table: 'table',
          };

          if (!group.channels.includes(channelMap[channel])) return false;
        }

        return true;
      });

      const optionsMap = new Map(allOptions.map(opt => [opt.id, opt]));
      const groupOptionsMap = new Map<string, typeof allGroupOptions>();

      allGroupOptions.forEach(go => {
        const existing = groupOptionsMap.get(go.group_id) || [];
        existing.push(go);
        groupOptionsMap.set(go.group_id, existing);
      });

      const sortOrderMap = new Map(productGroups.map(pg => [pg.group_id, pg.sort_order ?? 0]));

      return filteredGroups
        .sort((a, b) => (sortOrderMap.get(a.id) ?? 0) - (sortOrderMap.get(b.id) ?? 0))
        .map(group => {
          const groupOptions = groupOptionsMap.get(group.id) || [];

          const options = groupOptions
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map(go => {
              const option = optionsMap.get(go.option_id);
              if (!option) return null;

              return {
                id: option.id,
                name: option.name,
                description: option.description,
                price: option.price,
                price_override: go.price_override,
                max_quantity: go.max_quantity ?? 1,
                image_url: option.image_url,
              };
            })
            .filter((opt): opt is NonNullable<typeof opt> => opt !== null);

          return {
            id: group.id,
            name: group.name,
            description: group.description,
            selection_type: group.selection_type,
            is_required: group.is_required ?? false,
            min_selections: group.min_selections ?? 0,
            max_selections: group.max_selections ?? 1,
            applies_per_unit: group.applies_per_unit ?? false,
            unit_count: group.unit_count ?? 1,
            price_calculation_type: group.price_calculation_type ?? 'sum',
            visibility: group.visibility ?? 'visible',
            channels: group.channels ?? ['delivery', 'counter', 'table'],
            applicable_flavor_counts: group.applicable_flavor_counts ?? null,
            kds_category: (group.kds_category as 'flavor' | 'border' | 'complement') ?? 'complement',
            options,
          };
        });
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000, // Manter em memória por 10 minutos
  });
}
