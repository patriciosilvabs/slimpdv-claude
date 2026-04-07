-- Fix print_queue.created_by constraint
ALTER TABLE public.print_queue DROP CONSTRAINT IF EXISTS print_queue_created_by_fkey;
ALTER TABLE public.print_queue 
ADD CONSTRAINT print_queue_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;