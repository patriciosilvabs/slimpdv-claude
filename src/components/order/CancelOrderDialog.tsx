import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, XCircle } from 'lucide-react';
import { useBusinessRules } from '@/hooks/useBusinessRules';
import { useRequestApproval, ApprovalRequest } from '@/hooks/useApprovalRequest';
import { ApprovalWaitingDialog } from '@/components/ApprovalWaitingDialog';
import { toast } from 'sonner';

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  orderInfo?: string;
  isLoading?: boolean;
}

const SUGGESTED_REASONS = [
  'Cliente desistiu',
  'Erro no pedido',
  'Produto indisponível',
  'Tempo de espera excedido',
  'Pedido duplicado',
  'Outro motivo',
];

export function CancelOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  orderInfo,
  isLoading = false,
}: CancelOrderDialogProps) {
  const [reason, setReason] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [waitingApproval, setWaitingApproval] = useState(false);

  const { rules } = useBusinessRules();
  const { createRequest, watchRequest } = useRequestApproval();
  const { data: watchedRequest } = watchRequest(approvalRequest?.id ?? null);

  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion === 'Outro motivo') {
      setReason('');
    } else {
      setReason(suggestion);
    }
  };

  const handleProceed = () => {
    if (reason.trim().length < 3) return;
    setShowConfirmation(true);
  };

  const doConfirm = () => {
    setIsProcessing(true);
    // Fecha AMBOS dialogs IMEDIATAMENTE para evitar flicker
    setShowConfirmation(false);
    onOpenChange(false);
    // Executa a ação de cancelamento
    onConfirm(reason.trim());
    // Reset estados após pequeno delay
    setTimeout(() => {
      setReason('');
      setIsProcessing(false);
    }, 100);
  };

  const handleConfirm = async () => {
    if (rules.require_auth_cancellation) {
      // Need manager approval first
      setShowConfirmation(false);
      try {
        const req = await createRequest.mutateAsync({
          rule_type: 'cancellation',
          context: {
            order_number: orderInfo || 'pedido',
            reason: reason.trim(),
          },
        });
        setApprovalRequest(req);
        setWaitingApproval(true);
      } catch {
        toast.error('Erro ao solicitar aprovação');
      }
    } else {
      doConfirm();
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setReason('');
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const isValid = reason.trim().length >= 3;

  return (
    <>
      {/* Approval waiting dialog */}
      <ApprovalWaitingDialog
        open={waitingApproval}
        onOpenChange={(open) => {
          if (!open) {
            setWaitingApproval(false);
            setApprovalRequest(null);
          }
        }}
        request={watchedRequest ?? approvalRequest}
        onApproved={() => {
          setWaitingApproval(false);
          setApprovalRequest(null);
          doConfirm();
        }}
        onDenied={(denialReason) => {
          setWaitingApproval(false);
          setApprovalRequest(null);
          toast.error(`Cancelamento negado pelo gerente${denialReason ? `: ${denialReason}` : ''}`);
        }}
        title="Aguardando aprovação do gerente"
        description="Solicitação de cancelamento enviada ao gerente"
      />

      {/* Main Dialog */}
      <AlertDialog open={open && !showConfirmation && !isProcessing} onOpenChange={handleClose}>
        <AlertDialogContent className="max-w-md bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Cancelar Pedido
            </AlertDialogTitle>
            <AlertDialogDescription>
              {orderInfo && (
                <span className="block mb-2 font-medium">{orderInfo}</span>
              )}
              Informe o motivo do cancelamento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Motivo do cancelamento *</Label>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Digite o motivo do cancelamento..."
                className="min-h-[80px]"
              />
              {!isValid && reason.length > 0 && (
                <p className="text-xs text-destructive">
                  O motivo deve ter pelo menos 3 caracteres
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Sugestões rápidas:</Label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_REASONS.map((suggestion) => (
                  <Badge
                    key={suggestion}
                    variant={reason === suggestion ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading || isProcessing}>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleProceed}
              disabled={!isValid || isLoading || isProcessing}
            >
              Continuar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation && !isProcessing} onOpenChange={(val) => !isProcessing && setShowConfirmation(val)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Cancelamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Tem certeza que deseja cancelar este pedido?
              </span>
              <span className="block text-sm bg-muted p-2 rounded">
                <strong>Motivo:</strong> {reason}
              </span>
              <span className="block text-destructive font-medium">
                Esta ação não pode ser desfeita!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowConfirmation(false)}
              disabled={isLoading || isProcessing}
            >
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoading || isProcessing}
            >
              {isLoading || isProcessing ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
