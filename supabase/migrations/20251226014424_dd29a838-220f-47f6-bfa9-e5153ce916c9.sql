
-- =====================================================
-- FASE 2: Multi-tenant isolation
-- Adicionar tenant_id em todas as tabelas e atualizar RLS
-- =====================================================

-- 1. Adicionar tenant_id em todas as tabelas existentes
-- (nullable inicialmente para dados existentes)

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.product_variations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.product_extras ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.product_extra_links ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.product_ingredients ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.product_complement_groups ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.complement_groups ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.complement_options ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.complement_group_options ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.combo_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.table_switches ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.order_item_extras ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.order_reopens ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.print_sectors ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.print_queue ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.kds_stations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.kds_devices ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.kds_station_logs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.kds_global_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.scheduled_announcements ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.custom_sounds ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tables_tenant ON public.tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kds_stations_tenant ON public.kds_stations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON public.user_roles(tenant_id);

-- 3. Função helper para verificar se usuário é membro do tenant
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id
    AND tenant_id = _tenant_id
  )
$$;

-- 4. Função para verificar role dentro do tenant
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _tenant_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND tenant_id = _tenant_id
    AND role = _role
  )
$$;

-- =====================================================
-- ATUALIZAR RLS POLICIES - CATEGORIES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Employees can view categories" ON public.categories;

CREATE POLICY "Tenant members can view categories"
ON public.categories FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage categories"
ON public.categories FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PRODUCTS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Employees can view products" ON public.products;

CREATE POLICY "Tenant members can view products"
ON public.products FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage products"
ON public.products FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PRODUCT_VARIATIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage variations" ON public.product_variations;
DROP POLICY IF EXISTS "Employees can view variations" ON public.product_variations;

CREATE POLICY "Tenant members can view variations"
ON public.product_variations FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage variations"
ON public.product_variations FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PRODUCT_EXTRAS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage extras" ON public.product_extras;
DROP POLICY IF EXISTS "Employees can view extras" ON public.product_extras;

CREATE POLICY "Tenant members can view extras"
ON public.product_extras FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage extras"
ON public.product_extras FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PRODUCT_EXTRA_LINKS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage extra links" ON public.product_extra_links;
DROP POLICY IF EXISTS "Employees can view extra links" ON public.product_extra_links;

CREATE POLICY "Tenant members can view extra links"
ON public.product_extra_links FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage extra links"
ON public.product_extra_links FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PRODUCT_INGREDIENTS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage product ingredients" ON public.product_ingredients;
DROP POLICY IF EXISTS "Employees can view product ingredients" ON public.product_ingredients;

CREATE POLICY "Tenant members can view product ingredients"
ON public.product_ingredients FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage product ingredients"
ON public.product_ingredients FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PRODUCT_COMPLEMENT_GROUPS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage product groups" ON public.product_complement_groups;
DROP POLICY IF EXISTS "Employees can view product groups" ON public.product_complement_groups;

CREATE POLICY "Tenant members can view product groups"
ON public.product_complement_groups FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage product groups"
ON public.product_complement_groups FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - COMPLEMENT_GROUPS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage complement groups" ON public.complement_groups;
DROP POLICY IF EXISTS "Employees can view complement groups" ON public.complement_groups;

CREATE POLICY "Tenant members can view complement groups"
ON public.complement_groups FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage complement groups"
ON public.complement_groups FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - COMPLEMENT_OPTIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage complement options" ON public.complement_options;
DROP POLICY IF EXISTS "Employees can view complement options" ON public.complement_options;

CREATE POLICY "Tenant members can view complement options"
ON public.complement_options FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage complement options"
ON public.complement_options FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - COMPLEMENT_GROUP_OPTIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage group options" ON public.complement_group_options;
DROP POLICY IF EXISTS "Employees can view group options" ON public.complement_group_options;

CREATE POLICY "Tenant members can view group options"
ON public.complement_group_options FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage group options"
ON public.complement_group_options FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - COMBOS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage combos" ON public.combos;
DROP POLICY IF EXISTS "Employees can view combos" ON public.combos;

CREATE POLICY "Tenant members can view combos"
ON public.combos FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage combos"
ON public.combos FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - COMBO_ITEMS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage combo items" ON public.combo_items;
DROP POLICY IF EXISTS "Employees can view combo items" ON public.combo_items;

CREATE POLICY "Tenant members can view combo items"
ON public.combo_items FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage combo items"
ON public.combo_items FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - TABLES
-- =====================================================
DROP POLICY IF EXISTS "Employees can manage tables" ON public.tables;
DROP POLICY IF EXISTS "Employees can view tables" ON public.tables;

CREATE POLICY "Tenant members can view tables"
ON public.tables FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage tables"
ON public.tables FOR ALL
USING (belongs_to_tenant(tenant_id))
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - TABLE_SWITCHES
-- =====================================================
DROP POLICY IF EXISTS "Employees can create table switches" ON public.table_switches;
DROP POLICY IF EXISTS "Employees can view table switches" ON public.table_switches;

