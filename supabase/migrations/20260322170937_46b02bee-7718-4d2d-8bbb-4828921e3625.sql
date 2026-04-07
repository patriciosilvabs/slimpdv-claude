
-- Rewrite assign_station_on_order_confirm: all items go to first active production station
CREATE OR REPLACE FUNCTION assign_station_on_order_confirm()
RETURNS TRIGGER AS $$
DECLARE
  first_station_id UUID;
BEGIN
  IF OLD.is_draft = TRUE AND NEW.is_draft = FALSE THEN

    -- Find first active production station (excluding order_status)
    SELECT id INTO first_station_id
    FROM kds_stations
    WHERE is_active = TRUE
      AND station_type != 'order_status'
      AND tenant_id = NEW.tenant_id
    ORDER BY sort_order ASC
    LIMIT 1;

    -- If no station found, do nothing
    IF first_station_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Assign ALL items to the first station sequentially
    UPDATE order_items
    SET current_station_id = first_station_id,
        station_status = 'waiting',
        next_sector_id = NULL,
        has_edge = false
    WHERE order_id = NEW.id
      AND current_station_id IS NULL
      AND (station_status IS NULL OR station_status = 'waiting');

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Rewrite auto_initialize_new_order_item: new items go to first active production station
CREATE OR REPLACE FUNCTION auto_initialize_new_order_item()
RETURNS TRIGGER AS $$
DECLARE
  first_station_id UUID;
  order_is_draft BOOLEAN;
  order_current_status TEXT;
  order_tenant_id UUID;
BEGIN
  SELECT is_draft, status, tenant_id INTO order_is_draft, order_current_status, order_tenant_id
  FROM orders
  WHERE id = NEW.order_id;

  IF (order_is_draft = FALSE AND NEW.current_station_id IS NULL) THEN

    -- Find first active production station (excluding order_status)
    SELECT id INTO first_station_id
    FROM kds_stations
    WHERE is_active = TRUE
      AND station_type != 'order_status'
      AND tenant_id = order_tenant_id
    ORDER BY sort_order ASC
    LIMIT 1;

    IF first_station_id IS NOT NULL THEN
      NEW.current_station_id := first_station_id;
      NEW.station_status := 'waiting';
      NEW.next_sector_id := NULL;
      NEW.has_edge := false;
    END IF;

    -- Reopen delivered orders when new items are added
    IF order_current_status = 'delivered' THEN
      UPDATE orders
      SET status = 'preparing', ready_at = NULL, updated_at = now()
      WHERE id = NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
