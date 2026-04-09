import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client as apiClient } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';

const ACTIVE_TENANT_KEY = 'activeTenantId';

export interface TenantMembership {
  tenant_id: string;
  is_owner: boolean;
  trial_ends_at?: string | null;
  plan?: string | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    created_at?: string;
    is_active?: boolean;
  } | null;
}

interface TenantContextType {
  allTenants: TenantMembership[];
  activeTenant: TenantMembership | null;
  tenantId: string | null;
  tenant: TenantMembership['tenant'];
  isOwner: boolean;
  isLoading: boolean;
  error: Error | null;
  hasTenant: boolean;
  setActiveTenant: (tenantId: string) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACTIVE_TENANT_KEY);
    }
    return null;
  });

  // Fetch all tenants for the user
  const { data: allTenants = [], isLoading, error, refetch } = useQuery({
    queryKey: ['all-tenant-memberships', user?.id],
    queryFn: async (): Promise<TenantMembership[]> => {
      if (!user?.id) return [];
      const data = await apiClient.get<{ tenants: TenantMembership[] }>('/tenant');
      return data?.tenants || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Validate and set active tenant
  useEffect(() => {
    if (isLoading || allTenants.length === 0) return;

    const storedTenantId = localStorage.getItem(ACTIVE_TENANT_KEY);
    
    // Check if stored tenant is valid (user still has access)
    const storedTenantValid = storedTenantId && 
      allTenants.some(t => t.tenant_id === storedTenantId);

    if (storedTenantValid) {
      setActiveTenantId(storedTenantId);
    } else {
      // Default to first tenant
      const firstTenant = allTenants[0];
      if (firstTenant) {
        setActiveTenantId(firstTenant.tenant_id);
        localStorage.setItem(ACTIVE_TENANT_KEY, firstTenant.tenant_id);
      }
    }
  }, [allTenants, isLoading]);

  // Get the active tenant object
  const activeTenant = useMemo(() => {
    if (!activeTenantId || allTenants.length === 0) return null;
    return allTenants.find(t => t.tenant_id === activeTenantId) || null;
  }, [activeTenantId, allTenants]);

  // Switch tenant function
  const setActiveTenant = useCallback((tenantId: string) => {
    // Validate that user has access to this tenant
    const tenantExists = allTenants.some(t => t.tenant_id === tenantId);
    if (!tenantExists) {
      console.error('User does not have access to tenant:', tenantId);
      return;
    }

    // Update state and localStorage
    setActiveTenantId(tenantId);
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);

    // Invalidate all queries to refresh data for new tenant
    queryClient.invalidateQueries();
  }, [allTenants, queryClient]);

  // Refresh tenants function
  const refreshTenants = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Clear active tenant on logout
  useEffect(() => {
    if (!user) {
      setActiveTenantId(null);
      localStorage.removeItem(ACTIVE_TENANT_KEY);
    }
  }, [user]);

  const value = useMemo<TenantContextType>(() => ({
    allTenants,
    activeTenant,
    tenantId: activeTenant?.tenant_id ?? null,
    tenant: activeTenant?.tenant ?? null,
    isOwner: activeTenant?.is_owner ?? false,
    isLoading,
    error: error as Error | null,
    hasTenant: !!activeTenant?.tenant_id,
    setActiveTenant,
    refreshTenants,
  }), [allTenants, activeTenant, isLoading, error, setActiveTenant, refreshTenants]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}
