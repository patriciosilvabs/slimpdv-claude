import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, AlertCircle, Pizza } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlavorOption } from '@/hooks/useComplementGroups';
import type { SubItemSelection } from './PizzaUnitCard';
import { useProductComplements, GroupWithOptions } from '@/hooks/useProductComplements';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  promotion_price?: number | null;
  is_promotion?: boolean | null;
  image_url?: string | null;
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
  unit_count?: number;
  kds_category?: 'flavor' | 'border' | 'complement';
}

interface ComplementOption {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  price_override?: number | null;
}

interface LocalGroupWithOptions extends ComplementGroup {
  options: ComplementOption[];
}

export interface SelectedComplement {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price: number;
  quantity: number;
  price_calculation_type?: 'sum' | 'average' | 'highest' | 'lowest';
  kds_category?: 'flavor' | 'border' | 'complement';
}

// Extended interface for sub-items (individual pizzas in a combo)
export interface SubItemComplement {
  sub_item_index: number;
  sub_item_notes: string;
  complements: SelectedComplement[];
}

export interface PizzaConfig {
  flavorOptions: FlavorOption[];
  maxFlavors: number;
}

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onAdd: (
    product: Product, 
    quantity: number, 
    complements: SelectedComplement[], 
    notes: string,
    subItems?: SubItemComplement[]
  ) => void;
  duplicateItems?: boolean;
  duplicateItemsMaxQty?: number;
  channel?: 'counter' | 'delivery' | 'table';
  pizzaConfig?: PizzaConfig;
}

