import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useProductVariations } from '@/hooks/useProductVariations';
import { useOrders, useOrderMutations, Order } from '@/hooks/useOrders';
import { useCentralizedPrinting } from '@/hooks/useCentralizedPrinting';
import { useToast } from '@/hooks/use-toast';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { useSearchCustomers, useCustomerMutations, Customer } from '@/hooks/useCustomers';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOpenCashRegister, useCashRegisterMutations, PaymentMethod } from '@/hooks/useCashRegister';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { ProductDetailDialog, SelectedComplement, SubItemComplement } from '@/components/order/ProductDetailDialog';
import { PizzaConfig } from '@/components/order/ProductDetailDialog';
import { CancelOrderDialog } from '@/components/order/CancelOrderDialog';
import { useBusinessRules } from '@/hooks/useBusinessRules';
import { useRequestApproval, ApprovalRequest } from '@/hooks/useApprovalRequest';
import { ApprovalWaitingDialog } from '@/components/ApprovalWaitingDialog';
import { printCustomerReceipt } from '@/components/receipt/CustomerReceipt';
import { usePrinterOptional, SectorPrintItem } from '@/contexts/PrinterContext';
import { KitchenTicketData, CancellationTicketData } from '@/utils/escpos';
import { buildPrintExtras } from '@/lib/printSubItems';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { calculateFullComplementsPrice, ComplementForCalc, SubItemForCalc } from '@/lib/complementPriceUtils';
import { usePizzaProducts } from '@/hooks/usePizzaProducts';
import { fetchDispatchChecklist } from '@/hooks/useDispatchChecklist';
import { DispatchChecklistDialog } from '@/components/dispatch/DispatchChecklistDialog';
import { 
  Package, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  ChevronDown, 
  ChevronUp,
  MessageSquare,
  MessageCircle,
  X,
  Minus as MinimizeIcon,
  Gift,
  Menu,
  Phone,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Tag,
  Percent,
  UserPlus,
  Banknote,
  CreditCard,
  QrCode,
  Printer,
  History,
  ChevronRight,
  XCircle,
  Store,
  Truck,
  Clock,
  ChefHat,
  PackageCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '');
  const limited = numbers.slice(0, 11);
  
  if (limited.length <= 2) {
    return limited.length ? `(${limited}` : '';
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  } else if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  } else {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
  }
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  variation_id?: string | null;
  variation_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  combo_name?: string;
  complements?: SelectedComplement[];
  print_sector_id?: string | null;
  subItems?: SubItemComplement[];
}

type OrderType = 'takeaway' | 'delivery';

