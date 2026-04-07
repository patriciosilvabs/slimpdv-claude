import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, GripVertical, ChevronDown, Settings2, Edit, Check, Package, ArrowUpDown, Pizza } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ComplementGroup } from '@/hooks/useComplementGroups';
import { ComplementOption } from '@/hooks/useComplementOptions';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface OptionConfig {
  option_id: string;
  max_quantity?: number;
  price_override?: number | null;
  sort_order?: number;
}

export interface LinkedProduct {
  id: string;
  name: string;
  category_name?: string;
}

interface ComplementGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Partial<ComplementGroup> | null;
  options: ComplementOption[];
  linkedOptionIds: string[];
  linkedOptionConfigs?: Array<{ option_id: string; max_quantity?: number; price_override?: number | null }>;
  linkedProducts?: LinkedProduct[];
  onSave: (group: Partial<ComplementGroup>, optionConfigs: OptionConfig[]) => void;
  onCreateOption?: (option: { name: string; price: number }) => Promise<ComplementOption | undefined>;
  onEditOption?: (option: ComplementOption) => void;
  onToggleOptionActive?: (optionId: string, active: boolean) => void;
  isEditing: boolean;
}

const SELECTION_TYPES = [
  { value: 'single', label: 'Apenas uma', description: 'Cliente escolhe uma opção' },
  { value: 'multiple', label: 'Mais de uma sem repetição', description: 'Múltiplas opções diferentes' },
  { value: 'multiple_repeat', label: 'Mais de uma com repetição', description: 'Mesma opção várias vezes' },
];

const VISIBILITY_OPTIONS = [
  { value: 'visible', label: 'Visível' },
  { value: 'hidden', label: 'Oculto' },
];

const CHANNEL_OPTIONS = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'counter', label: 'Balcão' },
  { value: 'table', label: 'Mesa (público)' },
  { value: 'table_internal', label: 'Mesa (interno)' },
];

const PRICE_CALCULATION_TYPES = [
  { value: 'sum', label: 'A soma dos preços', description: 'das opções escolhidas' },
  { value: 'average', label: 'A média dos preços', description: 'das opções escolhidas' },
  { value: 'highest', label: 'O preço da opção', description: 'mais cara escolhida' },
  { value: 'lowest', label: 'O preço da opção', description: 'mais barata escolhida' },
];

