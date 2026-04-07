import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface OrderWebhook {
  id: string;
  tenant_id: string;
  name: string;
  identifier: string;
  url: string;
  secret: string | null;
  is_active: boolean;
  status: string;
  failure_count: number;
  is_paused: boolean;
  pause_reason: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  events: string[];
  order_types: string[];
  headers: Record<string, string>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  callback_token: string | null;
}

export interface OrderWebhookLog {
  id: string;
  tenant_id: string;
  webhook_id: string;
  identifier: string | null;
  event: string;
  order_id: string | null;
  request_url: string;
  request_body: unknown;
  request_headers: Record<string, string> | null;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  attempted_at: string | null;
  created_at: string;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALL_EVENTS = ['order.created', 'order.pending', 'order.preparing', 'order.ready', 'order.dispatched', 'order.delivered', 'order.cancelled'];
const ALL_ORDER_TYPES = ['delivery'];

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validateIdentifier(identifier: string): string | null {
  if (!identifier) return 'Identificador é obrigatório';
  if (!SLUG_REGEX.test(identifier)) return 'Use apenas letras minúsculas, números e hífen';
  if (identifier.length > 50) return 'Máximo 50 caracteres';
  return null;
}

export function useOrderWebhooks() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['order-webhooks', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('order_webhooks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        headers: (item.headers || {}) as Record<string, string>,
        identifier: item.identifier || '',
        status: item.status || 'active',
        failure_count: item.failure_count || 0,
        is_paused: item.is_paused || false,
        pause_reason: item.pause_reason || null,
        last_success_at: item.last_success_at || null,
        last_failure_at: item.last_failure_at || null,
      })) as OrderWebhook[];
    },
    enabled: !!tenantId,
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['order-webhook-logs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('order_webhook_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .not('event', 'ilike', 'callback.%')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as OrderWebhookLog[];
    },
    enabled: !!tenantId,
  });

  const { data: receiveLogs = [], isLoading: receiveLogsLoading } = useQuery({
    queryKey: ['order-webhook-receive-logs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('order_webhook_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('event', 'callback.%')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as OrderWebhookLog[];
    },
    enabled: !!tenantId,
  });

  const createWebhook = useMutation({
    mutationFn: async (webhook: {
      name: string;
      identifier: string;
      url: string;
      secret?: string;
      events?: string[];
      order_types?: string[];
      auth_url?: string;
      api_url?: string;
      client_id?: string;
      client_secret?: string;
      external_store_id?: string;
      auto_send?: boolean;
    }) => {
      if (!tenantId || !user?.id) throw new Error('Missing tenant or user');

      const identifierError = validateIdentifier(webhook.identifier);
      if (identifierError) throw new Error(identifierError);

      // Check uniqueness
      const existing = webhooks.find(w => w.identifier === webhook.identifier);
      if (existing) throw new Error('Identificador já existe nesta loja');

      const { data, error } = await supabase
        .from('order_webhooks')
        .insert({
          tenant_id: tenantId,
          name: webhook.name,
          identifier: webhook.identifier,
          url: webhook.url,
          secret: webhook.secret || null,
          events: webhook.events || ALL_EVENTS,
          order_types: webhook.order_types || ALL_ORDER_TYPES,
          created_by: user.id,
          status: 'active',
          auth_url: webhook.auth_url || null,
          api_url: webhook.api_url || null,
          client_id: webhook.client_id || null,
          client_secret: webhook.client_secret || null,
          external_store_id: webhook.external_store_id || null,
          auto_send: webhook.auto_send || false,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-webhooks'] });
      toast({ title: 'Webhook criado', description: 'Webhook configurado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const updateWebhook = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OrderWebhook> }) => {
      if (updates.identifier) {
        const identifierError = validateIdentifier(updates.identifier);
        if (identifierError) throw new Error(identifierError);
        const existing = webhooks.find(w => w.identifier === updates.identifier && w.id !== id);
        if (existing) throw new Error('Identificador já existe nesta loja');
      }
      const { error } = await supabase
        .from('order_webhooks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-webhooks'] });
      toast({ title: 'Atualizado', description: 'Webhook atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const reactivateWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('order_webhooks')
        .update({
          is_paused: false,
          pause_reason: null,
          failure_count: 0,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-webhooks'] });
      toast({ title: 'Reativado', description: 'Webhook reativado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('order_webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-webhooks'] });
      toast({ title: 'Removido', description: 'Webhook removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const testWebhook = useMutation({
    mutationFn: async (webhookId: string) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const webhook = webhooks.find(w => w.id === webhookId);
      if (!webhook) throw new Error('Webhook não encontrado');

      const orderTypes = webhook.order_types.length > 0 ? webhook.order_types : ALL_ORDER_TYPES;
      const testEvent = webhook.events[0] || 'order.created';

      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_type')
        .eq('tenant_id', tenantId)
        .eq('is_draft', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (orderError) throw orderError;
      const order = (orders || []).find((item) => orderTypes.includes(item.order_type));
      if (!order) throw new Error('Crie um pedido compatível antes de testar este webhook.');

      const { data, error } = await supabase.functions.invoke('order-webhooks', {
        body: { order_id: order.id, event: testEvent, tenant_id: tenantId, webhook_id: webhookId },
      });
      if (error) throw new Error(error.message);

      const result = Array.isArray((data as any)?.results)
        ? (data as any).results.find((item: any) => item.webhook_id === webhookId)
        : null;

      return { ok: Boolean(result?.success), status: result?.status ?? null, skipped: !result };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order-webhook-logs'] });
      if (data.skipped) {
        toast({ title: 'Teste concluído', description: 'Nenhum envio foi realizado para este webhook.' });
      } else if (data.ok) {
        toast({ title: 'Teste enviado!', description: `Resposta: ${data.status}` });
      } else {
        toast({ title: 'Teste falhou', description: `Status: ${data.status ?? 'sem resposta'}`, variant: 'destructive' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Erro no teste', description: error.message, variant: 'destructive' });
    },
  });

  const fireWebhook = async (orderId: string, event: string) => {
    if (!tenantId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.functions.invoke('order-webhooks', {
        body: { order_id: orderId, event, tenant_id: tenantId },
      });
    } catch (err) {
      console.error('Failed to fire webhook:', err);
    }
  };

  // Realtime subscription for logs
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel('webhook-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_webhook_logs', filter: `tenant_id=eq.${tenantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['order-webhook-logs', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['order-webhook-receive-logs', tenantId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  return {
    webhooks, logs, receiveLogs,
    isLoading, logsLoading, receiveLogsLoading,
    createWebhook, updateWebhook, reactivateWebhook, deleteWebhook, testWebhook, fireWebhook,
  };
}
