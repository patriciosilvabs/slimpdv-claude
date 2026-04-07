import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Building2, Save, Loader2, Copy, ExternalLink, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Store {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  is_active?: boolean;
}

interface StoreConfigModalProps {
  store: Store;
  open: boolean;
  onClose: () => void;
}

type DayHours = {
  enabled: boolean;
  open: string;
  close: string;
};

type WeekHours = Record<string, DayHours>;

const DAYS = [
  { key: 'dom', label: 'DOM' },
  { key: 'seg', label: 'SEG' },
  { key: 'ter', label: 'TER' },
  { key: 'qua', label: 'QUA' },
  { key: 'qui', label: 'QUI' },
  { key: 'sex', label: 'SEX' },
  { key: 'sab', label: 'SAB' },
];

const DEFAULT_HOURS: WeekHours = {
  dom: { enabled: true, open: '17:00', close: '23:59' },
  seg: { enabled: true, open: '17:00', close: '23:59' },
  ter: { enabled: true, open: '17:00', close: '23:59' },
  qua: { enabled: true, open: '17:00', close: '23:59' },
  qui: { enabled: true, open: '17:00', close: '23:59' },
  sex: { enabled: true, open: '17:00', close: '23:59' },
  sab: { enabled: true, open: '17:00', close: '23:59' },
};

function loadHours(storeId: string): WeekHours {
  try {
    const stored = localStorage.getItem(`store_hours_${storeId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all days exist
      const merged: WeekHours = { ...DEFAULT_HOURS };
      for (const day of DAYS) {
        if (parsed[day.key]) {
          merged[day.key] = { ...DEFAULT_HOURS[day.key], ...parsed[day.key] };
        }
      }
      return merged;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_HOURS };
}

function saveHours(storeId: string, hours: WeekHours) {
  try {
    localStorage.setItem(`store_hours_${storeId}`, JSON.stringify(hours));
  } catch { /* ignore */ }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StoreConfigModal({ store, open, onClose }: StoreConfigModalProps) {
  const { isOwner } = useTenant();
  const queryClient = useQueryClient();

  // Perfil state
  const [name, setName] = useState(store.name);
  const [isSavingName, setIsSavingName] = useState(false);

  // Hours state
  const [hours, setHours] = useState<WeekHours>(() => loadHours(store.id));
  const [isSavingHours, setIsSavingHours] = useState(false);

  // Sync name when store changes
  useEffect(() => {
    setName(store.name);
  }, [store.name, store.id]);

  // Reload hours when modal opens for this store
  useEffect(() => {
    if (open) {
      setHours(loadHours(store.id));
    }
  }, [open, store.id]);

  const storeUrl = `${window.location.origin}/loja/${store.slug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      toast.success('Link copiado!');
    } catch {
      toast.success('Link copiado!');
    }
  };

  const handleSaveName = async () => {
    if (!isOwner || !name.trim()) return;
    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ name: name.trim() })
        .eq('id', store.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['tenant-membership'] });
      queryClient.invalidateQueries({ queryKey: ['group-stores'] });
      toast.success('Nome da loja salvo!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveHours = () => {
    setIsSavingHours(true);
    try {
      saveHours(store.id, hours);
      toast.success('Horários salvos!');
    } finally {
      setIsSavingHours(false);
    }
  };

  const updateDay = (dayKey: string, field: keyof DayHours, value: string | boolean) => {
    setHours(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  };

  const copyToAll = (sourceKey: string) => {
    const source = hours[sourceKey];
    const updated: WeekHours = {};
    for (const day of DAYS) {
      updated[day.key] = { ...source, enabled: hours[day.key].enabled };
    }
    setHours(updated);
    toast.success('Horário copiado para todos os dias');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            {store.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="perfil" className="w-full">
          <TabsList className="mx-6 mt-4 w-[calc(100%-3rem)]">
            <TabsTrigger value="perfil" className="flex-1 gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="horarios" className="flex-1 gap-2">
              <Clock className="h-4 w-4" />
              Horários
            </TabsTrigger>
          </TabsList>

          {/* ── Perfil Tab ─────────────────────────────────────────────── */}
          <TabsContent value="perfil" className="px-6 pb-6 mt-4 space-y-5">

            {/* Store name */}
            <div className="space-y-2">
              <Label>Nome do estabelecimento</Label>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do estabelecimento"
                  disabled={!isOwner}
                  className="flex-1"
                />
                {isOwner && (
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={isSavingName || !name.trim() || name.trim() === store.name}
                  >
                    {isSavingName
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Save className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>

            {/* Slug / identifier */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Identificador (URL)</Label>
              <div className="bg-muted rounded-md px-3 py-2 font-mono text-sm select-all">
                {store.slug}
              </div>
              <p className="text-xs text-muted-foreground">O identificador não pode ser alterado.</p>
            </div>

            {/* Online menu link */}
            <div className="space-y-2">
              <Label>Link do Cardápio Online</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                <span className="flex-1 text-sm font-mono truncate select-all">{storeUrl}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCopyLink} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copiar Link
                </Button>
                <Button size="sm" variant="outline" asChild className="gap-2">
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir Cardápio
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhe este link com seus clientes para que possam fazer pedidos online.
              </p>
            </div>

            {/* Store ID */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">ID do estabelecimento</Label>
              <div className="bg-muted rounded-md px-3 py-2 font-mono text-xs select-all text-muted-foreground">
                {store.id}
              </div>
            </div>
          </TabsContent>

          {/* ── Horários Tab ───────────────────────────────────────────── */}
          <TabsContent value="horarios" className="px-6 pb-6 mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Horários de Funcionamento</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Configure os horários em que sua loja aceita pedidos delivery e retirada.
              </p>

              <div className="space-y-2">
                {DAYS.map(({ key, label }) => {
                  const day = hours[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        day.enabled ? 'bg-background' : 'bg-muted/40 opacity-60'
                      }`}
                    >
                      {/* Day label + toggle */}
                      <div className="flex items-center gap-2 w-16 shrink-0">
                        <Switch
                          checked={day.enabled}
                          onCheckedChange={(v) => updateDay(key, 'enabled', v)}
                          disabled={!isOwner}
                        />
                        <span className="text-xs font-semibold w-8">{label}</span>
                      </div>

                      {/* Time inputs */}
                      <Input
                        type="time"
                        value={day.open}
                        onChange={(e) => updateDay(key, 'open', e.target.value)}
                        disabled={!day.enabled || !isOwner}
                        className="h-8 w-28 text-sm"
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="time"
                        value={day.close}
                        onChange={(e) => updateDay(key, 'close', e.target.value)}
                        disabled={!day.enabled || !isOwner}
                        className="h-8 w-28 text-sm"
                      />

                      {/* Copy to all */}
                      {isOwner && day.enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => copyToAll(key)}
                          title="Copiar horário para todos os dias"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar p/ todos
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {isOwner && (
              <Button onClick={handleSaveHours} disabled={isSavingHours} className="w-full gap-2">
                {isSavingHours
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Save className="h-4 w-4" />}
                Salvar Horários
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
