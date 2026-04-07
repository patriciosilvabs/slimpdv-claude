
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to clean up station logs daily
CREATE OR REPLACE FUNCTION public.cleanup_kds_station_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM kds_station_logs
  WHERE created_at < CURRENT_DATE;
END;
$$;

-- Schedule cleanup at 23:59 every day (UTC)
SELECT cron.schedule(
  'cleanup-kds-station-logs-daily',
  '59 23 * * *',
  $$SELECT public.cleanup_kds_station_logs()$$
);
