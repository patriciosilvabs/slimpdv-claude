-- Add is_partial column to payments table for partial payments
ALTER TABLE public.payments ADD COLUMN is_partial boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.payments.is_partial IS 'Indicates a partial payment where the table remains open';