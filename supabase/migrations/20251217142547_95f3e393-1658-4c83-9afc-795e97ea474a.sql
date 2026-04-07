-- Adicionar novas permissões ao enum permission_code
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'kds_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'kds_change_status';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'counter_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'counter_add_items';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'counter_apply_discount';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'counter_process_payment';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'audit_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'audit_export';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'stock_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'stock_manage';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'dashboard_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'performance_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'combos_manage';