CREATE POLICY "Tenant members can view table switches"
ON public.table_switches FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can create table switches"
ON public.table_switches FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - ORDERS
-- =====================================================
DROP POLICY IF EXISTS "Employees can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Employees can view orders" ON public.orders;

CREATE POLICY "Tenant members can view orders"
ON public.orders FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage orders"
ON public.orders FOR ALL
USING (belongs_to_tenant(tenant_id))
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - ORDER_ITEMS
-- =====================================================
DROP POLICY IF EXISTS "Employees can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Employees can view order items" ON public.order_items;

CREATE POLICY "Tenant members can view order items"
ON public.order_items FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage order items"
ON public.order_items FOR ALL
USING (belongs_to_tenant(tenant_id))
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - ORDER_ITEM_EXTRAS
-- =====================================================
DROP POLICY IF EXISTS "Employees can manage item extras" ON public.order_item_extras;
DROP POLICY IF EXISTS "Employees can view item extras" ON public.order_item_extras;

CREATE POLICY "Tenant members can view item extras"
ON public.order_item_extras FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage item extras"
ON public.order_item_extras FOR ALL
USING (belongs_to_tenant(tenant_id))
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - ORDER_REOPENS
-- =====================================================
DROP POLICY IF EXISTS "Employees can create order reopens" ON public.order_reopens;
DROP POLICY IF EXISTS "Employees can view order reopens" ON public.order_reopens;

CREATE POLICY "Tenant members can view order reopens"
ON public.order_reopens FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can create order reopens"
ON public.order_reopens FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PAYMENTS
-- =====================================================
DROP POLICY IF EXISTS "Authorized staff can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Employees can view payments" ON public.payments;

CREATE POLICY "Tenant members can view payments"
ON public.payments FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Authorized staff can manage payments"
ON public.payments FOR ALL
USING (
  belongs_to_tenant(tenant_id) AND (
    has_tenant_role(auth.uid(), tenant_id, 'admin') OR
    has_tenant_role(auth.uid(), tenant_id, 'cashier') OR
    has_permission(auth.uid(), 'tables_manage_payments') OR
    has_permission(auth.uid(), 'tables_close')
  )
)
WITH CHECK (
  belongs_to_tenant(tenant_id) AND (
    has_tenant_role(auth.uid(), tenant_id, 'admin') OR
    has_tenant_role(auth.uid(), tenant_id, 'cashier') OR
    has_permission(auth.uid(), 'tables_manage_payments') OR
    has_permission(auth.uid(), 'tables_close')
  )
);

-- =====================================================
-- ATUALIZAR RLS POLICIES - CASH_REGISTERS
-- =====================================================
DROP POLICY IF EXISTS "Cashiers can manage cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Employees can view cash registers" ON public.cash_registers;

CREATE POLICY "Tenant members can view cash registers"
ON public.cash_registers FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Cashiers can manage cash registers"
ON public.cash_registers FOR ALL
USING (
  belongs_to_tenant(tenant_id) AND (
    has_tenant_role(auth.uid(), tenant_id, 'cashier') OR
    has_tenant_role(auth.uid(), tenant_id, 'admin')
  )
)
WITH CHECK (
  belongs_to_tenant(tenant_id) AND (
    has_tenant_role(auth.uid(), tenant_id, 'cashier') OR
    has_tenant_role(auth.uid(), tenant_id, 'admin')
  )
);

-- =====================================================
-- ATUALIZAR RLS POLICIES - CASH_MOVEMENTS
-- =====================================================
DROP POLICY IF EXISTS "Cashiers can manage cash movements" ON public.cash_movements;
DROP POLICY IF EXISTS "Employees can view cash movements" ON public.cash_movements;

CREATE POLICY "Tenant members can view cash movements"
ON public.cash_movements FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Cashiers can manage cash movements"
ON public.cash_movements FOR ALL
USING (
  belongs_to_tenant(tenant_id) AND (
    has_tenant_role(auth.uid(), tenant_id, 'cashier') OR
    has_tenant_role(auth.uid(), tenant_id, 'admin')
  )
)
WITH CHECK (
  belongs_to_tenant(tenant_id) AND (
    has_tenant_role(auth.uid(), tenant_id, 'cashier') OR
    has_tenant_role(auth.uid(), tenant_id, 'admin')
  )
);

-- =====================================================
-- ATUALIZAR RLS POLICIES - CUSTOMERS
-- =====================================================
DROP POLICY IF EXISTS "Employees can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Employees can view customers" ON public.customers;

CREATE POLICY "Tenant members can view customers"
ON public.customers FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage customers"
ON public.customers FOR ALL
USING (belongs_to_tenant(tenant_id))
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - RESERVATIONS
-- =====================================================
DROP POLICY IF EXISTS "Employees can manage reservations" ON public.reservations;
DROP POLICY IF EXISTS "Employees can view reservations" ON public.reservations;

