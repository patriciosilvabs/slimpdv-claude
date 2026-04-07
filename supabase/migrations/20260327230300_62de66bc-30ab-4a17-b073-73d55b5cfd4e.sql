
-- Clean up duplicate orders (keep oldest per external_order_id per tenant)
DELETE FROM orders
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY tenant_id, external_order_id
      ORDER BY created_at ASC
    ) as rn
    FROM orders
    WHERE external_order_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Add unique partial index to prevent future duplicates
CREATE UNIQUE INDEX idx_orders_tenant_external_order_id
  ON orders(tenant_id, external_order_id)
  WHERE external_order_id IS NOT NULL;
