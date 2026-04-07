-- Add columns to complement_groups for per-unit configuration
ALTER TABLE complement_groups 
ADD COLUMN IF NOT EXISTS applies_per_unit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS unit_count INTEGER DEFAULT 1;

-- Create table for sub-items within an order item (individual pizzas in a combo)
CREATE TABLE IF NOT EXISTS order_item_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  sub_item_index INTEGER NOT NULL, -- 1, 2, 3... (Pizza 1, Pizza 2, etc.)
  notes TEXT, -- Observações específicas desta pizza
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for extras of each sub-item (flavors, crusts)
CREATE TABLE IF NOT EXISTS order_item_sub_item_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_item_id UUID NOT NULL REFERENCES order_item_sub_items(id) ON DELETE CASCADE,
  group_id UUID REFERENCES complement_groups(id),
  option_id UUID REFERENCES complement_options(id),
  group_name TEXT NOT NULL,
  option_name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE order_item_sub_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_sub_item_extras ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_item_sub_items
CREATE POLICY "Tenant members can view sub items"
ON order_item_sub_items FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage sub items"
ON order_item_sub_items FOR ALL
USING (belongs_to_tenant(tenant_id))
WITH CHECK (belongs_to_tenant(tenant_id));

-- RLS Policies for order_item_sub_item_extras
CREATE POLICY "Tenant members can view sub item extras"
ON order_item_sub_item_extras FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage sub item extras"
ON order_item_sub_item_extras FOR ALL
USING (belongs_to_tenant(tenant_id))
WITH CHECK (belongs_to_tenant(tenant_id));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_item_sub_items_order_item_id ON order_item_sub_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_sub_item_extras_sub_item_id ON order_item_sub_item_extras(sub_item_id);

-- Add comment to explain the purpose
COMMENT ON TABLE order_item_sub_items IS 'Stores individual pizzas within a combo order item, allowing per-pizza customization';
COMMENT ON TABLE order_item_sub_item_extras IS 'Stores flavors, crusts, and other extras for each individual pizza in a combo';
COMMENT ON COLUMN complement_groups.applies_per_unit IS 'When true, selections are made per pizza unit rather than for the whole item';
COMMENT ON COLUMN complement_groups.unit_count IS 'Number of units (pizzas) this group applies to when applies_per_unit is true';