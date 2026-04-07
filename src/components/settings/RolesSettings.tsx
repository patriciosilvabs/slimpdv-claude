import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAllUsers, AppRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Users, Trash2 } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  cashier: 'Caixa',
  waiter: 'Garçom',
  kitchen: 'Cozinha',
  kds: 'KDS',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  cashier: 'bg-primary text-primary-foreground',
  waiter: 'bg-info text-info-foreground',
  kitchen: 'bg-warning text-warning-foreground',
  kds: 'bg-orange-500 text-white',
};

export function RolesSettings() {
  const { data: users, refetch } = useAllUsers();
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;
    
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: selectedUser, role: selectedRole, tenant_id: tenantId });
      
      if (error) throw error;
      
      toast({ title: 'Função adicionada com sucesso!' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      setSelectedUser(null);
      setSelectedRole('');
    } catch (error: any) {
      toast({ 
        title: 'Erro ao adicionar função', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast({ title: 'Função removida com sucesso!' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover função',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const usersWithRoles = users?.filter((u) => u.user_roles.length > 0) || [];

  return (
    <div className="space-y-6">
      {/* Role Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Funções do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.admin}>Admin</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Acesso total ao sistema. Pode gerenciar usuários, configurações e todos os módulos.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.cashier}>Caixa</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Gerencia caixa, pagamentos e pode ver relatórios financeiros.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.waiter}>Garçom</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Gerencia mesas, pedidos e reservas. Acesso ao cardápio.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.kitchen}>Cozinha</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Visualiza e atualiza status dos pedidos. Acesso ao estoque.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.kds}>KDS</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Acesso exclusivo à tela KDS para visualizar e atualizar status dos pedidos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Role */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Atribuir Função
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione uma função" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabels) as AppRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddRole} disabled={!selectedUser || !selectedRole}>
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users with assigned roles */}
      {usersWithRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários e Funções Atribuídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usersWithRoles.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-lg"
                >
                  <span className="font-medium text-sm">{user.name}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {user.user_roles.map((r) => (
                      <div key={r.role} className="flex items-center gap-1">
                        <Badge className={roleColors[r.role]}>
                          {roleLabels[r.role]}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemoveRole(user.id, r.role)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
