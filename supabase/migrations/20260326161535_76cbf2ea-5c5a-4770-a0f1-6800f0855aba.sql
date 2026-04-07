ALTER TABLE cardapioweb_integrations
  ADD COLUMN auto_accept boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_print boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_kds boolean NOT NULL DEFAULT true;