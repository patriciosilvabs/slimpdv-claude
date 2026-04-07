
-- 1. Add operational_type to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS operational_type text NOT NULL DEFAULT 'cozinha';

-- 2. Add displayed_item_kinds to kds_stations
ALTER TABLE public.kds_stations ADD COLUMN IF NOT EXISTS displayed_item_kinds text[] NOT NULL DEFAULT '{}';

-- 3. Trigger to populate order_items.item_kind from products.operational_type on INSERT
CREATE OR REPLACE FUNCTION public.set_order_item_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND (NEW.item_kind IS NULL OR NEW.item_kind = '') THEN
    SELECT operational_type INTO NEW.item_kind
    FROM products
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_item_kind ON public.order_items;
CREATE TRIGGER trg_set_order_item_kind
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_item_kind();

-- 4. Backfill existing order_items with item_kind from products
UPDATE public.order_items oi
SET item_kind = p.operational_type
FROM public.products p
WHERE oi.product_id = p.id
  AND (oi.item_kind IS NULL OR oi.item_kind = '');
