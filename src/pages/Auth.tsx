import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, AlertCircle, CheckCircle2,
  UtensilsCrossed, BarChart3, Users, Tablet,
  CreditCard, Package, Kanban, Clock, ShieldCheck,
  Store, ChefHat, TrendingUp, Star, ArrowRight, MessageCircle,
} from 'lucide-react';
import logoSlim from '@/assets/logo-slim.png';
import { z } from 'zod';
import { getLoginErrorMessage } from '@/lib/authErrors';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

interface FieldErrors { [key: string]: string | undefined }

const features = [
  { icon: Kanban, title: 'Gestão de Pedidos', desc: 'Controle em tempo real de todos os pedidos — mesas, balcão e delivery em uma única tela.' },
  { icon: ChefHat, title: 'KDS — Tela da Cozinha', desc: 'Monitor para a cozinha receber pedidos na hora. Sem papel, sem grito, sem erro.' },
  { icon: UtensilsCrossed, title: 'Mesas e Comanda', desc: 'Abertura, transferência e fechamento de mesas com fluxo pensado para o movimento real.' },
  { icon: Store, title: 'Balcão & Delivery', desc: 'Atenda no balcão e gerencie pedidos delivery com o mesmo sistema integrado.' },
  { icon: CreditCard, title: 'Controle de Caixa', desc: 'Abertura, sangria, suprimento e fechamento de caixa com histórico completo.' },
  { icon: Package, title: 'Estoque', desc: 'Controle de ingredientes e insumos. Saiba o que vai faltar antes que falte.' },
  { icon: BarChart3, title: 'Relatórios', desc: 'Vendas por período, por produto, por operador. Dados reais para decisões certas.' },
  { icon: Users, title: 'Multi-usuários', desc: 'Cada colaborador com seu acesso e permissões. Admin, caixa, garçom, cozinha.' },
  { icon: ShieldCheck, title: 'Aprovações & Auditoria', desc: 'Cancelamentos e reabertura com autorização. Trilha de auditoria completa.' },
  { icon: TrendingUp, title: 'Metas por Turno', desc: 'Defina metas de venda por turno e acompanhe o desempenho da equipe.' },
  { icon: Store, title: 'Multi-lojas', desc: 'Gerencie mais de uma unidade com o mesmo sistema. Ideal para quem está crescendo.' },
  { icon: Tablet, title: 'PWA — Funciona no celular', desc: 'Instale no celular ou tablet sem precisar de app store. Funciona offline.' },
];

