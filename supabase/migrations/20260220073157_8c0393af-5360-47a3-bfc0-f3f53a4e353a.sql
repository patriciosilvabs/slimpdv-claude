-- Fix: Update "Despachado - Item Servido na mesa" station type from 'custom' to 'order_status'
UPDATE kds_stations 
SET station_type = 'order_status' 
WHERE id = '2ebd0f1a-6b97-4f83-8dd6-c70ffc3ceeb0' 
  AND station_type = 'custom';