export function ProductDetailDialog({ open, onOpenChange, product, onAdd, duplicateItems, duplicateItemsMaxQty = 0, channel, pizzaConfig }: ProductDetailDialogProps) {
  const [selections, setSelections] = useState<Record<string, SelectedComplement[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  
  // Per-unit notes (single field for all flavors)
  const [perUnitNotes, setPerUnitNotes] = useState('');
  // Internal flavor count state (replaces old overrideUnitCount prop)
  const [selectedFlavorCount, setSelectedFlavorCount] = useState<number | undefined>(undefined);
  // Usar o novo hook otimizado com React Query (cache + consultas paralelas)
  const { data: groups = [], isLoading: loading } = useProductComplements(
    open ? product?.id : undefined,
    channel
  );

  // Converter para o formato local com sort_order
  const localGroups: LocalGroupWithOptions[] = useMemo(() => {
    return groups.map((g, index) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      selection_type: g.selection_type as 'single' | 'multiple' | 'multiple_repeat',
      is_required: g.is_required,
      min_selections: g.min_selections,
      max_selections: g.max_selections,
      sort_order: index,
      price_calculation_type: g.price_calculation_type as 'sum' | 'average' | 'highest' | 'lowest',
      applies_per_unit: g.applies_per_unit,
      unit_count: g.unit_count,
      kds_category: g.kds_category,
      options: g.options.map(opt => ({
        id: opt.id,
        name: opt.name,
        description: opt.description,
        price: opt.price,
        image_url: opt.image_url,
        price_override: opt.price_override,
      })),
    }));
  }, [groups]);

  // Determine if this product has per-unit groups
  const hasPerUnitGroups = useMemo(() => {
    return localGroups.some(g => g.applies_per_unit === true);
  }, [localGroups]);

  // Get the number of units - use internal flavor count selection
  const unitCount = useMemo(() => {
    if (selectedFlavorCount !== undefined) return selectedFlavorCount;
    const perUnitGroup = localGroups.find(g => g.applies_per_unit === true);
    return perUnitGroup?.unit_count ?? 1;
  }, [localGroups, selectedFlavorCount]);

  // Flavor options for the inline selector
  const flavorOptions = useMemo(() => {
    if (!pizzaConfig || !hasPerUnitGroups) return [];
    return pizzaConfig.flavorOptions;
  }, [pizzaConfig, hasPerUnitGroups]);

  const showFlavorSelector = flavorOptions.length > 0;

  // All visible groups in original sort order, filtering per-unit by applicable_flavor_counts
  const visibleGroups = useMemo(() => {
    return localGroups.filter(g => {
      if (!g.applies_per_unit) return true;
      // If flavor selector is shown and no count selected yet, hide per-unit groups
      if (showFlavorSelector && selectedFlavorCount === undefined) return false;
      const group = groups.find(og => og.id === g.id);
      if (group?.applicable_flavor_counts && group.applicable_flavor_counts.length > 0 && unitCount > 0) {
        return group.applicable_flavor_counts.includes(unitCount);
      }
      return true;
    });
  }, [localGroups, groups, unitCount, showFlavorSelector, selectedFlavorCount]);

  // Groups that apply per unit (for validation/price)
  const perUnitGroups = useMemo(() => {
    return visibleGroups.filter(g => g.applies_per_unit === true);
  }, [visibleGroups]);

  // Groups that apply to the whole item (for validation/price)
  const sharedGroups = useMemo(() => {
    return visibleGroups.filter(g => !g.applies_per_unit);
  }, [visibleGroups]);

  // Reset state when product changes
  useEffect(() => {
    if (open && product) {
      setSelections({});
      setQuantity(1);
      setNotes('');
      setPerUnitNotes('');
      setSelectedFlavorCount(undefined);
    }
  }, [product?.id, open]);

  const handleSingleSelect = (group: LocalGroupWithOptions, option: ComplementOption) => {
    const price = option.price_override ?? option.price;
    setSelections(prev => ({
      ...prev,
      [group.id]: [{
        group_id: group.id,
        group_name: group.name,
        option_id: option.id,
        option_name: option.name,
        price,
        quantity: 1,
        price_calculation_type: group.price_calculation_type,
        kds_category: group.kds_category,
      }],
    }));
  };

  const handleMultipleSelect = (group: LocalGroupWithOptions, option: ComplementOption, checked: boolean) => {
    const price = option.price_override ?? option.price;
    setSelections(prev => {
      const current = prev[group.id] || [];
      if (checked) {
        if (current.length >= group.max_selections) return prev;
        return {
          ...prev,
          [group.id]: [...current, {
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price,
            quantity: 1,
            price_calculation_type: group.price_calculation_type as 'sum' | 'average' | 'highest' | 'lowest',
            kds_category: group.kds_category,
          }],
        };
      } else {
        return {
          ...prev,
          [group.id]: current.filter(s => s.option_id !== option.id),
        };
      }
    });
  };

  const handleRepeatQuantity = (group: LocalGroupWithOptions, option: ComplementOption, delta: number) => {
    const price = option.price_override ?? option.price;
    setSelections(prev => {
      const current = prev[group.id] || [];
      const existing = current.find(s => s.option_id === option.id);
      
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          return {
            ...prev,
            [group.id]: current.filter(s => s.option_id !== option.id),
          };
        }
        const totalOthers = current.filter(s => s.option_id !== option.id).reduce((sum, s) => sum + s.quantity, 0);
        if (totalOthers + newQty > group.max_selections) return prev;
        
        return {
          ...prev,
          [group.id]: current.map(s => 
            s.option_id === option.id ? { ...s, quantity: newQty } : s
          ),
        };
      } else if (delta > 0) {
        const totalCurrent = current.reduce((sum, s) => sum + s.quantity, 0);
        if (totalCurrent >= group.max_selections) return prev;
        
        return {
          ...prev,
          [group.id]: [...current, {
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price,
            quantity: 1,
            price_calculation_type: group.price_calculation_type as 'sum' | 'average' | 'highest' | 'lowest',
            kds_category: group.kds_category,
          }],
        };
      }
      return prev;
    });
  };

  // For per-unit groups, handle selection with unitCount as max
  const handlePerUnitSelect = (group: LocalGroupWithOptions, option: ComplementOption, checked: boolean) => {
    const price = option.price_override ?? option.price;
    setSelections(prev => {
      const current = prev[group.id] || [];
      if (checked) {
        if (current.length >= unitCount) return prev;
        return {
          ...prev,
          [group.id]: [...current, {
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price,
            quantity: 1,
            price_calculation_type: group.price_calculation_type,
            kds_category: group.kds_category,
          }],
        };
      } else {
        return {
          ...prev,
          [group.id]: current.filter(s => s.option_id !== option.id),
        };
      }
    });
  };

  const getSelectionCount = (groupId: string) => {
    const groupSelections = selections[groupId] || [];
    return groupSelections.reduce((sum, s) => sum + s.quantity, 0);
  };

  const isOptionSelected = (groupId: string, optionId: string) => {
    return (selections[groupId] || []).some(s => s.option_id === optionId);
  };

  const getOptionQuantity = (groupId: string, optionId: string) => {
    return (selections[groupId] || []).find(s => s.option_id === optionId)?.quantity || 0;
  };

  const calculateGroupPrice = (groupId: string, priceType: 'sum' | 'average' | 'highest' | 'lowest'): number => {
    const groupSelections = selections[groupId] || [];
    if (groupSelections.length === 0) return 0;

    switch (priceType) {
      case 'sum':
        return groupSelections.reduce((total, s) => total + (s.price * s.quantity), 0);
      case 'average': {
        const totalQty = groupSelections.reduce((sum, s) => sum + s.quantity, 0);
        const totalPrice = groupSelections.reduce((sum, s) => sum + (s.price * s.quantity), 0);
        return totalQty > 0 ? totalPrice / totalQty : 0;
      }
      case 'highest':
        return Math.max(...groupSelections.map(s => s.price));
      case 'lowest':
        return Math.min(...groupSelections.map(s => s.price));
      default:
        return groupSelections.reduce((total, s) => total + (s.price * s.quantity), 0);
    }
  };

  // Calculate price for per-unit groups using the configured price_calculation_type
  const calculatePerUnitPrice = (): number => {
    let total = 0;
    for (const group of perUnitGroups) {
      total += calculateGroupPrice(group.id, group.price_calculation_type);
    }
    return total;
  };

  const complementsTotal = useMemo(() => {
    const sharedPrice = sharedGroups.reduce((total, group) => {
      return total + calculateGroupPrice(group.id, group.price_calculation_type);
    }, 0);
    
    const perUnitPrice = calculatePerUnitPrice();
    
    return sharedPrice + perUnitPrice;
  }, [selections, groups, sharedGroups, perUnitGroups]);

  const productPrice = product?.is_promotion && product?.promotion_price 
    ? product.promotion_price 
    : product?.price ?? 0;

  const totalPrice = (productPrice + complementsTotal) * quantity;

  // Validate shared groups
  const invalidSharedGroups = sharedGroups.filter(group => {
    const count = getSelectionCount(group.id);
    return group.is_required && count < group.min_selections;
  });

  // Validate per-unit groups using group's own rules (same as shared)
  const invalidPerUnitGroups = useMemo(() => {
    if (!hasPerUnitGroups) return [];
    return perUnitGroups.filter(group => {
      if (!group.is_required) return false;
      const count = getSelectionCount(group.id);
      // For per-unit groups, the required count equals the selected flavor count (unitCount)
      const minRequired = unitCount;
      return count < minRequired;
    });
  }, [selections, perUnitGroups, hasPerUnitGroups, unitCount]);

  // Require flavor count selection if flavor selector is shown
  const flavorNotSelected = showFlavorSelector && selectedFlavorCount === undefined;
  const canAdd = invalidSharedGroups.length === 0 && invalidPerUnitGroups.length === 0 && !flavorNotSelected;

  const handleAdd = () => {
    if (!product || !canAdd) return;
    
    // Only shared group complements (exclude per-unit groups)
    const perUnitGroupIds = new Set(perUnitGroups.map(g => g.id));
    const sharedComplements = Object.entries(selections)
      .filter(([groupId]) => !perUnitGroupIds.has(groupId))
      .flatMap(([, sels]) => sels);
    
    // Build sub-items from unified selections: each selected flavor becomes a sub_item
    let subItemsData: SubItemComplement[] | undefined;
    if (hasPerUnitGroups) {
      const allPerUnitSelections = perUnitGroups.flatMap(g => selections[g.id] || []);
      if (allPerUnitSelections.length > 0) {
        subItemsData = allPerUnitSelections.map((sel, index) => ({
          sub_item_index: index + 1,
          sub_item_notes: '',
          complements: [{
            group_id: sel.group_id,
            group_name: sel.group_name,
            option_id: sel.option_id,
            option_name: sel.option_name,
            price: sel.price,
            quantity: sel.quantity,
            price_calculation_type: sel.price_calculation_type,
            kds_category: sel.kds_category,
          }],
        }));
      }
    }
    
    onAdd(product, quantity, sharedComplements, hasPerUnitGroups ? perUnitNotes : notes, subItemsData);
    onOpenChange(false);
  };

  if (!product) return null;

  // Helper to render option list for any group
  const renderGroupOptions = (group: LocalGroupWithOptions, isPerUnit: boolean) => {
    const effectiveMax = group.selection_type === 'single' ? 1 : group.max_selections;

    if (group.selection_type === 'single') {
      return (
        <RadioGroup
          value={selections[group.id]?.[0]?.option_id || ''}
          onValueChange={(value) => {
            const option = group.options.find(o => o.id === value);
            if (option) handleSingleSelect(group, option);
          }}
        >
          {group.options.map(option => (
            <div
              key={option.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                isOptionSelected(group.id, option.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              )}
              onClick={() => handleSingleSelect(group, option)}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={option.id} />
                {option.image_url && (
                  <img src={option.image_url} alt={option.name} className="w-10 h-10 rounded object-cover" />
                )}
                <div>
                  <p className="font-medium text-sm">{option.name}</p>
                  {option.description && (
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  )}
                </div>
              </div>
              {(option.price_override ?? option.price) > 0 && (
                <span className="text-sm text-primary font-medium">
                  +{formatCurrency(option.price_override ?? option.price)}
                </span>
              )}
            </div>
          ))}
        </RadioGroup>
      );
    }

    if (group.selection_type === 'multiple') {
      return group.options.map(option => (
        <div
          key={option.id}
          className={cn(
            'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
            isOptionSelected(group.id, option.id)
              ? 'border-primary bg-primary/5'
              : 'hover:bg-muted/50'
          )}
          onClick={() => isPerUnit
            ? handlePerUnitSelect(group, option, !isOptionSelected(group.id, option.id))
            : handleMultipleSelect(group, option, !isOptionSelected(group.id, option.id))
          }
        >
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isOptionSelected(group.id, option.id)}
              onCheckedChange={(checked) =>
                isPerUnit
                  ? handlePerUnitSelect(group, option, !!checked)
                  : handleMultipleSelect(group, option, !!checked)
              }
            />
            {option.image_url && (
              <img src={option.image_url} alt={option.name} className="w-10 h-10 rounded object-cover" />
            )}
            <div>
              <p className="font-medium text-sm">{option.name}</p>
              {option.description && (
                <p className="text-xs text-muted-foreground">{option.description}</p>
              )}
            </div>
          </div>
          {(option.price_override ?? option.price) > 0 && (
            <span className="text-sm text-primary font-medium">
              +{formatCurrency(option.price_override ?? option.price)}
            </span>
          )}
        </div>
      ));
    }

    // multiple_repeat
    return group.options.map(option => {
      const qty = getOptionQuantity(group.id, option.id);
      return (
        <div
          key={option.id}
          className={cn(
            'flex items-center justify-between p-3 rounded-lg border transition-colors',
            qty > 0 ? 'border-primary bg-primary/5' : ''
          )}
        >
          <div className="flex items-center gap-3">
            {option.image_url && (
              <img src={option.image_url} alt={option.name} className="w-10 h-10 rounded object-cover" />
            )}
            <div>
              <p className="font-medium text-sm">{option.name}</p>
              {option.description && (
                <p className="text-xs text-muted-foreground">{option.description}</p>
              )}
              {(option.price_override ?? option.price) > 0 && (
                <span className="text-xs text-primary font-medium">
                  +{formatCurrency(option.price_override ?? option.price)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8"
              onClick={() => handleRepeatQuantity(group, option, -1)}
              disabled={qty === 0}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-6 text-center font-medium">{qty}</span>
            <Button size="icon" variant="outline" className="h-8 w-8"
              onClick={() => handleRepeatQuantity(group, option, 1)}
              disabled={getSelectionCount(group.id) >= effectiveMax}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header with image */}
        <div className="relative">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="w-full h-32 bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">Sem imagem</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-4">
            <h2 className="text-xl font-bold">{product.name}</h2>
            <div className="flex items-center gap-2">
              {product.is_promotion && product.promotion_price ? (
                <>
                  <span className="text-muted-foreground line-through text-sm">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-primary font-bold text-lg">
                    {formatCurrency(product.promotion_price)}
                  </span>
                </>
              ) : (
                <span className="text-primary font-bold text-lg">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          <div className="space-y-4 py-4">
            {product.description && (
              <p className="text-sm text-muted-foreground">{product.description}</p>
            )}

            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Carregando opções...
              </div>
            ) : groups.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm">
                Este produto não possui complementos
              </div>
            ) : (
              <>
                {/* Inline flavor count selector */}
                {showFlavorSelector && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Pizza className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Tipo de Pizza</h3>
                      <Badge variant="destructive" className="text-xs">OBRIGATÓRIO</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {flavorOptions.map((opt) => (
                        <Card
                          key={opt.count}
                          className={cn(
                            "cursor-pointer transition-all",
                            selectedFlavorCount === opt.count
                              ? "border-primary bg-primary/5 shadow-md"
                              : "hover:border-primary/50"
                          )}
                          onClick={() => {
                            if (selectedFlavorCount !== opt.count) {
                              // Reset per-unit selections when changing flavor count
                              setSelections(prev => {
                                const next = { ...prev };
                                for (const g of localGroups) {
                                  if (g.applies_per_unit) delete next[g.id];
                                }
                                return next;
                              });
                              setSelectedFlavorCount(opt.count);
                            }
                          }}
                        >
                          <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                            <div className="relative">
                              <Pizza className={cn("h-8 w-8", selectedFlavorCount === opt.count ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-sm">{opt.label}</p>
                              {opt.description && (
                                <p className="text-xs text-muted-foreground">{opt.description}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* All groups in their configured sort order */}
                {visibleGroups.map((group, groupIndex) => {
                  const isPerUnit = group.applies_per_unit === true;
                  const effectiveMax = group.selection_type === 'single' ? 1 : group.max_selections;
                  // Show per-unit notes after the last per-unit group
                  const showPerUnitNotes = isPerUnit && !visibleGroups.slice(groupIndex + 1).some(g => g.applies_per_unit);

                  return (
                    <div key={group.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{group.name}</h3>
                            {group.is_required && (
                              <Badge variant="destructive" className="text-xs">
                                OBRIGATÓRIO
                              </Badge>
                            )}
                          </div>
                          {isPerUnit ? (
                            <p className="text-xs text-muted-foreground">
                              {group.selection_type === 'single' 
                                ? 'Escolha 1 opção' 
                                : `Escolha até ${effectiveMax} opções`}
                            </p>
                          ) : group.description ? (
                            <p className="text-xs text-muted-foreground">{group.description}</p>
                          ) : null}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {getSelectionCount(group.id)}/{effectiveMax}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {renderGroupOptions(group, isPerUnit)}
                      </div>

                      {/* Notes field after the last per-unit group */}
                      {showPerUnitNotes && (
                        <div className="space-y-1 pt-1">
                          <Label className="text-xs">Observações</Label>
                          <Textarea
                            placeholder="Ex: SEM CEBOLA, SEM MOLHO..."
                            value={perUnitNotes}
                            onChange={(e) => setPerUnitNotes(e.target.value.toUpperCase())}
                            rows={2}
                            className="uppercase text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Notes - general observations */}
            {!hasPerUnitGroups && (
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Ex: SEM CEBOLA, BEM PASSADO..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.toUpperCase())}
                  rows={2}
                  className="uppercase"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 space-y-3">
          {(invalidSharedGroups.length > 0 || invalidPerUnitGroups.length > 0) && (
            <div className="flex items-start gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Selecione: {[...invalidSharedGroups, ...invalidPerUnitGroups].map(g => g.name).join(', ')}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            {(!duplicateItems || (duplicateItems && duplicateItemsMaxQty > 0)) && (
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-xl font-bold w-8 text-center">{quantity}</span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(q => q + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button 
              size="lg" 
              className={(duplicateItems && duplicateItemsMaxQty === 0) ? "flex-1" : "min-w-[180px]"}
              onClick={handleAdd}
              disabled={!canAdd}
            >
              Adicionar {formatCurrency(totalPrice)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
