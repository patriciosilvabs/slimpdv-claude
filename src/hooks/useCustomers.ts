import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  birthday: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('last_order_at', { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useSearchCustomers(searchTerm: string) {
  return useQuery({
    queryKey: ['customers', 'search', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) return [];
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .order('last_order_at', { ascending: false, nullsFirst: false })
        .limit(5);
      
      if (error) throw error;
      return data as Customer[];
    },
    enabled: searchTerm.length >= 2,
  });
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createCustomer = useMutation({
    mutationFn: async (customer: { name: string; phone?: string | null; address?: string | null; notes?: string | null; birthday?: string | null }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('customers')
        .insert({ ...customer, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const updateCustomerStats = useMutation({
    mutationFn: async ({ customerId, orderTotal }: { customerId: string; orderTotal: number }) => {
      // Get current stats
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('total_orders, total_spent')
        .eq('id', customerId)
        .single();
      
      if (fetchError) throw fetchError;

      // Update stats
      const { data, error } = await supabase
        .from('customers')
        .update({
          total_orders: (customer.total_orders || 0) + 1,
          total_spent: (customer.total_spent || 0) + orderTotal,
          last_order_at: new Date().toISOString(),
        })
        .eq('id', customerId)
        .select()
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const findOrCreateCustomer = useMutation({
    mutationFn: async ({ name, phone, address }: { name?: string; phone?: string; address?: string }) => {
      if (!phone && !name) return null;
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Try to find by phone first
      if (phone) {
        const { data: existing } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', phone)
          .maybeSingle();
        
        if (existing) return existing as Customer;
      }

      // Create new customer
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: name || 'Cliente',
          phone: phone || null,
          address: address || null,
          tenant_id: tenantId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  return {
    createCustomer,
    updateCustomer,
    updateCustomerStats,
    findOrCreateCustomer,
  };
}
