-- Create permission code enum
CREATE TYPE public.permission_code AS ENUM (
  -- Orders/Order Management
  'orders_view',
  'orders_edit',
  
  -- Tables
  'tables_view',
  'tables_switch',
  'tables_move_items',
  'tables_reprint_items',
  'tables_cancel_items',
  'tables_cancel_order',
  'tables_manage_payments',
  'tables_reopen',
  'tables_close',
  'tables_change_fees',
  'tables_order_as_other',
  
  -- Delivery
  'delivery_view',
  'delivery_manage',
  
  -- Customers
  'customers_view',
  'customers_manage',
  
  -- Settings
  'settings_general',
  'settings_print',
  'settings_users',
  
  -- Reports
  'reports_view',
  'reports_export',
  
  -- Cash Register
  'cash_register_view',
  'cash_register_manage',
  
  -- Menu
  'menu_view',
  'menu_manage'
);

-- Create user_permissions table
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission permission_code NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID,
  UNIQUE (user_id, permission)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission permission_code)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND granted = true
  )
$$;

-- RLS Policies
CREATE POLICY "Admins can manage permissions"
  ON public.user_permissions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own permissions"
  ON public.user_permissions
  FOR SELECT
  USING (auth.uid() = user_id);