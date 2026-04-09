import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlatformLayout } from '@/components/platform/PlatformLayout';
import { RequirePlatformAdmin } from '@/components/platform/RequirePlatformAdmin';
import { client as apiClient } from '@/integrations/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  CreditCard, Search, Building2, Calendar, Clock,
  CheckCircle, XCircle, Plus, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface TenantSub {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_type: string | null;
  plan_expires_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  is_active: boolean;
  business_type: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  user_count: number;
}

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual',
};
const PLAN_PRICES: Record<string, string> = {
  monthly: 'R$ 299,90/mês', quarterly: 'R$ 764,74/trim.', annual: 'R$ 2.699,10/ano',
};

function StatusBadge({ plan }: { plan: string }) {
  switch (plan) {
    case 'active':    return <Badge className="bg-green-600 text-white">Ativo</Badge>;
    case 'trial':     return <Badge variant="secondary">Trial</Badge>;
    case 'cancelled': return <Badge variant="destructive">Cancelado</Badge>;
    case 'overdue':   return <Badge className="bg-orange-500 text-white">Inadimplente</Badge>;
    case 'expired':   return <Badge variant="outline" className="text-gray-500">Expirado</Badge>;
    default:          return <Badge variant="outline">{plan}</Badge>;
  }
}

export default function PlatformSubscriptions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activateModal, setActivateModal] = useState<TenantSub | null>(null);
  const [extendModal, setExtendModal] = useState<TenantSub | null>(null);
  const [cancelModal, setCancelModal] = useState<TenantSub | null>(null);
  const [months, setMonths] = useState('1');
  const [days, setDays] = useState('7');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: () => apiClient.get<{ tenants: TenantSub[] }>('/admin/subscriptions').then(r => r.tenants),
    staleTime: 30000,
  });

  const activate = useMutation({
    mutationFn: ({ id, months }: { id: string; months: number }) =>
      apiClient.post(`/admin/subscriptions/${id}/activate`, { months }),
    onSuccess: () => {
      toast({ title: 'Assinatura ativada com sucesso' });
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setActivateModal(null);
    },
    onError: () => toast({ title: 'Erro ao ativar assinatura', variant: 'destructive' }),
  });

  const extendTrial = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      apiClient.post(`/admin/subscriptions/${id}/extend-trial`, { days }),
    onSuccess: () => {
      toast({ title: 'Trial estendido com sucesso' });
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setExtendModal(null);
    },
    onError: () => toast({ title: 'Erro ao estender trial', variant: 'destructive' }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/subscriptions/${id}/cancel`, {}),
    onSuccess: () => {
      toast({ title: 'Assinatura cancelada' });
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setCancelModal(null);
    },
    onError: () => toast({ title: 'Erro ao cancelar', variant: 'destructive' }),
  });

  const tenants = (data || []).filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.plan === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: data?.length || 0,
    active: data?.filter(t => t.plan === 'active').length || 0,
    trial: data?.filter(t => t.plan === 'trial').length || 0,
    overdue: data?.filter(t => t.plan === 'overdue').length || 0,
  };

  return (
    <RequirePlatformAdmin>
      <PlatformLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Assinaturas</h2>
            <p className="text-muted-foreground">Gerencie todas as assinaturas via Asaas</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total', value: stats.total, icon: Building2, color: 'text-gray-700' },
              { label: 'Ativos', value: stats.active, icon: CheckCircle, color: 'text-green-600' },
              { label: 'Trial', value: stats.trial, icon: Clock, color: 'text-blue-600' },
              { label: 'Inadimplentes', value: stats.overdue, icon: AlertTriangle, color: 'text-orange-500' },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Clientes ({tenants.length})
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="overdue">Inadimplentes</SelectItem>
                      <SelectItem value="cancelled">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou slug..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : tenants.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estabelecimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Trial / Validade</TableHead>
                        <TableHead>Usuários</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.map(t => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Building2 className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{t.name}</p>
                                <p className="text-xs text-muted-foreground">{t.slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge plan={t.plan} /></TableCell>
                          <TableCell>
                            {t.plan_type ? (
                              <div>
                                <p className="text-sm font-medium">{PLAN_LABELS[t.plan_type] || t.plan_type}</p>
                                <p className="text-xs text-muted-foreground">{PLAN_PRICES[t.plan_type] || ''}</p>
                              </div>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell>
                            {t.plan === 'trial' && t.trial_ends_at ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {new Date(t.trial_ends_at) > new Date()
                                  ? formatDistanceToNow(new Date(t.trial_ends_at), { locale: ptBR, addSuffix: true })
                                  : <span className="text-destructive">Expirado</span>}
                              </div>
                            ) : t.plan_expires_at ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {format(new Date(t.plan_expires_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell><span className="text-sm">{t.user_count}</span></TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(t.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end flex-wrap">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setActivateModal(t); setMonths('1'); }}>
                                <Plus className="h-3 w-3 mr-1" />Ativar
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setExtendModal(t); setDays('7'); }}>
                                <RefreshCw className="h-3 w-3 mr-1" />Trial
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setCancelModal(t)}>
                                <XCircle className="h-3 w-3 mr-1" />Cancelar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activate Modal */}
        <Dialog open={!!activateModal} onOpenChange={() => setActivateModal(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Ativar assinatura</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Ativando: <strong>{activateModal?.name}</strong></p>
              <div className="space-y-1">
                <Label>Meses de acesso</Label>
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 mês — R$ 299,90</SelectItem>
                    <SelectItem value="3">3 meses — R$ 764,74</SelectItem>
                    <SelectItem value="6">6 meses — R$ 1.529,49</SelectItem>
                    <SelectItem value="12">12 meses — R$ 2.699,10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActivateModal(null)}>Cancelar</Button>
              <Button className="bg-green-600 hover:bg-green-700" disabled={activate.isPending}
                onClick={() => activateModal && activate.mutate({ id: activateModal.id, months: Number(months) })}>
                {activate.isPending ? 'Ativando...' : 'Ativar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Extend Trial Modal */}
        <Dialog open={!!extendModal} onOpenChange={() => setExtendModal(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Estender trial</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Estendendo trial de: <strong>{extendModal?.name}</strong></p>
              <div className="space-y-1">
                <Label>Dias adicionais</Label>
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">+3 dias</SelectItem>
                    <SelectItem value="7">+7 dias</SelectItem>
                    <SelectItem value="14">+14 dias</SelectItem>
                    <SelectItem value="30">+30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExtendModal(null)}>Cancelar</Button>
              <Button disabled={extendTrial.isPending}
                onClick={() => extendModal && extendTrial.mutate({ id: extendModal.id, days: Number(days) })}>
                {extendTrial.isPending ? 'Estendendo...' : 'Estender trial'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Modal */}
        <Dialog open={!!cancelModal} onOpenChange={() => setCancelModal(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Cancelar assinatura</DialogTitle></DialogHeader>
            <div className="py-2">
              <p className="text-sm text-muted-foreground">
                Confirma o cancelamento de <strong>{cancelModal?.name}</strong>?
                O acesso será bloqueado imediatamente e a assinatura cancelada no Asaas.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelModal(null)}>Voltar</Button>
              <Button variant="destructive" disabled={cancel.isPending}
                onClick={() => cancelModal && cancel.mutate(cancelModal.id)}>
                {cancel.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PlatformLayout>
    </RequirePlatformAdmin>
  );
}
