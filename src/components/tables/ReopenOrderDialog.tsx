import React, { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Order } from '@/hooks/useOrders';
import { Table } from '@/hooks/useTables';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_REASON_LENGTH = 10;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ReopenOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  table: Table | null;
  onConfirm: (reason: string) => Promise<void>;
  isReopening?: boolean;
}

export const ReopenOrderDialog = memo(function ReopenOrderDialog({
  open,
  onOpenChange,
  order,
  table,
  onConfirm,
  isReopening = false,
}: ReopenOrderDialogProps) {
  // Local state for input - prevents parent re-renders on every keystroke
  const [reason, setReason] = useState('');

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (reason.length < MIN_REASON_LENGTH) return;
    await onConfirm(reason);
  };

  const handleClose = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reabrir Mesa {table?.number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {order && (
            <>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pedido</span>
                  <span className="font-mono">#{order.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Itens</span>
                  <span>{order.order_items?.length || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold">{formatCurrency(order.total || 0)}</span>
                </div>
                {order.customer_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cliente</span>
                    <span>{order.customer_name}</span>
                  </div>
                )}
              </div>
              
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-warning">Atenção</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Ao reabrir a mesa, o pedido voltará para produção e você poderá adicionar ou remover itens.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Motivo da Reabertura *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Descreva o motivo da reabertura (mín. 10 caracteres)"
                  className={cn(
                    reason.length > 0 && reason.length < MIN_REASON_LENGTH
                      ? "border-destructive"
                      : ""
                  )}
                />
                <p className={cn(
                  "text-xs",
                  reason.length < MIN_REASON_LENGTH ? "text-muted-foreground" : "text-accent"
                )}>
                  {reason.length}/{MIN_REASON_LENGTH} caracteres mínimos
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isReopening || reason.length < MIN_REASON_LENGTH}
          >
            {isReopening ? 'Reabrindo...' : 'Reabrir Mesa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
