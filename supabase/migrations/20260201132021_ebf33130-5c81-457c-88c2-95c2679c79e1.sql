-- Alterar FK de group_id para SET NULL
ALTER TABLE public.order_item_sub_item_extras
  DROP CONSTRAINT IF EXISTS order_item_sub_item_extras_group_id_fkey;

ALTER TABLE public.order_item_sub_item_extras
  ADD CONSTRAINT order_item_sub_item_extras_group_id_fkey
    FOREIGN KEY (group_id)
    REFERENCES public.complement_groups(id)
    ON DELETE SET NULL;

-- Alterar FK de option_id para SET NULL
ALTER TABLE public.order_item_sub_item_extras
  DROP CONSTRAINT IF EXISTS order_item_sub_item_extras_option_id_fkey;

ALTER TABLE public.order_item_sub_item_extras
  ADD CONSTRAINT order_item_sub_item_extras_option_id_fkey
    FOREIGN KEY (option_id)
    REFERENCES public.complement_options(id)
    ON DELETE SET NULL;