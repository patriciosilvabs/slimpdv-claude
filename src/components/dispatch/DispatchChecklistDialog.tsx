import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChecklistItem } from '@/hooks/useDispatchChecklist';
import { PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DispatchChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklist: ChecklistItem[];
  orderLabel?: string;
  onConfirm: () => void;
  isProcessing?: boolean;
}

export function DispatchChecklistDialog({
  open,
  onOpenChange,
  checklist,
  orderLabel,
  onConfirm,
  isProcessing,
}: DispatchChecklistDialogProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Reset when dialog opens
  useEffect(() => {
    if (open) setChecked(new Set());
  }, [open]);

  const allChecked = checked.size === checklist.length;

  const toggle = (keyword: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Conferência de Despacho
          </DialogTitle>
          {orderLabel && (
            <p className="text-sm text-muted-foreground">{orderLabel}</p>
          )}
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Confira todos os itens antes de liberar o pedido:
          </p>
          {checklist.map(item => (
            <label
              key={item.keyword}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                checked.has(item.keyword)
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted/30 border-border hover:bg-muted/50"
              )}
            >
              <Checkbox
                checked={checked.has(item.keyword)}
                onCheckedChange={() => toggle(item.keyword)}
              />
              <span className="flex-1 font-medium capitalize text-sm">
                {item.keyword}
              </span>
              <Badge variant="secondary" className="text-xs">
                x{item.quantity}
              </Badge>
            </label>
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!allChecked || isProcessing}
            className="flex-1"
          >
            <PackageCheck className="h-4 w-4 mr-2" />
            Confirmar Despacho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
