import { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTables, useTableMutations } from '@/hooks/useTables';
import { useOrders, useOrderMutations, type Order } from '@/hooks/useOrders';
import { useTableWaitSettings } from '@/hooks/useTableWaitSettings';
import { useIdleTableSettings } from '@/hooks/useIdleTableSettings';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { useTenant } from '@/hooks/useTenant';
import { mobileAwareToast as toast } from '@/lib/mobileToast';

const WAIT_COOLDOWN_KEY = 'table-wait-cooldowns';
const IDLE_COOLDOWN_KEY = 'idle-table-cooldowns';

function loadCooldowns(key: string): Map<string, number> {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      const now = Date.now();
      const filtered = Object.entries(parsed).filter(([, time]) => now - (time as number) < 3600000);
      return new Map(filtered.map(([k, v]) => [k, v as number]));
    }
  } catch { /* ignore */ }
  return new Map();
}

function saveCooldowns(key: string, map: Map<string, number>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
  } catch { /* ignore */ }
}

/**
 * GlobalAlerts — montado uma vez em App.tsx, roda em TODAS as páginas.
 * Detecta: pedido pronto, tempo de espera de mesa, KDS parado, mesa ociosa.
 * Emite som conforme configuração de áudio.
 */
// Solicita permissão de notificação do OS uma vez e envia notificação nativa
// quando a aba está oculta (minimizada / em background).
function sendOsNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico', silent: false });
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') new Notification(title, { body, icon: '/favicon.ico', silent: false });
    });
  }
}

