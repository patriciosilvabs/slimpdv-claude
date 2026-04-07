import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/hooks/useUserRole';

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: AppRole;
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export function useTenantInvitations() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading, error } = useQuery({
    queryKey: ['tenant-invitations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('tenant_invitations')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TenantInvitation[];
    },
    enabled: !!tenantId,
  });

  const createInvitation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('tenant_invitations')
        .insert({
          tenant_id: tenantId,
          email: email.toLowerCase().trim(),
          role,
          invited_by: userData.user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este email já foi convidado');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Convite enviado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations', tenantId] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao enviar convite', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const deleteInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('tenant_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Convite cancelado!' });
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations', tenantId] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao cancelar convite', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  return {
    invitations: invitations ?? [],
    isLoading,
    error,
    createInvitation,
    deleteInvitation,
  };
}

// Hook for accepting invitations (used on accept page)
export function useAcceptInvitation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Você precisa estar logado para aceitar o convite');

      // First, get the invitation
      const { data: invitation, error: fetchError } = await supabase
        .from('tenant_invitations')
        .select('*')
        .eq('token', token)
        .is('accepted_at', null)
        .single();

      if (fetchError || !invitation) {
        throw new Error('Convite não encontrado ou já foi aceito');
      }

      // Check if invitation expired
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('Este convite expirou');
      }

      // Check if user email matches invitation email
      if (userData.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error('Este convite foi enviado para outro email');
      }

      // Add user to tenant_members
      const { error: memberError } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: invitation.tenant_id,
          user_id: userData.user.id,
          is_owner: false,
          joined_at: new Date().toISOString(),
          invited_by: invitation.invited_by,
        });

      if (memberError) {
        if (memberError.code === '23505') {
          throw new Error('Você já é membro deste restaurante');
        }
        throw memberError;
      }

      // Add user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userData.user.id,
          tenant_id: invitation.tenant_id,
          role: invitation.role,
        });

      if (roleError && roleError.code !== '23505') {
        throw roleError;
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('tenant_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      return invitation;
    },
    onSuccess: () => {
      toast({ title: 'Convite aceito com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['tenant-membership'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao aceitar convite', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}
