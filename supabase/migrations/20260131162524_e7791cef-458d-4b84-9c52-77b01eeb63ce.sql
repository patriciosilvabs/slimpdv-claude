-- =============================================
-- SISPRO: Fase 1A - Adicionar novas permissões ao enum
-- =============================================

ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'production_view';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'production_manage';
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'targets_manage';