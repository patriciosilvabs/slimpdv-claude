import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantContext } from '@/contexts/TenantContext';
import { client as apiClient } from '@/integrations/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import logoSlim from '@/assets/logo-slim.png';
import { cn } from '@/lib/utils';

// ─── Business types ───────────────────────────────────────────
const BUSINESS_TYPES = [
  { key: 'pizzaria',    emoji: '🍕', label: 'Pizzaria',           desc: 'Pizzas, esfihas e afins' },
  { key: 'hamburgueria',emoji: '🍔', label: 'Hamburgueria',       desc: 'Hambúrgueres e lanches' },
  { key: 'restaurante', emoji: '🍽️', label: 'Bar / Restaurante',  desc: 'Pratos, porções e drinks' },
  { key: 'lanchonete',  emoji: '☕', label: 'Lanchonete / Café',  desc: 'Salgados, lanches e café' },
  { key: 'acai',        emoji: '🍨', label: 'Açaí / Sorveteria',  desc: 'Açaí, sorvetes e complementos' },
  { key: 'outro',       emoji: '🏪', label: 'Outro',              desc: 'Outro tipo de estabelecimento' },
] as const;

type BusinessType = typeof BUSINESS_TYPES[number]['key'];

// ─── Slug generator ───────────────────────────────────────────
function generateSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export default function Onboarding() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { hasTenant, isLoading: tenantLoading, refreshTenants, setActiveTenant } = useTenantContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const addingStore = searchParams.get('add') === 'store';

  // Steps: 1 = choose type, 2 = name/slug, 3 = success
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual && name) {
      const s = generateSlug(name);
      setSlug(s);
      checkSlug(s);
    }
  }, [name, slugManual]);

  const checkSlug = async (s: string) => {
    if (s.length < 3) { setSlugAvailable(null); return; }
    setCheckingSlug(true);
    try {
      const res = await apiClient.get<{ available: boolean }>(`/onboarding/check-slug?slug=${encodeURIComponent(s)}`);
      setSlugAvailable(res.available);
    } catch {
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  };

  const handleSlugChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(clean);
    setSlugManual(true);
    checkSlug(clean);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug || !businessType) return;
    if (!slugAvailable) { toast({ title: 'Identificador indisponível', variant: 'destructive' }); return; }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ success?: boolean; tenantId?: string; error?: string; token?: string }>('/onboarding', {
        name: name.trim(),
        slug: slug.trim(),
        business_type: businessType,
      });

      if (res.error) throw new Error(res.error);

      // Store new JWT with correct tenant_id
      if (res.token) apiClient.setToken(res.token);

      await refreshTenants();
      if (res.tenantId) setActiveTenant(res.tenantId);
      setStep(3);
    } catch (err: any) {
      toast({ title: 'Erro ao criar estabelecimento', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
    navigate('/auth');
  };

  if (authLoading || tenantLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (hasTenant && !addingStore) return <Navigate to="/dashboard" replace />;

  const selectedType = BUSINESS_TYPES.find(t => t.key === businessType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fafe] via-white to-[#f0fafe] flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-2xl mx-auto w-full">
        <img src={logoSlim} alt="slim PDV" className="h-10 object-contain" />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">

          {/* ── STEP 1: Choose business type ─────────────────────────── */}
          {step === 1 && (
            <div>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Qual é o seu tipo de estabelecimento?</h1>
                <p className="text-gray-500">Vamos preparar o sistema com produtos prontos para você.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BUSINESS_TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setBusinessType(t.key)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all text-center',
                      businessType === t.key
                        ? 'border-[#00a8cc] bg-[#00a8cc]/10 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    )}
                  >
                    <span className="text-4xl">{t.emoji}</span>
                    <span className="font-semibold text-gray-900 text-sm">{t.label}</span>
                    <span className="text-xs text-gray-400 leading-tight">{t.desc}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!businessType}
                  className="bg-[#00a8cc] hover:bg-[#0092b3] text-white px-8"
                >
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Name and slug ─────────────────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-6"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              {selectedType && (
                <div className="flex items-center gap-3 mb-6 pb-6 border-b">
                  <span className="text-3xl">{selectedType.emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedType.label}</p>
                    <p className="text-sm text-gray-400">Catálogo de exemplo será carregado automaticamente</p>
                  </div>
                </div>
              )}

              <h2 className="text-xl font-bold text-gray-900 mb-6">Como se chama seu estabelecimento?</h2>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do estabelecimento</Label>
                  <Input
                    id="name"
                    autoFocus
                    placeholder="Ex: Pizzaria do João"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Identificador único (URL do cardápio)
                    {checkingSlug && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 whitespace-nowrap">slim.app/</span>
                    <Input
                      id="slug"
                      placeholder="pizzaria-do-joao"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className={cn(
                        slugAvailable === true && 'border-green-500 focus-visible:ring-green-500',
                        slugAvailable === false && 'border-destructive'
                      )}
                    />
                  </div>
                  {slugAvailable === true && slug.length >= 3 && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Disponível!
                    </p>
                  )}
                  {slugAvailable === false && (
                    <p className="text-sm text-destructive">Identificador já está em uso — tente outro</p>
                  )}
                  <p className="text-xs text-gray-400">Apenas letras minúsculas, números e hífens</p>
                </div>

                <div className="bg-[#f0fafe] rounded-xl p-4 text-sm text-gray-600">
                  <p className="font-medium text-gray-800 mb-1">O que acontece agora:</p>
                  <ul className="space-y-1">
                    <li>✅ Sistema configurado com produtos de exemplo do seu segmento</li>
                    <li>✅ 10 mesas criadas — personalize depois</li>
                    <li>✅ 14 dias de trial completo — sem cartão</li>
                    <li>✅ Você pode editar tudo no cardápio após entrar</li>
                  </ul>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !name.trim() || !slug || slugAvailable !== true}
                  className="w-full bg-[#00a8cc] hover:bg-[#0092b3] text-white"
                  size="lg"
                >
                  {isSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Configurando seu sistema...</>
                    : 'Criar e entrar no sistema'}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Success ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Tudo pronto!</h2>
              <p className="text-gray-500 mb-2">
                Seu sistema foi configurado com o cardápio de exemplo do segmento <strong>{selectedType?.label}</strong>.
              </p>
              <p className="text-sm text-gray-400 mb-8">
                Você tem <strong>14 dias de trial gratuito</strong>. Edite os produtos, cadastre sua equipe e comece a vender.
              </p>
              <Button
                onClick={() => navigate('/dashboard')}
                className="bg-[#00a8cc] hover:bg-[#0092b3] text-white px-10"
                size="lg"
              >
                Entrar no sistema
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
