import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { ApprovalRequest } from '@/hooks/useApprovalRequest';

interface ApprovalWaitingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ApprovalRequest | null | undefined;
  onApproved: () => void;
  onDenied: (reason: string | null) => void;
  title?: string;
  description?: string;
}

export function ApprovalWaitingDialog({
  open,
  onOpenChange,
  request,
  onApproved,
  onDenied,
  title = 'Aguardando aprovação',
  description = 'Solicitação enviada ao gerente',
}: ApprovalWaitingDialogProps) {
  useEffect(() => {
    if (!request) return;
    if (request.status === 'approved') {
      onApproved();
    } else if (request.status === 'denied') {
      onDenied(request.denial_reason);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.status]);

  const status = request?.status || 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center gap-4">
          {status === 'pending' && (
            <>
              <div className="relative">
                <Clock className="h-16 w-16 text-amber-500" />
                <Loader2 className="h-6 w-6 animate-spin text-amber-500 absolute -bottom-1 -right-1" />
              </div>
              <div>
                <p className="font-medium">{description}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  O gerente irá aprovar ou negar em instantes...
                </p>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
                Cancelar solicitação
              </Button>
            </>
          )}

          {status === 'approved' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="font-medium text-green-700">Aprovado pelo gerente!</p>
            </>
          )}

          {status === 'denied' && (
            <>
              <XCircle className="h-16 w-16 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Negado pelo gerente</p>
                {request?.denial_reason && (
                  <p className="text-sm text-muted-foreground mt-1">{request.denial_reason}</p>
                )}
              </div>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Fechar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
