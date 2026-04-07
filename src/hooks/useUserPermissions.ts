import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from './useUserRole';

export type PermissionCode =
  // Orders
  | 'orders_view'
  | 'orders_edit'
  | 'orders_cancel'
  | 'orders_create'
  | 'orders_print'
  // Tables
  | 'tables_view'
  | 'tables_switch'
  | 'tables_move_items'
  | 'tables_reprint_items'
  | 'tables_cancel_items'
  | 'tables_cancel_order'
  | 'tables_manage_payments'
  | 'tables_reopen'
  | 'tables_close'
  | 'tables_change_fees'
  | 'tables_order_as_other'
  // Reservations
  | 'reservations_view'
  | 'reservations_manage'
  | 'reservations_cancel'
  // Delivery
  | 'delivery_view'
  | 'delivery_manage'
  // Customers
  | 'customers_view'
  | 'customers_manage'
  // Settings
  | 'settings_general'
  | 'settings_print'
  | 'settings_users'
  | 'settings_notifications'
  | 'settings_tables'
  | 'settings_announcements'
  | 'settings_kds'
  | 'settings_idle_tables'
  // Reports
  | 'reports_view'
  | 'reports_export'
  // Cash Register
  | 'cash_register_view'
  | 'cash_register_manage'
  | 'cash_open'
  | 'cash_close'
  | 'cash_withdraw'
  | 'cash_supply'
  | 'cash_view_difference'
  // Menu
  | 'menu_view'
  | 'menu_manage'
  // KDS
  | 'kds_view'
  | 'kds_change_status'
  // Counter/Balcão
  | 'counter_view'
  | 'counter_add_items'
  | 'counter_apply_discount'
  | 'counter_process_payment'
  // Audit
  | 'audit_view'
  | 'audit_export'
  // Stock
  | 'stock_view'
  | 'stock_manage'
  | 'stock_add'
  | 'stock_adjust'
  | 'stock_view_movements'
  // Dashboard
  | 'dashboard_view'
  | 'performance_view'
  // Printing
  | 'print_kitchen_ticket'
  | 'print_customer_receipt'
  | 'print_reprint'
  // History
  | 'closing_history_view'
  | 'closing_history_export'
  | 'reopen_history_view'
  // Production
  | 'production_view'
  | 'production_manage'
  | 'targets_manage';

export interface UserPermission {
  id: string;
  user_id: string;
  permission: PermissionCode;
  granted: boolean;
  created_at: string;
  granted_by: string | null;
}