export function GlobalAlerts() {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // No KDS, notificações são apenas informativas — sem botão de ação (evita sair da tela)
  const isKds = pathname.startsWith('/kds');

  const { data: tables } = useTables();
  const { data: orders } = useOrders(['pending', 'preparing', 'ready', 'delivered']);

  // Solicita permissão de notificação ao montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  const { updateTable } = useTableMutations();
  const { updateOrder } = useOrderMutations();
  const { settings: tableWaitSettings } = useTableWaitSettings();
  const { settings: idleTableSettings } = useIdleTableSettings();
  const {
    playNewOrderSound,
    playOrderReadySound,
    playTableWaitAlertSound,
    playIdleTableAlertSound,
    settings: audioSettings,
  } = useAudioNotification();

  const mountTimeRef = useRef<number>(Date.now());
  const notifiedReadyOrdersRef = useRef<Set<string>>(new Set());
  const knownOrderIdsRef = useRef<Set<string> | null>(null); // null = not yet initialized
  const dismissedWaitAlertsRef = useRef<Set<string>>(new Set());
  const dismissedKdsIdleAlertsRef = useRef<Set<string>>(new Set());
  const tableWaitAlertCooldownRef = useRef<Map<string, number>>(loadCooldowns(WAIT_COOLDOWN_KEY));
  const idleTableCooldownRef = useRef<Map<string, number>>(loadCooldowns(IDLE_COOLDOWN_KEY));

  // ── 1. Pedido pronto ────────────────────────────────────────────────────────
  // Usa ready_at como âncora: qualquer pedido que ficou pronto APÓS o mount
  // dispara o alerta, sem depender de detectar transição de status entre polls.
  useEffect(() => {
    if (!tenantId || !orders) return;

    orders.forEach(order => {
      if (order.status !== 'ready') return;
      if (notifiedReadyOrdersRef.current.has(order.id)) return;

      // Use ready_at if available, fallback to updated_at when order became ready
      const readyAt = (order as any).ready_at || order.updated_at;
      if (!readyAt) return;

      const readyTime = new Date(readyAt).getTime();
      // Ignora pedidos que já estavam prontos antes do app abrir
      if (readyTime < mountTimeRef.current) return;

      const table = tables?.find(t => t.id === order.table_id);
      const isDineIn = order.order_type === 'dine_in';
      const label = isDineIn
        ? `🔔 Mesa ${table?.number || '?'} - Pedido Pronto!`
        : `🔔 Pedido #${(order as any).order_number || order.id.slice(-4)} Pronto!`;

      // Always attempt sound — browser allows it if user has interacted with the page.
      // Also send OS notification when tab is hidden so staff sees it even in background.
      if (audioSettings.enabled) playOrderReadySound();
      if (document.hidden) {
        sendOsNotification(label, 'A cozinha finalizou o preparo');
      }

      // Toast sempre (aparece quando o usuário voltar para a aba, ou imediatamente se visível)
      toast.success(label, {
        description: 'A cozinha finalizou o preparo',
        duration: 8000,
        action: isKds ? undefined : (isDineIn
          ? { label: 'Ver Mesa', onClick: () => navigate('/tables') }
          : { label: 'Ver Pedidos', onClick: () => navigate('/orders') }),
      });
      notifiedReadyOrdersRef.current.add(order.id);
    });
  }, [orders, tables, audioSettings.enabled, playOrderReadySound, tenantId, navigate]);

  // ── 1b. Novo pedido (polling — supabase.channel é no-op no backend local) ──
  useEffect(() => {
    if (!tenantId || !orders) return;

    // First run: snapshot all existing orders as "already known" — don't notify for them
    if (knownOrderIdsRef.current === null) {
      knownOrderIdsRef.current = new Set(orders.map(o => o.id));
      return;
    }

    orders.forEach(order => {
      if (order.status === 'cancelled') return;
      if (knownOrderIdsRef.current!.has(order.id)) return;

      knownOrderIdsRef.current!.add(order.id);

      // Only notify for orders created after the app opened
      const createdAt = new Date(order.created_at!).getTime();
      if (createdAt < mountTimeRef.current - 5000) return; // 5s tolerance

      // Skip integration orders — handled elsewhere
      if ((order as any).external_source) return;
      if ((order as any).is_draft) return;

      if (audioSettings.enabled) playNewOrderSound();

      const label = order.order_type === 'dine_in'
        ? `🔔 Novo pedido — Mesa ${tables?.find(t => t.id === order.table_id)?.number || '?'}`
        : `🔔 Novo pedido #${order.id.slice(-4).toUpperCase()}`;

      toast.success(label, {
        description: 'Um novo pedido foi recebido',
        duration: 6000,
        action: isKds ? undefined : { label: 'Ver', onClick: () => navigate('/orders') },
      });
    });
  }, [orders, tables, audioSettings.enabled, playNewOrderSound, tenantId, navigate]);

  // ── 2. Tempo de espera de mesa ──────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId || !tableWaitSettings.enabled || !orders) return;

    const checkTableWaitTimes = () => {
      const now = Date.now();
      const dineInOrders = orders.filter(order => {
        if (order.order_type !== 'dine_in') return false;
        if (order.status === 'ready' || order.status === 'delivered' || order.status === 'cancelled') return false;
        // Comida já pronta (ready_at set) ou servida — não alertar sobre espera
        if ((order as any).ready_at || (order as any).served_at) return false;
        // Verificar itens: se todos estão done/served, não alertar
        const activeItems = (order as any).order_items?.filter((i: any) => !i.cancelled_at) || [];
        if (activeItems.length > 0 && activeItems.every((i: any) =>
          i.station_status === 'done' || i.station_status === 'dispatched' || !!i.served_at
        )) return false;
        const table = tables?.find(t => t.id === order.table_id);
        return table?.status === 'occupied';
      });

      dineInOrders.forEach(order => {
        const waitMinutes = Math.floor((Date.now() - new Date(order.created_at!).getTime()) / 60000);
        if (waitMinutes < tableWaitSettings.thresholdMinutes) return;

        const table = tables?.find(t => t.id === order.table_id);

        if (tableWaitSettings.persistentAlert) {
          if (dismissedWaitAlertsRef.current.has(order.id)) return;
          const toastId = `table-wait-${order.id}`;
          if (audioSettings.enabled) playTableWaitAlertSound();
          toast.warning(
            `⏰ Mesa ${table?.number || '?'} - ${waitMinutes} minutos!`,
            {
              id: toastId,
              description: `Tempo de espera ultrapassou ${tableWaitSettings.thresholdMinutes} minutos.`,
              duration: Infinity,
              className: 'bg-red-600 text-white border-red-700 animate-pulse [&_*]:text-white [&_button]:text-white [&_button]:border-white/30',
              action: {
                label: 'Entendido',
                onClick: () => {
                  dismissedWaitAlertsRef.current.add(order.id);
                  toast.always.dismiss(toastId);
                },
              },
              onDismiss: () => { dismissedWaitAlertsRef.current.add(order.id); },
              onAutoClose: () => { dismissedWaitAlertsRef.current.add(order.id); },
            }
          );
        } else {
          const lastAlert = tableWaitAlertCooldownRef.current.get(order.id) || 0;
          const cooldownMs = tableWaitSettings.cooldownMinutes * 60000;
          if (now - lastAlert >= cooldownMs) {
            if (audioSettings.enabled) playTableWaitAlertSound();
            toast.warning(
              `⏰ Mesa ${table?.number || '?'} - ${waitMinutes} minutos!`,
              {
                description: `Tempo de espera ultrapassou ${tableWaitSettings.thresholdMinutes} minutos`,
                duration: 8000,
                className: 'bg-red-600 text-white border-red-700 animate-pulse [&_*]:text-white [&_button]:text-white [&_button]:border-white/30',
              }
            );
            tableWaitAlertCooldownRef.current.set(order.id, now);
            saveCooldowns(WAIT_COOLDOWN_KEY, tableWaitAlertCooldownRef.current);
          }
        }
      });
    };

    const intervalMs = (tableWaitSettings.checkIntervalSeconds || 30) * 1000;
    checkTableWaitTimes();
    const interval = setInterval(checkTableWaitTimes, intervalMs);
    return () => clearInterval(interval);
  }, [orders, tables, tableWaitSettings, audioSettings.enabled, playTableWaitAlertSound, tenantId]);

  // ── 3. KDS parado (item sem movimentação) ───────────────────────────────────
  useEffect(() => {
    if (!tenantId || !tableWaitSettings.kdsIdleEnabled || !orders || !tables) return;

    const checkKdsIdle = () => {
      const now = Date.now();
      const dineInOrders = orders.filter(order => {
        if (order.order_type !== 'dine_in') return false;
        if (order.status === 'delivered' || order.status === 'cancelled') return false;
        return tables?.find(t => t.id === order.table_id)?.status === 'occupied';
      });

      dineInOrders.forEach(order => {
        if (!order.order_items) return;
        order.order_items.forEach(item => {
          if (!item.current_station_id || item.station_status === 'done' || item.station_status === 'dispatched' || item.status === 'cancelled') return;
          // Itens no passa-prato (waiter_serve) não são "parados" — estão aguardando o garçom
          const itemAnyStation = (item as any).current_station;
          if (itemAnyStation?.station_type === 'waiter_serve' || itemAnyStation?.station_type === 'order_status') return;

          const itemAny = item as any;
          const stationStarted = itemAny.station_started_at
            ? new Date(itemAny.station_started_at).getTime()
            : new Date(item.created_at).getTime();
          const idleMinutes = Math.floor((now - stationStarted) / 60000);

          if (idleMinutes < tableWaitSettings.kdsIdleMinutes) return;

          const alertKey = `${item.id}-kds-idle`;
          const toastId = `kds-idle-${item.id}`;
          if (dismissedKdsIdleAlertsRef.current.has(alertKey)) return;

          const table = tables?.find(t => t.id === order.table_id);
          const stationName = itemAny.current_station?.name || 'KDS';

          if (audioSettings.enabled) playTableWaitAlertSound();
          toast.warning(
            `⚠️ Mesa ${table?.number || '?'} — parado no KDS há ${idleMinutes} min`,
            {
              id: toastId,
              description: `Pedido parado em "${stationName}" sem movimentação.`,
              duration: tableWaitSettings.persistentAlert ? Infinity : 8000,
              className: 'bg-red-600 text-white border-red-700 animate-pulse [&_*]:text-white [&_button]:text-white [&_button]:border-white/30',
              action: {
                label: 'Entendido',
                onClick: () => {
                  dismissedKdsIdleAlertsRef.current.add(alertKey);
                  toast.always.dismiss(toastId);
                },
              },
              onDismiss: () => { dismissedKdsIdleAlertsRef.current.add(alertKey); },
              onAutoClose: () => { dismissedKdsIdleAlertsRef.current.add(alertKey); },
            }
          );
        });
      });
    };

    const intervalMs = (tableWaitSettings.checkIntervalSeconds || 30) * 1000;
    checkKdsIdle();
    const interval = setInterval(checkKdsIdle, intervalMs);
    return () => clearInterval(interval);
  }, [orders, tables, tableWaitSettings, audioSettings.enabled, playTableWaitAlertSound, tenantId]);

  // ── 4. Mesa ociosa ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId || !idleTableSettings.enabled || !orders || !tables) return;

    const checkIdleTables = async () => {
      const now = Date.now();
      const occupiedTables = tables.filter(t => t.status === 'occupied');

      for (const table of occupiedTables) {
        const emptyOrder = orders.find(o =>
          o.table_id === table.id &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled' &&
          (o as any).is_draft !== true &&
          (!o.order_items || o.order_items.length === 0) &&
          ((o as any).total ?? 0) === 0 && ((o as any).subtotal ?? 0) === 0
        );

        const deliveredOrder = idleTableSettings.includeDeliveredOrders
          ? orders.find(o => o.table_id === table.id && o.status === 'delivered')
          : null;

        let orderToCheck = emptyOrder;
        let referenceTime: number | null = null;
        let idleReason = 'sem pedidos';

        if (emptyOrder) {
          referenceTime = new Date(emptyOrder.created_at!).getTime();
        } else if (deliveredOrder) {
          orderToCheck = deliveredOrder;
          referenceTime = new Date((deliveredOrder as any).updated_at!).getTime();
          idleReason = 'pedido entregue';
        }

        if (!orderToCheck || !referenceTime) continue;

        const idleMinutes = Math.floor((now - referenceTime) / 60000);
        if (idleMinutes < idleTableSettings.thresholdMinutes) continue;

        const lastAlert = idleTableCooldownRef.current.get(table.id) || 0;
        if (now - lastAlert < 5 * 60000) continue;

        idleTableCooldownRef.current.set(table.id, now);
        saveCooldowns(IDLE_COOLDOWN_KEY, idleTableCooldownRef.current);

        if (idleTableSettings.autoClose) {
          try {
            await updateTable.mutateAsync({ id: table.id, status: 'available' });
            if (emptyOrder) await updateOrder.mutateAsync({ id: orderToCheck.id, status: 'cancelled' });
            toast.info(
              `🔄 Mesa ${table.number} fechada automaticamente`,
              { description: `Ociosa por ${idleMinutes} minutos (${idleReason})` }
            );
          } catch { /* ignore */ }
        } else {
          if (audioSettings.enabled) playIdleTableAlertSound();
          toast.warning(
            `⚠️ Mesa ${table.number} ociosa - ${idleMinutes} min`,
            {
              description: `Mesa aberta (${idleReason})`,
              duration: 10000,
              action: {
                label: 'Fechar Mesa',
                onClick: async () => {
                  try {
                    await updateTable.mutateAsync({ id: table.id, status: 'available' });
                    if (emptyOrder) await updateOrder.mutateAsync({ id: orderToCheck!.id, status: 'cancelled' });
                    toast.success(`Mesa ${table.number} fechada`);
                  } catch { /* ignore */ }
                },
              },
            }
          );
        }
      }
    };

    checkIdleTables();
    const interval = setInterval(checkIdleTables, 60000);
    return () => clearInterval(interval);
  }, [orders, tables, idleTableSettings, audioSettings.enabled, playIdleTableAlertSound, updateTable, updateOrder, tenantId]);

  return null;
}
