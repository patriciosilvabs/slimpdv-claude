
CREATE OR REPLACE FUNCTION public.assign_station_on_order_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  first_station_id UUID;
BEGIN
  IF OLD.is_draft = TRUE AND NEW.is_draft = FALSE THEN
    SELECT id INTO first_station_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type != 'order_status'
      AND tenant_id = NEW.tenant_id
    ORDER BY sort_order ASC
    LIMIT 1;
    
    IF first_station_id IS NOT NULL THEN
      UPDATE order_items
      SET current_station_id = first_station_id,
          station_status = 'waiting'
      WHERE order_id = NEW.id
        AND current_station_id IS NULL
        AND (station_status IS NULL OR station_status = 'waiting');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_station_on_confirm
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_station_on_order_confirm();
