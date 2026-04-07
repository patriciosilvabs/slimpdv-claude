-- Add max_tenants column to subscription_plans table
ALTER TABLE subscription_plans 
ADD COLUMN max_tenants integer DEFAULT 5;

-- Update existing plans with limits
UPDATE subscription_plans SET max_tenants = 3 WHERE name ILIKE '%starter%' OR name ILIKE '%básico%';
UPDATE subscription_plans SET max_tenants = 20 WHERE name ILIKE '%professional%' OR name ILIKE '%profissional%';
UPDATE subscription_plans SET max_tenants = 100 WHERE name ILIKE '%enterprise%' OR name ILIKE '%empresarial%';

-- Add comment
COMMENT ON COLUMN subscription_plans.max_tenants IS 'Maximum number of tenants (stores) allowed for this plan';