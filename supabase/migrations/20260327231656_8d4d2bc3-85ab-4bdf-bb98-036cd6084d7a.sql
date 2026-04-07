
DROP INDEX IF EXISTS idx_orders_tenant_external_order_id;

ALTER TABLE orders
  ADD CONSTRAINT uq_orders_tenant_external_order_id
  UNIQUE (tenant_id, external_order_id);
