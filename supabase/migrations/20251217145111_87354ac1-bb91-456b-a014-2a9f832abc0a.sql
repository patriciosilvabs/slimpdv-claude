-- Reservas
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'reservations_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'reservations_manage';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'reservations_cancel';

-- Caixa (detalhado)
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'cash_open';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'cash_close';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'cash_withdraw';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'cash_supply';

-- Configurações (detalhado)
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'settings_notifications';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'settings_tables';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'settings_announcements';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'settings_kds';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'settings_idle_tables';

-- Impressão
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'print_kitchen_ticket';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'print_customer_receipt';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'print_reprint';

-- Estoque (detalhado)
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'stock_add';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'stock_adjust';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'stock_view_movements';

-- Pedidos (detalhado)
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'orders_cancel';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'orders_create';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'orders_print';

-- Históricos
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'closing_history_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'closing_history_export';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'reopen_history_view';