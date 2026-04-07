-- Create trigger for automatic stock deduction when order items are created
CREATE TRIGGER trigger_auto_deduct_stock_for_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deduct_stock_for_order_item();

-- Create trigger for stock restoration when order items are cancelled
CREATE TRIGGER trigger_restore_stock_on_cancellation
  AFTER UPDATE ON public.order_items
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
  EXECUTE FUNCTION public.restore_stock_on_cancellation();