interface InlineOptionRowProps {
  option: ComplementOption;
  priceOverride: number;
  onRemove: () => void;
  onPriceChange: (price: number) => void;
  onConfirm: () => void;
  isConfirmed: boolean;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

function InlineOptionRow({
  option,
  priceOverride,
  onRemove,
  onPriceChange,
  onConfirm,
  isConfirmed,
  dragHandleProps
}: InlineOptionRowProps) {
  const [priceDisplay, setPriceDisplay] = React.useState(() =>
    priceOverride ? priceOverride.toString().replace('.', ',') : '0'
  );

  React.useEffect(() => {
    const numericDisplay = parseFloat(priceDisplay.replace(',', '.')) || 0;
    if (numericDisplay !== priceOverride) {
      setPriceDisplay(priceOverride ? priceOverride.toString().replace('.', ',') : '0');
    }
  }, [priceOverride]);

  return (
    <div className="flex items-center gap-2 py-2">
      <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 text-sm font-medium truncate">{option.name}</div>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <CurrencyInput
          value={priceOverride}
          onChange={onPriceChange}
          className="w-24 h-8 pl-8 text-sm"
          placeholder="0,00"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 ${isConfirmed ? 'text-green-500' : 'text-muted-foreground'}`}
        onClick={onConfirm}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface SortableOptionRowProps {
  option: ComplementOption;
  priceOverride: number;
  onRemove: () => void;
  onPriceChange: (price: number) => void;
  onConfirm: () => void;
  isConfirmed: boolean;
}

function SortableOptionRow(props: SortableOptionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <InlineOptionRow 
        {...props} 
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function ComplementGroupDialog({
  open,
  onOpenChange,
  group,
  options,
  linkedOptionIds,
  linkedOptionConfigs,
  linkedProducts,
  onSave,
  onCreateOption,
  onEditOption,
  onToggleOptionActive,
  isEditing
}: ComplementGroupDialogProps) {
  const [form, setForm] = React.useState<Partial<ComplementGroup>>({
    name: '',
    description: '',
    selection_type: 'single',
    is_required: false,
    min_selections: 0,
    max_selections: 1,
    visibility: 'visible',
    channels: ['delivery', 'counter', 'table'],
    is_active: true,
    price_calculation_type: 'sum',
    applies_per_unit: false,
    unit_count: 1,
    flavor_modal_enabled: true,
    flavor_modal_channels: ['delivery', 'counter', 'table'],
    flavor_options: [
      { count: 1, label: '1 Sabor', description: 'Pizza inteira de um sabor' },
      { count: 2, label: '2 Sabores', description: 'Pizza metade/metade' },
    ],
    applicable_flavor_counts: [1, 2],
    kds_category: 'complement',
  });
  const [selectedOptionIds, setSelectedOptionIds] = React.useState<string[]>([]);
  const [localOptions, setLocalOptions] = React.useState<ComplementOption[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
  const [showNewOptionDialog, setShowNewOptionDialog] = React.useState(false);
  const [newOptionName, setNewOptionName] = React.useState('');
  const [newOptionPrice, setNewOptionPrice] = React.useState('');
  const [isCreatingOption, setIsCreatingOption] = React.useState(false);
  const [showOptionSearch, setShowOptionSearch] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSortMode, setIsSortMode] = React.useState(false);
  const [optionConfigs, setOptionConfigs] = React.useState<Record<string, { maxQty: number; price: number; confirmed: boolean }>>({});
  
  // Merge options from props with locally created options
  const allOptions = React.useMemo(() => {
    const optionMap = new Map<string, ComplementOption>();
    options.forEach(o => optionMap.set(o.id, o));
    localOptions.forEach(o => optionMap.set(o.id, o));
    return Array.from(optionMap.values());
  }, [options, localOptions]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    if (open) {
      if (group) {
        setForm({
          name: group.name || '',
          description: group.description || '',
          selection_type: group.selection_type || 'single',
          is_required: group.is_required ?? false,
          min_selections: group.min_selections ?? 0,
          max_selections: group.max_selections ?? 1,
          visibility: group.visibility || 'visible',
          channels: group.channels || ['delivery', 'counter', 'table'],
          is_active: group.is_active ?? true,
          price_calculation_type: group.price_calculation_type || 'sum',
          applies_per_unit: group.applies_per_unit ?? false,
          unit_count: group.unit_count ?? 1,
          flavor_modal_enabled: group.flavor_modal_enabled ?? true,
          flavor_modal_channels: group.flavor_modal_channels ?? ['delivery', 'counter', 'table'],
          flavor_options: group.flavor_options ?? [
            { count: 1, label: '1 Sabor', description: 'Pizza inteira de um sabor' },
            { count: 2, label: '2 Sabores', description: 'Pizza metade/metade' },
          ],
          applicable_flavor_counts: group.applicable_flavor_counts ?? [1, 2],
          kds_category: group.kds_category ?? 'complement',
        });
        setIsAdvancedOpen(
          (group.price_calculation_type !== 'sum' && group.price_calculation_type !== null) ||
          group.applies_per_unit === true
        );
      }
      setSelectedOptionIds(linkedOptionIds);
      setLocalOptions([]);
      
      // Initialize optionConfigs from linkedOptionConfigs if available
      if (linkedOptionConfigs && linkedOptionConfigs.length > 0) {
        const configs: Record<string, { maxQty: number; price: number; confirmed: boolean }> = {};
        linkedOptionConfigs.forEach(config => {
          const option = options.find(o => o.id === config.option_id);
          configs[config.option_id] = {
            maxQty: config.max_quantity ?? 1,
            price: config.price_override ?? option?.price ?? 0,
            confirmed: true
          };
        });
        setOptionConfigs(configs);
      } else {
        setOptionConfigs({});
      }
      
      setSearchTerm('');
      setShowOptionSearch(false);
    }
  }, [group, linkedOptionIds, linkedOptionConfigs, open, options]);

  const handleSave = () => {
    if (!form.name?.trim()) return;
    
    // Build array with configurations for each option
    const configs: OptionConfig[] = selectedOptionIds.map((optionId, index) => {
      const config = optionConfigs[optionId] || { maxQty: 999, price: 0 };
      const option = allOptions.find(o => o.id === optionId);
      
      return {
        option_id: optionId,
        max_quantity: config.maxQty || 1,
        price_override: config.price !== (option?.price ?? 0) ? config.price : null,
        sort_order: index
      };
    });
    
    onSave(form, configs);
  };

  const toggleOption = (optionId: string) => {
    setSelectedOptionIds(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const toggleChannel = (channel: string) => {
    setForm(prev => ({
      ...prev,
      channels: prev.channels?.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...(prev.channels || []), channel]
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedOptionIds(prev => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleCreateNewOption = async () => {
    if (!newOptionName.trim() || !onCreateOption) return;
    
    setIsCreatingOption(true);
    try {
      const price = parseFloat(newOptionPrice) || 0;
      const newOption = await onCreateOption({ name: newOptionName.trim(), price });
      if (newOption) {
        // Add to local options so it appears immediately
        setLocalOptions(prev => [...prev, newOption as ComplementOption]);
        setSelectedOptionIds(prev => [...prev, newOption.id]);
        setNewOptionName('');
        setNewOptionPrice('');
        setShowNewOptionDialog(false);
        setOptionConfigs(prev => ({
          ...prev,
          [newOption.id]: { maxQty: 999, price:newOption.price, confirmed: false }
        }));
      }
    } finally {
      setIsCreatingOption(false);
    }
  };

  const selectedOptions = selectedOptionIds
    .map(id => allOptions.find(o => o.id === id))
    .filter((o): o is ComplementOption => !!o);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Complemento' : 'Novo Complemento'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nome do Complemento</Label>
            <Input
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Recheio > Borda"
            />
          </div>

          {/* KDS Category & Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria KDS</Label>
              <Select
                value={form.kds_category || 'complement'}
                onValueChange={(v) => setForm({ ...form, kds_category: v as 'flavor' | 'border' | 'complement' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complement">Complemento</SelectItem>
                  <SelectItem value="flavor">Sabor</SelectItem>
                  <SelectItem value="border">Borda</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define como o KDS exibirá este grupo</p>
            </div>
            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <Select
                value={form.visibility || 'visible'}
                onValueChange={(v) => setForm({ ...form, visibility: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-2">
            <Label>Disponível nos links de</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map(channel => (
                <Badge
                  key={channel.value}
                  variant={form.channels?.includes(channel.value) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleChannel(channel.value)}
                >
                  {channel.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Applicable Flavor Counts */}
          <div className="space-y-2">
            <Label>Aparece quando o cliente escolher</Label>
            <div className="flex flex-col gap-2">
              {Array.from({ length: form.unit_count ?? 2 }, (_, i) => i + 1).map(count => {
                const isSelected = form.applicable_flavor_counts?.includes(count);
                return (
                  <div key={count} className="flex items-center gap-2">
                    <Checkbox
                      id={`flavor-count-${count}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const current = form.applicable_flavor_counts ?? Array.from({ length: form.unit_count ?? 2 }, (_, i) => i + 1);
                        const updated = checked
                          ? [...current, count].sort()
                          : current.filter(c => c !== count);
                        if (updated.length === 0) return;
                        setForm({ ...form, applicable_flavor_counts: updated });
                      }}
                    />
                    <Label htmlFor={`flavor-count-${count}`} className="cursor-pointer font-normal">
                      {count === 1 ? '1 Sabor' : `${count} Sabores`}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Opções</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground"
                onClick={() => setIsSortMode(!isSortMode)}
              >
                <ArrowUpDown className="h-4 w-4 mr-1" />
                ORDENAR
              </Button>
            </div>

