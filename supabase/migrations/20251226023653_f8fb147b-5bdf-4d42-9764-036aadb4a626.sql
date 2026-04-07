-- Drop the existing foreign key constraint and recreate with SET NULL
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_created_by_fkey;

-- Recreate the constraint with ON DELETE SET NULL so users can be deleted
-- This preserves the order history but removes the user reference
ALTER TABLE public.orders 
ADD CONSTRAINT orders_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Do the same for cancelled_by
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cancelled_by_fkey;
ALTER TABLE public.orders 
ADD CONSTRAINT orders_cancelled_by_fkey 
FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL;