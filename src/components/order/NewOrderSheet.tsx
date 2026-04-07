import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent } from '@/components/ui/sheet';
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
import { useOrderMutations } from '@/hooks/useOrders';
import { useCentralizedPrinting } from '@/hooks/useCentralizedPrinting';
import { useToast } from '@/hooks/use-toast';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { useSearchCustomers, useCustomerMutations, Customer } from '@/hooks/useCustomers';
import { useOpenCashRegister, useCashRegisterMutations, PaymentMethod } from '@/hooks/useCashRegister';
import { ProductDetailDialog, SelectedComplement, SubItemComplement } from '@/components/order/ProductDetailDialog';
import { printCustomerReceipt } from '@/components/receipt/CustomerReceipt';
import { usePrinterOptional, SectorPrintItem } from '@/contexts/PrinterContext';
import { KitchenTicketData } from '@/utils/escpos';
import { buildPrintExtras } from '@/lib/printSubItems';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { calculateFullComplementsPrice, ComplementForCalc, SubItemForCalc } from '@/lib/complementPriceUtils';
import { usePizzaProducts } from '@/hooks/usePizzaProducts';
import {
  Package, ShoppingCart, Trash2, Plus, Minus, Search, ChevronDown, ChevronUp,
  MessageSquare, X, Phone, User, MapPin, Tag, Percent,
  Banknote, CreditCard, QrCode, Printer, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '');
  const limited = numbers.slice(0, 11);
  if (limited.length <= 2) return limited.length ? `(${limited}` : '';
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 10) return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
}

interface OrderItemLocal {
  id: string;
  product_id: string;
  product_name: string;
  variation_id?: string | null;
  variation_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  complements?: SelectedComplement[];
  print_sector_id?: string | null;
  subItems?: SubItemComplement[];
}

type OrderType = 'takeaway' | 'delivery';

interface NewOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated?: () => void;
}

