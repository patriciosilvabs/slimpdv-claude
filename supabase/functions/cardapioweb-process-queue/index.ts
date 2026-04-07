import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const CARDAPIOWEB_API_URL = 'https://integracao.cardapioweb.com/api/partner/v1';
const MAX_RETRIES = 5;
const BATCH_SIZE = 10;

interface CardapioWebOrder {
  id: number;
  display_id: number;
  merchant_id: number;
  status: string;
  order_type: string;
  order_timing: string;
  sales_channel: string;
  customer_origin: string | null;
  table_number: string | null;
  estimated_time: number | null;
  cancellation_reason: string | null;
  fiscal_document: string | null;
  observation: string | null;
  delivery_fee: number;
  service_fee: number;
  additional_fee: number;
  total: number;
  created_at: string;
  updated_at: string;
  schedule: { scheduled_date_time_start: string; scheduled_date_time_end: string } | null;
  customer: { id: number; name: string; phone: string } | null;
  delivery_address: {
    street: string; number: string | null; neighborhood: string;
    complement: string | null; reference: string | null; postal_code: string | null;
    city: string; state: string; latitude: string | null; longitude: string | null;
  } | null;
  items: Array<{
    item_id: number; order_item_id: number; external_code: string | null;
    name: string; quantity: number; unit_price: number; total_price: number;
    kind: string; status: string; observation: string | null;
    options: Array<{
      option_id: number; external_code: string | null; name: string;
      quantity: number; unit_price: number; option_group_id: number; option_group_name: string | null;
    }>;
  }>;
  payments: Array<{
    total: number; payment_method: string; payment_type: string;
    status: string; change_for: number | null;
  }>;
}

function resolveExternalSource(salesChannel: string): string {
  return (salesChannel || '').toUpperCase().includes('IFOOD') ? 'ifood' : 'cardapioweb';
}

function mapStatus(cwStatus: string): string {
  const m: Record<string, string> = {
    waiting_confirmation: 'pending', pending_payment: 'pending', pending_online_payment: 'pending',
    scheduled_confirmed: 'pending', confirmed: 'preparing', ready: 'ready', released: 'ready',
    waiting_to_catch: 'ready', delivered: 'delivered', canceling: 'cancelled', canceled: 'cancelled',
    closed: 'delivered',
  };
  return m[cwStatus] || 'pending';
}

function mapOrderType(cwType: string): string {
  const m: Record<string, string> = { delivery: 'delivery', takeout: 'takeaway', onsite: 'takeaway', closed_table: 'table' };
  return m[cwType] || 'takeaway';
}

function formatAddress(addr: CardapioWebOrder['delivery_address']): string {
  if (!addr) return '';
  const parts = [addr.street, addr.number, addr.neighborhood, addr.complement, addr.city, addr.state].filter(Boolean);
  let result = parts.join(', ');
  if (addr.reference) result += ` (Ref: ${addr.reference})`;
  return result;
}

function mapPaymentMethod(raw: string | null | undefined): string | null {
  const n = (raw || '').trim().toUpperCase();
  if (!n) return null;
  if (n.includes('PIX')) return 'pix';
  if (n.includes('CREDIT')) return 'credit';
  if (n.includes('DEBIT')) return 'debit';
  if (n.includes('CASH')) return 'cash';
  if (n.includes('VOUCHER') || n.includes('VALE')) return 'voucher';
  return n.toLowerCase();
}

function resolvePaymentDetails(payment?: CardapioWebOrder['payments'][number] | null) {
  const rawType = (payment?.payment_type || '').toUpperCase();
  const rawMethod = (payment?.payment_method || '').toUpperCase();
  const rawStatus = (payment?.status || '').toUpperCase();
  const isOnline = rawType === 'ONLINE';
  const isPaid = ['AUTHORIZED', 'PAID', 'APPROVED'].includes(rawStatus);
  let resolved: string;
  if (isOnline && isPaid) resolved = 'paid';
  else if (isOnline) resolved = 'pending_online';
  else resolved = 'pending';
  return { rawPaymentType: rawType, rawPaymentMethod: rawMethod, rawPaymentStatus: rawStatus, isOnlinePayment: isOnline, isPaid, mappedMethod: mapPaymentMethod(rawMethod), resolvedPaymentStatus: resolved };
}

