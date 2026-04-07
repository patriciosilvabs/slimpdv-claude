import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, XCircle } from "lucide-react";

interface CancelItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  itemName: string;
  quantity: number;
  price: number;
  isLoading?: boolean;
}

const QUICK_REASONS = [
  "Cliente desistiu",
  "Erro no preparo",
  "Produto acabou",
  "Pedido duplicado",
  "Erro de digitação",
];

export function CancelItemDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  quantity,
  price,
  isLoading = false,
}: CancelItemDialogProps) {
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"reason" | "confirm">("reason");

  const handleClose = () => {
    setReason("");
    setStep("reason");
    onOpenChange(false);
  };

  const handleNext = () => {
    if (reason.trim()) {
      setStep("confirm");
    }
  };

  const handleConfirm = () => {
    onConfirm(reason.trim());
    handleClose();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Cancelar Item
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-foreground">
                  {quantity}x {itemName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Valor: {formatCurrency(price)}
                </p>
              </div>

              {step === "reason" ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    Informe o motivo do cancelamento deste item:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_REASONS.map((quickReason) => (
                      <Button
                        key={quickReason}
                        type="button"
                        variant={reason === quickReason ? "default" : "outline"}
                        size="sm"
                        onClick={() => setReason(quickReason)}
                      >
                        {quickReason}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Ou descreva o motivo..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              ) : (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">
                        Confirmar cancelamento?
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        O item será removido da conta. Esta ação não pode ser desfeita.
                      </p>
                      <p className="text-sm mt-2">
                        <span className="font-medium">Motivo:</span> {reason}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Voltar</AlertDialogCancel>
          {step === "reason" ? (
            <Button
              onClick={handleNext}
              disabled={!reason.trim()}
              variant="destructive"
            >
              Continuar
            </Button>
          ) : (
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
