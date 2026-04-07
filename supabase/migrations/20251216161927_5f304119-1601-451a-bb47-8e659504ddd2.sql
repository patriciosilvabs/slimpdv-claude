-- Add price_calculation_type column to complement_groups
ALTER TABLE complement_groups 
ADD COLUMN price_calculation_type text DEFAULT 'sum';

COMMENT ON COLUMN complement_groups.price_calculation_type IS 'How to calculate price: sum, average, highest, lowest';