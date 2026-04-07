-- Fase 1.1: Tabela de Praças (Workstations)
CREATE TABLE public.kds_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  station_type text NOT NULL DEFAULT 'custom', -- 'prep_start', 'assembly', 'oven_expedite', 'custom'
  description text,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'ChefHat',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fase 1.2: Tabela de Dispositivos KDS
CREATE TABLE public.kds_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL, -- UUID gerado pelo navegador
  name text NOT NULL,
  station_id uuid REFERENCES kds_stations(id) ON DELETE SET NULL,
  operation_mode text DEFAULT 'traditional', -- 'traditional', 'production_line'
  last_seen_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Fase 1.3: Estender order_items para rastreio por praça
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS current_station_id uuid REFERENCES kds_stations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS station_status text DEFAULT 'waiting', -- waiting, in_progress, done
ADD COLUMN IF NOT EXISTS station_started_at timestamptz,
ADD COLUMN IF NOT EXISTS station_completed_at timestamptz;

-- Fase 1.4: Tabela de Log de Métricas por Praça
CREATE TABLE public.kds_station_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid REFERENCES order_items(id) ON DELETE CASCADE NOT NULL,
  station_id uuid REFERENCES kds_stations(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL, -- 'entered', 'started', 'completed', 'skipped'
  performed_by uuid,
  duration_seconds integer, -- tempo na praça (calculado ao sair)
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.kds_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_station_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para kds_stations
CREATE POLICY "Admins can manage KDS stations"
ON public.kds_stations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view KDS stations"
ON public.kds_stations FOR SELECT
USING (is_employee(auth.uid()));

-- Políticas para kds_devices
CREATE POLICY "Admins can manage KDS devices"
ON public.kds_devices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view KDS devices"
ON public.kds_devices FOR SELECT
USING (is_employee(auth.uid()));

CREATE POLICY "Employees can update their own device"
ON public.kds_devices FOR UPDATE
USING (is_employee(auth.uid()));

CREATE POLICY "Employees can insert devices"
ON public.kds_devices FOR INSERT
WITH CHECK (is_employee(auth.uid()));

-- Políticas para kds_station_logs
CREATE POLICY "Employees can create station logs"
ON public.kds_station_logs FOR INSERT
WITH CHECK (is_employee(auth.uid()));

CREATE POLICY "Employees can view station logs"
ON public.kds_station_logs FOR SELECT
USING (is_employee(auth.uid()));

-- Trigger para updated_at em kds_stations
CREATE TRIGGER update_kds_stations_updated_at
BEFORE UPDATE ON public.kds_stations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Habilitar Realtime nas novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.kds_stations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kds_station_logs;

-- Inserir praças padrão para pizzaria (podem ser desativadas se não usadas)
INSERT INTO public.kds_stations (name, station_type, description, color, icon, sort_order) VALUES
('Início e Bordas', 'prep_start', 'Preparação da base e bordas recheadas', '#F59E0B', 'Circle', 1),
('Montagem', 'assembly', 'Montagem e recheio das pizzas', '#3B82F6', 'Layers', 2),
('Forno e Expedição', 'oven_expedite', 'Assamento e finalização', '#EF4444', 'Flame', 3);