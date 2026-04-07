import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOrderWebhooks, generateSlug, validateIdentifier, type OrderWebhook, type OrderWebhookLog } from '@/hooks/useOrderWebhooks';
import { useStoreApiToken } from '@/hooks/useStoreApiToken';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, TestTube, Globe, Eye, EyeOff, Clock, CheckCircle, XCircle, Pencil, Copy, Link, ArrowDownLeft, MonitorSmartphone, Key, RefreshCw, AlertTriangle, Play, Tag, Zap, Info, Filter, RotateCcw, ChevronDown, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

const EVENT_LABELS: Record<string, string> = {
  'order.created': 'Pedido Criado',
  'order.pending': 'Pedido Pendente',
  'order.preparing': 'Em Preparo',
  'order.ready': 'Pedido Pronto',
  'order.dispatched': 'Despachado',
  'order.delivered': 'Pedido Entregue',
  'order.cancelled': 'Pedido Cancelado',
};

const CALLBACK_EVENT_LABELS: Record<string, string> = {
  'callback.preparing': 'Preparando',
  'callback.ready': 'Pronto',
  'callback.dispatched': 'Despachado',
  'callback.delivered': 'Entregue',
  'callback.cancelled': 'Cancelado',
  'callback.auth_failed': 'Falha de autenticação',
  'callback.rejected': 'Rejeitado',
  'callback.validation_error': 'Erro de validação',
  'callback.order_not_found': 'Pedido não encontrado',
  'callback.error': 'Erro interno',
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  takeaway: 'Retirada',
  dine_in: 'Mesa',
  counter: 'Balcão',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  paused: { label: 'Pausado', variant: 'secondary' },
  disabled: { label: 'Desativado', variant: 'destructive' },
};

const ERROR_TRANSLATIONS: Record<number, string> = {
  200: 'Pedido enviado com sucesso',
  201: 'Pedido enviado com sucesso',
  400: 'Dados rejeitados pelo destino',
  401: 'Verifique o Token de autenticação',
  403: 'Verifique o Token de autenticação',
  404: 'Verifique se a URL está correta',
  408: 'Verifique sua internet ou tente novamente',
  500: 'O sistema de destino está com problemas',
  502: 'O sistema de destino está com problemas',
  503: 'O sistema de destino está com problemas',
};

function translateStatus(log: OrderWebhookLog): string {
  if (log.success) return 'Pedido enviado com sucesso';
  if (log.error_message?.toLowerCase().includes('timeout')) return 'Verifique sua internet ou tente novamente';
  if (log.response_status && ERROR_TRANSLATIONS[log.response_status]) return ERROR_TRANSLATIONS[log.response_status];
  return 'Erro no envio. Tente reenviar.';
}

function getLogOrderLabel(log: OrderWebhookLog): string {
  const rb = log.request_body as any;
  if (rb?.order?.external_display_id) return `#${rb.order.external_display_id}`;
  if (rb?.order?.external_order_id) return `#${rb.order.external_order_id}`;
  if (rb?.external_id) return `#${rb.external_id}`;
  if (log.order_id) return `#${log.order_id.slice(0, 8)}`;
  return '—';
}

const ALL_EVENTS = Object.keys(EVENT_LABELS);
const ALL_ORDER_TYPES = Object.keys(ORDER_TYPE_LABELS);

function maskToken(token: string): string {
  if (token.length <= 8) return '••••••••';
  return token.slice(0, 4) + '••••••••' + token.slice(-4);
}

