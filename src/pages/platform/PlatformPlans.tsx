import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlatformLayout } from '@/components/platform/PlatformLayout';
import { RequirePlatformAdmin } from '@/components/platform/RequirePlatformAdmin';
import { client as apiClient } from '@/integrations/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tag, Plus, Pencil, Trash2, CheckCircle, XCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  key: string;
  name: string;
  value: number;
  cycle: string;
  months: number;
  is_active: boolean;
  description: string | null;
  discount_pct: number;
}

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Mensal', QUARTERLY: 'Trimestral', YEARLY: 'Anual',
};

const EMPTY_PLAN: Omit<Plan, 'id'> = {
  key: '', name: '', value: 0, cycle: 'MONTHLY', months: 1,
  is_active: true, description: '', discount_pct: 0,
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PlatformPlans() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [deleteModal, setDeleteModal] = useState<Plan | null>(null);
  const [form, setForm] = useState<Omit<Plan, 'id'>>(EMPTY_PLAN);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => apiClient.get<{ plans: Plan[] }>('/admin/plans').then(r => r.plans),
    staleTime: 30000,
  });

  const save = useMutation({
    mutationFn: (f: Omit<Plan, 'id'> & { id?: string }) =>
      f.id
        ? apiClient.put(`/admin/plans/${f.id}`, f)
        : apiClient.post('/admin/plans', f),
    onSuccess: () => {
      toast({ title: modal.plan ? 'Plano atualizado' : 'Plano criado' });
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      closeModal();
    },
    onError: () => toast({ title: 'Erro ao salvar plano', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/plans/${id}`),
    onSuccess: () => {
      toast({ title: 'Plano removido' });
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      setDeleteModal(null);
    },
    onError: () => toast({ title: 'Erro ao remover plano', variant: 'destructive' }),
  });

  const toggleActive = useMutation({
    mutationFn: (p: Plan) => apiClient.put(`/admin/plans/${p.id}`, { ...p, is_active: !p.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-plans'] }),
    onError: () => toast({ title: 'Erro ao atualizar status', variant: 'destructive' }),
  });

  function openCreate() {
    setForm(EMPTY_PLAN);
    setModal({ open: true, plan: null });
  }

  function openEdit(p: Plan) {
    setForm({ key: p.key, name: p.name, value: p.value, cycle: p.cycle, months: p.months, is_active: p.is_active, description: p.description || '', discount_pct: p.discount_pct });
    setModal({ open: true, plan: p });
  }

  function closeModal() {
    setModal({ open: false, plan: null });
  }

  function handleSubmit() {
    const payload = {
      ...form,
      value: Number(form.value),
      months: Number(form.months),
      discount_pct: Number(form.discount_pct),
      ...(modal.plan ? { id: modal.plan.id } : {}),
    };
    save.mutate(payload as any);
  }

  return (
    <RequirePlatformAdmin>
      <PlatformLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Planos</h2>
              <p className="text-muted-foreground">Gerencie os planos de assinatura disponíveis</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo plano
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-52 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum plano cadastrado.</p>
                <Button className="mt-4" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />Adicionar primeiro plano
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.map(p => (
                <Card key={p.id} className={`relative ${!p.is_active ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.key}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {p.is_active
                          ? <Badge className="bg-green-600 text-white text-xs">Ativo</Badge>
                          : <Badge variant="outline" className="text-gray-400 text-xs">Inativo</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-3xl font-bold text-primary">{formatBRL(p.value)}</p>
                      <p className="text-sm text-muted-foreground">
                        {CYCLE_LABELS[p.cycle] || p.cycle} · {p.months} {p.months === 1 ? 'mês' : 'meses'}
                      </p>
                    </div>

                    {p.discount_pct > 0 && (
                      <Badge variant="secondary" className="text-green-700 bg-green-50">
                        {p.discount_pct}% de desconto
                      </Badge>
                    )}

                    {p.description && (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={() => toggleActive.mutate(p)}
                          disabled={toggleActive.isPending}
                        />
                        <span className="text-xs text-muted-foreground">
                          {p.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteModal(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Create / Edit Modal */}
        <Dialog open={modal.open} onOpenChange={closeModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{modal.plan ? 'Editar plano' : 'Novo plano'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Chave (key)</Label>
                  <Input
                    placeholder="ex: monthly"
                    value={form.key}
                    onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input
                    placeholder="ex: Mensal"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="299.90"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Desconto (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={form.discount_pct}
                    onChange={e => setForm(f => ({ ...f, discount_pct: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Ciclo</Label>
                  <Select value={form.cycle} onValueChange={v => setForm(f => ({ ...f, cycle: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                      <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                      <SelectItem value="YEARLY">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Meses de acesso</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={form.months}
                    onChange={e => setForm(f => ({ ...f, months: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Descrição (opcional)</Label>
                <Input
                  placeholder="Descrição curta do plano..."
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
                />
                <Label>Plano ativo (visível para assinatura)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>Cancelar</Button>
              <Button disabled={save.isPending || !form.key || !form.name} onClick={handleSubmit}>
                {save.isPending ? 'Salvando...' : modal.plan ? 'Salvar alterações' : 'Criar plano'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Modal */}
        <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Remover plano</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              Confirma a remoção do plano <strong>{deleteModal?.name}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancelar</Button>
              <Button variant="destructive" disabled={remove.isPending}
                onClick={() => deleteModal && remove.mutate(deleteModal.id)}>
                {remove.isPending ? 'Removendo...' : 'Remover'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PlatformLayout>
    </RequirePlatformAdmin>
  );
}
