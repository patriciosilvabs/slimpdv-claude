import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTables, useTableMutations, Table, TableStatus } from '@/hooks/useTables';
import { useOrders, useOrderMutations, Order, OrderItemStation } from '@/hooks/useOrders';
import { useReservations, useReservationMutations, Reservation } from '@/hooks/useReservations';
import { useOpenCashRegister, useCashRegisterMutations, PaymentMethod } from '@/hooks/useCashRegister';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useTableWaitSettings } from '@/hooks/useTableWaitSettings';
import { useIdleTableSettings } from '@/hooks/useIdleTableSettings';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { type CartItem } from '@/components/order/AddOrderItemsModal';
import { CancelOrderDialog } from '@/components/order/CancelOrderDialog';
import { CancelItemDialog } from '@/components/order/CancelItemDialog';
import { Plus, Users, Receipt, CreditCard, Calendar, Clock, Phone, X, Check, ChevronLeft, ShoppingBag, Bell, Banknote, Smartphone, ArrowLeft, Trash2, UserPlus, Minus, ArrowRightLeft, XCircle, Printer, RotateCcw, Ban, ArrowRight, Wallet, AlertCircle, Flame } from 'lucide-react';
import { printKitchenOrderTicket } from '@/components/kitchen/KitchenOrderTicket';
import { OrderItemBorderBadge } from '@/components/tables/OrderItemBorderBadge';
import { printCustomerReceipt, printPartialPaymentReceipt, propsToReceiptData } from '@/components/receipt/CustomerReceipt';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { format, addDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { mobileAwareToast as toast, setMobileDevice } from '@/lib/mobileToast';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { usePrinterOptional, SectorPrintItem } from '@/contexts/PrinterContext';
import { useCentralizedPrinting } from '@/hooks/useCentralizedPrinting';
import { KitchenTicketData, CancellationTicketData } from '@/utils/escpos';
import { buildPrintExtras } from '@/lib/printSubItems';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { useProfile } from '@/hooks/useProfile';
import {
  OpenTableDialog,
  ReservationDialog,
  PaymentModal,
  ReopenOrderDialog,
  CustomerNameInput,
  DiscountInput,
  ServiceChargeInput,
  CustomSplitInput,
  OrderDrawer,
  CartReviewSheet,
  ProductSelector,
  PendingCartPanel,
  ItemKdsJourney,
} from '@/components/tables';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Session storage keys for cooldown persistence
const WAIT_COOLDOWN_KEY = 'table-wait-cooldowns';
const IDLE_COOLDOWN_KEY = 'idle-table-cooldowns';

// Helper function to load cooldowns from sessionStorage (defined outside component to avoid hooks issues)
function loadCooldowns(key: string): Map<string, number> {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      const now = Date.now();
      // Filter out expired entries (older than 1 hour)
      const filtered = Object.entries(parsed).filter(([_, time]) => now - (time as number) < 3600000);
      return new Map(filtered.map(([k, v]) => [k, v as number]));
    }
  } catch (e) {
    console.error('Error loading cooldowns:', e);
  }
  return new Map();
}

// Helper function to save cooldowns to sessionStorage
function saveCooldowns(key: string, map: Map<string, number>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
  } catch (e) {
    console.error('Error saving cooldowns:', e);
  }
}

const statusLabels: Record<TableStatus, string> = {
  available: 'Livre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  bill_requested: 'Conta Pedida',
};

const statusColors: Record<TableStatus, string> = {
  available: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  occupied: 'bg-red-500 hover:bg-red-600 text-white',
  reserved: 'bg-amber-500 hover:bg-amber-600 text-white',
  bill_requested: 'bg-sky-500 hover:bg-sky-600 text-white',
};

const reservationStatusLabels: Record<string, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Concluída',
  no_show: 'Não compareceu',
};

const timeSlots = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  pix: 'Pix',
};

const paymentMethodIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  debit_card: <CreditCard className="h-5 w-5" />,
  pix: <Smartphone className="h-5 w-5" />,
};

interface RegisteredPayment {
  method: PaymentMethod;
  amount: number;
  observation?: string;
}

