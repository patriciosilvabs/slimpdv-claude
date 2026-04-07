import { useState, useMemo } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIngredients, useIngredientMutations, useLowStockIngredients, Ingredient } from '@/hooks/useIngredients';
import { useAllProductsWithIngredients, useProductIngredientMutations } from '@/hooks/useProductIngredients';
import { useProducts } from '@/hooks/useProducts';
import { useComplementOptions } from '@/hooks/useComplementOptions';
import { useIngredientComplementOptions, useComplementOptionIngredientMutations } from '@/hooks/useComplementOptionIngredients';
import { useRecipes, useRecipeMutations, Recipe } from '@/hooks/useRecipes';
import { useRecipeIngredients, useRecipeIngredientMutations } from '@/hooks/useRecipeIngredients';
import { useProductionOrders, useProductionOrderMutations } from '@/hooks/useProductionOrders';
import { useProductRecipesByRecipe, useRecipeProductCounts, useRecipeIngredientCounts, useProductRecipeMutations } from '@/hooks/useProductRecipes';
import { useComplementOptionRecipesByRecipe, useRecipeOptionCounts, useComplementOptionRecipeMutations } from '@/hooks/useComplementOptionRecipes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { 
  Plus, 
  Package, 
  AlertTriangle, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Settings,
  Edit,
  Trash2,
  FileText,
  Search,
  Filter,
  Link,
  Unlink,
  ChefHat,
  Factory
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';

type MovementDateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

