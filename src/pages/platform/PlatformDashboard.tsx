import { PlatformLayout } from '@/components/platform/PlatformLayout';
import { RequirePlatformAdmin } from '@/components/platform/RequirePlatformAdmin';
import { usePlatformStats, usePlatformTenants } from '@/hooks/usePlatformAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  CreditCard, 
  TrendingUp, 
  Users,
  Clock,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function PlatformDashboard() {
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: tenants, isLoading: tenantsLoading } = usePlatformTenants();

  const recentTenants = tenants?.slice(0, 5) || [];

  return (
    <RequirePlatformAdmin>
      <PlatformLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <p className="text-muted-foreground">
              Visão geral da plataforma
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Restaurantes
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.totalTenants}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {stats?.activeTenants} ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Assinaturas Ativas
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.activeSubscriptions}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  pagando mensalmente
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Em Trial
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.trialSubscriptions}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  período de teste
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  MRR
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">
                    R$ {((stats?.mrr || 0) / 100).toFixed(2)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  receita recorrente mensal
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Tenants */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Restaurantes Recentes</CardTitle>
              <Link 
                to="/platform/tenants" 
                className="text-sm text-primary hover:underline"
              >
                Ver todos
              </Link>
            </CardHeader>
            <CardContent>
              {tenantsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentTenants.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum restaurante cadastrado
                </p>
              ) : (
                <div className="space-y-3">
                  {recentTenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {tenant.owner_name || 'Sem proprietário'} · {tenant.member_count} membros
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {tenant.subscription ? (
                          <Badge 
                            variant={
                              tenant.subscription.status === 'active' 
                                ? 'default' 
                                : tenant.subscription.status === 'trialing'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {tenant.subscription.status === 'active' && 'Ativo'}
                            {tenant.subscription.status === 'trialing' && 'Trial'}
                            {tenant.subscription.status === 'canceled' && 'Cancelado'}
                            {!['active', 'trialing', 'canceled'].includes(tenant.subscription.status) && tenant.subscription.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sem assinatura</Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PlatformLayout>
    </RequirePlatformAdmin>
  );
}
