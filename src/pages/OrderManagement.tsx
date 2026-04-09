import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewOrderSheet } from '@/components/order/NewOrderSheet';
import { useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useOrders, useOrderMutations, Order, OrderItem } from '@/hooks/useOrders';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { CancelOrderDialog } from '@/components/order/CancelOrderDialog';
import { PaymentModal } from '@/components/tables/PaymentModal';
import { OrderItemDetails } from '@/components/order/OrderItemDetails';
import { PaymentMethod, useOpenCashRegister, useCashRegisterMutations } from '@/hooks/useCashRegister';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, UtensilsCrossed, Truck,
  Package, Ban, CheckCircle2, Plus, LayoutGrid, Columns3, Flame,
  Banknote, CreditCard, Smartphone, DollarSign, Printer, MapPin, FileText, Code,
  Home, Phone, Clock, Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { useCentralizedPrinting } from '@/hooks/useCentralizedPrinting';
import { KitchenTicketData, CancellationTicketData } from '@/utils/escpos';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { cn } from '@/lib/utils';
import { fetchDispatchChecklist, ChecklistItem } from '@/hooks/useDispatchChecklist';
import { DispatchChecklistDialog } from '@/components/dispatch/DispatchChecklistDialog';
import { toast } from 'sonner';

// ── KDS status helper ────────────────────────────────────
function getOrderKdsStatus(items: OrderItem[]) {
  const active = items.filter(i => i.status !== 'cancelled');
  if (active.length === 0) return null;

  const inOven = active.filter(i => i.station_status === 'in_oven');
  const ready = active.filter(i => ['ready', 'dispatched', 'done'].includes(i.station_status || ''));
  const inProgress = active.filter(i => ['waiting', 'in_progress'].includes(i.station_status || '') && i.current_station);

  if (ready.length === active.length) return { type: 'ready' as const };
  if (inOven.length > 0) return { type: 'inOven' as const, count: inOven.length };
  if (inProgress.length > 0) {
    // Pick the most common station
    const stationCounts = new Map<string, { name: string; color: string | null; count: number }>();
    inProgress.forEach(i => {
      const s = i.current_station!;
      const existing = stationCounts.get(s.id);
      if (existing) existing.count++;
      else stationCounts.set(s.id, { name: s.name, color: s.color, count: 1 });
    });
    const top = [...stationCounts.values()].sort((a, b) => b.count - a.count)[0];
    return { type: 'inProgress' as const, stationName: top.name, stationColor: top.color };
  }
  return null;
}

function KdsBadge({ items }: { items: OrderItem[] }) {
  const kds = getOrderKdsStatus(items);
  if (!kds) return null;

  if (kds.type === 'inOven') {
    return (
      <Badge className="bg-orange-500 text-white border-orange-400 text-[10px] py-0 px-1.5 gap-0.5 animate-pulse rounded-full">
        <Flame className="h-3 w-3" /> FORNO
      </Badge>
    );
  }
  if (kds.type === 'ready') {
    return (
      <Badge className="bg-emerald-500 text-white border-emerald-400 text-[10px] py-0 px-1.5 rounded-full">
        ✅ PRONTO
      </Badge>
    );
  }
  if (kds.type === 'inProgress') {
    return (
      <Badge
        className="text-white border-transparent text-[10px] py-0 px-1.5 rounded-full"
        style={{ backgroundColor: kds.stationColor || 'hsl(var(--primary))' }}
      >
        KDS: {kds.stationName}
      </Badge>
    );
  }
  return null;
}

function ItemKdsBadge({ item }: { item: OrderItem }) {
  if (item.station_status === 'in_oven') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-600 bg-orange-100 rounded px-1.5 py-0.5 animate-pulse">
        <Flame className="h-3 w-3" /> FORNO
      </span>
    );
  }
  if (['ready', 'dispatched', 'done'].includes(item.station_status || '')) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">
        ✅ PRONTO
      </span>
    );
  }
  if (item.current_station && ['waiting', 'in_progress'].includes(item.station_status || '')) {
    return (
      <span
        className="inline-flex items-center text-[10px] font-semibold text-white rounded px-1.5 py-0.5"
        style={{ backgroundColor: item.current_station.color || 'hsl(var(--primary))' }}
      >
        KDS: {item.current_station.name}
      </span>
    );
  }
  return null;
}