function getMovementDateRange(range: MovementDateRange, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (range) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'custom': return { start: customStart ? startOfDay(customStart) : startOfDay(now), end: customEnd ? endOfDay(customEnd) : endOfDay(now) };
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const stockStatusConfig = {
  critical: { label: 'Crítico', color: 'bg-destructive text-destructive-foreground' },
  low: { label: 'Baixo', color: 'bg-warning text-warning-foreground' },
  normal: { label: 'Normal', color: 'bg-accent text-accent-foreground' },
};

function getStockStatus(current: number, min: number): 'critical' | 'low' | 'normal' {
  if (current <= 0) return 'critical';
  if (current <= min) return 'low';
  return 'normal';
}

export default function Stock() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('ingredients');
  const [isNewIngredientOpen, setIsNewIngredientOpen] = useState(false);
  const [isNewInsumoOpen, setIsNewInsumoOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [isTechSheetOpen, setIsTechSheetOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLinkOptionsOpen, setIsLinkOptionsOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [linkIngredient, setLinkIngredient] = useState<Ingredient | null>(null);
  const [deleteConfirmIngredient, setDeleteConfirmIngredient] = useState<Ingredient | null>(null);
  const [linkQuantity, setLinkQuantity] = useState('120');
  const [linkSelectedOptions, setLinkSelectedOptions] = useState<string[]>([]);
  const [linkUnlinkOptions, setLinkUnlinkOptions] = useState<string[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [techSheetFilter, setTechSheetFilter] = useState<'all' | 'with' | 'without'>('all');
  const [movementIngredientFilter, setMovementIngredientFilter] = useState<string>('');
  const [movementDateRange, setMovementDateRange] = useState<MovementDateRange>('today');
  const [movementCustomStart, setMovementCustomStart] = useState<Date | undefined>(undefined);
  const [movementCustomEnd, setMovementCustomEnd] = useState<Date | undefined>(undefined);
  const [editData, setEditData] = useState({ name: '', unit: 'kg', min_stock: 0, cost_per_unit: 0 });

  // Sub-recipe states
  const [isNewRecipeOpen, setIsNewRecipeOpen] = useState(false);
  const [isEditRecipeOpen, setIsEditRecipeOpen] = useState(false);
  const [isRecipeIngredientsOpen, setIsRecipeIngredientsOpen] = useState(false);
  const [isLinkProductsOpen, setIsLinkProductsOpen] = useState(false);
  const [isLinkOptionsToRecipeOpen, setIsLinkOptionsToRecipeOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [newRecipeData, setNewRecipeData] = useState({ name: '', description: '', output_ingredient_id: '', expected_yield: '' });
  const [editRecipeData, setEditRecipeData] = useState({ name: '', description: '', output_ingredient_id: '', expected_yield: '' });
  const [newRecipeIngredient, setNewRecipeIngredient] = useState({ ingredient_id: '', quantity: '' });
  const [linkProductSearch, setLinkProductSearch] = useState('');
  const [linkProductSelected, setLinkProductSelected] = useState<string[]>([]);
  const [unlinkProductSelected, setUnlinkProductSelected] = useState<string[]>([]);
  const [linkOptionToRecipeSearch, setLinkOptionToRecipeSearch] = useState('');
  const [linkOptionToRecipeSelected, setLinkOptionToRecipeSelected] = useState<string[]>([]);
  const [unlinkOptionToRecipeSelected, setUnlinkOptionToRecipeSelected] = useState<string[]>([]);
  const [linkOptionToRecipeQty, setLinkOptionToRecipeQty] = useState('300');
  
  // Production states
  const [isNewProductionOpen, setIsNewProductionOpen] = useState(false);
  const [productionRecipeId, setProductionRecipeId] = useState('');
  const [productionMultiplier, setProductionMultiplier] = useState('1');
  const [productionBatchLabel, setProductionBatchLabel] = useState('');
  const [productionNotes, setProductionNotes] = useState('');
  const [productionLoss, setProductionLoss] = useState('0');
  
  // Granular permission checks
  const canManageStock = hasPermission('stock_manage');
  const canAddIngredient = hasPermission('stock_add');
  const canAdjustStock = hasPermission('stock_adjust');
  const canViewMovements = hasPermission('stock_view_movements');

  // Form states
  const [newIngredient, setNewIngredient] = useState({
    name: '', unit: 'kg', current_stock: 0, min_stock: 0, cost_per_unit: 0
  });
  const [newInsumo, setNewInsumo] = useState({
    name: '', unit: 'kg', current_stock: 0, min_stock: 0, cost_per_unit: 0
  });
  const [movementData, setMovementData] = useState({
    type: 'entry' as 'entry' | 'exit' | 'adjustment',
    quantity: '',
    notes: ''
  });
  const [newTechSheetIngredient, setNewTechSheetIngredient] = useState({
    ingredient_id: '',
    quantity: ''
  });

  // Query hooks
  const { data: ingredients, isLoading } = useIngredients();
  const { data: lowStockIngredients } = useLowStockIngredients();
  const { data: productsWithIngredients } = useAllProductsWithIngredients();
  const { data: products } = useProducts();
  const { createIngredient, updateIngredient, addStockMovement, deleteIngredient } = useIngredientMutations();
  const { addIngredient: addTechSheetIngredient, removeIngredient: removeTechSheetIngredient } = useProductIngredientMutations();
  const { data: complementOptions } = useComplementOptions(true);
  const { data: existingLinks } = useIngredientComplementOptions(linkIngredient?.id);
  const { addBulkIngredientToOptions, removeBulkIngredientFromOptions } = useComplementOptionIngredientMutations();

  // Sub-recipe hooks
  const { data: recipes } = useRecipes();
  const { createRecipe, updateRecipe, deleteRecipe } = useRecipeMutations();
  const { data: recipeIngredientsList } = useRecipeIngredients(selectedRecipeId || undefined);
  const { addIngredient: addRecipeIngredient, removeIngredient: removeRecipeIngredient } = useRecipeIngredientMutations();
  const { data: recipeProductLinks } = useProductRecipesByRecipe(selectedRecipeId || undefined);
  const { data: recipeProductCounts } = useRecipeProductCounts();
  const { data: recipeIngredientCounts } = useRecipeIngredientCounts();
  const { linkProducts, unlinkProducts } = useProductRecipeMutations();
  const { data: recipeOptionLinks } = useComplementOptionRecipesByRecipe(selectedRecipeId || undefined);
  const { data: recipeOptionCounts } = useRecipeOptionCounts();
  const { linkOptions: linkRecipeOptions, unlinkOptions: unlinkRecipeOptions } = useComplementOptionRecipeMutations();

  // Production hooks
  const { data: productionOrders } = useProductionOrders();
  const { createProductionOrder } = useProductionOrderMutations();

  const { data: ingredientLinkCounts } = useQuery({
    queryKey: ['ingredient-link-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('complement_option_ingredients')
        .select('ingredient_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.ingredient_id] = (counts[r.ingredient_id] || 0) + 1; });
      return counts;
    }
  });

  // Stock movements history
  const movementPeriod = useMemo(() => getMovementDateRange(movementDateRange, movementCustomStart, movementCustomEnd), [movementDateRange, movementCustomStart, movementCustomEnd]);

  const { data: movements } = useQuery({
    queryKey: ['stock-movements', movementDateRange, movementCustomStart?.toISOString(), movementCustomEnd?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          ingredient:ingredients(name, unit)
        `)
        .gte('created_at', movementPeriod.start.toISOString())
        .lte('created_at', movementPeriod.end.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('stock_view')) {
    return <AccessDenied permission="stock_view" />;
  }

  const handleCreateIngredient = async () => {
    await createIngredient.mutateAsync(newIngredient);
    setIsNewIngredientOpen(false);
    setNewIngredient({ name: '', unit: 'kg', current_stock: 0, min_stock: 0, cost_per_unit: 0 });
  };

  const handleCreateInsumo = async () => {
    await createIngredient.mutateAsync({ ...newInsumo, is_insumo: true } as any);
    setIsNewInsumoOpen(false);
    setNewInsumo({ name: '', unit: 'kg', current_stock: 0, min_stock: 0, cost_per_unit: 0 });
  };

  const handleMovement = async () => {
    if (!selectedIngredient) return;
    const quantity = parseFloat(movementData.quantity.replace(',', '.'));
    if (isNaN(quantity) || quantity <= 0) return;

    await addStockMovement.mutateAsync({
      ingredient_id: selectedIngredient.id,
      movement_type: movementData.type,
      quantity,
      notes: movementData.notes
    });
    setIsMovementOpen(false);
    setMovementData({ type: 'entry', quantity: '', notes: '' });
    setSelectedIngredient(null);
  };

  const handleAddTechSheetIngredient = async () => {
    if (!selectedProductId || !newTechSheetIngredient.ingredient_id) return;
    const quantity = parseFloat(newTechSheetIngredient.quantity.replace(',', '.'));
    if (isNaN(quantity) || quantity <= 0) return;

    await addTechSheetIngredient.mutateAsync({
      product_id: selectedProductId,
      ingredient_id: newTechSheetIngredient.ingredient_id,
      quantity
    });
    setNewTechSheetIngredient({ ingredient_id: '', quantity: '' });
  };

  const openMovementDialog = (ingredient: Ingredient, type: 'entry' | 'exit' | 'adjustment') => {
    setSelectedIngredient(ingredient);
    setMovementData({ ...movementData, type });
    setIsMovementOpen(true);
  };

  const openEditDialog = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setEditData({
      name: ingredient.name,
      unit: ingredient.unit,
      min_stock: ingredient.min_stock,
      cost_per_unit: ingredient.cost_per_unit,
    });
    setIsEditOpen(true);
  };

  const handleEditIngredient = async () => {
    if (!selectedIngredient) return;
    await updateIngredient.mutateAsync({
      id: selectedIngredient.id,
      name: editData.name,
      unit: editData.unit,
      min_stock: editData.min_stock,
      cost_per_unit: editData.cost_per_unit,
    });
    setIsEditOpen(false);
    setSelectedIngredient(null);
  };

  const openLinkOptionsDialog = (ingredient: Ingredient) => {
    setLinkIngredient(ingredient);
    setLinkSelectedOptions([]);
    setLinkUnlinkOptions([]);
    setLinkQuantity('120');
    setLinkSearch('');
    setIsLinkOptionsOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!linkIngredient) return;
    const qty = parseFloat(linkQuantity.replace(',', '.'));
    const promises: Promise<unknown>[] = [];

    if (linkSelectedOptions.length > 0 && !isNaN(qty) && qty > 0) {
      promises.push(addBulkIngredientToOptions.mutateAsync({
        ingredient_id: linkIngredient.id,
        option_ids: linkSelectedOptions,
        quantity: qty,
      }));
    }

    if (linkUnlinkOptions.length > 0) {
      promises.push(removeBulkIngredientFromOptions.mutateAsync({
        ingredient_id: linkIngredient.id,
        option_ids: linkUnlinkOptions,
      }));
    }

    await Promise.all(promises);
    setLinkSelectedOptions([]);
    setLinkUnlinkOptions([]);
  };

  const toggleOptionSelection = (optionId: string) => {
    const alreadyLinked = existingLinks?.some(l => l.complement_option_id === optionId);
    
    if (alreadyLinked) {
      // Toggle unlink
      setLinkUnlinkOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      // Toggle new link
      setLinkSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Estoque</h1>
            <p className="text-muted-foreground">Controle de ingredientes e fichas técnicas</p>
          </div>
          {activeTab === 'ingredients' && (canAddIngredient || canManageStock) && (
            <Dialog open={isNewIngredientOpen} onOpenChange={setIsNewIngredientOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ingrediente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Ingrediente</DialogTitle>
                </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                    placeholder="Ex: Farinha de Trigo"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select 
                      value={newIngredient.unit} 
                      onValueChange={(v) => setNewIngredient({ ...newIngredient, unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Quilograma (kg)</SelectItem>
                        <SelectItem value="g">Grama (g)</SelectItem>
                        <SelectItem value="l">Litro (L)</SelectItem>
                        <SelectItem value="ml">Mililitro (ml)</SelectItem>
                        <SelectItem value="un">Unidade (un)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estoque Mínimo</Label>
                    <Input
                      type="number"
                      value={newIngredient.min_stock}
                      onChange={(e) => setNewIngredient({ ...newIngredient, min_stock: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estoque Inicial</Label>
                    <Input
                      type="number"
                      value={newIngredient.current_stock}
                      onChange={(e) => setNewIngredient({ ...newIngredient, current_stock: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo por {newIngredient.unit}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newIngredient.cost_per_unit}
                      onChange={(e) => setNewIngredient({ ...newIngredient, cost_per_unit: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateIngredient} disabled={createIngredient.isPending}>
                  Cadastrar Ingrediente
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Alerts */}
        {lowStockIngredients && lowStockIngredients.length > 0 && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-semibold">Alerta de Estoque Baixo</p>
                  <p className="text-sm text-muted-foreground">
                    {lowStockIngredients.length} ingrediente(s) com estoque baixo ou zerado
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {lowStockIngredients.map((ing) => (
                  <Badge 
                    key={ing.id} 
                    variant="outline"
                    className={cn(stockStatusConfig[getStockStatus(ing.current_stock, ing.min_stock)].color)}
                  >
                    {ing.name}: {ing.current_stock} {ing.unit}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
              {(canViewMovements || canManageStock) && (
                <TabsTrigger value="movements">Movimentações</TabsTrigger>
              )}
              <TabsTrigger value="techsheets">Fichas Técnicas</TabsTrigger>
              <TabsTrigger value="recipes">Sub-receitas</TabsTrigger>
              <TabsTrigger value="production">Produção</TabsTrigger>
              <TabsTrigger value="insumos">Insumo</TabsTrigger>
            </TabsList>

          {/* Ingredients Tab */}
          <TabsContent value="ingredients" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ingredients?.filter(ing => !ing.is_insumo).map((ingredient) => {
                const status = getStockStatus(ingredient.current_stock, ingredient.min_stock);
                return (
                  <Card key={ingredient.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{ingredient.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(ingredient.cost_per_unit)}/{ingredient.unit}
                            </p>
                          </div>
                        </div>
                        <Badge className={stockStatusConfig[status].color}>
                          {stockStatusConfig[status].label}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Estoque Atual</span>
                          <span className="font-medium">{ingredient.current_stock} {ingredient.unit}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Mínimo</span>
                          <span>{ingredient.min_stock} {ingredient.unit}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all",
                              status === 'critical' ? 'bg-destructive' :
                              status === 'low' ? 'bg-warning' : 'bg-accent'
                            )}
                            style={{ 
                              width: `${Math.min(100, (ingredient.current_stock / Math.max(ingredient.min_stock * 2, 1)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => openMovementDialog(ingredient, 'entry')}
                        >
                          <ArrowUpCircle className="h-4 w-4 mr-1" />
                          Entrada
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => openMovementDialog(ingredient, 'exit')}
                        >
                          <ArrowDownCircle className="h-4 w-4 mr-1" />
                          Saída
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => openLinkOptionsDialog(ingredient)}
                          title="Vincular ficha técnica"
                          className="relative"
                        >
                          <FileText className="h-4 w-4" />
                          {(ingredientLinkCounts?.[ingredient.id] ?? 0) > 0 && (
                            <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-0.5">
                              {ingredientLinkCounts[ingredient.id]}
                            </span>
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => openEditDialog(ingredient)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteConfirmIngredient(ingredient)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Insumos Tab */}
          <TabsContent value="insumos" className="mt-4">
            {(() => {
              const insumos = ingredients?.filter(ing => {
                if (ing.is_insumo) return true;
                const hasOptionLink = (ingredientLinkCounts?.[ing.id] || 0) > 0;
                const hasProductLink = productsWithIngredients?.some(p =>
                  p.ingredients.some(pi => pi.ingredient_id === ing.id)
                );
                return hasOptionLink || hasProductLink;
              });

              return (
                <div className="space-y-4">
                  {(canAddIngredient || canManageStock) && (
                    <div className="flex justify-end">
                      <Dialog open={isNewInsumoOpen} onOpenChange={setIsNewInsumoOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Insumo
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Cadastrar Insumo</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Nome</Label>
                              <Input
                                value={newInsumo.name}
                                onChange={(e) => setNewInsumo({ ...newInsumo, name: e.target.value })}
                                placeholder="Ex: Embalagem Térmica"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select 
                                  value={newInsumo.unit} 
                                  onValueChange={(v) => setNewInsumo({ ...newInsumo, unit: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="kg">Quilograma (kg)</SelectItem>
                                    <SelectItem value="g">Grama (g)</SelectItem>
                                    <SelectItem value="l">Litro (L)</SelectItem>
                                    <SelectItem value="ml">Mililitro (ml)</SelectItem>
                                    <SelectItem value="un">Unidade (un)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Estoque Mínimo</Label>
                                <Input
                                  type="number"
                                  value={newInsumo.min_stock}
                                  onChange={(e) => setNewInsumo({ ...newInsumo, min_stock: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Estoque Inicial</Label>
                                <Input
                                  type="number"
                                  value={newInsumo.current_stock}
                                  onChange={(e) => setNewInsumo({ ...newInsumo, current_stock: Number(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Custo por {newInsumo.unit}</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={newInsumo.cost_per_unit}
                                  onChange={(e) => setNewInsumo({ ...newInsumo, cost_per_unit: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                            <Button className="w-full" onClick={handleCreateInsumo} disabled={createIngredient.isPending}>
                              Cadastrar Insumo
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {(!insumos || insumos.length === 0) ? (
                    <Card>
                      <CardContent className="p-8 text-center text-muted-foreground">
                        <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Nenhum insumo encontrado</p>
                        <p className="text-sm mt-1">Clique em "Novo Insumo" para cadastrar ou vincule ingredientes a produtos/complementos.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {insumos.map((ingredient) => {
                        const status = getStockStatus(ingredient.current_stock, ingredient.min_stock);
                        const linkCount = ingredientLinkCounts?.[ingredient.id] ?? 0;
                        const productLinkCount = productsWithIngredients?.filter(p =>
                          p.ingredients.some(pi => pi.ingredient_id === ingredient.id)
                        ).length ?? 0;

                        return (
                          <Card key={ingredient.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-muted rounded-lg">
                                    <Package className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="font-semibold">{ingredient.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatCurrency(ingredient.cost_per_unit)}/{ingredient.unit}
                                    </p>
                                  </div>
                                </div>
                                <Badge className={stockStatusConfig[status].color}>
                                  {stockStatusConfig[status].label}
                                </Badge>
                              </div>

                              <div className="space-y-2 mb-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Estoque Atual</span>
                                  <span className="font-medium">{ingredient.current_stock} {ingredient.unit}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Mínimo</span>
                                  <span>{ingredient.min_stock} {ingredient.unit}</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full transition-all",
                                      status === 'critical' ? 'bg-destructive' :
                                      status === 'low' ? 'bg-warning' : 'bg-accent'
                                    )}
                                    style={{
                                      width: `${Math.min(100, (ingredient.current_stock / Math.max(ingredient.min_stock * 2, 1)) * 100)}%`
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-3">
                                {linkCount > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Link className="h-3 w-3 mr-1" />
                                    {linkCount} complemento(s)
                                  </Badge>
                                )}
                                {(productLinkCount > 0 || linkCount > 0) ? (
                                  <Badge variant="secondary" className="text-xs">
                                    <ChefHat className="h-3 w-3 mr-1" />
                                    Vinculado à ficha técnica
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    Sem ficha técnica
                                  </Badge>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => openMovementDialog(ingredient, 'entry')}
                                >
                                  <ArrowUpCircle className="h-4 w-4 mr-1" />
                                  Entrada
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => openMovementDialog(ingredient, 'exit')}
                                >
                                  <ArrowDownCircle className="h-4 w-4 mr-1" />
                                  Saída
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openLinkOptionsDialog(ingredient)}
                                  title="Vincular ficha técnica"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(ingredient)}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteConfirmIngredient(ingredient)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Histórico de Movimentações</CardTitle>
                  <Select value={movementIngredientFilter} onValueChange={setMovementIngredientFilter}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Todos os ingredientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os ingredientes</SelectItem>
                      {ingredients?.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {([
                    { value: 'today', label: 'Hoje' },
                    { value: 'yesterday', label: 'Ontem' },
                    { value: 'week', label: 'Semana' },
                    { value: 'month', label: 'Mês' },
                    { value: 'custom', label: 'Personalizado' },
                  ] as { value: MovementDateRange; label: string }[]).map((opt) => (
                    <Button
                      key={opt.value}
                      size="sm"
                      variant={movementDateRange === opt.value ? 'default' : 'outline'}
                      onClick={() => setMovementDateRange(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                  {movementDateRange === 'custom' && (
                    <div className="flex items-center gap-2 ml-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !movementCustomStart && "text-muted-foreground")}>
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            {movementCustomStart ? format(movementCustomStart, 'dd/MM/yyyy') : 'Início'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={movementCustomStart} onSelect={setMovementCustomStart} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <span className="text-muted-foreground text-sm">até</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !movementCustomEnd && "text-muted-foreground")}>
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            {movementCustomEnd ? format(movementCustomEnd, 'dd/MM/yyyy') : 'Fim'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={movementCustomEnd} onSelect={setMovementCustomEnd} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(movementIngredientFilter && movementIngredientFilter !== 'all'
                    ? movements?.filter(m => m.ingredient_id === movementIngredientFilter)
                    : movements
                  )?.map((m) => (
                    <div 
                      key={m.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {m.movement_type === 'entry' ? (
                          <ArrowUpCircle className="h-5 w-5 text-accent" />
                        ) : m.movement_type === 'exit' ? (
                          <ArrowDownCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Settings className="h-5 w-5 text-info" />
                        )}
                        <div>
                          <p className="font-medium">{m.ingredient?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {m.movement_type === 'entry' ? 'Entrada' : 
                             m.movement_type === 'exit' ? 'Saída' : 'Ajuste'}
                            {m.notes && ` - ${m.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-bold",
                          m.movement_type === 'entry' ? "text-accent" : 
                          m.movement_type === 'exit' ? "text-destructive" : "text-info"
                        )}>
                          {m.movement_type === 'entry' ? '+' : m.movement_type === 'exit' ? '-' : '='} 
                          {m.ingredient?.unit === 'kg' && m.quantity < 1
                            ? `${(m.quantity * 1000).toFixed(0)} g`
                            : `${Number(m.quantity).toFixed(3)} ${m.ingredient?.unit}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!movements || movements.length === 0) && (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhuma movimentação registrada
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tech Sheets Tab */}
          <TabsContent value="techsheets" className="mt-4">
            <div className="space-y-4">
              {/* Filter buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={techSheetFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTechSheetFilter('all')}
                >
                  Todos ({productsWithIngredients?.length || 0})
                </Button>
                <Button
                  variant={techSheetFilter === 'with' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTechSheetFilter('with')}
                >
                  Com ficha técnica ({productsWithIngredients?.filter(p => p.ingredients.length > 0).length || 0})
                </Button>
                <Button
                  variant={techSheetFilter === 'without' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTechSheetFilter('without')}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Sem ficha técnica ({productsWithIngredients?.filter(p => p.ingredients.length === 0).length || 0})
                </Button>
              </div>

              <div className="flex gap-4">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {(productsWithIngredients || [])
                      .filter(p => {
                        if (techSheetFilter === 'with') return p.ingredients.length > 0;
                        if (techSheetFilter === 'without') return p.ingredients.length === 0;
                        return true;
                      })
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.ingredients.length > 0 ? ' ✓' : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProductId && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Ficha Técnica
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add ingredient form */}
                    <div className="flex gap-2">
                      <Select 
                        value={newTechSheetIngredient.ingredient_id} 
                        onValueChange={(v) => setNewTechSheetIngredient({ ...newTechSheetIngredient, ingredient_id: v })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients?.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="w-32"
                        placeholder="Qtd"
                        value={newTechSheetIngredient.quantity}
                        onChange={(e) => setNewTechSheetIngredient({ ...newTechSheetIngredient, quantity: e.target.value })}
                      />
                      <Button onClick={handleAddTechSheetIngredient} disabled={addTechSheetIngredient.isPending}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Ingredients list */}
                    {(() => {
                      const product = productsWithIngredients?.find(p => p.id === selectedProductId);
                      if (!product) return null;
                      return (
                        <>
                          <div className="space-y-2">
                            {product.ingredients.map((pi) => (
                              <div 
                                key={pi.id} 
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              >
                                <div>
                                  <p className="font-medium">{pi.ingredient?.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {pi.quantity} {pi.ingredient?.unit} × {formatCurrency(pi.ingredient?.cost_per_unit || 0)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {formatCurrency(pi.quantity * (pi.ingredient?.cost_per_unit || 0))}
                                  </span>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => removeTechSheetIngredient.mutate(pi.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {product.ingredients.length > 0 && (
                            <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                              <span className="font-semibold">Custo de Produção</span>
                              <div className="text-right">
                                <p className="text-xl font-bold text-primary">
                                  {formatCurrency(product.productionCost)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Preço de venda: {formatCurrency(product.price)}
                                </p>
                                <p className="text-sm font-medium text-accent">
                                  Margem: {((1 - product.productionCost / product.price) * 100).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Products overview */}
              {!selectedProductId && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {productsWithIngredients?.map((product) => (
                    <Card 
                      key={product.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <CardContent className="p-4">
                        <p className="font-semibold mb-2">{product.name}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ingredientes:</span>
                            <span>{product.ingredients.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Custo:</span>
                            <span className="text-destructive">{formatCurrency(product.productionCost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Preço:</span>
                            <span className="text-accent">{formatCurrency(product.price)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Sub-receitas Tab */}
          <TabsContent value="recipes" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                  Agrupe ingredientes em sub-receitas (ex: massa, molho) e vincule a vários produtos.
                </p>
                <Dialog open={isNewRecipeOpen} onOpenChange={setIsNewRecipeOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Sub-receita
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Sub-receita</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={newRecipeData.name}
                          onChange={(e) => setNewRecipeData({ ...newRecipeData, name: e.target.value })}
                          placeholder="Ex: Massa Pizza Grande"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Textarea
                          value={newRecipeData.description}
                          onChange={(e) => setNewRecipeData({ ...newRecipeData, description: e.target.value })}
                          placeholder="Ex: Massa para pizzas tamanho grande"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ingrediente de saída (produção)</Label>
                        <Select
                          value={newRecipeData.output_ingredient_id}
                          onValueChange={(v) => setNewRecipeData({ ...newRecipeData, output_ingredient_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum (baixa direta)</SelectItem>
                            {ingredients?.map(i => (
                              <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Se definido, a produção gerará estoque deste ingrediente intermediário.
                        </p>
                      </div>
                      {newRecipeData.output_ingredient_id && newRecipeData.output_ingredient_id !== 'none' && (
                        <div className="space-y-2">
                          <Label>Rendimento esperado por lote (g)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={newRecipeData.expected_yield}
                            onChange={(e) => setNewRecipeData({ ...newRecipeData, expected_yield: e.target.value })}
                            placeholder="Ex: 1610"
                          />
                        </div>
                      )}
                      <Button
                        className="w-full"
                        disabled={!newRecipeData.name || createRecipe.isPending}
                        onClick={async () => {
                          await createRecipe.mutateAsync({
                            name: newRecipeData.name,
                            description: newRecipeData.description || undefined,
                            output_ingredient_id: newRecipeData.output_ingredient_id && newRecipeData.output_ingredient_id !== 'none' ? newRecipeData.output_ingredient_id : undefined,
                            expected_yield: parseFloat(newRecipeData.expected_yield) || undefined,
                          } as any);
                          setIsNewRecipeOpen(false);
                          setNewRecipeData({ name: '', description: '', output_ingredient_id: '', expected_yield: '' });
                        }}
                      >
                        Criar Sub-receita
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recipes?.map((recipe) => {
                  const ingCount = recipeIngredientCounts?.[recipe.id] || 0;
                  const prodCount = recipeProductCounts?.[recipe.id] || 0;
                  return (
                    <Card key={recipe.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              <ChefHat className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold">{recipe.name}</p>
                              {recipe.description && (
                                <p className="text-sm text-muted-foreground">{recipe.description}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 mb-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ingredientes:</span>
                            <Badge variant="outline">{ingCount}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Produtos vinculados:</span>
                            <Badge variant={prodCount > 0 ? "default" : "outline"}>{prodCount}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Opções (sabores) vinculadas:</span>
                            <Badge variant={(recipeOptionCounts?.[recipe.id] || 0) > 0 ? "default" : "outline"}>{recipeOptionCounts?.[recipe.id] || 0}</Badge>
                          </div>
                          {recipe.output_ingredient_id && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Produção:</span>
                              <Badge variant="default" className="bg-accent text-accent-foreground">
                                <Factory className="h-3 w-3 mr-1" />
                                {ingredients?.find(i => i.id === recipe.output_ingredient_id)?.name || 'Intermediário'}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedRecipeId(recipe.id);
                              setNewRecipeIngredient({ ingredient_id: '', quantity: '' });
                              setIsRecipeIngredientsOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Ingredientes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedRecipeId(recipe.id);
                              setLinkProductSearch('');
                              setLinkProductSelected([]);
                              setUnlinkProductSelected([]);
                              setIsLinkProductsOpen(true);
                            }}
                          >
                            <Link className="h-4 w-4 mr-1" />
                            Produtos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedRecipeId(recipe.id);
                              setLinkOptionToRecipeSearch('');
              setLinkOptionToRecipeSelected([]);
              setUnlinkOptionToRecipeSelected([]);
              setLinkOptionToRecipeQty('300');
              setIsLinkOptionsToRecipeOpen(true);
                            }}
                          >
                            <ChefHat className="h-4 w-4 mr-1" />
                            Opções
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRecipeId(recipe.id);
                              setEditRecipeData({ name: recipe.name, description: recipe.description || '', output_ingredient_id: recipe.output_ingredient_id || '', expected_yield: String(recipe.expected_yield || '') });
                              setIsEditRecipeOpen(true);
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteRecipe.mutate(recipe.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {(!recipes || recipes.length === 0) && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Nenhuma sub-receita cadastrada</p>
                    <p className="text-sm">Crie uma sub-receita para agrupar ingredientes como massa, molho, etc.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Production Tab */}
          <TabsContent value="production" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                  Registre produções para converter insumos em produtos intermediários (ex: massa, molho).
                </p>
                <Dialog open={isNewProductionOpen} onOpenChange={(open) => {
                  setIsNewProductionOpen(open);
                  if (!open) {
                    setProductionRecipeId('');
                    setProductionMultiplier('1');
                    setProductionBatchLabel('');
                    setProductionNotes('');
                    setProductionLoss('0');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Factory className="h-4 w-4 mr-2" />
                      Nova Produção
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Registrar Produção</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Sub-receita</Label>
                        <Select value={productionRecipeId} onValueChange={setProductionRecipeId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a sub-receita" />
                          </SelectTrigger>
                          <SelectContent>
                            {recipes?.filter(r => r.output_ingredient_id).map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {recipes?.filter(r => r.output_ingredient_id).length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Nenhuma sub-receita configurada com ingrediente de saída. Configure na aba "Sub-receitas".
                          </p>
                        )}
                      </div>

                      {(() => {
                        const selectedRecipe = recipes?.find(r => r.id === productionRecipeId);
                        if (!selectedRecipe) return null;

                        const outputIngredient = ingredients?.find(i => i.id === selectedRecipe.output_ingredient_id);
                        const multiplier = parseFloat(productionMultiplier) || 1;
                        const loss = parseFloat(productionLoss) || 0;
                        const expectedYield = selectedRecipe.expected_yield || 0;
                        const totalExpected = expectedYield * multiplier;
                        const totalProduced = totalExpected - loss;

                        return (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Multiplicador (lotes)</Label>
                                <Input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={productionMultiplier}
                                  onChange={(e) => setProductionMultiplier(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Perda (g)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={productionLoss}
                                  onChange={(e) => setProductionLoss(e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Rótulo do lote (opcional)</Label>
                              <Input
                                value={productionBatchLabel}
                                onChange={(e) => setProductionBatchLabel(e.target.value)}
                                placeholder="Ex: Massa Manhã"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Observação (opcional)</Label>
                              <Textarea
                                value={productionNotes}
                                onChange={(e) => setProductionNotes(e.target.value)}
                                placeholder="Notas sobre a produção"
                              />
                            </div>

                            {/* Preview */}
                            <Card className="border-primary/30 bg-primary/5">
                              <CardContent className="p-4 space-y-3">
                                <p className="font-semibold text-sm">Prévia da produção</p>
                                
                                <div className="text-sm space-y-1">
                                  <p className="text-muted-foreground">Saída de insumos:</p>
                                  {(() => {
                                    // We need recipe ingredients for the selected recipe
                                    // Since we can't call hooks conditionally, we'll use the data we have
                                    const recipeIngs = recipeIngredientsList;
                                    // Only show if the selected recipe matches
                                    if (selectedRecipeId !== productionRecipeId) return <p className="text-xs text-muted-foreground italic">Clique em "Ingredientes" na sub-receita para ver detalhes</p>;
                                    return recipeIngs?.map(ri => {
                                      const qty = (ri.quantity * multiplier).toFixed(1);
                                      return (
                                        <div key={ri.id} className="flex justify-between">
                                          <span>{ri.ingredient?.name}</span>
                                          <span className="text-destructive font-medium">-{qty} {ri.ingredient?.unit}</span>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>

                                <div className="border-t pt-2 text-sm">
                                  <p className="text-muted-foreground">Entrada de produto intermediário:</p>
                                  <div className="flex justify-between font-medium">
                                    <span>{outputIngredient?.name || 'N/A'}</span>
                                    <span className="text-accent">+{totalProduced.toFixed(1)} {outputIngredient?.unit || 'g'}</span>
                                  </div>
                                  {loss > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Rendimento: {totalExpected > 0 ? ((totalProduced / totalExpected) * 100).toFixed(1) : 0}%
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>

                            <Button
                              className="w-full"
                              disabled={createProductionOrder.isPending || !outputIngredient}
                              onClick={async () => {
                                if (!outputIngredient) return;
                                // Load recipe ingredients for deduction
                                const { data: recipeIngsData } = await supabase
                                  .from('recipe_ingredients')
                                  .select('*, ingredient:ingredients(id, name, unit, current_stock)')
                                  .eq('recipe_id', productionRecipeId);

                                const deductions = (recipeIngsData || []).map((ri: any) => ({
                                  ingredient_id: ri.ingredient_id,
                                  quantity: ri.quantity * multiplier,
                                  current_stock: ri.ingredient?.current_stock || 0,
                                  unit: ri.ingredient?.unit || 'g',
                                }));

                                // Get fresh output ingredient stock
                                const { data: freshOutput } = await supabase
                                  .from('ingredients')
                                  .select('id, current_stock, unit')
                                  .eq('id', outputIngredient.id)
                                  .single();

                                await createProductionOrder.mutateAsync({
                                  recipe_id: productionRecipeId,
                                  quantity_produced: totalProduced,
                                  expected_quantity: totalExpected,
                                  loss_quantity: loss,
                                  batch_label: productionBatchLabel || undefined,
                                  notes: productionNotes || undefined,
                                  ingredientDeductions: deductions,
                                  outputIngredient: freshOutput ? {
                                    id: freshOutput.id,
                                    current_stock: freshOutput.current_stock || 0,
                                    unit: freshOutput.unit,
                                  } : null,
                                });
                                setIsNewProductionOpen(false);
                              }}
                            >
                              Confirmar Produção
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Production orders list */}
              {(!productionOrders || productionOrders.length === 0) ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Factory className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Nenhuma produção registrada</p>
                    <p className="text-sm mt-1">
                      Configure uma sub-receita com ingrediente de saída e registre produções aqui.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {productionOrders.map((po) => {
                    const yieldPct = po.expected_quantity > 0
                      ? ((po.quantity_produced / po.expected_quantity) * 100).toFixed(1)
                      : '—';
                    return (
                      <Card key={po.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold">{po.recipe?.name || 'Sub-receita'}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(po.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                {po.batch_label && ` · Lote: ${po.batch_label}`}
                              </p>
                            </div>
                            <Badge variant="outline">{po.quantity_produced.toLocaleString('pt-BR')}g</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span>Rendimento: {yieldPct}%</span>
                            {po.loss_quantity > 0 && <span>Perda: {po.loss_quantity}g</span>}
                            {po.notes && <span>· {po.notes}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Recipe Dialog */}
        <Dialog open={isEditRecipeOpen} onOpenChange={setIsEditRecipeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Sub-receita</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editRecipeData.name}
                  onChange={(e) => setEditRecipeData({ ...editRecipeData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editRecipeData.description}
                  onChange={(e) => setEditRecipeData({ ...editRecipeData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ingrediente de saída (produção)</Label>
                <Select
                  value={editRecipeData.output_ingredient_id || 'none'}
                  onValueChange={(v) => setEditRecipeData({ ...editRecipeData, output_ingredient_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (baixa direta)</SelectItem>
                    {ingredients?.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editRecipeData.output_ingredient_id && (
                <div className="space-y-2">
                  <Label>Rendimento esperado por lote (g)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editRecipeData.expected_yield}
                    onChange={(e) => setEditRecipeData({ ...editRecipeData, expected_yield: e.target.value })}
                    placeholder="Ex: 1610"
                  />
                </div>
              )}
              <Button
                className="w-full"
                disabled={!editRecipeData.name || updateRecipe.isPending}
                onClick={async () => {
                  if (!selectedRecipeId) return;
                  await updateRecipe.mutateAsync({
                    id: selectedRecipeId,
                    name: editRecipeData.name,
                    description: editRecipeData.description,
                    output_ingredient_id: editRecipeData.output_ingredient_id || null,
                    expected_yield: parseFloat(editRecipeData.expected_yield) || 0,
                  } as any);
                  setIsEditRecipeOpen(false);
                }}
              >
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Recipe Ingredients Dialog */}
        <Dialog open={isRecipeIngredientsOpen} onOpenChange={setIsRecipeIngredientsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Ingredientes — {recipes?.find(r => r.id === selectedRecipeId)?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Select
                  value={newRecipeIngredient.ingredient_id}
                  onValueChange={(v) => setNewRecipeIngredient({ ...newRecipeIngredient, ingredient_id: v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione ingrediente" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients?.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-24"
                  placeholder="Qtd (g)"
                  value={newRecipeIngredient.quantity}
                  onChange={(e) => setNewRecipeIngredient({ ...newRecipeIngredient, quantity: e.target.value })}
                />
                <Button
                  disabled={!newRecipeIngredient.ingredient_id || !newRecipeIngredient.quantity || addRecipeIngredient.isPending}
                  onClick={async () => {
                    if (!selectedRecipeId) return;
                    const qty = parseFloat(newRecipeIngredient.quantity.replace(',', '.'));
                    if (isNaN(qty) || qty <= 0) return;
                    await addRecipeIngredient.mutateAsync({
                      recipe_id: selectedRecipeId,
                      ingredient_id: newRecipeIngredient.ingredient_id,
                      quantity: qty,
                    });
                    setNewRecipeIngredient({ ingredient_id: '', quantity: '' });
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {recipeIngredientsList?.map((ri) => (
                    <div key={ri.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{ri.ingredient?.name}</p>
                        <p className="text-sm text-muted-foreground">{ri.quantity} g</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeRecipeIngredient.mutate({ id: ri.id, recipe_id: ri.recipe_id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {(!recipeIngredientsList || recipeIngredientsList.length === 0) && (
                    <p className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum ingrediente adicionado
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>

        {/* Link Products to Recipe Dialog */}
        <Dialog open={isLinkProductsOpen} onOpenChange={setIsLinkProductsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Vincular Produtos — {recipes?.find(r => r.id === selectedRecipeId)?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={linkProductSearch}
                onChange={(e) => setLinkProductSearch(e.target.value)}
                placeholder="Buscar produto..."
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const filtered = products
                      ?.filter(p => p.name.toLowerCase().includes(linkProductSearch.toLowerCase()))
                      .filter(p => !recipeProductLinks?.some(l => l.product_id === p.id))
                      .map(p => p.id) || [];
                    setLinkProductSelected(prev => [...new Set([...prev, ...filtered])]);
                  }}
                >
                  Marcar Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLinkProductSelected([]);
                    setUnlinkProductSelected([]);
                  }}
                >
                  Desmarcar Todos
                </Button>
                {recipeProductLinks && recipeProductLinks.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={async () => {
                      if (!selectedRecipeId || !recipeProductLinks?.length) return;
                      await unlinkProducts.mutateAsync({
                        recipe_id: selectedRecipeId,
                        product_ids: recipeProductLinks.map(l => l.product_id),
                      });
                    }}
                    disabled={unlinkProducts.isPending}
                  >
                    Desvincular Todos
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-md p-2">
                <div className="space-y-1">
                  {products
                    ?.filter(p => p.name.toLowerCase().includes(linkProductSearch.toLowerCase()))
                    .map(p => {
                      const alreadyLinked = recipeProductLinks?.some(l => l.product_id === p.id);
                      const isSelected = linkProductSelected.includes(p.id);
                      const isMarkedForUnlink = unlinkProductSelected.includes(p.id);
                      const isChecked = alreadyLinked ? !isMarkedForUnlink : isSelected;
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                            isMarkedForUnlink && "bg-destructive/10 border border-destructive/30"
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {
                              if (alreadyLinked) {
                                setUnlinkProductSelected(prev =>
                                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                );
                              } else {
                                setLinkProductSelected(prev =>
                                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                );
                              }
                            }}
                          />
                          <span className="text-sm flex-1">{p.name}</span>
                          {alreadyLinked && !isMarkedForUnlink && (
                            <Badge variant="outline" className="text-xs">Vinculado</Badge>
                          )}
                          {isMarkedForUnlink && (
                            <Badge variant="destructive" className="text-xs">Desvincular</Badge>
                          )}
                        </label>
                      );
                    })}
                </div>
              </ScrollArea>

              {(linkProductSelected.length > 0 || unlinkProductSelected.length > 0) && (
                <p className="text-sm text-muted-foreground">
                  {linkProductSelected.length > 0 && `${linkProductSelected.length} para vincular`}
                  {linkProductSelected.length > 0 && unlinkProductSelected.length > 0 && ' · '}
                  {unlinkProductSelected.length > 0 && `${unlinkProductSelected.length} para desvincular`}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsLinkProductsOpen(false)}>Cancelar</Button>
              <Button
                disabled={
                  (linkProductSelected.length === 0 && unlinkProductSelected.length === 0) ||
                  linkProducts.isPending || unlinkProducts.isPending
                }
                onClick={async () => {
                  if (!selectedRecipeId) return;
                  const promises: Promise<unknown>[] = [];
                  if (linkProductSelected.length > 0) {
                    promises.push(linkProducts.mutateAsync({
                      recipe_id: selectedRecipeId,
                      product_ids: linkProductSelected,
                    }));
                  }
                  if (unlinkProductSelected.length > 0) {
                    promises.push(unlinkProducts.mutateAsync({
                      recipe_id: selectedRecipeId,
                      product_ids: unlinkProductSelected,
                    }));
                  }
                  await Promise.all(promises);
                  setLinkProductSelected([]);
                  setUnlinkProductSelected([]);
                }}
              >
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Link Options (Sabores) to Recipe Dialog */}
        <Dialog open={isLinkOptionsToRecipeOpen} onOpenChange={setIsLinkOptionsToRecipeOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Vincular Opções (Sabores) — {recipes?.find(r => r.id === selectedRecipeId)?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Quantidade por sabor (g)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={linkOptionToRecipeQty}
                  onChange={(e) => setLinkOptionToRecipeQty(e.target.value)}
                  placeholder="Ex: 300"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Essa quantidade será aplicada aos novos vínculos</p>
              </div>
              <Input
                value={linkOptionToRecipeSearch}
                onChange={(e) => setLinkOptionToRecipeSearch(e.target.value)}
                placeholder="Buscar opção..."
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const filtered = complementOptions
                      ?.filter(opt => opt.name.toLowerCase().includes(linkOptionToRecipeSearch.toLowerCase()))
                      .filter(opt => !recipeOptionLinks?.some(l => l.complement_option_id === opt.id))
                      .map(opt => opt.id) || [];
                    setLinkOptionToRecipeSelected(prev => [...new Set([...prev, ...filtered])]);
                  }}
                >
                  Marcar Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLinkOptionToRecipeSelected([]);
                    setUnlinkOptionToRecipeSelected([]);
                  }}
                >
                  Desmarcar Todos
                </Button>
                {recipeOptionLinks && recipeOptionLinks.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={async () => {
                      if (!selectedRecipeId || !recipeOptionLinks?.length) return;
                      await unlinkRecipeOptions.mutateAsync({
                        recipe_id: selectedRecipeId,
                        option_ids: recipeOptionLinks.map(l => l.complement_option_id),
                      });
                    }}
                    disabled={unlinkRecipeOptions.isPending}
                  >
                    Desvincular Todos
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-md p-2">
                <div className="space-y-1">
                  {complementOptions
                    ?.filter(opt => opt.name.toLowerCase().includes(linkOptionToRecipeSearch.toLowerCase()))
                    .map(opt => {
                      const alreadyLinked = recipeOptionLinks?.some(l => l.complement_option_id === opt.id);
                      const isSelected = linkOptionToRecipeSelected.includes(opt.id);
                      const isMarkedForUnlink = unlinkOptionToRecipeSelected.includes(opt.id);
                      const isChecked = alreadyLinked ? !isMarkedForUnlink : isSelected;
                      return (
                        <label
                          key={opt.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                            isMarkedForUnlink && "bg-destructive/10 border border-destructive/30"
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {
                              if (alreadyLinked) {
                                setUnlinkOptionToRecipeSelected(prev =>
                                  prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id]
                                );
                              } else {
                                setLinkOptionToRecipeSelected(prev =>
                                  prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id]
                                );
                              }
                            }}
                          />
                          <span className="text-sm flex-1">{opt.name}</span>
                          {alreadyLinked && !isMarkedForUnlink && (
                            <Badge variant="outline" className="text-xs">
                              Vinculado — {recipeOptionLinks?.find(l => l.complement_option_id === opt.id)?.quantity_multiplier ?? 1}g
                            </Badge>
                          )}
                          {isMarkedForUnlink && (
                            <Badge variant="destructive" className="text-xs">Desvincular</Badge>
                          )}
                        </label>
                      );
                    })}
                </div>
              </ScrollArea>

              {(linkOptionToRecipeSelected.length > 0 || unlinkOptionToRecipeSelected.length > 0) && (
                <p className="text-sm text-muted-foreground">
                  {linkOptionToRecipeSelected.length > 0 && `${linkOptionToRecipeSelected.length} para vincular`}
                  {linkOptionToRecipeSelected.length > 0 && unlinkOptionToRecipeSelected.length > 0 && ' · '}
                  {unlinkOptionToRecipeSelected.length > 0 && `${unlinkOptionToRecipeSelected.length} para desvincular`}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsLinkOptionsToRecipeOpen(false)}>Cancelar</Button>
              <Button
                disabled={
                  (linkOptionToRecipeSelected.length === 0 && unlinkOptionToRecipeSelected.length === 0 &&
                    !(recipeOptionLinks?.some(l => l.quantity_multiplier !== (parseFloat(linkOptionToRecipeQty) || 1)))) ||
                  linkRecipeOptions.isPending || unlinkRecipeOptions.isPending
                }
                onClick={async () => {
                  if (!selectedRecipeId) return;
                  const promises: Promise<unknown>[] = [];
                  const newQty = parseFloat(linkOptionToRecipeQty) || 1;
                  
                  // Collect new selections
                  const idsToLink = [...linkOptionToRecipeSelected];
                  
                  // Also re-upsert already-linked options whose quantity changed (and are NOT being unlinked)
                  if (recipeOptionLinks) {
                    for (const link of recipeOptionLinks) {
                      if (
                        link.quantity_multiplier !== newQty &&
                        !unlinkOptionToRecipeSelected.includes(link.complement_option_id) &&
                        !idsToLink.includes(link.complement_option_id)
                      ) {
                        idsToLink.push(link.complement_option_id);
                      }
                    }
                  }
                  
                  if (idsToLink.length > 0) {
                    promises.push(linkRecipeOptions.mutateAsync({
                      recipe_id: selectedRecipeId,
                      option_ids: idsToLink,
                      quantity_multiplier: newQty,
                    }));
                  }
                  if (unlinkOptionToRecipeSelected.length > 0) {
                    promises.push(unlinkRecipeOptions.mutateAsync({
                      recipe_id: selectedRecipeId,
                      option_ids: unlinkOptionToRecipeSelected,
                    }));
                  }
                  await Promise.all(promises);
                  setLinkOptionToRecipeSelected([]);
                  setUnlinkOptionToRecipeSelected([]);
                }}
              >
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {movementData.type === 'entry' ? 'Entrada de Estoque' :
                 movementData.type === 'exit' ? 'Saída de Estoque' : 'Ajuste de Estoque'}
              </DialogTitle>
            </DialogHeader>
            {selectedIngredient && (
              <div className="space-y-4 pt-4">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-medium">{selectedIngredient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Estoque atual: {selectedIngredient.current_stock} {selectedIngredient.unit}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    {movementData.type === 'adjustment' ? 'Novo valor do estoque' : 'Quantidade'}
                  </Label>
                  <Input
                    type="text"
                    placeholder="0"
                    value={movementData.quantity}
                    onChange={(e) => setMovementData({ ...movementData, quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea
                    placeholder={
                      movementData.type === 'entry' ? "Ex: Compra do fornecedor X" :
                      movementData.type === 'exit' ? "Ex: Uso na produção" : "Ex: Inventário realizado"
                    }
                    value={movementData.notes}
                    onChange={(e) => setMovementData({ ...movementData, notes: e.target.value })}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleMovement}
                  disabled={addStockMovement.isPending}
                >
                  Confirmar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Ingredient Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Ingrediente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Ex: Farinha de Trigo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select 
                    value={editData.unit} 
                    onValueChange={(v) => setEditData({ ...editData, unit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Quilograma (kg)</SelectItem>
                      <SelectItem value="g">Grama (g)</SelectItem>
                      <SelectItem value="l">Litro (L)</SelectItem>
                      <SelectItem value="ml">Mililitro (ml)</SelectItem>
                      <SelectItem value="un">Unidade (un)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estoque Mínimo</Label>
                  <Input
                    type="number"
                    value={editData.min_stock}
                    onChange={(e) => setEditData({ ...editData, min_stock: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Custo por {editData.unit}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editData.cost_per_unit}
                  onChange={(e) => setEditData({ ...editData, cost_per_unit: Number(e.target.value) })}
                />
              </div>
              <Button className="w-full" onClick={handleEditIngredient} disabled={updateIngredient.isPending}>
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Link Options Dialog */}
        <Dialog open={isLinkOptionsOpen} onOpenChange={setIsLinkOptionsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vincular Opções — {linkIngredient?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Quantidade (g) por pizza inteira</Label>
                <Input
                  type="number"
                  value={linkQuantity}
                  onChange={(e) => setLinkQuantity(e.target.value)}
                  placeholder="120"
                />
              </div>

              <div className="space-y-2">
                <Label>Buscar opção</Label>
                <Input
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="Filtrar opções..."
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const filtered = complementOptions
                      ?.filter(opt => opt.name.toLowerCase().includes(linkSearch.toLowerCase()))
                      .filter(opt => !existingLinks?.some(l => l.complement_option_id === opt.id))
                      .map(opt => opt.id) || [];
                    setLinkSelectedOptions(prev => [...new Set([...prev, ...filtered])]);
                  }}
                >
                  Marcar Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLinkSelectedOptions([]);
                    setLinkUnlinkOptions([]);
                  }}
                >
                  Desmarcar Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  disabled={removeBulkIngredientFromOptions.isPending || !existingLinks?.length}
                  onClick={async () => {
                    if (!linkIngredient || !existingLinks?.length) return;
                    const linkedIds = existingLinks.map(l => l.complement_option_id);
                    await removeBulkIngredientFromOptions.mutateAsync({
                      ingredient_id: linkIngredient.id,
                      option_ids: linkedIds,
                    });
                    setLinkUnlinkOptions([]);
                  }}
                >
                  Desvincular Todos
                </Button>
              </div>

              <ScrollArea className="h-[300px] border rounded-md p-2">
                <div className="space-y-1">
                  {complementOptions
                    ?.filter(opt => opt.name.toLowerCase().includes(linkSearch.toLowerCase()))
                    .map(opt => {
                      const alreadyLinked = existingLinks?.some(l => l.complement_option_id === opt.id);
                      const isSelected = linkSelectedOptions.includes(opt.id);
                      const isMarkedForUnlink = linkUnlinkOptions.includes(opt.id);
                      const isChecked = alreadyLinked ? !isMarkedForUnlink : isSelected;
                      return (
                        <label
                          key={opt.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                            isMarkedForUnlink && "bg-destructive/10 border border-destructive/30"
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleOptionSelection(opt.id)}
                          />
                          <span className="text-sm flex-1">{opt.name}</span>
                          {alreadyLinked && !isMarkedForUnlink && (
                            <Badge variant="outline" className="text-xs">
                              {existingLinks?.find(l => l.complement_option_id === opt.id)?.quantity ?? 0}g
                            </Badge>
                          )}
                          {isMarkedForUnlink && (
                            <Badge variant="destructive" className="text-xs">Desvincular</Badge>
                          )}
                        </label>
                      );
                    })}
                </div>
              </ScrollArea>

              {(linkSelectedOptions.length > 0 || linkUnlinkOptions.length > 0) && (
                <p className="text-sm text-muted-foreground">
                  {linkSelectedOptions.length > 0 && `${linkSelectedOptions.length} para vincular`}
                  {linkSelectedOptions.length > 0 && linkUnlinkOptions.length > 0 && ' · '}
                  {linkUnlinkOptions.length > 0 && `${linkUnlinkOptions.length} para desvincular`}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsLinkOptionsOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSaveChanges}
                disabled={
                  (linkSelectedOptions.length === 0 && linkUnlinkOptions.length === 0) ||
                  addBulkIngredientToOptions.isPending ||
                  removeBulkIngredientFromOptions.isPending
                }
              >
                Salvar Alterações
                {(linkSelectedOptions.length > 0 || linkUnlinkOptions.length > 0) && (
                  <span className="ml-1 text-xs opacity-80">
                    ({linkSelectedOptions.length > 0 ? `${linkSelectedOptions.length}+` : ''}{linkUnlinkOptions.length > 0 ? `${linkUnlinkOptions.length}−` : ''})
                  </span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmIngredient} onOpenChange={(open) => !open && setDeleteConfirmIngredient(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir ingrediente</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir <strong>{deleteConfirmIngredient?.name}</strong>? Todos os vínculos com fichas técnicas e produtos serão removidos. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteConfirmIngredient) {
                    deleteIngredient.mutate(deleteConfirmIngredient.id);
                    setDeleteConfirmIngredient(null);
                  }
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PDVLayout>
  );
}
