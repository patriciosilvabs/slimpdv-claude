import { useState } from 'react';
import { PlatformLayout } from '@/components/platform/PlatformLayout';
import { RequirePlatformAdmin } from '@/components/platform/RequirePlatformAdmin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Plus,
  Trash2,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function PlatformAdmins() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<{ id: string; email: string } | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: admins, isLoading } = useQuery({
    queryKey: ['platform-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) {
      toast.error('Digite um email válido');
      return;
    }

    setIsSubmitting(true);
    try {
      // Buscar usuário pelo email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name')
        .limit(100);

      if (profileError) throw profileError;

      // Como não temos acesso direto ao email em profiles, precisamos buscar de outra forma
      // Vamos verificar se já existe um platform_admin com esse email
      const { data: existing } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('email', newAdminEmail.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        toast.error('Este email já é um administrador da plataforma');
        return;
      }

      // Inserir novo admin - isso requer que o usuário exista no sistema
      // Por segurança, vamos apenas criar o registro se o email for válido
      const { error } = await supabase
        .from('platform_admins')
        .insert({
          email: newAdminEmail.trim().toLowerCase(),
          user_id: user?.id, // Temporário - será atualizado quando o usuário fizer login
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success('Administrador adicionado com sucesso');
      setIsAddDialogOpen(false);
      setNewAdminEmail('');
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
    } catch (error: any) {
      console.error('Error adding admin:', error);
      toast.error(error.message || 'Erro ao adicionar administrador');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    // Não permitir remover a si mesmo
    if (admins?.find(a => a.id === selectedAdmin.id)?.user_id === user?.id) {
      toast.error('Você não pode remover a si mesmo');
      setIsDeleteDialogOpen(false);
      return;
    }

    // Não permitir remover se for o único admin
    if (admins?.length === 1) {
      toast.error('Não é possível remover o único administrador');
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('platform_admins')
        .delete()
        .eq('id', selectedAdmin.id);

      if (error) throw error;

      toast.success('Administrador removido');
      setIsDeleteDialogOpen(false);
      setSelectedAdmin(null);
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      toast.error(error.message || 'Erro ao remover administrador');
    }
  };

  return (
    <RequirePlatformAdmin>
      <PlatformLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Administradores da Plataforma</h2>
            <p className="text-muted-foreground">
              Gerencie quem tem acesso à gestão da plataforma
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Administradores
                  </CardTitle>
                  <CardDescription>
                    Usuários com acesso total à gestão da plataforma
                  </CardDescription>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : admins?.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum administrador cadastrado
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {admins?.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{admin.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Adicionado em {format(new Date(admin.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {admin.user_id === user?.id && (
                          <Badge variant="secondary">Você</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedAdmin({ id: admin.id, email: admin.email });
                            setIsDeleteDialogOpen(true);
                          }}
                          disabled={admin.user_id === user?.id || admins.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Admin Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Administrador</DialogTitle>
                <DialogDescription>
                  Digite o email do usuário que terá acesso à gestão da plataforma.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                  />
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <p className="text-sm text-amber-500">
                    O usuário terá acesso total a todos os restaurantes e assinaturas.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddAdmin} disabled={isSubmitting}>
                  {isSubmitting ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover Administrador</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover <strong>{selectedAdmin?.email}</strong> como administrador da plataforma?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAdmin}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PlatformLayout>
    </RequirePlatformAdmin>
  );
}