function resolveAllPayments(payments: CardapioWebOrder['payments']) {
  if (!payments || payments.length === 0) {
    return { mappedMethod: null, resolvedPaymentStatus: 'pending', changeFor: null };
  }
  // Use first payment for status resolution
  const { mappedMethod, resolvedPaymentStatus } = resolvePaymentDetails(payments[0]);
  // Concatenate methods if multiple
  const allMethods = payments.length > 1
    ? payments.map(p => mapPaymentMethod(p.payment_method)).filter(Boolean).join(', ')
    : mappedMethod;
  // Get change_for from any payment that has it
  const changeFor = payments.find(p => p.change_for != null)?.change_for ?? null;
  return { mappedMethod: allMethods, resolvedPaymentStatus, changeFor };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Lock and fetch pending events
    const now = new Date().toISOString();
    const lockUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 min lock

    const { data: events, error: fetchErr } = await supabase
      .from('cardapioweb_webhook_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('lock_until', now)
      .order('received_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventIds = events.map(e => e.id);

    // Mark as processing with lock
    await supabase
      .from('cardapioweb_webhook_queue')
      .update({ status: 'processing', lock_until: lockUntil })
      .in('id', eventIds);

    let processed = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await processEvent(supabase, event);
        await supabase
          .from('cardapioweb_webhook_queue')
          .update({ status: 'success', processed_at: new Date().toISOString(), error_message: null })
          .eq('id', event.id);
        processed++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const newRetries = (event.retries || 0) + 1;
        const newStatus = newRetries >= MAX_RETRIES ? 'dead_letter' : 'pending';
        const backoff = new Date(Date.now() + newRetries * 30 * 1000).toISOString();

        await supabase
          .from('cardapioweb_webhook_queue')
          .update({
            status: newStatus,
            retries: newRetries,
            error_message: errMsg,
            lock_until: backoff,
          })
          .eq('id', event.id);

        console.error(`[ProcessQueue] Event ${event.id} failed (retry ${newRetries}):`, errMsg);
        failed++;
      }
    }

    console.log(`[ProcessQueue] Batch complete: ${processed} ok, ${failed} failed`);

    return new Response(
      JSON.stringify({ processed, failed, total: events.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[ProcessQueue] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// deno-lint-ignore no-explicit-any
async function processEvent(supabase: any, event: any) {
  const { merchant_id, event_type, external_order_id, order_status, payload } = event;

  // Find integration
  const { data: integration, error: intErr } = await supabase
    .from('cardapioweb_integrations')
    .select('*')
    .eq('store_id', String(merchant_id))
    .eq('is_active', true)
    .maybeSingle();

  if (intErr) throw intErr;
  if (!integration) throw new Error(`No active integration for merchant ${merchant_id}`);

  // Validate webhook token if configured
  const webhookToken = event.headers?.['x-webhook-token'];
  if (integration.webhook_secret && webhookToken && webhookToken !== integration.webhook_secret) {
    throw new Error('Invalid webhook token');
  }

  // Update tenant_id on queue record
  if (!event.tenant_id) {
    await supabase
      .from('cardapioweb_webhook_queue')
      .update({ tenant_id: integration.tenant_id })
      .eq('id', event.id);
  }

  // Log event
  await supabase.from('cardapioweb_logs').insert({
    tenant_id: integration.tenant_id,
    event_type,
    external_order_id: String(external_order_id),
    payload,
    status: 'processing',
  });

  if (event_type === 'ORDER_CREATED') {
    await processOrderCreated(supabase, integration, external_order_id);
  } else if (event_type === 'ORDER_STATUS_UPDATED' || event_type === 'PAYMENT_STATUS_UPDATED') {
    await processStatusUpdated(supabase, integration, external_order_id, order_status, event_type);
  } else {
    console.log(`[ProcessQueue] Unknown event_type: ${event_type}, skipping`);
  }

  // Update log to success
  await supabase
    .from('cardapioweb_logs')
    .update({ status: 'success' })
    .eq('external_order_id', String(external_order_id))
    .eq('tenant_id', integration.tenant_id)
    .eq('event_type', event_type);
}

// deno-lint-ignore no-explicit-any
async function processOrderCreated(supabase: any, integration: any, orderId: string) {
  // Fetch full order from CW API
  const orderResponse = await fetch(`${CARDAPIOWEB_API_URL}/orders/${orderId}`, {
    headers: { 'X-API-KEY': integration.api_token, Accept: 'application/json' },
  });

  if (!orderResponse.ok) {
    const errText = await orderResponse.text();
    throw new Error(`CW API error ${orderResponse.status}: ${errText}`);
  }

  const order: CardapioWebOrder = await orderResponse.json();

  // Validate API returned complete data
  if (!order.items || order.items.length === 0 || !order.total || order.total <= 0) {
    throw new Error(`API returned incomplete data for order ${orderId}: items=${order.items?.length ?? 0}, total=${order.total}. Will retry.`);
  }

  // Skip non-delivery
  if (order.order_type !== 'delivery') {
    console.log(`[ProcessQueue] Skipping non-delivery order ${order.id}`);
    return;
  }

  // Idempotency check with repair logic
  const { data: existing } = await supabase
    .from('orders')
    .select('id, total, external_raw_payload')
    .in('external_source', ['cardapioweb', 'ifood'])
    .eq('external_order_id', String(order.id))
    .eq('tenant_id', integration.tenant_id)
    .maybeSingle();

  if (existing) {
    // Repair: if existing order has empty data, update it instead of skipping
    const needsRepair = existing.total === 0 || existing.total === null || !existing.external_raw_payload;
    if (needsRepair) {
      console.log(`[ProcessQueue] Order ${order.id} exists but is incomplete. Repairing...`);
      await repairOrder(supabase, integration, existing.id, order);
      return;
    }
    console.log(`[ProcessQueue] Order ${order.id} already exists, skipping`);
    return;
  }

  const subtotal = order.items.reduce((s, i) => s + i.total_price, 0);
  const { mappedMethod, resolvedPaymentStatus, changeFor } = resolveAllPayments(order.payments);

  const baseStatus = mapStatus(order.status);
  let orderStatus: string;
  if (resolvedPaymentStatus === 'pending_online') orderStatus = 'pending';
  else if (integration.auto_accept && baseStatus === 'pending') orderStatus = 'preparing';
  else orderStatus = baseStatus;

  // Build notes with reference point
  let notes = order.observation || '';
  if (order.delivery_address?.reference) {
    notes = notes ? `${notes} | Ref: ${order.delivery_address.reference}` : `Ref: ${order.delivery_address.reference}`;
  }

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      tenant_id: integration.tenant_id,
      order_type: mapOrderType(order.order_type),
      status: orderStatus,
      customer_name: order.customer?.name || null,
      customer_phone: order.customer?.phone || null,
      customer_address: order.delivery_address ? formatAddress(order.delivery_address) : null,
      notes,
      subtotal,
      total: order.total,
      discount: 0,
      external_source: resolveExternalSource(order.sales_channel),
      external_order_id: String(order.id),
      external_display_id: order.display_id != null ? String(order.display_id) : null,
      delivery_fee: order.delivery_fee,
      service_fee: order.service_fee || 0,
      additional_fee: order.additional_fee || 0,
      change_for: changeFor,
      fiscal_document: order.fiscal_document || null,
      external_customer_id: order.customer?.id ? String(order.customer.id) : null,
      delivery_lat: order.delivery_address?.latitude ? parseFloat(order.delivery_address.latitude) : null,
      delivery_lng: order.delivery_address?.longitude ? parseFloat(order.delivery_address.longitude) : null,
      external_raw_payload: order,
      payment_method: mappedMethod,
      payment_status: resolvedPaymentStatus,
      scheduled_for: order.schedule?.scheduled_date_time_start || null,
      is_draft: false,
    })
    .select()
    .single();

  if (orderError) {
    if (orderError.code === '23505' || orderError.code === 'PGRST116') {
      console.log(`[ProcessQueue] Duplicate suppressed for order ${orderId}`);
      return;
    }
    throw orderError;
  }

  // Fetch mappings, complement groups, complement options in parallel
  const [mappingsRes, groupsRes, optionsRes] = await Promise.all([
    supabase.from('cardapioweb_product_mappings').select('*').eq('tenant_id', integration.tenant_id),
    supabase.from('complement_groups').select('name, kds_category').eq('tenant_id', integration.tenant_id),
    supabase.from('complement_options').select('id, name, external_code, ifood_code').eq('tenant_id', integration.tenant_id).eq('is_active', true),
  ]);

  const mappingMap = new Map((mappingsRes.data || []).map((m: { cardapioweb_item_id: number }) => [m.cardapioweb_item_id, m]));
  const complementGroups = groupsRes.data || [];
  const complementOptions = optionsRes.data || [];
  const orderSource = resolveExternalSource(order.sales_channel);

  for (const item of order.items) {
    // deno-lint-ignore no-explicit-any
    const mapping = mappingMap.get(item.item_id) as any;
    const optionsTotal = item.options.reduce((s, o) => s + o.unit_price * o.quantity, 0);
    const unitPrice = item.unit_price + optionsTotal;

    const { data: orderItem, error: itemError } = await supabase
      .from('order_items')
      .insert({
        tenant_id: integration.tenant_id,
        order_id: newOrder.id,
        product_id: mapping?.local_product_id || null,
        variation_id: mapping?.local_variation_id || null,
        product_name: item.name || null,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: item.total_price,
        notes: item.observation,
        status: 'pending',
        external_item_id: String(item.order_item_id),
        external_code: item.external_code || null,
        item_kind: item.kind || null,
      })
      .select()
      .single();

    if (itemError) { console.error('[ProcessQueue] Item error:', itemError); continue; }

    if (item.options.length > 0) {
      const extras = item.options.map(opt => {
        const groupName = opt.option_group_name || '';
        const groupNameLower = groupName.toLowerCase();
        const matchedGroup = groupName ? complementGroups.find((g: { name: string }) => g.name.toLowerCase() === groupNameLower) : null;
        let matchedOption = null;
        const optExternalCode = opt.external_code || '';
        if (optExternalCode) {
          if (orderSource === 'ifood') matchedOption = complementOptions.find((co: { ifood_code: string | null }) => co.ifood_code && co.ifood_code === optExternalCode);
          if (!matchedOption) matchedOption = complementOptions.find((co: { external_code: string | null }) => co.external_code && co.external_code === optExternalCode);
        }
        if (!matchedOption) {
          const optName = (opt.name || '').trim().toLowerCase();
          matchedOption = complementOptions.find((co: { name: string }) => co.name.trim().toLowerCase() === optName);
        }
        const extraName = groupName ? `${groupName}: ${opt.name}` : opt.name;
        // Infer kds_category: check matched group, fallback to name-based heuristic
        const inferCategory = (): string => {
          const resolved = matchedGroup?.kds_category || 'complement';
          if (resolved !== 'complement') return resolved;
          // Check group name for sabor/flavor hints
          if (groupNameLower.includes('sabor')) return 'flavor';
          // Check option name for fraction pattern like "1/2 Calabresa"
          if (/^\d+\/\d+\s/.test(opt.name || '')) return 'flavor';
          return 'complement';
        };
        return {
          tenant_id: integration.tenant_id,
          order_item_id: orderItem.id,
          extra_name: extraName,
          extra_id: matchedOption?.id || null,
          price: opt.unit_price * opt.quantity,
          quantity: opt.quantity,
          external_option_id: String(opt.option_id),
          external_group_id: String(opt.option_group_id),
          kds_category: inferCategory(),
        };
      });
      await supabase.from('order_item_extras').insert(extras);
    }

    if (!mapping) {
      await supabase.from('cardapioweb_product_mappings').upsert({
        tenant_id: integration.tenant_id,
        cardapioweb_item_id: item.item_id,
        cardapioweb_item_name: item.name,
      }, { onConflict: 'tenant_id,cardapioweb_item_id' });
    }
  }

  console.log(`[ProcessQueue] Order created: ${newOrder.id}`);

  // Dispatch order.created webhook for generic webhooks (e.g. DeliveryPay)
  try {
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/order-webhooks`;
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        order_id: newOrder.id,
        event: 'order.created',
        tenant_id: integration.tenant_id,
      }),
    });
    console.log(`[ProcessQueue] order.created webhook dispatched for ${newOrder.id}`);
  } catch (whErr) {
    console.error('[ProcessQueue] order.created webhook dispatch error:', whErr);
  }

  // Auto-send to delivery logistics
  const holdForPayment = resolvedPaymentStatus === 'pending_online';
  if (!holdForPayment && mapOrderType(order.order_type) === 'delivery') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const { data: activeWebhooks } = await supabase
        .from('order_webhooks')
        .select('id')
        .eq('tenant_id', integration.tenant_id)
        .eq('is_active', true)
        .eq('auto_send', true);

      if (activeWebhooks && activeWebhooks.length > 0) {
        for (const wh of activeWebhooks) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-order-to-delivery`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                order_id: newOrder.id,
                webhook_id: wh.id,
                tenant_id: integration.tenant_id,
              }),
            });
            console.log(`[ProcessQueue] Sent to delivery webhook: ${wh.id}`);
          } catch (whErr) {
            console.error(`[ProcessQueue] Failed to send to webhook: ${wh.id}`, whErr);
          }
        }
      }
    } catch (deliveryErr) {
      console.error('[ProcessQueue] Error querying delivery webhooks:', deliveryErr);
    }
  }
}

