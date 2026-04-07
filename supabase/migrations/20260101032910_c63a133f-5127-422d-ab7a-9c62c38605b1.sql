-- Add cash_view_difference to permission_code enum
ALTER TYPE permission_code ADD VALUE IF NOT EXISTS 'cash_view_difference';