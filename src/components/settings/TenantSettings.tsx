import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Save, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function TenantSettings() {
  const { tenant, isOwner, tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState(tenant?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!tenantId || !isOwner) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ name: name.trim() })
        .eq('id', tenantId);

      if (error) throw error;

      toast({ title: 'Configurações salvas!' });
      queryClient.invalidateQueries({ queryKey: ['tenant-membership'] });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao salvar', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Configurações do Restaurante
          </CardTitle>
          <CardDescription>
            Apenas o proprietário pode editar as configurações do restaurante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Nome do Restaurante</Label>
              <p className="font-medium">{tenant?.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Identificador</Label>
              <p className="font-mono text-sm">{tenant?.slug}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Configurações do Restaurante
        </CardTitle>
        <CardDescription>
          Gerencie as informações do seu restaurante
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nome do Restaurante</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do restaurante"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Identificador (slug)</Label>
          <p className="font-mono text-sm bg-muted p-2 rounded">{tenant?.slug}</p>
          <p className="text-xs text-muted-foreground">O identificador não pode ser alterado</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