export function NewOrderSheet({ open, onOpenChange, onOrderCreated }: NewOrderSheetProps) {
  const queryClient = useQueryClient();
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: variations } = useProductVariations();
  const { createOrder, addOrderItemsBatch } = useOrderMutations();
  const { toast } = useToast();
  const { duplicateItems, duplicateItemsMaxQty, autoPrintKitchenTicket, autoPrintCustomerReceipt, duplicateKitchenTicket } = useOrderSettings();
  const centralPrint = useCentralizedPrinting();
  const printer = usePrinterOptional();
  const { data: printSectors } = usePrintSectors();
  const { profile } = useProfile();
  const { findOrCreateCustomer, updateCustomerStats } = useCustomerMutations();
  const { data: openCashRegister } = useOpenCashRegister();
  const { createPayment } = useCashRegisterMutations();
  const { data: pizzaData, isLoading: pizzaDataLoading } = usePizzaProducts();
  const pendingProductRef = useRef<any>(null);

  // State
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemLocal[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);

  // ProductDetailDialog
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const { data: searchedCustomers } = useSearchCustomers(customerSearch);

  // Payment
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState(10);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [customerNameError, setCustomerNameError] = useState(false);

  // Comprovante obrigatório para cartão/pix
  const [paymentObservation, setPaymentObservation] = useState('');
  const [showObservationError, setShowObservationError] = useState(false);
  const isReceiptRequired = true; // Sempre obrigatório para balcão/retirada

  const activeCategories = categories?.filter(c => c.is_active !== false) || [];
  const activeProducts = products?.filter(p => p.is_available !== false) || [];

  // Auto-select first category
  useEffect(() => {
    if (activeCategories.length > 0 && selectedCategory === null) {
      setSelectedCategory(activeCategories[0].id);
    }
  }, [activeCategories, selectedCategory]);

  // Reset on open
  useEffect(() => {
    if (open) {
      clearOrder();
    }
  }, [open]);

  // Close customer dropdown outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Process pending product
  useEffect(() => {
    if (!pizzaDataLoading && pendingProductRef.current) {
      const product = pendingProductRef.current;
      pendingProductRef.current = null;
      setSelectedProduct(product);
      setProductDialogOpen(true);
    }
  }, [pizzaDataLoading]);

  const filteredProducts = useMemo(() => {
    let filtered = activeProducts;
    if (selectedCategory) filtered = filtered.filter(p => p.category_id === selectedCategory);
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

  const discountAmount = useMemo(() => {
    if (discountValue <= 0) return 0;
    return discountType === 'percentage' ? (subtotal * discountValue / 100) : discountValue;
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const serviceAmount = serviceChargeEnabled ? (afterDiscount * serviceChargePercent / 100) : 0;
  const finalTotal = afterDiscount + serviceAmount;

  const paymentAmountNum = selectedPaymentMethod === 'cash'
    ? (parseFloat(paymentAmount) || 0)
    : finalTotal;
  const changeAmount = Math.max(0, paymentAmountNum - finalTotal);

  const getProductVariations = (productId: string) => {
    return variations?.filter(v => v.product_id === productId && v.is_active !== false) || [];
  };

  const getMinPrice = (product: any) => {
    const productVariations = getProductVariations(product.id);
    const basePrice = product.is_promotion && product.promotion_price ? product.promotion_price : product.price;
    if (productVariations.length === 0) return basePrice;
    const minModifier = Math.min(...productVariations.map((v: any) => v.price_modifier || 0));
    return basePrice + minModifier;
  };

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

  const clearOrder = () => {
    setOrderItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerSearch('');
    setSelectedCustomer(null);
    setNotes('');
    setSearchQuery('');
    setSelectedCategory(null);
    setCustomerNameError(false);
    setDiscountType('percentage');
    setDiscountValue(0);
    setServiceChargeEnabled(false);
    setPaymentObservation('');
    setShowObservationError(false);
  };

  const handleProductClick = (product: any) => {
    if (pizzaDataLoading) {
      pendingProductRef.current = product;
      setSelectedProduct(product);
      return;
    }
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  const handleAddFromDialog = (
    product: any,
    quantity: number,
    complements: SelectedComplement[],
    itemNotes: string,
    subItems?: SubItemComplement[]
  ) => {
    const groupPriceTypes: Record<string, 'sum' | 'average' | 'highest' | 'lowest'> = {};
    for (const c of complements) {
      if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
        groupPriceTypes[c.group_id] = c.price_calculation_type;
      }
    }
    if (subItems) {
      for (const si of subItems) {
        for (const c of si.complements) {
          if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
            groupPriceTypes[c.group_id] = c.price_calculation_type;
          }
        }
      }
    }

    const sharedComplements: ComplementForCalc[] = complements.map(c => ({
      group_id: c.group_id, price: c.price, quantity: c.quantity,
    }));
    const subItemsForCalc: SubItemForCalc[] | undefined = subItems?.map(si => ({
      complements: si.complements.map(c => ({
        group_id: c.group_id, price: c.price, quantity: c.quantity,
      })),
    }));

    const complementsTotal = calculateFullComplementsPrice(sharedComplements, subItemsForCalc, groupPriceTypes);
    const productPrice = product.is_promotion && product.promotion_price ? product.promotion_price : product.price;
    const unitPrice = productPrice + complementsTotal;

    if (duplicateItems && quantity > 1 && (duplicateItemsMaxQty <= 0 || quantity <= duplicateItemsMaxQty)) {
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

  const updateQuantity = (itemId: string, delta: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty, total_price: item.unit_price * newQty };
    }));
  };

  const duplicateItem = (itemId: string) => {
    setOrderItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item) return prev;
      return [...prev, { ...item, id: `${item.product_id}-${Date.now()}`, quantity: 1, total_price: item.unit_price }];
    });
  };

  const removeItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleOpenPaymentModal = () => {
    if (orderItems.length === 0) {
      toast({ title: 'Adicione itens ao pedido', variant: 'destructive' });
      return;
    }
    if (!customerName.trim()) {
      setCustomerNameError(true);
      toast({ title: 'Nome do cliente é obrigatório', variant: 'destructive' });
      return;
    }
    setCustomerNameError(false);
    setPaymentAmount(finalTotal.toFixed(2));
    setPaymentObservation('');
    setShowObservationError(false);
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (printReceipt: boolean = false) => {
    if (paymentAmountNum < finalTotal) {
      toast({ title: 'Valor insuficiente', variant: 'destructive' });
      return;
    }
    if (isReceiptRequired && !paymentObservation.trim()) {
      setShowObservationError(true);
      return;
    }

    setIsProcessingPayment(true);
    try {
      // Phase 1: Create customer + order in parallel
      const customerPromise = (customerPhone || customerName)
        ? findOrCreateCustomer.mutateAsync({
            name: customerName || undefined,
            phone: customerPhone || undefined,
            address: orderType === 'delivery' ? customerAddress || undefined : undefined,
          }).catch(e => { console.error('Failed to create/find customer:', e); return null; })
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
      });

      const [customer, order] = await Promise.all([customerPromise, orderPromise]);
      const customerId = customer?.id || null;

      if (customerId) {
        supabase.from('orders').update({ customer_id: customerId } as any).eq('id', order.id);
      }

      // Build batch items
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

      await addOrderItemsBatch.mutateAsync({
        order_id: order.id,
        items: batchItems,
        keepDraft: true,
      });

      // Phase 2: Payment + Publish + Customer stats in parallel
      await Promise.all([
        createPayment.mutateAsync({
          order_id: order.id,
          payment_method: selectedPaymentMethod,
          amount: finalTotal,
          cash_register_id: openCashRegister?.id || null,
        }),
        supabase.from('orders').update({ is_draft: false }).eq('id', order.id),
        customerId
          ? updateCustomerStats.mutateAsync({ customerId, orderTotal: finalTotal }).catch(() => {})
          : Promise.resolve(),
      ]);

      // Phase 3: Printing fire-and-forget (don't block UI)
      const doPrinting = async () => {
        if (autoPrintKitchenTicket && centralPrint.canPrintToKitchen) {
          try {
            const sectorItems: SectorPrintItem[] = [];
            for (const item of orderItems) {
              if (duplicateItems && item.quantity > 1 && (duplicateItemsMaxQty <= 0 || item.quantity <= duplicateItemsMaxQty)) {
                for (let i = 0; i < item.quantity; i++) {
                  sectorItems.push({
                    quantity: 1, productName: item.product_name, variation: item.variation_name,
                    extras: buildPrintExtras(item.complements, item.subItems),
                    notes: item.notes, print_sector_id: item.print_sector_id,
                  });
                }
              } else {
                sectorItems.push({
                  quantity: item.quantity, productName: item.product_name, variation: item.variation_name,
                  extras: buildPrintExtras(item.complements, item.subItems),
                  notes: item.notes, print_sector_id: item.print_sector_id,
                });
              }
            }
            const orderInfo = {
              orderNumber: order.id.slice(0, 8).toUpperCase(),
              orderType: orderType,
              customerName: customerName || undefined,
              notes: notes || undefined,
              createdAt: new Date().toISOString(),
            };
            const activeSectors = (printSectors || []).filter(s => s?.is_active !== false && s?.printer_name);
            if (activeSectors.length > 0) {
              await centralPrint.printKitchenTicketsBySector(sectorItems, orderInfo, duplicateKitchenTicket);
            } else {
              const ticketData: KitchenTicketData = {
                ...orderInfo,
                items: sectorItems.map(si => ({
                  quantity: si.quantity, productName: si.productName, variation: si.variation,
                  extras: si.extras, notes: si.notes,
                })),
              };
              await centralPrint.printKitchenTicket(ticketData);
              if (duplicateKitchenTicket) await centralPrint.printKitchenTicket(ticketData);
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
                id: item.id, order_id: order.id, product_id: item.product_id,
                quantity: item.quantity, unit_price: item.unit_price, total_price: item.total_price,
                notes: item.notes || null,
                product: { name: item.product_name },
                variation: item.variation_name ? { name: item.variation_name } : undefined,
                extras: item.complements?.map(c => ({
                  id: '', order_item_id: item.id,
                  extra_name: `${c.group_name}: ${c.option_name}`,
                  price: c.price * c.quantity, extra_id: null,
                })) || [],
                sub_items: item.subItems?.map(si => ({
                  id: '', sub_item_index: si.sub_item_index, notes: si.sub_item_notes || null,
                  sub_extras: si.complements.map(c => ({
                    id: '', option_name: c.option_name, price: c.price * c.quantity,
                    quantity: c.quantity, group_name: c.group_name, kds_category: c.kds_category || 'complement',
                  })),
                })) || [],
              })) as any,
            },
            payments: [{
              id: '', order_id: order.id, payment_method: selectedPaymentMethod,
              amount: finalTotal, cash_register_id: openCashRegister?.id || null,
              received_by: null, created_at: new Date().toISOString(),
            }],
            discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
            serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
            logoUrl: localStorage.getItem('pdv_restaurant_logo_url') || undefined,
          }, printer);
        }
      };
      doPrinting().catch(err => console.error('Printing error:', err));
      // Mark print dedup so IntegrationAutoHandler polling doesn't double-print this order
      localStorage.setItem(`_int_processed_print:${order.id}`, String(Date.now()));

      toast({
        title: 'Pedido criado com sucesso!',
        description: changeAmount > 0 ? `Troco: ${formatCurrency(changeAmount)}` : undefined,
      });

      setPaymentModalOpen(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onOrderCreated?.();
    } catch (error: any) {
      toast({ title: 'Erro ao processar pagamento', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setCustomerName(value);
    setShowCustomerDropdown(true);
    setSelectedCustomer(null);
    if (value.trim()) setCustomerNameError(false);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setCustomerAddress(customer.address || '');
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    setCustomerNameError(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[95vw] xl:max-w-[85vw] p-0 flex flex-col [&>button.absolute]:hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
            <h2 className="text-lg font-bold text-foreground">Novo Pedido</h2>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Body - 3 columns */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Categories */}
            <div className="w-44 border-r bg-muted/30 flex-col hidden sm:flex">
              <div className="px-3 pt-3 pb-2">
                <h3 className="font-semibold text-sm text-foreground">Categorias</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="flex flex-col">
                  {activeCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-border break-words",
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

            {/* Products */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-3 border-b bg-background">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                  />
                  {searchQuery && (
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery('')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {/* Mobile categories */}
                <div className="flex sm:hidden gap-2 mt-2 overflow-x-auto pb-1">
                  {activeCategories.map(cat => (
                    <Button
                      key={cat.id}
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum produto encontrado</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredProducts.map(product => {
                        const minPrice = getMinPrice(product);
                        const hasVariations = getProductVariations(product.id).length > 0;
                        const isPromotion = product.is_promotion && product.promotion_price != null;
                        return (
                          <div
                            key={product.id}
                            onClick={() => handleProductClick(product)}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all"
                          >
                            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs leading-tight break-words uppercase">{product.name}</p>
                              <p className="text-sm text-foreground mt-1">
                                {hasVariations ? 'A partir de ' : ''}{formatCurrency(minPrice)}
                              </p>
                              {isPromotion && <p className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Cart / Right panel */}
            <div className="w-72 xl:w-80 border-l bg-background flex flex-col">
              <div className="px-3 pt-3 pb-2 border-b">
                <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Carrinho
                </h3>
              </div>

              {/* Cart items */}
              <ScrollArea className="flex-1">
                {orderItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
                    <Package className="h-16 w-16 mb-3 opacity-20" />
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
                          {item.subItems && item.subItems.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.subItems.map((si, i) => (
                                <span key={i}>
                                  {si.complements.filter(c => c.kds_category === 'flavor').map(c => c.option_name).join(', ')}
                                  {i < item.subItems!.length - 1 ? ' | ' : ''}
                                </span>
                              ))}
                            </p>
                          )}
                          {item.notes && <p className="text-xs text-amber-600 mt-0.5 italic">Obs: {item.notes}</p>}
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.unit_price)} × {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.id)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-5 text-center text-xs">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => duplicateItems ? duplicateItem(item.id) : updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Footer */}
              <div className="border-t bg-muted/30">
                {/* Customer info */}
                <div className="px-3 py-2 space-y-2">
                  {/* Customer name (required) */}
                  <div ref={customerSearchRef} className="relative">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Nome do cliente *"
                        value={customerSearch || customerName}
                        onChange={(e) => handleCustomerSearchChange(e.target.value)}
                        onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)}
                        className={cn("h-9 pl-9", customerNameError && "border-destructive")}
                      />
                    </div>
                    {customerNameError && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Nome obrigatório
                      </p>
                    )}
                    {showCustomerDropdown && searchedCustomers && searchedCustomers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {searchedCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => selectCustomer(customer)}
                            className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                          >
                            <p className="font-medium text-sm truncate">{customer.name}</p>
                            {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="(11) 99999-9999"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
                      className="h-9 pl-9"
                      type="tel"
                    />
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

                  {orderType === 'delivery' && (
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea placeholder="Endereço de entrega..." value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)} rows={2} className="text-sm pl-9" />
                    </div>
                  )}

                  <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between h-7 px-2 text-xs">
                        <span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Observação</span>
                        {notesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      <Textarea placeholder="Observações..." value={notes}
                        onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* Atendente */}
                {profile?.name && (
                  <div className="px-3 py-1 text-xs text-muted-foreground border-t">
                    Atendente: <span className="font-medium text-foreground">{profile.name}</span>
                  </div>
                )}

                {/* Submit */}
                <div className="p-3 border-t">
                  <Button
                    className="w-full h-11 text-base font-bold bg-primary hover:bg-primary/90"
                    onClick={handleOpenPaymentModal}
                    disabled={orderItems.length === 0}
                  >
                    ENVIAR PEDIDO
                    <span className="ml-auto">{formatCurrency(subtotal)}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ProductDetailDialog */}
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
            {/* Summary */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {/* Discount */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Desconto</span>
                  <RadioGroup value={discountType} onValueChange={(v) => setDiscountType(v as any)} className="flex gap-2">
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="percentage" id="ns-pct" className="h-3 w-3" />
                      <Label htmlFor="ns-pct" className="text-xs">%</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="fixed" id="ns-fix" className="h-3 w-3" />
                      <Label htmlFor="ns-fix" className="text-xs">R$</Label>
                    </div>
                  </RadioGroup>
                </div>
                <Input type="number" placeholder={discountType === 'percentage' ? '0%' : 'R$ 0,00'}
                  value={discountValue || ''} onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)} className="h-8" />
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto aplicado</span><span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
              </div>

              {/* Service Charge */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm flex items-center gap-2"><Percent className="h-4 w-4" /> Taxa de serviço ({serviceChargePercent}%)</span>
                <Switch checked={serviceChargeEnabled} onCheckedChange={setServiceChargeEnabled} />
              </div>
              {serviceChargeEnabled && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Taxa de serviço</span><span>+{formatCurrency(serviceAmount)}</span>
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>TOTAL</span><span>{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-4 gap-2">
              {([
                { method: 'cash' as PaymentMethod, icon: Banknote, label: 'Dinheiro' },
                { method: 'credit_card' as PaymentMethod, icon: CreditCard, label: 'Crédito' },
                { method: 'debit_card' as PaymentMethod, icon: CreditCard, label: 'Débito' },
                { method: 'pix' as PaymentMethod, icon: QrCode, label: 'Pix' },
              ]).map(({ method, icon: Icon, label }) => (
                <Button key={method} variant={selectedPaymentMethod === method ? 'default' : 'outline'}
                  className="flex flex-col h-16 gap-1" onClick={() => setSelectedPaymentMethod(method)}>
                  <Icon className="h-5 w-5" /><span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>

            {/* Cash amount */}
            {selectedPaymentMethod === 'cash' && (
              <div className="space-y-2">
                <Label>Valor recebido</Label>
                <Input type="number" step="0.01" value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)} className="text-lg font-bold" />
                {changeAmount > 0 && (
                  <div className="flex justify-between p-2 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400 font-bold">
                    <span>Troco</span><span>{formatCurrency(changeAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Comprovante obrigatório */}
            <div className="space-y-2">
              <Label>{isReceiptRequired ? 'Código do comprovante *' : 'Observação (opcional)'}</Label>
              <Input value={paymentObservation}
                onChange={(e) => { setPaymentObservation(e.target.value); if (showObservationError) setShowObservationError(false); }}
                placeholder={isReceiptRequired ? 'Ex: Código do cupom fiscal ou comprovante' : 'Ex: Recebeu R$100, troco R$50'}
                className={showObservationError ? 'border-destructive' : ''}
              />
              {showObservationError && <p className="text-sm text-destructive">Informe o código do comprovante</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setPaymentModalOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={() => handleConfirmPayment(false)}
                disabled={isProcessingPayment || paymentAmountNum < finalTotal || (isReceiptRequired && !paymentObservation.trim())}>
                {isProcessingPayment ? 'Processando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
