import { useState } from 'react';
import { PlatformLayout } from '@/components/platform/PlatformLayout';
import { RequirePlatformAdmin } from '@/components/platform/RequirePlatformAdmin';
import { usePlatformTenants } from '@/hooks/usePlatformAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Search,
  Users,
  MoreVertical,
  Eye,
  Ban,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function PlatformTenants() {
  const { data: tenants, isLoading } = usePlatformTenants();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const filteredTenants = tenants?.filter((tenant) =>
    tenant.name.toLowerCase().includes(search.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(search.toLowerCase()) ||
    tenant.owner_name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const toggleTenantStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ is_active: !currentStatus })
        .eq('id', tenantId);

      if (error) throw error;

      toast.success(currentStatus ? 'Tenant desativado' : 'Tenant ativado');
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    } catch (error) {
      console.error('Error toggling tenant status:', error);
      toast.error('Erro ao alterar status do tenant');
    }
  };

  return (
    <RequirePlatformAdmin>
      <PlatformLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Restaurantes</h2>
            <p className="text-muted-foreground">
              Gerencie todos os restaurantes da plataforma
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Lista de Restaurantes
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar restaurante..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
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
              ) : filteredTenants.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {search ? 'Nenhum restaurante encontrado' : 'Nenhum restaurante cadastrado'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurante</TableHead>
                        <TableHead>Proprietário</TableHead>
                        <TableHead>Membros</TableHead>
                        <TableHead>Assinatura</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{tenant.name}</p>
                                <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {tenant.owner_name || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {tenant.member_count}
                            </div>
                          </TableCell>
                          <TableCell>
                            {tenant.subscription ? (
                              <div>
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
                                {tenant.subscription.plan && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {tenant.subscription.plan.name}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline">Sem assinatura</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {tenant.is_active ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <Ban className="h-3 w-3 mr-1" />
                                Inativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)}
                                >
                                  {tenant.is_active ? (
                                    <>
                                      <Ban className="h-4 w-4 mr-2" />
                                      Desativar
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Ativar
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
