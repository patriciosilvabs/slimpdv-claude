-- 1. Trigger: quando pedido muda de draft para não-draft, rotear todos os itens
CREATE TRIGGER trg_assign_station_on_order_confirm
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_station_on_order_confirm();

-- 2. Trigger: quando novo item é inserido em pedido não-draft, rotear automaticamente
CREATE TRIGGER trg_auto_initialize_new_order_item
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_initialize_new_order_item();
