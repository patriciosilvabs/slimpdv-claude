import { useTenant } from './useTenant';
import { useTenantContext } from '@/contexts/TenantContext';

export interface GroupStore {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  owner_id: string;
}

/**
 * Hook para buscar todas as lojas do mesmo grupo/owner
 * Usa dados do TenantContext (API local) em vez do Supabase
 */
export function useGroupStores() {
  const { tenantId } = useTenant();
  const { allTenants, isLoading } = useTenantContext();

  const stores: GroupStore[] = allTenants.map(m => ({
    id: m.tenant_id,
    name: m.tenant?.name || '',
    slug: m.tenant?.slug || '',
    is_active: true,
    created_at: '',
    owner_id: '',
  }));

  const otherStores = stores.filter(store => store.id !== tenantId);
  const totalStores = stores.length;
  const isOwnerOfGroup = allTenants.some(m => m.is_owner);

  return {
    data: stores,
    isLoading,
    isError: false,
    stores,
    otherStores,
    totalStores,
    isOwnerOfGroup,
  };
}
