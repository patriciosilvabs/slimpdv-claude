ALTER TABLE complement_options ADD COLUMN ifood_code text;
CREATE INDEX idx_complement_options_ifood_code ON complement_options(tenant_id, ifood_code) WHERE ifood_code IS NOT NULL;