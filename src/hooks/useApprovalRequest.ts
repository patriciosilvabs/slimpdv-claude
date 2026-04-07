import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type ApprovalRuleType = 'discount' | 'cancellation' | 'cash_reopen' | 'custom';

export interface ApprovalRequest {
  id: string;
  tenant_id: string | null;
  rule_type: ApprovalRuleType;
  context: Record<string, unknown>;
  requested_by_id: string;
  requested_by_name: string | null;
  status: 'pending' | 'approved' | 'denied';
  approved_by_id: string | null;
  approved_by_name: string | null;
  denial_reason: string | null;
  created_at: string;
  resolved_at: string | null;
}

// Hook for the REQUESTER side (attendant)
export function useRequestApproval() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  const createRequest = useMutation({
    mutationFn: async ({
      rule_type,
      context,
    }: {
      rule_type: ApprovalRuleType;
      context: Record<string, unknown>;
    }): Promise<ApprovalRequest> => {
      const { data, error } = await (supabase as any)
        .from('approval_requests')
        .insert({
          tenant_id: tenantId,
          rule_type,
          context,
          requested_by_id: user?.id || 'unknown',
          requested_by_name: user?.email?.split('@')[0] || 'Operador',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data as ApprovalRequest;
    },
  });

  // Watch a specific request for status changes (polling every 2s)
  const watchRequest = (requestId: string | null) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: ['approval-request', requestId],
      queryFn: async () => {
        if (!requestId) return null;
        const { data, error } = await (supabase as any)
          .from('approval_requests')
          .select('*')
          .eq('id', requestId)
          .single();
        if (error) throw error;
        return data as ApprovalRequest;
      },
      enabled: !!requestId,
      refetchInterval: 2000,
    });
  };

  return { createRequest, watchRequest };
}

// Hook for the MANAGER side (approver)
export function usePendingApprovals() {
  const { tenantId } = useTenant();
  const { isAdmin, role } = useUserRole();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const canApprove = isAdmin || role === 'cashier';

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['approval-requests-pending', tenantId],
    queryFn: async () => {
      if (!tenantId || !canApprove) return [];
      // Only fetch requests created in the last 30 minutes to avoid showing stale ones
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from('approval_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ApprovalRequest[];
    },
    enabled: !!tenantId && canApprove,
    refetchInterval: 3000, // poll every 3 seconds
  });

  const approveRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await (supabase as any)
        .from('approval_requests')
        .update({
          status: 'approved',
          approved_by_id: user?.id || 'unknown',
          approved_by_name: user?.email?.split('@')[0] || 'Gerente',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests-pending', tenantId] });
      toast.success('Solicitação aprovada');
    },
  });

  const denyRequest = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const { error } = await (supabase as any)
        .from('approval_requests')
        .update({
          status: 'denied',
          approved_by_id: user?.id || 'unknown',
          approved_by_name: user?.email?.split('@')[0] || 'Gerente',
          denial_reason: reason || 'Negado pelo gerente',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests-pending', tenantId] });
      toast.info('Solicitação negada');
    },
  });

  return {
    pendingRequests,
    canApprove,
    approveRequest,
    denyRequest,
  };
}
