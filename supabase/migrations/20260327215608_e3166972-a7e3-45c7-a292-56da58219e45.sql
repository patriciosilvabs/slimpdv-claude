ALTER TABLE complement_options ADD COLUMN external_code text;

CREATE INDEX idx_complement_options_external_code 
  ON complement_options(tenant_id, external_code) 
  WHERE external_code IS NOT NULL;