
ALTER TABLE public.complement_groups
ADD COLUMN applicable_flavor_counts integer[] NOT NULL DEFAULT '{1,2}';

COMMENT ON COLUMN public.complement_groups.applicable_flavor_counts IS 'Indica em quais quantidades de sabor este complemento aparece (ex: {1} = só 1 sabor, {2} = só 2 sabores, {1,2} = ambos)';