export const PERMISSION_GROUPS = {
  orders: {
    label: 'Gestão de Pedidos',
    permissions: [
      { code: 'orders_view' as PermissionCode, label: 'Visualizar pedidos' },
      { code: 'orders_edit' as PermissionCode, label: 'Editar pedidos' },
      { code: 'orders_create' as PermissionCode, label: 'Criar pedidos' },
      { code: 'orders_cancel' as PermissionCode, label: 'Cancelar pedidos' },
      { code: 'orders_print' as PermissionCode, label: 'Imprimir pedidos' },
    ],
  },
  tables: {
    label: 'Mesas/Comandas',
    permissions: [
      { code: 'tables_view' as PermissionCode, label: 'Visualizar mesas' },
      { code: 'tables_switch' as PermissionCode, label: 'Trocar mesas' },
      { code: 'tables_move_items' as PermissionCode, label: 'Mover itens da mesa/comanda' },
      { code: 'tables_reprint_items' as PermissionCode, label: 'Reimprimir itens da mesa/comanda' },
      { code: 'tables_cancel_items' as PermissionCode, label: 'Cancelar itens' },
      { code: 'tables_cancel_order' as PermissionCode, label: 'Cancelar pedido' },
      { code: 'tables_manage_payments' as PermissionCode, label: 'Adicionar e remover pagamentos' },
      { code: 'tables_reopen' as PermissionCode, label: 'Reabrir mesa/comanda' },
      { code: 'tables_close' as PermissionCode, label: 'Fechar mesa/comanda' },
      { code: 'tables_change_fees' as PermissionCode, label: 'Alterar taxas e descontos' },
      { code: 'tables_order_as_other' as PermissionCode, label: 'Lançar pedidos como outro garçom' },
    ],
  },
  reservations: {
    label: 'Reservas',
    permissions: [
      { code: 'reservations_view' as PermissionCode, label: 'Visualizar reservas' },
      { code: 'reservations_manage' as PermissionCode, label: 'Criar/editar reservas' },
      { code: 'reservations_cancel' as PermissionCode, label: 'Cancelar reservas' },
    ],
  },
  delivery: {
    label: 'Delivery',
    permissions: [
      { code: 'delivery_view' as PermissionCode, label: 'Visualizar delivery' },
      { code: 'delivery_manage' as PermissionCode, label: 'Gerenciar delivery' },
    ],
  },
  customers: {
    label: 'Clientes',
    permissions: [
      { code: 'customers_view' as PermissionCode, label: 'Visualizar clientes' },
      { code: 'customers_manage' as PermissionCode, label: 'Gerenciar clientes' },
    ],
  },
  settings: {
    label: 'Configurações',
    permissions: [
      { code: 'settings_general' as PermissionCode, label: 'Configurações gerais' },
      { code: 'settings_print' as PermissionCode, label: 'Configurações de impressão' },
      { code: 'settings_users' as PermissionCode, label: 'Gerenciar usuários' },
      { code: 'settings_notifications' as PermissionCode, label: 'Configurar notificações' },
      { code: 'settings_tables' as PermissionCode, label: 'Gerenciar mesas' },
      { code: 'settings_announcements' as PermissionCode, label: 'Gerenciar avisos programados' },
      { code: 'settings_kds' as PermissionCode, label: 'Configurar KDS' },
      { code: 'settings_idle_tables' as PermissionCode, label: 'Configurar mesas ociosas' },
    ],
  },
  reports: {
    label: 'Relatórios',
    permissions: [
      { code: 'reports_view' as PermissionCode, label: 'Visualizar relatórios' },
      { code: 'reports_export' as PermissionCode, label: 'Exportar relatórios' },
    ],
  },
  cash_register: {
    label: 'Caixa',
    permissions: [
      { code: 'cash_register_view' as PermissionCode, label: 'Visualizar caixa' },
      { code: 'cash_register_manage' as PermissionCode, label: 'Gerenciar caixa' },
      { code: 'cash_open' as PermissionCode, label: 'Abrir caixa' },
      { code: 'cash_close' as PermissionCode, label: 'Fechar caixa' },
      { code: 'cash_withdraw' as PermissionCode, label: 'Fazer sangrias' },
      { code: 'cash_supply' as PermissionCode, label: 'Fazer suprimentos' },
      { code: 'cash_view_difference' as PermissionCode, label: 'Ver diferença de caixa' },
    ],
  },
  menu: {
    label: 'Cardápio',
    permissions: [
      { code: 'menu_view' as PermissionCode, label: 'Visualizar cardápio' },
      { code: 'menu_manage' as PermissionCode, label: 'Gerenciar cardápio' },
    ],
  },
  kds: {
    label: 'KDS (Cozinha)',
    permissions: [
      { code: 'kds_view' as PermissionCode, label: 'Acessar tela do KDS' },
      { code: 'kds_change_status' as PermissionCode, label: 'Alterar status de pedidos' },
    ],
  },
  counter: {
    label: 'Balcão/Takeaway',
    permissions: [
      { code: 'counter_view' as PermissionCode, label: 'Acessar tela do balcão' },
      { code: 'counter_add_items' as PermissionCode, label: 'Adicionar itens' },
      { code: 'counter_apply_discount' as PermissionCode, label: 'Aplicar descontos' },
      { code: 'counter_process_payment' as PermissionCode, label: 'Processar pagamentos' },
    ],
  },
  audit: {
    label: 'Auditoria',
    permissions: [
      { code: 'audit_view' as PermissionCode, label: 'Visualizar auditoria' },
      { code: 'audit_export' as PermissionCode, label: 'Exportar auditoria' },
    ],
  },
  stock: {
    label: 'Estoque',
    permissions: [
      { code: 'stock_view' as PermissionCode, label: 'Visualizar estoque' },
      { code: 'stock_manage' as PermissionCode, label: 'Gerenciar estoque' },
      { code: 'stock_add' as PermissionCode, label: 'Adicionar ingredientes' },
      { code: 'stock_adjust' as PermissionCode, label: 'Ajustar estoque' },
      { code: 'stock_view_movements' as PermissionCode, label: 'Ver movimentações' },
    ],
  },
  dashboard: {
    label: 'Dashboard & Performance',
    permissions: [
      { code: 'dashboard_view' as PermissionCode, label: 'Acessar dashboard' },
      { code: 'performance_view' as PermissionCode, label: 'Acessar análise de performance' },
    ],
  },
  printing: {
    label: 'Impressão',
    permissions: [
      { code: 'print_kitchen_ticket' as PermissionCode, label: 'Imprimir comanda de cozinha' },
      { code: 'print_customer_receipt' as PermissionCode, label: 'Imprimir recibo do cliente' },
      { code: 'print_reprint' as PermissionCode, label: 'Reimprimir documentos' },
    ],
  },
  history: {
    label: 'Históricos',
    permissions: [
      { code: 'closing_history_view' as PermissionCode, label: 'Ver histórico de fechamentos' },
      { code: 'closing_history_export' as PermissionCode, label: 'Exportar histórico de fechamentos' },
      { code: 'reopen_history_view' as PermissionCode, label: 'Ver histórico de reaberturas' },
    ],
  },
  production: {
    label: 'Produção (CPD)',
    permissions: [
      { code: 'production_view' as PermissionCode, label: 'Acessar dashboard de produção' },
      { code: 'production_manage' as PermissionCode, label: 'Confirmar envios de produção' },
      { code: 'targets_manage' as PermissionCode, label: 'Gerenciar metas de produção' },
    ],
  },
};

