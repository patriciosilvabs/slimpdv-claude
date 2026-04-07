import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Package, Loader2 } from 'lucide-react';
import { useIngredients } from '@/hooks/useIngredients';
import { 
  useComplementOptionIngredients, 
  useComplementOptionIngredientMutations 
} from '@/hooks/useComplementOptionIngredients';

interface ComplementOptionIngredientSectionProps {
  optionId: string | null | undefined;
  isEditing: boolean;
}

export function ComplementOptionIngredientSection({ 
  optionId, 
  isEditing 
}: ComplementOptionIngredientSectionProps) {
  const { data: ingredients = [], isLoading: loadingIngredients } = useIngredients();
  const { data: linkedIngredients = [], isLoading: loadingLinked } = useComplementOptionIngredients(optionId);
  const { addIngredient, updateIngredient, removeIngredient } = useComplementOptionIngredientMutations();

  const [selectedIngredient, setSelectedIngredient] = React.useState<string>('');
  const [quantity, setQuantity] = React.useState<string>('1');

  // Ingredientes disponíveis para adicionar (exclui os já vinculados)
  const availableIngredients = React.useMemo(() => {
    const linkedIds = new Set(linkedIngredients.map(li => li.ingredient_id));
    return ingredients.filter(ing => !linkedIds.has(ing.id));
  }, [ingredients, linkedIngredients]);

  const handleAdd = () => {
    if (!optionId || !selectedIngredient || !quantity) return;
    
    addIngredient.mutate({
      complement_option_id: optionId,
      ingredient_id: selectedIngredient,
      quantity: parseFloat(quantity) || 1
    });
    
    setSelectedIngredient('');
    setQuantity('1');
  };

  const handleQuantityChange = (id: string, newQuantity: string) => {
    if (!optionId) return;
    const qty = parseFloat(newQuantity);
    if (isNaN(qty) || qty <= 0) return;
    
    updateIngredient.mutate({
      id,
      quantity: qty,
      complement_option_id: optionId
    });
  };

  const handleRemove = (id: string) => {
    if (!optionId) return;
    removeIngredient.mutate({ id, complement_option_id: optionId });
  };

  if (!isEditing) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Package className="h-12 w-12 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">
          Salve a opção primeiro para vincular ingredientes
        </p>
      </div>
    );
  }

  if (loadingIngredients || loadingLinked) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Ficha Técnica (Insumos)</Label>
        <p className="text-xs text-muted-foreground">
          Informe a quantidade em gramas para a <strong>pizza inteira</strong>. O sistema divide automaticamente pelo número de sabores (ex: 120g → 60g em meio a meio).
        </p>
      </div>

      {/* Lista de ingredientes vinculados */}
      {linkedIngredients.length > 0 ? (
        <div className="space-y-2">
          {linkedIngredients.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
            >
              <span className="flex-1 text-sm font-medium truncate">
                {item.ingredient?.name || 'Ingrediente'}
              </span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="1"
                  min={1}
                  defaultValue={item.quantity}
                  onBlur={(e) => handleQuantityChange(item.id, e.target.value)}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground w-4">
                  g
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleRemove(item.id)}
                disabled={removeIngredient.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          Nenhum ingrediente vinculado
        </div>
      )}

      {/* Formulário para adicionar */}
      {availableIngredients.length > 0 && (
        <div className="flex items-end gap-2 pt-2 border-t">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Ingrediente</Label>
            <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {availableIngredients.map((ing) => (
                  <SelectItem key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Label className="text-xs text-muted-foreground">Quantidade (g)</Label>
            <Input
              type="number"
              step="1"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!selectedIngredient || !quantity || addIngredient.isPending}
            className="h-9"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {availableIngredients.length === 0 && linkedIngredients.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Todos os ingredientes já foram vinculados
        </p>
      )}

      {ingredients.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Cadastre ingredientes em Estoque para vincular aqui
        </p>
      )}
    </div>
  );
}