export default function Counter() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const queryClient = useQueryClient();
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: variations } = useProductVariations();
  const { data: allOrders = [] } = useOrders();
  const { createOrder, updateOrder, addOrderItem, addOrderItemExtras, addOrderItemSubItems, addOrderItemsBatch } = useOrderMutations();
  const { toast } = useToast();
  const { duplicateItems, duplicateItemsMaxQty, autoPrintKitchenTicket, autoPrintCustomerReceipt, duplicateKitchenTicket } = useOrderSettings();
  const { getInitialOrderStatus, settings: kdsSettings } = useKdsSettings();
  const centralPrint = useCentralizedPrinting();
  const printer = usePrinterOptional();
  const { data: printSectors } = usePrintSectors();
  const { profile } = useProfile();
  const { findOrCreateCustomer, updateCustomerStats } = useCustomerMutations();
  const { data: openCashRegister } = useOpenCashRegister();
  const { createPayment } = useCashRegisterMutations();
  const isMobile = useIsMobile();
  const { data: pizzaData, isLoading: pizzaDataLoading } = usePizzaProducts();
  const pendingProductRef = useRef<any>(null);
  const { rules: businessRules, isDiscountAboveLimit, getDiscountLimitForCurrentUser } = useBusinessRules();
  const { createRequest: createApprovalRequest, watchRequest } = useRequestApproval();
  
  const canAddItems = hasPermission('counter_add_items');
  const canApplyDiscount = hasPermission('counter_apply_discount');
  const canProcessPayment = hasPermission('counter_process_payment');
  const canCancelOrder = hasPermission('orders_cancel');

  // State hooks - must be before conditional return
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // ProductDetailDialog state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);

  // Pizza config for the selected product
  
  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  const { data: searchedCustomers } = useSearchCustomers(customerSearch);
  
  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState(10);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  // Discount approval state
  const [discountApprovalRequest, setDiscountApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [waitingDiscountApproval, setWaitingDiscountApproval] = useState(false);
  const [pendingPrintReceipt, setPendingPrintReceipt] = useState(false);
  const discountApprovedRef = useRef(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const { data: watchedDiscountRequest } = watchRequest(discountApprovalRequest?.id ?? null);
  
  // Cancel order state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [activeOrdersOpen, setActiveOrdersOpen] = useState(false);
  const [dispatchChecklistOpen, setDispatchChecklistOpen] = useState(false);
  const [dispatchChecklistItems, setDispatchChecklistItems] = useState<import('@/hooks/useDispatchChecklist').ChecklistItem[]>([]);
  const [pendingDeliverOrder, setPendingDeliverOrder] = useState<Order | null>(null);
  const [pagerNumber, setPagerNumber] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if tablet (768px-1280px, matching PDVLayout's xl breakpoint)
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 768 && width < 1280);
    };
    
    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, []);

  // Filter active takeaway/delivery orders from today
  const todayActiveOrders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return allOrders.filter(order => 
      (order.order_type === 'takeaway' || order.order_type === 'delivery') &&
      order.status !== 'delivered' && 
      order.status !== 'cancelled' &&
      order.created_at?.startsWith(today)
    );
  }, [allOrders]);

  // Auto-collapse sidebar on tablet
  useEffect(() => {
    if (isTablet) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isTablet]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCategories = categories?.filter(c => c.is_active !== false) || [];
  const activeProducts = products?.filter(p => p.is_available !== false) || [];

  // Auto-select first category when categories are loaded
  useEffect(() => {
    if (activeCategories.length > 0 && selectedCategory === null) {
      setSelectedCategory(activeCategories[0].id);
    }
  }, [activeCategories, selectedCategory]);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    let filtered = activeProducts;
    
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.pdv_code?.toLowerCase().includes(query) ||
        p.internal_code?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [activeProducts, selectedCategory, searchQuery]);

  const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);

  // Payment calculations
  const discountAmount = useMemo(() => {
    if (discountValue <= 0) return 0;
    return discountType === 'percentage' 
      ? (subtotal * discountValue / 100)
      : discountValue;
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  
  const serviceAmount = serviceChargeEnabled 
    ? (afterDiscount * serviceChargePercent / 100)
    : 0;

  const finalTotal = afterDiscount + serviceAmount;

  // For non-cash payments, amount equals total (no change/troco needed)
  const paymentAmountNum = selectedPaymentMethod === 'cash' 
    ? (parseFloat(paymentAmount) || 0)
    : finalTotal;
  const changeAmount = Math.max(0, paymentAmountNum - finalTotal);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Process pending product click once pizzaData loads
  useEffect(() => {
    if (!pizzaDataLoading && pendingProductRef.current) {
      const product = pendingProductRef.current;
      pendingProductRef.current = null;
      processProductClick(product);
    }
  }, [pizzaDataLoading]);

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('counter_view')) {
    return <AccessDenied permission="counter_view" />;
  }

  // Handle customer search input
  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setCustomerName(value);
    setShowCustomerDropdown(true);
    setSelectedCustomer(null);
  };

  // Handle customer selection
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setCustomerAddress(customer.address || '');
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const processProductClick = (product: any) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  // Handle product click
  const handleProductClick = (product: any) => {
    if (pizzaDataLoading) {
      pendingProductRef.current = product;
      setSelectedProduct(product);
      return;
    }
    processProductClick(product);
  };

  // Build pizza config for the selected product (not a hook, just a derived value)
  const selectedPizzaConfig = (() => {
    if (!selectedProduct || !pizzaData) return undefined;
    const config = pizzaData.configMap.get(selectedProduct.id);
    const currentChannel = orderType === 'delivery' ? 'delivery' : 'counter';
    if (!config || !config.flavorModalEnabled || !config.flavorModalChannels.includes(currentChannel)) return undefined;
    return {
      flavorOptions: config.flavorOptions,
      maxFlavors: pizzaData.maxFlavorsMap.get(selectedProduct.id) ?? 2,
    };
  })();

  // Handle add from ProductDetailDialog
  const handleAddFromDialog = (
    product: any, 
    quantity: number, 
    complements: SelectedComplement[], 
    itemNotes: string,
    subItems?: SubItemComplement[]
  ) => {
    // Build group price types map from complements
    const groupPriceTypes: Record<string, 'sum' | 'average' | 'highest' | 'lowest'> = {};
    for (const c of complements) {
      if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
        groupPriceTypes[c.group_id] = c.price_calculation_type;
      }
    }
    // Also get price types from subItems
    if (subItems) {
      for (const subItem of subItems) {
        for (const c of subItem.complements) {
          if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
            groupPriceTypes[c.group_id] = c.price_calculation_type;
          }
        }
      }
    }

    // Convert to calc format
    const sharedComplements: ComplementForCalc[] = complements.map(c => ({
      group_id: c.group_id,
      price: c.price,
      quantity: c.quantity,
    }));
    const subItemsForCalc: SubItemForCalc[] | undefined = subItems?.map(si => ({
      complements: si.complements.map(c => ({
        group_id: c.group_id,
        price: c.price,
        quantity: c.quantity,
      })),
    }));

    // Calculate complements total using price_calculation_type
    const complementsTotal = calculateFullComplementsPrice(sharedComplements, subItemsForCalc, groupPriceTypes);
    
    const productPrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price 
      : product.price;
    const unitPrice = productPrice + complementsTotal;

    if (duplicateItems && quantity > 1 && (duplicateItemsMaxQty <= 0 || quantity <= duplicateItemsMaxQty)) {
      // Create separate items
      for (let i = 0; i < quantity; i++) {
        setOrderItems(prev => [...prev, {
          id: `${product.id}-${Date.now()}-${i}`,
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: unitPrice,
          total_price: unitPrice,
          notes: itemNotes || undefined,
          complements,
          print_sector_id: product.print_sector_id,
          subItems,
        }]);
      }
    } else {
      setOrderItems(prev => [...prev, {
        id: `${product.id}-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        notes: itemNotes || undefined,
        complements,
        print_sector_id: product.print_sector_id,
        subItems,
      }]);
    }
  };

  const addProduct = (product: any, variation?: any) => {
    const itemId = `${product.id}-${variation?.id || 'base'}-${Date.now()}`;
    const unitPrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price + (variation?.price_modifier ?? 0)
      : product.price + (variation?.price_modifier ?? 0);
    
    setOrderItems(prev => [...prev, {
      id: itemId,
      product_id: product.id,
      product_name: product.name,
      variation_id: variation?.id || null,
      variation_name: variation?.name,
      quantity: 1,
      unit_price: unitPrice,
      total_price: unitPrice,
    }]);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty, total_price: item.unit_price * newQty };
    }));
  };

  const duplicateItem = (itemId: string) => {
    setOrderItems(prev => {
      const itemToDuplicate = prev.find(item => item.id === itemId);
      if (!itemToDuplicate) return prev;
      
      const newItem: OrderItem = {
        ...itemToDuplicate,
        id: `${itemToDuplicate.product_id}-${Date.now()}`,
        quantity: 1,
        total_price: itemToDuplicate.unit_price,
      };
      
      return [...prev, newItem];
    });
  };

  const removeItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const clearOrder = () => {
    setOrderItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerSearch('');
    setSelectedCustomer(null);
    setNotes('');
    setPagerNumber('');
  };

  const resetPaymentModal = () => {
    setPaymentModalOpen(false);
    setSelectedPaymentMethod('cash');
    setPaymentAmount('');
    setDiscountType('percentage');
    setDiscountValue(0);
    setServiceChargeEnabled(false);
    setServiceChargePercent(10);
    setCreatedOrder(null);
  };

  const handleCancelOrder = async (reason: string) => {
    if (!orderToCancel) return;
    
    setIsCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by: user?.id,
          cancelled_at: new Date().toISOString(),
          status_before_cancellation: orderToCancel.status,
        })
        .eq('id', orderToCancel.id);
      
      if (error) throw error;
      
      // Print cancellation ticket to kitchen (if enabled in settings)
      const autoPrint = kdsSettings.autoPrintCancellations ?? true;
      if (autoPrint && printer?.canPrintToKitchen && orderToCancel.order_items && orderToCancel.order_items.length > 0) {
        try {
          const cancellationData: CancellationTicketData = {
            orderNumber: (orderToCancel as any).display_number ? String((orderToCancel as any).display_number) : orderToCancel.id,
            orderType: orderToCancel.order_type || 'takeaway',
            tableNumber: orderToCancel.table?.number,
            customerName: orderToCancel.customer_name,
            cancellationReason: reason,
            cancelledBy: profile?.name || user?.email || 'Desconhecido',
            items: orderToCancel.order_items.map(item => {
              const extraNames: string[] = [];
              if (item.extras && item.extras.length > 0) {
                item.extras.forEach(e => extraNames.push(`• ${e.extra_name}`));
              }
              if (item.sub_items && item.sub_items.length > 0) {
                const total = item.sub_items.length;
                item.sub_items.forEach((sub, idx) => {
                  const prefix = total > 1 ? `🍕 ${idx + 1}/${total} ` : '🍕 ';
                  const flavors = sub.sub_extras?.map(ext => ext.option_name).join(', ') || '';
                  if (flavors) extraNames.push(`${prefix}${flavors}`);
                  if (sub.notes) extraNames.push(`  OBS: ${sub.notes}`);
                });
              }
              return {
                quantity: item.quantity,
                productName: item.product?.name || 'Produto',
                variation: item.variation?.name,
                notes: item.notes,
                extras: extraNames.length > 0 ? extraNames : undefined,
              };
            }),
            cancelledAt: new Date().toISOString(),
          };
          await printer.printCancellationTicket(cancellationData);
        } catch (printError) {
          console.error('Error printing cancellation ticket:', printError);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Pedido cancelado', description: `Motivo: ${reason}` });
      setCancelDialogOpen(false);
      setOrderToCancel(null);
    } catch (error) {
      toast({ title: 'Erro ao cancelar pedido', variant: 'destructive' });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenPaymentModal = () => {
    if (orderItems.length === 0) {
      toast({ title: 'Adicione itens ao pedido', variant: 'destructive' });
      return;
    }
    if (orderType === 'takeaway' && !customerName.trim()) {
      toast({ title: 'Nome do cliente é obrigatório para pedidos de Retirada', variant: 'destructive' });
      return;
    }
    setPaymentAmount(finalTotal.toFixed(2));
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (printReceipt: boolean = false) => {
    if (paymentAmountNum < finalTotal) {
      toast({ title: 'Valor insuficiente', variant: 'destructive' });
      return;
    }

    // Rule 7: Discount limit check (skip if already approved by manager)
    if (!discountApprovedRef.current && discountType === 'percentage' && discountValue > 0 && isDiscountAboveLimit(discountValue)) {
      const userLimit = getDiscountLimitForCurrentUser();
      try {
        const req = await createApprovalRequest.mutateAsync({
          rule_type: 'discount',
          context: {
            discount_percent: discountValue,
            user_limit: userLimit,
            order_number: 'balcão',
            order_id: 'counter',
          },
        });
        setDiscountApprovalRequest(req);
        setPendingPrintReceipt(printReceipt);
        setWaitingDiscountApproval(true);
      } catch {
        toast({ title: 'Erro ao solicitar aprovação de desconto', variant: 'destructive' });
      }
      return;
    }

    setIsProcessingPayment(true);
    try {
      const customerPromise = (customerPhone || customerName)
        ? findOrCreateCustomer.mutateAsync({
            name: customerName || undefined,
            phone: customerPhone || undefined,
            address: orderType === 'delivery' ? customerAddress || undefined : undefined,
          }).catch((e) => {
            console.error('Failed to create/find customer:', e);
            return null;
          })
        : Promise.resolve(null);

      const orderPromise = createOrder.mutateAsync({
        order_type: orderType,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_address: orderType === 'delivery' ? customerAddress || null : null,
        notes: notes || null,
        subtotal: subtotal,
        discount: discountAmount,
        total: finalTotal,
        status: 'pending',
        is_draft: true,
        pager_number: orderType === 'takeaway' && pagerNumber.trim() ? pagerNumber.trim() : null,
      } as any);

      const [customer, order] = await Promise.all([customerPromise, orderPromise]);
      const customerId = customer?.id || null;

      const batchItems = [];
      for (const item of orderItems) {
        const shouldDup = duplicateItems && item.quantity > 1 && (duplicateItemsMaxQty <= 0 || item.quantity <= duplicateItemsMaxQty);
        const quantityToSave = shouldDup ? 1 : item.quantity;
        const iterationCount = shouldDup ? item.quantity : 1;

        for (let i = 0; i < iterationCount; i++) {
          batchItems.push({
            product_id: item.product_id,
            variation_id: item.variation_id || null,
            quantity: quantityToSave,
            unit_price: item.unit_price,
            total_price: item.unit_price * quantityToSave,
            notes: item.notes || null,
            status: 'pending' as const,
            complements: item.complements?.map(c => ({
              group_name: c.group_name,
              option_name: c.option_name,
              option_id: c.option_id,
              price: c.price,
              quantity: c.quantity,
              kds_category: c.kds_category || 'complement',
            })),
            subItems: item.subItems?.map(si => ({
              sub_item_index: si.sub_item_index,
              notes: si.sub_item_notes || null,
              extras: si.complements.map(c => ({
                group_id: c.group_id || null,
                group_name: c.group_name,
                option_id: c.option_id || null,
                option_name: c.option_name,
                price: c.price,
                quantity: c.quantity,
                kds_category: c.kds_category || 'complement',
              })),
            })),
          });
        }
      }

      await Promise.all([
        addOrderItemsBatch.mutateAsync({
          order_id: order.id,
          items: batchItems,
          keepDraft: true,
        }),
        customerId
          ? supabase.from('orders').update({ customer_id: customerId } as any).eq('id', order.id)
          : Promise.resolve(),
        createPayment.mutateAsync({
          order_id: order.id,
          payment_method: selectedPaymentMethod,
          amount: finalTotal,
          cash_register_id: openCashRegister?.id || null,
        }),
      ]);

      await Promise.all([
        supabase.from('orders').update({ is_draft: false }).eq('id', order.id),
        customerId
          ? updateCustomerStats.mutateAsync({ customerId, orderTotal: finalTotal }).catch((e) => {
              console.error('Failed to update customer stats:', e);
            })
          : Promise.resolve(),
      ]);

      const doPrinting = async () => {
        if (autoPrintKitchenTicket && centralPrint.canPrintToKitchen) {
          try {
            const sectorItems: SectorPrintItem[] = [];
            for (const item of orderItems) {
              if (duplicateItems && item.quantity > 1 && (duplicateItemsMaxQty <= 0 || item.quantity <= duplicateItemsMaxQty)) {
                for (let i = 0; i < item.quantity; i++) {
                  sectorItems.push({
                    quantity: 1,
                    productName: item.product_name,
                    variation: item.variation_name,
                    extras: buildPrintExtras(item.complements, item.subItems),
                    notes: item.notes,
                    print_sector_id: item.print_sector_id,
                  });
                }
              } else {
                sectorItems.push({
                  quantity: item.quantity,
                  productName: item.product_name,
                  variation: item.variation_name,
                  extras: buildPrintExtras(item.complements, item.subItems),
                  notes: item.notes,
                  print_sector_id: item.print_sector_id,
                });
              }
            }

            const orderInfo = {
              orderNumber: (order as any).display_number ? String((order as any).display_number) : order.id.slice(0, 8).toUpperCase(),
              orderType: orderType,
              customerName: customerName || undefined,
              notes: notes || undefined,
              createdAt: new Date().toISOString(),
            };

            const activeSectors = (printSectors || []).filter(s => s?.is_active !== false && s?.printer_name);

            if (activeSectors.length > 0) {
              const printOk = await centralPrint.printKitchenTicketsBySector(sectorItems, orderInfo, duplicateKitchenTicket);
              toast({ title: printOk ? '🖨️ Comandas impressas por setor' : 'Erro ao imprimir comanda. Verifique a impressora.' });
            } else {
              const ticketData: KitchenTicketData = {
                ...orderInfo,
                items: sectorItems.map(si => ({
                  quantity: si.quantity,
                  productName: si.productName,
                  variation: si.variation,
                  extras: si.extras,
                  notes: si.notes,
                })),
              };
              await centralPrint.printKitchenTicket(ticketData);
              if (duplicateKitchenTicket) {
                await centralPrint.printKitchenTicket(ticketData);
              }
              toast({ title: duplicateKitchenTicket ? '🖨️ Comandas impressas (2x)' : '🖨️ Comanda impressa automaticamente' });
            }
          } catch (err) {
            console.error('Auto print failed:', err);
          }
        }

        if (printReceipt || (autoPrintCustomerReceipt && printer?.canPrintToCashier)) {
          await printCustomerReceipt({
            order: {
              ...order,
              order_items: orderItems.map(item => ({
                id: item.id,
                order_id: order.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                notes: item.notes || null,
                product: { name: item.product_name },
                variation: item.variation_name ? { name: item.variation_name } : undefined,
                extras: item.complements?.map(c => ({
                  id: '',
                  order_item_id: item.id,
                  extra_name: `${c.group_name}: ${c.option_name}`,
                  price: c.price * c.quantity,
                  extra_id: null,
                })) || [],
                sub_items: item.subItems?.map(si => ({
                  id: '',
                  sub_item_index: si.sub_item_index,
                  notes: si.sub_item_notes || null,
                  sub_extras: si.complements.map(c => ({
                    id: '',
                    option_name: c.option_name,
                    price: c.price * c.quantity,
                    quantity: c.quantity,
                    group_name: c.group_name,
                    kds_category: c.kds_category || 'complement',
                  })),
                })) || [],
              })) as any,
            },
            payments: [{
              id: '',
              order_id: order.id,
              payment_method: selectedPaymentMethod,
              amount: finalTotal,
              cash_register_id: openCashRegister?.id || null,
              received_by: null,
              created_at: new Date().toISOString(),
            }],
            discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
            serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
            logoUrl: localStorage.getItem('pdv_restaurant_logo_url') || undefined,
          }, printer);

          if (!printReceipt && autoPrintCustomerReceipt) {
            toast({ title: '🖨️ Recibo impresso automaticamente' });
          }
        }
      };

      toast({ 
        title: 'Pagamento registrado!', 
        description: changeAmount > 0 ? `Troco: ${formatCurrency(changeAmount)}` : undefined 
      });

      clearOrder();
      resetPaymentModal();
      doPrinting().catch((err) => console.error('Printing error:', err));
      // Mark print dedup so IntegrationAutoHandler polling doesn't double-print this order
      localStorage.setItem(`_int_processed_print:${order.id}`, String(Date.now()));
    } catch (error: any) {
      toast({ title: 'Erro ao processar pagamento', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Legacy function for backwards compatibility (now opens payment modal)
  const handleCreateOrder = handleOpenPaymentModal;

  const getProductVariations = (productId: string) => {
    return variations?.filter(v => v.product_id === productId && v.is_active !== false) || [];
  };

  const getMinPrice = (product: any) => {
    const productVariations = getProductVariations(product.id);
    const basePrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price 
      : product.price;
    
    if (productVariations.length === 0) return basePrice;
    
    const minModifier = Math.min(...productVariations.map(v => v.price_modifier || 0));
    return basePrice + minModifier;
  };

  return (
    <PDVLayout>
      <div className="flex h-[calc(100vh-4rem)] xl:h-screen overflow-hidden -m-4 xl:-m-6">
        {/* Mobile/Tablet sidebar toggle */}
        {isTablet && (
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-16 left-2 z-50 xl:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Left Sidebar - Categories */}
        <div 
          className={cn(
            "border-r bg-muted/30 flex flex-col transition-all duration-300",
            sidebarOpen ? "w-48" : "w-0 overflow-hidden",
            isTablet && sidebarOpen && "absolute left-0 top-0 bottom-0 z-40 shadow-lg"
          )}
        >
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h3 className="font-semibold text-base text-foreground">
              Categorias
            </h3>
            {isTablet && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {activeCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (isTablet) setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 text-sm transition-colors border-b border-border break-words",
                    selectedCategory === cat.id
                      ? "bg-muted font-bold text-foreground"
                      : "hover:bg-muted/50 text-muted-foreground font-normal"
                  )}
                >
                  {cat.icon && <span className="mr-2">{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Overlay for tablet sidebar */}
        {isTablet && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-background/80 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Center - Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search Bar */}
          <div className="p-4 border-b bg-background">
            <div className="relative flex items-center gap-2">
              {isTablet && !sidebarOpen && (
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Encontre produtos por nome ou código PDV (Ctrl + b)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Products List */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum produto encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {filteredProducts.map(product => {
                    const productVariations = getProductVariations(product.id);
                    const minPrice = getMinPrice(product);
                    const hasVariations = productVariations.length > 0;
                    const isPromotion = product.is_promotion && product.promotion_price != null;
                    
                    return (
                      <div
                        key={product.id}
                        onClick={() => handleProductClick(product)}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all"
                      >
                        <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm leading-tight break-words uppercase">{product.name}</p>
                          <p className="text-sm text-foreground mt-1">
                            {hasVariations ? 'A partir de ' : ''}
                            {formatCurrency(minPrice)}
                          </p>
                          {isPromotion && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatCurrency(product.price)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Order */}
        <div className={cn(
          "border-l bg-background flex flex-col transition-all duration-300",
          isTablet ? "w-72" : "w-80"
        )}>
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-lg">Novo pedido</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={clearOrder}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Active Orders Section */}
          {todayActiveOrders.length > 0 && (
            <Collapsible open={activeOrdersOpen} onOpenChange={setActiveOrdersOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between h-10 px-3 border-b rounded-none"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <History className="h-4 w-4" />
                    Pedidos em Andamento ({todayActiveOrders.length})
                  </span>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform",
                    activeOrdersOpen && "rotate-90"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="max-h-64 border-b">
                  <div className="p-2 space-y-2">
                    {todayActiveOrders.map(order => {
                      const orderTime = order.created_at ? new Date(order.created_at).getTime() : Date.now();
                      const waitMinutes = Math.floor((Date.now() - orderTime) / 60000);
                      const timeColor = waitMinutes < 10 ? 'text-green-500' : waitMinutes < 20 ? 'text-yellow-500' : 'text-red-500';
                      
                      const statusConfig = {
                        pending: { label: 'Novo', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: <Package className="h-3 w-3" /> },
                        preparing: { label: 'Produzindo', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: <ChefHat className="h-3 w-3" /> },
                        ready: { label: 'Pronto', color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: <CheckCircle2 className="h-3 w-3" /> },
                      };
                      const currentStatus = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
                      
                      return (
                        <div 
                          key={order.id}
                          className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg text-sm border"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">#{(order as any).display_number ?? order.id.slice(-4).toUpperCase()}</span>
                              <Badge variant="outline" className={cn("text-xs", currentStatus.color)}>
                                {currentStatus.icon}
                                <span className="ml-1">{currentStatus.label}</span>
                              </Badge>
                            </div>
                            <span className={cn("text-xs font-medium flex items-center gap-1", timeColor)}>
                              <Clock className="h-3 w-3" />
                              {waitMinutes}min
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              order.order_type === 'delivery' 
                                ? "bg-purple-500/10 text-purple-500 border-purple-500/30"
                                : "bg-orange-500/10 text-orange-500 border-orange-500/30"
                            )}>
                              {order.order_type === 'delivery' ? (
                                <><Truck className="h-3 w-3 mr-1" />Delivery</>
                              ) : (
                                <><Store className="h-3 w-3 mr-1" />Balcão</>
                              )}
                            </Badge>
                            {order.customer_name && (
                              <span className="text-xs text-muted-foreground truncate">{order.customer_name}</span>
                            )}
                            {(order as any).pager_number && (
                              <Badge className="bg-amber-500 text-white border-amber-400 text-xs font-bold animate-pulse">
                                📟 PAGER #{(order as any).pager_number}
                              </Badge>
                            )}
                            <span className="text-xs text-primary font-medium ml-auto">
                              {formatCurrency(order.total || 0)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 pt-1 border-t border-border">
                            {order.status === 'ready' && (
                              <Button
                                size="sm"
                                className="flex-1 h-7 bg-muted-foreground hover:bg-muted-foreground/80"
                                onClick={async () => {
                                  const cl = await fetchDispatchChecklist(order.id);
                                  if (cl.length > 0) {
                                    setDispatchChecklistItems(cl);
                                    setPendingDeliverOrder(order);
                                    setDispatchChecklistOpen(true);
                                  } else {
                                    updateOrder.mutateAsync({
                                      id: order.id,
                                      status: 'delivered' as any,
                                      delivered_at: new Date().toISOString()
                                    } as any).then(() => {
                                      toast({ title: 'Pedido marcado como entregue!' });
                                    }).catch(() => {
                                      toast({ title: 'Erro ao atualizar pedido', variant: 'destructive' });
                                    });
                                  }
                                }}
                              >
                                <PackageCheck className="h-3 w-3 mr-1" />
                                Marcar Entregue
                              </Button>
                            )}
                            {canCancelOrder && order.status !== 'ready' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 h-7"
                                onClick={() => {
                                  setOrderToCancel(order);
                                  setCancelDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Carrinho Label */}
          <div className="px-4 pt-3 pb-1">
            <h4 className="font-semibold text-base text-foreground">Carrinho</h4>
          </div>

          {/* Cart Items */}
          <ScrollArea className="flex-1">
            {orderItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
                <Package className="h-20 w-20 mb-4 opacity-20" />
                <p className="text-sm italic opacity-60">Carrinho vazio</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {orderItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.product_name}
                        {item.variation_name && ` (${item.variation_name})`}
                      </p>
                      {item.combo_name && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          <Gift className="h-3 w-3 mr-1" />
                          {item.combo_name}
                        </Badge>
                      )}
                      {item.complements && item.complements.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.complements.map((c, i) => (
                            <span key={i}>
                              {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.option_name}
                              {i < item.complements!.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-amber-600 mt-0.5 italic">
                          Obs: {item.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeItem(item.id)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-xs">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => duplicateItems ? duplicateItem(item.id) : updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer - Customer details collapsible + Atendente + Button */}
          <div className="border-t bg-muted/30">
            {/* Customer & Order details collapsible */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-9 px-3 rounded-none text-xs">
                  <span className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Dados do cliente / pedido
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  {/* Customer search */}
                  <div ref={customerSearchRef} className="relative">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar cliente..."
                        value={customerSearch}
                        onChange={(e) => handleCustomerSearchChange(e.target.value)}
                        onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)}
                        className="h-9 pl-9"
                      />
                    </div>
                    {showCustomerDropdown && searchedCustomers && searchedCustomers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                        {searchedCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => selectCustomer(customer)}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{customer.name}</p>
                                {customer.phone && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {customer.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedCustomer && (
                    <div className="bg-muted/50 rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cliente selecionado</span>
                        <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearch('');
                          setCustomerName('');
                          setCustomerPhone('');
                          setCustomerAddress('');
                        }}>Limpar</Button>
                      </div>
                      <p className="font-medium">{selectedCustomer.name}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="(11) 99999-9999"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
                        className="h-9 pl-9"
                        type="tel"
                      />
                    </div>
                  </div>

                  <Select value={orderType} onValueChange={(v: OrderType) => setOrderType(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="takeaway">📦 Retirada</SelectItem>
                      <SelectItem value="delivery">🚚 Delivery</SelectItem>
                    </SelectContent>
                  </Select>

                  {orderType === 'takeaway' && (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📟</span>
                      <Input
                        placeholder="Nº do Pager (opcional)"
                        value={pagerNumber}
                        onChange={(e) => setPagerNumber(e.target.value)}
                        className="h-9 pl-10 border-amber-400 focus-visible:ring-amber-500 font-bold text-amber-700"
                      />
                    </div>
                  )}

                  {orderType === 'delivery' && (
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        placeholder="Endereço de entrega..."
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        rows={2}
                        className="text-sm pl-9"
                      />
                    </div>
                  )}

                  <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between h-8 px-2 text-xs">
                        <span className="flex items-center gap-2">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Observação
                        </span>
                        {notesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      <Textarea
                        placeholder="Observações..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Atendente */}
            <div className="px-3 py-2 border-t">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-background px-1 text-xs text-muted-foreground">
                  Atendente
                </label>
                <Select value={profile?.name || ''} disabled>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={profile?.name || 'Atendente'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={profile?.name || 'default'}>{profile?.name || 'Atendente'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Submit Button */}
            <div className="p-3">
              <Button
                className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90"
                size="lg"
                onClick={handleCreateOrder}
                disabled={orderItems.length === 0 || isCreatingOrder}
              >
                {isCreatingOrder ? 'Processando...' : (
                  <>
                    ENVIAR PEDIDO <span className="text-xs font-normal ml-1 opacity-70">(Ctrl + p)</span>
                    <span className="ml-auto">{formatCurrency(subtotal)}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ProductDetailDialog for product selection with complements */}
      <ProductDetailDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onAdd={handleAddFromDialog}
        duplicateItems={duplicateItems}
        duplicateItemsMaxQty={duplicateItemsMaxQty}
        channel={orderType === 'delivery' ? 'delivery' : 'counter'}
        pizzaConfig={selectedPizzaConfig}
      />

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Financial Summary */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              
              {/* Discount */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Desconto
                  </span>
                  <div className="flex items-center gap-2">
                    <RadioGroup 
                      value={discountType} 
                      onValueChange={(v) => setDiscountType(v as 'percentage' | 'fixed')}
                      className="flex gap-2"
                    >
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="percentage" id="pct" className="h-3 w-3" />
                        <Label htmlFor="pct" className="text-xs">%</Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="fixed" id="fix" className="h-3 w-3" />
                        <Label htmlFor="fix" className="text-xs">R$</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder={discountType === 'percentage' ? '0%' : 'R$ 0,00'}
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto aplicado</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
              </div>

              {/* Service Charge */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Taxa de serviço ({serviceChargePercent}%)
                </span>
                <Switch checked={serviceChargeEnabled} onCheckedChange={setServiceChargeEnabled} />
              </div>
              {serviceChargeEnabled && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Taxa de serviço</span>
                  <span>+{formatCurrency(serviceAmount)}</span>
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>TOTAL</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { method: 'cash' as PaymentMethod, icon: Banknote, label: 'Dinheiro' },
                { method: 'credit_card' as PaymentMethod, icon: CreditCard, label: 'Crédito' },
                { method: 'debit_card' as PaymentMethod, icon: CreditCard, label: 'Débito' },
                { method: 'pix' as PaymentMethod, icon: QrCode, label: 'Pix' },
              ].map(({ method, icon: Icon, label }) => (
                <Button
                  key={method}
                  variant={selectedPaymentMethod === method ? 'default' : 'outline'}
                  className="flex flex-col h-16 gap-1"
                  onClick={() => setSelectedPaymentMethod(method)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>

            {/* Payment Amount */}
            {selectedPaymentMethod === 'cash' && (
              <div className="space-y-2">
                <Label>Valor recebido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="text-lg font-bold"
                />
                {changeAmount > 0 && (
                  <div className="flex justify-between p-2 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400 font-bold">
                    <span>Troco</span>
                    <span>{formatCurrency(changeAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setPaymentModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleConfirmPayment(true)}
                disabled={isProcessingPayment || paymentAmountNum < finalTotal}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button 
                className="flex-1"
                onClick={() => handleConfirmPayment(false)}
                disabled={isProcessingPayment || paymentAmountNum < finalTotal}
              >
                {isProcessingPayment ? 'Processando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ApprovalWaitingDialog
        open={waitingDiscountApproval}
        onOpenChange={(open) => {
          if (!open) {
            setWaitingDiscountApproval(false);
            setDiscountApprovalRequest(null);
          }
        }}
        request={watchedDiscountRequest ?? discountApprovalRequest}
        onApproved={() => {
          setWaitingDiscountApproval(false);
          setDiscountApprovalRequest(null);
          discountApprovedRef.current = true;
          handleConfirmPayment(pendingPrintReceipt).finally(() => {
            discountApprovedRef.current = false;
          });
        }}
        onDenied={(denialReason) => {
          setWaitingDiscountApproval(false);
          setDiscountApprovalRequest(null);
          toast({ title: `Desconto negado pelo gerente${denialReason ? `: ${denialReason}` : ''}`, variant: 'destructive' });
        }}
        title="Aprovação de desconto"
        description={`Solicitando aprovação para ${discountValue}% de desconto`}
      />

      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelOrder}
        orderInfo={orderToCancel ?
          `#${(orderToCancel as any).display_number ?? orderToCancel.id.slice(-4).toUpperCase()} - ${
            orderToCancel.order_type === 'delivery' ? 'Delivery' : 'Balcão'
          }${orderToCancel.customer_name ? ` - ${orderToCancel.customer_name}` : ''}`
          : undefined
        }
        isLoading={isCancelling}
      />
      <DispatchChecklistDialog
        open={dispatchChecklistOpen}
        onOpenChange={setDispatchChecklistOpen}
        checklist={dispatchChecklistItems}
        orderLabel={pendingDeliverOrder ? `Pedido #${(pendingDeliverOrder as any).display_number ?? pendingDeliverOrder.id.slice(-4).toUpperCase()}` : undefined}
        onConfirm={async () => {
          if (!pendingDeliverOrder) return;
          try {
            await updateOrder.mutateAsync({
              id: pendingDeliverOrder.id,
              status: 'delivered' as any,
              delivered_at: new Date().toISOString()
            } as any);
            toast({ title: 'Pedido marcado como entregue!' });
          } catch {
            toast({ title: 'Erro ao atualizar pedido', variant: 'destructive' });
          } finally {
            setDispatchChecklistOpen(false);
            setPendingDeliverOrder(null);
          }
        }}
      />
    </PDVLayout>
  );
}
