import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts, useProductMutations } from '@/hooks/useProducts';
import { useCategories, useCategoryMutations } from '@/hooks/useCategories';
import { useProductVariations } from '@/hooks/useProductVariations';
import { useComplementGroups, useComplementGroupsMutations, ComplementGroup } from '@/hooks/useComplementGroups';
import { useComplementOptions, useComplementOptionsMutations, ComplementOption } from '@/hooks/useComplementOptions';
import { useComplementGroupOptions, useComplementGroupOptionsMutations } from '@/hooks/useComplementGroupOptions';
import { useProductComplementGroups, useProductComplementGroupsMutations } from '@/hooks/useProductComplementGroups';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useGroupStores } from '@/hooks/useGroupStores';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { Plus, Edit, Trash2, Search, Package, GripVertical, MoreVertical, Star, Percent, Eye, EyeOff, Printer, Copy, X, Building2, FileSpreadsheet, CheckSquare, PackageCheck, Link2 } from 'lucide-react';
import { IntegrationCodesPanel } from '@/components/menu/IntegrationCodesPanel';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ImageUpload } from '@/components/ImageUpload';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableItem } from '@/components/SortableItem';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ComplementGroupDialog } from '@/components/menu/ComplementGroupDialog';
import { ComplementOptionDialog } from '@/components/menu/ComplementOptionDialog';
import { ReplicateMenuDialog } from '@/components/menu/ReplicateMenuDialog';
import { ImportMenuDialog } from '@/components/menu/ImportMenuDialog';


function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}


interface ProductForm {
  name: string;
  description: string;
  price: number;
  cost_price: number;
  category_id: string;
  is_available: boolean;
  is_featured: boolean;
  is_promotion: boolean;
  promotion_price: number;
  label: string;
  internal_code: string;
  pdv_code: string;
  image_url: string | null;
  print_sector_id: string | null;
  unit_type: string;
  adults_only: boolean;
  hide_observation_field: boolean;
  check_on_dispatch: boolean;
  available_for: string[];
  dispatch_keywords: string[];
  operational_type: string;
}

const LABEL_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'novidade', label: 'Novidade' },
  { value: 'mais_vendido', label: 'Mais Vendido' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'picante', label: 'Picante' },
];

