-- Fix order_items.added_by constraint
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_added_by_fkey;
ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_added_by_fkey 
FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix kds_station_logs.performed_by constraint
ALTER TABLE public.kds_station_logs DROP CONSTRAINT IF EXISTS kds_station_logs_performed_by_fkey;
ALTER TABLE public.kds_station_logs 
ADD CONSTRAINT kds_station_logs_performed_by_fkey 
FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix order_reopens.reopened_by constraint
ALTER TABLE public.order_reopens DROP CONSTRAINT IF EXISTS order_reopens_reopened_by_fkey;
ALTER TABLE public.order_reopens 
ADD CONSTRAINT order_reopens_reopened_by_fkey 
FOREIGN KEY (reopened_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix stock_movements.created_by constraint
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;
ALTER TABLE public.stock_movements 
ADD CONSTRAINT stock_movements_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix reservations.created_by constraint  
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_created_by_fkey;
ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix scheduled_announcements.created_by constraint
ALTER TABLE public.scheduled_announcements DROP CONSTRAINT IF EXISTS scheduled_announcements_created_by_fkey;
ALTER TABLE public.scheduled_announcements 
ADD CONSTRAINT scheduled_announcements_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix cash_registers.opened_by and closed_by constraints
ALTER TABLE public.cash_registers DROP CONSTRAINT IF EXISTS cash_registers_opened_by_fkey;
ALTER TABLE public.cash_registers 
ADD CONSTRAINT cash_registers_opened_by_fkey 
FOREIGN KEY (opened_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.cash_registers DROP CONSTRAINT IF EXISTS cash_registers_closed_by_fkey;
ALTER TABLE public.cash_registers 
ADD CONSTRAINT cash_registers_closed_by_fkey 
FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix cash_movements.created_by constraint
ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS cash_movements_created_by_fkey;
ALTER TABLE public.cash_movements 
ADD CONSTRAINT cash_movements_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix payments.received_by constraint
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_received_by_fkey;
ALTER TABLE public.payments 
ADD CONSTRAINT payments_received_by_fkey 
FOREIGN KEY (received_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix table_switches.switched_by constraint
ALTER TABLE public.table_switches DROP CONSTRAINT IF EXISTS table_switches_switched_by_fkey;
ALTER TABLE public.table_switches 
ADD CONSTRAINT table_switches_switched_by_fkey 
FOREIGN KEY (switched_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix custom_sounds.user_id constraint
ALTER TABLE public.custom_sounds DROP CONSTRAINT IF EXISTS custom_sounds_user_id_fkey;
ALTER TABLE public.custom_sounds 
ADD CONSTRAINT custom_sounds_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;