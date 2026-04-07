-- Tabela para auditoria de cancelamentos de itens individuais
CREATE TABLE public.order_item_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  table_id UUID REFERENCES public.tables(id),
  
  -- Dados do item no momento do cancelamento
  product_name TEXT NOT NULL,
  variation_name TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  
  -- Dados do pedido
  order_type TEXT,
  table_number INTEGER,
  customer_name TEXT,
  
  -- Auditoria
  cancellation_reason TEXT NOT NULL,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Tenant
  tenant_id UUID REFERENCES public.tenants(id)
);

-- Índices para consultas
CREATE INDEX idx_item_cancellations_tenant ON public.order_item_cancellations(tenant_id);
CREATE INDEX idx_item_cancellations_date ON public.order_item_cancellations(cancelled_at);
CREATE INDEX idx_item_cancellations_order ON public.order_item_cancellations(order_id);

-- Habilitar RLS
ALTER TABLE public.order_item_cancellations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Tenant members can view item cancellations"
ON public.order_item_cancellations FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can create item cancellations"
ON public.order_item_cancellations FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));