export default function Tables() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasAnyRole, isAdmin } = useUserRole();
  const { hasPermission } = useUserPermissions();
  
  // Granular permission checks
  const canDeleteItems = hasPermission('tables_cancel_items');
  const canReopenTable = hasPermission('tables_reopen');
  const canSwitchTable = hasPermission('tables_switch');
  const canManagePayments = hasPermission('tables_manage_payments');
  const canCloseBill = hasPermission('tables_close');
  const canCancelOrder = hasPermission('tables_cancel_order');
  const canChangeFees = hasPermission('tables_change_fees');
  
  const { settings: tableWaitSettings } = useTableWaitSettings();
  const { settings: idleTableSettings } = useIdleTableSettings();
  const { playOrderReadySound, playTableWaitAlertSound, playIdleTableAlertSound, settings: audioSettings } = useAudioNotification();
  const { getInitialOrderStatus, settings: kdsSettings } = useKdsSettings();
  const { autoPrintKitchenTicket, autoPrintCustomerReceipt, duplicateKitchenTicket, duplicateItems, duplicateItemsMaxQty } = useOrderSettings();
  const printer = usePrinterOptional();
  const centralPrinting = useCentralizedPrinting();
  const { data: printSectors } = usePrintSectors();
  const { profile } = useProfile();
  const { data: tables, isLoading } = useTables();
  const { data: orders } = useOrders(['pending', 'preparing', 'ready', 'delivered']);
  const { data: allOrders } = useOrders(['pending', 'preparing', 'ready', 'delivered', 'cancelled']);
  const { createTable, updateTable } = useTableMutations();
  const { createOrder, updateOrder, addOrderItem, addOrderItemExtras, addOrderItemSubItems, cancelOrderItem } = useOrderMutations();
  
  // Cash register hooks
  const { data: openCashRegister } = useOpenCashRegister();
  const { createPayment } = useCashRegisterMutations();
  
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: reservations } = useReservations(selectedDate);
  const { createReservation, cancelReservation, updateReservation } = useReservationMutations();
  
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [isOpenTableDialogOpen, setIsOpenTableDialogOpen] = useState(false);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableViewMode, setTableViewMode] = useState<'consumo' | 'resumo'>('consumo');
  const [isServingItem, setIsServingItem] = useState<string | null>(null);
  const [tableToOpen, setTableToOpen] = useState<Table | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [openTableData, setOpenTableData] = useState({ people: 2, identification: '' });

  // Bill closing flow states
  const [isClosingBill, setIsClosingBill] = useState(false);
  const [registeredPayments, setRegisteredPayments] = useState<RegisteredPayment[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentObservation, setPaymentObservation] = useState('');
  const [confirmCloseModalOpen, setConfirmCloseModalOpen] = useState(false);
  const [transactionCodeModalOpen, setTransactionCodeModalOpen] = useState(false);
  const [transactionCode, setTransactionCode] = useState('');
  
  // Discount states
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  
  // Service charge states
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState(10);
  
  // Bill splitting states
  const [splitBillEnabled, setSplitBillEnabled] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<number[]>([]);

  // Switch table states
  const [isSwitchTableDialogOpen, setIsSwitchTableDialogOpen] = useState(false);
  const [isSwitchingTable, setIsSwitchingTable] = useState(false);

  // Reopen table states
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [closedOrderToReopen, setClosedOrderToReopen] = useState<Order | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  

  // Cancel order states
  const [isCancelOrderDialogOpen, setIsCancelOrderDialogOpen] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const MIN_REASON_LENGTH = 10;

  // Cancel item states
  const [cancelItemDialogOpen, setCancelItemDialogOpen] = useState(false);
  const [itemToCancel, setItemToCancel] = useState<{ id: string; orderId: string; name: string; quantity: number; price: number } | null>(null);
  const [isCancellingItem, setIsCancellingItem] = useState(false);

  // Loading states for better UX feedback
  const [isClosingEmptyTable, setIsClosingEmptyTable] = useState(false);
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [isOpeningTable, setIsOpeningTable] = useState(false);
  const [isFinalizingBill, setIsFinalizingBill] = useState(false);

  // New order flow states - pending items before sending to kitchen
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [pendingCartItems, setPendingCartItems] = useState<CartItem[]>([]);

  // Pending cart helper functions
  const addToPendingCart = useCallback((item: CartItem) => {
    setPendingCartItems(prev => [...prev, item]);
  }, []);

  const removeFromPendingCart = useCallback((itemId: string) => {
    setPendingCartItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updatePendingCartQuantity = useCallback((itemId: string, delta: number) => {
    setPendingCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty, total_price: item.unit_price * newQty };
    }));
  }, []);

  const duplicatePendingCartItem = useCallback((itemId: string) => {
    setPendingCartItems(prev => {
      const itemToDuplicate = prev.find(item => item.id === itemId);
      if (!itemToDuplicate) return prev;
      const newItem: CartItem = {
        ...itemToDuplicate,
        id: `${itemToDuplicate.product_id}-${Date.now()}`,
        quantity: 1,
        total_price: itemToDuplicate.unit_price,
      };
      return [...prev, newItem];
    });
  }, []);

  const clearPendingCart = useCallback(() => {
    setPendingCartItems([]);
    setIsAddingMode(false);
  }, []);

  const togglePendingCartFulfillment = useCallback((itemId: string) => {
    setPendingCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, fulfillment_type: item.fulfillment_type === 'takeaway' ? null : 'takeaway' as const };
    }));
  }, []);

  const pendingCartTotal = useMemo(() => {
    return pendingCartItems.reduce((sum, item) => sum + item.total_price, 0);
  }, [pendingCartItems]);

  // Mobile order flow states
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const [isCartReviewOpen, setIsCartReviewOpen] = useState(false);

  // Handler to send pending cart items to kitchen (mobile flow)
  const handleSendPendingCartToKitchen = async () => {
    if (pendingCartItems.length === 0) return;
    
    // Use the existing handleAddOrderItems function
    await handleAddOrderItems(pendingCartItems);
    
    // Clear pending cart and close drawers
    setPendingCartItems([]);
    setIsOrderDrawerOpen(false);
    setIsCartReviewOpen(false);
    setIsAddingMode(false);
  };

  // Set mobile device flag for toast suppression
  useEffect(() => {
    setMobileDevice(isMobile);
  }, [isMobile]);

  // Reset adding mode when table status changes from occupied
  useEffect(() => {
    if (selectedTable && selectedTable.status !== 'occupied') {
      setIsAddingMode(false);
      setPendingCartItems([]);
      setIsOrderDrawerOpen(false);
      setIsCartReviewOpen(false);
    }
  }, [selectedTable?.status]);

  // Reset tableViewMode to 'consumo' when changing tables or exiting closing mode
  useEffect(() => {
    setTableViewMode('consumo');
  }, [selectedTable?.id]);

  useEffect(() => {
    if (!isClosingBill) {
      setTableViewMode('consumo');
    }
  }, [isClosingBill]);

  // Handle serving individual order item
  const handleServeOrderItem = async (itemId: string) => {
    try {
      setIsServingItem(itemId);
      const { error } = await supabase
        .from('order_items')
        .update({ served_at: new Date().toISOString() })
        .eq('id', itemId);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      toast.success('Item marcado como servido');
    } catch (error) {
      console.error('Error serving item:', error);
      toast.error('Erro ao marcar item como servido');
    } finally {
      setIsServingItem(null);
    }
  };

  // Realtime subscription for orders — REMOVED: already handled by useOrders hook
  // Alerts (pedido pronto, espera, KDS idle, mesa ociosa) — movidos para GlobalAlerts.tsx

  const getTableOrder = (tableId: string) => {
    // 1. Primeiro, buscar pedidos ativos (não cancelled, não delivered)
    const activeOrder = orders?.find(o => 
      o.table_id === tableId && 
      o.status !== 'cancelled' &&
      o.status !== 'delivered'
    );
    
    // Se encontrou pedido ativo (mesmo draft vazio), retornar
    if (activeOrder) return activeOrder;
    
    // 2. Se não há pedido ativo, não retornar nada
    // (pedidos delivered agora têm table_id = NULL devido ao trigger)
    return undefined;
  };

  // Mark order as delivered (closes the order)
  const handleMarkAsDelivered = async (orderId: string) => {
    try {
      await updateOrder.mutateAsync({ 
        id: orderId, 
        status: 'delivered',
        delivered_at: new Date().toISOString()
      } as any);
      toast.success('Pedido marcado como entregue!', {
        description: 'O pedido foi entregue na mesa.',
      });
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      toast.error('Erro ao marcar pedido como entregue');
    }
  };

  // Mark order as served (just visual marker, keeps order active)
  const handleMarkAsServed = async (orderId: string) => {
    try {
      await updateOrder.mutateAsync({ 
        id: orderId, 
        served_at: new Date().toISOString()
      });
      toast.success('Itens marcados como servidos!', {
        description: 'O cliente pode continuar pedindo ou fechar a conta.',
      });
    } catch (error) {
      console.error('Error marking order as served:', error);
      toast.error('Erro ao marcar como servido');
    }
  };

  const getTableReservation = (tableId: string) => {
    return reservations?.find(r => r.table_id === tableId && r.status === 'confirmed');
  };

  // Get closed (delivered) orders for a table in the last 24 hours
  const getClosedTableOrders = (tableId: string) => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return allOrders?.filter(o => 
      o.table_id === tableId && 
      o.status === 'delivered' &&
      o.order_items && 
      o.order_items.length > 0 &&
      new Date(o.updated_at || o.created_at!) > oneDayAgo
    ) || [];
  };


  // Get the current KDS station for an order (based on items' current_station)
  const getOrderCurrentStation = (order: Order | undefined): OrderItemStation | null => {
    if (!order?.order_items || order.order_items.length === 0) return null;
    
    // Find items with station info (non-completed items)
    const itemsWithStation = order.order_items.filter(
      item => item.current_station && item.station_status !== 'completed'
    );
    if (itemsWithStation.length === 0) return null;
    
    // Get the station with lowest sort_order (earliest in the flow)
    const earliestItem = itemsWithStation.reduce((earliest, item) => {
      if (!earliest.current_station) return item;
      if (!item.current_station) return earliest;
      const earliestOrder = earliest.current_station.sort_order ?? 999;
      const itemOrder = item.current_station.sort_order ?? 999;
      return itemOrder < earliestOrder ? item : earliest;
    });
    
    return earliestItem.current_station || null;
  };

  // Analyze all order items to determine KDS status (handles multiple items at different stages)
  const getOrderKdsStatus = (order: Order | undefined) => {
    if (!order?.order_items || order.order_items.length === 0) {
      return { status: 'none' as const, station: null as OrderItemStation | null, counts: { ready: 0, inProgress: 0, pending: 0, served: 0 } };
    }

    // Filter only non-cancelled items
    const activeItems = order.order_items.filter(item => !item.cancelled_at);
    
    // Count items in each state
    const readyStatuses = ['ready', 'dispatched', 'done', 'completed'];
    const counts = {
      ready: activeItems.filter(item => 
        (readyStatuses.includes(item.station_status || '') || (!item.current_station_id && item.station_status !== 'waiting' && item.station_status !== 'in_progress' && item.station_status !== 'in_oven' && item.station_status !== null && item.station_status !== undefined)) && !item.served_at
      ).length,
      inOven: activeItems.filter(item =>
        item.station_status === 'in_oven' && !item.served_at
      ).length,
      inProgress: activeItems.filter(item => 
        item.current_station && item.station_status !== 'in_oven' && !readyStatuses.includes(item.station_status || '') && !item.served_at
      ).length,
      pending: activeItems.filter(item => 
        !item.current_station && !item.served_at && (item.station_status === 'waiting' || !item.station_status)
      ).length,
      served: activeItems.filter(item => item.served_at).length,
    };

    // Determine priority status (order: ready > inOven > inProgress > pending > served)
    let status: 'ready' | 'inOven' | 'inProgress' | 'pending' | 'served' | 'none' = 'none';
    let station: OrderItemStation | null = null;

    if (counts.ready > 0) {
      status = 'ready';
    } else if (counts.inOven > 0) {
      status = 'inOven';
    } else if (counts.inProgress > 0) {
      status = 'inProgress';
      // Get the station of the most recent in-progress item
      const inProgressItem = activeItems.find(item => 
        item.current_station && item.station_status !== 'in_oven' && !readyStatuses.includes(item.station_status || '') && !item.served_at
      );
      station = inProgressItem?.current_station || null;
    } else if (counts.pending > 0) {
      status = 'pending';
    } else if (counts.served > 0) {
      status = 'served';
    }

    return { status, station, counts };
  };

  const handleTableClick = (table: Table) => {
    // Reset closing states when switching tables to prevent data leak
    setIsClosingBill(false);
    setRegisteredPayments([]);
    setDiscountType('percentage');
    setDiscountValue(0);
    setServiceChargeEnabled(false);
    setServiceChargePercent(10);
    setSplitBillEnabled(false);
    setSplitCount(2);
    setSplitMode('equal');
    setCustomSplits([]);
    
    if (table.status === 'available') {
      setTableToOpen(table);
      setOpenTableData({ people: table.capacity || 2, identification: '' });
      setIsOpenTableDialogOpen(true);
    } else {
      setSelectedTable(table);
    }
  };



  const handleCloseTable = async () => {
    if (!selectedTable) return;
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'available' });
    setSelectedTable(null);
  };

  const handleRequestBill = async () => {
    if (!selectedTable) return;
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'bill_requested' });
    setSelectedTable({ ...selectedTable, status: 'bill_requested' });
  };

  const handleAddOrderItems = async (items: CartItem[]) => {
    console.log('[handleAddOrderItems] Called with', items.length, 'items, selectedTable:', selectedTable?.id);
    if (!selectedTable) {
      console.error('[handleAddOrderItems] No selectedTable, aborting');
      return;
    }
    
    // Buscar pedido da mesa incluindo drafts vazios (mesa recém-aberta)
    // Permite adicionar itens a pedidos ready/delivered - o trigger cuidará de voltar para preparing
    let order = orders?.find(o => 
      o.table_id === selectedTable.id && 
      o.status !== 'cancelled'
    );
    
    // Fallback: se o cache do react-query ainda não atualizou (race condition ao abrir mesa),
    // buscar diretamente no banco de dados e, em último caso, criar o draft na hora.
    if (!order) {
      console.warn('[handleAddOrderItems] Order not in cache, fetching from DB for table', selectedTable.id);
      const { data: dbOrder, error: dbError } = await supabase
        .from('orders')
        .select('id, status, is_draft, table_id')
        .eq('table_id', selectedTable.id)
        .neq('status', 'cancelled')
        .or('is_draft.eq.true,status.in.(pending,preparing,ready)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbError) {
        console.error('[handleAddOrderItems] Error fetching order from DB', dbError);
        toast.error('Erro ao localizar pedido da mesa');
        return;
      }

      if (dbOrder) {
        order = dbOrder as any;
        console.log('[handleAddOrderItems] Found order from DB:', order?.id);
      } else {
        console.warn('[handleAddOrderItems] No persisted order found, creating draft on demand for table', selectedTable.id);
        order = await createOrder.mutateAsync({
          table_id: selectedTable.id,
          order_type: 'dine_in',
          status: getInitialOrderStatus(),
          customer_name: openTableData.identification || null,
          party_size: openTableData.people || null,
          is_draft: true,
        }) as any;
        console.log('[handleAddOrderItems] Draft order created on demand:', order?.id);
      }
    } else {
      console.log('[handleAddOrderItems] Found order in cache:', order.id, 'status:', order.status);
    }

    // Fechar modal imediatamente para feedback visual
    setIsAddOrderModalOpen(false);
    setIsAddingItems(true);

    try {
      // O trigger auto_initialize_new_order_item cuidará de:
      // 1. Atribuir estação KDS ao item
      // 2. Mudar status do pedido de 'delivered' para 'preparing' automaticamente

      for (const item of items) {
        // Quando duplicateItems está ativo, "explodir" itens com quantity > 1
        // salvando cada unidade como um registro separado no banco
        const shouldDuplicate = duplicateItems && item.quantity > 1 && (duplicateItemsMaxQty <= 0 || item.quantity <= duplicateItemsMaxQty);
        const quantityToSave = shouldDuplicate ? 1 : item.quantity;
        const iterationCount = shouldDuplicate ? item.quantity : 1;
        
        console.log('[handleAddOrderItems] Inserting item:', item.product_name, 'qty:', quantityToSave, 'iterations:', iterationCount);
        
        for (let i = 0; i < iterationCount; i++) {
          const orderItem = await addOrderItem.mutateAsync({
            order_id: order.id,
            product_id: item.product_id,
            variation_id: item.variation_id || null,
            quantity: quantityToSave,
            unit_price: item.unit_price,
            total_price: item.unit_price * quantityToSave,
            notes: item.notes || null,
            status: getInitialOrderStatus(),
            fulfillment_type: item.fulfillment_type || null,
          });
          console.log('[handleAddOrderItems] Item inserted successfully:', orderItem.id);

          // Optimistically add item to cache so Resumo shows it immediately
          queryClient.setQueriesData(
            { queryKey: ['orders'] },
            (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.map((o: any) => {
                if (o.id !== order.id) return o;
                const alreadyExists = (o.order_items || []).some((i: any) => i.id === orderItem.id);
                if (alreadyExists) return o;
                return {
                  ...o,
                  order_items: [...(o.order_items || []), {
                    ...orderItem,
                    product: { name: item.product_name, image_url: null },
                    variation: item.variation_name ? { name: item.variation_name } : null,
                    extras: [],
                    sub_items: [],
                    current_station: null,
                    added_by_profile: null,
                  }],
                };
              });
            }
          );

          // Save complements/extras if present
          if (item.complements && item.complements.length > 0) {
            const extras = item.complements.map(c => ({
              order_item_id: orderItem.id,
              extra_name: `${c.group_name}: ${c.option_name}`,
              price: c.price * c.quantity,
              extra_id: c.option_id || null,
              kds_category: c.kds_category || 'complement',
            }));
            await addOrderItemExtras.mutateAsync(extras);
          }

          // Save sub-items (individual pizzas in a combo) if present
          if (item.subItems && item.subItems.length > 0) {
            await addOrderItemSubItems.mutateAsync({
              order_item_id: orderItem.id,
              sub_items: item.subItems.map(si => ({
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
      }

      // Mark order as no longer draft - now it can appear in KDS
      if (order.is_draft) {
        await updateOrder.mutateAsync({
          id: order.id,
          is_draft: false
        });
      }

      toast.success('Itens adicionados!');

      // Cancel any in-flight background refetches triggered by intermediate invalidateQueries
      // calls (createOrder.onSuccess, addOrderItem.onSuccess, etc.) to prevent a stale
      // response that started before all items were in DB from overwriting our final refetch.
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      // Await refetch so Resumo has confirmed server data before print runs
      await queryClient.refetchQueries({ queryKey: ['orders'], type: 'active' });

      // DEBUG: log cache state after refetch
      const cacheAfterRefetch = queryClient.getQueriesData<any[]>({ queryKey: ['orders'] });
      cacheAfterRefetch.forEach(([key, data]) => {
        if (!Array.isArray(data)) return;
        const targetOrder = data.find((o: any) => o.id === order.id);
        console.log('[Cache Debug] key:', JSON.stringify(key), '| order found:', !!targetOrder, '| order_items count:', targetOrder?.order_items?.length ?? 'N/A', '| total:', targetOrder?.total);
      });

      // Auto-print kitchen ticket if enabled - with detailed logging
      console.log('[Print Debug] Checking auto-print conditions:', {
        autoPrintKitchenTicket,
        printerExists: !!printer,
        canPrintToKitchen: printer?.canPrintToKitchen,
        selectedTable: selectedTable?.number,
      });
      
      if (!autoPrintKitchenTicket) {
        console.log('[Print Debug] Auto-print disabled in settings');
      } else if (!centralPrinting.canPrintToKitchen) {
        console.log('[Print Debug] Cannot print to kitchen (no printer or queue)');
      } else if (selectedTable) {
        try {
          // Use centralized printing (queue or direct)
          // "Explodir" itens com quantity > 1 quando duplicateItems está ativo
          const sectorItems: SectorPrintItem[] = [];
          for (const item of items) {
            if (duplicateItems && item.quantity > 1 && (duplicateItemsMaxQty <= 0 || item.quantity <= duplicateItemsMaxQty)) {
              // Criar linhas separadas para cada unidade
              for (let i = 0; i < item.quantity; i++) {
                sectorItems.push({
                  quantity: 1,
                  productName: item.product_name,
                  variation: item.variation_name,
                  extras: buildPrintExtras(item.complements, item.subItems),
                  notes: item.notes,
                  print_sector_id: item.print_sector_id,
                  fulfillment_type: item.fulfillment_type,
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
                fulfillment_type: item.fulfillment_type,
              });
            }
          }
          
          const printOk = await centralPrinting.printKitchenTicketsBySector(
            sectorItems,
            {
              orderNumber: order.id.slice(0, 8).toUpperCase(),
              orderType: 'dine_in',
              tableNumber: selectedTable.number,
              customerName: order.customer_name || undefined,
              notes: order.notes || undefined,
              createdAt: new Date().toISOString(),
            },
            duplicateKitchenTicket
          );

          if (printOk) {
            toast.success(centralPrinting.shouldQueue ? '🖨️ Comanda enviada para fila' : '🖨️ Comanda impressa');
          } else {
            toast.error('Erro ao imprimir comanda. Verifique a impressora.');
          }
        } catch (err) {
          console.error('[Print Debug] Auto print failed:', err);
          toast.error('Erro ao imprimir comanda.');
        }
      }
    } catch (error) {
      console.error('Error adding order items:', error);
      toast.error('Erro ao adicionar itens');
    } finally {
      setIsAddingItems(false);
    }
  };

  // Switch table function with audit log
  const handleSwitchTable = async (newTableId: string) => {
    if (!selectedTable || !selectedOrder) return;
    
    setIsSwitchingTable(true);
    try {
      const newTable = tables?.find(t => t.id === newTableId);
      if (!newTable) throw new Error('Mesa não encontrada');
      
      // 1. Log the table switch for audit
      await supabase.from('table_switches').insert({
        order_id: selectedOrder.id,
        from_table_id: selectedTable.id,
        to_table_id: newTableId,
        switched_by: user?.id || null,
      });
      
      // 2. Update order with new table
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        table_id: newTableId
      });
      
      // 3. Free the old table
      await updateTable.mutateAsync({
        id: selectedTable.id,
        status: 'available'
      });
      
      // 4. Occupy the new table
      await updateTable.mutateAsync({
        id: newTableId,
        status: 'occupied'
      });
      
      toast.success(`Mesa trocada: ${selectedTable.number} → ${newTable.number}`);
      setIsSwitchTableDialogOpen(false);
      setSelectedTable({ ...newTable, status: 'occupied' });
    } catch (error: any) {
      console.error('Error switching table:', error);
      toast.error('Erro ao trocar mesa');
    } finally {
      setIsSwitchingTable(false);
    }
  };


  // Close empty table (no consumption)
  const handleCloseEmptyTable = async () => {
    if (!selectedTable) return;
    
    const tableNumber = selectedTable.number;
    setIsClosingEmptyTable(true);
    
    // Fechar painel/dialog imediatamente para feedback visual
    setSelectedTable(null);
    
    try {
      // Buscar qualquer pedido draft vazio associado a esta mesa
      const draftOrder = orders?.find(o => 
        o.table_id === selectedTable.id && 
        o.is_draft === true && 
        (!o.order_items || o.order_items.length === 0) &&
        o.status !== 'cancelled'
      );
      
      // Se existir draft vazio, cancelar para limpeza
      if (draftOrder) {
        await updateOrder.mutateAsync({ 
          id: draftOrder.id, 
          status: 'cancelled',
          table_id: null // Desassociar da mesa
        });
      }
      
      // Atualizar mesa para disponível
      await updateTable.mutateAsync({ 
        id: selectedTable.id, 
        status: 'available' 
      });
      
      toast.success(`Mesa ${tableNumber} fechada (sem consumo)`);
    } catch (error) {
      console.error('Error closing empty table:', error);
      toast.error('Erro ao fechar mesa');
    } finally {
      setIsClosingEmptyTable(false);
    }
  };

  // Cancel order with reason
  const handleCancelOrder = async (reason: string) => {
    if (!selectedOrder || !selectedTable) return;
    
    setIsCancellingOrder(true);
    try {
      // Update order with cancellation info using direct supabase call
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by: user?.id,
          cancelled_at: new Date().toISOString(),
          status_before_cancellation: selectedOrder.status,
        })
        .eq('id', selectedOrder.id);
      
      if (orderError) throw orderError;
      
      // Print cancellation ticket to kitchen (if enabled in settings)
      const autoPrint = kdsSettings.autoPrintCancellations ?? true;
      if (autoPrint && printer?.canPrintToKitchen && selectedOrder.order_items && selectedOrder.order_items.length > 0) {
        try {
          const cancellationData: CancellationTicketData = {
            orderNumber: selectedOrder.id,
            orderType: selectedOrder.order_type || 'dine_in',
            tableNumber: selectedTable.number,
            customerName: selectedOrder.customer_name,
            cancellationReason: reason,
            cancelledBy: profile?.name || user?.email || 'Desconhecido',
            items: selectedOrder.order_items.map(item => {
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
          // Don't fail the cancellation if print fails
        }
      }
      
      // Free the table
      await updateTable.mutateAsync({
        id: selectedTable.id,
        status: 'available',
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      toast.success('Pedido cancelado', {
        description: `Motivo: ${reason}`,
      });
      
      setIsCancelOrderDialogOpen(false);
      setSelectedTable(null);
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Erro ao cancelar pedido');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Delete order item (only admin/cashier)
  const handleDeleteOrderItem = async (itemId: string, orderId: string) => {
    if (!canDeleteItems) {
      toast.error('Você não tem permissão para excluir itens');
      return;
    }
    try {
      const { error } = await supabase.from('order_items').delete().eq('id', itemId);
      if (error) throw error;
      
      // Recalculate order total
      const { data: remainingItems } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', orderId);
      
      const newTotal = remainingItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
      await updateOrder.mutateAsync({ id: orderId, total: newTotal, subtotal: newTotal });
      
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Item removido');
    } catch (error) {
      toast.error('Erro ao remover item');
    }
  };


  const handleConfirmArrival = async (reservation: Reservation) => {
    await updateReservation.mutateAsync({ id: reservation.id, status: 'completed' });
    await updateTable.mutateAsync({ id: reservation.table_id, status: 'occupied' });
    await createOrder.mutateAsync({
      table_id: reservation.table_id,
      order_type: 'dine_in',
      status: getInitialOrderStatus(),
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone,
    });
    setSelectedReservation(null);
  };

  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, "EEE, dd 'de' MMM", { locale: ptBR }),
    };
  });

  const selectedOrder = selectedTable ? getTableOrder(selectedTable.id) : null;

  // Save edited customer name - now uses callback for CustomerNameInput component
  const handleSaveCustomerName = useCallback(async (newName: string) => {
    if (!selectedOrder) return;
    try {
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        customer_name: newName.trim() || null
      });
      toast.success('Nome do cliente atualizado');
    } catch (error) {
      toast.error('Erro ao atualizar nome');
    }
  }, [selectedOrder, updateOrder]);

  // Fetch existing partial payments for the selected order WITH receiver profile
  const { data: existingPayments } = useQuery({
    queryKey: ['payments', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', selectedOrder.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrder?.id,
  });

  // Fetch payments for ALL occupied tables to show partial payment indicators on grid
  const { data: allTablePayments } = useQuery({
    queryKey: ['all-table-payments', tables?.filter(t => t.status === 'occupied').map(t => t.id)],
    queryFn: async () => {
      const occupiedTableIds = tables?.filter(t => t.status === 'occupied').map(t => t.id) || [];
      if (occupiedTableIds.length === 0) return [];
      
      // Get orders for occupied tables (exclude closed/cancelled orders)
      const { data: activeOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, table_id, total')
        .in('table_id', occupiedTableIds)
        .neq('status', 'cancelled')
        .neq('status', 'delivered');
      
      if (ordersError) throw ordersError;
      if (!activeOrders?.length) return [];
      
      // Get payments for those orders
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('order_id, amount')
        .in('order_id', activeOrders.map(o => o.id));
      
      if (paymentsError) throw paymentsError;
      
      // Aggregate by table_id
      return activeOrders.map(order => ({
        table_id: order.table_id,
        order_id: order.id,
        orderTotal: Number(order.total),
        totalPaid: payments
          ?.filter(p => p.order_id === order.id)
          .reduce((sum, p) => sum + Number(p.amount), 0) || 0
      }));
    },
    enabled: !!tables?.length,
  });

  // Create map for quick access to table payment info
  const tablePaymentsMap = useMemo(() => {
    const map = new Map<string, { totalPaid: number; orderTotal: number }>();
    allTablePayments?.forEach(tp => {
      map.set(tp.table_id, { totalPaid: tp.totalPaid, orderTotal: tp.orderTotal });
    });
    return map;
  }, [allTablePayments]);

  // Calculate total already paid (from database)
  const existingPaymentsTotal = useMemo(() => 
    (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0),
    [existingPayments]
  );

  // Payment calculations with discount and service charge
  const subtotal = selectedOrder?.total || 0;
  
  const discountAmount = useMemo(() => {
    if (discountValue <= 0) return 0;
    return discountType === 'percentage' 
      ? (subtotal * discountValue / 100)
      : Math.min(discountValue, subtotal);
  }, [subtotal, discountType, discountValue]);
  
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  
  const serviceAmount = useMemo(() => {
    if (!serviceChargeEnabled) return 0;
    return afterDiscount * serviceChargePercent / 100;
  }, [serviceChargeEnabled, serviceChargePercent, afterDiscount]);
  
  const finalTotal = afterDiscount + serviceAmount;
  
  // Total paid includes existing payments from DB + new payments in this session
  const sessionPaid = useMemo(() => 
    registeredPayments.reduce((sum, p) => sum + p.amount, 0), 
    [registeredPayments]
  );
  
  const totalPaid = existingPaymentsTotal + sessionPaid;
  
  const remainingAmount = Math.max(0, finalTotal - totalPaid);
  const changeAmount = totalPaid > finalTotal ? totalPaid - finalTotal : 0;
  
  // Bill splitting calculations
  const splitAmounts = useMemo(() => {
    if (!splitBillEnabled || splitCount < 2) return [];
    if (splitMode === 'equal') {
      const perPerson = finalTotal / splitCount;
      return Array(splitCount).fill(perPerson);
    }
    return customSplits;
  }, [splitBillEnabled, splitCount, splitMode, finalTotal, customSplits]);
  
  const customSplitsTotal = customSplits.reduce((sum, v) => sum + v, 0);
  const customSplitsRemaining = finalTotal - customSplitsTotal;

  // How many equal shares have been paid (for split-equal mode)
  const perPersonAmount = splitBillEnabled && splitMode === 'equal' && splitCount >= 2
    ? finalTotal / splitCount
    : 0;
  const paidPersonsCount = perPersonAmount > 0
    ? Math.min(splitCount, Math.round(totalPaid / perPersonAmount))
    : 0;
  const nextPersonNumber = paidPersonsCount + 1;

  // Reset closing state when table changes
  useEffect(() => {
    if (selectedTable) {
      setIsClosingBill(selectedTable.status === 'bill_requested');
      setRegisteredPayments([]);
      // Reset discount, service, and split states
      setDiscountType('percentage');
      setDiscountValue(0);
      setServiceChargeEnabled(false);
      setServiceChargePercent(10);
      setSplitBillEnabled(false);
      setSplitCount(2);
      setSplitMode('equal');
      setCustomSplits([]);
    } else {
      setIsClosingBill(false);
      setRegisteredPayments([]);
    }
  }, [selectedTable?.id]);
  
  // Initialize custom splits when split count changes
  useEffect(() => {
    if (splitBillEnabled && splitMode === 'custom') {
      setCustomSplits(Array(splitCount).fill(0));
    }
  }, [splitCount, splitBillEnabled, splitMode]);

  // Start bill closing
  const handleStartClosing = async () => {
    if (!selectedTable) return;
    const order = getTableOrder(selectedTable.id);
    const activeItems = order?.order_items?.filter((item: any) => !item.cancelled_at) || [];
    const allServed = activeItems.length > 0 && activeItems.every((item: any) => item.served_at);
    const canCloseOrder = !order || order.status === 'delivered' || allServed;
    
    // Block closing if not all items served
    if (!canCloseOrder) {
      toast.error('Itens ainda não servidos', {
        description: 'A conta só pode ser fechada após todos os itens serem servidos.',
      });
      return;
    }
    
    setIsClosingBill(true);
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'bill_requested' });
    setSelectedTable({ ...selectedTable, status: 'bill_requested' });
  };

  // Reopen table (cancel closing)
  const handleReopenTable = async () => {
    if (!selectedTable) return;
    setIsClosingBill(false);
    setRegisteredPayments([]);
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'occupied' });
    setSelectedTable({ ...selectedTable, status: 'occupied' });
  };

  // Select payment method and open modal
  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    // On equal split: pre-fill with per-person amount.
    // Last person always pays the actual remaining to absorb rounding differences.
    const isLastPerson = nextPersonNumber >= splitCount;
    const defaultAmount = splitBillEnabled && splitMode === 'equal' && perPersonAmount > 0
      ? isLastPerson ? remainingAmount : Math.min(perPersonAmount, remainingAmount)
      : remainingAmount;
    setPaymentAmount(defaultAmount.toFixed(2).replace('.', ','));
    setPaymentObservation('');
    setPaymentModalOpen(true);
  };

  // Confirm individual payment (adds to session list, not DB yet)
  const handleConfirmPayment = () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    
    const newPayment: RegisteredPayment = {
      method: selectedPaymentMethod!,
      amount,
      observation: paymentObservation || undefined,
    };
    
    const updatedPayments = [...registeredPayments, newPayment];
    setRegisteredPayments(updatedPayments);
    setPaymentModalOpen(false);
    
    // Only auto-prompt close when NOT in split mode — in split the user reviews first
    if (!splitBillEnabled) {
      const newSessionPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const newTotalPaid = existingPaymentsTotal + newSessionPaid;
      if (newTotalPaid >= finalTotal) {
        setConfirmCloseModalOpen(true);
      }
    }
  };

  // Handle partial payment - saves to DB immediately, table stays open
  const handlePartialPayment = async () => {
    if (!selectedOrder || !selectedPaymentMethod) return;
    
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      // Check if this payment covers the remaining balance
      const totalAfterThis = existingPaymentsTotal + amount;
      const coversTotal = totalAfterThis >= finalTotal - 0.01;

      await createPayment.mutateAsync({
        order_id: selectedOrder.id,
        cash_register_id: openCashRegister?.id || null,
        payment_method: selectedPaymentMethod,
        amount: amount,
        is_partial: !coversTotal,
        observation: paymentObservation || undefined,
      });

      // Print partial payment receipt
      try {
        await printPartialPaymentReceipt({
          orderTotal: finalTotal,
          paymentAmount: amount,
          paymentMethod: selectedPaymentMethod,
          existingPayments: existingPayments || [],
          tableNumber: selectedTable?.number,
          customerName: selectedOrder.customer_name || undefined,
          orderId: selectedOrder.id,
          coversTotal,
          logoUrl: localStorage.getItem('pdv_restaurant_logo_url') || undefined,
          items: selectedOrder.order_items
            ?.filter((item: any) => !item.cancelled_at)
            .map((item: any) => {
              const extraNames: string[] = [];
              if (item.extras && item.extras.length > 0) {
                item.extras.forEach((e: any) => {
                  const raw = e.extra_name || '';
                  // Extract only the option part: "Size | Group: # Option" → "Option"
                  const clean = raw.includes('# ')
                    ? (raw.split('# ').pop() || raw).trim()
                    : raw.includes(': ')
                      ? raw.split(': ').slice(1).join(': ').trim()
                      : raw.trim();
                  if (clean) extraNames.push(clean);
                });
              }
              if (item.sub_items && item.sub_items.length > 0) {
                const total = item.sub_items.length;
                item.sub_items.forEach((sub: any) => {
                  const prefix = total > 1 ? `${sub.sub_item_index}/${total} ` : '';
                  const flavors = sub.sub_extras
                    ?.map((ext: any) => ext.option_name)
                    .filter(Boolean)
                    .join(', ') || '';
                  if (flavors) extraNames.push(`${prefix}${flavors}`);
                  if (sub.notes) extraNames.push(`  Obs: ${sub.notes}`);
                });
              }
              return {
                quantity: item.quantity,
                productName: item.product?.name || 'Produto',
                variation: item.variation?.name || null,
                extras: extraNames.length > 0 ? extraNames : undefined,
                totalPrice: item.total_price,
              };
            }) || [],
        }, printer);
        toast.success(coversTotal ? 'Pagamento registrado e comprovante impresso!' : 'Pagamento parcial registrado e comprovante impresso!');
      } catch (printError) {
        console.error('Error printing partial payment receipt:', printError);
        toast.success('Pagamento parcial registrado!');
      }

      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentObservation('');
      
      // Invalidate payments query to refresh
      queryClient.invalidateQueries({ queryKey: ['payments', selectedOrder.id] });
    } catch (error) {
      console.error('Error creating partial payment:', error);
      toast.error('Erro ao registrar pagamento parcial');
    }
  };

  // Remove a registered payment
  const handleRemovePayment = (index: number) => {
    setRegisteredPayments(prev => prev.filter((_, i) => i !== index));
  };

  // Finalize bill closing
  const handleFinalizeBill = async () => {
    if (!selectedOrder || !selectedTable) return;
    
    // Calculate total paid (session payments + existing partial payments)
    const sessionPaymentsTotal = registeredPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalPaidAmount = sessionPaymentsTotal + existingPaymentsTotal;
    
    // Validate: must have at least one payment method and cover the total
    if (registeredPayments.length === 0 && existingPaymentsTotal === 0) {
      toast.error('Selecione pelo menos uma forma de pagamento');
      return;
    }
    
    if (totalPaidAmount < finalTotal - 0.01) { // Allow 1 cent tolerance for rounding
      toast.error(`Valor pago (${formatCurrency(totalPaidAmount)}) é menor que o total (${formatCurrency(finalTotal)})`);
      return;
    }
    
    const tableNumber = selectedTable.number;
    
    // Fechar modal de confirmação imediatamente
    setConfirmCloseModalOpen(false);
    setIsFinalizingBill(true);
    
    try {
      // Register any pending session payments in database (non-partial)
      for (const payment of registeredPayments) {
        await createPayment.mutateAsync({
          order_id: selectedOrder.id,
          cash_register_id: openCashRegister?.id || null,
          payment_method: payment.method,
          amount: payment.amount,
          is_partial: false, // Final payment closes the table
          observation: payment.observation || undefined,
        });
      }

      // If no session payments but we have existing partial payments, we need to close the table manually
      if (registeredPayments.length === 0 && existingPaymentsTotal > 0) {
        // Update order status to delivered and clear table_id
        await supabase
          .from('orders')
          .update({ 
            status: 'delivered',
            table_id: null, // Desassociar da mesa para evitar conflitos futuros
            delivered_at: new Date().toISOString()
          })
          .eq('id', selectedOrder.id);

        // Update table status to available
        await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', selectedTable.id);
        
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['tables'] });
      }

      // Save transaction code to the order
      if (transactionCode.trim()) {
        await supabase
          .from('orders')
          .update({ transaction_code: transactionCode.trim() })
          .eq('id', selectedOrder.id);
      }

      // Print final receipt
      try {
        const allPayments = [
          ...(existingPayments || []),
          ...registeredPayments.map(p => ({
            id: '',
            order_id: selectedOrder.id,
            payment_method: p.method,
            amount: p.amount,
            cash_register_id: openCashRegister?.id || null,
            received_by: null,
            created_at: new Date().toISOString(),
            observation: p.observation || null,
          })),
        ];
        const receiptData = propsToReceiptData({
          order: selectedOrder,
          payments: allPayments,
          discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
          serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
          splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
          tableNumber: selectedTable.number,
          restaurantName: localStorage.getItem('pdv_restaurant_name') || undefined,
          restaurantAddress: localStorage.getItem('pdv_restaurant_address') || undefined,
          restaurantPhone: localStorage.getItem('pdv_restaurant_phone') || undefined,
          logoUrl: localStorage.getItem('pdv_restaurant_logo_url') || undefined,
        });
        await centralPrinting.printCustomerReceipt(receiptData);
      } catch (printErr) {
        console.error('Error printing final receipt:', printErr);
      }

      // Clear state and close
      setIsClosingBill(false);
      setRegisteredPayments([]);
      setSelectedTable(null);
      setTransactionCode('');
      setTransactionCodeModalOpen(false);

      toast.success(`Mesa ${tableNumber} fechada com sucesso!`);
    } catch (error) {
      console.error('Error finalizing bill:', error);
      toast.error('Erro ao finalizar conta');
    } finally {
      setIsFinalizingBill(false);
    }
  };

  return (
    <PDVLayout>
      <Tabs defaultValue="tables" className="h-full flex flex-col">
        {/* Tabs centralizadas no topo */}
        <div className="flex justify-end mb-4">
          <TabsList>
            <TabsTrigger value="tables">Mesas</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
          </TabsList>
        </div>

        {/* Título abaixo das tabs */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Mesas</h1>
          <p className="text-muted-foreground">Gerencie mesas e reservas</p>
        </div>

        <TabsContent value="tables" className="flex-1 m-0">
          <div className="flex h-full gap-4">
            {/* Tables Grid - Layout fixo */}
            <div className="flex flex-col flex-1 lg:w-2/3">
              {/* Legenda */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-wrap gap-4">
                  {Object.entries(statusLabels).map(([status, label]) => (
                    <div key={status} className="flex items-center gap-2">
                      <div className={cn('w-4 h-4 rounded', statusColors[status as TableStatus])} />
                      <span className="text-sm text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-xl border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-5 w-16 bg-muted rounded" />
                        <div className="h-5 w-5 bg-muted rounded-full" />
                      </div>
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-20 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {tables?.map((table) => {
                    const order = getTableOrder(table.id);
                    const reservation = getTableReservation(table.id);
                    const isSelected = selectedTable?.id === table.id;
                    
                    // Analyze KDS status based on individual items
                    const kdsStatus = getOrderKdsStatus(order);
                    const hasReadyItems = kdsStatus.status === 'ready';
                    
                    // Check for partial payments
                    const tablePaymentInfo = tablePaymentsMap.get(table.id);
                    const hasPartialPayment = tablePaymentInfo && 
                      tablePaymentInfo.totalPaid > 0 && 
                      tablePaymentInfo.totalPaid < tablePaymentInfo.orderTotal;
                    
                    // Calculate wait time
                    const waitMinutes = order?.created_at 
                      ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                      : 0;
                    const waitTimeColor = waitMinutes < 10 ? 'text-green-200' : waitMinutes < 20 ? 'text-yellow-200' : 'text-red-200';
                    
                    return (
                      <Card
                        key={table.id}
                        className={cn(
                          'cursor-pointer transition-all hover:scale-105 relative rounded-lg border-0',
                          statusColors[table.status],
                          isSelected && 'ring-4 ring-sky-400 ring-offset-2',
                          // Borda brilhante para pedidos prontos
                          hasReadyItems && table.status === 'occupied' && 'ring-2 ring-green-400 ring-offset-1 animate-glow-green'
                        )}
                        onClick={() => handleTableClick(table)}
                      >
                        <CardContent className="p-3 flex flex-col items-center justify-center aspect-square relative">
                          
                          {/* Indicador KDS no canto superior direito */}
                          {table.status === 'occupied' && order && kdsStatus.status !== 'none' && (
                            <div className="absolute top-1 right-1">
                              {kdsStatus.status === 'ready' ? (
                                // Pronto - Verde pulsando forte com contagem
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded animate-pulse">
                                  <Bell className="h-2.5 w-2.5" />
                                  PRONTO{kdsStatus.counts.ready > 1 ? ` (${kdsStatus.counts.ready})` : ''}
                                </div>
                              ) : kdsStatus.status === 'inOven' ? (
                                // No forno - Laranja pulsando
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded animate-pulse-soft">
                                  <Flame className="h-2.5 w-2.5" />
                                  FORNO{kdsStatus.counts.inOven > 1 ? ` (${kdsStatus.counts.inOven})` : ''}
                                </div>
                              ) : kdsStatus.status === 'inProgress' && kdsStatus.station ? (
                                // Em producao - Cor da estacao + contagem de pendentes
                                <div 
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-white text-[9px] font-bold rounded animate-pulse-soft"
                                  style={{ backgroundColor: kdsStatus.station.color || '#8B5CF6' }}
                                >
                                  <span className="h-2 w-2 rounded-full bg-white/80" />
                                  {kdsStatus.station.name?.split(' ')[0]?.substring(0, 6)}
                                  {kdsStatus.counts.pending > 0 && <span className="ml-1 opacity-70">+{kdsStatus.counts.pending}</span>}
                                </div>
                              ) : kdsStatus.status === 'pending' ? (
                                // Pendente - Amarelo pulsando com contagem
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500 text-white text-[9px] font-bold rounded animate-pulse-soft">
                                  <Clock className="h-2.5 w-2.5" />
                                  AGUARDA{kdsStatus.counts.pending > 1 ? ` (${kdsStatus.counts.pending})` : ''}
                                </div>
                              ) : kdsStatus.status === 'served' ? (
                                // Todos servidos - Azul estatico
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded">
                                  <Check className="h-2.5 w-2.5" />
                                  SERVIDO
                                </div>
                              ) : null}
                            </div>
                          )}
                          
                          {/* Numero da mesa */}
                          <p className="text-3xl font-bold">{table.number}</p>
                          <p className="text-sm mt-2 font-medium">{statusLabels[table.status]}</p>
                          
                          {/* Indicadores inferiores */}
                          <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
                            {hasPartialPayment && (
                              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                                PARCIAL
                              </span>
                            )}
                            {order && table.status === 'occupied' && waitMinutes > 0 && (
                              <span className={cn("text-[10px] font-medium", waitTimeColor)}>
                                {waitMinutes}min
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Side Panel - Table Details - Sempre visível */}
            <div className="hidden lg:block w-1/3 min-w-[320px]">
              <Card className="h-full flex flex-col">
                {selectedTable ? (
                  <>
                  <CardHeader className="pb-3">
                    {/* Tabs Consumo/Resumo centralizadas no topo */}
                    <div className="flex justify-center mb-3">
                      <div className="flex gap-1 p-1 bg-muted rounded-lg">
                        <Button
                          variant={tableViewMode === 'consumo' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTableViewMode('consumo')}
                        >
                          Consumo
                        </Button>
                        <Button
                          variant={tableViewMode === 'resumo' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTableViewMode('resumo')}
                        >
                          Resumo
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setSelectedTable(null)}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Mesa {selectedTable.number}
                            <Badge className={cn('text-xs', statusColors[selectedTable.status])}>
                              {statusLabels[selectedTable.status]}
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {selectedTable.capacity} lugares
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
                    {/* ===== ABA CONSUMO ===== */}
                    {tableViewMode === 'consumo' && (
                      <>
                    {/* Delivered Banner - Awaiting bill closure */}
                    {selectedOrder?.status === 'delivered' && !isClosingBill && (
                      <div className="bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 p-4 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5" />
                          <p className="font-medium">Pedido Entregue</p>
                        </div>
                        <p className="text-xs opacity-80">Aguardando fechamento da conta</p>
                        
                        {/* Waiter and time info */}
                        <div className="mt-3 pt-3 border-t border-blue-500/20 space-y-1 text-sm">
                          {selectedOrder.created_by_profile?.name && (
                            <div className="flex items-center justify-between">
                              <span className="opacity-70">Garçom:</span>
                              <span className="font-medium">{selectedOrder.created_by_profile.name}</span>
                            </div>
                          )}
                          {selectedOrder.created_at && (
                            <div className="flex items-center justify-between">
                              <span className="opacity-70">Lançado às:</span>
                              <span>{format(new Date(selectedOrder.created_at), 'HH:mm', { locale: ptBR })}</span>
                            </div>
                          )}
                          {selectedOrder.ready_at && (
                            <div className="flex items-center justify-between">
                              <span className="opacity-70">Pronto às:</span>
                              <span>{format(new Date(selectedOrder.ready_at), 'HH:mm', { locale: ptBR })}</span>
                            </div>
                          )}
                          {selectedOrder.delivered_at && (
                            <div className="flex items-center justify-between">
                              <span className="opacity-70">Entregue às:</span>
                              <span>{format(new Date(selectedOrder.delivered_at), 'HH:mm', { locale: ptBR })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* REGULAR VIEW - When NOT closing */}
                    {!isClosingBill && (
                      <>
                        {/* Order Items - Consumo tab shows ALL items with individual status */}
                        {(() => {
                          const allItems = selectedOrder?.order_items || [];
                          const hasAnyItems = allItems.length > 0;
                          
                          // Helper function to determine item status
                          const getItemStatus = (item: any) => {
                            if (item.served_at) return 'served';
                            if (item.station_status === 'ready' || item.station_status === 'dispatched' || item.station_status === 'done' || item.station_status === 'completed') return 'ready';
                            if (item.current_station?.station_type === 'order_status') return 'ready';
                            if (!item.current_station_id && !selectedOrder?.is_draft) return 'ready';
                            if (item.station_status === 'in_oven') return 'in_oven';
                            if (item.current_station_id && item.current_station) return 'in_production';
                            if (selectedOrder?.status === 'pending' || selectedOrder?.is_draft) return 'pending';
                            return 'in_production';
                          };
                          
                          if (hasAnyItems) {
                            return (
                              <div className="flex-1 flex flex-col min-h-0">
                                <h4 className="text-sm font-medium mb-2">Itens do Pedido</h4>
                                <ScrollArea className="flex-1">
                                  <div className="space-y-2 pr-2">
                                    {allItems.map((item: any) => {
                                      const itemStatus = getItemStatus(item);
                                      
                                      return (
                                        <div 
                                          key={item.id} 
                                          className={`flex flex-col p-2 rounded group transition-colors ${
                                            itemStatus === 'served' 
                                              ? 'bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700' 
                                              : itemStatus === 'ready'
                                              ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                                              : 'bg-muted/50'
                                          }`}
                                        >
                                          {/* Status Badge Individual */}
                                          {itemStatus === 'pending' && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 w-fit animate-pulse-soft">
                                              <Clock className="h-3 w-3" />
                                              Aguardando Produção
                                            </div>
                                          )}
                                          {itemStatus === 'in_oven' && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 w-fit animate-pulse-soft bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">
                                              <Flame className="h-3 w-3" />
                                              No Forno
                                            </div>
                                          )}
                                          {itemStatus === 'in_production' && item.current_station && (
                                            <div 
                                              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 w-fit animate-pulse-soft"
                                              style={{ 
                                                backgroundColor: item.current_station.color ? `${item.current_station.color}20` : 'hsl(var(--primary) / 0.1)',
                                                color: item.current_station.color || 'hsl(var(--primary))'
                                              }}
                                            >
                                              <span>●</span>
                                              KDS: {item.current_station.name}
                                            </div>
                                          )}
                                          {itemStatus === 'ready' && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 w-fit animate-pulse-soft">
                                              <Bell className="h-3 w-3" />
                                              Pronto para servir
                                            </div>
                                          )}
                                          {itemStatus === 'served' && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-green-200 dark:bg-green-800/60 text-green-800 dark:text-green-300 w-fit">
                                              <Check className="h-3 w-3" />
                                              Servido
                                            </div>
                                          )}
                                          {item.fulfillment_type === 'takeaway' && (
                                            <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white mb-1.5 w-fit">
                                              🥡 RETIRADA
                                            </span>
                                          )}
                                          
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium">
                                                {item.quantity}x {item.product?.name || 'Produto'}
                                                {item.variation?.name && (
                                                  <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                                )}
                                                {item.sub_items && item.sub_items.length > 0 && (
                                                  <Badge variant="outline" className="ml-2 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                                    {item.sub_items.length === 1 ? '1 SABOR' : `${item.sub_items.length} SABORES`}
                                                  </Badge>
                                                )}
                                              </p>
                                              {/* Sub-items (pizzas individuais) */}
                                              {item.sub_items && item.sub_items.length > 0 ? (
                                                <div className="text-xs text-muted-foreground mt-1 space-y-1.5">
                                                   {item.sub_items
                                                     .sort((a: any, b: any) => a.sub_item_index - b.sub_item_index)
                                                     .map((subItem: any, renderIdx: number) => (
                                                     <div key={subItem.id} className="pl-2 border-l-2 border-primary/30">
                                                       {item.sub_items.length > 1 ? (
                                                          <p className="font-medium text-foreground">🍕 {`1/${item.sub_items.length}`}</p>
                                                       ) : null}
                                                       {subItem.sub_extras && subItem.sub_extras.length > 0 && (
                                                         <div className="pl-2 space-y-0.5">
                                                           {subItem.sub_extras.map((extra: any, idx: number) => (
                                                             <p key={idx}>• {extra.option_name}</p>
                                                           ))}
                                                         </div>
                                                       )}
                                                     </div>
                                                   ))}
                                                </div>
                                              ) : (
                                                /* Sabores/Complementos tradicionais */
                                                item.extras && item.extras.length > 0 && (
                                                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                                    {item.extras.map((extra: any, idx: number) => {
                                                      const displayName = extra.extra_name?.includes(': ') 
                                                        ? extra.extra_name.split(': ').slice(1).join(': ')
                                                        : extra.extra_name || '';
                                                      return displayName ? (
                                                        <p key={idx} className="pl-2">• {displayName}</p>
                                                      ) : null;
                                                    })}
                                                  </div>
                                                )
                                              )}
                                               {/* Fulfillment badge */}
                                               {item.fulfillment_type === 'takeaway' && (
                                                 <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white mb-1.5 w-fit">
                                                   🥡 RETIRADA
                                                 </span>
                                               )}
                                               {/* Borda */}
                                               <OrderItemBorderBadge item={item} />
                                               {/* Observações */}
                                                {item.notes && (
                                                  <div className="mt-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">📝 {item.notes}</div>
                                                )}
                                              {/* Jornada KDS do item */}
                                              <ItemKdsJourney orderItemId={item.id} />
                                            </div>
                                            <div className="flex items-center gap-2 ml-2">
                                              {/* Botão Servir Item - Só aparece se pronto e não servido */}
                                              {itemStatus === 'ready' && (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="text-xs h-7 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/40"
                                                  onClick={() => handleServeOrderItem(item.id)}
                                                  disabled={isServingItem === item.id}
                                                >
                                                  {isServingItem === item.id ? (
                                                    <span className="animate-pulse">...</span>
                                                  ) : (
                                                    <>
                                                      <Check className="h-3 w-3 mr-1" />
                                                      Servir
                                                    </>
                                                  )}
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                              </div>
                            );
                          } else if (selectedTable.status === 'occupied') {
                            return (
                              <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="text-center text-muted-foreground mb-4">
                                  <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Nenhum item no pedido</p>
                                </div>
                                {/* Close empty table button */}
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={handleCloseEmptyTable}
                                  disabled={isClosingEmptyTable}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {isClosingEmptyTable ? 'Fechando...' : 'Fechar Mesa (Sem Consumo)'}
                                </Button>
                              </div>
                            );
                          }
                          return null;
                        })()}

                      </>
                    )}
                      </>
                    )}

                    {/* Mensagem quando mesa está em fechamento e usuário clica em Consumo */}
                    {isClosingBill && tableViewMode === 'consumo' && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-6 max-w-sm">
                          <AlertCircle className="h-12 w-12 text-amber-600 dark:text-amber-400 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300 mb-2">
                            Mesa em Fechamento
                          </h3>
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            Não há consumo nesse momento. Mesa em fechamento.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ===== ABA RESUMO ===== */}
                    {tableViewMode === 'resumo' && selectedOrder && !isClosingBill && (
                      <>
                        {/* Informações do Pedido */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Pedido</span>
                            <span className="font-mono">#{selectedOrder.id.slice(0, 8)}</span>
                          </div>
                          {selectedOrder.created_at && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Aberto há</span>
                              <span>{formatDistanceToNow(new Date(selectedOrder.created_at), { locale: ptBR })}</span>
                            </div>
                          )}
                          {/* Garçom que criou o pedido */}
                          {selectedOrder.created_by_profile?.name && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Garçom</span>
                              <span>{selectedOrder.created_by_profile.name}</span>
                            </div>
                          )}
                          {/* Nome do Cliente editável */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Cliente</span>
                            <CustomerNameInput
                              initialValue={selectedOrder.customer_name}
                              onSave={handleSaveCustomerName}
                            />
                          </div>
                        </div>

                        {/* Lista de Itens Completa */}
                        {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                          <div className="flex-1 flex flex-col min-h-0 border-t pt-3 mt-3">
                            <h4 className="text-sm font-medium mb-2">Itens do Pedido</h4>
                            <ScrollArea className="flex-1">
                              <div className="space-y-2 pr-2">
                                {selectedOrder.order_items.map((item: any) => (
                                  <div 
                                    key={item.id} 
                                    className={cn(
                                      "p-2 rounded",
                                      item.cancelled_at 
                                        ? "bg-destructive/10 border border-destructive/20" 
                                        : "bg-muted/50"
                                    )}
                                  >
                                    <div className="flex justify-between items-start">
                                      <p className={cn(
                                        "text-sm font-medium",
                                        item.cancelled_at && "line-through text-muted-foreground"
                                      )}>
                                        {item.quantity}x {item.product?.name || 'Produto'}
                                        {item.variation?.name && (
                                          <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                        )}
                                        {item.sub_items && item.sub_items.length > 0 && (
                                          <Badge variant="outline" className="ml-2 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                            {item.sub_items.length === 1 ? '1 SABOR' : `${item.sub_items.length} SABORES`}
                                          </Badge>
                                        )}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "text-sm font-medium",
                                          item.cancelled_at && "line-through text-muted-foreground"
                                        )}>
                                          {formatCurrency(item.total_price)}
                                        </span>
                                        {/* Botão cancelar - para itens não cancelados */}
                                        {!item.cancelled_at && canDeleteItems && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                            onClick={() => {
                                              setItemToCancel({
                                                id: item.id,
                                                orderId: selectedOrder.id,
                                                name: `${item.product?.name || 'Produto'}${item.variation?.name ? ` - ${item.variation.name}` : ''}`,
                                                quantity: item.quantity,
                                                price: item.total_price
                                              });
                                              setCancelItemDialogOpen(true);
                                            }}
                                          >
                                            <XCircle className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    {/* Badge cancelado */}
                                    {item.cancelled_at && (
                                      <div className="mt-1 space-y-1">
                                        <Badge variant="destructive" className="text-xs">CANCELADO</Badge>
                                        {item.cancellation_reason && (
                                          <p className="text-xs text-muted-foreground italic">
                                            Motivo: {item.cancellation_reason}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {/* Sub-items (pizzas individuais) COM PREÇOS no Resumo */}
                                    {item.sub_items && item.sub_items.length > 0 && (
                                       <div className="text-xs text-muted-foreground mt-1 space-y-1.5">
                                         {item.sub_items
                                           .sort((a: any, b: any) => a.sub_item_index - b.sub_item_index)
                                           .map((subItem: any, renderIdx: number) => (
                                           <div key={subItem.id} className="pl-2 border-l-2 border-primary/30">
                                             {item.sub_items.length > 1 ? (
                                                <p className="font-medium text-foreground">🍕 {`1/${item.sub_items.length}`}</p>
                                             ) : null}
                                             {subItem.sub_extras && subItem.sub_extras.length > 0 && (
                                               <div className="pl-2 space-y-0.5">
                                                 {subItem.sub_extras.map((extra: any, idx: number) => (
                                                   <p key={idx} className="flex justify-between">
                                                     <span>• {extra.option_name}</span>
                                                     {extra.price > 0 && (
                                                       <span className="text-muted-foreground ml-2">
                                                         {formatCurrency(extra.price)}
                                                       </span>
                                                     )}
                                                   </p>
                                                 ))}
                                               </div>
                                             )}
                                           </div>
                                         ))}
                                      </div>
                                    )}
                                    {/* Extras tradicionais */}
                                    {!item.sub_items?.length && item.extras && item.extras.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                        {item.extras.map((extra: any, idx: number) => {
                                          const displayName = extra.extra_name?.includes(': ') 
                                            ? extra.extra_name.split(': ').slice(1).join(': ')
                                            : extra.extra_name || '';
                                          return displayName ? (
                                            <p key={idx} className="pl-2 flex justify-between">
                                              <span>• {displayName}</span>
                                              {extra.price > 0 && (
                                                <span className="text-muted-foreground ml-2">
                                                  {formatCurrency(extra.price)}
                                                </span>
                                              )}
                                            </p>
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                     {/* Fulfillment badge */}
                                     {item.fulfillment_type === 'takeaway' && (
                                       <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white mb-1.5 w-fit">
                                         🥡 RETIRADA
                                       </span>
                                     )}
                                     {/* Borda */}
                                     <OrderItemBorderBadge item={item} />
                                     {/* Observações */}
                                      {item.notes && (
                                        <div className="mt-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">📝 {item.notes}</div>
                                      )}
                                    {/* Data/hora e garçom */}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 pl-2">
                                      {item.created_at && (
                                        <span>📅 {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                      )}
                                      {item.added_by_profile?.name && (
                                        <span className="text-blue-600">• 👤 {item.added_by_profile.name}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {/* Total */}
                        <div className="border-t pt-3 mt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="text-primary">{formatCurrency(selectedOrder.total || 0)}</span>
                          </div>
                        </div>
                        
                        {/* Botões de ação */}
                        <div className="space-y-2 pt-2">
                          {selectedTable.status === 'occupied' && (
                            <>
                              <Button 
                                className="w-full" 
                                onClick={() => setIsAddOrderModalOpen(true)}
                                disabled={isAddingItems}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                {isAddingItems ? 'Adicionando...' : 'Adicionar Pedido'}
                              </Button>
                              {selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                                <Button 
                                  variant="outline" 
                                  className="w-full"
                                  onClick={async () => {
                                    if (!selectedOrder || !selectedTable) return;
                                    const receiptData = propsToReceiptData({
                                      order: selectedOrder,
                                      payments: [],
                                      discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
                                      serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
                                      splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
                                      tableNumber: selectedTable.number,
                                      receiptType: 'summary',
                                    });
                                    const success = await centralPrinting.printCustomerReceipt(receiptData);
                                    if (success) {
                                      toast.success('Resumo da conta enviado para impressão');
                                    } else {
                                      toast.error('Falha ao enviar para impressão');
                                    }
                                  }}
                                >
                                  <Receipt className="h-4 w-4 mr-2" />
                                  Resumo da Conta
                                </Button>
                              )}
                              {canSwitchTable && (
                                <Button 
                                  variant="outline" 
                                  className="w-full"
                                  onClick={() => setIsSwitchTableDialogOpen(true)}
                                >
                                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                                  Trocar Mesa
                                </Button>
                              )}
                              {/* Fechar Conta */}
                              {canCloseBill && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (() => {
                                const activeItems = selectedOrder.order_items.filter((item: any) => !item.cancelled_at);
                                const allServed = activeItems.length > 0 && activeItems.every((item: any) => item.served_at);
                                const canClose = selectedOrder.status === 'delivered' || allServed;
                                return (
                                <Button 
                                  variant="outline" 
                                  className="w-full" 
                                  onClick={handleStartClosing}
                                  disabled={!canClose}
                                  title={!canClose ? 'Todos os itens precisam ser servidos antes de fechar a conta' : undefined}
                                >
                                  <Receipt className="h-4 w-4 mr-2" />
                                  {canClose ? 'Fechar Conta' : 'Aguardando Servir...'}
                                </Button>
                                );
                              })()}
                              {/* Cancelar Pedido */}
                              {canCancelOrder && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                                <Button 
                                  variant="outline" 
                                  className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                                  onClick={() => setIsCancelOrderDialogOpen(true)}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Cancelar Pedido
                                </Button>
                              )}
                            </>
                          )}

                          {selectedTable.status === 'reserved' && (
                            <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
                              Liberar Mesa
                            </Button>
                          )}

                          {/* Reabrir pedidos fechados */}
                          {selectedTable.status === 'available' && canReopenTable && (() => {
                            const closedOrders = getClosedTableOrders(selectedTable.id);
                            if (closedOrders.length === 0) return null;
                            return (
                              <div className="space-y-2 pt-2 border-t">
                                <p className="text-xs text-muted-foreground">Pedidos fechados recentemente:</p>
                                {closedOrders.slice(0, 3).map((order) => (
                                  <Button 
                                    key={order.id}
                                    variant="outline" 
                                    className="w-full justify-between"
                                    onClick={() => {
                                      setClosedOrderToReopen(order);
                                      setIsReopenDialogOpen(true);
                                    }}
                                  >
                                    <span className="flex items-center gap-2">
                                      <RotateCcw className="h-4 w-4" />
                                      #{order.id.slice(0, 8)}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {formatCurrency(order.total || 0)}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </>
                    )}

                    {/* CLOSING VIEW - Payment Flow - Apenas na aba Resumo */}
                    {isClosingBill && selectedOrder && tableViewMode === 'resumo' && (
                      <>
                        {/* Order Items Summary */}
                        <div className="flex-1 flex flex-col min-h-0">
                          <h4 className="text-sm font-medium mb-2">Itens do Pedido</h4>
                          <ScrollArea className="flex-1 max-h-[280px]">
                            <div className="space-y-2 pr-2">
                              {selectedOrder.order_items?.map((item: any) => {
                                const allExtras = item.extras?.map((e: any) => ({
                                  name: e.extra_name?.includes(': ') 
                                    ? e.extra_name.split(': ').slice(1).join(': ')
                                    : e.extra_name || '',
                                  price: e.price || 0,
                                })).filter((e: any) => e.name) || [];
                                
                                return (
                                  <div key={item.id} className="p-2 bg-muted/50 rounded text-sm">
                                    <div className="flex items-center justify-between">
                                      <span className="truncate flex-1">
                                        {item.quantity}x {item.product?.name || 'Produto'}
                                        {item.variation?.name && (
                                          <span className="text-muted-foreground"> - {item.variation.name}</span>
                                        )}
                                      </span>
                                      <span className="font-medium ml-2">
                                        {formatCurrency(item.total_price)}
                                      </span>
                                    </div>
                                    {allExtras.length > 0 && (
                                      <div className="mt-1 space-y-0.5">
                                        {allExtras.map((extra: any, idx: number) => (
                                          <div key={idx} className="flex justify-between text-xs text-muted-foreground pl-2">
                                            <span>• {extra.name}</span>
                                            {extra.price > 0 && (
                                              <span>{formatCurrency(extra.price)}</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                     <OrderItemBorderBadge item={item} />
                                     {item.fulfillment_type === 'takeaway' && (
                                       <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white mb-1.5 w-fit">
                                         🥡 RETIRADA
                                       </span>
                                     )}
                                      {item.notes && (
                                        <div className="mt-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">📝 {item.notes}</div>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Financial Summary with Discount & Service */}
                        <div className="space-y-3 border-t pt-3">
                          {/* Subtotal */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                          </div>
                          
                          {/* Discount Section */}
                          <DiscountInput
                            discountType={discountType}
                            discountValue={discountValue}
                            subtotal={subtotal}
                            onChange={(type, value) => {
                              setDiscountType(type);
                              setDiscountValue(value);
                            }}
                          />

                          {/* Service Charge Section */}
                          <ServiceChargeInput
                            enabled={serviceChargeEnabled}
                            percent={serviceChargePercent}
                            afterDiscountTotal={afterDiscount}
                            onEnabledChange={setServiceChargeEnabled}
                            onPercentChange={setServiceChargePercent}
                          />

                          {/* Final Total */}
                          <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
                            <span>Total</span>
                            <span className="text-primary">{formatCurrency(finalTotal)}</span>
                          </div>

                          {/* Resumo por Garçom */}
                          {(() => {
                            const waiterSummary = selectedOrder?.order_items?.reduce((acc, item) => {
                              const waiterName = item.added_by_profile?.name || 'Não identificado';
                              if (!acc[waiterName]) {
                                acc[waiterName] = { count: 0, total: 0 };
                              }
                              acc[waiterName].count += item.quantity;
                              acc[waiterName].total += Number(item.total_price);
                              return acc;
                            }, {} as Record<string, { count: number; total: number }>);

                            const waiterEntries = Object.entries(waiterSummary || {});
                            
                            if (waiterEntries.length <= 1) return null;
                            
                            return (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Resumo por Garçom</span>
                                </div>
                                <div className="space-y-1">
                                  {waiterEntries.map(([name, data]) => (
                                    <div key={name} className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">
                                        👤 {name} ({data.count} {data.count === 1 ? 'item' : 'itens'})
                                      </span>
                                      <span className="font-medium">{formatCurrency(data.total)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Bill Splitting Section */}
                        <div className="p-3 bg-muted/30 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserPlus className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Dividir conta</span>
                            </div>
                            <Switch 
                              checked={splitBillEnabled} 
                              onCheckedChange={setSplitBillEnabled}
                            />
                          </div>
                          {splitBillEnabled && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Pessoas:</span>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => setSplitCount(c => Math.max(2, c - 1))}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center font-bold">{splitCount}</span>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => setSplitCount(c => c + 1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <RadioGroup 
                                value={splitMode} 
                                onValueChange={(v: 'equal' | 'custom') => setSplitMode(v)}
                                className="flex gap-4"
                              >
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="equal" id="split-equal" />
                                  <Label htmlFor="split-equal" className="text-xs">Divisão igual</Label>
                                </div>
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="custom" id="split-custom" />
                                  <Label htmlFor="split-custom" className="text-xs">Personalizado</Label>
                                </div>
                              </RadioGroup>
                              
                              {splitMode === 'equal' ? (
                                <div className="space-y-1 text-sm">
                                  {splitAmounts.map((amount, i) => {
                                    const isPaid = i < paidPersonsCount;
                                    const isNext = i === paidPersonsCount;
                                    return (
                                      <div
                                        key={i}
                                        className={cn(
                                          'flex justify-between items-center py-1 border-b border-dashed',
                                          isPaid && 'opacity-60'
                                        )}
                                      >
                                        <span className={cn('text-muted-foreground', isNext && 'font-semibold text-foreground')}>
                                          {isPaid ? '✓ ' : isNext ? '▶ ' : ''}Pessoa {i + 1}
                                        </span>
                                        <span className={cn(
                                          'font-medium',
                                          isPaid && 'line-through text-muted-foreground',
                                          isNext && 'text-primary font-bold'
                                        )}>
                                          {formatCurrency(amount)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {customSplits.map((value, i) => (
                                    <CustomSplitInput
                                      key={i}
                                      index={i}
                                      value={value}
                                      onChange={(idx, val) => {
                                        setCustomSplits(prev => {
                                          const updated = [...prev];
                                          updated[idx] = val;
                                          return updated;
                                        });
                                      }}
                                    />
                                  ))}
                                  <div className={cn(
                                    "text-xs text-right",
                                    Math.abs(customSplitsRemaining) < 0.01 ? "text-green-600" : "text-red-500"
                                  )}>
                                    {Math.abs(customSplitsRemaining) < 0.01 
                                      ? "✓ Valores corretos" 
                                      : customSplitsRemaining > 0 
                                        ? `Falta: ${formatCurrency(customSplitsRemaining)}`
                                        : `Excede: ${formatCurrency(Math.abs(customSplitsRemaining))}`
                                    }
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Print Bill Button */}
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={async () => {
                            if (!selectedOrder || !selectedTable) return;
                            const receiptData = propsToReceiptData({
                              order: selectedOrder,
                              payments: registeredPayments.map(p => ({
                                id: '',
                                order_id: selectedOrder.id,
                                payment_method: p.method,
                                amount: p.amount,
                                cash_register_id: openCashRegister?.id || null,
                                received_by: null,
                                created_at: new Date().toISOString(),
                              })),
                              discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
                              serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
                              splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
                              tableNumber: selectedTable.number,
                            });
                            const success = await centralPrinting.printCustomerReceipt(receiptData);
                            if (success) {
                              toast.success('Conta enviada para impressão');
                            } else {
                              toast.error('Falha ao enviar para impressão');
                            }
                          }}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir Conta
                        </Button>

                        {/* Payment Status */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">
                              {splitBillEnabled && splitMode === 'equal' && paidPersonsCount > 0
                                ? `${paidPersonsCount} de ${splitCount} pagaram`
                                : 'Total pago'}
                            </p>
                            <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">
                              {splitBillEnabled && splitMode === 'equal' && remainingAmount > 0
                                ? `Aguardando ${splitCount - paidPersonsCount} pessoa(s)`
                                : 'Falta pagar'}
                            </p>
                            <p className="text-lg font-bold text-destructive">{formatCurrency(remainingAmount)}</p>
                          </div>
                        </div>

                        {/* Payment Method Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {(['cash', 'credit_card', 'debit_card', 'pix'] as PaymentMethod[]).map((method) => (
                            <Button
                              key={method}
                              variant="outline"
                              className="flex items-center gap-2 h-12"
                              onClick={() => handleSelectPaymentMethod(method)}
                              disabled={remainingAmount <= 0}
                            >
                              {paymentMethodIcons[method]}
                              <span className="text-sm">{paymentMethodLabels[method]}</span>
                            </Button>
                          ))}
                        </div>

                        {/* Existing Payments from DB (partial payments already saved) */}
                        {existingPayments && existingPayments.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              Pagamentos já registrados
                            </h4>
                            <div className="space-y-1">
                              {existingPayments.map((payment: any) => (
                                <div 
                                  key={payment.id}
                                  className="flex flex-col p-2 bg-green-600/10 rounded text-sm border border-green-600/20"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {paymentMethodIcons[payment.payment_method as PaymentMethod]}
                                      <span>{paymentMethodLabels[payment.payment_method as PaymentMethod]}</span>
                                      {payment.is_partial && existingPaymentsTotal < finalTotal && (
                                        <Badge variant="outline" className="text-xs">Parcial</Badge>
                                      )}
                                    </div>
                                    <span className="font-medium text-green-600">
                                      {formatCurrency(Number(payment.amount))}
                                    </span>
                                  </div>
                                  {(payment.payment_method === 'credit_card' || payment.payment_method === 'debit_card' || payment.payment_method === 'pix') && (
                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                      <Receipt className="h-3 w-3" />
                                      Cód: {payment.observation || '—'}
                                    </div>
                                  )}
                                  {payment.received_by_profile?.name && (
                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      Recebido por: {payment.received_by_profile.name}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Session Payments (pending, not saved to DB yet) */}
                        {registeredPayments.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Pagamentos pendentes</h4>
                            <div className="space-y-1">
                              {registeredPayments.map((payment, index) => (
                                <div
                                  key={index}
                                  className="flex flex-col p-2 bg-amber-500/10 rounded text-sm"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {paymentMethodIcons[payment.method]}
                                      <span>{paymentMethodLabels[payment.method]}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-amber-600">
                                        {formatCurrency(payment.amount)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleRemovePayment(index)}
                                      >
                                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                                      </Button>
                                    </div>
                                  </div>
                                  {(payment.method === 'credit_card' || payment.method === 'debit_card' || payment.method === 'pix') && (
                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                      <Receipt className="h-3 w-3" />
                                      Cód: {payment.observation || '—'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Closing Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={handleReopenTable}
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Reabrir
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={() => {
                              if (splitBillEnabled) {
                                setConfirmCloseModalOpen(true);
                              } else {
                                setTransactionCode('');
                                setTransactionCodeModalOpen(true);
                              }
                            }}
                            disabled={remainingAmount > 0}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Finalizar
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                  </>
                ) : (
                  <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Nenhuma mesa selecionada</p>
                    <p className="text-sm text-center">Clique em uma mesa para ver os detalhes</p>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reservations" className="flex-1 m-0 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>Data:</Label>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setIsReservationDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Reserva
            </Button>
            <ReservationDialog
              open={isReservationDialogOpen}
              onOpenChange={setIsReservationDialogOpen}
              tables={tables || []}
              onConfirm={async (data) => {
                await createReservation.mutateAsync({
                  ...data,
                  status: 'confirmed',
                  created_by: user?.id || null,
                });
                
                if (data.reservation_date === format(new Date(), 'yyyy-MM-dd')) {
                  await updateTable.mutateAsync({ id: data.table_id, status: 'reserved' });
                }
                
                setIsReservationDialogOpen(false);
              }}
              isPending={createReservation.isPending}
            />
          </div>

          {/* Reservations List */}
          <div className="grid gap-4">
            {reservations?.filter(r => r.status === 'confirmed').length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma reserva para esta data</p>
                </CardContent>
              </Card>
            ) : (
              reservations?.filter(r => r.status === 'confirmed').map((reservation) => (
                <Card 
                  key={reservation.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedReservation(reservation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{reservation.customer_name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {reservation.reservation_time.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {reservation.party_size} pessoas
                            </span>
                            {reservation.customer_phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {reservation.customer_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Mesa {reservation.table?.number}</p>
                        <span className="text-xs px-2 py-1 bg-warning/10 text-warning rounded">
                          {reservationStatusLabels[reservation.status]}
                        </span>
                      </div>
                    </div>
                    {reservation.notes && (
                      <p className="text-sm text-muted-foreground mt-2 pl-16">
                        📝 {reservation.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Open Table Dialog - using optimized component */}
      <OpenTableDialog
        open={isOpenTableDialogOpen}
        onOpenChange={setIsOpenTableDialogOpen}
        table={tableToOpen}
        onConfirm={async (data) => {
          if (!tableToOpen || isOpeningTable) return;

          const tableNumber = tableToOpen.number;
          const tableId = tableToOpen.id;

          setIsOpeningTable(true);
          try {
            // Primeiro garantir a mesa ocupada; se algo falhar depois, fazemos rollback.
            await updateTable.mutateAsync({ id: tableId, status: 'occupied' });

            // Reaproveitar draft/ativo existente para evitar duplicidade de pedidos.
            const { data: existingOrder, error: existingOrderError } = await supabase
              .from('orders')
              .select('id')
              .eq('table_id', tableId)
              .neq('status', 'cancelled')
              .or('is_draft.eq.true,status.in.(pending,preparing,ready)')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (existingOrderError) throw existingOrderError;

            if (!existingOrder) {
              await createOrder.mutateAsync({
                table_id: tableId,
                order_type: 'dine_in',
                status: getInitialOrderStatus(),
                customer_name: data.identification || null,
                party_size: data.people || null,
                is_draft: true,
              });
            }

            const openedTable = { ...tableToOpen, status: 'occupied' as const };
            setIsOpenTableDialogOpen(false);
            setOpenTableData(data);
            setSelectedTable(openedTable);

            if (isMobile) {
              setIsAddingMode(true);
              setIsOrderDrawerOpen(true);
            } else {
              setIsAddOrderModalOpen(true);
            }

            setIsClosingBill(false);
            setRegisteredPayments([]);
            setDiscountType('percentage');
            setDiscountValue(0);
            setServiceChargeEnabled(false);
            setServiceChargePercent(10);
            setSplitBillEnabled(false);
            setSplitCount(2);
            setSplitMode('equal');
            setCustomSplits([]);

            toast.success(existingOrder ? `Mesa ${tableNumber} reaberta!` : `Mesa ${tableNumber} aberta!`);
          } catch (error) {
            console.error('Error opening table:', error);

            try {
              const { data: persistedOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('table_id', tableId)
                .neq('status', 'cancelled')
                .or('is_draft.eq.true,status.in.(pending,preparing,ready)')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!persistedOrder) {
                await updateTable.mutateAsync({ id: tableId, status: 'available' });
              }
            } catch (rollbackError) {
              console.error('Error rolling back table opening:', rollbackError);
            }

            toast.error('Erro ao abrir mesa');
            setSelectedTable(null);
            setIsAddingMode(false);
            setIsOrderDrawerOpen(false);
            setIsAddOrderModalOpen(false);
          } finally {
            setIsOpeningTable(false);
            setTableToOpen(null);
          }
        }}
        isPending={updateTable.isPending || isOpeningTable}
      />

      {/* Mobile Table Details Dialog */}
      {isMobile && (
        <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            {/* Tabs Consumo/Resumo centralizadas no topo */}
            <div className="flex justify-center mb-3">
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <Button
                  variant={tableViewMode === 'consumo' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTableViewMode('consumo')}
                >
                  Consumo
                </Button>
                <Button
                  variant={tableViewMode === 'resumo' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTableViewMode('resumo')}
                >
                  Resumo
                </Button>
              </div>
            </div>
            
            <DialogTitle className="flex items-center gap-2">
              Mesa {selectedTable?.number}
              {selectedTable && (
                <Badge className={cn('text-xs', statusColors[selectedTable.status])}>
                  {isClosingBill ? 'Fechando' : statusLabels[selectedTable.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {/* MOBILE: Regular View */}
          {!isClosingBill && (
            <div className="space-y-4 pt-4">
              {/* ===== ABA CONSUMO - MOBILE ===== */}
              {tableViewMode === 'consumo' && (
                <>
                  
                  {/* Delivered Banner - Mobile */}
                  {selectedOrder?.status === 'delivered' && (
                    <div className="bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 p-4 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5" />
                        <p className="font-medium text-sm">Pedido Entregue</p>
                      </div>
                      <p className="text-xs opacity-80">Aguardando fechamento da conta</p>
                      
                      {/* Waiter and time info - Mobile */}
                      <div className="mt-2 pt-2 border-t border-blue-500/20 space-y-1 text-xs">
                        {selectedOrder.created_by_profile?.name && (
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Garçom:</span>
                            <span className="font-medium">{selectedOrder.created_by_profile.name}</span>
                          </div>
                        )}
                        {selectedOrder.created_at && (
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Lançado às:</span>
                            <span>{format(new Date(selectedOrder.created_at), 'HH:mm', { locale: ptBR })}</span>
                          </div>
                        )}
                        {selectedOrder.ready_at && (
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Pronto às:</span>
                            <span>{format(new Date(selectedOrder.ready_at), 'HH:mm', { locale: ptBR })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Mobile - Consumo tab shows ALL items with individual status */}
                  {(() => {
                    const allItems = selectedOrder?.order_items || [];
                    const hasAnyItems = allItems.length > 0;
                    
                    // Helper function to determine item status
                    const getItemStatus = (item: any) => {
                      if (item.served_at) return 'served';
                      if (item.station_status === 'ready' || item.station_status === 'dispatched' || item.station_status === 'done' || item.station_status === 'completed') return 'ready';
                      if (item.current_station?.station_type === 'order_status') return 'ready';
                      if (!item.current_station_id && !selectedOrder?.is_draft) return 'ready';
                      if (item.station_status === 'in_oven') return 'in_oven';
                      if (item.current_station_id && item.current_station) return 'in_production';
                      if (selectedOrder?.status === 'pending' || selectedOrder?.is_draft) return 'pending';
                      return 'in_production';
                    };
                    
                    if (hasAnyItems) {
                      return (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Itens do Pedido</h4>
                          <div className="max-h-[250px] overflow-y-auto space-y-2">
                            {allItems.map((item: any) => {
                              const itemStatus = getItemStatus(item);
                              
                              return (
                                <div 
                                  key={item.id} 
                                  className={`flex flex-col p-2 rounded text-sm transition-colors ${
                                    itemStatus === 'served' 
                                      ? 'bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700' 
                                      : itemStatus === 'ready'
                                      ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                                      : 'bg-muted/50'
                                  }`}
                                >
                                  {/* Status Badge Individual - Mobile */}
                                  {itemStatus === 'pending' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 w-fit animate-pulse-soft">
                                      <Clock className="h-3 w-3" />
                                      Aguardando
                                    </div>
                                  )}
                                  {itemStatus === 'in_oven' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 w-fit animate-pulse-soft bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">
                                      <Flame className="h-3 w-3" />
                                      No Forno
                                    </div>
                                  )}
                                  {itemStatus === 'in_production' && item.current_station && (
                                    <div 
                                      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 w-fit animate-pulse-soft"
                                      style={{ 
                                        backgroundColor: item.current_station.color ? `${item.current_station.color}20` : 'hsl(var(--primary) / 0.1)',
                                        color: item.current_station.color || 'hsl(var(--primary))'
                                      }}
                                    >
                                      <span>●</span>
                                      KDS: {item.current_station.name}
                                    </div>
                                  )}
                                  {itemStatus === 'ready' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 w-fit animate-pulse-soft">
                                      <Bell className="h-3 w-3" />
                                      Pronto
                                    </div>
                                  )}
                                  {itemStatus === 'served' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-green-200 dark:bg-green-800/60 text-green-800 dark:text-green-300 w-fit">
                                      <Check className="h-3 w-3" />
                                      Servido
                                    </div>
                                  )}
                                  {item.fulfillment_type === 'takeaway' && (
                                    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white mb-1.5 w-fit">
                                      🥡 RETIRADA
                                    </span>
                                  )}
                                  
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <span className="font-medium">
                                        {item.quantity}x {item.product?.name || 'Produto'}
                                        {item.variation?.name && (
                                          <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                        )}
                                        {item.sub_items && item.sub_items.length > 0 && (
                                          <Badge variant="outline" className="ml-2 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                            {item.sub_items.length === 1 ? '1 SABOR' : `${item.sub_items.length} SABORES`}
                                          </Badge>
                                        )}
                                      </span>
                                      {/* Sub-items (pizzas individuais) */}
                                      {item.sub_items && item.sub_items.length > 0 ? (
                                         <div className="text-xs text-muted-foreground mt-1 space-y-1.5">
                                           {item.sub_items
                                             .sort((a: any, b: any) => a.sub_item_index - b.sub_item_index)
                                             .map((subItem: any, renderIdx: number) => (
                                             <div key={subItem.id} className="pl-2 border-l-2 border-primary/30">
                                               {item.sub_items.length > 1 ? (
                                                  <p className="font-medium text-foreground">🍕 {`1/${item.sub_items.length}`}</p>
                                               ) : null}
                                               {subItem.sub_extras && subItem.sub_extras.length > 0 && (
                                                 <div className="pl-2 space-y-0.5">
                                                   {subItem.sub_extras.map((extra: any, idx: number) => (
                                                     <p key={idx}>• {extra.option_name}</p>
                                                   ))}
                                                 </div>
                                               )}
                                             </div>
                                           ))}
                                        </div>
                                      ) : (
                                        /* Sabores/Complementos tradicionais */
                                        item.extras && item.extras.length > 0 && (
                                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                            {item.extras.map((extra: any, idx: number) => {
                                              const displayName = extra.extra_name?.includes(': ') 
                                                ? extra.extra_name.split(': ').slice(1).join(': ')
                                                : extra.extra_name || '';
                                              return displayName ? (
                                                <p key={idx} className="pl-2">• {displayName}</p>
                                              ) : null;
                                            })}
                                          </div>
                                        )
                                      )}
                                       <OrderItemBorderBadge item={item} />
                                       {item.fulfillment_type === 'takeaway' && (
                                         <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white mb-1.5 w-fit">
                                           🥡 RETIRADA
                                         </span>
                                       )}
                                        {item.notes && (
                                          <div className="mt-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">📝 {item.notes}</div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 ml-2">
                                      {/* Botão Servir Item - Mobile - Só aparece se pronto */}
                                      {itemStatus === 'ready' && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-xs h-6 px-2 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                                          onClick={() => handleServeOrderItem(item.id)}
                                          disabled={isServingItem === item.id}
                                        >
                                          {isServingItem === item.id ? (
                                            <span className="animate-pulse">...</span>
                                          ) : (
                                            <>
                                              <Check className="h-3 w-3 mr-1" />
                                              Servir
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {selectedOrder && (!selectedOrder.order_items || selectedOrder.order_items.length === 0) ? (
                    <div className="text-center py-4 space-y-3">
                      <div className="text-muted-foreground">
                        <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum item no pedido</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleCloseEmptyTable}
                        disabled={isClosingEmptyTable}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {isClosingEmptyTable ? 'Fechando...' : 'Fechar Mesa (Sem Consumo)'}
                      </Button>
                    </div>
                  ) : null}

                </>
              )}

              {/* ===== ABA RESUMO - MOBILE ===== */}
              {tableViewMode === 'resumo' && selectedOrder && (
                <>
                  {/* Informações do Pedido */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pedido</span>
                      <span className="font-mono">#{selectedOrder.id.slice(0, 8)}</span>
                    </div>
                    {selectedOrder.created_at && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Aberto há</span>
                        <span>{formatDistanceToNow(new Date(selectedOrder.created_at), { locale: ptBR })}</span>
                      </div>
                    )}
                    {/* Garçom que criou o pedido */}
                    {selectedOrder.created_by_profile?.name && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Garçom</span>
                        <span>{selectedOrder.created_by_profile.name}</span>
                      </div>
                    )}
                    {/* Nome do Cliente editável */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cliente</span>
                      <CustomerNameInput
                        initialValue={selectedOrder.customer_name}
                        onSave={handleSaveCustomerName}
                      />
                    </div>
                  </div>

                  {/* Lista de Itens Completa - Mobile */}
                  {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                    <div className="border-t pt-3 mt-3 space-y-2">
                      <h4 className="text-sm font-medium">Itens do Pedido</h4>
                      <div className="max-h-[180px] overflow-y-auto space-y-2">
                        {selectedOrder.order_items.map((item: any) => (
                          <div 
                            key={item.id} 
                            className={cn(
                              "p-2 rounded text-sm",
                              item.cancelled_at 
                                ? "bg-destructive/10 border border-destructive/20" 
                                : "bg-muted/50"
                            )}
                          >
                            <div className="flex justify-between items-start">
                              <span className={cn(
                                "font-medium",
                                item.cancelled_at && "line-through text-muted-foreground"
                              )}>
                                {item.quantity}x {item.product?.name || 'Produto'}
                                {item.variation?.name && (
                                  <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                )}
                                {item.sub_items && item.sub_items.length > 0 && (
                                  <Badge variant="outline" className="ml-2 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                    {item.sub_items.length === 1 ? '1 SABOR' : `${item.sub_items.length} SABORES`}
                                  </Badge>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-medium",
                                  item.cancelled_at && "line-through text-muted-foreground"
                                )}>
                                  {formatCurrency(item.total_price)}
                                </span>
                                {/* Botão cancelar - para itens não cancelados */}
                                {!item.cancelled_at && canDeleteItems && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                    onClick={() => {
                                      setItemToCancel({
                                        id: item.id,
                                        orderId: selectedOrder.id,
                                        name: `${item.product?.name || 'Produto'}${item.variation?.name ? ` - ${item.variation.name}` : ''}`,
                                        quantity: item.quantity,
                                        price: item.total_price
                                      });
                                      setCancelItemDialogOpen(true);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {/* Badge cancelado */}
                            {item.cancelled_at && (
                              <div className="mt-1 space-y-1">
                                <Badge variant="destructive" className="text-xs">CANCELADO</Badge>
                                {item.cancellation_reason && (
                                  <p className="text-xs text-muted-foreground italic">
                                    Motivo: {item.cancellation_reason}
                                  </p>
                                )}
                              </div>
                            )}
                            {/* Sub-items (pizzas individuais) */}
                            {item.sub_items && item.sub_items.length > 0 && (
                               <div className="text-xs text-muted-foreground mt-1 space-y-1.5">
                                 {item.sub_items
                                   .sort((a: any, b: any) => a.sub_item_index - b.sub_item_index)
                                   .map((subItem: any, renderIdx: number) => (
                                   <div key={subItem.id} className="pl-2 border-l-2 border-primary/30">
                                     {item.sub_items.length > 1 ? (
                                       <p className="font-medium text-foreground">🍕 {`1/${item.sub_items.length}`}</p>
                                     ) : null}
                                       {subItem.sub_extras && subItem.sub_extras.length > 0 && (
                                       <div className="pl-2 space-y-0.5">
                                         {subItem.sub_extras.map((extra: any, idx: number) => (
                                           <p key={idx} className="flex justify-between">
                                             <span>• {extra.option_name}</span>
                                             {extra.price > 0 && (
                                               <span className="text-muted-foreground ml-2">
                                                 {formatCurrency(extra.price)}
                                               </span>
                                             )}
                                           </p>
                                         ))}
                                       </div>
                                     )}
                                   </div>
                                 ))}
                              </div>
                            )}
                            {/* Extras tradicionais */}
                            {!item.sub_items?.length && item.extras && item.extras.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {item.extras.map((extra: any, idx: number) => {
                                  const displayName = extra.extra_name?.includes(': ') 
                                    ? extra.extra_name.split(': ').slice(1).join(': ')
                                    : extra.extra_name || '';
                                  return displayName ? (
                                    <p key={idx} className="pl-2 flex justify-between">
                                      <span>• {displayName}</span>
                                      {extra.price > 0 && (
                                        <span className="text-muted-foreground ml-2">
                                          {formatCurrency(extra.price)}
                                        </span>
                                      )}
                                    </p>
                                  ) : null;
                                })}
                              </div>
                            )}
                             {/* Fulfillment badge */}
                             {item.fulfillment_type === 'takeaway' && (
                               <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white mb-1.5 w-fit">
                                 🥡 RETIRADA
                               </span>
                             )}
                             {/* Borda */}
                             <OrderItemBorderBadge item={item} />
                             {/* Observações */}
                              {item.notes && (
                                <div className="mt-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">📝 {item.notes}</div>
                              )}
                            {/* Data/hora e garçom */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 pl-2">
                              {item.created_at && (
                                <span>📅 {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                              )}
                              {item.added_by_profile?.name && (
                                <span className="text-blue-600">• 👤 {item.added_by_profile.name}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(selectedOrder.total || 0)}</span>
                    </div>
                  </div>
                  
                  {/* Botões de ação - Mobile */}
                  <div className="space-y-2 pt-2">
                    {selectedTable?.status === 'occupied' && (
                      <>
                        <Button 
                          className="w-full" 
                          onClick={() => {
                            const currentTable = selectedTable;
                            setSelectedTable(null);
                            setTimeout(() => {
                              setSelectedTable(currentTable);
                              setIsAddingMode(true);
                              setIsOrderDrawerOpen(true);
                            }, 100);
                          }} 
                          disabled={isAddingItems}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {isAddingItems ? 'Adicionando...' : 'Adicionar Pedido'}
                        </Button>
                        {selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={async () => {
                              if (!selectedOrder || !selectedTable) return;
                              const receiptData = propsToReceiptData({
                                order: selectedOrder,
                                payments: [],
                                discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
                                serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
                                splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
                                tableNumber: selectedTable.number,
                                receiptType: 'summary',
                              });
                              const success = await centralPrinting.printCustomerReceipt(receiptData);
                              if (success) {
                                toast.success('Resumo da conta enviado para impressão');
                              } else {
                                toast.error('Falha ao enviar para impressão');
                              }
                            }}
                          >
                            <Receipt className="h-4 w-4 mr-2" />
                            Resumo da Conta
                          </Button>
                        )}
                        {canSwitchTable && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => setIsSwitchTableDialogOpen(true)}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Trocar Mesa
                          </Button>
                        )}
                        {/* Fechar Conta */}
                        {canCloseBill && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (() => {
                          const activeItems = selectedOrder.order_items.filter((item: any) => !item.cancelled_at);
                          const allServed = activeItems.length > 0 && activeItems.every((item: any) => item.served_at);
                          const canClose = selectedOrder.status === 'delivered' || allServed;
                          return (
                          <Button 
                            variant="outline" 
                            className="w-full" 
                            onClick={handleStartClosing}
                            disabled={!canClose}
                          >
                            <Receipt className="h-4 w-4 mr-2" />
                            {canClose ? 'Fechar Conta' : 'Aguardando Servir...'}
                          </Button>
                          );
                        })()}
                        {/* Cancelar Pedido */}
                        {canCancelOrder && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                          <Button 
                            variant="outline" 
                            className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                            onClick={() => setIsCancelOrderDialogOpen(true)}
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Cancelar Pedido
                          </Button>
                        )}
                      </>
                    )}

                    {selectedTable?.status === 'reserved' && (
                      <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
                        Liberar Mesa
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* MOBILE: Closing View */}
          {isClosingBill && selectedOrder && (
            <div className="space-y-4 pt-4">
              {/* Order Items Summary */}
              <div className="max-h-[180px] overflow-y-auto space-y-1">
                {selectedOrder.order_items?.map((item: any) => {
                  const allExtras = item.extras?.map((e: any) => ({
                    name: e.extra_name?.includes(': ') 
                      ? e.extra_name.split(': ').slice(1).join(': ')
                      : e.extra_name || '',
                    price: e.price || 0,
                  })).filter((e: any) => e.name) || [];
                  
                  return (
                    <div key={item.id} className="p-2 bg-muted/50 rounded text-sm">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{item.quantity}x {item.product?.name || 'Produto'}</span>
                        <span className="font-medium">{formatCurrency(item.total_price)}</span>
                      </div>
                      {allExtras.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {allExtras.map((extra: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-muted-foreground pl-2">
                              <span>• {extra.name}</span>
                              {extra.price > 0 && <span>{formatCurrency(extra.price)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                       <OrderItemBorderBadge item={item} />
                       {item.fulfillment_type === 'takeaway' && (
                         <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white mb-1.5 w-fit">
                           🥡 RETIRADA
                         </span>
                       )}
                        {item.notes && (
                          <div className="mt-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">📝 {item.notes}</div>
                        )}
                    </div>
                  );
                })}
              </div>

              {/* Financial Summary - Mobile */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="text-red-500">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {serviceChargeEnabled && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa ({serviceChargePercent}%)</span>
                    <span className="text-green-600">+{formatCurrency(serviceAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-1 border-t">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(finalTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">Pago</p>
                    <p className="font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Falta</p>
                    <p className="font-bold text-destructive">{formatCurrency(remainingAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Payment Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'credit_card', 'debit_card', 'pix'] as PaymentMethod[]).map((method) => (
                  <Button
                    key={method}
                    variant="outline"
                    className="flex items-center gap-2 h-12"
                    onClick={() => handleSelectPaymentMethod(method)}
                    disabled={remainingAmount <= 0}
                  >
                    {paymentMethodIcons[method]}
                    <span className="text-xs">{paymentMethodLabels[method]}</span>
                  </Button>
                ))}
              </div>

              {/* Existing Payments from DB - Mobile */}
              {existingPayments && existingPayments.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    Pagamentos registrados
                  </h4>
                  {existingPayments.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="flex flex-col p-2 bg-green-600/10 rounded text-sm border border-green-600/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {paymentMethodIcons[payment.payment_method as PaymentMethod]}
                          <span className="text-xs">{paymentMethodLabels[payment.payment_method as PaymentMethod]}</span>
                          {payment.is_partial && existingPaymentsTotal < finalTotal && (
                            <Badge variant="outline" className="text-xs">Parcial</Badge>
                          )}
                        </div>
                        <span className="font-medium text-green-600">
                          {formatCurrency(Number(payment.amount))}
                        </span>
                      </div>
                      {(payment.payment_method === 'credit_card' || payment.payment_method === 'debit_card' || payment.payment_method === 'pix') && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Receipt className="h-3 w-3" />
                          Cód: {payment.observation || '—'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Session Payments - Mobile */}
              {registeredPayments.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Pagamentos pendentes</h4>
                  {registeredPayments.map((payment, index) => (
                    <div
                      key={index}
                      className="flex flex-col p-2 bg-amber-500/10 rounded text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {paymentMethodIcons[payment.method]}
                          <span className="text-xs">{paymentMethodLabels[payment.method]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-amber-600">
                            {formatCurrency(payment.amount)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemovePayment(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {(payment.method === 'credit_card' || payment.method === 'debit_card' || payment.method === 'pix') && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Receipt className="h-3 w-3" />
                          Cód: {payment.observation || '—'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleReopenTable}
                >
                  Reabrir
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (splitBillEnabled && registeredPayments.length > 0) {
                      setConfirmCloseModalOpen(true);
                    } else {
                      setTransactionCode('');
                      setTransactionCodeModalOpen(true);
                    }
                  }}
                  disabled={remainingAmount > 0}
                >
                  Finalizar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      )}

      {/* Reservation Details Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserva - {selectedReservation?.customer_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Mesa</p>
                <p className="font-semibold">{selectedReservation?.table?.number}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="font-semibold">{selectedReservation?.reservation_time.slice(0, 5)}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Pessoas</p>
                <p className="font-semibold">{selectedReservation?.party_size}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-semibold">{selectedReservation?.customer_phone || '-'}</p>
              </div>
            </div>
            {selectedReservation?.notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="font-medium">{selectedReservation.notes}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (selectedReservation) {
                    cancelReservation.mutate(selectedReservation.id);
                    setSelectedReservation(null);
                  }
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={() => selectedReservation && handleConfirmArrival(selectedReservation)}>
                <Check className="h-4 w-4 mr-2" />
                Cliente Chegou
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPaymentMethod && paymentMethodIcons[selectedPaymentMethod]}
              Registrar pagamento
              {splitBillEnabled && splitMode === 'equal' && perPersonAmount > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  — Pessoa {Math.min(nextPersonNumber, splitCount)} de {splitCount}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {splitBillEnabled && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Pagamento parcial — este valor será registrado imediatamente e a mesa continuará aberta
              </div>
            )}
            <div className="space-y-2">
              <Label>Valor pago em {selectedPaymentMethod && paymentMethodLabels[selectedPaymentMethod]}</Label>
              <Input
                type="text"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0,00"
                className="text-lg font-bold text-center w-full"
                autoFocus
              />
              {selectedPaymentMethod === 'cash' && (
                <p className="text-xs text-muted-foreground text-center">
                  Se o valor for superior a {formatCurrency(remainingAmount)}, o sistema calculará o troco
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                {(selectedPaymentMethod === 'credit_card' || selectedPaymentMethod === 'debit_card' || selectedPaymentMethod === 'pix')
                  ? 'Código do comprovante *'
                  : 'Observação (opcional)'}
              </Label>
              <Input
                value={paymentObservation}
                onChange={(e) => {
                  setPaymentObservation(e.target.value);
                }}
                placeholder={
                  (selectedPaymentMethod === 'credit_card' || selectedPaymentMethod === 'debit_card' || selectedPaymentMethod === 'pix')
                    ? 'Ex: Código do cupom fiscal ou comprovante'
                    : 'Ex: Recebeu R$100, troco R$50'
                }
                className={`w-full ${(selectedPaymentMethod === 'credit_card' || selectedPaymentMethod === 'debit_card' || selectedPaymentMethod === 'pix') && !paymentObservation.trim() ? 'border-destructive' : ''}`}
              />
              {(selectedPaymentMethod === 'credit_card' || selectedPaymentMethod === 'debit_card' || selectedPaymentMethod === 'pix') && !paymentObservation.trim() && (
                <p className="text-sm text-destructive">Informe o código do comprovante</p>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <div className="flex gap-2 flex-1 sm:justify-end">
              <Button 
                variant="secondary" 
                onClick={handlePartialPayment}
                disabled={createPayment.isPending || ((selectedPaymentMethod === 'credit_card' || selectedPaymentMethod === 'debit_card' || selectedPaymentMethod === 'pix') && !paymentObservation.trim())}
                className="flex items-center justify-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                Pagar e continuar
              </Button>
              <Button 
                onClick={handleConfirmPayment}
                disabled={(selectedPaymentMethod === 'credit_card' || selectedPaymentMethod === 'debit_card' || selectedPaymentMethod === 'pix') && !paymentObservation.trim()}
              >
                Adicionar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Code Modal */}
      <Dialog open={transactionCodeModalOpen} onOpenChange={setTransactionCodeModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Código de Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Informe o código do comprovante de pagamento para finalizar a mesa.
            </p>
            <div className="space-y-2">
              <Label>Código do comprovante *</Label>
              <Input
                value={transactionCode}
                onChange={(e) => setTransactionCode(e.target.value)}
                placeholder="Ex: 123456789"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTransactionCodeModalOpen(false)}>
              Voltar
            </Button>
            <Button
              disabled={!transactionCode.trim()}
              onClick={() => {
                setTransactionCodeModalOpen(false);
                setConfirmCloseModalOpen(true);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCloseModalOpen} onOpenChange={setConfirmCloseModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fechar mesa {selectedTable?.number}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2 text-center">
              <p className="text-muted-foreground">Total do pedido</p>
              <p className="text-2xl font-bold">{formatCurrency(finalTotal)}</p>
              {(discountAmount > 0 || serviceChargeEnabled) && (
                <p className="text-xs text-muted-foreground">
                  Subtotal: {formatCurrency(subtotal)}
                  {discountAmount > 0 && ` - Desconto: ${formatCurrency(discountAmount)}`}
                  {serviceChargeEnabled && ` + Taxa: ${formatCurrency(serviceAmount)}`}
                </p>
              )}
            </div>
            <div className="space-y-2 text-center">
              <p className="text-muted-foreground">Total pago</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            {changeAmount > 0 && (
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(changeAmount)}</p>
              </div>
            )}
            {remainingAmount > 0 && (
              <div className="p-4 bg-destructive/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Falta pagar</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(remainingAmount)}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmCloseModalOpen(false)}>
              Voltar
            </Button>
            <Button 
              onClick={handleFinalizeBill} 
              disabled={createPayment.isPending || isFinalizingBill}
            >
              {(createPayment.isPending || isFinalizingBill) ? 'Finalizando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Switch Table Dialog */}
      <Dialog open={isSwitchTableDialogOpen} onOpenChange={setIsSwitchTableDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Trocar Mesa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedTable && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Mesa atual</p>
                <p className="text-lg font-bold">Mesa {selectedTable.number}</p>
                {selectedTable.capacity && (
                  <p className="text-sm text-muted-foreground">{selectedTable.capacity} lugares</p>
                )}
              </div>
            )}
            
            <div>
              <Label className="text-sm mb-2 block">Selecione a nova mesa:</Label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[300px] overflow-y-auto p-1">
                {tables
                  ?.filter(t => t.id !== selectedTable?.id && t.status === 'available')
                  .map(table => (
                    <Button
                      key={table.id}
                      variant="outline"
                      className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleSwitchTable(table.id)}
                      disabled={isSwitchingTable}
                    >
                      <span className="text-lg font-bold">{table.number}</span>
                      <span className="text-xs opacity-70">{table.capacity}p</span>
                    </Button>
                  ))}
              </div>
              {tables?.filter(t => t.id !== selectedTable?.id && t.status === 'available').length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma mesa disponível</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setIsSwitchTableDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reopen Closed Order Dialog - using optimized component */}
      <ReopenOrderDialog
        open={isReopenDialogOpen}
        onOpenChange={(open) => {
          setIsReopenDialogOpen(open);
          if (!open) {
            setClosedOrderToReopen(null);
          }
        }}
        order={closedOrderToReopen}
        table={selectedTable}
        onConfirm={async (reason) => {
          if (!closedOrderToReopen || !selectedTable) return;
          
          setIsReopening(true);
          try {
            const newStatus = getInitialOrderStatus();
            
            // Record the reopen for audit trail
            await supabase.from('order_reopens').insert({
              order_id: closedOrderToReopen.id,
              table_id: selectedTable.id,
              previous_status: closedOrderToReopen.status,
              new_status: newStatus,
              reopened_by: user?.id,
              order_type: closedOrderToReopen.order_type,
              customer_name: closedOrderToReopen.customer_name,
              total_value: closedOrderToReopen.total,
              reason: reason,
            });

            // Send push notification to managers
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`⚠️ Mesa ${selectedTable.number} reaberta`, {
                  body: `Por: ${user?.user_metadata?.name || user?.email}. Motivo: ${reason}`,
                  tag: 'table-reopen',
                });
              }
            } catch (e) {
              console.error('Push notification error:', e);
            }

            // Try to send email notification
            try {
              await supabase.functions.invoke('send-reopen-notification', {
                body: {
                  orderId: closedOrderToReopen.id,
                  tableNumber: selectedTable.number,
                  userName: user?.user_metadata?.name || user?.email,
                  reason: reason,
                  totalValue: closedOrderToReopen.total,
                }
              });
            } catch (e) {
              console.log('Email notification not sent');
            }
            
            // Reopen the order
            await updateOrder.mutateAsync({
              id: closedOrderToReopen.id,
              status: newStatus,
              updated_at: new Date().toISOString()
            });
            
            // Reopen the table
            await updateTable.mutateAsync({
              id: selectedTable.id,
              status: 'occupied'
            });

            // Update all order items status
            if (closedOrderToReopen.order_items) {
              for (const item of closedOrderToReopen.order_items) {
                await supabase
                  .from('order_items')
                  .update({ status: newStatus })
                  .eq('id', item.id);
              }
            }
            
            toast.success(`Mesa ${selectedTable.number} reaberta com sucesso!`);
            setIsReopenDialogOpen(false);
            setClosedOrderToReopen(null);
            setSelectedTable({ ...selectedTable, status: 'occupied' });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          } catch (error) {
            console.error('Error reopening order:', error);
            toast.error('Erro ao reabrir mesa');
          } finally {
            setIsReopening(false);
          }
        }}
        isReopening={isReopening}
      />

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        open={isCancelOrderDialogOpen}
        onOpenChange={setIsCancelOrderDialogOpen}
        onConfirm={handleCancelOrder}
        orderInfo={selectedTable && selectedOrder ? `Mesa ${selectedTable.number} - Pedido #${selectedOrder.id.slice(0, 8)}` : undefined}
        isLoading={isCancellingOrder}
      />

      {/* Cancel Item Dialog */}
      <CancelItemDialog
        open={cancelItemDialogOpen}
        onOpenChange={setCancelItemDialogOpen}
        onConfirm={async (reason) => {
          if (!itemToCancel || !user) return;
          setIsCancellingItem(true);
          try {
            const result = await cancelOrderItem.mutateAsync({
              itemId: itemToCancel.id,
              orderId: itemToCancel.orderId,
              reason,
              cancelledBy: user.id
            });
            
            // Imprimir ticket de cancelamento se o item estava em produção e a impressão está habilitada
            if (result.wasInProduction && kdsSettings.autoPrintCancellations && centralPrinting.canPrintToKitchen) {
              const cancellationData: CancellationTicketData = {
                orderNumber: itemToCancel.orderId,
                orderType: (result.orderData?.orderType as 'dine_in' | 'takeaway' | 'delivery') || 'dine_in',
                tableNumber: result.orderData?.tableNumber || undefined,
                customerName: result.orderData?.customerName,
                cancellationReason: reason,
                cancelledBy: profile?.name || 'Usuário',
                items: (() => {
                  const extraNames: string[] = [];
                  if (result.itemData?.extras && result.itemData.extras.length > 0) {
                    result.itemData.extras.forEach(e => extraNames.push(`• ${e.extra_name}`));
                  }
                  if (result.itemData?.subItems && result.itemData.subItems.length > 0) {
                    const total = result.itemData.subItems.length;
                    result.itemData.subItems.forEach((sub, idx) => {
                      const prefix = total > 1 ? `🍕 ${idx + 1}/${total} ` : '🍕 ';
                      const flavors = sub.sub_extras?.map(ext => ext.option_name).join(', ') || '';
                      if (flavors) extraNames.push(`${prefix}${flavors}`);
                      if (sub.notes) extraNames.push(`  OBS: ${sub.notes}`);
                    });
                  }
                  return [{
                    quantity: result.itemData?.quantity || itemToCancel.quantity,
                    productName: result.itemData?.productName || itemToCancel.name,
                    variation: result.itemData?.variationName,
                    notes: result.itemData?.notes,
                    extras: extraNames.length > 0 ? extraNames : undefined,
                  }];
                })(),
                cancelledAt: new Date().toISOString()
              };
              
              await centralPrinting.printCancellationTicket(cancellationData);
            }
            
            setCancelItemDialogOpen(false);
            setItemToCancel(null);
          } catch (error) {
            console.error('Erro ao cancelar item:', error);
          } finally {
            setIsCancellingItem(false);
          }
        }}
        itemName={itemToCancel?.name || ''}
        quantity={itemToCancel?.quantity || 0}
        price={itemToCancel?.price || 0}
        isLoading={isCancellingItem}
      />

      {/* Add Order Modal - Desktop */}
      {!isMobile && (
        <Dialog open={isAddOrderModalOpen} onOpenChange={setIsAddOrderModalOpen}>
          <DialogContent className="max-w-[98vw] h-[94vh] p-0 flex flex-col">
            <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
              <DialogTitle className="text-xl">Adicionar Pedido - Mesa {selectedTable?.number}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex overflow-hidden">
              <ProductSelector className="flex-1" onAddItem={addToPendingCart} />
              <div className="w-80 flex-shrink-0 border-l overflow-hidden bg-background">
                <PendingCartPanel
                  items={pendingCartItems}
                  tableNumber={selectedTable?.number || 0}
                  onRemoveItem={removeFromPendingCart}
                  onUpdateQuantity={updatePendingCartQuantity}
                  onDuplicateItem={duplicatePendingCartItem}
                  onToggleFulfillment={togglePendingCartFulfillment}
                  onConfirm={async () => {
                    await handleSendPendingCartToKitchen();
                    setIsAddOrderModalOpen(false);
                  }}
                  onCancel={() => {
                    clearPendingCart();
                    setIsAddOrderModalOpen(false);
                  }}
                  isSubmitting={isAddingItems}
                  duplicateItems={duplicateItems}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Mobile Order Flow Components */}
      {isMobile && (
        <>
          <OrderDrawer
            open={isOrderDrawerOpen}
            onOpenChange={(open) => {
              setIsOrderDrawerOpen(open);
              if (!open && pendingCartItems.length === 0) {
                setIsAddingMode(false);
              }
            }}
            tableNumber={selectedTable?.number}
            onAddItem={addToPendingCart}
            pendingItemsCount={pendingCartItems.length}
            cartItems={pendingCartItems}
            onCartClick={() => setIsCartReviewOpen(true)}
          />

          <CartReviewSheet
            open={isCartReviewOpen}
            onOpenChange={setIsCartReviewOpen}
            items={pendingCartItems}
            tableNumber={selectedTable?.number}
            onRemoveItem={removeFromPendingCart}
            onUpdateQuantity={updatePendingCartQuantity}
            onDuplicateItem={duplicatePendingCartItem}
            onToggleFulfillment={togglePendingCartFulfillment}
            onConfirm={handleSendPendingCartToKitchen}
            onClearAll={clearPendingCart}
            isSubmitting={isAddingItems}
            duplicateItems={duplicateItems}
          />
        </>
      )}
    </PDVLayout>
  );
}
