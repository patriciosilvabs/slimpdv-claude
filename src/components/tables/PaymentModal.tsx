import React, { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentMethod } from '@/hooks/useCashRegister';
import { Banknote, CreditCard, Smartphone, ArrowLeft, Wallet } from 'lucide-react';

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  pix: 'Pix',
};

const paymentMethodIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  debit_card: <CreditCard className="h-5 w-5" />,
  pix: <Smartphone className="h-5 w-5" />,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethod: PaymentMethod | null;
  remainingAmount: number;
  onConfirmPayment: (amount: number, observation: string) => void;
  onPartialPayment: (amount: number, observation: string) => void;
  canManagePayments?: boolean;
}

export const PaymentModal = memo(function PaymentModal({
  open,
  onOpenChange,
  paymentMethod,
  remainingAmount,
  onConfirmPayment,
  onPartialPayment,
  canManagePayments = true,
}: PaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentObservation, setPaymentObservation] = useState('');
  const [showObservationError, setShowObservationError] = useState(false);

  const isReceiptRequired = paymentMethod === 'credit_card' || paymentMethod === 'debit_card' || paymentMethod === 'pix';
  const isObservationValid = !isReceiptRequired || paymentObservation.trim().length > 0;

  useEffect(() => {
    if (open && remainingAmount > 0) {
      setPaymentAmount(remainingAmount.toFixed(2).replace('.', ','));
      setPaymentObservation('');
      setShowObservationError(false);
    }
  }, [open, remainingAmount]);

  const handleConfirm = () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;
    if (isReceiptRequired && !paymentObservation.trim()) {
      setShowObservationError(true);
      return;
    }
    onConfirmPayment(amount, paymentObservation);
  };

  const handlePartial = () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;
    if (isReceiptRequired && !paymentObservation.trim()) {
      setShowObservationError(true);
      return;
    }
    onPartialPayment(amount, paymentObservation);
  };

  const parsedAmount = parseFloat(paymentAmount.replace(',', '.'));
  const changeAmount = paymentMethod === 'cash' && !isNaN(parsedAmount) && parsedAmount > remainingAmount
    ? parsedAmount - remainingAmount
    : 0;

  if (!paymentMethod) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {paymentMethodIcons[paymentMethod]}
            Pagamento em {paymentMethodLabels[paymentMethod]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Falta pagar</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(remainingAmount)}</p>
          </div>
          <div className="space-y-2">
            <Label>Valor Recebido</Label>
            <div className="flex items-center gap-2">
              <span className="text-lg">R$</span>
              <Input
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0,00"
                className="text-lg min-w-0"
                autoFocus
              />
            </div>
          </div>
          {changeAmount > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800 rounded-lg text-center">
              <p className="text-sm text-green-700 dark:text-green-400">Troco</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(changeAmount)}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>
              {isReceiptRequired ? 'Código do comprovante *' : 'Observação (opcional)'}
            </Label>
            <Input
              value={paymentObservation}
              onChange={(e) => {
                setPaymentObservation(e.target.value);
                if (showObservationError) setShowObservationError(false);
              }}
              placeholder={isReceiptRequired ? 'Ex: Código do comprovante' : 'Ex: Troco R$50'}
              className={showObservationError ? 'border-destructive' : ''}
            />
            {showObservationError && (
              <p className="text-sm text-destructive">Informe o código do comprovante</p>
            )}
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          {canManagePayments && (
            <Button 
              variant="secondary" 
              onClick={handlePartial}
              className="w-full sm:w-auto"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Parcial
            </Button>
          )}
          <Button onClick={handleConfirm} className="w-full sm:w-auto" disabled={isReceiptRequired && !paymentObservation.trim()}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