// deno-lint-ignore no-explicit-any
async function repairOrder(supabase: any, integration: any, existingOrderId: string, order: CardapioWebOrder) {
  const subtotal = order.items.reduce((s, i) => s + i.total_price, 0);
  const { mappedMethod, resolvedPaymentStatus, changeFor } = resolveAllPayments(order.payments);

  let notes = order.observation || '';
  if (order.delivery_address?.reference) {
    notes = notes ? `${notes} | Ref: ${order.delivery_address.reference}` : `Ref: ${order.delivery_address.reference}`;
  }

  await supabase.from('orders').update({
    customer_name: order.customer?.name || null,
    customer_phone: order.customer?.phone || null,
    customer_address: order.delivery_address ? formatAddress(order.delivery_address) : null,
    notes,
    subtotal,
    total: order.total,
    delivery_fee: order.delivery_fee,
    service_fee: order.service_fee || 0,
    additional_fee: order.additional_fee || 0,
    change_for: changeFor,
    fiscal_document: order.fiscal_document || null,
    external_customer_id: order.customer?.id ? String(order.customer.id) : null,
    delivery_lat: order.delivery_address?.latitude ? parseFloat(order.delivery_address.latitude) : null,
    delivery_lng: order.delivery_address?.longitude ? parseFloat(order.delivery_address.longitude) : null,
    external_raw_payload: order,
    external_display_id: order.display_id != null ? String(order.display_id) : null,
    payment_method: mappedMethod,
    payment_status: resolvedPaymentStatus,
  }).eq('id', existingOrderId);

  // Check if items exist
  const { data: existingItems } = await supabase.from('order_items').select('id').eq('order_id', existingOrderId).limit(1);
  if (!existingItems || existingItems.length === 0) {
    const [mappingsRes, groupsRes, optionsRes] = await Promise.all([
      supabase.from('cardapioweb_product_mappings').select('*').eq('tenant_id', integration.tenant_id),
      supabase.from('complement_groups').select('name, kds_category').eq('tenant_id', integration.tenant_id),
      supabase.from('complement_options').select('id, name, external_code, ifood_code').eq('tenant_id', integration.tenant_id).eq('is_active', true),
    ]);
    const mappingMap = new Map((mappingsRes.data || []).map((m: { cardapioweb_item_id: number }) => [m.cardapioweb_item_id, m]));
    const complementGroups = groupsRes.data || [];
    const complementOptions = optionsRes.data || [];
    const orderSource = resolveExternalSource(order.sales_channel);

    for (const item of order.items) {
      // deno-lint-ignore no-explicit-any
      const mapping = mappingMap.get(item.item_id) as any;
      const optionsTotal = item.options.reduce((s, o) => s + o.unit_price * o.quantity, 0);
      const { data: orderItem } = await supabase.from('order_items').insert({
        tenant_id: integration.tenant_id, order_id: existingOrderId,
        product_id: mapping?.local_product_id || null, variation_id: mapping?.local_variation_id || null,
        product_name: item.name || null, quantity: item.quantity,
        unit_price: item.unit_price + optionsTotal, total_price: item.total_price,
        notes: item.observation, status: 'pending',
        external_item_id: String(item.order_item_id), external_code: item.external_code || null,
        item_kind: item.kind || null,
      }).select().single();

      if (orderItem && item.options.length > 0) {
        const extras = item.options.map(opt => {
          const groupName = opt.option_group_name || '';
          const groupNameLower = groupName.toLowerCase();
          const matchedGroup = groupName ? complementGroups.find((g: { name: string }) => g.name.toLowerCase() === groupNameLower) : null;
          let matchedOption = null;
          const optCode = opt.external_code || '';
          if (optCode) {
            if (orderSource === 'ifood') matchedOption = complementOptions.find((co: { ifood_code: string | null }) => co.ifood_code && co.ifood_code === optCode);
            if (!matchedOption) matchedOption = complementOptions.find((co: { external_code: string | null }) => co.external_code && co.external_code === optCode);
          }
          if (!matchedOption) matchedOption = complementOptions.find((co: { name: string }) => co.name.trim().toLowerCase() === (opt.name || '').trim().toLowerCase());
          const extraName = groupName ? `${groupName}: ${opt.name}` : opt.name;
          const inferCategory = (): string => {
            const resolved = matchedGroup?.kds_category || 'complement';
            if (resolved !== 'complement') return resolved;
            if (groupNameLower.includes('sabor')) return 'flavor';
            if (/^\d+\/\d+\s/.test(opt.name || '')) return 'flavor';
            return 'complement';
          };
          return {
            tenant_id: integration.tenant_id, order_item_id: orderItem.id,
            extra_name: extraName, extra_id: matchedOption?.id || null,
            price: opt.unit_price * opt.quantity, quantity: opt.quantity,
            external_option_id: String(opt.option_id), external_group_id: String(opt.option_group_id),
            kds_category: inferCategory(),
          };
        });
        await supabase.from('order_item_extras').insert(extras);
      }
      if (!mapping) {
        await supabase.from('cardapioweb_product_mappings').upsert({
          tenant_id: integration.tenant_id, cardapioweb_item_id: item.item_id, cardapioweb_item_name: item.name,
        }, { onConflict: 'tenant_id,cardapioweb_item_id' });
      }
    }
  }
  console.log(`[ProcessQueue] Order repaired: ${existingOrderId}`);
}

