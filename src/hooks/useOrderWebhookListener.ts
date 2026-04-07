import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

/**
 * Listens for order status changes via Realtime and fires configured webhooks.
 * Mount once at app level (e.g., inside PDVLayout or App).
 *
 * v1.7 — Fires order.created on INSERT reliably + fallback on first UPDATE.
 *         Every status change fires order.<status> immediately, no exceptions.
 */
export function useOrderWebhookListener() {
  const { tenantId } = useTenant();
  const firedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('order-webhook-listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const newRow = payload.new as any;
          const orderId = newRow?.id;
          const orderTenantId = newRow?.tenant_id;
          const isDraft = newRow?.is_draft;

          if (!orderId || orderTenantId !== tenantId) return;

          console.log('[WebhookListener] INSERT detected:', { orderId, isDraft, order_type: newRow?.order_type, external_source: newRow?.external_source });

          // For orders inserted already confirmed (site, integrations), fire order.created
          if (isDraft === false) {
            const createdKey = `created:${orderId}`;
            if (!firedRef.current.has(createdKey)) {
              firedRef.current.add(createdKey);
              setTimeout(() => firedRef.current.delete(createdKey), 120000);

              console.log('[WebhookListener] Firing order.created from INSERT for:', orderId);

              // Fire order.created for generic webhooks
              supabase.functions.invoke('order-webhooks', {
                body: { order_id: orderId, event: 'order.created', tenant_id: tenantId },
              }).then(({ data, error }) => {
                console.log('[WebhookListener] INSERT order.created result:', { data, error: error?.message });
              }).catch((err: any) => {
                console.error('[WebhookListener] INSERT order.created webhook failed:', err);
              });

              // Auto-send to delivery if applicable
              if (newRow?.order_type === 'delivery') {
                try {
                  const { data: autoWebhooks } = await supabase
                    .from('order_webhooks')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('is_active', true)
                    .eq('auto_send', true);

                  if (autoWebhooks && autoWebhooks.length > 0) {
                    for (const wh of autoWebhooks) {
                      supabase.functions.invoke('send-order-to-delivery', {
                        body: { order_id: orderId, webhook_id: wh.id, tenant_id: tenantId },
                      }).catch((err: any) => {
                        console.error('[WebhookListener] INSERT auto-send failed:', err);
                      });
                    }
                  }
                } catch (err) {
                  console.error('[WebhookListener] INSERT auto-send error:', err);
                }
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload) => {
          const oldRow = payload.old as any;
          const newRow = payload.new as any;
          const oldStatus = oldRow?.status;
          const newStatus = newRow?.status;
          const orderId = newRow?.id;
          const orderTenantId = newRow?.tenant_id;
          const externalSource = newRow?.external_source;
          const oldIsDraft = oldRow?.is_draft;
          const newIsDraft = newRow?.is_draft;
          const orderType = newRow?.order_type;

          if (!orderId || orderTenantId !== tenantId) return;

          console.log('[WebhookListener] UPDATE detected:', { orderId, oldStatus, newStatus, oldIsDraft, newIsDraft, orderType, externalSource });

          // --- Draft → Confirmed (PDV flow) ---
          if (oldIsDraft === true && newIsDraft === false) {
            const createdKey = `created:${orderId}`;
            if (!firedRef.current.has(createdKey)) {
              firedRef.current.add(createdKey);
              setTimeout(() => firedRef.current.delete(createdKey), 120000);

              console.log('[WebhookListener] Firing order.created from draft→confirmed for:', orderId);

              // Fire generic order.created
              supabase.functions.invoke('order-webhooks', {
                body: { order_id: orderId, event: 'order.created', tenant_id: tenantId },
              }).then(({ data, error }) => {
                console.log('[WebhookListener] draft→confirmed order.created result:', { data, error: error?.message });
              }).catch((err) => {
                console.error('[WebhookListener] order.created webhook failed:', err);
              });
            }

            // Auto-send to delivery if delivery order
            if (orderType === 'delivery') {
              const autoKey = `auto:${orderId}`;
              if (!firedRef.current.has(autoKey)) {
                firedRef.current.add(autoKey);
                setTimeout(() => firedRef.current.delete(autoKey), 120000);
                try {
                  const { data: autoWebhooks } = await supabase
                    .from('order_webhooks')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('is_active', true)
                    .eq('auto_send', true);

                  if (autoWebhooks && autoWebhooks.length > 0) {
                    for (const wh of autoWebhooks) {
                      supabase.functions.invoke('send-order-to-delivery', {
                        body: { order_id: orderId, webhook_id: wh.id, tenant_id: tenantId },
                      }).then(({ error }) => {
                        if (error) {
                          console.error('[WebhookListener] Auto-send failed, enqueueing retry:', error);
                          supabase.from('delivery_retry_queue').insert({
                            tenant_id: tenantId,
                            order_id: orderId,
                            webhook_id: wh.id,
                          } as any).then(() => {});
                        }
                      }).catch((err) => {
                        console.error('[WebhookListener] Auto-send failed, enqueueing retry:', err);
                        supabase.from('delivery_retry_queue').insert({
                          tenant_id: tenantId,
                          order_id: orderId,
                          webhook_id: wh.id,
                        } as any).then(() => {});
                      });
                    }
                  }
                } catch (err) {
                  console.error('[WebhookListener] Auto-send error:', err);
                }
              }
            }
          }

          // --- Cancellation → notify delivery platform ---
          if (oldStatus !== 'cancelled' && newStatus === 'cancelled' && orderType === 'delivery') {
            const cancelKey = `cancel:${orderId}`;
            if (!firedRef.current.has(cancelKey)) {
              firedRef.current.add(cancelKey);
              setTimeout(() => firedRef.current.delete(cancelKey), 120000);
              try {
                const { data: autoWebhooks } = await supabase
                  .from('order_webhooks')
                  .select('id')
                  .eq('tenant_id', tenantId)
                  .eq('is_active', true)
                  .eq('auto_send', true);

                if (autoWebhooks && autoWebhooks.length > 0) {
                  for (const wh of autoWebhooks) {
                    supabase.functions.invoke('send-order-to-delivery', {
                      body: { order_id: orderId, webhook_id: wh.id, tenant_id: tenantId, cancelled: true },
                    }).catch((err) => {
                      console.error('[WebhookListener] Cancel notification failed:', err);
                    });
                  }
                }
              } catch (err) {
                console.error('[WebhookListener] Cancel notification error:', err);
              }
            }
          }

          if (oldStatus === newStatus) return;

          // --- Fallback: if order.created was never fired (INSERT missed), fire it now ---
          const createdKey = `created:${orderId}`;
          if (!firedRef.current.has(createdKey) && newIsDraft === false) {
            firedRef.current.add(createdKey);
            setTimeout(() => firedRef.current.delete(createdKey), 120000);

            console.log('[WebhookListener] Fallback: firing missed order.created for:', orderId);

            supabase.functions.invoke('order-webhooks', {
              body: { order_id: orderId, event: 'order.created', tenant_id: tenantId },
            }).then(({ data, error }) => {
              console.log('[WebhookListener] Fallback order.created result:', { data, error: error?.message });
            }).catch((err) => {
              console.error('[WebhookListener] Fallback order.created failed:', err);
            });
          }

          // --- CardápioWeb status sync ---
          if (['cardapioweb', 'ifood'].includes(externalSource) && newStatus) {
            const cwKey = `cw:${orderId}:${newStatus}`;
            if (!firedRef.current.has(cwKey)) {
              firedRef.current.add(cwKey);
              setTimeout(() => firedRef.current.delete(cwKey), 60000);
              supabase.functions.invoke('cardapioweb-sync-status', {
                body: { order_id: orderId, new_status: newStatus },
              }).catch((err) => {
                console.error('[WebhookListener] CardápioWeb sync failed:', err);
              });
            }
          }

          // --- Generic webhook events — ALL status changes, no exceptions ---
          const STATUS_EVENT_MAP: Record<string, string> = {
            pending: 'order.pending',
            preparing: 'order.preparing',
            ready: 'order.ready',
            dispatched: 'order.dispatched',
            delivered: 'order.delivered',
            cancelled: 'order.cancelled',
          };
          const event = STATUS_EVENT_MAP[newStatus] || `order.${newStatus}`;

          const key = `${orderId}:${event}`;
          if (firedRef.current.has(key)) return;
          firedRef.current.add(key);
          setTimeout(() => firedRef.current.delete(key), 60000);

          console.log('[WebhookListener] Firing status webhook:', { orderId, event });

          try {
            const { data, error } = await supabase.functions.invoke('order-webhooks', {
              body: { order_id: orderId, event, tenant_id: tenantId },
            });
            console.log('[WebhookListener] Status webhook result:', { event, data, error: error?.message });
          } catch (err) {
            console.error('[WebhookListener] Failed to fire webhook:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);
}
