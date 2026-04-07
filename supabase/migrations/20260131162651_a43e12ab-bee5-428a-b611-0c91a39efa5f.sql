-- Corrigir view v_production_demand para usar SECURITY INVOKER
DROP VIEW IF EXISTS public.v_production_demand;

CREATE VIEW public.v_production_demand 
WITH (security_invoker = true)
AS
SELECT 
  t.tenant_id,
  ten.name as store_name,
  t.ingredient_id,
  i.name as ingredient_name,
  i.unit,
  t.day_of_week,
  t.target_quantity as ideal_stock,
  COALESCE(i.current_stock, 0) as current_stock,
  GREATEST(0, t.target_quantity - COALESCE(i.current_stock, 0)) as to_produce,
  CASE 
    WHEN COALESCE(i.current_stock, 0) >= t.target_quantity THEN 'ok'
    WHEN COALESCE(i.current_stock, 0) >= t.target_quantity * 0.5 THEN 'warning'
    ELSE 'critical'
  END as status
FROM public.ingredient_daily_targets t
JOIN public.tenants ten ON ten.id = t.tenant_id
JOIN public.ingredients i ON i.id = t.ingredient_id AND i.tenant_id = t.tenant_id
WHERE t.day_of_week = EXTRACT(DOW FROM NOW())::integer;