-- Fix orders.created_by constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_created_by_fkey;
ALTER TABLE public.orders 
ADD CONSTRAINT orders_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix orders.cancelled_by constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cancelled_by_fkey;
ALTER TABLE public.orders 
ADD CONSTRAINT orders_cancelled_by_fkey 
FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix tenant_invitations.invited_by constraint
ALTER TABLE public.tenant_invitations DROP CONSTRAINT IF EXISTS tenant_invitations_invited_by_fkey;
ALTER TABLE public.tenant_invitations 
ADD CONSTRAINT tenant_invitations_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix platform_admins.user_id constraint (cascade delete - if user is deleted, remove from platform_admins)
ALTER TABLE public.platform_admins DROP CONSTRAINT IF EXISTS platform_admins_user_id_fkey;
ALTER TABLE public.platform_admins 
ADD CONSTRAINT platform_admins_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix platform_admins.created_by constraint
ALTER TABLE public.platform_admins DROP CONSTRAINT IF EXISTS platform_admins_created_by_fkey;
ALTER TABLE public.platform_admins 
ADD CONSTRAINT platform_admins_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix profiles.id constraint (cascade delete - if user is deleted, remove profile)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;