export function useUserPermissions() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  
  const query = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return (data || []) as UserPermission[];
    },
    enabled: !!user?.id,
  });

  // Admin has all permissions
  const hasPermission = (code: PermissionCode): boolean => {
    if (isAdmin) return true;
    return query.data?.some(p => p.permission === code && p.granted) ?? false;
  };

  const hasAnyPermission = (codes: PermissionCode[]): boolean => {
    return codes.some(code => hasPermission(code));
  };

  return { 
    ...query, 
    permissions: query.data || [],
    hasPermission, 
    hasAnyPermission 
  };
}

// Hook to get permissions for a specific user (admin use)
export function useUserPermissionsById(userId: string | null) {
  const query = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return (data || []) as UserPermission[];
    },
    enabled: !!userId,
  });

  return query;
}

// Hook for permission mutations (admin use)
export function useUserPermissionMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Helper function to get tenant_id via RPC (avoids hook order issues)
  const getTenantId = async (): Promise<string | null> => {
    const { data } = await supabase.rpc('get_user_tenant_id');
    return data;
  };

  const setPermission = useMutation({
    mutationFn: async ({ userId, permission, granted }: { userId: string; permission: PermissionCode; granted: boolean }) => {
      if (granted) {
        const tenantId = await getTenantId();
        // Upsert permission - using 'as any' to handle enum type mismatch until types are regenerated
        const { error } = await supabase
          .from('user_permissions')
          .upsert({
            user_id: userId,
            permission: permission as any,
            granted: true,
            granted_by: user?.id,
            tenant_id: tenantId,
          }, { onConflict: 'user_id,permission' });
        
        if (error) throw error;
      } else {
        // Remove permission
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('permission', permission as any);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
    },
  });

  const setMultiplePermissions = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: { permission: PermissionCode; granted: boolean }[] }) => {
      // Delete all existing permissions for user
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert only granted permissions - using 'as any' to handle enum type mismatch until types are regenerated
      const grantedPermissions = permissions.filter(p => p.granted);
      if (grantedPermissions.length > 0) {
        const tenantId = await getTenantId();
        const { error } = await supabase
          .from('user_permissions')
          .insert(grantedPermissions.map(p => ({
            user_id: userId,
            permission: p.permission as any,
            granted: true,
            granted_by: user?.id,
            tenant_id: tenantId,
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
    },
  });

  const copyPermissions = useMutation({
    mutationFn: async ({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }) => {
      // Get source user permissions
      const { data: sourcePermissions, error: fetchError } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', fromUserId)
        .eq('granted', true);
      
      if (fetchError) throw fetchError;
      
      // Delete target user permissions
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', toUserId);

      // Copy permissions
      if (sourcePermissions && sourcePermissions.length > 0) {
        const tenantId = await getTenantId();
        const { error } = await supabase
          .from('user_permissions')
          .insert(sourcePermissions.map(p => ({
            user_id: toUserId,
            permission: p.permission,
            granted: true,
            granted_by: user?.id,
            tenant_id: tenantId,
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.toUserId] });
    },
  });

  return { setPermission, setMultiplePermissions, copyPermissions };
}
