import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAllUsers, AppRole, UserWithRoles } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { client as apiClient } from '@/integrations/api/client';
import { useTenant } from '@/hooks/useTenant';
import { useTenantContext } from '@/contexts/TenantContext';
import { useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Edit, X, Eye, EyeOff, Key, Trash2, Building2 } from 'lucide-react';
import { UserPermissionsDialog } from '@/components/settings/UserPermissionsDialog';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  cashier: 'Caixa',
  waiter: 'Garçom',
  kitchen: 'Cozinha',
  kds: 'KDS',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  cashier: 'bg-primary text-primary-foreground',
  waiter: 'bg-info text-info-foreground',
  kitchen: 'bg-warning text-warning-foreground',
  kds: 'bg-orange-500 text-white',
  gerente: 'bg-purple-600 text-white',
  supervisor: 'bg-indigo-500 text-white',
};

export function UsersSettings() {
  const { data: users, isLoading, refetch } = useAllUsers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { allTenants } = useTenantContext();

  // User creation state
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'waiter' as AppRole,
  });
  const [newUserTenantIds, setNewUserTenantIds] = useState<string[]>([]);

  // Edit user state
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserWithRoles | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<AppRole | ''>('');
  const [editUserTenantIds, setEditUserTenantIds] = useState<string[]>([]);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Delete user state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Permissions dialog state
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [userForPermissions, setUserForPermissions] = useState<UserWithRoles | null>(null);

  // Initialize new user tenant selection to current tenant
  useEffect(() => {
    if (isCreateUserDialogOpen && tenantId) {
      setNewUserTenantIds([tenantId]);
    }
  }, [isCreateUserDialogOpen, tenantId]);

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    try {
      await apiClient.delete('/user-roles', { userId, role });
      toast({ title: 'Função removida!' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['has-admins'] });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover função',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleOpenEditUser = async (user: UserWithRoles) => {
    setUserToEdit(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email || '');
    setEditUserPassword('');
    setEditUserRole(user.user_roles[0]?.role || '');
    setShowEditPassword(false);
    // Load user's current tenant memberships
    try {
      const res = await apiClient.get<{ tenants: { tenant_id: string }[] }>(`/user-tenants/${user.id}`);
      setEditUserTenantIds(res.tenants.map(t => t.tenant_id));
    } catch {
      setEditUserTenantIds(tenantId ? [tenantId] : []);
    }
    setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!userToEdit) return;

    setIsSavingUser(true);
    try {
      await apiClient.post('/functions/admin-update-user', {
        userId: userToEdit.id,
        name: editUserName.trim(),
        email: editUserEmail.trim() || undefined,
        password: editUserPassword || undefined,
        role: editUserRole || undefined,
        tenant_ids: editUserTenantIds,
      });

      toast({ title: 'Usuário atualizado com sucesso!' });
      refetch();
      setIsEditUserDialogOpen(false);
      setUserToEdit(null);
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar usuário',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleOpenDeleteUser = (user: UserWithRoles) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    try {
      await apiClient.post('/functions/admin-delete-user', { userId: userToDelete.id });

      toast({ title: 'Usuário excluído com sucesso!' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['has-admins'] });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir usuário',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsDeletingUser(false);
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.email || !newUserForm.name || !newUserForm.password || !newUserForm.role) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    if (newUserForm.password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive'
      });
      return;
    }

    if (newUserTenantIds.length === 0) {
      toast({ title: 'Selecione pelo menos uma loja', variant: 'destructive' });
      return;
    }

    setIsCreatingUser(true);
    try {
      await apiClient.post('/functions/create-user', {
        email: newUserForm.email,
        name: newUserForm.name.toUpperCase(),
        password: newUserForm.password,
        role: newUserForm.role,
        tenant_id: tenantId,
        tenant_ids: newUserTenantIds,
      });

      toast({
        title: 'Usuário criado com sucesso!',
        description: `${newUserForm.name} foi adicionado como ${roleLabels[newUserForm.role]}`
      });

      setIsCreateUserDialogOpen(false);
      setNewUserForm({ email: '', name: '', password: '', role: 'waiter' });
      setNewUserTenantIds([]);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleOpenPermissions = (user: UserWithRoles) => {
    setUserForPermissions(user);
    setIsPermissionsDialogOpen(true);
  };

  const toggleTenantId = (id: string, current: string[], setter: (v: string[]) => void) => {
    if (current.includes(id)) {
      setter(current.filter(t => t !== id));
    } else {
      setter([...current, id]);
    }
  };

  const StoreSelector = ({
    selectedIds,
    onChange,
  }: {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
  }) => {
    if (allTenants.length <= 1) return null;
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Lojas com acesso
        </Label>
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          {allTenants.map((m) => {
            const id = m.tenant_id;
            const name = m.tenant?.name || id;
            return (
              <label key={id} className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={selectedIds.includes(id)}
                  onCheckedChange={() => toggleTenantId(id, selectedIds, onChange)}
                />
                <span className="text-sm">{name}</span>
                {id === tenantId && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">atual</Badge>
                )}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          O usuário terá acesso apenas às lojas selecionadas.
        </p>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários do Sistema
            </CardTitle>
            <Button onClick={() => setIsCreateUserDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : users?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Funções</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium">
                            {user.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.user_roles.length === 0 ? (
                          <span className="text-muted-foreground text-sm">Sem função</span>
                        ) : (
                          user.user_roles.map((r) => (
                            <Badge
                              key={r.role}
                              className={`${roleColors[r.role]} flex items-center gap-1`}
                            >
                              {roleLabels[r.role]}
                              <button
                                onClick={() => handleRemoveRole(user.id, r.role)}
                                className="ml-1 hover:opacity-70"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditUser(user)}
                          title="Editar usuário"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPermissions(user)}
                          title="Gerenciar permissões"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDeleteUser(user)}
                          title="Excluir usuário"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome do Usuário</Label>
              <Input
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                readOnly
                onFocus={(e) => (e.target as HTMLInputElement).removeAttribute('readonly')}
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                placeholder="email@exemplo.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Função Principal</Label>
              <Select
                value={editUserRole}
                onValueChange={(v) => setEditUserRole(v as AppRole)}
              >
                <SelectTrigger>
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
            </div>
            <StoreSelector selectedIds={editUserTenantIds} onChange={setEditUserTenantIds} />
            <div className="space-y-2">
              <Label>Nova Senha (opcional - deixe vazio para manter)</Label>
              <div className="relative">
                <Input
                  readOnly
                  onFocus={(e) => (e.target as HTMLInputElement).removeAttribute('readonly')}
                  type={showEditPassword ? 'text' : 'password'}
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  placeholder="Deixe vazio para manter a senha atual"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                >
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {editUserPassword && editUserPassword.length < 6 && (
                <p className="text-xs text-destructive">A senha deve ter pelo menos 6 caracteres</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={isSavingUser || (editUserPassword.length > 0 && editUserPassword.length < 6)}
            >
              {isSavingUser ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>?
              <br /><br />
              Esta ação é irreversível. Todos os dados do usuário serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingUser ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Dialog */}
      <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha Temporária</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(v) => setNewUserForm({ ...newUserForm, role: v as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as AppRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <StoreSelector selectedIds={newUserTenantIds} onChange={setNewUserTenantIds} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateUserDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={isCreatingUser}>
              {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Permissions Dialog */}
      {userForPermissions && users && (
        <UserPermissionsDialog
          open={isPermissionsDialogOpen}
          onOpenChange={setIsPermissionsDialogOpen}
          user={userForPermissions}
          allUsers={users}
        />
      )}
    </>
  );
}