const pains = [
  { emoji: '😤', text: 'Pedidos chegando errado na cozinha' },
  { emoji: '📄', text: 'Comanda de papel que some ou rasura' },
  { emoji: '🔒', text: 'Sem controle de quem cancelou o quê' },
  { emoji: '📊', text: 'Não sabe qual produto mais vende' },
  { emoji: '💸', text: 'Caixa que fecha sem bater' },
  { emoji: '👥', text: 'Equipe sem padronização no atendimento' },
];

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useAuth();
  const { hasTenant, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();

  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginErrors, setLoginErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [registerData, setRegisterData] = useState({ name: '', email: '', password: '' });
  const [registerErrors, setRegisterErrors] = useState<FieldErrors>({});

  if (loading || (user && tenantLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={hasTenant ? '/dashboard' : '/onboarding'} replace />;
  }

  const validateField = (field: keyof typeof loginData, value: string) => {
    const result = loginSchema.safeParse({ ...loginData, [field]: value });
    const fieldError = result.success ? undefined : result.error.errors.find(e => e.path[0] === field)?.message;
    setLoginErrors(prev => ({ ...prev, [field]: fieldError }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      const errors: FieldErrors = {};
      result.error.errors.forEach(err => { errors[err.path[0] as string] = err.message; });
      setLoginErrors(errors);
      return;
    }
    setIsSubmitting(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Erro ao entrar', description: getLoginErrorMessage(error), variant: 'destructive' });
    }
  };

  const openLogin = () => setLoginOpen(true);
  const openRegister = () => { setRegisterData({ name: '', email: '', password: '' }); setRegisterErrors({}); setRegisterOpen(true); };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    if (!registerData.name.trim()) errors.name = 'Nome é obrigatório';
    if (!registerData.email || !/\S+@\S+\.\S+/.test(registerData.email)) errors.email = 'Email inválido';
    if (registerData.password.length < 6) errors.password = 'Senha deve ter pelo menos 6 caracteres';
    if (Object.keys(errors).length) { setRegisterErrors(errors); return; }
    setIsSubmitting(true);
    const { error } = await signUp(registerData.email, registerData.password, registerData.name);
    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Erro ao criar conta', description: (error as any)?.message || 'Tente novamente', variant: 'destructive' });
    } else {
      setRegisterOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ── NAV ────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <img src={logoSlim} alt="slim PDV" className="h-10 object-contain" />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-800"
              onClick={() => navigate('/kds')}
            >
              <Tablet className="h-4 w-4 mr-1.5" />
              KDS
            </Button>
            <Button onClick={openLogin} className="bg-[#00a8cc] hover:bg-[#0092b3] text-white rounded-full px-5">
              Já sou cliente
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-[#f0fafe] via-white to-[#f0fafe]">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo destaque no topo */}
          <div className="flex justify-center mb-8">
            <img src={logoSlim} alt="slim PDV — Sistema para Restaurante" className="h-28 sm:h-36 object-contain" />
          </div>
          <div className="inline-flex items-center gap-2 bg-[#00a8cc]/10 text-[#00a8cc] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <Star className="h-3.5 w-3.5 fill-current" />
            Criado por quem gerencia 3 pizzarias
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            O PDV que nasceu<br />
            <span className="text-[#00a8cc]">dentro do food service</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Não foi feito por programadores que nunca viram uma cozinha lotada.
            Foi construído por um dono de restaurante que viveu cada problema que você enfrenta todo dia.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-[#00a8cc] hover:bg-[#0092b3] text-white text-lg px-10 py-7 rounded-xl shadow-xl shadow-[#00a8cc]/40 font-bold"
              style={{ animation: 'gentlePulse 3s ease-in-out infinite' }}
              onClick={openRegister}
            >
              Testar agora — 14 dias grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 rounded-xl border-gray-300"
              onClick={openLogin}
            >
              Já sou cliente — Entrar
            </Button>
          </div>
          <p className="text-sm text-gray-400 mt-3">Sem cartão de crédito. Cancele quando quiser.</p>
        </div>
      </section>

      {/* ── DORES ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gray-950 text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">
            Você se identifica com algum desses problemas?
          </h2>
          <p className="text-gray-400 text-center mb-12">
            Se sim, você está no lugar certo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pains.map((p, i) => (
              <div key={i} className="flex items-center gap-4 bg-gray-800 rounded-xl p-4">
                <span className="text-3xl">{p.emoji}</span>
                <span className="text-gray-200 font-medium">{p.text}</span>
              </div>
            ))}
          </div>
          <p className="text-center mt-10 text-gray-400 text-lg">
            O slim foi construído para resolver exatamente isso —
            <span className="text-[#00a8cc] font-semibold"> por quem já sofreu com tudo isso.</span>
          </p>
        </div>
      </section>

      {/* ── HISTÓRIA ───────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#f0fafe] to-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block bg-[#00a8cc]/10 text-[#00a8cc] text-sm font-semibold px-3 py-1 rounded-full mb-4">
                A história por trás do slim
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6 leading-snug">
                Dono de 3 pizzarias cansou de sistemas que não entendiam o food service
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Depois de anos testando sistemas genéricos que nunca se adaptavam à realidade de um restaurante em movimento — pedido errado chegando na cozinha, caixa que não fechava, equipe sem controle — um proprietário de 3 pizzarias decidiu construir ele mesmo.
                </p>
                <p>
                  O slim nasceu dentro da operação real. Cada funcionalidade foi desenhada pensando no movimento do dia a dia: sexta-feira à noite com 40 mesas abertas, cozinheiro olhando pro KDS, caixa fechando turno, supervisor aprovando cancelamento.
                </p>
                <p className="font-semibold text-gray-800">
                  Não é um sistema genérico adaptado para restaurantes. É um sistema de restaurante, ponto.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { number: '3', label: 'Pizzarias na origem do projeto' },
                { number: '100%', label: 'Focado em food service' },
                { number: '0', label: 'Papel, comanda perdida ou erro de pedido' },
                { number: '∞', label: 'Controle sobre sua operação' },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                  <p className="text-3xl font-extrabold text-[#00a8cc] mb-1">{stat.number}</p>
                  <p className="text-sm text-gray-500 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Tudo que você precisa, em um só lugar</h2>
            <p className="text-gray-500 text-lg">Sem módulos extras. Sem cobranças adicionais. Completo do jeito certo.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div key={i} className="group p-5 rounded-2xl border border-gray-100 hover:border-[#00a8cc]/30 hover:shadow-md transition-all bg-white">
                <div className="w-10 h-10 rounded-xl bg-[#00a8cc]/10 flex items-center justify-center mb-4 group-hover:bg-[#00a8cc]/20 transition-colors">
                  <f.icon className="h-5 w-5 text-[#00a8cc]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARA QUEM ──────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Para quem é o slim?</h2>
          <p className="text-gray-500 mb-12">Do microempreendedor à rede com múltiplas unidades.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: '🍕',
                title: 'Micro e pequenos negócios',
                desc: 'Pizzaria, lanchonete, hamburgueria, açaí. Qualquer operação de food service que quer profissionalizar o atendimento.',
              },
              {
                icon: '🍽️',
                title: 'Restaurantes e bares',
                desc: 'Gestão completa de mesas, comanda digital, caixa e relatórios. Tudo para dar conta do movimento.',
              },
              {
                icon: '🏪',
                title: 'Redes e multi-lojas',
                desc: 'Gerencie várias unidades com o mesmo sistema. Visão consolidada, usuários por loja, controle total.',
              },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-left">
                <span className="text-4xl mb-4 block">{c.icon}</span>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{c.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────────── */}
      <section id="contato" className="py-24 px-4 bg-[#00a8cc]">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Pronto para transformar sua operação?
          </h2>
          <p className="text-[#d0f2fb] text-lg mb-10 leading-relaxed">
            Fale com a gente pelo WhatsApp. Sem enrolação, sem apresentação de 2 horas. Mostramos o sistema funcionando de verdade em menos de 20 minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#00a8cc] hover:bg-gray-50 text-base font-bold px-8 py-6 rounded-xl shadow-lg"
              onClick={openRegister}
            >
              Testar agora — 14 dias grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/50 text-white hover:bg-white/10 text-base px-8 py-6 rounded-xl"
              onClick={() => window.open('https://wa.me/5500000000000?text=Oi%2C+quero+conhecer+o+slim+PDV', '_blank')}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Falar no WhatsApp
            </Button>
          </div>
          <p className="text-[#d0f2fb]/70 text-sm mt-4">Sem cartão de crédito. Cancele quando quiser.</p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-500 py-8 px-4 text-center text-sm">
        <img src={logoSlim} alt="slim PDV" className="h-8 object-contain mx-auto mb-3 opacity-60" />
        <p>Sistema PDV desenvolvido para food service. Feito por quem vive o setor.</p>
        <div className="mt-3 flex justify-center gap-4">
          <button
            className="hover:text-white transition-colors"
            onClick={openLogin}
          >
            Entrar no sistema
          </button>
          <button
            className="hover:text-white transition-colors"
            onClick={() => navigate('/kds')}
          >
            Acessar KDS
          </button>
        </div>
      </footer>

      {/* ── LOGIN DIALOG ───────────────────────────────────────────────── */}
      {/* ── REGISTER DIALOG ─────────────────────────────────────────────── */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center pb-2">
            <img src={logoSlim} alt="slim PDV" className="h-14 object-contain mx-auto mb-2" />
            <DialogTitle className="text-xl">Criar conta grátis</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">14 dias de trial, sem cartão de crédito</p>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Nome completo</Label>
              <Input
                id="reg-name"
                type="text"
                placeholder="Seu nome"
                value={registerData.name}
                onChange={e => setRegisterData(d => ({ ...d, name: e.target.value }))}
                className={registerErrors.name ? 'border-destructive' : ''}
                autoFocus
              />
              {registerErrors.name && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{registerErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="seu@email.com"
                value={registerData.email}
                onChange={e => setRegisterData(d => ({ ...d, email: e.target.value }))}
                className={registerErrors.email ? 'border-destructive' : ''}
              />
              {registerErrors.email && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{registerErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Senha</Label>
              <Input
                id="reg-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={registerData.password}
                onChange={e => setRegisterData(d => ({ ...d, password: e.target.value }))}
                className={registerErrors.password ? 'border-destructive' : ''}
              />
              {registerErrors.password && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{registerErrors.password}</p>}
            </div>
            <Button
              type="submit"
              className="w-full bg-[#00a8cc] hover:bg-[#0092b3] text-white font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta e começar trial
            </Button>
            <p className="text-center text-sm text-gray-400">
              Já tem conta?{' '}
              <button type="button" className="text-[#00a8cc] hover:underline font-medium" onClick={() => { setRegisterOpen(false); setLoginOpen(true); }}>
                Entrar
              </button>
            </p>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center pb-2">
            <img src={logoSlim} alt="slim PDV" className="h-14 object-contain mx-auto mb-2" />
            <DialogTitle className="text-xl">Entrar no slim</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                onBlur={(e) => validateField('email', e.target.value)}
                className={loginErrors.email ? 'border-destructive' : ''}
                autoFocus
              />
              {loginErrors.email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {loginErrors.email}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  onBlur={(e) => validateField('password', e.target.value)}
                  className={loginErrors.password ? 'border-destructive' : ''}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword
                    ? <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                    : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
              {loginErrors.password && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {loginErrors.password}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-[#00a8cc] hover:bg-[#0092b3] text-white"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
            <div className="text-center pt-1">
              <button
                type="button"
                className="text-sm text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline"
                onClick={() => navigate('/kds')}
              >
                <Tablet className="inline h-3.5 w-3.5 mr-1" />
                Acessar KDS (tablets e monitores)
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
