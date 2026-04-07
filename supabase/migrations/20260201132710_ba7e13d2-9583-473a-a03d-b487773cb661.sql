-- Alterar FKs de complement_group_options para SET NULL
ALTER TABLE public.complement_group_options
  DROP CONSTRAINT IF EXISTS complement_group_options_group_id_fkey;

ALTER TABLE public.complement_group_options
  ADD CONSTRAINT complement_group_options_group_id_fkey 
    FOREIGN KEY (group_id) REFERENCES public.complement_groups(id) ON DELETE SET NULL;

ALTER TABLE public.complement_group_options
  DROP CONSTRAINT IF EXISTS complement_group_options_option_id_fkey;

ALTER TABLE public.complement_group_options
  ADD CONSTRAINT complement_group_options_option_id_fkey 
    FOREIGN KEY (option_id) REFERENCES public.complement_options(id) ON DELETE SET NULL;

-- Alterar FKs de product_complement_groups para SET NULL
ALTER TABLE public.product_complement_groups
  DROP CONSTRAINT IF EXISTS product_complement_groups_group_id_fkey;

ALTER TABLE public.product_complement_groups
  ADD CONSTRAINT product_complement_groups_group_id_fkey 
    FOREIGN KEY (group_id) REFERENCES public.complement_groups(id) ON DELETE SET NULL;

ALTER TABLE public.product_complement_groups
  DROP CONSTRAINT IF EXISTS product_complement_groups_product_id_fkey;

ALTER TABLE public.product_complement_groups
  ADD CONSTRAINT product_complement_groups_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Alterar FKs de complement_option_ingredients para SET NULL
ALTER TABLE public.complement_option_ingredients
  DROP CONSTRAINT IF EXISTS complement_option_ingredients_complement_option_id_fkey;

ALTER TABLE public.complement_option_ingredients
  ADD CONSTRAINT complement_option_ingredients_complement_option_id_fkey 
    FOREIGN KEY (complement_option_id) REFERENCES public.complement_options(id) ON DELETE SET NULL;

-- Alterar FKs de product_ingredients para SET NULL
ALTER TABLE public.product_ingredients
  DROP CONSTRAINT IF EXISTS product_ingredients_product_id_fkey;

ALTER TABLE public.product_ingredients
  ADD CONSTRAINT product_ingredients_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Alterar FKs de product_extra_links para SET NULL
ALTER TABLE public.product_extra_links
  DROP CONSTRAINT IF EXISTS product_extra_links_product_id_fkey;

ALTER TABLE public.product_extra_links
  ADD CONSTRAINT product_extra_links_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.product_extra_links
  DROP CONSTRAINT IF EXISTS product_extra_links_extra_id_fkey;

ALTER TABLE public.product_extra_links
  ADD CONSTRAINT product_extra_links_extra_id_fkey 
    FOREIGN KEY (extra_id) REFERENCES public.product_extras(id) ON DELETE SET NULL;