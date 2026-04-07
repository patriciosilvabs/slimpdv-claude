import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Check, X, Clock, Trash2 } from "lucide-react";
import { OfflineOperation } from "@/hooks/useOfflineSupport";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SyncProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingOperations: OfflineOperation[];
  isSyncing: boolean;
  onSync: () => void;
  onClear: () => void;
}

const actionLabels: Record<string, string> = {
  create: 'Criar',
  update: 'Atualizar',
  delete: 'Excluir'
};

const tableLabels: Record<string, string> = {
  orders: 'Pedido',
  order_items: 'Item do Pedido',
  tables: 'Mesa',
  products: 'Produto',
  categories: 'Categoria',
  payments: 'Pagamento'
};

export function SyncProgressDialog({
  open,
  onOpenChange,
  pendingOperations,
  isSyncing,
  onSync,
  onClear
}: SyncProgressDialogProps) {
  const progress = isSyncing ? 50 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Operações Pendentes
          </DialogTitle>
          <DialogDescription>
            {pendingOperations.length === 0
              ? 'Todas as operações foram sincronizadas.'
              : `${pendingOperations.length} operação(ões) aguardando sincronização.`}
          </DialogDescription>
        </DialogHeader>

        {isSyncing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Sincronizando...</span>
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {pendingOperations.length > 0 && (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {pendingOperations.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={op.action === 'delete' ? 'destructive' : 'secondary'}>
                      {actionLabels[op.action] || op.action}
                    </Badge>
                    <span className="text-sm font-medium">
                      {tableLabels[op.table] || op.table}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(op.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            onClick={onSync}
            disabled={isSyncing || pendingOperations.length === 0}
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Sincronizar Agora
              </>
            )}
          </Button>
          
          {pendingOperations.length > 0 && (
            <Button
              variant="destructive"
              onClick={onClear}
              disabled={isSyncing}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