            {/* Header Row */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground border-b pb-2">
              <div className="w-6" /> {/* Drag handle space */}
              <div className="flex-1">Nome da opção</div>
              <div className="w-24 text-center">Preço</div>
              <div className="w-8" /> {/* Confirm button space */}
              <div className="w-8" /> {/* Delete button space */}
            </div>

            {/* Selected Options List with Drag and Drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedOptionIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {selectedOptions.map(option => (
                    <SortableOptionRow
                      key={option.id}
                      option={option}
                      priceOverride={optionConfigs[option.id]?.price ?? option.price}
                      isConfirmed={optionConfigs[option.id]?.confirmed ?? false}
                      onRemove={() => toggleOption(option.id)}
                      onPriceChange={(price) => setOptionConfigs(prev => ({
                        ...prev,
                        [option.id]: { ...prev[option.id], price }
                      }))}
                      onConfirm={() => setOptionConfigs(prev => ({
                        ...prev,
                        [option.id]: { ...prev[option.id], confirmed: true }
                      }))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add Option Row - Inline search */}
            <div className="flex items-center gap-2 py-2 border-t">
              <div className="w-6" />
              <Popover open={showOptionSearch} onOpenChange={setShowOptionSearch}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="flex-1 justify-start text-muted-foreground font-normal h-8"
                  >
                    Nome da opção
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar opção..."
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-4 text-center">
                          <p className="text-sm text-muted-foreground mb-2">Nenhuma opção encontrada</p>
                          {searchTerm.trim() && onCreateOption && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setNewOptionName(searchTerm);
                                setShowOptionSearch(false);
                                setShowNewOptionDialog(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Criar "{searchTerm}"
                            </Button>
                          )}
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {allOptions
                          .filter(o => !selectedOptionIds.includes(o.id))
                          .filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(option => (
                            <CommandItem
                              key={option.id}
                              value={option.id}
                              onSelect={() => {
                                toggleOption(option.id);
                                setOptionConfigs(prev => ({
                                  ...prev,
                                  [option.id]: { maxQty: 999, price:option.price, confirmed: false }
                                }));
                                setShowOptionSearch(false);
                                setSearchTerm('');
                              }}
                            >
                              <span>{option.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                R$ {option.price.toFixed(2)}
                              </span>
                            </CommandItem>
                          ))
                        }
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  className="w-24 h-8 pl-8 text-sm"
                  placeholder="0.00"
                  disabled
                />
              </div>
              <div className="w-8" />
              <div className="w-8" />
            </div>

            {/* Add Option Button */}
            {onCreateOption && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-primary hover:text-primary"
                onClick={() => setShowNewOptionDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                ADICIONAR OPÇÃO
              </Button>
            )}
          </div>

          {/* Selection Type — hidden for pizza/per-unit groups (system infers from flavor count) */}
          {!form.applies_per_unit && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">O cliente poderá escolher</Label>
              <div className="grid grid-cols-3 gap-2">
                {SELECTION_TYPES.map(type => (
                  <Button
                    key={type.value}
                    type="button"
                    variant={form.selection_type === type.value ? 'default' : 'outline'}
                    className="h-auto py-3 flex flex-col items-start text-left"
                    onClick={() => setForm({ ...form, selection_type: type.value as ComplementGroup['selection_type'] })}
                  >
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs opacity-70 font-normal">{type.description}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Required Toggle — hidden for pizza/per-unit groups (always required) */}
          {!form.applies_per_unit && (
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Switch
                checked={form.is_required ?? false}
                onCheckedChange={(checked) => setForm({ ...form, is_required: checked })}
              />
              <div>
                <p className="font-medium">Obrigatório</p>
                <p className="text-sm text-muted-foreground">
                  O cliente precisa escolher uma das opções
                </p>
              </div>
            </div>
          )}

          {/* Min/Max Selections — hidden for pizza/per-unit groups */}
          {!form.applies_per_unit && form.selection_type !== 'single' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mínimo de seleções</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_selections ?? 0}
                  onChange={(e) => setForm({ ...form, min_selections: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo de seleções</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_selections ?? 1}
                  onChange={(e) => setForm({ ...form, max_selections: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}

          {/* Advanced Configuration */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  <span className="font-medium">Configurações avançadas</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              {/* Tipo de cálculo de preço */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">O preço do complemento será:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRICE_CALCULATION_TYPES.map(type => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={form.price_calculation_type === type.value ? 'default' : 'outline'}
                      className="h-auto py-3 flex flex-col items-start text-left"
                      onClick={() => setForm({ ...form, price_calculation_type: type.value as ComplementGroup['price_calculation_type'] })}
                    >
                      <span className="font-medium text-sm">{type.label}</span>
                      <span className="text-xs opacity-70 font-normal">{type.description}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Aplica por unidade (pizza) */}
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Switch
                  checked={form.applies_per_unit ?? false}
                  onCheckedChange={(checked) => setForm({ ...form, applies_per_unit: checked, ...(checked ? { selection_type: 'multiple' as const, is_required: true, min_selections: 1 } : {}) })}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Pizza className="h-4 w-4" />
                    <p className="font-medium">Aplica por unidade (pizza)</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cada unidade pode ter seus próprios complementos
                  </p>
                </div>
              </div>

              {form.applies_per_unit && (
                <div className="space-y-4 pl-2 border-l-2 border-primary/20">
                  {/* Quantidade máxima de unidades */}
                  <div className="space-y-2">
                    <Label>Quantidade máxima de unidades</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={form.unit_count ?? 1}
                      onChange={e => {
                        const newCount = Math.max(1, parseInt(e.target.value) || 1);
                        const newFlavorOptions = Array.from({ length: newCount }, (_, i) => {
                          const c = i + 1;
                          const existing = form.flavor_options?.find(fo => fo.count === c);
                          return existing ?? {
                            count: c,
                            label: c === 1 ? '1 Sabor' : `${c} Sabores`,
                            description: c === 1 ? 'Pizza com 1 sabor' : `Pizza com ${c} sabores`,
                          };
                        });
                        const newApplicable = Array.from({ length: newCount }, (_, i) => i + 1);
                        setForm({
                          ...form,
                          unit_count: newCount,
                          flavor_options: newFlavorOptions,
                          applicable_flavor_counts: newApplicable,
                        });
                      }}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Quantas unidades o cliente poderá configurar individualmente
                    </p>
                  </div>

                  {/* Toggle modal de sabores */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Modal de seleção de sabores</Label>
                      <p className="text-sm text-muted-foreground">
                        Exibir modal para o cliente escolher a quantidade de sabores
                      </p>
                    </div>
                    <Switch
                      checked={form.flavor_modal_enabled ?? true}
                      onCheckedChange={checked =>
                        setForm({ ...form, flavor_modal_enabled: checked })
                      }
                    />
                  </div>

                  {form.flavor_modal_enabled && (
                    <>
                      {/* Canais do modal */}
                      <div>
                        <Label className="mb-2 block">Canais onde o modal aparece</Label>
                        <div className="flex gap-2">
                          {[
                            { value: 'delivery', label: 'Delivery' },
                            { value: 'counter', label: 'Balcão' },
                            { value: 'table', label: 'Mesa' },
                          ].map(ch => {
                            const active = (form.flavor_modal_channels ?? []).includes(ch.value);
                            return (
                              <Badge
                                key={ch.value}
                                variant={active ? 'default' : 'outline'}
                                className="cursor-pointer select-none"
                                onClick={() => {
                                  const channels = form.flavor_modal_channels ?? [];
                                  setForm({
                                    ...form,
                                    flavor_modal_channels: active
                                      ? channels.filter(c => c !== ch.value)
                                      : [...channels, ch.value],
                                  });
                                }}
                              >
                                {ch.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Opções de sabores */}
                      <div>
                        <Label className="mb-2 block">Opções de sabores</Label>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24">Qtd. Sabores</TableHead>
                              <TableHead>Título</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="w-12" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(form.flavor_options ?? []).map((opt, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={opt.count}
                                    onChange={e => {
                                      const options = [...(form.flavor_options ?? [])];
                                      options[idx] = { ...options[idx], count: parseInt(e.target.value) || 1 };
                                      setForm({ ...form, flavor_options: options });
                                    }}
                                    className="w-20"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={opt.label}
                                    onChange={e => {
                                      const options = [...(form.flavor_options ?? [])];
                                      options[idx] = { ...options[idx], label: e.target.value };
                                      setForm({ ...form, flavor_options: options });
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={opt.description}
                                    onChange={e => {
                                      const options = [...(form.flavor_options ?? [])];
                                      options[idx] = { ...options[idx], description: e.target.value };
                                      setForm({ ...form, flavor_options: options });
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const options = (form.flavor_options ?? []).filter((_, i) => i !== idx);
                                      setForm({ ...form, flavor_options: options });
                                    }}
                                    disabled={(form.flavor_options ?? []).length <= 1}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            const opts = form.flavor_options ?? [];
                            const nextCount = (opts.length > 0
                              ? Math.max(...opts.map(o => o.count))
                              : 0) + 1;
                            setForm({
                              ...form,
                              flavor_options: [
                                ...opts,
                                { count: nextCount, label: `${nextCount} Sabor${nextCount > 1 ? 'es' : ''}`, description: '' },
                              ],
                            });
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar opção
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Right Sidebar - Linked Products */}
        {isEditing && (
          <div className="w-48 shrink-0 border-l pl-4 flex flex-col">
            <Label className="text-xs text-muted-foreground mb-2">Produtos vinculados</Label>
            <ScrollArea className="flex-1">
              {linkedProducts && linkedProducts.length > 0 ? (
                <div className="space-y-2">
                  {linkedProducts.map(product => (
                    <div key={product.id} className="p-2 text-sm border rounded bg-muted/50">
                      <div className="font-medium truncate">{product.name}</div>
                      {product.category_name && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {product.category_name}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Package className="h-16 w-16 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum produto usa este complemento
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!form.name?.trim()}>
            Salvar
          </Button>
        </div>
      </DialogContent>

      {/* New Option Dialog */}
      <Dialog open={showNewOptionDialog} onOpenChange={setShowNewOptionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Opção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da opção *</Label>
              <Input
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                placeholder="Ex: Calabresa"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço</Label>
              <CurrencyInput
                value={parseFloat(newOptionPrice.replace(',', '.')) || 0}
                onChange={(val) => setNewOptionPrice(val.toString())}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewOptionDialog(false);
                setNewOptionName('');
                setNewOptionPrice('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateNewOption}
              disabled={!newOptionName.trim() || isCreatingOption}
            >
              {isCreatingOption ? 'Criando...' : 'Criar e Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}