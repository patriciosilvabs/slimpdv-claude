-- Add column to store the status before cancellation
ALTER TABLE public.orders ADD COLUMN status_before_cancellation order_status;