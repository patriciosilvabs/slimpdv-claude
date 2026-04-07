-- Remover a constraint única global que causa conflito entre tenants
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_number_key;

-- Criar índice único composto para garantir número único POR tenant
CREATE UNIQUE INDEX tables_tenant_number_key ON public.tables (tenant_id, number);