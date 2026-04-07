DO $$
DECLARE
  r RECORD;
  canonical_id UUID;
  dup_ids UUID[];
  canonical_group_ids UUID[];
BEGIN
  FOR r IN
    SELECT name, tenant_id
    FROM complement_options
    GROUP BY name, tenant_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO canonical_id
    FROM complement_options
    WHERE name = r.name AND tenant_id = r.tenant_id
    ORDER BY created_at ASC
    LIMIT 1;

    SELECT ARRAY_AGG(id) INTO dup_ids
    FROM complement_options
    WHERE name = r.name AND tenant_id = r.tenant_id AND id != canonical_id;

    -- Get groups already linked to canonical
    SELECT ARRAY_AGG(group_id) INTO canonical_group_ids
    FROM complement_group_options
    WHERE option_id = canonical_id;

    -- Delete duplicate links where canonical already has a link to that group
    IF canonical_group_ids IS NOT NULL THEN
      DELETE FROM complement_group_options
      WHERE option_id = ANY(dup_ids)
        AND group_id = ANY(canonical_group_ids);
    END IF;

    -- Now safely update remaining links (no conflicts possible)
    -- But we need to handle multiple dups pointing to same group:
    -- Keep only one link per group among duplicates
    DELETE FROM complement_group_options a
    USING complement_group_options b
    WHERE a.option_id = ANY(dup_ids)
      AND b.option_id = ANY(dup_ids)
      AND a.group_id = b.group_id
      AND a.id > b.id;

    -- Now update remaining dup links to canonical
    UPDATE complement_group_options
    SET option_id = canonical_id
    WHERE option_id = ANY(dup_ids);

    -- Clean up ingredients and options
    DELETE FROM complement_option_ingredients WHERE complement_option_id = ANY(dup_ids);
    DELETE FROM complement_options WHERE id = ANY(dup_ids);
  END LOOP;
END $$;