import { useQuery, useMutation } from '@tanstack/react-query';

export interface StoreData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string;
    phone: string;
    address: string;
  };
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    sort_order: number;
  }>;
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    category_id: string;
    is_promotion: boolean;
    promotion_price: number | null;
    is_featured: boolean;
    label: string | null;
    preparation_time: number | null;
    sort_order: number;
  }>;
  variations: Array<{
    id: string;
    product_id: string;
    name: string;
    description: string | null;
    price_modifier: number;
  }>;
  productGroups: Array<{
    product_id: string;
    group_id: string;
    sort_order: number;
    skip_flavor_modal?: boolean;
  }>;
  complementGroups: Array<{
    id: string;
    name: string;
    description: string | null;
    selection_type: string;
    is_required: boolean;
    min_selections: number;
    max_selections: number;
    sort_order: number;
    price_calculation_type: string | null;
    channels: string[] | null;
    visibility: string | null;
    kds_category: string;
    applies_per_unit?: boolean;
    unit_count?: number;
    flavor_modal_enabled?: boolean;
    flavor_modal_channels?: string[];
    flavor_options?: Array<{ count: number; label: string; description: string }>;
    applicable_flavor_counts?: number[];
  }>;
  groupOptions: Array<{
    id: string;
    group_id: string;
    option_id: string;
    price_override: number | null;
    sort_order: number;
    max_quantity: number;
  }>;
  complementOptions: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
  }>;
  table: { id: string; number: number; capacity: number } | null;
}

export function usePublicStore(slug: string | undefined, tableId?: string | null) {
  return useQuery<StoreData>({
    queryKey: ['public-store', slug, tableId],
    queryFn: async () => {
      const params = new URLSearchParams({ slug: slug!, action: 'menu' });
      if (tableId) params.append('table_id', tableId);

      const url = `/api/functions/public-store?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao carregar loja');
      }

      return res.json();
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export interface CreateOrderPayload {
  slug: string;
  order_type: 'takeaway' | 'delivery';
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  notes?: string;
  table_id?: string;
  payment_method?: string;
  items: Array<{
    product_id: string;
    variation_id?: string | null;
    quantity: number;
    unit_price: number;
    notes?: string;
    complements?: Array<{
      option_id: string;
      option_name: string;
      price: number;
      quantity: number;
      kds_category?: string;
    }>;
  }>;
}

export interface PublicOrderStatus {
  order_id: string;
  status: string;
  order_type: string;
  updated_at: string;
}

export function usePublicOrderStatus(slug: string | undefined, orderId: string | null) {
  return useQuery<PublicOrderStatus>({
    queryKey: ['public-order-status', slug, orderId],
    queryFn: async () => {
      const params = new URLSearchParams({ slug: slug!, action: 'order-status', order_id: orderId! });
      const url = `/api/functions/public-store?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao buscar status');
      return res.json();
    },
    enabled: !!slug && !!orderId,
    refetchInterval: 10_000,
  });
}

export function useCreatePublicOrder() {
  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const url = `/api/functions/public-store?slug=${payload.slug}&action=create-order`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar pedido');
      }

      return res.json();
    },
  });
}
