import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Store, Truck, Banknote, CreditCard, QrCode, Loader2, MapPin } from 'lucide-react';

interface StoreCheckoutProps {
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

export function StoreCheckout({ open, onClose, onSubmit, total, isTable, isLoading, storeName }: StoreCheckoutProps) {
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const isDelivery = !isTable && orderType === 'delivery';
  const isTakeaway = !isTable && orderType === 'takeaway';
  const canSubmit = (!isDelivery || address.trim().length > 0) && (!isTakeaway || name.trim().length > 0);

  const handleSubmit = () => {
    onSubmit({
      order_type: orderType,
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      notes,
      payment_method: paymentMethod,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>Como você quer receber o pedido?</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Order type */}
          {!isTable && (
            <div className="space-y-3">
              <Label className="text-sm font-bold">Tipo do pedido</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setOrderType('takeaway')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    orderType === 'takeaway' ? 'border-amber-500 bg-amber-50/50 shadow-sm' : 'border-border hover:border-amber-200'
                  }`}
                >
                  <Store className={`h-7 w-7 ${orderType === 'takeaway' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-semibold">Retirada</span>
                  <span className="text-[10px] text-muted-foreground">Retire no local</span>
                </button>
                <button
                  onClick={() => setOrderType('delivery')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    orderType === 'delivery' ? 'border-amber-500 bg-amber-50/50 shadow-sm' : 'border-border hover:border-amber-200'
                  }`}
                >
                  <Truck className={`h-7 w-7 ${orderType === 'delivery' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-semibold">Entrega</span>
                  <span className="text-[10px] text-muted-foreground">A gente leva até você</span>
                </button>
              </div>
            </div>
          )}

          {/* Customer info */}
          <div className="space-y-3">
            <Label className="text-sm font-bold">Seus dados</Label>
            <Input
              placeholder={isTakeaway ? "Nome *" : "Nome"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`rounded-xl h-11 ${isTakeaway && !name.trim() ? 'border-destructive' : ''}`}
            />
            <Input
              placeholder="Telefone (WhatsApp)"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl h-11"
            />
            {isDelivery && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  Endereço de entrega
                </div>
                <Textarea
                  placeholder="Rua, número, bairro, complemento..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="rounded-xl"
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-3">
            <Label className="text-sm font-bold">Forma de pagamento</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-1.5">
              {[
                { value: 'cash', label: 'Dinheiro', icon: Banknote },
                { value: 'credit', label: 'Crédito', icon: CreditCard },
                { value: 'debit', label: 'Débito', icon: CreditCard },
                { value: 'pix', label: 'Pix', icon: QrCode },
              ].map(method => (
                <label
                  key={method.value}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === method.value ? 'border-amber-500 bg-amber-50/50' : 'border-border hover:border-amber-200'
                  }`}
                >
                  <RadioGroupItem value={method.value} className="border-amber-400 text-amber-600" />
                  <method.icon className={`h-4 w-4 ${paymentMethod === method.value ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">{method.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-bold">Observações</Label>
            <Textarea
              placeholder="Alguma observação para o pedido?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-3 bg-card flex-shrink-0">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-amber-600">{formatCurrency(total)}</span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="w-full h-13 text-base font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              'Enviar Pedido'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
