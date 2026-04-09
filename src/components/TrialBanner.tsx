import { useTenantContext } from '@/contexts/TenantContext';
import { Clock, X, QrCode, CreditCard, Copy, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { client as apiClient } from '@/integrations/api/client';

const PLANS = [
  { key: 'monthly',   label: 'Mensal',     price: 'R$ 299,90/mês',   desc: '' },
  { key: 'quarterly', label: 'Trimestral', price: 'R$ 764,74',        desc: '15% off' },
  { key: 'annual',    label: 'Anual',      price: 'R$ 2.699,10',      desc: '25% off' },
] as const;

type PlanKey = typeof PLANS[number]['key'];

interface CheckoutData {
  subscriptionId: string;
  paymentId: string;
  value: number;
  planName: string;
  dueDate: string;
  pixQrCode?: string;
  pixCopiaECola?: string;
  pending?: boolean;
}

export function TrialBanner() {
  const { activeTenant } = useTenantContext();
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('monthly');
  const [loading, setLoading] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  if (dismissed) return null;

  const trialEndsAt = activeTenant?.trial_ends_at;
  const plan = activeTenant?.plan;

  if (!trialEndsAt || plan !== 'trial') return null;

  const msLeft = new Date(trialEndsAt).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

  if (daysLeft <= 0) return null;

  const urgent = daysLeft <= 3;
  const showPayment = daysLeft <= 1;

  const handleCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.post<CheckoutData>('/subscriptions/checkout', { planType: selectedPlan });
      setCheckout(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar cobrança. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (checkout?.pixCopiaECola) {
      navigator.clipboard.writeText(checkout.pixCopiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const openModal = () => {
    setCheckout(null);
    setError('');
    setShowModal(true);
  };

  return (
    <>
      {/* Banner fixo no topo */}
      <div className={`fixed top-16 xl:top-0 left-0 xl:left-52 right-0 z-30 flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium shadow-md ${
        urgent ? 'bg-destructive text-destructive-foreground' : 'bg-[#00a8cc] text-white'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {showPayment
              ? 'Seu trial vence em menos de 24h — assine agora para manter o acesso.'
              : urgent
                ? `Apenas ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''} no trial.`
                : `Trial: ${daysLeft} dias restantes. Explore à vontade!`
            }
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1 text-xs font-semibold"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Assinar
          </button>
          <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100 transition-opacity" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal de assinatura */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>

            {!checkout ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">Escolha seu plano</h2>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3 mb-5">
                  {PLANS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setSelectedPlan(p.key)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                        selectedPlan === p.key
                          ? 'border-[#00a8cc] bg-[#00a8cc]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{p.label}</p>
                        {p.desc && <p className="text-xs text-green-600 font-medium">{p.desc}</p>}
                      </div>
                      <p className="font-bold text-[#00a8cc] text-sm">{p.price}</p>
                    </button>
                  ))}
                </div>

                {error && <p className="text-sm text-destructive mb-3">{error}</p>}

                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#00a8cc] text-white font-semibold hover:bg-[#0092b3] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</> : 'Gerar QR Code PIX'}
                </button>
                <p className="text-xs text-gray-400 text-center mt-3">Renovação automática. Cancele quando quiser.</p>
              </>
            ) : checkout.pending ? (
              <div className="text-center py-6">
                <Loader2 className="h-10 w-10 animate-spin text-[#00a8cc] mx-auto mb-4" />
                <p className="text-gray-700 font-medium">Gerando cobrança...</p>
                <p className="text-sm text-gray-400 mt-1">Aguarde alguns instantes e tente novamente.</p>
                <button onClick={() => setCheckout(null)} className="mt-4 text-sm text-[#00a8cc] underline">
                  Voltar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Pagar via PIX</h2>
                    <p className="text-sm text-gray-500">Plano {checkout.planName} · R$ {checkout.value.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {checkout.pixQrCode && (
                  <div className="bg-gray-50 rounded-xl p-3 flex justify-center mb-4">
                    <img
                      src={`data:image/png;base64,${checkout.pixQrCode}`}
                      alt="QR Code PIX"
                      className="w-48 h-48"
                    />
                  </div>
                )}

                {checkout.pixCopiaECola && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-1">PIX Copia e Cola</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={checkout.pixCopiaECola}
                        className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono truncate"
                      />
                      <button
                        onClick={handleCopy}
                        className="flex-shrink-0 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-4">
                  Após o pagamento, a ativação é automática em até 5 minutos.
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setCheckout(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Trocar plano
                  </button>
                  <button
                    onClick={() => window.open('https://wa.me/5500000000000?text=Realizei+o+pagamento+do+slim+PDV', '_blank')}
                    className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600"
                  >
                    Avisar no WhatsApp
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
