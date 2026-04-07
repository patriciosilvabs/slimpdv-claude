
-- ============================================
-- KDS V2: Schema Migration
-- ============================================

-- 1. Novas colunas em order_items
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS next_sector_id uuid REFERENCES public.kds_stations(id),
  ADD COLUMN IF NOT EXISTS has_edge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_by uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS oven_entry_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_exit_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz;

COMMENT ON COLUMN public.order_items.current_station_id IS 'assigned_sector_id - setor KDS atribuído ao item';

-- 2. Adicionar is_edge_sector e oven_time_minutes em kds_stations
ALTER TABLE public.kds_stations
  ADD COLUMN IF NOT EXISTS is_edge_sector boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oven_time_minutes integer NOT NULL DEFAULT 12;

-- 3. Adicionar sector_id em user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS sector_id uuid REFERENCES public.kds_stations(id);

-- 4. Criar tabela sector_presence (heartbeat)
CREATE TABLE IF NOT EXISTS public.sector_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.kds_stations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  device_id text,
  is_online boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid REFERENCES public.tenants(id),
  UNIQUE(sector_id, user_id)
);

ALTER TABLE public.sector_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view sector presence"
  ON public.sector_presence FOR SELECT
  USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can manage own presence"
  ON public.sector_presence FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (belongs_to_tenant(tenant_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.sector_presence;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_order_items_assigned_sector 
  ON public.order_items(current_station_id, station_status) 
  WHERE station_status IN ('waiting', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_order_items_oven 
  ON public.order_items(station_status, estimated_exit_at) 
  WHERE station_status = 'in_oven';

CREATE INDEX IF NOT EXISTS idx_sector_presence_online 
  ON public.sector_presence(sector_id, is_online) 
  WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_order_items_order_status 
  ON public.order_items(order_id, station_status);
