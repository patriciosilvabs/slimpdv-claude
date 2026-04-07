import { useState } from 'react';
import { usePendingApprovals } from '@/hooks/useApprovalRequest';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Bell, Percent, Trash2, RefreshCw, AlertCircle } from 'lucide-react';

const RULE_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  discount: { label: 'Desconto', icon: Percent, color: 'text-amber-500' },
  cancellation: { label: 'Cancelamento', icon: Trash2, color: 'text-destructive' },
  cash_reopen: { label: 'Reabertura de Caixa', icon: RefreshCw, color: 'text-blue-500' },
  custom: { label: 'Autorização', icon: AlertCircle, color: 'text-muted-foreground' },
};

function formatContext(ruleType: string, context: Record<string, unknown>): string {
  if (ruleType === 'discount') {
    const pct = context.discount_percent as number;
    const order = context.order_number || context.order_id;
    const limit = context.user_limit as number;
    return `${pct}% no pedido #${order} (limite: ${limit}%)`;
  }
  if (ruleType === 'cancellation') {
    const item = context.item_name || context.order_number || 'item';
    const reason = context.reason;
    return `"${item}"${reason ? ` — Motivo: ${reason}` : ''}`;
  }
  if (ruleType === 'cash_reopen') {
    return `Reabertura do caixa`;
  }
  return JSON.stringify(context);
}

export function ManagerApprovalListener() {
  const { canApprove, pendingRequests, approveRequest, denyRequest } = usePendingApprovals();
  const [open, setOpen] = useState(false);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');

  if (!canApprove || pendingRequests.length === 0) return null;

  const handleApprove = async (id: string) => {
    await approveRequest.mutateAsync(id);
  };

  const handleDeny = async () => {
    if (!denyingId) return;
    await denyRequest.mutateAsync({ requestId: denyingId, reason: denyReason || 'Negado pelo gerente' });
    setDenyingId(null);
    setDenyReason('');
    if (pendingRequests.length <= 1) setOpen(false);
  };

  return (
    <>
      {/* Floating badge */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-full shadow-lg transition-all animate-bounce"
      >
        <Bell className="h-5 w-5" />
        <span className="font-bold text-sm">
          {pendingRequests.length} aprovação{pendingRequests.length > 1 ? 'ões' : ''} pendente{pendingRequests.length > 1 ? 's' : ''}
        </span>
      </button>

      {/* Approval dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" />
              Solicitações de Aprovação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {pendingRequests.map((req) => {
              const typeInfo = RULE_TYPE_LABELS[req.rule_type] || RULE_TYPE_LABELS.custom;
              const TypeIcon = typeInfo.icon;
              return (
                <Card key={req.id} className="border-amber-200">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-muted mt-0.5">
                        <TypeIcon className={`h-4 w-4 ${typeInfo.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{typeInfo.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {req.requested_by_name || 'Operador'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground break-words">
                          {formatContext(req.rule_type, req.context)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(req.created_at).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {denyingId === req.id ? (
                      <div className="mt-3 space-y-2">
                        <Label className="text-xs">Motivo da recusa (opcional)</Label>
                        <Input
                          placeholder="Ex: desconto não autorizado para este produto"
                          value={denyReason}
                          onChange={(e) => setDenyReason(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleDeny}
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Confirmar recusa
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setDenyingId(null); setDenyReason(''); }}
                            className="flex-1"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(req.id)}
                          disabled={approveRequest.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => setDenyingId(req.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Negar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
