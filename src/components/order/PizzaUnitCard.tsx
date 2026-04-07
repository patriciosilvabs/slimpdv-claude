import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Pizza } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ComplementOption {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  price_override?: number | null;
}

interface ComplementGroup {
  id: string;
  name: string;
  description?: string | null;
  selection_type: 'single' | 'multiple' | 'multiple_repeat';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  price_calculation_type: 'sum' | 'average' | 'highest' | 'lowest';
  applies_per_unit?: boolean;
  options: ComplementOption[];
}

export interface SubItemSelection {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price: number;
  quantity: number;
  price_calculation_type?: 'sum' | 'average' | 'highest' | 'lowest';
}

export interface SubItemData {
  index: number;
  selections: Record<string, SubItemSelection[]>;
  notes: string;
}

interface PizzaUnitCardProps {
  index: number;
  totalUnits: number;
  groups: ComplementGroup[];
  data: SubItemData;
  onChange: (data: SubItemData) => void;
}

export function PizzaUnitCard({ index, totalUnits, groups, data, onChange }: PizzaUnitCardProps) {
  const updateSelections = (newSelections: Record<string, SubItemSelection[]>) => {
    onChange({ ...data, selections: newSelections });
  };

  const updateNotes = (notes: string) => {
    onChange({ ...data, notes });
  };

  const handleSingleSelect = (group: ComplementGroup, option: ComplementOption) => {
    const price = option.price_override ?? option.price;
    updateSelections({
      ...data.selections,
      [group.id]: [{
        group_id: group.id,
        group_name: group.name,
        option_id: option.id,
        option_name: option.name,
        price,
        quantity: 1,
        price_calculation_type: group.price_calculation_type,
      }],
    });
  };

  const handleMultipleSelect = (group: ComplementGroup, option: ComplementOption, checked: boolean) => {
    const price = option.price_override ?? option.price;
    const current = data.selections[group.id] || [];
    
    if (checked) {
      if (current.length >= group.max_selections) return;
      updateSelections({
        ...data.selections,
        [group.id]: [...current, {
          group_id: group.id,
          group_name: group.name,
          option_id: option.id,
          option_name: option.name,
          price,
          quantity: 1,
          price_calculation_type: group.price_calculation_type,
        }],
      });
    } else {
      updateSelections({
        ...data.selections,
        [group.id]: current.filter(s => s.option_id !== option.id),
      });
    }
  };

  const handleRepeatQuantity = (group: ComplementGroup, option: ComplementOption, delta: number) => {
    const price = option.price_override ?? option.price;
    const current = data.selections[group.id] || [];
    const existing = current.find(s => s.option_id === option.id);
    
    if (existing) {
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        updateSelections({
          ...data.selections,
          [group.id]: current.filter(s => s.option_id !== option.id),
        });
        return;
      }
      const totalOthers = current.filter(s => s.option_id !== option.id).reduce((sum, s) => sum + s.quantity, 0);
      if (totalOthers + newQty > group.max_selections) return;
      
      updateSelections({
        ...data.selections,
        [group.id]: current.map(s => 
          s.option_id === option.id ? { ...s, quantity: newQty } : s
        ),
      });
    } else if (delta > 0) {
      const totalCurrent = current.reduce((sum, s) => sum + s.quantity, 0);
      if (totalCurrent >= group.max_selections) return;
      
      updateSelections({
        ...data.selections,
        [group.id]: [...current, {
          group_id: group.id,
          group_name: group.name,
          option_id: option.id,
          option_name: option.name,
          price,
          quantity: 1,
          price_calculation_type: group.price_calculation_type,
        }],
      });
    }
  };

  const getSelectionCount = (groupId: string) => {
    const groupSelections = data.selections[groupId] || [];
    return groupSelections.reduce((sum, s) => sum + s.quantity, 0);
  };

  const isOptionSelected = (groupId: string, optionId: string) => {
    return (data.selections[groupId] || []).some(s => s.option_id === optionId);
  };

  const getOptionQuantity = (groupId: string, optionId: string) => {
    return (data.selections[groupId] || []).find(s => s.option_id === optionId)?.quantity || 0;
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <Pizza className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-lg">
          Pizza {index + 1}
          {totalUnits > 1 && <span className="text-muted-foreground font-normal text-sm ml-2">de {totalUnits}</span>}
        </h4>
      </div>

      {/* Groups for this unit */}
      {groups.map(group => (
        <div key={group.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h5 className="font-medium text-sm">{group.name}</h5>
                {group.is_required && (
                  <Badge variant="destructive" className="text-xs py-0">
                    OBRIGATÓRIO
                  </Badge>
                )}
              </div>
              {group.description && (
                <p className="text-xs text-muted-foreground">{group.description}</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {getSelectionCount(group.id)}/{group.max_selections}
            </span>
          </div>

          <div className="space-y-1">
            {group.selection_type === 'single' ? (
              <RadioGroup
                value={data.selections[group.id]?.[0]?.option_id || ''}
                onValueChange={(value) => {
                  const option = group.options.find(o => o.id === value);
                  if (option) handleSingleSelect(group, option);
                }}
              >
                {group.options.map(option => (
                  <div
                    key={option.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors',
                      isOptionSelected(group.id, option.id)
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => handleSingleSelect(group, option)}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={option.id} />
                      {option.image_url && (
                        <img 
                          src={option.image_url} 
                          alt={option.name}
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <span className="text-sm">{option.name}</span>
                    </div>
                    {(option.price_override ?? option.price) > 0 && (
                      <span className="text-xs text-primary font-medium">
                        +{formatCurrency(option.price_override ?? option.price)}
                      </span>
                    )}
                  </div>
                ))}
              </RadioGroup>
            ) : group.selection_type === 'multiple' ? (
              group.options.map(option => (
                <div
                  key={option.id}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors',
                    isOptionSelected(group.id, option.id)
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => handleMultipleSelect(
                    group, 
                    option, 
                    !isOptionSelected(group.id, option.id)
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={isOptionSelected(group.id, option.id)}
                      onCheckedChange={(checked) => 
                        handleMultipleSelect(group, option, !!checked)
                      }
                    />
                    {option.image_url && (
                      <img 
                        src={option.image_url} 
                        alt={option.name}
                        className="w-8 h-8 rounded object-cover"
                      />
                    )}
                    <span className="text-sm">{option.name}</span>
                  </div>
                  {(option.price_override ?? option.price) > 0 && (
                    <span className="text-xs text-primary font-medium">
                      +{formatCurrency(option.price_override ?? option.price)}
                    </span>
                  )}
                </div>
              ))
            ) : (
              // multiple_repeat
              group.options.map(option => {
                const qty = getOptionQuantity(group.id, option.id);
                return (
                  <div
                    key={option.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-md border transition-colors',
                      qty > 0 ? 'border-primary bg-primary/5' : ''
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {option.image_url && (
                        <img 
                          src={option.image_url} 
                          alt={option.name}
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <div>
                        <span className="text-sm">{option.name}</span>
                        {(option.price_override ?? option.price) > 0 && (
                          <span className="text-xs text-primary font-medium ml-2">
                            +{formatCurrency(option.price_override ?? option.price)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() => handleRepeatQuantity(group, option, -1)}
                        disabled={qty === 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm font-medium">{qty}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() => handleRepeatQuantity(group, option, 1)}
                        disabled={getSelectionCount(group.id) >= group.max_selections}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}

      {/* Notes for this pizza */}
      <div className="space-y-1 pt-2">
        <Label className="text-xs">Observações da Pizza {index + 1}</Label>
        <Textarea
          placeholder="Ex: SEM CEBOLA, SEM MOLHO..."
          value={data.notes}
          onChange={(e) => updateNotes(e.target.value.toUpperCase())}
          rows={2}
          className="uppercase text-sm"
        />
      </div>
    </div>
  );
}
