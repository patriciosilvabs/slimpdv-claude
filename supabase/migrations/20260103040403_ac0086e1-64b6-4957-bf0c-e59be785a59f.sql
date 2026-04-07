-- 1. Limpar dados legados: remover table_id de pedidos delivered
UPDATE public.orders
SET table_id = NULL
WHERE status = 'delivered' AND table_id IS NOT NULL;

-- 2. Criar função para limpar table_id automaticamente quando pedido vira delivered
CREATE OR REPLACE FUNCTION public.clear_table_id_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.table_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar trigger para executar a função
CREATE TRIGGER auto_clear_table_id_on_delivery
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_table_id_on_delivery();