CREATE POLICY "Tenant members can view reservations"
ON public.reservations FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage reservations"
ON public.reservations FOR ALL
USING (belongs_to_tenant(tenant_id))
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - INGREDIENTS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Employees can view ingredients" ON public.ingredients;

CREATE POLICY "Tenant members can view ingredients"
ON public.ingredients FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage ingredients"
ON public.ingredients FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - STOCK_MOVEMENTS
-- =====================================================
DROP POLICY IF EXISTS "Employees can create stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Employees can view stock movements" ON public.stock_movements;

CREATE POLICY "Tenant members can view stock movements"
ON public.stock_movements FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can create stock movements"
ON public.stock_movements FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PRINT_SECTORS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage print sectors" ON public.print_sectors;
DROP POLICY IF EXISTS "Employees can view print sectors" ON public.print_sectors;

CREATE POLICY "Tenant members can view print sectors"
ON public.print_sectors FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage print sectors"
ON public.print_sectors FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - PRINT_QUEUE
-- =====================================================
DROP POLICY IF EXISTS "Employees can insert print jobs" ON public.print_queue;
DROP POLICY IF EXISTS "Employees can update print jobs" ON public.print_queue;
DROP POLICY IF EXISTS "Employees can view print queue" ON public.print_queue;

CREATE POLICY "Tenant members can view print queue"
ON public.print_queue FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can insert print jobs"
ON public.print_queue FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can update print jobs"
ON public.print_queue FOR UPDATE
USING (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - KDS_STATIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage KDS stations" ON public.kds_stations;
DROP POLICY IF EXISTS "Employees can view KDS stations" ON public.kds_stations;

CREATE POLICY "Tenant members can view KDS stations"
ON public.kds_stations FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage KDS stations"
ON public.kds_stations FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - KDS_DEVICES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage KDS devices" ON public.kds_devices;
DROP POLICY IF EXISTS "Employees can insert devices" ON public.kds_devices;
DROP POLICY IF EXISTS "Employees can update their own device" ON public.kds_devices;
DROP POLICY IF EXISTS "Employees can view KDS devices" ON public.kds_devices;

CREATE POLICY "Tenant members can view KDS devices"
ON public.kds_devices FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can insert devices"
ON public.kds_devices FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can update devices"
ON public.kds_devices FOR UPDATE
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can delete devices"
ON public.kds_devices FOR DELETE
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - KDS_STATION_LOGS
-- =====================================================
DROP POLICY IF EXISTS "Employees can create station logs" ON public.kds_station_logs;
DROP POLICY IF EXISTS "Employees can view station logs" ON public.kds_station_logs;

CREATE POLICY "Tenant members can view station logs"
ON public.kds_station_logs FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can create station logs"
ON public.kds_station_logs FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

-- =====================================================
-- ATUALIZAR RLS POLICIES - KDS_GLOBAL_SETTINGS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage KDS global settings" ON public.kds_global_settings;
DROP POLICY IF EXISTS "Employees can view KDS global settings" ON public.kds_global_settings;

CREATE POLICY "Tenant members can view KDS global settings"
ON public.kds_global_settings FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage KDS global settings"
ON public.kds_global_settings FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - SCHEDULED_ANNOUNCEMENTS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage scheduled announcements" ON public.scheduled_announcements;
DROP POLICY IF EXISTS "Employees can view scheduled announcements" ON public.scheduled_announcements;

CREATE POLICY "Tenant members can view scheduled announcements"
ON public.scheduled_announcements FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage scheduled announcements"
ON public.scheduled_announcements FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - CUSTOM_SOUNDS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage all custom sounds" ON public.custom_sounds;
DROP POLICY IF EXISTS "Employees can create custom sounds" ON public.custom_sounds;
DROP POLICY IF EXISTS "Employees can view all custom sounds" ON public.custom_sounds;

CREATE POLICY "Tenant members can view custom sounds"
ON public.custom_sounds FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can create custom sounds"
ON public.custom_sounds FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id) AND auth.uid() = user_id);

CREATE POLICY "Tenant admins can manage custom sounds"
ON public.custom_sounds FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - GLOBAL_SETTINGS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Employees can view global settings" ON public.global_settings;

CREATE POLICY "Tenant members can view global settings"
ON public.global_settings FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage global settings"
ON public.global_settings FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- =====================================================
-- ATUALIZAR RLS POLICIES - USER_ROLES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Tenant members can view roles"
ON public.user_roles FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage roles"
ON public.user_roles FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- =====================================================
-- ATUALIZAR RLS POLICIES - USER_PERMISSIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;

CREATE POLICY "Tenant members can view permissions"
ON public.user_permissions FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage permissions"
ON public.user_permissions FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Users can view own permissions"
ON public.user_permissions FOR SELECT
USING (auth.uid() = user_id);
