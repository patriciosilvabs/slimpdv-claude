import { useState } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package } from 'lucide-react';
import { ProductionDemandItem } from '@/hooks/useProductionDemand';
import { useProductionShipmentMutations } from '@/hooks/useProductionShipments';

interface ShipmentConfirmDialogProps {
  item: ProductionDemandItem | null;
  onClose: () => void;
}

export function ShipmentConfirmDialog({ item, onClose }: ShipmentConfirmDialogProps) {
  const { createShipment } = useProductionShipmentMutations();
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpen = (open: boolean) => {
    if (!open) {
      onClose();
      setQuantity('');
      setNotes('');
    }
  };

  const handleSubmit = async () => {
    if (!item) return;
    
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;
    
    await createShipment.mutateAsync({
      toTenantId: item.tenant_id,
      ingredientId: item.ingredient_id,
      quantity: qty,
      notes: notes || undefined,
    });
    
    onClose();
    setQuantity('');
    setNotes('');
  };

  // Set default quantity when item changes
  if (item && !quantity) {
    setQuantity(item.to_produce.toString());
  }

  return (
    <Dialog open={!!item} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Confirmar Envio de Produção
          </DialogTitle>
          <DialogDescription>
            Registre o envio de produção para a loja
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loja:</span>
                <span className="font-medium">{item.store_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingrediente:</span>
                <span className="font-medium">{item.ingredient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Demanda:</span>
                <span className="font-medium text-primary">
                  {item.to_produce} {item.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estoque atual:</span>
                <span>{item.current_stock} {item.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Meta:</span>
                <span>{item.ideal_stock} {item.unit}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade a enviar</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="flex-1"
                />
                <span className="text-muted-foreground">{item.unit}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Lote #123, produzido em..."
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createShipment.isPending || !quantity || parseFloat(quantity) <= 0}
          >
            {createShipment.isPending ? 'Enviando...' : 'Confirmar Envio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
