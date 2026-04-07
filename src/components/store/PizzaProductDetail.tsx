import { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Minus, MessageSquare, AlertCircle, Pizza, Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CartItem } from '@/pages/store/StorePage';
import { StoreData } from '@/hooks/usePublicStore';

export interface PizzaProductDetailProps {
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
    case 'average': return prices.reduce((a, b) => a + b, 0) / prices.length;
    case 'highest': return Math.max(...prices);
    case 'lowest': return Math.min(...prices);
    case 'sum':
    default: return selected.reduce((total, s) => total + s.price * s.quantity, 0);
  }
}

export function PizzaProductDetail({ product, store, open, onClose, onAddToCart, pizzaConfig }: PizzaProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [selectedComplements, setSelectedComplements] = useState<Record<string, Record<string, number>>>({});
  const [selectedFlavorCount, setSelectedFlavorCount] = useState<number | undefined>(undefined);
  const [complementSearch, setComplementSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    setQuantity(1); setNotes(''); setShowNotes(false); setSelectedVariation(null);
    setSelectedComplements({}); setSelectedFlavorCount(undefined); setComplementSearch({});
  }, [product.id]);

  const hasPerUnitGroups = useMemo(() => {
    return store.productGroups.filter(pg => pg.product_id === product.id)
      .some(pg => { const g = store.complementGroups.find(g => g.id === pg.group_id); return g?.applies_per_unit; });
  }, [product.id, store]);

  const showFlavorSelector = !!pizzaConfig && pizzaConfig.flavorOptions.length > 0 && hasPerUnitGroups;

  const variations = store.variations.filter(v => v.product_id === product.id);

  const productGroupLinks = store.productGroups.filter(pg => pg.product_id === product.id).sort((a, b) => a.sort_order - b.sort_order);

  const groups = productGroupLinks.map(link => {
    const group = store.complementGroups.find(g => g.id === link.group_id);
    return group ? { ...group, _skipFlavorModal: (link as any).skip_flavor_modal } : null;
  }).filter(Boolean).filter(g => {
    if (!g) return false;
    if (g.visibility === 'hidden') return false;
    if (g.channels && g.channels.length > 0 && !g.channels.includes('delivery')) return false;
    if (g.applies_per_unit && showFlavorSelector && selectedFlavorCount === undefined) return false;
    if (selectedFlavorCount && g.applicable_flavor_counts && g.applicable_flavor_counts.length > 0) {
      if (!g.applicable_flavor_counts.includes(selectedFlavorCount)) return false;
    }
    return true;
  }) as Array<StoreData['complementGroups'][0] & { _skipFlavorModal?: boolean }>;

  const getGroupOptions = (groupId: string) => {
    const links = store.groupOptions.filter(go => go.group_id === groupId).sort((a, b) => a.sort_order - b.sort_order);
    return links.map(link => {
      const option = store.complementOptions.find(o => o.id === link.option_id);
      if (!option) return null;
      return { ...option, price: link.price_override ?? option.price, max_quantity: link.max_quantity || 1 };
    }).filter(Boolean) as Array<{ id: string; name: string; description: string | null; price: number; max_quantity: number; image_url: string | null }>;
  };

  const updateComplementQuantity = (groupId: string, optionId: string, delta: number, group: any) => {
    setSelectedComplements(prev => {
      const groupSelections = { ...(prev[groupId] || {}) };
      const currentQty = groupSelections[optionId] || 0;
      const newQty = currentQty + delta;
      const options = getGroupOptions(groupId);
      const opt = options.find(o => o.id === optionId);
      const maxQty = opt?.max_quantity || 1;
      if (newQty <= 0) { delete groupSelections[optionId]; }
      else if (newQty <= maxQty) {
        const totalSelected = Object.entries(groupSelections).filter(([id]) => id !== optionId).reduce((sum, [, q]) => sum + q, 0) + newQty;
        if (group.max_selections && totalSelected > group.max_selections) return prev;
        groupSelections[optionId] = newQty;
      } else { return prev; }
      return { ...prev, [groupId]: groupSelections };
    });
  };

  const toggleComplement = (groupId: string, optionId: string, group: any) => {
    setSelectedComplements(prev => {
      const groupSelections = { ...(prev[groupId] || {}) };
      if (group.selection_type === 'single') {
        if (groupSelections[optionId]) { if (!group.is_required) delete groupSelections[optionId]; return { ...prev, [groupId]: groupSelections }; }
        return { ...prev, [groupId]: { [optionId]: 1 } };
      }
      if (groupSelections[optionId]) { delete groupSelections[optionId]; }
      else {
        const currentCount = Object.values(groupSelections).reduce((s, q) => s + q, 0);
        if (group.max_selections && currentCount >= group.max_selections) return prev;
        groupSelections[optionId] = 1;
      }
      return { ...prev, [groupId]: groupSelections };
    });
  };

  const basePrice = product.is_promotion && product.promotion_price ? product.promotion_price : product.price;
  const variationModifier = selectedVariation ? variations.find(v => v.id === selectedVariation)?.price_modifier || 0 : 0;

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

  const validation = useMemo(() => {
    const errors: string[] = [];
    for (const group of groups) {
      if (!group) continue;
      if (group.is_required) {
        const selections = selectedComplements[group.id] || {};
        const count = Object.values(selections).reduce((s, q) => s + q, 0);
        const minSel = group.min_selections || 1;
        if (count < minSel) errors.push(`Selecione ${minSel} opção(ões) em "${group.name}"`);
      }
    }
    if (variations.length > 0 && !selectedVariation) errors.push('Selecione um tamanho');
    if (showFlavorSelector && selectedFlavorCount === undefined) errors.push('Selecione o tipo de pizza');
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
          complements.push({ option_id: optionId, option_name: option.name, group_name: group?.name || '', price: link?.price_override ?? option.price, quantity: qty, kds_category: group?.kds_category });
        }
      }
    }
    const variation = selectedVariation ? variations.find(v => v.id === selectedVariation) : null;
    onAddToCart({
      id: `${product.id}-${Date.now()}`, product_id: product.id,
      product_name: product.name + (variation ? ` (${variation.name})` : ''),
      variation_id: selectedVariation, variation_name: variation?.name,
      quantity, unit_price: unitPrice, total_price: totalPrice,
      notes: notes || undefined, image_url: product.image_url,
      complements: complements.length > 0 ? complements : undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl p-0 overflow-hidden flex flex-col pizza-store" style={{ background: 'hsl(var(--store-bg))' }}>
        {/* Product image */}
        <div className="relative flex-shrink-0">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-56 object-cover" />
          ) : (
            <div className="w-full h-44 bg-gradient-to-br from-red-100 to-orange-50 flex items-center justify-center text-7xl">🍕</div>
          )}
          {product.is_promotion && (
            <span className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[hsl(var(--store-primary))] text-white shadow-md">
              PROMOÇÃO
            </span>
          )}
          {product.label && (
            <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white shadow-md">
              {product.label}
            </span>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            <SheetHeader className="text-left p-0">
              <SheetTitle className="text-xl font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{product.name}</SheetTitle>
              {product.description && <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'hsl(var(--store-muted))' }}>{product.description}</p>}
              <div className="flex items-baseline gap-2 mt-2">
                {product.is_promotion && product.promotion_price ? (
                  <>
                    <span className="text-2xl font-extrabold text-[hsl(var(--store-primary))]">{formatCurrency(product.promotion_price)}</span>
                    <span className="text-sm line-through" style={{ color: 'hsl(var(--store-muted))' }}>{formatCurrency(product.price)}</span>
                  </>
                ) : product.price > 0 ? (
                  <span className="text-2xl font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{formatCurrency(product.price)}</span>
                ) : null}
              </div>
            </SheetHeader>

            {/* Variations */}
            {variations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Tamanho</label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--store-primary-light))] text-[hsl(var(--store-primary))]">Obrigatório</span>
                </div>
                <div className="space-y-2">
                  {variations.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariation(v.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left",
                        selectedVariation === v.id
                          ? "border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary-light))]"
                          : "border-[hsl(var(--store-border))] bg-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedVariation === v.id ? "border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary))]" : "border-gray-300")}>
                          {selectedVariation === v.id && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div>
                          <span className="text-sm font-semibold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{v.name}</span>
                          {v.description && <p className="text-xs" style={{ color: 'hsl(var(--store-muted))' }}>{v.description}</p>}
                        </div>
                      </div>
                      {v.price_modifier !== 0 && (
                        <span className="text-sm font-bold" style={{ color: 'hsl(var(--store-muted))' }}>{v.price_modifier > 0 ? '+' : ''}{formatCurrency(v.price_modifier)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Flavor Count Selector */}
            {showFlavorSelector && pizzaConfig && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Pizza className="h-5 w-5 text-[hsl(var(--store-primary))]" />
                  <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Tipo de Pizza</label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--store-primary-light))] text-[hsl(var(--store-primary))]">Obrigatório</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {pizzaConfig.flavorOptions.map(opt => (
                    <button
                      key={opt.count}
                      className={cn("flex flex-col items-center p-4 rounded-2xl border-2 transition-all", selectedFlavorCount === opt.count ? "border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary-light))]" : "border-[hsl(var(--store-border))] bg-white")}
                      onClick={() => {
                        if (selectedFlavorCount !== opt.count) {
                          setSelectedComplements(prev => { const next = { ...prev }; for (const g of store.complementGroups) { if (g.applies_per_unit) delete next[g.id]; } return next; });
                          setSelectedFlavorCount(opt.count);
                        }
                      }}
                    >
                      <Pizza className={cn("h-8 w-8 mb-2", selectedFlavorCount === opt.count ? "text-[hsl(var(--store-primary))]" : "text-gray-400")} />
                      <span className="font-bold text-sm" style={{ color: 'hsl(var(--store-card-foreground))' }}>{opt.label}</span>
                      {opt.description && <span className="text-xs" style={{ color: 'hsl(var(--store-muted))' }}>{opt.description}</span>}
                    </button>
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
                      <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{group.name}</label>
                      {group.description && <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--store-muted))' }}>{group.description}</p>}
                      <p className="text-xs" style={{ color: 'hsl(var(--store-muted))' }}>
                        {group.is_required
                          ? `Escolha ${group.min_selections || 1}${group.max_selections && group.max_selections !== (group.min_selections || 1) ? ` a ${group.max_selections}` : ''} opção(ões)`
                          : `Até ${group.max_selections || '∞'} opção(ões)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", group.is_required && selCount < (group.min_selections || 1) ? "bg-[hsl(var(--store-primary-light))] text-[hsl(var(--store-primary))]" : selCount > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {selCount}/{group.max_selections || '∞'}
                      </span>
                      {group.is_required && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--store-primary-light))] text-[hsl(var(--store-primary))]">Obrigatório</span>}
                    </div>
                  </div>

                  {options.length > 8 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'hsl(var(--store-muted))' }} />
                      <Input placeholder="Buscar opção..." value={complementSearch[group.id] || ''} onChange={(e) => setComplementSearch(prev => ({ ...prev, [group.id]: e.target.value }))} className="pl-9 h-10 rounded-xl text-sm bg-white border" style={{ borderColor: 'hsl(var(--store-border))' }} />
                    </div>
                  )}

                  <div className="space-y-2">
                    {(() => {
                      const searchTerm = complementSearch[group.id] || '';
                      return (searchTerm ? options.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase())) : options);
                    })().map(option => {
                      const isSelected = !!selections[option.id];
                      const optionQty = selections[option.id] || 0;
                      return (
                        <div
                          key={option.id}
                          className={cn("flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all", isSelected ? "border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary-light))]" : "border-[hsl(var(--store-border))] bg-white")}
                        >
                          <button
                            onClick={() => { if (!isMultipleWithRepetition) toggleComplement(group.id, option.id, group); else if (!isSelected) updateComplementQuantity(group.id, option.id, 1, group); }}
                            className="flex items-center gap-3 flex-1 text-left"
                          >
                            {option.image_url && <img src={option.image_url} alt={option.name} className="w-10 h-10 rounded-xl object-cover" />}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium block" style={{ color: 'hsl(var(--store-card-foreground))' }}>{option.name}</span>
                              {option.description && <span className="text-xs block truncate" style={{ color: 'hsl(var(--store-muted))' }}>{option.description}</span>}
                            </div>
                          </button>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {option.price > 0 && <span className="text-xs" style={{ color: 'hsl(var(--store-muted))' }}>+{formatCurrency(option.price)}</span>}
                            {isMultipleWithRepetition && isSelected ? (
                              <div className="flex items-center rounded-xl overflow-hidden border" style={{ borderColor: 'hsl(var(--store-border))' }}>
                                <button onClick={() => updateComplementQuantity(group.id, option.id, -1, group)} className="h-7 w-7 flex items-center justify-center hover:bg-gray-50"><Minus className="h-3 w-3" /></button>
                                <span className="w-6 text-center text-xs font-bold">{optionQty}</span>
                                <button onClick={() => updateComplementQuantity(group.id, option.id, 1, group)} className="h-7 w-7 flex items-center justify-center hover:bg-gray-50"><Plus className="h-3 w-3" /></button>
                              </div>
                            ) : (
                              <div
                                onClick={() => { if (!isMultipleWithRepetition) toggleComplement(group.id, option.id, group); else updateComplementQuantity(group.id, option.id, 1, group); }}
                                className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors", isSelected ? "border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary))]" : "border-gray-300")}
                              >
                                {isSelected && <Check className="h-3 w-3 text-white" />}
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
                <button onClick={() => setShowNotes(true)} className="flex items-center gap-2 text-sm py-2 transition-colors" style={{ color: 'hsl(var(--store-muted))' }}>
                  <MessageSquare className="h-4 w-4" /> Adicionar observação
                </button>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Observações</label>
                  <Textarea placeholder="Ex: sem cebola, bem passado..." value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm rounded-xl bg-white border" style={{ borderColor: 'hsl(var(--store-border))' }} rows={2} autoFocus />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 border-t p-4 bg-white space-y-2" style={{ borderColor: 'hsl(var(--store-border))' }}>
          {!validation.valid && (
            <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2 bg-[hsl(var(--store-primary-light))] text-[hsl(var(--store-primary))]">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{validation.errors[0]}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-2xl overflow-hidden border-2" style={{ borderColor: 'hsl(var(--store-border))' }}>
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-12 w-12 flex items-center justify-center hover:bg-gray-50 transition-colors">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-bold text-base" style={{ color: 'hsl(var(--store-card-foreground))' }}>{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="h-12 w-12 flex items-center justify-center hover:bg-gray-50 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={!validation.valid}
              className="flex-1 h-14 text-base font-bold rounded-2xl bg-[hsl(var(--store-primary))] text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Adicionar {formatCurrency(totalPrice)}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
