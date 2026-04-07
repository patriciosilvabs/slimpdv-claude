import { useState } from 'react';
import { PlatformLayout } from '@/components/platform/PlatformLayout';
import { RequirePlatformAdmin } from '@/components/platform/RequirePlatformAdmin';
import { usePlatformSubscriptions } from '@/hooks/usePlatformAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CreditCard, 
  Search,
  Building2,
  Calendar,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PlatformSubscriptions() {
  const { data: subscriptions, isLoading } = usePlatformSubscriptions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredSubscriptions = subscriptions?.filter((sub) => {
    const matchesSearch = 
      (sub.tenants as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (sub.subscription_plans as any)?.name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">Ativo</Badge>;
      case 'trialing':
        return <Badge variant="secondary">Trial</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Inadimplente</Badge>;
      default:
        return <Badge variant="outline">{status || 'Desconhecido'}</Badge>;
    }
  };

  return (
    <RequirePlatformAdmin>
      <PlatformLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Assinaturas</h2>
            <p className="text-muted-foreground">
              Gerencie todas as assinaturas da plataforma
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Lista de Assinaturas
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="trialing">Trial</SelectItem>
                      <SelectItem value="canceled">Cancelados</SelectItem>
                      <SelectItem value="past_due">Inadimplentes</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredSubscriptions.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {search || statusFilter !== 'all' 
                      ? 'Nenhuma assinatura encontrada' 
                      : 'Nenhuma assinatura cadastrada'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurante</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Trial</TableHead>
                        <TableHead>Próx. Cobrança</TableHead>
                        <TableHead>Criada em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium">
                                {(sub.tenants as any)?.name || 'Tenant removido'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {(sub.subscription_plans as any)?.name || '-'}
                              </p>
                              {(sub.subscription_plans as any)?.price_monthly && (
                                <p className="text-xs text-muted-foreground">
                                  R$ {((sub.subscription_plans as any).price_monthly / 100).toFixed(2)}/mês
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(sub.status)}
                          </TableCell>
                          <TableCell>
                            {sub.trial_ends_at ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {new Date(sub.trial_ends_at) > new Date() ? (
                                  <span>
                                    {formatDistanceToNow(new Date(sub.trial_ends_at), { 
                                      locale: ptBR,
                                      addSuffix: true 
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Expirado</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {sub.current_period_end ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {sub.created_at && format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR })}
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
      </PlatformLayout>
    </RequirePlatformAdmin>
  );
}
