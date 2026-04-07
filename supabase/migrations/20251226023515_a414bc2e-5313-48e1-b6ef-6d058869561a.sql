-- Temporarily disable the trigger to fix the data inconsistency
ALTER TABLE public.tenant_members DISABLE TRIGGER prevent_owner_removal;

-- Delete the orphaned/incorrect owner entry (user with no profile)
DELETE FROM public.tenant_members 
WHERE user_id = '15e837c4-9dfe-4f88-b889-db070b44a50d';

-- Re-enable the trigger
ALTER TABLE public.tenant_members ENABLE TRIGGER prevent_owner_removal;