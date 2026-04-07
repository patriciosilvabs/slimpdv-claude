-- Create triggers for automatic stock deduction

-- 1. Deduct stock when order items are inserted
CREATE TRIGGER trigger_deduct_stock_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deduct_stock_for_order_item();

-- 2. Deduct stock when order item extras are inserted
CREATE TRIGGER trigger_deduct_stock_extras
  AFTER INSERT ON public.order_item_extras
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deduct_stock_for_extras();

-- 3. Restore stock when order items are cancelled
CREATE TRIGGER trigger_restore_stock_cancellation
  AFTER UPDATE ON public.order_items
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.restore_stock_on_cancellation();