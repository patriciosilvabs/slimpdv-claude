import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

export type CashRegisterStatus = 'open' | 'closed';
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix';

export interface CashRegister {
  id: string;
  opened_by: string;
  closed_by: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  status: CashRegisterStatus;
  opened_at: string;
  closed_at: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  cash_register_id: string | null;
  payment_method: PaymentMethod;
  amount: number;
  received_by: string | null;
  created_at: string;
  is_partial?: boolean;
  observation?: string | null;
}

export function useOpenCashRegister() {
  return useQuery({
    queryKey: ['cash-register', 'open'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('status', 'open')
        .maybeSingle();
      
      if (error) throw error;
      return data as CashRegister | null;
    },
  });
}

export interface PaymentSummaryByMethod {
  cash: number;
  credit_card: number;
  debit_card: number;
  pix: number;
}

export function useCashRegisterPaymentSummary(cashRegisterId: string | undefined) {
  return useQuery({
    queryKey: ['cash-register-payment-summary', cashRegisterId],
    queryFn: async () => {
      if (!cashRegisterId) return { cash: 0, credit_card: 0, debit_card: 0, pix: 0 } as PaymentSummaryByMethod;
      
      const { data, error } = await supabase
        .from('payments')
        .select('payment_method, amount')
        .eq('cash_register_id', cashRegisterId);
      
      if (error) throw error;
      
      const summary: PaymentSummaryByMethod = { cash: 0, credit_card: 0, debit_card: 0, pix: 0 };
      for (const p of data || []) {
        const method = p.payment_method as PaymentMethod;
        if (method in summary) {
          summary[method] += Number(p.amount);
        }
      }
      return summary;
    },
    enabled: !!cashRegisterId,
  });
}

export function useCashRegisterMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const openCashRegister = useMutation({
    mutationFn: async (openingAmount: number) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('cash_registers')
        .insert({
          opened_by: userData.user?.id,
          opening_amount: openingAmount,
          status: 'open',
          tenant_id: tenantId
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      toast({ title: 'Caixa aberto!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao abrir caixa', description: error.message, variant: 'destructive' });
    },
  });

  const closeCashRegister = useMutation({
    mutationFn: async ({ id, closingAmount }: { id: string; closingAmount: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get payments for this cash register
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('cash_register_id', id);
      
      const totalPayments = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      
      // Get cash register opening amount
      const { data: cashRegister } = await supabase
        .from('cash_registers')
        .select('opening_amount')
        .eq('id', id)
        .single();
      
      const expectedAmount = Number(cashRegister?.opening_amount || 0) + totalPayments;
      const difference = closingAmount - expectedAmount;

      const { data, error } = await supabase
        .from('cash_registers')
        .update({
          closed_by: userData.user?.id,
          closing_amount: closingAmount,
          expected_amount: expectedAmount,
          difference,
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      toast({ title: 'Caixa fechado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao fechar caixa', description: error.message, variant: 'destructive' });
    },
  });

  const createPayment = useMutation({
    mutationFn: async (payment: Omit<Payment, 'id' | 'created_at' | 'received_by'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('payments')
        .insert({
          order_id: payment.order_id,
          cash_register_id: payment.cash_register_id,
          payment_method: payment.payment_method,
          amount: payment.amount,
          is_partial: payment.is_partial || false,
          received_by: userData.user?.id,
          tenant_id: tenantId,
          observation: payment.observation || null,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Only close the order/table if NOT a partial payment
      if (!payment.is_partial) {
        // Get order type and table_id first
        const { data: order } = await supabase
          .from('orders')
          .select('table_id, order_type')
          .eq('id', payment.order_id)
          .single();
        
        // Only mark as delivered if it's a dine_in order (mesa)
        // Takeaway and delivery orders need to go through KDS first
        if (order?.order_type === 'dine_in') {
          await supabase
            .from('orders')
            .update({ 
              status: 'delivered',
              delivered_at: new Date().toISOString(),
              table_id: null // Desassociar da mesa para evitar conflitos futuros
            })
            .eq('id', payment.order_id);
        }
        // For takeaway/delivery: status stays as 'pending' to appear in KDS

        // Update table status if it's a dine-in order with a table
        if (order?.table_id) {
          await supabase
            .from('tables')
            .update({ status: 'available' })
            .eq('id', order.table_id);
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      if (variables.is_partial) {
        toast({ title: 'Pagamento parcial registrado!', description: 'A mesa continua aberta.' });
      } else {
        toast({ title: 'Pagamento registrado!' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
    },
  });

  return { openCashRegister, closeCashRegister, createPayment };
}