export default function Menu() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: products } = useProducts(true); // Include inactive for management
  const { data: categories } = useCategories();
  const { data: variations } = useProductVariations();
  const { data: complementGroups } = useComplementGroups(true); // Include inactive for management
  const { data: complementOptions } = useComplementOptions(true); // Include inactive for management
  const { data: printSectors } = usePrintSectors();
  const { otherStores, isOwnerOfGroup } = useGroupStores();
  const { createProduct, updateProduct, deleteProduct, updateSortOrder: updateProductSortOrder } = useProductMutations();
  const { createCategory, updateCategory, deleteCategory, updateSortOrder: updateCategorySortOrder } = useCategoryMutations();
  const { createGroup, updateGroup, deleteGroup } = useComplementGroupsMutations();
  const { createOption, updateOption, deleteOption } = useComplementOptionsMutations();
  const { setGroupOptions } = useComplementGroupOptionsMutations();
  const { setProductGroups, setGroupsForProduct } = useProductComplementGroupsMutations();
  
  const canManageMenu = hasPermission('menu_manage');
  const canReplicateMenu = isOwnerOfGroup && otherStores.length > 0;
  
  // ALL STATE HOOKS MUST BE BEFORE CONDITIONAL RETURN
  const [mainTab, setMainTab] = useState('categories');
  const [search, setSearch] = useState('');
  const [isReplicateDialogOpen, setIsReplicateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategorySortMode, setIsCategorySortMode] = useState(false);
  
  // Advanced filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterPromotion, setFilterPromotion] = useState<'all' | 'yes' | 'no'>('all');
  const [filterFeatured, setFilterFeatured] = useState<'all' | 'yes' | 'no'>('all');
  
  // Drag & drop between categories
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  
  // Group counts state
  const [groupCounts, setGroupCounts] = useState<Record<string, { options: number, products: number }>>({});
  const [optionGroupCounts, setOptionGroupCounts] = useState<Record<string, number>>({});
  const [optionLinkFilter, setOptionLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [optionSelectionMode, setOptionSelectionMode] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Product dialog state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productDialogTab, setProductDialogTab] = useState('info');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: '', description: '', price: 0, cost_price: 0, category_id: '', 
    is_available: true, is_featured: false, is_promotion: false, promotion_price: 0,
    label: 'none', internal_code: '', pdv_code: '', image_url: null, print_sector_id: null,
    unit_type: 'UN', adults_only: false, hide_observation_field: false, check_on_dispatch: false, available_for: ['delivery', 'counter', 'table'],
    dispatch_keywords: [], operational_type: 'cozinha'
  });
  const [productLinkedExtras, setProductLinkedExtras] = useState<string[]>([]);
  const [productLinkedGroupIds, setProductLinkedGroupIds] = useState<string[]>([]);
  const [complementGroupSearch, setComplementGroupSearch] = useState('');

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', icon: '', is_active: true });

  // Complement Group dialog state
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ComplementGroup | null>(null);
  const [groupLinkedOptionIds, setGroupLinkedOptionIds] = useState<string[]>([]);
  const [groupLinkedOptionConfigs, setGroupLinkedOptionConfigs] = useState<Array<{ option_id: string; max_quantity?: number; price_override?: number | null }>>([]);
  const [groupLinkedProductIds, setGroupLinkedProductIds] = useState<string[]>([]);

  // Complement Option dialog state
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ComplementOption | null>(null);
  const [optionLinkedGroupIds, setOptionLinkedGroupIds] = useState<string[]>([]);
  const [optionLinkedGroupProducts, setOptionLinkedGroupProducts] = useState<Record<string, Array<{ id: string; name: string; category_name?: string }>>>({});
  
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch group counts
  useEffect(() => {
    const fetchCounts = async () => {
      const [optionsResult, productsResult] = await Promise.all([
        supabase.from('complement_group_options').select('group_id, option_id'),
        supabase.from('product_complement_groups').select('group_id')
      ]);
      
      const counts: Record<string, { options: number, products: number }> = {};
      const optCounts: Record<string, number> = {};
      optionsResult.data?.forEach(o => {
        counts[o.group_id] = counts[o.group_id] || { options: 0, products: 0 };
        counts[o.group_id].options++;
        optCounts[o.option_id] = (optCounts[o.option_id] || 0) + 1;
      });
      productsResult.data?.forEach(p => {
        counts[p.group_id] = counts[p.group_id] || { options: 0, products: 0 };
        counts[p.group_id].products++;
      });
      setGroupCounts(counts);
      setOptionGroupCounts(optCounts);
    };
    if (complementGroups?.length) {
      fetchCounts();
    }
  }, [complementGroups, complementOptions]);

  // Auto-select first category when categories load and none is selected
  useEffect(() => {
    if (categories?.length && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('menu_view')) {
    return <AccessDenied permission="menu_view" />;
  }

  // Filter products by category, search, and advanced filters
  const filteredProducts = products?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategoryId || p.category_id === selectedCategoryId;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && p.is_available) || 
      (filterStatus === 'inactive' && !p.is_available);
    const matchesPromotion = filterPromotion === 'all' || 
      (filterPromotion === 'yes' && p.is_promotion) || 
      (filterPromotion === 'no' && !p.is_promotion);
    const matchesFeatured = filterFeatured === 'all' || 
      (filterFeatured === 'yes' && p.is_featured) || 
      (filterFeatured === 'no' && !p.is_featured);
    return matchesSearch && matchesCategory && matchesStatus && matchesPromotion && matchesFeatured;
  });

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const draggedProduct = products?.find(p => p.id === draggedProductId);
  const hasActiveFilters = filterStatus !== 'all' || filterPromotion !== 'all' || filterFeatured !== 'all';
  
  const clearFilters = () => {
    setFilterStatus('all');
    setFilterPromotion('all');
    setFilterFeatured('all');
  };


  // Handlers
  const handleSaveProduct = async () => {
    const productData = {
      name: productForm.name,
      description: productForm.description || null,
      price: productForm.price,
      cost_price: productForm.cost_price || 0,
      category_id: productForm.category_id || null,
      is_available: productForm.is_available,
      is_featured: productForm.is_featured,
      is_promotion: productForm.is_promotion,
      promotion_price: productForm.is_promotion ? productForm.promotion_price : null,
      label: productForm.label === 'none' ? null : (productForm.label || null),
      internal_code: productForm.internal_code || null,
      pdv_code: productForm.pdv_code || null,
      image_url: productForm.image_url,
      preparation_time: 15,
      sort_order: editingProduct?.sort_order ?? (products?.length ?? 0),
      print_sector_id: productForm.print_sector_id || null,
      unit_type: productForm.unit_type,
      adults_only: productForm.adults_only,
      hide_observation_field: productForm.hide_observation_field,
      check_on_dispatch: productForm.check_on_dispatch,
      available_for: productForm.available_for,
      dispatch_keywords: productForm.dispatch_keywords,
      operational_type: productForm.operational_type,
    };

    let productId = editingProduct?.id;
    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, ...productData });
    } else {
      const result = await createProduct.mutateAsync(productData);
      productId = result.id;
    }
    
    // Save linked groups
    if (productId) {
      await setGroupsForProduct.mutateAsync({ productId, groupIds: productLinkedGroupIds });
    }
    
    closeProductDialog();
  };

  const handleSaveCategory = async () => {
    const categoryData = {
      name: categoryForm.name,
      description: categoryForm.description || null,
      icon: categoryForm.icon || null,
      is_active: categoryForm.is_active,
      sort_order: editingCategory?.sort_order ?? (categories?.length ?? 0)
    };

    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...categoryData });
    } else {
      await createCategory.mutateAsync(categoryData);
    }
    setIsCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '', icon: '', is_active: true });
  };

  const handleDuplicateCategory = async (category: any) => {
    try {
      // 1. Create new category with "(cópia)" suffix
      const newCategoryData = {
        name: `${category.name} (cópia)`,
        description: category.description || null,
        icon: category.icon || null,
        is_active: category.is_active ?? true,
        sort_order: (categories?.length ?? 0)
      };
      const newCategory = await createCategory.mutateAsync(newCategoryData);
      
      // 2. Get all products from the original category
      const categoryProducts = products?.filter(p => p.category_id === category.id) || [];
      
      // 3. Duplicate each product to the new category
      for (const product of categoryProducts) {
        const newProductData = {
          name: product.name,
          description: product.description || null,
          price: product.price,
          cost_price: product.cost_price || 0,
          category_id: newCategory.id,
          is_available: product.is_available ?? true,
          is_featured: product.is_featured ?? false,
          is_promotion: product.is_promotion ?? false,
          promotion_price: product.promotion_price || null,
          label: product.label || null,
          internal_code: product.internal_code || null,
          pdv_code: product.pdv_code || null,
          image_url: product.image_url,
          preparation_time: product.preparation_time || 15,
          sort_order: product.sort_order || 0,
          print_sector_id: product.print_sector_id || null,
        };
        const newProduct = await createProduct.mutateAsync(newProductData);
        
        // 4. Copy complement group links
        const { data: linkedGroups } = await supabase
          .from('product_complement_groups')
          .select('group_id, sort_order')
          .eq('product_id', product.id);
        
        if (linkedGroups?.length) {
          await setGroupsForProduct.mutateAsync({ 
            productId: newProduct.id, 
            groupIds: linkedGroups.map(g => g.group_id) 
          });
        }
      }
    } catch (error) {
      console.error('Error duplicating category:', error);
    }
  };

  const handleDuplicateGroup = async (group: ComplementGroup, addToProductList = false) => {
    try {
      // 1. Create new group with "(cópia)" suffix
      const newGroupData = {
        name: `${group.name} (cópia)`,
        description: group.description,
        selection_type: group.selection_type,
        is_required: group.is_required,
        min_selections: group.min_selections,
        max_selections: group.max_selections,
        visibility: group.visibility,
        channels: group.channels,
        sort_order: (complementGroups?.length ?? 0),
        is_active: group.is_active,
        price_calculation_type: group.price_calculation_type,
        applies_per_unit: group.applies_per_unit ?? false,
        unit_count: group.unit_count ?? 1,
        flavor_modal_enabled: group.flavor_modal_enabled ?? true,
        flavor_modal_channels: group.flavor_modal_channels ?? ['delivery', 'counter', 'table'],
        flavor_options: group.flavor_options ?? [{ count: 1, label: '1 Sabor', description: 'Pizza inteira de um sabor' }, { count: 2, label: '2 Sabores', description: 'Pizza metade/metade' }],
        applicable_flavor_counts: group.applicable_flavor_counts ?? [1, 2],
        kds_category: group.kds_category ?? 'complement',
      };
      const newGroup = await createGroup.mutateAsync(newGroupData);
      
      // 2. Get linked options from original group
      const { data: groupOptions } = await supabase
        .from('complement_group_options')
        .select('option_id')
        .eq('group_id', group.id)
        .order('sort_order');
      
      // 3. Link same options to new group
      if (groupOptions?.length) {
        await setGroupOptions.mutateAsync({ 
          groupId: newGroup.id, 
          options: groupOptions.map(o => ({ 
            option_id: o.option_id, 
            max_quantity: 1, 
            price_override: null 
          }))
        });
      }
      
      // 4. If duplicating from product dialog, add to selected groups
      if (addToProductList) {
        setProductLinkedGroupIds(prev => [...prev, newGroup.id]);
      }
    } catch (error) {
      console.error('Error duplicating group:', error);
    }
  };

  const handleSaveComplementGroup = async (
    groupData: Partial<ComplementGroup>, 
    optionConfigs: Array<{ option_id: string; max_quantity?: number; price_override?: number | null; sort_order?: number }>
  ) => {
    let groupId = editingGroup?.id;
    if (editingGroup) {
      await updateGroup.mutateAsync({ id: editingGroup.id, ...groupData } as any);
    } else {
      const result = await createGroup.mutateAsync(groupData as any);
      groupId = result.id;
    }
    if (groupId) {
      await setGroupOptions.mutateAsync({ groupId, options: optionConfigs });
    }
    setIsGroupDialogOpen(false);
    setEditingGroup(null);
    setGroupLinkedOptionIds([]);
    setGroupLinkedOptionConfigs([]);
    setGroupLinkedProductIds([]);
  };

  const handleSaveComplementOption = async (optionData: Partial<ComplementOption>) => {
    if (editingOption) {
      await updateOption.mutateAsync({ id: editingOption.id, ...optionData } as any);
    } else {
      await createOption.mutateAsync(optionData as any);
    }
    setIsOptionDialogOpen(false);
    setEditingOption(null);
    setOptionLinkedGroupIds([]);
  };

  const closeProductDialog = () => {
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    setProductDialogTab('info');
    setProductForm({
      name: '', description: '', price: 0, cost_price: 0, category_id: '', 
      is_available: true, is_featured: false, is_promotion: false, promotion_price: 0,
      label: 'none', internal_code: '', pdv_code: '', image_url: null, print_sector_id: null,
      unit_type: 'UN', adults_only: false, hide_observation_field: false, check_on_dispatch: false, available_for: ['delivery', 'counter', 'table'],
      dispatch_keywords: [], operational_type: 'cozinha'
    });
    setProductLinkedExtras([]);
    setProductLinkedGroupIds([]);
    setComplementGroupSearch('');
  };

  const openEditProduct = async (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      cost_price: product.cost_price || 0,
      category_id: product.category_id || '',
      is_available: product.is_available ?? true,
      is_featured: product.is_featured ?? false,
      is_promotion: product.is_promotion ?? false,
      promotion_price: product.promotion_price || 0,
      label: product.label || 'none',
      internal_code: product.internal_code || '',
      pdv_code: product.pdv_code || '',
      image_url: product.image_url,
      print_sector_id: product.print_sector_id || null,
      unit_type: product.unit_type || 'UN',
      adults_only: product.adults_only ?? false,
      hide_observation_field: product.hide_observation_field ?? false,
      check_on_dispatch: (product as any).check_on_dispatch ?? false,
      available_for: product.available_for || ['delivery', 'counter', 'table'],
      dispatch_keywords: product.dispatch_keywords || [],
      operational_type: product.operational_type || 'cozinha',
    });
    // Load linked groups
    const { data: linkedGroups } = await supabase
      .from('product_complement_groups')
      .select('group_id')
      .eq('product_id', product.id)
      .order('sort_order');
    setProductLinkedGroupIds(linkedGroups?.map(g => g.group_id) || []);
    setProductDialogTab('info');
    setIsProductDialogOpen(true);
  };

  const openEditCategory = (category: any) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      is_active: category.is_active ?? true
    });
    setIsCategoryDialogOpen(true);
  };

  const getGroupOptionCount = (groupId: string) => {
    return groupCounts[groupId]?.options || 0;
  };

  const getGroupProductCount = (groupId: string) => {
    return groupCounts[groupId]?.products || 0;
  };

  const getOptionGroupCount = (optionId: string) => {
    return optionGroupCounts[optionId] || 0;
  };

  const getProductVariations = (productId: string) => {
    return variations?.filter(v => v.product_id === productId) || [];
  };

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !categories) return;

    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    
    const reordered = arrayMove(categories, oldIndex, newIndex);
    const updates = reordered.map((category, index) => ({ id: category.id, sort_order: index }));
    updateCategorySortOrder.mutate(updates);
  };

  const handleProductDragStart = (event: DragStartEvent) => {
    setDraggedProductId(event.active.id as string);
  };

  const handleProductDragEnd = async (event: DragEndEvent) => {
    setDraggedProductId(null);
    const { active, over } = event;
    if (!over) return;
    
    const productId = active.id as string;
    const targetCategoryId = over.id as string;
    
    // Check if dropped on a category (not the same as current)
    const product = products?.find(p => p.id === productId);
    if (product && product.category_id !== targetCategoryId && categories?.find(c => c.id === targetCategoryId)) {
      await updateProduct.mutateAsync({ id: productId, category_id: targetCategoryId });
    }
  };

  // Droppable category component
  function DroppableCategory({ category, isActive }: { category: any; isActive: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: category.id });
    
    return (
      <div
        ref={setNodeRef}
        className={`p-3 rounded-lg border-2 transition-all ${
          isOver ? 'border-primary bg-primary/10' : 'border-transparent'
        } ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
      >
        <div className="flex items-center gap-2">
          <span>{category.icon || '📁'}</span>
          <span className="flex-1 truncate font-medium">{category.name}</span>
          <Badge variant="secondary" className="text-xs">
            {products?.filter(p => p.category_id === category.id).length || 0}
          </Badge>
        </div>
      </div>
    );
  }

  // Draggable product component
  function DraggableProductCard({ product }: { product: any }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: product.id });
    
    const style = {
      transform: CSS.Transform.toString(transform),
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Card 
        ref={setNodeRef} 
        style={style}
        className={`group overflow-hidden ${isDragging ? 'ring-2 ring-primary' : ''}`}
      >
        <div className="relative aspect-square bg-muted">
          {/* Drag Handle */}
          <div 
            className="absolute top-2 right-10 cursor-grab active:cursor-grabbing z-20 bg-background/80 backdrop-blur-sm rounded p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          <Badge 
            variant={product.is_available ? "default" : "secondary"}
            className="absolute top-2 left-2 text-xs"
          >
            {product.is_available ? 'ATIVO' : 'OCULTO'}
          </Badge>
          {product.is_featured && (
            <Badge variant="outline" className="absolute top-2 right-2 bg-background">
              <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
              Destaque
            </Badge>
          )}
          {product.is_promotion && (
            <Badge variant="destructive" className="absolute bottom-2 left-2">
              <Percent className="h-3 w-3 mr-1" />
              Promoção
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="secondary" 
                size="icon" 
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditProduct(product); }}>
                <Edit className="h-4 w-4 mr-2" />Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); updateProduct.mutate({ id: product.id, is_available: !product.is_available }); }}
              >
                {product.is_available ? (
                  <><EyeOff className="h-4 w-4 mr-2" />Ocultar</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" />Mostrar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); deleteProduct.mutate(product.id); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardContent className="p-3">
          <h3 className="font-medium truncate">{product.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {product.is_promotion && product.promotion_price ? (
              <>
                <span className="text-sm text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                <span className="font-semibold text-destructive">{formatCurrency(product.promotion_price)}</span>
              </>
            ) : (
              <span className="font-semibold">{formatCurrency(product.price)}</span>
            )}
          </div>
          {product.label && product.label !== 'none' && (
            <Badge variant="outline" className="mt-2 text-xs">
              {LABEL_OPTIONS.find(l => l.value === product.label)?.label || product.label}
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <PDVLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Cardápio</h1>
            <p className="text-muted-foreground text-sm">Gerencie produtos, complementos e opções</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                className="pl-10 w-64" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Importar Planilha
            </Button>
            {canReplicateMenu && (
              <Button variant="outline" onClick={() => setIsReplicateDialogOpen(true)}>
                <Building2 className="h-4 w-4 mr-2" />
                Replicar para outras lojas
              </Button>
            )}
            <Button onClick={() => setIsProductDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Produto
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="flex-1 flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="categories">CATEGORIAS</TabsTrigger>
            <TabsTrigger value="products">PRODUTOS</TabsTrigger>
            
            <TabsTrigger value="extras">COMPLEMENTOS</TabsTrigger>
            <TabsTrigger value="variations">OPÇÕES</TabsTrigger>
            <TabsTrigger value="integration"><Link2 className="h-3.5 w-3.5 mr-1" />INTEGRAÇÃO</TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="flex-1 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Categorias</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Organize suas categorias de produtos. Arraste para reordenar.
                  </p>
                </div>
                <Button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', icon: '', is_active: true }); setIsCategoryDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Nova Categoria
                </Button>
              </CardHeader>
              <CardContent>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                  <SortableContext items={categories?.map(c => c.id) || []} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {categories?.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map((category) => (
                        <SortableItem key={category.id} id={category.id}>
                          <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                            <span className="text-2xl">{category.icon || '📁'}</span>
                            <div className="flex-1">
                              <h3 className="font-medium">{category.name}</h3>
                              {category.description && (
                                <p className="text-sm text-muted-foreground">{category.description}</p>
                              )}
                            </div>
                            <Badge variant="secondary">
                              {products?.filter(p => p.category_id === category.id).length || 0} produtos
                            </Badge>
                            <Badge variant={category.is_active ? 'default' : 'secondary'}>
                              {category.is_active ? 'Ativa' : 'Inativa'}
                            </Badge>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditCategory(category)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDuplicateCategory(category)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => deleteCategory.mutate(category.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </SortableItem>
                      ))}
                      {!categories?.length && (
                        <div className="text-center py-12 text-muted-foreground">
                          Nenhuma categoria cadastrada
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="flex-1 mt-4">
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter}
              onDragStart={handleProductDragStart}
              onDragEnd={handleProductDragEnd}
            >
              <div className="flex gap-4 h-full">
                {/* Category Sidebar - Drop zones */}
                <Card className="w-64 shrink-0">
                  <CardHeader className="p-3 border-b">
                    <CardTitle className="text-sm font-medium">CATEGORIAS</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Arraste produtos para mover
                    </p>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[calc(100vh-400px)]">
                      <div className="space-y-2">
                        {categories?.map((category) => (
                          <div
                            key={category.id}
                            onClick={() => setSelectedCategoryId(category.id)}
                            className="cursor-pointer"
                          >
                            <DroppableCategory 
                              category={category} 
                              isActive={selectedCategoryId === category.id}
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Products Grid */}
                <div className="flex-1">
                  {/* Filters Bar */}
                  <div className="mb-4 flex items-center gap-3 flex-wrap">
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="inactive">Inativos</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterPromotion} onValueChange={(v) => setFilterPromotion(v as any)}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Promoção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="yes">Em Promoção</SelectItem>
                        <SelectItem value="no">Sem Promoção</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterFeatured} onValueChange={(v) => setFilterFeatured(v as any)}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Destaque" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="yes">Em Destaque</SelectItem>
                        <SelectItem value="no">Sem Destaque</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Limpar filtros
                      </Button>
                    )}
                    
                    <div className="ml-auto text-sm text-muted-foreground">
                      {selectedCategory?.name}: {filteredProducts?.length || 0} produto(s)
                    </div>
                  </div>

                  <ScrollArea className="h-[calc(100vh-350px)]">
                    <SortableContext items={filteredProducts?.map(p => p.id) || []} strategy={verticalListSortingStrategy}>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredProducts?.map((product) => (
                          <DraggableProductCard key={product.id} product={product} />
                        ))}
                        {!filteredProducts?.length && (
                          <div className="col-span-full text-center py-12 text-muted-foreground">
                            Nenhum produto encontrado
                          </div>
                        )}
                      </div>
                    </SortableContext>
                  </ScrollArea>
                </div>
              </div>
              
              {/* Drag Overlay */}
              <DragOverlay>
                {draggedProduct && (
                  <Card className="w-40 opacity-90 shadow-lg">
                    <div className="aspect-square bg-muted">
                      {draggedProduct.image_url ? (
                        <img src={draggedProduct.image_url} alt={draggedProduct.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-2">
                      <p className="font-medium text-sm truncate">{draggedProduct.name}</p>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          </TabsContent>


          {/* Complement Groups Tab */}
          <TabsContent value="extras" className="flex-1 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Grupos de Complementos</CardTitle>
                <Button onClick={() => { setEditingGroup(null); setGroupLinkedOptionIds([]); setGroupLinkedOptionConfigs([]); setGroupLinkedProductIds([]); setIsGroupDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Novo Grupo
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo de Seleção</TableHead>
                      <TableHead>Obrigatório</TableHead>
                      <TableHead>Opções</TableHead>
                      <TableHead>Produtos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complementGroups?.filter(g => g.name.toLowerCase().includes(search.toLowerCase())).map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {group.selection_type === 'single' ? 'Apenas uma' : 
                             group.selection_type === 'multiple' ? 'Múltiplas' : 'Com repetição'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {group.is_required ? (
                            <Badge variant="destructive">Obrigatório</Badge>
                          ) : (
                            <span className="text-muted-foreground">Opcional</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getGroupOptionCount(group.id)} opção(ões)</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getGroupProductCount(group.id)} produto(s)</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={group.is_active ? "default" : "secondary"}>
                            {group.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={async () => { 
                                setEditingGroup(group);
                                // Carregar opções vinculadas ao grupo com configs
                                const { data: groupOptions } = await supabase
                                  .from('complement_group_options')
                                  .select('option_id, max_quantity, price_override')
                                  .eq('group_id', group.id)
                                  .order('sort_order');
                                // Carregar produtos vinculados ao grupo
                                const { data: groupProducts } = await supabase
                                  .from('product_complement_groups')
                                  .select('product_id')
                                  .eq('group_id', group.id);
                                setGroupLinkedOptionIds(groupOptions?.map(o => o.option_id) || []);
                                setGroupLinkedOptionConfigs(groupOptions?.map(o => ({ 
                                  option_id: o.option_id, 
                                  max_quantity: o.max_quantity, 
                                  price_override: o.price_override 
                                })) || []);
                                setGroupLinkedProductIds(groupProducts?.map(p => p.product_id) || []);
                                setIsGroupDialogOpen(true); 
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDuplicateGroup(group)}
                              title="Duplicar grupo"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive" 
                              onClick={() => deleteGroup.mutate(group.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!complementGroups?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum grupo de complemento cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Complement Options Tab */}
          <TabsContent value="variations" className="flex-1 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                {optionSelectionMode ? (
                  <>
                    <CardTitle className="text-base">{selectedOptionIds.size} selecionado(s)</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        const filtered = complementOptions?.filter(o => {
                          if (!o.name.toLowerCase().includes(search.toLowerCase())) return false;
                          const linkCount = getOptionGroupCount(o.id);
                          if (optionLinkFilter === 'linked') return linkCount > 0;
                          if (optionLinkFilter === 'unlinked') return linkCount === 0;
                          return true;
                        }) || [];
                        setSelectedOptionIds(new Set(filtered.map(o => o.id)));
                      }}>Selecionar todos</Button>
                      <Button variant="destructive" size="sm" disabled={selectedOptionIds.size === 0} onClick={() => setShowBulkDeleteConfirm(true)}>
                        <Trash2 className="h-4 w-4 mr-1" />Excluir ({selectedOptionIds.size})
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setOptionSelectionMode(false); setSelectedOptionIds(new Set()); }}>
                        <X className="h-4 w-4 mr-1" />Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <CardTitle>Opções de Complementos</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setOptionSelectionMode(true)}>
                        <CheckSquare className="h-4 w-4 mr-1" />Selecionar
                      </Button>
                      <Select value={optionLinkFilter} onValueChange={(v) => setOptionLinkFilter(v as any)}>
                        <SelectTrigger className="w-[160px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="linked">Com vínculo</SelectItem>
                          <SelectItem value="unlinked">Sem vínculo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={() => { setEditingOption(null); setOptionLinkedGroupIds([]); setOptionLinkedGroupProducts({}); setIsOptionDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />Nova Opção
                      </Button>
                    </div>
                  </>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {complementOptions?.filter(o => {
                    if (!o.name.toLowerCase().includes(search.toLowerCase())) return false;
                    const linkCount = getOptionGroupCount(o.id);
                    if (optionLinkFilter === 'linked') return linkCount > 0;
                    if (optionLinkFilter === 'unlinked') return linkCount === 0;
                    return true;
                  }).map((option) => (
                    <Card 
                      key={option.id} 
                      className={`group overflow-hidden cursor-pointer ${optionSelectionMode && selectedOptionIds.has(option.id) ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => {
                        if (optionSelectionMode) {
                          setSelectedOptionIds(prev => {
                            const next = new Set(prev);
                            if (next.has(option.id)) next.delete(option.id); else next.add(option.id);
                            return next;
                          });
                        }
                      }}
                    >
                      <div className="relative h-24 bg-muted">
                        {option.image_url ? (
                          <img src={option.image_url} alt={option.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                        {optionSelectionMode ? (
                          <div className="absolute top-2 right-2">
                            <Checkbox checked={selectedOptionIds.has(option.id)} />
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="secondary" 
                                size="icon" 
                                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={async () => {
                                const { data: links } = await supabase.from('complement_group_options').select('group_id').eq('option_id', option.id);
                                const groupIds = [...new Set(links?.map(l => l.group_id) || [])];
                                setOptionLinkedGroupIds(groupIds);
                                if (groupIds.length > 0) {
                                  const { data: gp } = await supabase.from('product_complement_groups').select('group_id, product_id, product:products(name, category:categories(name))').in('group_id', groupIds);
                                  const map: Record<string, Array<{ id: string; name: string; category_name?: string }>> = {};
                                  gp?.forEach((row: any) => {
                                    if (!map[row.group_id]) map[row.group_id] = [];
                                    map[row.group_id].push({ id: row.product_id, name: row.product?.name, category_name: row.product?.category?.name });
                                  });
                                  setOptionLinkedGroupProducts(map);
                                } else {
                                  setOptionLinkedGroupProducts({});
                                }
                                setEditingOption(option); setIsOptionDialogOpen(true);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteOption.mutate(option.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <Badge 
                          variant={option.is_active ? "default" : "secondary"}
                          className="absolute top-2 left-2 text-xs"
                        >
                          {option.is_active ? 'ATIVO' : 'INATIVO'}
                        </Badge>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium truncate">{option.name}</h3>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-semibold">{formatCurrency(option.price)}</span>
                          {option.cost_price && option.cost_price > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Custo: {formatCurrency(option.cost_price)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getOptionGroupCount(option.id)} grupo(s)
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {!complementOptions?.length && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      Nenhuma opção cadastrada
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integration Codes Tab */}
          <TabsContent value="integration" className="flex-1 mt-4">
            <Card className="h-[calc(100vh-220px)]">
              <CardHeader>
                <CardTitle>Códigos de Integração</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gerencie os códigos de integração do Cardápio Web e iFood para cada opção de complemento.
                </p>
              </CardHeader>
              <CardContent className="h-[calc(100%-100px)]">
                <IntegrationCodesPanel />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Product Dialog with 3 Tabs */}
        <Dialog open={isProductDialogOpen} onOpenChange={(open) => { if (!open) closeProductDialog(); else setIsProductDialogOpen(true); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar' : 'Novo'} Produto</DialogTitle>
            </DialogHeader>
            <Tabs value={productDialogTab} onValueChange={setProductDialogTab}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="info">INFORMAÇÕES</TabsTrigger>
                <TabsTrigger value="complements">COMPLEMENTOS</TabsTrigger>
                <TabsTrigger value="availability">DISPONIBILIDADE</TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="flex gap-4">
                  <ImageUpload 
                    value={productForm.image_url} 
                    onChange={(url) => setProductForm({...productForm, image_url: url})}
                    folder="products"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label>Nome do Produto *</Label>
                      <Input 
                        placeholder="Ex: Pizza Marguerita" 
                        value={productForm.name} 
                        onChange={(e) => setProductForm({...productForm, name: e.target.value})} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Categoria</Label>
                        <Select value={productForm.category_id} onValueChange={(v) => setProductForm({...productForm, category_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Etiqueta</Label>
                        <Select value={productForm.label} onValueChange={(v) => setProductForm({...productForm, label: v})}>
                          <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                          <SelectContent>
                            {LABEL_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={productForm.is_featured} 
                      onCheckedChange={(checked) => setProductForm({...productForm, is_featured: checked})} 
                    />
                    <Label>Em destaque</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={productForm.is_available} 
                      onCheckedChange={(checked) => setProductForm({...productForm, is_available: checked})} 
                    />
                    <Label>Disponível</Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Preço de Venda *</Label>
                    <CurrencyInput 
                      placeholder="0,00"
                      value={productForm.price} 
                      onChange={(val) => setProductForm({...productForm, price: val})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Preço de Custo</Label>
                    <CurrencyInput 
                      placeholder="0,00"
                      value={productForm.cost_price} 
                      onChange={(val) => setProductForm({...productForm, cost_price: val})} 
                    />
                  </div>
                </div>

                <div className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={productForm.is_promotion} 
                      onCheckedChange={(checked) => setProductForm({...productForm, is_promotion: checked})} 
                    />
                    <Label>Ativar promoção</Label>
                  </div>
                  {productForm.is_promotion && (
                    <div className="space-y-1">
                      <Label>Preço Promocional</Label>
                      <CurrencyInput 
                        placeholder="0,00"
                        value={productForm.promotion_price} 
                        onChange={(val) => setProductForm({...productForm, promotion_price: val})} 
                      />
                      {productForm.price > 0 && productForm.promotion_price > 0 && (
                        <p className="text-xs text-green-600">
                          Desconto de {((1 - productForm.promotion_price / productForm.price) * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Textarea 
                    placeholder="Descreva o produto..." 
                    value={productForm.description} 
                    onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Código Interno</Label>
                    <Input 
                      placeholder="Ex: PIZ001" 
                      value={productForm.internal_code} 
                      onChange={(e) => setProductForm({...productForm, internal_code: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Código PDV</Label>
                    <Input 
                      placeholder="Ex: 12345" 
                      value={productForm.pdv_code} 
                      onChange={(e) => setProductForm({...productForm, pdv_code: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    Setor de Impressão
                  </Label>
                  <Select 
                    value={productForm.print_sector_id || 'none'} 
                    onValueChange={(v) => setProductForm({...productForm, print_sector_id: v === 'none' ? null : v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (usa impressora padrão)</SelectItem>
                      {printSectors?.filter(s => s.is_active !== false).map(sector => (
                        <SelectItem key={sector.id} value={sector.id}>
                          <span className="flex items-center gap-2">
                            <span style={{ color: sector.color || '#EF4444' }}>●</span>
                            {sector.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define em qual impressora este produto será impresso
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Tipo Operacional</Label>
                  <Select value={productForm.operational_type} onValueChange={(v) => setProductForm({...productForm, operational_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cozinha">Cozinha</SelectItem>
                      <SelectItem value="bebida">Bebida</SelectItem>
                      <SelectItem value="sobremesa">Sobremesa</SelectItem>
                      <SelectItem value="acompanhamento">Acompanhamento</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define em qual praça do KDS este produto será exibido
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Unidade de Medida</Label>
                  <Select value={productForm.unit_type} onValueChange={(v) => setProductForm({...productForm, unit_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UN">Unidade (UN)</SelectItem>
                      <SelectItem value="KG">Quilograma (KG)</SelectItem>
                      <SelectItem value="L">Litro (L)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Canais de Disponibilidade</Label>
                  <div className="flex flex-wrap gap-3 p-3 border rounded-lg">
                    {[
                      { value: 'delivery', label: 'Delivery' },
                      { value: 'counter', label: 'Balcão' },
                      { value: 'table', label: 'Mesa' },
                    ].map(ch => (
                      <div key={ch.value} className="flex items-center gap-2">
                        <Switch
                          checked={productForm.available_for.includes(ch.value)}
                          onCheckedChange={(checked) => {
                            setProductForm(prev => ({
                              ...prev,
                              available_for: checked
                                ? [...prev.available_for, ch.value]
                                : prev.available_for.filter(c => c !== ch.value)
                            }));
                          }}
                        />
                        <Label className="text-sm">{ch.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={productForm.adults_only}
                      onCheckedChange={(checked) => setProductForm({...productForm, adults_only: checked})}
                    />
                    <Label>+18 (Apenas adultos)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={productForm.hide_observation_field}
                      onCheckedChange={(checked) => setProductForm({...productForm, hide_observation_field: checked})}
                    />
                    <Label>Ocultar observações</Label>
                  </div>
                </div>

                {/* Conferir no despacho */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                  <Switch
                    checked={productForm.check_on_dispatch}
                    onCheckedChange={(checked) => setProductForm({...productForm, check_on_dispatch: checked})}
                  />
                  <div>
                    <Label className="font-medium flex items-center gap-1.5 cursor-pointer">
                      <PackageCheck className="h-4 w-4 text-amber-600" />
                      Conferir no despacho
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Exige confirmação do funcionário ao despachar pedidos com este produto
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Complements Tab */}
              <TabsContent value="complements" className="space-y-4 pt-4">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Grupos de Complementos</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione e ordene os grupos de complementos disponíveis para este produto
                  </p>
                  
                  {/* Selected groups with drag-and-drop */}
                  {productLinkedGroupIds.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <Label className="text-sm">Grupos selecionados (arraste para reordenar)</Label>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                          const { active, over } = event;
                          if (over && active.id !== over.id) {
                            setProductLinkedGroupIds(prev => {
                              const oldIndex = prev.indexOf(active.id as string);
                              const newIndex = prev.indexOf(over.id as string);
                              return arrayMove(prev, oldIndex, newIndex);
                            });
                          }
                        }}
                      >
                        <SortableContext items={productLinkedGroupIds} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {productLinkedGroupIds.map((groupId) => {
                              const group = complementGroups?.find(g => g.id === groupId);
                              if (!group) return null;
                              return (
                                <SortableItem key={group.id} id={group.id}>
                                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                    <div className="flex-1">
                                      <p className="font-medium">{group.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {group.selection_type === 'single' ? 'Apenas uma' : 
                                         group.selection_type === 'multiple' ? 'Múltiplas' : 'Com repetição'}
                                        {group.is_required && ' • Obrigatório'}
                                        {' • '}{getGroupOptionCount(group.id)} opção(ões)
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                      title="Editar grupo"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setEditingGroup(group);
                                        // Carregar opções vinculadas ao grupo com configs
                                        const { data: groupOptions } = await supabase
                                          .from('complement_group_options')
                                          .select('option_id, max_quantity, price_override')
                                          .eq('group_id', group.id)
                                          .order('sort_order');
                                        setGroupLinkedOptionIds(groupOptions?.map(o => o.option_id) || []);
                                        setGroupLinkedOptionConfigs(groupOptions?.map(o => ({ 
                                          option_id: o.option_id, 
                                          max_quantity: o.max_quantity, 
                                          price_override: o.price_override 
                                        })) || []);
                                        setIsGroupDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                      title="Duplicar grupo"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateGroup(group, true);
                                      }}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProductLinkedGroupIds(prev => prev.filter(id => id !== group.id));
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </SortableItem>
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                  
                  {/* Available groups to add */}
                  <Label className="text-sm">Adicionar grupos</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar grupo de complemento..."
                      value={complementGroupSearch}
                      onChange={(e) => setComplementGroupSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <ScrollArea className="h-48 border rounded-lg p-3">
                    <div className="space-y-2">
                      {complementGroups?.filter(g => !productLinkedGroupIds.includes(g.id) && g.name.toLowerCase().includes(complementGroupSearch.toLowerCase())).map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                          onClick={() => {
                            setProductLinkedGroupIds(prev => [...prev, group.id]);
                          }}
                        >
                          <Plus className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{group.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.selection_type === 'single' ? 'Apenas uma' : 
                               group.selection_type === 'multiple' ? 'Múltiplas' : 'Com repetição'}
                              {group.is_required && ' • Obrigatório'}
                              {' • '}{getGroupOptionCount(group.id)} opção(ões)
                            </p>
                          </div>
                          <Badge variant={group.is_active ? 'default' : 'secondary'}>
                            {group.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      ))}
                      {complementGroups?.filter(g => !productLinkedGroupIds.includes(g.id)).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {complementGroups?.length 
                            ? 'Todos os grupos já foram adicionados'
                            : 'Nenhum grupo de complemento cadastrado. Crie grupos na aba "COMPLEMENTOS".'}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                  {productLinkedGroupIds.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {productLinkedGroupIds.length} grupo(s) selecionado(s)
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Availability Tab */}
              <TabsContent value="availability" className="space-y-4 pt-4">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Configuração de disponibilidade por horário em breve.</p>
                  <p className="text-sm mt-2">Por enquanto, use o toggle "Disponível" na aba Informações.</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={closeProductDialog}>Cancelar</Button>
              <Button onClick={handleSaveProduct} disabled={!productForm.name}>Salvar Produto</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => { setIsCategoryDialogOpen(open); if (!open) { setEditingCategory(null); setCategoryForm({ name: '', description: '', icon: '', is_active: true }); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingCategory ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input placeholder="Ex: Pizzas" value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Ícone</Label>
                  <Input placeholder="🍕" value={categoryForm.icon} onChange={(e) => setCategoryForm({...categoryForm, icon: e.target.value})} className="text-center text-lg" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea 
                  placeholder="Ex: Pizzas artesanais assadas em forno a lenha" 
                  value={categoryForm.description} 
                  onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={categoryForm.is_active} onCheckedChange={(checked) => setCategoryForm({...categoryForm, is_active: checked})} />
                <Label>Categoria ativa</Label>
              </div>
              <Button onClick={handleSaveCategory} className="w-full" disabled={!categoryForm.name}>
                {editingCategory ? 'Atualizar' : 'Criar'} Categoria
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Complement Group Dialog */}
        <ComplementGroupDialog
          open={isGroupDialogOpen}
          onOpenChange={setIsGroupDialogOpen}
          group={editingGroup}
          options={complementOptions || []}
          linkedOptionIds={groupLinkedOptionIds}
          linkedOptionConfigs={groupLinkedOptionConfigs}
          linkedProducts={groupLinkedProductIds.map(pid => {
            const p = products?.find(pr => pr.id === pid);
            return { id: pid, name: p?.name || 'Produto', category_name: p?.category?.name };
          })}
          onSave={handleSaveComplementGroup}
          onCreateOption={async (optionData) => {
            const result = await createOption.mutateAsync(optionData as any);
            return result as any;
          }}
          onEditOption={async (option) => {
            const { data: links } = await supabase.from('complement_group_options').select('group_id').eq('option_id', option.id);
            const groupIds = [...new Set(links?.map(l => l.group_id) || [])];
            setOptionLinkedGroupIds(groupIds);
            if (groupIds.length > 0) {
              const { data: gp } = await supabase.from('product_complement_groups').select('group_id, product_id, product:products(name, category:categories(name))').in('group_id', groupIds);
              const map: Record<string, Array<{ id: string; name: string; category_name?: string }>> = {};
              gp?.forEach((row: any) => {
                if (!map[row.group_id]) map[row.group_id] = [];
                map[row.group_id].push({ id: row.product_id, name: row.product?.name, category_name: row.product?.category?.name });
              });
              setOptionLinkedGroupProducts(map);
            } else {
              setOptionLinkedGroupProducts({});
            }
            setEditingOption(option);
            setIsOptionDialogOpen(true);
          }}
          onToggleOptionActive={async (optionId, active) => {
            await updateOption.mutateAsync({ id: optionId, is_active: active });
          }}
          isEditing={!!editingGroup}
        />

        {/* Complement Option Dialog */}
        <ComplementOptionDialog
          open={isOptionDialogOpen}
          onOpenChange={setIsOptionDialogOpen}
          option={editingOption}
          linkedGroups={optionLinkedGroupIds.map(gid => {
            const g = complementGroups?.find(gr => gr.id === gid);
            return { id: gid, name: g?.name || 'Grupo', products: optionLinkedGroupProducts[gid] || [] };
          })}
          onSave={handleSaveComplementOption}
          isEditing={!!editingOption}
        />

        {/* Replicate Menu Dialog */}
        <ReplicateMenuDialog
          open={isReplicateDialogOpen}
          onOpenChange={setIsReplicateDialogOpen}
        />

        {/* Import Menu Dialog */}
        <ImportMenuDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
        />

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selectedOptionIds.size} opções?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todas as opções selecionadas serão removidas permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isBulkDeleting}
                onClick={async () => {
                  setIsBulkDeleting(true);
                  try {
                    const { error } = await supabase
                      .from('complement_options')
                      .delete()
                      .in('id', Array.from(selectedOptionIds));
                    if (error) throw error;
                    toast({ title: `${selectedOptionIds.size} opções excluídas com sucesso` });
                    setSelectedOptionIds(new Set());
                    setOptionSelectionMode(false);
                    setShowBulkDeleteConfirm(false);
                    // Invalidate queries
                    queryClient.invalidateQueries({ queryKey: ['complement-options'] });
                  } catch (err: any) {
                    toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
                  } finally {
                    setIsBulkDeleting(false);
                  }
                }}
              >
                {isBulkDeleting ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PDVLayout>
  );
}
