import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Store, Truck, Banknote, CreditCard, QrCode, Loader2, MapPin, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PizzaCheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    order_type: 'takeaway' | 'delivery';
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    notes: string;
    payment_method: string;
  }) => void;
  total: number;
  isTable: boolean;
  isLoading: boolean;
  storeName: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const paymentMethods = [
  { value: 'pix', label: 'Pix', icon: QrCode, badge: '5% OFF' },
  { value: 'credit', label: 'Crédito', icon: CreditCard },
  { value: 'debit', label: 'Débito', icon: CreditCard },
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
];

export function PizzaCheckoutSheet({ open, onClose, onSubmit, total, isTable, isLoading, storeName }: PizzaCheckoutSheetProps) {
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');

  const isDelivery = !isTable && orderType === 'delivery';
  const canSubmit = (!isDelivery || address.trim().length > 0) && name.trim().length > 0;

  const handleSubmit = () => {
    onSubmit({ order_type: orderType, customer_name: name, customer_phone: phone, customer_address: address, notes, payment_method: paymentMethod });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl p-0 flex flex-col pizza-store" style={{ background: 'hsl(var(--store-bg))' }}>
        <SheetHeader className="p-5 border-b" style={{ borderColor: 'hsl(var(--store-border))' }}>
          <SheetTitle className="text-lg font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>
            Finalizar Pedido
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Order Type */}
          {!isTable && (
            <div className="space-y-3">
              <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Como quer receber?</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: 'takeaway' as const, icon: Store, label: 'Retirada', sub: 'Retire no local' },
                  { type: 'delivery' as const, icon: Truck, label: 'Entrega', sub: 'Receba em casa' },
                ].map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => setOrderType(opt.type)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                      orderType === opt.type
                        ? "border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary-light))]"
                        : "border-[hsl(var(--store-border))] bg-white"
                    )}
                  >
                    <opt.icon className={cn("h-7 w-7", orderType === opt.type ? "text-[hsl(var(--store-primary))]" : "text-[hsl(var(--store-muted))]")} />
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{opt.label}</span>
                    <span className="text-[10px]" style={{ color: 'hsl(var(--store-muted))' }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-3">
            <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Seus dados</label>
            <Input placeholder="Nome *" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-2xl border bg-white text-sm" style={{ borderColor: 'hsl(var(--store-border))' }} />
            <Input placeholder="WhatsApp" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-2xl border bg-white text-sm" style={{ borderColor: 'hsl(var(--store-border))' }} />
            {isDelivery && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'hsl(var(--store-muted))' }}>
                  <MapPin className="h-3.5 w-3.5" /> Endereço de entrega
                </div>
                <Textarea placeholder="Rua, número, bairro, complemento..." value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-2xl border bg-white text-sm" style={{ borderColor: 'hsl(var(--store-border))' }} rows={2} />
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="space-y-3">
            <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Forma de pagamento</label>
            <div className="space-y-2">
              {paymentMethods.map(method => {
                const isSelected = paymentMethod === method.value;
                return (
                  <button
                    key={method.value}
                    onClick={() => setPaymentMethod(method.value)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                      isSelected
                        ? "border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary-light))]"
                        : "border-[hsl(var(--store-border))] bg-white"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      isSelected ? "border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary))]" : "border-gray-300"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <method.icon className={cn("h-5 w-5", isSelected ? "text-[hsl(var(--store-primary))]" : "text-[hsl(var(--store-muted))]")} />
                    <span className="text-sm font-semibold flex-1" style={{ color: 'hsl(var(--store-card-foreground))' }}>{method.label}</span>
                    {method.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{method.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Observações</label>
            <Textarea placeholder="Alguma observação?" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-2xl border bg-white text-sm" style={{ borderColor: 'hsl(var(--store-border))' }} rows={2} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-5 space-y-3 bg-white flex-shrink-0" style={{ borderColor: 'hsl(var(--store-border))' }}>
          <div className="flex justify-between text-lg font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>
            <span>Total</span>
            <span className="text-[hsl(var(--store-primary))]">{formatCurrency(total)}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="w-full h-14 rounded-2xl bg-[hsl(var(--store-primary))] text-white font-bold text-base shadow-lg hover:shadow-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Enviando...</>
            ) : (
              'Confirmar e Pagar'
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
