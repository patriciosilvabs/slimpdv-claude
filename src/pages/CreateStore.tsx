import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantContext } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, ArrowLeft, Store, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import logoSlim from '@/assets/logo-slim.png';
import { z } from 'zod';

const tenantSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  slug: z.string()
    .min(3, 'Slug deve ter pelo menos 3 caracteres')
    .max(50, 'Slug muito longo')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
});

export default function CreateStore() {
  const { user } = useAuth();
  const { allTenants, refreshTenants, setActiveTenant } = useTenantContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Check store limit (simplified - would need subscription check in production)
  const storeLimit = 100; // Default max
  const canCreateMore = allTenants.length < storeLimit;

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

const handleNameChange = (name: string) => {
    const generatedSlug = generateSlug(name);
    const shouldGenerateSlug = !formData.slug;
    
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || generatedSlug,
    }));
    
    // Verificar disponibilidade do slug gerado automaticamente
    if (shouldGenerateSlug && generatedSlug.length >= 3) {
      checkSlugAvailability(generatedSlug);
    }
  };

  const checkSlugAvailability = async (slug: string) => {
    if (slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    setCheckingSlug(false);
    setSlugAvailable(!data && !error);
  };

  const handleSlugChange = (slug: string) => {
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData(prev => ({ ...prev, slug: cleanSlug }));
    checkSlugAvailability(cleanSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreateMore) {
      toast({
        title: 'Limite atingido',
        description: `Você já possui ${allTenants.length} lojas. Atualize seu plano para adicionar mais.`,
        variant: 'destructive',
      });
      return;
    }

    const result = tenantSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: { name?: string; slug?: string } = {};
      result.error.errors.forEach(err => {
        fieldErrors[err.path[0] as 'name' | 'slug'] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (slugAvailable !== true) {
      setErrors(prev => ({ 
        ...prev, 
        slug: slugAvailable === false 
          ? 'Este slug já está em uso' 
          : 'Aguarde a verificação do slug'
      }));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Re-verificar disponibilidade antes de criar (previne race conditions)
      const { data: existingSlug } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', formData.slug)
        .maybeSingle();

      if (existingSlug) {
        setSlugAvailable(false);
        setErrors(prev => ({ ...prev, slug: 'Este slug já está em uso' }));
        setIsSubmitting(false);
        return;
      }

      // Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: formData.name,
          slug: formData.slug,
          owner_id: user?.id,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: tenant.id,
          user_id: user?.id,
          is_owner: true,
        });

      if (memberError) throw memberError;

      // Add admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user?.id,
          role: 'admin',
          tenant_id: tenant.id,
        });

      if (roleError) throw roleError;

      // Create default KDS Global Settings
      await supabase
        .from('kds_global_settings')
        .insert({
          tenant_id: tenant.id,
          operation_mode: 'traditional',
          compact_mode: false,
          show_pending_column: true,
          show_waiter_name: true,
          show_party_size: true,
          timer_green_minutes: 5,
          timer_yellow_minutes: 10,
          sla_green_minutes: 8,
          sla_yellow_minutes: 12,
          highlight_special_borders: true,
          border_keywords: ['borda', 'recheada', 'chocolate', 'catupiry', 'cheddar'],
          border_badge_color: 'amber',
          notes_badge_color: 'orange',
          notes_blink_all_stations: false,
          delay_alert_enabled: true,
          delay_alert_minutes: 10,
          cancellation_alerts_enabled: true,
          cancellation_alert_interval: 3,
          auto_print_cancellations: true,
          bottleneck_settings: {
            enabled: true,
            defaultMaxQueueSize: 5,
            defaultMaxTimeRatio: 1.5,
            stationOverrides: {},
          },
        });

      // Create default KDS Stations
      const defaultStations = [
        { name: 'Em preparação', station_type: 'prep_start', color: '#F59E0B', icon: 'ChefHat', sort_order: 1, is_active: true },
        { name: 'Item em montagem', station_type: 'item_assembly', color: '#8B5CF6', icon: 'Package', sort_order: 2, is_active: true },
        { name: 'Em Produção', station_type: 'assembly', color: '#3B82F6', icon: 'Flame', sort_order: 3, is_active: true },
        { name: 'Item em Finalização', station_type: 'oven_expedite', color: '#EF4444', icon: 'Timer', sort_order: 4, is_active: true },
        { name: 'Status do Pedido', station_type: 'order_status', color: '#10B981', icon: 'ClipboardCheck', sort_order: 5, is_active: true },
      ];

      await supabase
        .from('kds_stations')
        .insert(defaultStations.map(s => ({ ...s, tenant_id: tenant.id })));

      // Create 10 initial tables
      const initialTables = Array.from({ length: 10 }, (_, i) => ({
        number: i + 1,
        capacity: 4,
        status: 'available' as const,
        tenant_id: tenant.id,
      }));

      await supabase.from('tables').insert(initialTables);

      toast({
        title: 'Loja criada!',
        description: 'Sua nova loja foi configurada com sucesso.',
      });

      // Refresh tenants list and switch to new tenant
      await refreshTenants();
      setActiveTenant(tenant.id);
      
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Error creating store:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar loja',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-2xl border-border/50">
        <CardHeader className="text-center py-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <img src={logoSlim} alt="slim" className="max-h-10 w-auto object-contain" />
            <div className="w-16" /> {/* Spacer */}
          </div>
          
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Store className="h-6 w-6" />
            Nova Loja
          </CardTitle>
          <CardDescription className="text-base">
            Adicione mais uma unidade ao seu negócio
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!canCreateMore ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Você atingiu o limite de {storeLimit} lojas do seu plano. 
                Entre em contato para aumentar seu limite.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Current stores count */}
              <Alert className="bg-muted/50">
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  Você possui <strong>{allTenants.length}</strong> {allTenants.length === 1 ? 'loja' : 'lojas'} ativas
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="name">Nome da Loja</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex: Pizzaria Centro"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={errors.name ? 'border-destructive' : ''}
                  required
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Identificador único (URL)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">slim.app/</span>
                  <Input
                    id="slug"
                    type="text"
                    placeholder="pizzaria-centro"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className={errors.slug ? 'border-destructive' : slugAvailable === true ? 'border-green-500' : ''}
                    required
                  />
                  {checkingSlug && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {errors.slug && (
                  <p className="text-sm text-destructive">{errors.slug}</p>
                )}
                {slugAvailable === true && formData.slug.length >= 3 && (
                  <p className="text-sm text-green-600">Disponível!</p>
                )}
                {slugAvailable === false && (
                  <p className="text-sm text-destructive">Já está em uso</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Apenas letras minúsculas, números e hífens
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                disabled={isSubmitting || checkingSlug || slugAvailable !== true}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {checkingSlug ? 'Verificando...' : 'Criar Loja'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
