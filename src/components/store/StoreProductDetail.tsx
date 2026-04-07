import { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Minus, MessageSquare, AlertCircle, Pizza, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CartItem } from '@/pages/store/StorePage';
import { StoreData } from '@/hooks/usePublicStore';

export interface StoreProductDetailProps {
  product: StoreData['products'][0];
  store: StoreData;
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
  pizzaConfig?: { maxFlavors: number; flavorOptions: Array<{ count: number; label: string; description: string }> };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function calculateGroupPrice(
  selections: Record<string, number>,
  options: Array<{ id: string; price: number }>,
  priceCalcType: string | null
): number {
  const selected = Object.entries(selections)
    .map(([optionId, qty]) => {
      const opt = options.find(o => o.id === optionId);
      return opt ? { price: opt.price, quantity: qty } : null;
    })
    .filter(Boolean) as Array<{ price: number; quantity: number }>;

  if (selected.length === 0) return 0;

  const prices = selected.map(s => s.price);

  switch (priceCalcType) {
    case 'average':
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    case 'highest':
      return Math.max(...prices);
    case 'lowest':
      return Math.min(...prices);
    case 'sum':
    default:
      return selected.reduce((total, s) => total + s.price * s.quantity, 0);
  }
}

export function StoreProductDetail({ product, store, open, onClose, onAddToCart, pizzaConfig }: StoreProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [selectedComplements, setSelectedComplements] = useState<Record<string, Record<string, number>>>({});
  const [selectedFlavorCount, setSelectedFlavorCount] = useState<number | undefined>(undefined);
  const [complementSearch, setComplementSearch] = useState<Record<string, string>>({});

  // Reset state when product changes
  useEffect(() => {
    setQuantity(1);
    setNotes('');
    setShowNotes(false);
    setSelectedVariation(null);
    setSelectedComplements({});
    setSelectedFlavorCount(undefined);
    setComplementSearch({});
  }, [product.id]);

  // Check if this product has per-unit groups (pizza)
  const hasPerUnitGroups = useMemo(() => {
    return store.productGroups
      .filter(pg => pg.product_id === product.id)
      .some(pg => {
        const group = store.complementGroups.find(g => g.id === pg.group_id);
        return group?.applies_per_unit;
      });
  }, [product.id, store]);

  const showFlavorSelector = !!pizzaConfig && pizzaConfig.flavorOptions.length > 0 && hasPerUnitGroups;

  // Get variations for this product
  const variations = store.variations.filter(v => v.product_id === product.id);

  // Get complement groups for this product, respecting channels & visibility
  const productGroupLinks = store.productGroups
    .filter(pg => pg.product_id === product.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const groups = productGroupLinks
    .map(link => {
      const group = store.complementGroups.find(g => g.id === link.group_id);
      return group ? { ...group, _skipFlavorModal: (link as any).skip_flavor_modal } : null;
    })
    .filter(Boolean)
    .filter(g => {
      if (!g) return false;
      if (g.visibility === 'hidden') return false;
      if (g.channels && g.channels.length > 0 && !g.channels.includes('delivery')) return false;
      // Hide per-unit groups until flavor count is selected
      if (g.applies_per_unit && showFlavorSelector && selectedFlavorCount === undefined) return false;
      // Filter by applicable_flavor_counts when a flavor count is selected
      if (selectedFlavorCount && g.applicable_flavor_counts && g.applicable_flavor_counts.length > 0) {
        if (!g.applicable_flavor_counts.includes(selectedFlavorCount)) return false;
      }
      return true;
    }) as Array<StoreData['complementGroups'][0] & { _skipFlavorModal?: boolean }>;

  const getGroupOptions = (groupId: string) => {
    const links = store.groupOptions
      .filter(go => go.group_id === groupId)
      .sort((a, b) => a.sort_order - b.sort_order);
    return links.map(link => {
      const option = store.complementOptions.find(o => o.id === link.option_id);
      if (!option) return null;
      return {
        ...option,
        price: link.price_override ?? option.price,
        max_quantity: link.max_quantity || 1,
      };
    }).filter(Boolean) as Array<{
      id: string; name: string; description: string | null;
      price: number; max_quantity: number; image_url: string | null;
    }>;
  };

  const updateComplementQuantity = (groupId: string, optionId: string, delta: number, group: any) => {
    setSelectedComplements(prev => {
      const groupSelections = { ...(prev[groupId] || {}) };
      const currentQty = groupSelections[optionId] || 0;
      const newQty = currentQty + delta;
      const options = getGroupOptions(groupId);
      const opt = options.find(o => o.id === optionId);
      const maxQty = opt?.max_quantity || 1;

      if (newQty <= 0) {
        delete groupSelections[optionId];
      } else if (newQty <= maxQty) {
        // Check max_selections for group
        const totalSelected = Object.entries(groupSelections)
          .filter(([id]) => id !== optionId)
          .reduce((sum, [, q]) => sum + q, 0) + newQty;
        if (group.max_selections && totalSelected > group.max_selections) return prev;
        groupSelections[optionId] = newQty;
      } else {
        return prev;
      }

      return { ...prev, [groupId]: groupSelections };
    });
  };

  const toggleComplement = (groupId: string, optionId: string, group: any) => {
    setSelectedComplements(prev => {
      const groupSelections = { ...(prev[groupId] || {}) };

      if (group.selection_type === 'single') {
        if (groupSelections[optionId]) {
          if (!group.is_required) delete groupSelections[optionId];
          return { ...prev, [groupId]: groupSelections };
        }
        return { ...prev, [groupId]: { [optionId]: 1 } };
      }

      // Multiple
      if (groupSelections[optionId]) {
        delete groupSelections[optionId];
      } else {
        const currentCount = Object.values(groupSelections).reduce((s, q) => s + q, 0);
        if (group.max_selections && currentCount >= group.max_selections) return prev;
        groupSelections[optionId] = 1;
      }

      return { ...prev, [groupId]: groupSelections };
    });
  };

  const basePrice = product.is_promotion && product.promotion_price
    ? product.promotion_price
    : product.price;

  const variationModifier = selectedVariation
    ? variations.find(v => v.id === selectedVariation)?.price_modifier || 0
    : 0;

  const complementsTotal = useMemo(() => {
    let total = 0;
    for (const [groupId, selections] of Object.entries(selectedComplements)) {
      const group = groups.find(g => g.id === groupId);
      const options = getGroupOptions(groupId);
      total += calculateGroupPrice(selections, options, group?.price_calculation_type || 'sum');
    }
    return total;
  }, [selectedComplements, groups]);

  const unitPrice = basePrice + variationModifier + complementsTotal;
  const totalPrice = unitPrice * quantity;

  // Validate required groups
  const validation = useMemo(() => {
    const errors: string[] = [];
    for (const group of groups) {
      if (!group) continue;
      if (group.is_required) {
        const selections = selectedComplements[group.id] || {};
        const count = Object.values(selections).reduce((s, q) => s + q, 0);
        const minSel = group.min_selections || 1;
        if (count < minSel) {
          errors.push(`Selecione ${minSel} opção(ões) em "${group.name}"`);
        }
      }
    }
    if (variations.length > 0 && !selectedVariation) {
      errors.push('Selecione um tamanho');
    }
    if (showFlavorSelector && selectedFlavorCount === undefined) {
      errors.push('Selecione o tipo de pizza');
    }
    return { valid: errors.length === 0, errors };
  }, [groups, selectedComplements, variations, selectedVariation]);

  const handleAdd = () => {
    const complements: CartItem['complements'] = [];
    for (const [groupId, selections] of Object.entries(selectedComplements)) {
      const group = store.complementGroups.find(g => g.id === groupId);
      for (const [optionId, qty] of Object.entries(selections)) {
        const option = store.complementOptions.find(o => o.id === optionId);
        if (option) {
          const link = store.groupOptions.find(go => go.group_id === groupId && go.option_id === optionId);
          complements.push({
            option_id: optionId,
            option_name: option.name,
            group_name: group?.name || '',
            price: link?.price_override ?? option.price,
            quantity: qty,
            kds_category: group?.kds_category,
          });
        }
      }
    }

    const variation = selectedVariation ? variations.find(v => v.id === selectedVariation) : null;

    onAddToCart({
      id: `${product.id}-${Date.now()}`,
      product_id: product.id,
      product_name: product.name + (variation ? ` (${variation.name})` : ''),
      variation_id: selectedVariation,
      variation_name: variation?.name,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      notes: notes || undefined,
      image_url: product.image_url,
      complements: complements.length > 0 ? complements : undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl p-0 overflow-hidden flex flex-col">
        {/* Product image */}
        <div className="relative flex-shrink-0">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-52 sm:h-64 object-cover" />
          ) : (
            <div className="w-full h-40 bg-gradient-to-br from-amber-100 to-orange-50 flex items-center justify-center text-6xl">
              🍕
            </div>
          )}
          {product.is_promotion && (
            <Badge className="absolute top-3 left-3 bg-red-500 text-white border-none text-xs font-bold px-2.5 py-1">
              PROMOÇÃO
            </Badge>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-5">
            {/* Title + Price */}
            <SheetHeader className="text-left p-0">
              <SheetTitle className="text-xl font-bold">{product.name}</SheetTitle>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{product.description}</p>
              )}
              <div className="flex items-baseline gap-2 mt-2">
                {product.is_promotion && product.promotion_price ? (
                  <>
                    <span className="text-xl font-bold text-amber-600">{formatCurrency(product.promotion_price)}</span>
                    <span className="text-sm text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                  </>
                ) : product.price > 0 ? (
                  <span className="text-xl font-bold text-foreground">{formatCurrency(product.price)}</span>
                ) : null}
              </div>
            </SheetHeader>

            {/* Variations */}
            {variations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Tamanho</Label>
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">Obrigatório</Badge>
                </div>
                <RadioGroup value={selectedVariation || ''} onValueChange={setSelectedVariation} className="space-y-1.5">
                  {variations.map(v => (
                    <label
                      key={v.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedVariation === v.id
                          ? 'border-amber-500 bg-amber-50/50'
                          : 'border-border hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={v.id} className="border-amber-400 text-amber-600" />
                        <div>
                          <span className="text-sm font-medium">{v.name}</span>
                          {v.description && (
                            <p className="text-xs text-muted-foreground">{v.description}</p>
                          )}
                        </div>
                      </div>
                      {v.price_modifier !== 0 && (
                        <span className="text-sm font-semibold text-muted-foreground">
                          {v.price_modifier > 0 ? '+' : ''}{formatCurrency(v.price_modifier)}
                        </span>
                      )}
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Inline Flavor Count Selector */}
            {showFlavorSelector && pizzaConfig && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Pizza className="h-5 w-5 text-amber-500" />
                  <Label className="text-sm font-bold">Tipo de Pizza</Label>
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">Obrigatório</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {pizzaConfig.flavorOptions.map((opt) => (
                    <Card
                      key={opt.count}
                      className={cn(
                        "cursor-pointer transition-all",
                        selectedFlavorCount === opt.count
                          ? "border-amber-500 bg-amber-50/50 shadow-md"
                          : "hover:border-amber-300"
                      )}
                      onClick={() => {
                        if (selectedFlavorCount !== opt.count) {
                          // Reset per-unit complement selections
                          setSelectedComplements(prev => {
                            const next = { ...prev };
                            for (const g of store.complementGroups) {
                              if (g.applies_per_unit) delete next[g.id];
                            }
                            return next;
                          });
                          setSelectedFlavorCount(opt.count);
                        }
                      }}
                    >
                      <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                        <Pizza className={cn("h-8 w-8", selectedFlavorCount === opt.count ? "text-amber-500" : "text-muted-foreground")} />
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

            {/* Complement Groups */}
            {groups.map(group => {
              if (!group) return null;
              const options = getGroupOptions(group.id);
              if (options.length === 0) return null;
              const selections = selectedComplements[group.id] || {};
              const selCount = Object.values(selections).reduce((s, q) => s + q, 0);
              const isMultipleWithRepetition = group.selection_type === 'multiple_with_repetition';

              return (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-bold">{group.name}</Label>
                      {group.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {group.is_required 
                          ? `Escolha ${group.min_selections || 1}${group.max_selections && group.max_selections !== (group.min_selections || 1) ? ` a ${group.max_selections}` : ''} opção(ões)`
                          : `Até ${group.max_selections || '∞'} opção(ões)`
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          group.is_required && selCount < (group.min_selections || 1)
                            ? 'border-amber-400 text-amber-700 bg-amber-50'
                            : selCount > 0
                            ? 'border-green-400 text-green-700 bg-green-50'
                            : 'border-border'
                        }`}
                      >
                        {selCount}/{group.max_selections || '∞'}
                      </Badge>
                      {group.is_required && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">Obrigatório</Badge>
                      )}
                    </div>
                  </div>

                  {options.length > 8 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar opção..."
                        value={complementSearch[group.id] || ''}
                        onChange={(e) => setComplementSearch(prev => ({ ...prev, [group.id]: e.target.value }))}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {(() => {
                      const searchTerm = complementSearch[group.id] || '';
                      const filteredOptions = searchTerm
                        ? options.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        : options;
                      return filteredOptions;
                    })().map(option => {
                      const isSelected = !!selections[option.id];
                      const optionQty = selections[option.id] || 0;

                      return (
                        <div
                          key={option.id}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                            isSelected ? 'border-amber-400 bg-amber-50/50' : 'border-border hover:border-amber-200'
                          }`}
                        >
                          <button
                            onClick={() => {
                              if (!isMultipleWithRepetition) {
                                toggleComplement(group.id, option.id, group);
                              } else if (!isSelected) {
                                updateComplementQuantity(group.id, option.id, 1, group);
                              }
                            }}
                            className="flex items-center gap-3 flex-1 text-left"
                          >
                            {option.image_url && (
                              <img src={option.image_url} alt={option.name} className="w-10 h-10 rounded-lg object-cover" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium block">{option.name}</span>
                              {option.description && (
                                <span className="text-xs text-muted-foreground block truncate">{option.description}</span>
                              )}
                            </div>
                          </button>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {option.price > 0 && (
                              <span className="text-xs text-muted-foreground">+{formatCurrency(option.price)}</span>
                            )}
                            {isMultipleWithRepetition && isSelected ? (
                              <div className="flex items-center border border-border rounded-lg">
                                <button
                                  onClick={() => updateComplementQuantity(group.id, option.id, -1, group)}
                                  className="h-7 w-7 flex items-center justify-center hover:bg-muted rounded-l-lg"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-6 text-center text-xs font-semibold">{optionQty}</span>
                                <button
                                  onClick={() => updateComplementQuantity(group.id, option.id, 1, group)}
                                  className="h-7 w-7 flex items-center justify-center hover:bg-muted rounded-r-lg"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  if (!isMultipleWithRepetition) toggleComplement(group.id, option.id, group);
                                  else updateComplementQuantity(group.id, option.id, 1, group);
                                }}
                                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                                  isSelected ? 'border-amber-500 bg-amber-500' : 'border-muted-foreground/30'
                                }`}
                              >
                                {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Notes */}
            <div>
              {!showNotes ? (
                <button
                  onClick={() => setShowNotes(true)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Adicionar observação
                </button>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Observações</Label>
                  <Textarea
                    placeholder="Ex: sem cebola, bem passado..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-sm rounded-xl"
                    rows={2}
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 border-t border-border p-4 bg-card space-y-2">
          {!validation.valid && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{validation.errors[0]}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center border-2 border-border rounded-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="h-11 w-11 rounded-l-xl rounded-r-none"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center font-bold text-base">{quantity}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuantity(q => q + 1)}
                className="h-11 w-11 rounded-r-xl rounded-l-none"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleAdd}
              disabled={!validation.valid}
              className="flex-1 h-12 text-base font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
            >
              Adicionar {formatCurrency(totalPrice)}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
