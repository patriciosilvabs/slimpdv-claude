
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_for numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fiscal_document text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_customer_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_raw_payload jsonb DEFAULT NULL;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS external_item_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS item_kind text DEFAULT NULL;

ALTER TABLE order_item_extras
  ADD COLUMN IF NOT EXISTS external_option_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_group_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