// ── helpers ──────────────────────────────────────────────
function elapsedText(iso: string) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (diff < 60) return `${diff} min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h} h ${m} min`;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/15 text-yellow-700 border-yellow-400' },
  preparing: { label: 'Preparando', color: 'bg-blue-500/15 text-blue-700 border-blue-400' },
  ready: { label: 'Pronto', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-400' },
  delivered: { label: 'Concluído', color: 'bg-green-500/15 text-green-700 border-green-400' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/15 text-red-700 border-red-400' },
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: 'Mesa',
  takeaway: 'Balcão',
  delivery: 'Delivery',
};

// ── Delivery Address Section ────────────────────────────
function DeliveryAddressSection({ order }: { order: Order }) {
  const hasAddress = order.customer_address || order.customer_phone || order.scheduled_for;
  if (!hasAddress) return null;

  const hasCoords = order.delivery_lat && order.delivery_lng;

  const copyPhone = () => {
    if (order.customer_phone) {
      navigator.clipboard.writeText(order.customer_phone);
      toast.success('Telefone copiado!');
    }
  };

  return (
    <div className="border border-primary/30 rounded-lg p-3 space-y-2 bg-primary/5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Home className="h-4 w-4 text-primary" /> Endereço de entrega
      </h3>
      {order.customer_address && (
        <p className="text-sm text-foreground leading-relaxed">{order.customer_address}</p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {order.customer_phone && (
          <button
            onClick={copyPhone}
            className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
          >
            <Phone className="h-3.5 w-3.5" />
            {order.customer_phone}
            <Copy className="h-3 w-3 opacity-60" />
          </button>
        )}
        {order.scheduled_for && (
          <span className="flex items-center gap-1 text-amber-600 font-medium">
            <Clock className="h-3.5 w-3.5" />
            Agendado: {format(new Date(order.scheduled_for), 'HH:mm')}
          </span>
        )}
        {hasCoords && (
          <a
            href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" /> Ver no mapa
          </a>
        )}
      </div>
    </div>
  );
}

// ── Integration Data Section ────────────────────────────
function IntegrationDataSection({ order }: { order: Order }) {
  const [showPayload, setShowPayload] = useState(false);
  const hasExtraFees = Number(order.service_fee || 0) > 0 || Number(order.additional_fee || 0) > 0;
  const hasCoords = order.delivery_lat && order.delivery_lng;

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <FileText className="h-4 w-4" /> Dados da Integração
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {Number(order.delivery_fee || 0) > 0 && (
          <>
            <span className="text-muted-foreground">Taxa de entrega</span>
            <span className="text-foreground font-medium">R$ {Number(order.delivery_fee).toFixed(2)}</span>
          </>
        )}
        {Number(order.service_fee || 0) > 0 && (
          <>
            <span className="text-muted-foreground">Taxa de serviço</span>
            <span className="text-foreground font-medium">R$ {Number(order.service_fee).toFixed(2)}</span>
          </>
        )}
        {Number(order.additional_fee || 0) > 0 && (
          <>
            <span className="text-muted-foreground">Taxa adicional</span>
            <span className="text-foreground font-medium">R$ {Number(order.additional_fee).toFixed(2)}</span>
          </>
        )}
        {order.change_for != null && Number(order.change_for) > 0 && (
          <>
            <span className="text-muted-foreground">Troco para</span>
            <span className="text-foreground font-medium">R$ {Number(order.change_for).toFixed(2)}</span>
          </>
        )}
        {order.fiscal_document && (
          <>
            <span className="text-muted-foreground">CPF/CNPJ na nota</span>
            <span className="text-foreground font-medium">{order.fiscal_document}</span>
          </>
        )}
        {order.payment_method && (
          <>
            <span className="text-muted-foreground">Pagamento</span>
            <span className="text-foreground font-medium capitalize">{order.payment_method}</span>
          </>
        )}
        {hasCoords && (
          <>
            <span className="text-muted-foreground">Coordenadas</span>
            <a
              href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium flex items-center gap-1 hover:underline"
            >
              <MapPin className="h-3 w-3" /> Ver no mapa
            </a>
          </>
        )}
      </div>
      {order.external_raw_payload && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={() => setShowPayload(!showPayload)}
          >
            <Code className="h-3 w-3" /> {showPayload ? 'Ocultar' : 'Ver'} payload completo
          </Button>
          {showPayload && (
            <pre className="bg-background border border-border rounded p-2 text-[10px] max-h-60 overflow-auto whitespace-pre-wrap text-muted-foreground">
              {JSON.stringify(order.external_raw_payload, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

// ── component ────────────────────────────────────────────
export default function OrderManagement() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: orders = [], isLoading, refetch } = useOrders();
  const { updateOrder } = useOrderMutations();
  const { data: openCashRegister } = useOpenCashRegister();
  const { createPayment } = useCashRegisterMutations();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const previousOrdersRef = useRef<Order[]>([]);
  const { printKitchenTicket, printCancellationTicket, canPrintToKitchen } = useCentralizedPrinting();
  const { settings: kdsSettings } = useKdsSettings();

  const handleManualPrint = useCallback(async (order: Order) => {
    const rawPayload = (order as any).external_raw_payload as any;
    const items = (order.order_items ?? [])
      .filter(i => i.status !== 'cancelled')
      .map(i => {
        const allExtras = i.extras ?? [];
        const subItems = i.sub_items ?? [];
        const flavors = allExtras.filter((e: any) => e.kds_category === 'flavor');
        const others = allExtras.filter((e: any) => e.kds_category !== 'flavor');
        const result: string[] = [];
        for (const e of others) {
          const name = (e as any).extra_name.split(': ').slice(1).join(': ') || (e as any).extra_name;
          result.push(name);
        }
        if (flavors.length > 0) {
          const fraction = flavors.length > 1 ? `1/${flavors.length} ` : '';
          for (const e of flavors) {
            const name = (e as any).extra_name.split(': ').slice(1).join(': ') || (e as any).extra_name;
            result.push(`🍕 ${fraction}${name}`);
          }
        }
        // Sub-items (pizza units)
        if (subItems.length > 0) {
          for (const si of subItems as any[]) {
            result.push(`🍕 PIZZA ${si.sub_item_index}:`);
            for (const se of si.sub_extras || []) {
              result.push(`  ${se.quantity > 1 ? `${se.quantity}x ` : ''}${se.option_name}`);
            }
            if (si.notes) result.push(`  OBS: ${si.notes}`);
          }
        }
        // Fallback: if no structured extras/sub_items, use raw payload
        if (result.length === 0 && rawPayload?.items) {
          const itemName = i.product?.name ?? (i as any).product_name ?? '';
          const extItemId = (i as any).external_item_id;
          const rawItem = rawPayload.items.find((ri: any) => {
            if (extItemId && ri.order_item_id != null && String(ri.order_item_id) === extItemId) return true;
            return ri.name === itemName;
          });
          if (rawItem?.options?.length) {
            for (const opt of rawItem.options) {
              const name = (opt.name || '').replace(/\s*\([A-Z]+\)\s*$/, '').trim();
              if (name) result.push(name);
            }
          }
        }
        return {
          productName: i.product?.name ?? (i as any).product_name ?? 'Produto',
          quantity: i.quantity,
          notes: i.notes ?? undefined,
          variation: i.variation?.name,
          extras: result.length > 0 ? result : undefined,
        };
      });

    if (!items.length) {
      toast.error('Nenhum item para imprimir');
      return;
    }

    const ticketData: KitchenTicketData = {
      orderNumber: (order as any).display_number ? String((order as any).display_number) : order.id.slice(-5).toUpperCase(),
      orderType: order.order_type as 'dine_in' | 'takeaway' | 'delivery',
      customerName: order.customer_name || undefined,
      tableNumber: order.table?.number,
      items,
      createdAt: order.created_at,
    };

    const ok = await printKitchenTicket(ticketData);
    if (ok) toast.success('Impressão enviada!');
    else toast.error('Falha ao imprimir. Verifique a impressora.');
  }, [printKitchenTicket]);

  const [search, setSearch] = useState('');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [isXl, setIsXl] = useState(() => window.matchMedia('(min-width: 1280px)').matches);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)');
    const handler = () => setIsXl(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'mesa' | 'counter' | 'delivery' | 'integration' | 'cancelled'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [pendingDeliverId, setPendingDeliverId] = useState<string | null>(null);

  // ── delivery payment flow ─────────────────────────────
  const [paymentMethodSelectOpen, setPaymentMethodSelectOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [orderToComplete, setOrderToComplete] = useState<Order | null>(null);

  // ── toast on status change ─────────────────────────────
  useEffect(() => {
    if (previousOrdersRef.current.length > 0) {
      orders.forEach(order => {
        const prev = previousOrdersRef.current.find(o => o.id === order.id);
        if (prev && prev.status !== order.status) {
          const dn = (order as any).display_number ? (order as any).display_number : order.id.slice(-4).toUpperCase();
          if (order.status === 'ready' && prev.status === 'preparing')
            toast.success(`✅ Pedido #${dn} pronto!`, { duration: 5000 });
          else if (order.status === 'preparing' && prev.status === 'pending')
            toast.info(`🍳 Pedido #${dn} em preparo`);
        }
      });
    }
    previousOrdersRef.current = [...orders];
  }, [orders]);

  // ── realtime ───────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('order-management-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── filtered list ──────────────────────────────────────
  const filtered = useMemo(() => {
    let list = orders.filter(o => !o.is_draft);
    if (statusFilter) list = list.filter(o => o.status === statusFilter);
    if (activeTab === 'mesa') list = list.filter(o => o.order_type === 'dine_in');
    else if (activeTab === 'counter') list = list.filter(o => o.order_type === 'takeaway' && !o.external_source);
    else if (activeTab === 'delivery') list = list.filter(o => o.external_source === 'website');
    else if (activeTab === 'integration') list = list.filter(o => o.external_source === 'cardapioweb' || o.external_source === 'ifood');
    else if (activeTab === 'cancelled') list = list.filter(o => o.status === 'cancelled');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.customer_name?.toLowerCase().includes(q)) ||
        o.id.slice(-5).toLowerCase().includes(q) ||
        (o.external_display_id?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, statusFilter, activeTab, search]);

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  // ── stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = orders.filter(o => !o.is_draft);
    const counterOrders = active.filter(o => o.order_type === 'takeaway' && !o.external_source);
    const deliveryOrders = active.filter(o => o.external_source === 'website');
    const integrationOrders = active.filter(o => o.external_source === 'cardapioweb' || o.external_source === 'ifood');
    const takeawayActive = counterOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
    const deliveryActive = active.filter(o => o.order_type === 'delivery' && o.status !== 'delivered' && o.status !== 'cancelled');
    const avgTime = (list: Order[]) => {
      if (!list.length) return 0;
      const total = list.reduce((s, o) => s + (Date.now() - new Date(o.created_at).getTime()), 0);
      return Math.round(total / list.length / 60000);
    };
    return {
      total: active.length,
      mesa: active.filter(o => o.order_type === 'dine_in').length,
      counter: counterOrders.length,
      delivery: deliveryOrders.length,
      integration: integrationOrders.length,
      cancelled: active.filter(o => o.status === 'cancelled').length,
      avgTakeaway: avgTime(takeawayActive),
      avgDelivery: avgTime(deliveryActive),
    };
  }, [orders]);

  // ── permission guard ───────────────────────────────────
  if (!permissionsLoading && !hasPermission('orders_view')) {
    return <AccessDenied permission="orders_view" />;
  }

  // ── actions ────────────────────────────────────────────
  const doMarkDelivered = async (orderId: string) => {
    try {
      setIsDelivering(true);
      await updateOrder.mutateAsync({ id: orderId, status: 'delivered', delivered_at: new Date().toISOString() });
      toast.success('Pedido marcado como entregue!');
    } catch { toast.error('Erro ao atualizar status'); }
    finally { setIsDelivering(false); setChecklistOpen(false); setPendingDeliverId(null); }
  };

  const [isAccepting, setIsAccepting] = useState(false);
  const handleAcceptOrder = async (orderId: string) => {
    setIsAccepting(true);
    try {
      await updateOrder.mutateAsync({ id: orderId, status: 'preparing' });
      toast.success('Pedido aceito com sucesso!');
    } catch { toast.error('Erro ao aceitar pedido'); }
    finally { setIsAccepting(false); }
  };

  const handleMarkDelivered = async (orderId: string) => {
    const checklist = await fetchDispatchChecklist(orderId);
    if (checklist.length > 0) {
      setChecklistItems(checklist);
      setPendingDeliverId(orderId);
      setChecklistOpen(true);
    } else {
      doMarkDelivered(orderId);
    }
  };

  const handleCancelOrder = async (reason: string) => {
    if (!selectedOrderToCancel) return;
    setIsCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('orders').update({
        status: 'cancelled', cancellation_reason: reason,
        cancelled_by: user?.id, cancelled_at: new Date().toISOString(),
        status_before_cancellation: selectedOrderToCancel.status,
      }).eq('id', selectedOrderToCancel.id);

      // Print cancellation ticket to kitchen (if enabled in settings)
      const autoPrint = kdsSettings.autoPrintCancellations ?? true;
      if (autoPrint && canPrintToKitchen && selectedOrderToCancel.order_items && selectedOrderToCancel.order_items.length > 0) {
        try {
          const cancellationData: CancellationTicketData = {
            orderNumber: (selectedOrderToCancel as any).display_number ? String((selectedOrderToCancel as any).display_number) : selectedOrderToCancel.id,
            orderType: selectedOrderToCancel.order_type || 'takeaway',
            tableNumber: selectedOrderToCancel.table?.number,
            customerName: selectedOrderToCancel.customer_name,
            cancellationReason: reason,
            cancelledBy: user?.email || 'Desconhecido',
            items: selectedOrderToCancel.order_items.map(item => {
              const extraNames: string[] = [];
              if (item.extras && item.extras.length > 0) {
                item.extras.forEach(e => extraNames.push(`• ${e.extra_name}`));
              }
              if (item.sub_items && item.sub_items.length > 0) {
                const total = item.sub_items.length;
                item.sub_items.forEach((sub, idx) => {
                  const prefix = total > 1 ? `${idx + 1}/${total} ` : '';
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
          await printCancellationTicket(cancellationData);
        } catch (printError) {
          console.error('Error printing cancellation ticket:', printError);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Pedido cancelado', { description: `Motivo: ${reason}` });
      setCancelDialogOpen(false);
      setSelectedOrderToCancel(null);
    } catch { toast.error('Erro ao cancelar pedido'); }
    finally { setIsCancelling(false); }
  };

  // ── delivery payment completion ─────────────────────────
  const handleCompleteOrder = async (order: Order) => {
    if (order.payment_status === 'paid') {
      try {
        await updateOrder.mutateAsync({ id: order.id, status: 'delivered', delivered_at: new Date().toISOString() });
        toast.success('Pedido marcado como entregue!');
      } catch {
        toast.error('Erro ao marcar pedido como entregue');
      }
      return;
    }
    setOrderToComplete(order);
    setPaymentMethodSelectOpen(true);
  };

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setPaymentMethodSelectOpen(false);
    setPaymentModalOpen(true);
  };

  const handleConfirmDeliveryPayment = async (amount: number, observation: string) => {
    if (!orderToComplete) return;
    try {
      await createPayment.mutateAsync({
        order_id: orderToComplete.id,
        cash_register_id: openCashRegister?.id || null,
        payment_method: selectedPaymentMethod!,
        amount: Math.min(amount, Number(orderToComplete.total)),
        is_partial: false,
      });
      // Update observation/transaction_code
      if (observation.trim()) {
        await supabase.from('orders').update({ transaction_code: observation.trim() }).eq('id', orderToComplete.id);
      }
      await updateOrder.mutateAsync({ id: orderToComplete.id, status: 'delivered', delivered_at: new Date().toISOString() });
      toast.success('Pedido concluído com pagamento registrado!');
    } catch {
      toast.error('Erro ao concluir pedido');
    } finally {
      setPaymentModalOpen(false);
      setOrderToComplete(null);
      setSelectedPaymentMethod(null);
    }
  };

  const isDeliveryOrIntegration = (order: Order) =>
    order.order_type === 'delivery' || !!order.external_source;

  const openCancel = (order: Order) => { setSelectedOrderToCancel(order); setCancelDialogOpen(true); };

  return (
    <PDVLayout>
      <div className="flex flex-col h-[calc(100dvh-4rem)] xl:h-[calc(100dvh-0rem)] gap-2 xl:gap-3">
        {/* ── TOP BAR ─────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg xl:text-xl font-bold text-foreground">Pedidos</h1>
          {/* Desktop actions */}
          <div className="hidden xl:flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 font-medium">
              <Truck className="h-4 w-4" /> GESTÃO DE ENTREGAS
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 font-medium">
              <Columns3 className="h-4 w-4" /> AJUSTAR LAYOUT
            </Button>
          </div>
        </div>

        {/* ── SEARCH + ACTIONS ROW ─────────────────────── */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cliente ou nº do pedido"
              className="pl-9 h-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Desktop NOVO PEDIDO button */}
          <Button className="hidden xl:flex bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5 min-h-[44px]" onClick={() => setNewOrderOpen(true)}>
            <Plus className="h-4 w-4" /> NOVO PEDIDO
          </Button>
          {/* Mobile compact button */}
          <Button className="xl:hidden bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1 px-3 min-h-[40px]" onClick={() => setNewOrderOpen(true)}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>

        {/* ── STATS ROW ──────────────────────── */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-xs">
            <UtensilsCrossed className="h-3 w-3" /> {stats.avgTakeaway}min
          </Badge>
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-xs">
            <Truck className="h-3 w-3" /> {stats.avgDelivery}min
          </Badge>
        </div>

        {/* ── TABS (scrollable on mobile) ────────────── */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
            <TabsList className="w-max min-w-full justify-start">
              <TabsTrigger value="all" className="text-xs xl:text-sm whitespace-nowrap">Todos ({stats.total})</TabsTrigger>
              <TabsTrigger value="mesa" className="text-xs xl:text-sm whitespace-nowrap">Mesa ({stats.mesa})</TabsTrigger>
              <TabsTrigger value="counter" className="text-xs xl:text-sm whitespace-nowrap">Balcão ({stats.counter})</TabsTrigger>
              <TabsTrigger value="delivery" className="text-xs xl:text-sm whitespace-nowrap">Delivery ({stats.delivery})</TabsTrigger>
              <TabsTrigger value="integration" className="text-xs xl:text-sm whitespace-nowrap">Integração ({stats.integration})</TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs xl:text-sm whitespace-nowrap text-destructive">Cancelado ({stats.cancelled})</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* ── SPLIT VIEW ────────────────────────────── */}
        <div className="flex flex-1 gap-0 min-h-0 border rounded-lg overflow-hidden bg-background mb-1 xl:mb-0">
          {/* LEFT – "Seus pedidos" – hidden on tablet/mobile */}
          <div className="hidden xl:flex flex-[2] flex-col items-center justify-center min-h-0 border-r border-border">
            <p className="text-sm text-muted-foreground">Seus pedidos aparecerão aqui</p>
          </div>

          {/* CENTER – order list */}
          <div className="flex-1 xl:flex-[3] flex flex-col min-h-0 xl:border-r border-border">
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border">
                {isLoading ? (
                  <p className="p-6 text-center text-muted-foreground">Carregando...</p>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground py-20">
                    <Package className="h-12 w-12 opacity-30 mb-2" />
                    <p className="text-sm">Nenhum pedido encontrado</p>
                  </div>
                ) : filtered.map(order => {
                  const st = STATUS_MAP[order.status] ?? STATUS_MAP.pending;
                  const isSelected = selectedOrderId === order.id;
                  const displayNumber = (order as any).display_number ? String((order as any).display_number) : order.id.slice(-5).toUpperCase();
                  const isIfood = order.external_source === 'ifood';
                  const isCardapioWeb = order.external_source === 'cardapioweb';

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'flex items-center gap-2 xl:gap-3 px-3 xl:px-4 py-2.5 xl:py-3 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted',
                        isSelected && 'bg-primary/5'
                      )}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      {/* Avatar */}
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                          {order.order_type === 'dine_in' ? (
                            <UtensilsCrossed className="h-4 w-4" />
                          ) : order.order_type === 'delivery' ? (
                            <Truck className="h-4 w-4" />
                          ) : (
                            <Truck className="h-4 w-4" />
                          )}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm truncate text-foreground">
                            {order.order_type === 'dine_in' && (order as any).table?.number
                              ? `Mesa ${(order as any).table.number}`
                              : order.customer_name || 'Sem nome'}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            #{displayNumber}
                          </span>
                          {(order as any).pager_number && order.order_type === 'takeaway' && (
                            <Badge className="bg-amber-500 text-white border-amber-400 text-xs font-bold animate-pulse">
                              📟 #{(order as any).pager_number}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {/* Origem do pedido */}
                          {isIfood ? (
                            <>
                              <span className="text-[10px] font-bold text-white bg-red-500 rounded px-1 py-px leading-tight">iFood</span>
                              {order.external_display_id && order.external_display_id !== 'undefined' && (
                                <span className="text-xs font-bold text-destructive">{order.external_display_id}</span>
                              )}
                            </>
                          ) : isCardapioWeb ? (
                            <>
                              <span className="text-[10px] font-bold text-white bg-blue-500 rounded px-1 py-px leading-tight">CardápioWeb</span>
                              {order.external_display_id && order.external_display_id !== 'undefined' && (
                                <span className="text-xs font-bold text-blue-600">{order.external_display_id}</span>
                              )}
                            </>
                          ) : order.order_type === 'dine_in' ? (
                            <span className="text-[10px] font-bold text-white bg-green-600 rounded px-1 py-px leading-tight">
                              {(order as any).table?.number ? `Mesa ${(order as any).table.number}` : 'Mesa'}
                            </span>
                          ) : order.order_type === 'delivery' ? (
                            <span className="text-[10px] font-bold text-white bg-orange-500 rounded px-1 py-px leading-tight">Delivery</span>
                          ) : (
                            <span className="text-[10px] font-bold text-white bg-slate-500 rounded px-1 py-px leading-tight">Balcão</span>
                          )}
                          <span className="text-sm text-foreground font-medium">
                            R$ {Number(order.total).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Right side: time + status + KDS */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {elapsedText(order.created_at)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-[11px] py-0.5 px-2.5 border font-medium rounded-full', st.color)}
                        >
                          {st.label}
                        </Badge>
                        <KdsBadge items={order.order_items ?? []} />
                        {(order as any).logistics_status === 'buffered' && (
                          <Badge className="bg-amber-500 text-white border-amber-400 text-[10px] py-0 px-1.5 rounded-full animate-pulse">
                            ⏳ EM BUFFER
                          </Badge>
                        )}
                        {(order as any).logistics_status === 'grouped' && (
                          <Badge className="bg-blue-500 text-white border-blue-400 text-[10px] py-0 px-1.5 rounded-full">
                            📦 AGRUPADO
                          </Badge>
                        )}
                        {(order as any).delivery_status && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 rounded-full border-primary/50 text-primary">
                            🚚 {(order as any).delivery_status}
                          </Badge>
                        )}
                        {(order as any).integracao_logistica_status && (order as any).integracao_logistica_status !== 'pendente' && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] py-0 px-1.5 rounded-full",
                              (order as any).integracao_logistica_status === 'enviado'
                                ? "border-emerald-400 text-emerald-700"
                                : "border-destructive text-destructive"
                            )}
                          >
                            {(order as any).integracao_logistica_status === 'enviado' ? '✅ Enviado' : '⚠ Erro logística'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT – order detail (sheet on mobile/tablet, panel on desktop) */}
          <div className="hidden xl:flex flex-[2] flex-col min-h-0">
            {!selectedOrder ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Package className="h-16 w-16 opacity-20" />
                <p className="text-sm">Nenhum pedido selecionado</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-4">
                  {/* detail header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground">
                          Pedido #{selectedOrder.id.slice(-5).toUpperCase()}
                        </h2>
                        {selectedOrder.external_source === 'ifood' && (
                          <span className="text-[11px] font-bold text-white bg-red-500 rounded px-1.5 py-0.5 leading-tight">iFood</span>
                        )}
                        {selectedOrder.external_source === 'cardapioweb' && (
                          <span className="text-[11px] font-bold text-white bg-blue-500 rounded px-1.5 py-0.5 leading-tight">CW</span>
                        )}
                        {selectedOrder.external_display_id && selectedOrder.external_display_id !== 'undefined' && (
                          <span className="text-sm font-bold text-primary">{selectedOrder.external_display_id}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrder.order_type === 'dine_in' && selectedOrder.table
                          ? `Mesa ${selectedOrder.table.number}`
                          : selectedOrder.customer_name || 'Sem nome'} •{' '}
                        {ORDER_TYPE_LABEL[selectedOrder.order_type]}
                        {selectedOrder.order_type !== 'dine_in' && selectedOrder.table ? ` • Mesa ${selectedOrder.table.number}` : ''}
                      </p>
                      {(selectedOrder as any).pager_number && selectedOrder.order_type === 'takeaway' && (
                        <Badge className="mt-1 bg-amber-500 text-white border-amber-400 text-sm font-bold px-3 py-1 animate-pulse">
                          📟 PAGER #{(selectedOrder as any).pager_number}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleManualPrint(selectedOrder)} title="Imprimir comanda">
                        <Printer className="h-5 w-5" />
                      </Button>
                      <Badge variant="outline" className={cn('border rounded-full', STATUS_MAP[selectedOrder.status]?.color)}>
                        {STATUS_MAP[selectedOrder.status]?.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Delivery address */}
                  {(selectedOrder.order_type === 'delivery' || selectedOrder.external_source) && (
                    <DeliveryAddressSection order={selectedOrder} />
                  )}

                  {/* items */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Itens</h3>
                    {(selectedOrder.order_items ?? []).map((item: OrderItem) => (
                      <div key={item.id} className="flex justify-between items-start gap-2 py-2 border-b border-border last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {item.quantity}x {item.product?.name ?? (item as any).product_name ?? 'Produto'}
                          </p>
                          {item.variation && (
                            <p className="text-xs text-muted-foreground">{item.variation.name}</p>
                          )}
                          <OrderItemDetails extras={item.extras} subItems={(item as any).sub_items} notes={item.notes ?? undefined}>
                            <ItemKdsBadge item={item} />
                          </OrderItemDetails>
                        </div>
                        <span className="text-sm font-medium text-foreground whitespace-nowrap">
                          R$ {Number(item.total_price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* totals */}
                  <div className="border-t border-border pt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">R$ {Number(selectedOrder.subtotal).toFixed(2)}</span>
                    </div>
                    {Number(selectedOrder.discount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Desconto</span>
                        <span className="text-destructive">- R$ {Number(selectedOrder.discount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold items-center">
                      <span className="text-foreground">Total</span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">R$ {Number(selectedOrder.total).toFixed(2)}</span>
                        {selectedOrder.payment_status === 'paid' && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            {selectedOrder.payment_method === 'pix' ? 'Pago via PIX' : selectedOrder.payment_method === 'credit' ? 'Pago via Cartão' : 'Pago online'}
                          </Badge>
                        )}
                        {selectedOrder.payment_status === 'pending_online' && (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">Pgto online pendente</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedOrder.notes && (
                    <div className="bg-muted rounded-md p-3">
                      <p className="text-xs text-muted-foreground font-medium">Observações</p>
                      <p className="text-sm text-foreground">{selectedOrder.notes}</p>
                    </div>
                  )}

                  {/* Integration data section */}
                  {selectedOrder.external_source && (
                    <IntegrationDataSection order={selectedOrder} />
                  )}

                  {/* actions */}
                  <div className="flex gap-2 pt-2">
                    {selectedOrder.status === 'pending' && (
                      <Button
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleAcceptOrder(selectedOrder.id)}
                        disabled={isAccepting}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {isAccepting ? 'Aceitando...' : 'Aceitar Pedido'}
                      </Button>
                    )}
                    {(selectedOrder.status === 'preparing' || selectedOrder.status === 'ready') && isDeliveryOrIntegration(selectedOrder) && (
                      <Button
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleCompleteOrder(selectedOrder)}
                      >
                        {selectedOrder.payment_status === 'paid' ? (
                          <><CheckCircle2 className="h-4 w-4 mr-1" /> Marcar Entregue</>
                        ) : (
                          <><DollarSign className="h-4 w-4 mr-1" /> Concluir Pedido</>
                        )}
                      </Button>
                    )}
                    {selectedOrder.status === 'ready' && !isDeliveryOrIntegration(selectedOrder) && (
                      <Button
                        className="flex-1"
                        onClick={() => handleMarkDelivered(selectedOrder.id)}
                        disabled={isDelivering}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Marcar Entregue
                      </Button>
                    )}
                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => openCancel(selectedOrder)}
                      >
                        <Ban className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Mobile/Tablet detail sheet */}
        <Sheet open={!isXl && !!selectedOrderId && !!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrderId(null); }}>
          <SheetContent side="bottom" className="xl:hidden max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {selectedOrder ? `Pedido #${selectedOrder.id.slice(-5).toUpperCase()}` : 'Detalhes'}
              </SheetTitle>
            </SheetHeader>
            {selectedOrder && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">
                        {selectedOrder.order_type === 'dine_in' && selectedOrder.table
                          ? `Mesa ${selectedOrder.table.number}`
                          : selectedOrder.customer_name || 'Sem nome'} •{' '}
                        {ORDER_TYPE_LABEL[selectedOrder.order_type]}
                        {selectedOrder.order_type !== 'dine_in' && selectedOrder.table ? ` • Mesa ${selectedOrder.table.number}` : ''}
                      </span>
                      {selectedOrder.external_source === 'ifood' && (
                        <span className="text-[10px] font-bold text-white bg-red-500 rounded px-1 py-px leading-tight">iFood</span>
                      )}
                      {selectedOrder.external_source === 'cardapioweb' && (
                        <span className="text-[10px] font-bold text-white bg-blue-500 rounded px-1 py-px leading-tight">CW</span>
                      )}
                      {selectedOrder.external_display_id && selectedOrder.external_display_id !== 'undefined' && (
                        <span className="text-xs font-bold text-primary">{selectedOrder.external_display_id}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleManualPrint(selectedOrder)} title="Imprimir comanda">
                      <Printer className="h-5 w-5" />
                    </Button>
                    <Badge variant="outline" className={cn('border rounded-full', STATUS_MAP[selectedOrder.status]?.color)}>
                      {STATUS_MAP[selectedOrder.status]?.label}
                    </Badge>
                  </div>
                </div>
                {/* Delivery address - mobile */}
                {(selectedOrder.order_type === 'delivery' || selectedOrder.external_source) && (
                  <DeliveryAddressSection order={selectedOrder} />
                )}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Itens</h3>
                  {(selectedOrder.order_items ?? []).map((item: OrderItem) => (
                    <div key={item.id} className="flex justify-between items-start gap-2 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {item.quantity}x {item.product?.name ?? (item as any).product_name ?? 'Produto'}
                        </p>
                        {item.variation && <p className="text-xs text-muted-foreground">{item.variation.name}</p>}
                        <OrderItemDetails extras={item.extras} subItems={(item as any).sub_items} notes={item.notes ?? undefined}>
                          <ItemKdsBadge item={item} />
                        </OrderItemDetails>
                      </div>
                      <span className="text-sm font-medium text-foreground whitespace-nowrap">
                        R$ {Number(item.total_price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between text-base font-bold items-center">
                    <span className="text-foreground">Total</span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">R$ {Number(selectedOrder.total).toFixed(2)}</span>
                      {selectedOrder.payment_status === 'paid' && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                          {selectedOrder.payment_method === 'pix' ? 'Pago via PIX' : selectedOrder.payment_method === 'credit' ? 'Pago via Cartão' : 'Pago online'}
                        </Badge>
                      )}
                      {selectedOrder.payment_status === 'pending_online' && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">Pgto online pendente</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {selectedOrder.status === 'pending' && (
                    <Button className="flex-1 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleAcceptOrder(selectedOrder.id)} disabled={isAccepting}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> {isAccepting ? 'Aceitando...' : 'Aceitar Pedido'}
                    </Button>
                  )}
                  {(selectedOrder.status === 'preparing' || selectedOrder.status === 'ready') && isDeliveryOrIntegration(selectedOrder) && (
                    <Button className="flex-1 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleCompleteOrder(selectedOrder)}>
                      {selectedOrder.payment_status === 'paid' ? (
                        <><CheckCircle2 className="h-4 w-4 mr-1" /> Marcar Entregue</>
                      ) : (
                        <><DollarSign className="h-4 w-4 mr-1" /> Concluir Pedido</>
                      )}
                    </Button>
                  )}
                  {selectedOrder.status === 'ready' && !isDeliveryOrIntegration(selectedOrder) && (
                    <Button className="flex-1 min-h-[44px]" onClick={() => handleMarkDelivered(selectedOrder.id)} disabled={isDelivering}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar Entregue
                    </Button>
                  )}
                  {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                    <Button variant="destructive" className="flex-1 min-h-[44px]" onClick={() => openCancel(selectedOrder)}>
                      <Ban className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>

      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelOrder}
        orderInfo={selectedOrderToCancel
          ? `Pedido #${selectedOrderToCancel.id.slice(-5).toUpperCase()} - ${ORDER_TYPE_LABEL[selectedOrderToCancel.order_type] ?? selectedOrderToCancel.order_type}${selectedOrderToCancel.customer_name ? ` - ${selectedOrderToCancel.customer_name}` : ''}`
          : undefined}
        isLoading={isCancelling}
      />
      <NewOrderSheet
        open={newOrderOpen}
        onOpenChange={setNewOrderOpen}
        onOrderCreated={() => refetch()}
      />
      <DispatchChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        checklist={checklistItems}
        orderLabel={pendingDeliverId ? `Pedido #${pendingDeliverId.slice(-5).toUpperCase()}` : undefined}
        onConfirm={() => pendingDeliverId && doMarkDelivered(pendingDeliverId)}
        isProcessing={isDelivering}
      />

      {/* Payment method selection dialog */}
      <Dialog open={paymentMethodSelectOpen} onOpenChange={setPaymentMethodSelectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Forma de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {([
              { method: 'cash' as PaymentMethod, label: 'Dinheiro', icon: <Banknote className="h-6 w-6" /> },
              { method: 'credit_card' as PaymentMethod, label: 'Crédito', icon: <CreditCard className="h-6 w-6" /> },
              { method: 'debit_card' as PaymentMethod, label: 'Débito', icon: <CreditCard className="h-6 w-6" /> },
              { method: 'pix' as PaymentMethod, label: 'PIX', icon: <Smartphone className="h-6 w-6" /> },
            ]).map(({ method, label, icon }) => (
              <Button
                key={method}
                variant="outline"
                className="flex flex-col items-center gap-2 h-20 text-base"
                onClick={() => handleSelectPaymentMethod(method)}
              >
                {icon}
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment modal */}
      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={(open) => {
          setPaymentModalOpen(open);
          if (!open) { setOrderToComplete(null); setSelectedPaymentMethod(null); }
        }}
        paymentMethod={selectedPaymentMethod}
        remainingAmount={orderToComplete ? Number(orderToComplete.total) : 0}
        onConfirmPayment={handleConfirmDeliveryPayment}
        onPartialPayment={handleConfirmDeliveryPayment}
      />
    </PDVLayout>
  );
}