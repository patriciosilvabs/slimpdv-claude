-- Create tenant_invitations table for managing invites
CREATE TABLE public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'waiter',
  invited_by UUID REFERENCES auth.users(id),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- Enable RLS
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant members can view invitations for their tenant
CREATE POLICY "Tenant members can view invitations"
ON public.tenant_invitations
FOR SELECT
USING (public.belongs_to_tenant(tenant_id));

-- Policy: Tenant owners can create invitations
CREATE POLICY "Tenant owners can create invitations"
ON public.tenant_invitations
FOR INSERT
WITH CHECK (public.is_tenant_owner(tenant_id));

-- Policy: Tenant owners can delete invitations
CREATE POLICY "Tenant owners can delete invitations"
ON public.tenant_invitations
FOR DELETE
USING (public.is_tenant_owner(tenant_id));

-- Policy: Anyone can view their own invitation by token (for accepting)
CREATE POLICY "Users can view invitation by token"
ON public.tenant_invitations
FOR SELECT
USING (token IS NOT NULL);

-- Policy: Anyone can update their invitation to accept it
CREATE POLICY "Users can accept invitations"
ON public.tenant_invitations
FOR UPDATE
USING (token IS NOT NULL AND accepted_at IS NULL)
WITH CHECK (accepted_at IS NOT NULL);

-- Add index for faster lookups
CREATE INDEX idx_tenant_invitations_email ON public.tenant_invitations(email);
CREATE INDEX idx_tenant_invitations_token ON public.tenant_invitations(token);