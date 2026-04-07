import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface ChecklistItem {
  keyword: string;
  quantity: number;
}

function buildChecklistHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // KDS device auth fallback
    try {
      const stored = localStorage.getItem('kds_device_auth');
      if (stored) {
        const dev = JSON.parse(stored);
        if (dev?.deviceId) headers['X-Device-Id'] = dev.deviceId;
        if (dev?.authCode) headers['X-Auth-Code'] = dev.authCode;
        if (dev?.tenantId) headers['X-Tenant-Id'] = dev.tenantId;
      }
    } catch { /* ignore */ }
  }
  return headers;
}

async function fetchChecklist(orderId: string): Promise<ChecklistItem[]> {
  const url = `${API_URL}/orders/${orderId}/dispatch-checklist`;
  const res = await fetch(url, { method: 'GET', headers: buildChecklistHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.checklist || [];
}

/**
 * Fetches the dispatch checklist for a given order from the backend.
 * Returns items (products + complement options) that have check_on_dispatch=true.
 * Supports both user JWT and KDS device auth.
 */
export function useDispatchChecklist(orderId: string | undefined) {
  const { data } = useQuery({
    queryKey: ['dispatch-checklist', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      return fetchChecklist(orderId);
    },
    enabled: !!orderId,
    staleTime: 10_000,
  });
  return data || [];
}

/**
 * Fetches the dispatch checklist imperatively (for use in click handlers).
 */
export async function fetchDispatchChecklist(orderId: string): Promise<ChecklistItem[]> {
  try {
    return await fetchChecklist(orderId);
  } catch {
    return [];
  }
}

/**
 * Legacy sync builder — kept for backward compatibility but returns empty.
 * Use fetchDispatchChecklist() instead.
 */
export function buildDispatchChecklist(
  items: Array<{ quantity: number; product?: { dispatch_keywords?: string[] | null } | null }>
): ChecklistItem[] {
  return [];
}
