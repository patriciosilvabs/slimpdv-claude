-- Add is_draft column to orders table
-- Orders with is_draft = true won't appear in KDS until confirmed
ALTER TABLE public.orders ADD COLUMN is_draft boolean DEFAULT false;

-- Update existing orders to ensure they are not drafts
UPDATE public.orders SET is_draft = false WHERE is_draft IS NULL;