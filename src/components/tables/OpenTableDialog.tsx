import React, { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table } from '@/hooks/useTables';

interface OpenTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: Table | null;
  onConfirm: (data: { people: number; identification: string }) => Promise<void>;
  isPending?: boolean;
}

export const OpenTableDialog = memo(function OpenTableDialog({
  open,
  onOpenChange,
  table,
  onConfirm,
  isPending,
}: OpenTableDialogProps) {
  // Local state for inputs - prevents parent re-renders on every keystroke
  const [people, setPeople] = useState(0);
  const [identification, setIdentification] = useState('');

  // Reset local state when dialog opens with new table
  useEffect(() => {
    if (open && table) {
      setPeople(0);
      setIdentification('');
    }
  }, [open, table?.id]);

  const handleConfirm = async () => {
    await onConfirm({ people, identification });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir Mesa {table?.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Quantidade de Pessoas</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPeople(p => Math.max(0, p - 1))}
              >
                <span className="text-lg">-</span>
              </Button>
              <span className="text-2xl font-bold w-12 text-center">{people}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPeople(p => p + 1)}
              >
                <span className="text-lg">+</span>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Identificação (opcional)</Label>
            <Input
              value={identification}
              onChange={(e) => setIdentification(e.target.value)}
              placeholder="Nome do cliente ou observação"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || people === 0}>
            Abrir Mesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
