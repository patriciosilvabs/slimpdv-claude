
-- 1. Fix MONTAGEM 2 station_type
UPDATE kds_stations SET station_type = 'item_assembly' 
WHERE id = '0f63b49b-f58e-4242-9bcc-98f4dda82721' AND station_type = 'assembly';

-- 2. Recreate get_least_loaded_sector as VOLATILE with broader filter
CREATE OR REPLACE FUNCTION public.get_least_loaded_sector(_tenant_id uuid, _exclude_edge boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sector_id uuid;
BEGIN
  SELECT ks.id INTO v_sector_id
  FROM kds_stations ks
  LEFT JOIN (
    SELECT current_station_id, COUNT(*) as item_count
    FROM order_items
    WHERE station_status IN ('waiting', 'in_progress')
      AND tenant_id = _tenant_id
    GROUP BY current_station_id
  ) counts ON counts.current_station_id = ks.id
  WHERE ks.tenant_id = _tenant_id
    AND ks.is_active = true
    AND ks.station_type IN ('item_assembly', 'assembly')
    AND (NOT _exclude_edge OR ks.is_edge_sector = false)
  ORDER BY COALESCE(counts.item_count, 0) ASC, ks.sort_order ASC
  LIMIT 1;
  
  RETURN v_sector_id;
END;
$$;

-- 3. Recreate get_least_loaded_sector_online as VOLATILE with broader filter
CREATE OR REPLACE FUNCTION public.get_least_loaded_sector_online(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sector_id uuid;
BEGIN
  SELECT ks.id INTO v_sector_id
  FROM kds_stations ks
  INNER JOIN sector_presence sp ON sp.sector_id = ks.id
    AND sp.is_online = true
    AND sp.last_seen_at > now() - interval '30 seconds'
  LEFT JOIN (
    SELECT current_station_id, COUNT(*) as item_count
    FROM order_items
    WHERE station_status IN ('waiting', 'in_progress')
      AND tenant_id = _tenant_id
    GROUP BY current_station_id
  ) counts ON counts.current_station_id = ks.id
  WHERE ks.tenant_id = _tenant_id
    AND ks.is_active = true
    AND ks.station_type IN ('item_assembly', 'assembly')
    AND ks.is_edge_sector = false
  ORDER BY COALESCE(counts.item_count, 0) ASC, ks.sort_order ASC
  LIMIT 1;
  
  IF v_sector_id IS NULL THEN
    v_sector_id := get_least_loaded_sector(_tenant_id, true);
  END IF;
  
  RETURN v_sector_id;
END;
$$;
