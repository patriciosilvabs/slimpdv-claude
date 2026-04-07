import { useTenantContext, TenantMembership } from '@/contexts/TenantContext';

// Re-export TenantMembership type for backwards compatibility
export type { TenantMembership };

/**
 * Hook for accessing tenant information.
 * Now uses TenantContext for multi-store support.
 * Maintains backwards compatibility with existing code.
 */
export function useTenant() {
  const context = useTenantContext();
  
  return {
    tenantId: context.tenantId,
    tenant: context.tenant,
    isOwner: context.isOwner,
    isLoading: context.isLoading,
    error: context.error,
    hasTenant: context.hasTenant,
  };
}
