import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useCardapioWebIntegration } from '@/hooks/useCardapioWebIntegration';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { useCentralizedPrinting } from '@/hooks/useCentralizedPrinting';
import { toast } from 'sonner';
import type { KitchenTicketData } from '@/utils/escpos';

/**
 * Listens for new/activated integration orders and:
 * 1. Plays looping audio alert
 * 2. After ~2.5s auto-accepts the order
 * 3. Stops the sound
 * 4. Auto-prints kitchen ticket (if integration.auto_print is enabled)
 *
 * Mount once in PDVLayout.
 */
// Cross-tab dedup via localStorage — prevents duplicate prints across multiple open tabs
function isOrderProcessed(key: string): boolean {
  const lsKey = `_int_processed_${key}`;
  const val = localStorage.getItem(lsKey);
  if (!val) return false;
  if (Date.now() - parseInt(val) > 600_000) {
    localStorage.removeItem(lsKey);
    return false;
  }
  return true;
}

function markOrderProcessed(key: string) {
  localStorage.setItem(`_int_processed_${key}`, String(Date.now()));
}

export function IntegrationAutoHandler() {
  const { tenantId } = useTenant();
  const { integration } = useCardapioWebIntegration();
  const { autoAccept } = useOrderSettings();
  const { settings: audioSettings, getSoundUrl } = useAudioNotification();
  const { printKitchenTicket } = useCentralizedPrinting();
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Keep refs to avoid stale closures in realtime callbacks
  const integrationRef = useRef(integration);
  useEffect(() => { integrationRef.current = integration; }, [integration]);

  const autoAcceptRef = useRef(autoAccept);
  useEffect(() => { autoAcceptRef.current = autoAccept; }, [autoAccept]);

  const audioSettingsRef = useRef(audioSettings);
  useEffect(() => { audioSettingsRef.current = audioSettings; }, [audioSettings]);

  const printKitchenTicketRef = useRef(printKitchenTicket);
  useEffect(() => { printKitchenTicketRef.current = printKitchenTicket; }, [printKitchenTicket]);

  const getSoundUrlRef = useRef(getSoundUrl);
  useEffect(() => { getSoundUrlRef.current = getSoundUrl; }, [getSoundUrl]);

  // Cleanup active audio on unmount
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current = null;
      }
    };
  }, []);

  const handleActivatedOrder = useCallback(async (
    orderId: string,
    displayId: string,
    customerName?: string,
    source?: string,
    paymentStatus?: string | null,
    orderStatus?: string,
  ) => {
    const isPendingPayment = paymentStatus === 'pending_online';

    // Use separate dedup keys: "sound" fires once on arrival, "print" fires once when eligible
    const soundKey = `sound:${orderId}`;
    const printKey = `print:${orderId}`;
    const alreadyNotified = isOrderProcessed(soundKey);
    const alreadyPrinted = isOrderProcessed(printKey);

    // --- Sound + Toast (only if not already notified) ---
    if (!alreadyNotified) {
      markOrderProcessed(soundKey);

      toast.info(`Novo pedido de integração #${displayId}`, {
        description: isPendingPayment
          ? 'Aguardando confirmação de pagamento (Pix)'
          : customerName
            ? `Cliente: ${customerName}`
            : `Origem: ${source || 'integração'}`,
        duration: 8000,
      });

      // Start looping sound — ALWAYS play on arrival
      let audio: HTMLAudioElement | null = null;
      const currentAudioSettings = audioSettingsRef.current;
      if (currentAudioSettings.enabled && currentAudioSettings.enabledSounds.newOrder) {
        try {
          const soundUrl = await getSoundUrlRef.current('newOrder');
          if (soundUrl) {
            audio = new Audio(soundUrl);
            audio.loop = true;
            audio.volume = currentAudioSettings.volume;
            activeAudioRef.current = audio;
            await audio.play();
            console.log('[IntegrationAutoHandler] Looping alert started for order', orderId);
          }
        } catch (err) {
          console.warn('[IntegrationAutoHandler] Could not start looping alert:', err);
        }
      }

      // Wait ~2.5s then stop sound
      await new Promise(r => setTimeout(r, 2500));
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        activeAudioRef.current = null;
        console.log('[IntegrationAutoHandler] Alert stopped for order', orderId);
      }
    }

    // --- Skip if payment pending ---
    if (isPendingPayment) {
      console.log('[IntegrationAutoHandler] Skipped — awaiting payment', { orderId, paymentStatus });
      return;
    }

    // --- Auto-accept: if order is still 'pending', update to 'preparing' ---
    const currentIntegration = integrationRef.current;
    let effectiveStatus = orderStatus;

    if (orderStatus === 'pending' && autoAcceptRef.current) {
      const acceptKey = `accept:${orderId}`;
      if (!isOrderProcessed(acceptKey)) {
        markOrderProcessed(acceptKey);
        try {
          const { error: acceptError } = await supabase
            .from('orders')
            .update({ status: 'preparing', updated_at: new Date().toISOString() })
            .eq('id', orderId)
            .eq('status', 'pending'); // only if still pending (avoid race)

          if (!acceptError) {
            effectiveStatus = 'preparing';
            console.log('[IntegrationAutoHandler] Auto-accepted order', orderId);
            toast.success(`Pedido #${displayId} aceito automaticamente`);
          } else {
            console.warn('[IntegrationAutoHandler] Auto-accept failed:', acceptError.message);
          }
        } catch (err) {
          console.error('[IntegrationAutoHandler] Auto-accept error:', err);
        }
      }
    }

    // --- Skip auto-print if status not eligible or already printed ---
    if (effectiveStatus !== 'preparing' || alreadyPrinted) {
      if (effectiveStatus !== 'preparing') {
        console.log('[IntegrationAutoHandler] Auto-print skipped — status not preparing', {
          orderId, effectiveStatus,
        });
      }
      return;
    }
    markOrderProcessed(printKey);

    // --- 5) Auto-print ---
    console.log('[IntegrationAutoHandler] auto_print check:', {
      integrationLoaded: !!currentIntegration,
      autoPrint: currentIntegration?.auto_print,
    });
    if (currentIntegration?.auto_print) {
      try {
        // Fetch full order data for printing — retry up to 3 times
        // because order_items may not be committed yet
        let order: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { data, error: fetchError } = await supabase
            .from('orders')
            .select('*, order_items(*, products(name), product_variations(name), order_item_extras(extra_name, price, kds_category), order_item_sub_items(sub_item_index, notes, order_item_sub_item_extras(option_name, price)))')
            .eq('id', orderId)
            .single();

          if (fetchError) {
            console.warn(`[IntegrationAutoHandler] Fetch attempt ${attempt} failed:`, fetchError.message);
          } else if (data?.order_items?.length) {
            order = data;
            console.log(`[IntegrationAutoHandler] Order fetched on attempt ${attempt} with ${data.order_items.length} items`);
            break;
          } else {
            console.warn(`[IntegrationAutoHandler] Attempt ${attempt}: order found but 0 items, retrying...`);
          }

          if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
        }

        if (order && order.order_items?.length) {
          const ticketItems = (order.order_items as any[]).map((item: any) => {
            const extras: string[] = [];

            if (item.order_item_extras?.length) {
              // Separate flavor extras from other extras
              const flavorExtras = item.order_item_extras.filter((e: any) => e.kds_category === 'flavor');
              const otherExtras = item.order_item_extras.filter((e: any) => e.kds_category !== 'flavor');

              // Other extras: strip group prefix (same as orderToTicketData in KitchenReceipt)
              for (const e of otherExtras) {
                const name = e.extra_name.split(': ').slice(1).join(': ') || e.extra_name;
                extras.push(name);
              }

              // Flavor extras: format with fraction prefix like sub_items
              if (flavorExtras.length > 0) {
                const total = flavorExtras.length;
                const fraction = total > 1 ? `1/${total} ` : '';
                for (const e of flavorExtras) {
                  const name = e.extra_name.split(': ').slice(1).join(': ') || e.extra_name;
                  extras.push(`  ${fraction}${name}`);
                }
              }
            }

            if (item.order_item_sub_items?.length) {
              const subs = [...item.order_item_sub_items].sort((a: any, b: any) => a.sub_item_index - b.sub_item_index);
              const total = subs.length;
              for (const si of subs) {
                extras.push(`🍕 PIZZA ${si.sub_item_index}:`);
                const fractionPrefix = total > 1 ? `1/${total} ` : '';
                for (const c of si.order_item_sub_item_extras || []) {
                  extras.push(`  ${fractionPrefix}${c.option_name}`);
                }
                if (si.notes) {
                  extras.push(`  OBS: ${si.notes}`);
                }
              }
            }

            const productName = item.products?.name || item.product_name || item.product_variations?.name || 'Produto';

            return {
              productName,
              quantity: item.quantity,
              notes: item.notes || undefined,
              extras,
            };
          });

          const orderTypeMap: Record<string, 'delivery' | 'takeaway' | 'dine_in'> = {
            delivery: 'delivery',
            takeaway: 'takeaway',
            table: 'dine_in',
          };

          const ticketData: KitchenTicketData = {
            items: ticketItems,
            orderNumber: order.external_display_id || order.id.slice(0, 8),
            orderType: orderTypeMap[order.order_type] || 'takeaway',
            customerName: order.customer_name || undefined,
            tableNumber: undefined,
            notes: order.notes || undefined,
            createdAt: order.created_at,
          };

          const printResult = await printKitchenTicketRef.current(ticketData);
          console.log('[IntegrationAutoHandler] Kitchen ticket print result:', printResult, 'for order', orderId);
          if (!printResult) {
            console.warn('[IntegrationAutoHandler] Print returned false — no printer connected and no queue available');
          }
        } else {
          console.error('[IntegrationAutoHandler] Could not fetch order with items after 3 attempts for order', orderId);
        }
      } catch (err) {
        console.error('[IntegrationAutoHandler] Failed to auto-print:', err);
      }
    } else {
      console.log('[IntegrationAutoHandler] Auto-print skipped:', !currentIntegration ? 'integration not loaded' : 'auto_print disabled');
    }
  }, []);

  // Use ref for handler so channels don't re-subscribe on every render
  const handlerRef = useRef(handleActivatedOrder);
  useEffect(() => { handlerRef.current = handleActivatedOrder; }, [handleActivatedOrder]);

  // Poll for pending internal takeaway/delivery orders and auto-accept them
  // (Realtime is disabled on VPS nginx, so polling is the only mechanism)
  useEffect(() => {
    if (!tenantId) return;

    const doPoll = async () => {
      if (!autoAcceptRef.current) return;

      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id, external_display_id, display_number, customer_name, order_type, external_source')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .eq('is_draft', false)
        .in('order_type', ['takeaway', 'delivery', 'dine_in']);

      if (!pendingOrders?.length) return;

      for (const order of pendingOrders) {
        // Skip integration orders — handled separately via handlerRef
        if ((order as any).external_source) continue;

        const acceptKey = `accept:${order.id}`;
        if (isOrderProcessed(acceptKey)) continue;
        markOrderProcessed(acceptKey);

        try {
          const { error } = await supabase
            .from('orders')
            .update({ status: 'preparing', updated_at: new Date().toISOString() })
            .eq('id', order.id)
            .eq('status', 'pending');

          if (!error) {
            const dn = (order as any).display_number;
            const displayId = dn ? `#${dn}` : ((order as any).external_display_id || `#${order.id.slice(-4).toUpperCase()}`);
            toast.success(`Pedido ${displayId} aceito automaticamente`);
            console.log('[AutoAccept] Internal order auto-accepted:', order.id);

            // Auto-print kitchen ticket for internal orders
            const printKey = `print:${order.id}`;
            if (!isOrderProcessed(printKey)) {
              markOrderProcessed(printKey);
              try {
                const { data: fullOrder } = await supabase
                  .from('orders')
                  .select('*, order_items(*, products(name), product_variations(name), order_item_extras(extra_name, price, kds_category))')
                  .eq('id', order.id)
                  .single();

                if (fullOrder?.order_items?.length) {
                  const orderType = (order as any).order_type;
                  const ticketData: KitchenTicketData = {
                    items: (fullOrder.order_items as any[]).map((item: any) => ({
                      productName: item.products?.name || item.product_variations?.name || 'Produto',
                      quantity: item.quantity,
                      notes: item.notes || undefined,
                      extras: (item.order_item_extras || []).map((e: any) =>
                        e.extra_name.includes(': ') ? e.extra_name.split(': ').slice(1).join(': ') : e.extra_name
                      ),
                    })),
                    orderNumber: dn ? String(dn) : order.id.slice(0, 8).toUpperCase(),
                    orderType: orderType === 'dine_in' ? 'dine_in' : orderType === 'delivery' ? 'delivery' : 'takeaway',
                    customerName: (order as any).customer_name || undefined,
                    createdAt: new Date().toISOString(),
                  };
                  const printResult = await printKitchenTicketRef.current(ticketData);
                  console.log('[AutoAccept] Kitchen ticket print result:', printResult, 'for order', order.id);
                }
              } catch (printErr) {
                console.error('[AutoAccept] Failed to auto-print:', printErr);
              }
            }
          }
        } catch (err) {
          console.error('[AutoAccept] Error accepting order:', order.id, err);
        }
      }
    };

    doPoll();
    const interval = setInterval(doPoll, 5000);
    return () => clearInterval(interval);
  }, [tenantId]);

  // Poll for new integration orders — Realtime is disabled on VPS, so this is
  // the only way to trigger sound + auto-print for CardápioWeb/iFood orders.
  useEffect(() => {
    if (!tenantId) return;

    const doPollIntegration = async () => {
      // Look for integration orders created in the last 10 minutes not yet processed
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: integrationOrders } = await supabase
        .from('orders')
        .select('id, external_display_id, display_number, customer_name, external_source, payment_status, status, is_draft')
        .eq('tenant_id', tenantId)
        .eq('is_draft', false)
        .not('external_source', 'is', null)
        .in('status', ['pending', 'preparing'])
        .gte('created_at', since);

      if (!integrationOrders?.length) return;

      for (const order of integrationOrders) {
        const soundKey = `sound:${order.id}`;
        if (isOrderProcessed(soundKey)) continue; // already handled

        const displayId = (order as any).external_display_id ||
          ((order as any).display_number ? `#${(order as any).display_number}` : order.id.slice(0, 8));

        handlerRef.current(
          order.id,
          displayId,
          (order as any).customer_name,
          (order as any).external_source,
          (order as any).payment_status,
          (order as any).status,
        );
      }
    };

    doPollIntegration();
    const interval = setInterval(doPollIntegration, 8000);
    return () => clearInterval(interval);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    const insertChannel = supabase
      .channel('integration-auto-insert')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const order = payload.new as any;
          if (!order.external_source) return;
          if (order.is_draft) return;
          const displayId = order.external_display_id || order.id.slice(0, 8);
          handlerRef.current(
            order.id,
            displayId,
            order.customer_name,
            order.external_source,
            order.payment_status,
            order.status,
          );
        }
      )
      .subscribe();

    const updateChannel = supabase
      .channel('integration-auto-update')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const oldOrder = payload.old as any;
          const newOrder = payload.new as any;
          if (!newOrder.external_source) return;
          const becameAutomatable =
            (oldOrder.is_draft === true && newOrder.is_draft === false) ||
            (oldOrder.status !== newOrder.status && newOrder.status === 'preparing' && oldOrder.status === 'pending') ||
            (oldOrder.payment_status === 'pending_online' && newOrder.payment_status === 'paid');

          if (becameAutomatable) {
            const displayId = newOrder.external_display_id || newOrder.id.slice(0, 8);
            handlerRef.current(
              newOrder.id,
              displayId,
              newOrder.customer_name,
              newOrder.external_source,
              newOrder.payment_status,
              newOrder.status,
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(insertChannel);
      supabase.removeChannel(updateChannel);
    };
  }, [tenantId]);

  return null;
}
