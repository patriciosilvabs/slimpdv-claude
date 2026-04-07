-- Alterar FK order_items.product_id para SET NULL
ALTER TABLE order_items 
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey,
  ADD CONSTRAINT order_items_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES products(id) 
    ON DELETE SET NULL;

-- Alterar FK order_items.variation_id para SET NULL
ALTER TABLE order_items 
  DROP CONSTRAINT IF EXISTS order_items_variation_id_fkey,
  ADD CONSTRAINT order_items_variation_id_fkey 
    FOREIGN KEY (variation_id) 
    REFERENCES product_variations(id) 
    ON DELETE SET NULL;

-- Alterar FK order_item_extras.extra_id para SET NULL
ALTER TABLE order_item_extras 
  DROP CONSTRAINT IF EXISTS order_item_extras_extra_id_fkey,
  ADD CONSTRAINT order_item_extras_extra_id_fkey 
    FOREIGN KEY (extra_id) 
    REFERENCES product_extras(id) 
    ON DELETE SET NULL;

-- Alterar FK order_item_sub_item_extras.option_id para SET NULL
ALTER TABLE order_item_sub_item_extras 
  DROP CONSTRAINT IF EXISTS order_item_sub_item_extras_option_id_fkey,
  ADD CONSTRAINT order_item_sub_item_extras_option_id_fkey 
    FOREIGN KEY (option_id) 
    REFERENCES complement_options(id) 
    ON DELETE SET NULL;

-- Alterar FK order_item_sub_item_extras.group_id para SET NULL
ALTER TABLE order_item_sub_item_extras 
  DROP CONSTRAINT IF EXISTS order_item_sub_item_extras_group_id_fkey,
  ADD CONSTRAINT order_item_sub_item_extras_group_id_fkey 
    FOREIGN KEY (group_id) 
    REFERENCES complement_groups(id) 
    ON DELETE SET NULL;

-- Alterar FK cardapioweb_product_mappings.local_product_id para SET NULL
ALTER TABLE cardapioweb_product_mappings 
  DROP CONSTRAINT IF EXISTS cardapioweb_product_mappings_local_product_id_fkey,
  ADD CONSTRAINT cardapioweb_product_mappings_local_product_id_fkey 
    FOREIGN KEY (local_product_id) 
    REFERENCES products(id) 
    ON DELETE SET NULL;

-- Alterar FK cardapioweb_product_mappings.local_variation_id para SET NULL
ALTER TABLE cardapioweb_product_mappings 
  DROP CONSTRAINT IF EXISTS cardapioweb_product_mappings_local_variation_id_fkey,
  ADD CONSTRAINT cardapioweb_product_mappings_local_variation_id_fkey 
    FOREIGN KEY (local_variation_id) 
    REFERENCES product_variations(id) 
    ON DELETE SET NULL;