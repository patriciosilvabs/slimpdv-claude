import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useProductionApiKeys, ProductionApiKey } from '@/hooks/useProductionApiKeys';
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FileCode,
  History,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'pgfeffykhanujyqymmir';
const API_BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export function ProductionApiSettings() {
  const { apiKeys, logs, isLoading, logsLoading, createKey, updateKey, deleteKey } = useProductionApiKeys();
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: `${label} copiado para a área de transferência.` });
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Informe um nome para identificar a chave.', variant: 'destructive' });
      return;
    }
    await createKey.mutateAsync(newKeyName.trim());
    setNewKeyName('');
  };

  const handleTogglePermission = (key: ProductionApiKey, permission: keyof ProductionApiKey['permissions']) => {
    updateKey.mutate({
      id: key.id,
      updates: {
        permissions: {
          ...key.permissions,
          [permission]: !key.permissions[permission],
        },
      },
    });
  };

  const handleToggleActive = (key: ProductionApiKey) => {
    updateKey.mutate({
      id: key.id,
      updates: { is_active: !key.is_active },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API de Integração para Produção
          </CardTitle>
          <CardDescription>
            Configure chaves de API para integrar seu sistema CPD (Centro de Produção) externo com este PDV.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys" className="gap-2">
            <Key className="h-4 w-4" />
            Chaves de API
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <FileCode className="h-4 w-4" />
            Documentação
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="h-4 w-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Keys Tab */}
        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Criar Nova Chave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da chave (ex: CPD Principal)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                />
                <Button onClick={handleCreateKey} disabled={createKey.isPending}>
                  {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Criar</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma chave de API criada.</p>
                <p className="text-sm">Crie uma chave acima para começar a integração.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <Card key={key.id} className={!key.is_active ? 'opacity-60' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{key.name}</h3>
                          <Badge variant={key.is_active ? 'default' : 'secondary'}>
                            {key.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 font-mono text-sm bg-muted px-3 py-2 rounded">
                          <span className="flex-1 truncate">
                            {visibleKeys.has(key.id) ? key.api_key : '••••••••••••••••••••••••••••••••'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleKeyVisibility(key.id)}
                          >
                            {visibleKeys.has(key.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(key.api_key, 'Chave de API')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Criada {formatDistanceToNow(new Date(key.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                          {key.last_used_at && (
                            <span>
                              Último uso: {formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`active-${key.id}`} className="text-sm">Ativa</Label>
                          <Switch
                            id={`active-${key.id}`}
                            checked={key.is_active}
                            onCheckedChange={() => handleToggleActive(key)}
                          />
                        </div>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir chave de API?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A chave "{key.name}" será permanentemente removida. Qualquer sistema usando esta chave perderá acesso imediatamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteKey.mutate(key.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {(['demand', 'ingredients', 'targets', 'webhook'] as const).map((perm) => (
                        <div key={perm} className="flex items-center gap-2">
                          <Switch
                            id={`${key.id}-${perm}`}
                            checked={key.permissions[perm]}
                            onCheckedChange={() => handleTogglePermission(key, perm)}
                          />
                          <Label htmlFor={`${key.id}-${perm}`} className="text-sm capitalize">
                            {perm === 'demand' && 'Demanda'}
                            {perm === 'ingredients' && 'Ingredientes'}
                            {perm === 'targets' && 'Metas'}
                            {perm === 'webhook' && 'Webhook'}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                URLs da API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">API REST (para consultar dados)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm truncate">
                    {API_BASE_URL}/production-api
                  </code>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(`${API_BASE_URL}/production-api`, 'URL da API')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">Webhook (para enviar dados)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm truncate">
                    {API_BASE_URL}/production-webhook
                  </code>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(`${API_BASE_URL}/production-webhook`, 'URL do Webhook')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endpoints Disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* GET Demand */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">GET</Badge>
                  <code className="text-sm">/production-api?action=demand</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Retorna a demanda de produção baseada no estoque atual vs metas do dia.
                </p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`// Response
{
  "success": true,
  "date": "2026-01-31",
  "day_of_week": 5,
  "store": { "id": "uuid", "name": "Loja Centro" },
  "demand": [
    {
      "ingredient_id": "uuid",
      "ingredient_name": "Massa de Pizza",
      "unit": "kg",
      "current_stock": 5,
      "target_stock": 20,
      "to_produce": 15,
      "status": "critical"
    }
  ]
}`}
                </pre>
              </div>

              <Separator />

              {/* GET Ingredients */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">GET</Badge>
                  <code className="text-sm">/production-api?action=ingredients</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Retorna lista de todos os ingredientes com níveis de estoque.
                </p>
              </div>

              <Separator />

              {/* GET Targets */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">GET</Badge>
                  <code className="text-sm">/production-api?action=targets</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Retorna as metas de produção por dia da semana.
                </p>
              </div>

              <Separator />

              {/* POST Webhook */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-secondary/50 text-secondary-foreground border-secondary">POST</Badge>
                  <code className="text-sm">/production-webhook</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Recebe notificações de envios do CPD e atualiza o estoque automaticamente.
                </p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`// Request Body
{
  "event": "SHIPMENT_CREATED",
  "shipment": {
    "external_id": "CPD-12345",
    "items": [
      {
        "ingredient_name": "Massa de Pizza",
        "ingredient_id": "uuid-opcional",
        "quantity": 15,
        "unit": "kg"
      }
    ],
    "shipped_at": "2026-01-31T14:30:00Z",
    "notes": "Lote 45"
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Autenticação</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Todas as requisições devem incluir o header <code className="bg-muted px-1 rounded">X-API-KEY</code> com uma chave válida.
              </p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`curl -X GET "${API_BASE_URL}/production-api?action=demand" \\
  -H "X-API-KEY: sua-chave-aqui"`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Requisições
              </CardTitle>
              <CardDescription>
                Últimas 100 requisições à API
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma requisição registrada ainda.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm"
                      >
                        {log.status_code >= 200 && log.status_code < 300 ? (
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                        )}
                        <Badge variant="outline" className="font-mono">
                          {log.method}
                        </Badge>
                        <span className="font-mono truncate flex-1">{log.endpoint}</span>
                        <Badge variant={log.status_code >= 200 && log.status_code < 300 ? 'default' : 'destructive'}>
                          {log.status_code}
                        </Badge>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