export function WebhooksSettings() {
  const { webhooks, logs, receiveLogs, isLoading, logsLoading, receiveLogsLoading, createWebhook, updateWebhook, reactivateWebhook, deleteWebhook, testWebhook } = useOrderWebhooks();
  const { token: storeToken, isLoading: tokenLoading, generateToken, regenerateToken } = useStoreApiToken();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const callbackBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generic-order-webhook`;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<OrderWebhook | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [detailLog, setDetailLog] = useState<OrderWebhookLog | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'errors'>('all');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(ALL_EVENTS);
  const [selectedOrderTypes, setSelectedOrderTypes] = useState<string[]>([]);
  const [authUrl, setAuthUrl] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [externalStoreId, setExternalStoreId] = useState('');
  const [autoSend, setAutoSend] = useState(false);

  // Auto-generate slug from name
  useEffect(() => {
    if (!identifierTouched && !editingWebhook) {
      setIdentifier(generateSlug(name));
    }
  }, [name, identifierTouched, editingWebhook]);

  const identifierError = identifier ? validateIdentifier(identifier) : null;

  const resetForm = () => {
    setName(''); setIdentifier(''); setIdentifierTouched(false); setUrl(''); setSecret('');
    setSelectedEvents(ALL_EVENTS); setSelectedOrderTypes([]);
    setEditingWebhook(null); setShowSecret(false);
    setAuthUrl(''); setApiUrl(''); setClientId(''); setClientSecret(''); setExternalStoreId(''); setAutoSend(false);
  };

  const openCreateDialog = () => { resetForm(); setDialogOpen(true); };

  const openEditDialog = (wh: OrderWebhook) => {
    setEditingWebhook(wh); setName(wh.name); setIdentifier(wh.identifier); setIdentifierTouched(true);
    setUrl(wh.url); setSecret(wh.secret || ''); setSelectedEvents(wh.events);
    setSelectedOrderTypes(wh.order_types); setDialogOpen(true);
    setAuthUrl((wh as any).auth_url || ''); setApiUrl((wh as any).api_url || '');
    setClientId((wh as any).client_id || ''); setClientSecret((wh as any).client_secret || '');
    setExternalStoreId((wh as any).external_store_id || ''); setAutoSend((wh as any).auto_send || false);
  };

  const handleSave = async () => {
    if (!name || !url) return;
    if (!secret && !clientSecret) {
      toast({ title: 'Token obrigatório', description: 'Preencha o Token de Autenticação (Secret) para que o destino aceite as notificações.', variant: 'destructive' });
      return;
    }
    const slug = editingWebhook ? editingWebhook.identifier : generateSlug(name);
    if (!slug) return;
    const slugError = validateIdentifier(slug);
    if (slugError) { toast({ title: 'Erro', description: slugError, variant: 'destructive' }); return; }
    if (editingWebhook) {
      await updateWebhook.mutateAsync({ id: editingWebhook.id, updates: { name, identifier: slug, url, secret: secret || null, events: selectedEvents, order_types: selectedOrderTypes, client_secret: clientSecret || null, auto_send: autoSend } as any });
    } else {
      await createWebhook.mutateAsync({ name, identifier: slug, url, secret, events: selectedEvents, order_types: selectedOrderTypes, client_secret: clientSecret || undefined, auto_send: autoSend } as any);
    }
    setDialogOpen(false); resetForm();
  };

  const toggleEvent = (event: string) => setSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  const toggleOrderType = (type: string) => setSelectedOrderTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  const handleTestConnection = async () => {
    if (!url) {
      toast({ title: 'URL obrigatória', description: 'Preencha a URL antes de testar.', variant: 'destructive' });
      return;
    }
    setTestingConnection(true);
    try {
      const customHeaders: Record<string, string> = {};
      if (clientSecret && !authUrl) {
        customHeaders['Authorization'] = `Bearer ${clientSecret}`;
      }
      if (secret) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const msgData = encoder.encode(JSON.stringify({ external_id: 'TEST-0001', customer_name: 'Cliente de Teste', customer_address: 'Rua de Teste, 123 - Centro', total: 0, is_test: true }));
        const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        const hexSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
        customHeaders['X-Webhook-Signature'] = `sha256=${hexSig}`;
      }

      const { data, error } = await supabase.functions.invoke('test-webhook-connection', {
        body: {
          url,
          headers: customHeaders,
          payload: { external_id: 'TEST-0001', customer_name: 'Cliente de Teste', customer_address: 'Rua de Teste, 123 - Centro', total: 0, is_test: true },
          tenant_id: tenantId,
          webhook_id: editingWebhook?.id || null,
        },
      });

      if (error) throw new Error(error.message);

      queryClient.invalidateQueries({ queryKey: ['order-webhook-logs'] });

      if (data?.success) {
        const respBody = data.response_body?.substring(0, 200) || '(vazio)';
        toast({ title: '✅ Conexão estabelecida!', description: `Status ${data.status} em ${data.duration_ms}ms — Resposta: ${respBody}` });
      } else {
        const respBody = data?.response_body?.substring(0, 200);
        const detail = respBody ? `\nResposta: ${respBody}` : '';
        toast({
          title: '❌ Erro na conexão',
          description: (data?.error || `Status: ${data?.status ?? 'sem resposta'}. Verifique a URL e o Token.`) + detail,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Erro no teste', description: err.message, variant: 'destructive' });
    } finally {
      setTestingConnection(false);
    }
  };

  const getLogMeta = (log: OrderWebhookLog) => {
    const rb = log.request_body as any;
    if (rb && typeof rb === 'object' && 'ip' in rb) {
      return { ip: rb.ip as string, headers: rb.headers as Record<string, string>, payload: rb.payload };
    }
    return { ip: null, headers: log.request_headers || null, payload: rb };
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: `${label} copiado para a área de transferência.` });
  };

  return (
    <div className="space-y-6">
      {/* ── Token da Loja ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />Token de API da Loja</CardTitle>
          <CardDescription>Token exclusivo para autenticar integrações externas com esta loja.</CardDescription>
        </CardHeader>
        <CardContent>
          {tokenLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : storeToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                  {showToken ? storeToken.api_token : maskToken(storeToken.api_token)}
                </code>
                <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(storeToken.api_token, 'Token')}>
                  <Copy className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" />Regenerar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regenerar Token?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O token atual será invalidado. Todas as integrações que usam o token antigo deixarão de funcionar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => regenerateToken.mutate()}>Regenerar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="text-xs text-muted-foreground">
                Atualizado em {format(new Date(storeToken.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">Nenhum token gerado para esta loja.</p>
              <Button onClick={() => generateToken.mutate()} disabled={generateToken.isPending}>
                <Key className="h-4 w-4 mr-2" />Gerar Token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="webhooks">
        <TabsList>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="logs">Logs de Envio</TabsTrigger>
          <TabsTrigger value="receive-logs" className="flex items-center gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5" />
            Logs de Recebimento
          </TabsTrigger>
        </TabsList>

        {/* ── Webhooks Tab ── */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Delivery Pay</CardTitle>
                <CardDescription>Configure a integração de saída para envio automático de pedidos delivery à plataforma de logística.</CardDescription>
              </div>
              <Button onClick={openCreateDialog} size="sm"><Plus className="h-4 w-4 mr-2" />Novo Webhook</Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum webhook configurado</p>
                  <p className="text-xs mt-1">Crie um webhook para enviar dados de pedidos para plataformas externas.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((wh) => {
                    const statusCfg = STATUS_CONFIG[wh.status] || STATUS_CONFIG.active;
                    return (
                      <div key={wh.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{wh.name}</span>
                            <Badge variant={statusCfg.variant} className="text-xs">{statusCfg.label}</Badge>
                            {(wh as any).auto_send && <Badge variant="outline" className="text-xs border-emerald-400 text-emerald-700">Envio ativo</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{wh.url}</p>

                          {/* Paused warning */}
                          {wh.is_paused && (
                            <div className="flex items-center gap-2 mt-1 p-2 rounded bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                              <span className="text-xs text-yellow-700 dark:text-yellow-400">{wh.pause_reason || 'Pausado por falhas consecutivas'}</span>
                              <Button
                                variant="outline" size="sm" className="h-6 text-xs ml-auto gap-1"
                                onClick={() => reactivateWebhook.mutate(wh.id)}
                                disabled={reactivateWebhook.isPending}
                              >
                                <Play className="h-3 w-3" />Reativar
                              </Button>
                            </div>
                          )}

                          {(wh as any).callback_token && (
                            <div className="flex items-center gap-1 mt-1">
                              <Button
                                variant="outline" size="sm" className="h-6 text-xs gap-1.5"
                                onClick={() => copyToClipboard(callbackBaseUrl, 'URL de retorno')}
                              >
                                <Copy className="h-3 w-3" />Copiar URL de retorno
                              </Button>
                              <Button
                                variant="outline" size="sm" className="h-6 text-xs gap-1.5"
                                onClick={() => copyToClipboard((wh as any).callback_token, 'Token Bearer')}
                              >
                                <Copy className="h-3 w-3" />Copiar Token
                              </Button>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {wh.order_types.length === 0 ? (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">Todos os tipos</Badge>
                            ) : (
                              wh.order_types.map(t => (<Badge key={t} variant="outline" className="text-xs">{ORDER_TYPE_LABELS[t] || t}</Badge>))
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {wh.events.map(e => (<Badge key={e} variant="outline" className="text-xs">{EVENT_LABELS[e] || e}</Badge>))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Switch checked={wh.is_active} onCheckedChange={(checked) => updateWebhook.mutate({ id: wh.id, updates: { is_active: checked } })} />
                          <Button variant="ghost" size="icon" onClick={() => testWebhook.mutate(wh.id)} disabled={testWebhook.isPending}><TestTube className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(wh)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteWebhook.mutate(wh.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs de Envio Tab ── */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Logs de Envio</CardTitle>
                  <CardDescription>Histórico dos últimos 7 dias.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant={logFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setLogFilter('all')}>
                    Todos
                  </Button>
                  <Button variant={logFilter === 'errors' ? 'destructive' : 'outline'} size="sm" onClick={() => setLogFilter('errors')} className="gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />Apenas Erros
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado.</p>
              ) : (() => {
                const filteredLogs = logFilter === 'errors' ? logs.filter(l => !l.success) : logs;
                return filteredLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum erro nos últimos 7 dias. 🎉</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredLogs.map((log) => {
                      const isTest = log.event === 'test.connection';
                      const rb = log.request_body as any;
                      const dispatchStatus = (rb && typeof rb === 'object' && 'dispatch_status' in (log as any)) ? (log as any).dispatch_status : (log.success ? 'sent' : 'error');
                      const skipReason = (log as any).skip_reason as string | null;
                      const isSkipped = dispatchStatus === 'skipped';
                      return (
                        <div
                          key={log.id}
                          className="flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => { setShowTechnicalDetails(false); setDetailLog(log); }}
                        >
                          <div className="flex-shrink-0">
                            {isTest ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800 text-xs">Teste</Badge>
                            ) : isSkipped ? (
                              <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800 text-xs">Ignorado</Badge>
                            ) : log.success ? (
                              <Badge variant="outline" className="bg-green-50 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800 text-xs">Enviado</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800 text-xs">Erro</Badge>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{getLogOrderLabel(log)}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground text-xs">{EVENT_LABELS[log.event] || log.event}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{isSkipped && skipReason ? skipReason : translateStatus(log)}</p>
                          </div>
                          <div className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(log.attempted_at || log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </div>
                          {!log.success && !isTest && log.webhook_id && (
                            <Button
                              variant="outline" size="sm" className="h-7 text-xs gap-1 flex-shrink-0"
                              onClick={(e) => { e.stopPropagation(); testWebhook.mutate(log.webhook_id); }}
                              disabled={testWebhook.isPending}
                            >
                              <RotateCcw className="h-3 w-3" />Reenviar
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs de Recebimento Tab ── */}
        <TabsContent value="receive-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5" />
                Logs de Recebimento
              </CardTitle>
              <CardDescription>Chamadas recebidas nos últimos 7 dias.</CardDescription>
            </CardHeader>
            <CardContent>
              {receiveLogsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : receiveLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MonitorSmartphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma chamada recebida ainda</p>
                  <p className="text-xs mt-1">Quando a outra plataforma enviar dados para a URL de callback, os registros aparecerão aqui.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {receiveLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => { setShowTechnicalDetails(false); setDetailLog(log); }}
                    >
                      <div className="flex-shrink-0">
                        {log.success ? (
                          <Badge variant="outline" className="bg-green-50 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800 text-xs">Recebido</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800 text-xs">Erro</Badge>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{CALLBACK_EVENT_LABELS[log.event] || log.event}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{translateStatus(log)}</p>
                      </div>
                      <div className="text-xs text-muted-foreground flex-shrink-0">
                        {format(new Date(log.attempted_at || log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog — Human-friendly */}
      <Dialog open={!!detailLog} onOpenChange={(open) => { if (!open) setDetailLog(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Envio</DialogTitle>
          </DialogHeader>
          {detailLog && (() => {
            const meta = getLogMeta(detailLog);
            const webhook = webhooks.find(w => w.id === detailLog.webhook_id);
            const isTest = detailLog.event === 'test.connection';
            return (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 pr-4">
                  {/* Status banner */}
                  <div className={`flex items-center gap-3 p-4 rounded-lg border ${detailLog.success ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
                    {detailLog.success ? <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" /> : <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />}
                    <div>
                      <p className={`font-medium ${detailLog.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                        {translateStatus(detailLog)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(detailLog.attempted_at || detailLog.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {detailLog.duration_ms ? ` · ${detailLog.duration_ms}ms` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Integração</p>
                      <p className="font-medium">{webhook?.name || 'Removido'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Pedido</p>
                      <p className="font-medium">{getLogOrderLabel(detailLog)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Evento</p>
                      <p className="font-medium">{CALLBACK_EVENT_LABELS[detailLog.event] || EVENT_LABELS[detailLog.event] || detailLog.event}</p>
                    </div>
                    {isTest && (
                      <div>
                        <p className="text-muted-foreground text-xs">Tipo</p>
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 text-xs">Teste</Badge>
                      </div>
                    )}
                  </div>

                  {/* Retry button for errors */}
                  {!detailLog.success && detailLog.webhook_id && (
                    <Button
                      className="w-full gap-2"
                      variant="default"
                      onClick={() => {
                        testWebhook.mutate(detailLog.webhook_id);
                        setDetailLog(null);
                      }}
                      disabled={testWebhook.isPending}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Tentar Reenviar Agora
                    </Button>
                  )}

                  {/* Technical details collapsible */}
                  <Collapsible open={showTechnicalDetails} onOpenChange={setShowTechnicalDetails}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                        <Code className="h-4 w-4" />
                        Ver Dados Técnicos (Avançado)
                        <ChevronDown className={`h-4 w-4 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Status HTTP</p>
                          <p className="font-mono text-xs">{detailLog.response_status || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">URL</p>
                          <p className="font-mono text-xs truncate">{detailLog.request_url}</p>
                        </div>
                        {meta.ip && (
                          <div>
                            <p className="text-muted-foreground text-xs">IP de Origem</p>
                            <p className="font-mono text-xs">{meta.ip}</p>
                          </div>
                        )}
                      </div>

                      {meta.headers && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Cabeçalhos</p>
                          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto font-mono">{JSON.stringify(meta.headers, null, 2)}</pre>
                        </div>
                      )}

                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Payload Enviado</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto font-mono max-h-[200px]">
                          {JSON.stringify(meta.payload, null, 2) || 'Nenhum payload'}
                        </pre>
                      </div>

                      {detailLog.response_body && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Resposta</p>
                          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto font-mono max-h-[200px]">
                            {(() => { try { return JSON.stringify(JSON.parse(detailLog.response_body), null, 2); } catch { return detailLog.response_body; } })()}
                          </pre>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Editar Integração' : 'Nova Integração'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* ── Bloco 1: Identificação ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identificação</p>
              <div>
                <Label>Nome da Integração</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Gestão de Entregas" />
              </div>
              <div>
                <Label>URL de Destino</Label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.exemplo.com/webhook" type="url" />
                <p className="text-xs text-muted-foreground mt-1">Endereço onde os pedidos serão enviados.</p>
              </div>
            </div>

            {/* ── Bloco 2: Segurança ── */}
            <div className="space-y-3 border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Segurança</p>
              <div>
                <Label className="flex items-center gap-2">
                  Token de Autenticação
                  <button type="button" onClick={() => setShowSecret(!showSecret)} className="text-muted-foreground">
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </Label>
                <Input
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder="Cole aqui o token fornecido pela plataforma"
                  type={showSecret ? 'text' : 'password'}
                />
                <p className="text-xs text-muted-foreground mt-1">Cole aqui o Token de API (Bearer) gerado na sua plataforma de logística.</p>
                {!clientSecret && !secret && (
                  <div className="flex items-center gap-1.5 mt-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Sem token, as notificações serão rejeitadas pelo destino (erro 401).
                  </div>
                )}
              </div>
            </div>

            {/* ── Bloco 3: Regras de Envio ── */}
            <div className="space-y-3 border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Regras de Envio</p>
              <div>
                <Label>Quando enviar? (Eventos)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {ALL_EVENTS.map(event => (
                    <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={selectedEvents.includes(event)} onCheckedChange={() => toggleEvent(event)} />
                      {EVENT_LABELS[event]}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Para quais tipos de pedido?</Label>
                <label className="flex items-center gap-2 text-sm cursor-pointer mt-2 mb-1">
                  <Checkbox
                    checked={selectedOrderTypes.length === 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedOrderTypes([]);
                      } else {
                        setSelectedOrderTypes(['delivery']);
                      }
                    }}
                  />
                  <span className="font-medium">Todos os tipos de pedido</span>
                </label>
                {selectedOrderTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground ml-6 mb-2">O webhook será disparado para delivery, retirada, mesa e balcão.</p>
                )}
                <div className={`grid grid-cols-2 gap-2 ${selectedOrderTypes.length === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
                  {ALL_ORDER_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={selectedOrderTypes.includes(type)} onCheckedChange={() => toggleOrderType(type)} />
                      {ORDER_TYPE_LABELS[type]}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
                <span>Enviar automaticamente quando o evento ocorrer</span>
              </label>
            </div>

            {/* Callback URL Info */}
            {editingWebhook && (editingWebhook as any).callback_token && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border">
                  <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-3 w-full">
                    <div>
                      <p className="text-xs font-medium">URL de Retorno (Callback)</p>
                      <p className="text-xs text-muted-foreground mb-1.5">Configure esta URL na plataforma externa para receber atualizações.</p>
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs bg-background px-2 py-1 rounded border truncate max-w-[350px]">
                          {callbackBaseUrl}
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(callbackBaseUrl, 'URL de retorno')}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Token de Autenticação (Bearer)</p>
                      <p className="text-xs text-muted-foreground mb-1.5">A Gestão de Entregas deve enviar este token no header <code className="text-xs">Authorization: Bearer &lt;token&gt;</code></p>
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs bg-background px-2 py-1 rounded border truncate max-w-[350px]">
                          {(editingWebhook as any).callback_token}
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard((editingWebhook as any).callback_token, 'Token Bearer')}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleTestConnection}
              disabled={!url || testingConnection}
            >
              <Zap className="h-4 w-4 mr-2" />
              {testingConnection ? 'Testando...' : 'Testar Conexão'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name || !url || selectedEvents.length === 0 || createWebhook.isPending || updateWebhook.isPending}
            >
              {editingWebhook ? 'Salvar Integração' : 'Salvar Integração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
