import { useCallback } from 'react';
import { client as apiClient } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/hooks/useUserPermissions';
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
      const data = await apiClient.post<ApprovalRequest>('/approval-requests', {
        rule_type,
        context,
      });
      return data;
    },
  });

  // Watch a specific request for status changes (polling every 2s)
  const watchRequest = (requestId: string | null) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: ['approval-request', requestId],
      queryFn: async () => {
        if (!requestId) return null;
        const data = await apiClient.get<ApprovalRequest>(`/approval-requests/${requestId}`);
        return data;
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
  const { isAdmin, isGerente, isSupervisor } = useUserRole();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = useUserPermissions();

  // Admin can approve anything; others need specific permission
  const canApproveDiscount = isAdmin || hasPermission('approve_discount');
  const canApproveCancellation = isAdmin || hasPermission('approve_cancellation');
  const canApproveCashReopen = isAdmin || hasPermission('approve_cash_reopen');
  const canApproveCustom = isAdmin || hasPermission('approve_custom');
  const canApprove = canApproveDiscount || canApproveCancellation || canApproveCashReopen || canApproveCustom;

  // Map rule_type to what this user can approve
  const canApproveRuleType = (ruleType: string) => {
    if (isAdmin) return true;
    if (ruleType === 'discount') return canApproveDiscount;
    if (ruleType === 'cancellation') return canApproveCancellation;
    if (ruleType === 'cash_reopen') return canApproveCashReopen;
    return canApproveCustom;
  };

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['approval-requests-pending', tenantId],
    queryFn: async () => {
      if (!tenantId || !canApprove) return [];
      const data = await apiClient.get<ApprovalRequest[]>('/approval-requests?status=pending');
      // Filter to only show requests this user can actually approve
      return (data || []).filter(r => canApproveRuleType(r.rule_type));
    },
    enabled: !!tenantId && canApprove,
    refetchInterval: 3000, // poll every 3 seconds
  });

  const approveRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await apiClient.patch(`/approval-requests/${requestId}`, {
        status: 'approved',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests-pending', tenantId] });
      toast.success('Solicitação aprovada');
    },
  });

  const denyRequest = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      await apiClient.patch(`/approval-requests/${requestId}`, {
        status: 'denied',
        denial_reason: reason || 'Negado pelo gerente',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests-pending', tenantId] });
      toast.info('Solicitação negada');
    },
  });

  return {
    pendingRequests,
    canApprove,
    canApproveDiscount,
    canApproveCancellation,
    canApproveCashReopen,
    canApproveCustom,
    canApproveRuleType,
    approveRequest,
    denyRequest,
  };
}