// deno-lint-ignore no-explicit-any
async function processStatusUpdated(supabase: any, integration: any, orderId: string, newStatus: string | null, eventType: string) {
  const { data: existingOrder, error: findError } = await supabase
    .from('orders')
    .select('id, status, is_draft, payment_status')
    .in('external_source', ['cardapioweb', 'ifood'])
    .eq('external_order_id', String(orderId))
    .eq('tenant_id', integration.tenant_id)
    .maybeSingle();

  if (findError || !existingOrder) throw new Error(`Order not found: ${orderId}`);

  let latestOrderStatus = newStatus || existingOrder.status;
  let resolvedPaymentStatus = existingOrder.payment_status;
  let resolvedPaymentMethod: string | null | undefined;
  let paymentConfirmed = existingOrder.payment_status === 'paid';

  if (existingOrder.payment_status === 'pending_online' || eventType === 'PAYMENT_STATUS_UPDATED') {
    try {
      const resp = await fetch(`${CARDAPIOWEB_API_URL}/orders/${orderId}`, {
        headers: { 'X-API-KEY': integration.api_token, Accept: 'application/json' },
      });
      if (resp.ok) {
        const fullOrder: CardapioWebOrder = await resp.json();
        latestOrderStatus = fullOrder.status || latestOrderStatus;
        const pd = resolvePaymentDetails(fullOrder.payments[0]);
        resolvedPaymentStatus = pd.resolvedPaymentStatus;
        resolvedPaymentMethod = pd.mappedMethod;
        paymentConfirmed = pd.resolvedPaymentStatus === 'paid';
      }
    } catch (e) {
      console.warn('[ProcessQueue] Could not re-fetch for payment:', e);
    }
  }

  let mappedStatus = mapStatus(latestOrderStatus || existingOrder.status);
  if (resolvedPaymentStatus === 'pending_online' && !['cancelled', 'delivered'].includes(mappedStatus)) {
    mappedStatus = 'pending';
  } else if (paymentConfirmed && integration.auto_accept && existingOrder.status === 'pending') {
    mappedStatus = 'preparing';
  }

  await supabase
    .from('orders')
    .update({
      status: mappedStatus,
      payment_status: resolvedPaymentStatus,
      ...(resolvedPaymentMethod ? { payment_method: resolvedPaymentMethod } : {}),
      ...(mappedStatus === 'cancelled' ? { cancellation_reason: 'Cancelado pelo CardápioWeb', cancelled_at: new Date().toISOString() } : {}),
      ...(mappedStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq('id', existingOrder.id);

  console.log(`[ProcessQueue] Status updated: ${existingOrder.id} -> ${mappedStatus}`);
}
