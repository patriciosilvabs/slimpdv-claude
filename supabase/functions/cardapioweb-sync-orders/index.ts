import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const CARDAPIOWEB_API_URL = 'https://integracao.cardapioweb.com/api/partner/v1';

// Resolve the real order origin from the sales_channel field
function resolveExternalSource(salesChannel: string): string {
  const ch = (salesChannel || '').toUpperCase();
  if (ch.includes('IFOOD')) return 'ifood';
  return 'cardapioweb';
}

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
  schedule: {
    scheduled_date_time_start: string;
    scheduled_date_time_end: string;
  } | null;
  customer: {
    id: number;
    name: string;
    phone: string;
  } | null;
  delivery_address: {
    street: string;
    number: string | null;
    neighborhood: string;
    complement: string | null;
    reference: string | null;
    postal_code: string | null;
    city: string;
    state: string;
    latitude: string | null;
    longitude: string | null;
  } | null;
  items: Array<{
    item_id: number;
    order_item_id: number;
    external_code: string | null;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    kind: string;
    status: string;
    observation: string | null;
    options: Array<{
      option_id: number;
      external_code: string | null;
      name: string;
      quantity: number;
      unit_price: number;
      option_group_id: number;
      option_group_name: string | null;
    }>;
  }>;
  payments: Array<{
    total: number;
    payment_method: string;
    payment_type: string;
    status: string;
    change_for: number | null;
  }>;
}

// Map CardápioWeb status to local status
function mapStatus(cwStatus: string): string {
  const statusMap: Record<string, string> = {
    'waiting_confirmation': 'pending',
    'pending_payment': 'pending',
    'pending_online_payment': 'pending',
    'scheduled_confirmed': 'pending',
    'confirmed': 'preparing',
    'ready': 'ready',
    'released': 'ready',
    'waiting_to_catch': 'ready',
    'delivered': 'delivered',
    'canceling': 'cancelled',
    'canceled': 'cancelled',
    'closed': 'delivered',
  };
  return statusMap[cwStatus] || 'pending';
}

// Map CardápioWeb order type to local type
function mapOrderType(cwType: string): string {
  const typeMap: Record<string, string> = {
    'delivery': 'delivery',
    'takeout': 'takeaway',
    'onsite': 'takeaway',
    'closed_table': 'table',
  };
  return typeMap[cwType] || 'takeaway';
}

// Format address as string
function formatAddress(addr: CardapioWebOrder['delivery_address']): string {
  if (!addr) return '';
  const parts = [
    addr.street, addr.number, addr.neighborhood, addr.complement, addr.city, addr.state,
  ].filter(Boolean);
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

function resolveAllPayments(payments: CardapioWebOrder['payments']) {
  if (!payments || payments.length === 0) {
    return { mappedMethod: null, resolvedPaymentStatus: 'pending', changeFor: null, isPaid: false, holdForPayment: false };
  }
  const payment = payments[0];
  const isOnline = (payment.payment_type || '').toUpperCase() === 'ONLINE';
  const isPaid = ['AUTHORIZED', 'PAID', 'APPROVED'].includes((payment.status || '').toUpperCase());
  const holdForPayment = isOnline && !isPaid;
  const resolvedPaymentStatus = isPaid ? 'paid' : (holdForPayment ? 'pending_online' : 'pending');
  const allMethods = payments.length > 1
    ? payments.map(p => mapPaymentMethod(p.payment_method)).filter(Boolean).join(', ')
    : mapPaymentMethod(payment.payment_method);
  const changeFor = payments.find(p => p.change_for != null)?.change_for ?? null;
  return { mappedMethod: allMethods, resolvedPaymentStatus, changeFor, isPaid, holdForPayment };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { start_date, end_date } = await req.json();

    console.log('[CardápioWeb Sync] Starting sync for period:', start_date, 'to', end_date);

    // Get authorization header to find user's tenant
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('[CardápioWeb Sync] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: tenantMember } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantMember) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantMember.tenant_id;

    // Get integration config
    const { data: integration, error: integrationError } = await supabase
      .from('cardapioweb_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (integrationError || !integration) {
      console.error('[CardápioWeb Sync] No integration found');
      return new Response(
        JSON.stringify({ error: 'Integration not configured or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch orders from CardápioWeb API with date filter
    let apiUrl = `${CARDAPIOWEB_API_URL}/orders`;
    const params = new URLSearchParams();
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (params.toString()) {
      apiUrl += `?${params.toString()}`;
    }

    console.log('[CardápioWeb Sync] Fetching orders from:', apiUrl);

    const ordersResponse = await fetch(apiUrl, {
      headers: {
        'X-API-KEY': integration.api_token,
        'Accept': 'application/json',
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('[CardápioWeb Sync] API error:', errorText);
      return new Response(
        JSON.stringify({ error: `CardápioWeb API error: ${ordersResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ordersData = await ordersResponse.json();
    const orders: CardapioWebOrder[] = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []);

    console.log('[CardápioWeb Sync] Found', orders.length, 'orders from API');

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Get product mappings
    const { data: mappings } = await supabase
      .from('cardapioweb_product_mappings')
      .select('*')
      .eq('tenant_id', tenantId);

    const mappingMap = new Map(
      (mappings || []).map(m => [m.cardapioweb_item_id, m])
    );

    // Fetch complement options for extra_id matching
    const { data: complementOptions } = await supabase
      .from('complement_options')
      .select('id, name, external_code, ifood_code')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    // Fetch complement groups for kds_category
    const { data: complementGroups } = await supabase
      .from('complement_groups')
      .select('name, kds_category')
      .eq('tenant_id', tenantId);

    for (const order of orders) {
      try {
        // Skip non-delivery orders — integration is delivery-only
        if (order.order_type !== 'delivery') {
          console.log('[CardápioWeb Sync] Skipping non-delivery order:', order.id, order.order_type);
          skipped++;
          continue;
        }

        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .in('external_source', ['cardapioweb', 'ifood'])
          .eq('external_order_id', String(order.id))
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (existingOrder) {
          console.log('[CardápioWeb Sync] Order already exists:', order.id);
          skipped++;
          continue;
        }

        // Calculate totals
        const subtotal = order.items.reduce((sum, item) => sum + item.total_price, 0);
        const total = order.total;

        const { mappedMethod, resolvedPaymentStatus, changeFor, holdForPayment } = resolveAllPayments(order.payments);

        const baseStatus = mapStatus(order.status);
        const orderStatus = holdForPayment
          ? 'pending'
          : (integration.auto_accept && baseStatus === 'pending') ? 'preparing' : baseStatus;

        // Build notes with reference point
        let notes = order.observation || '';
        if (order.delivery_address?.reference) {
          notes = notes ? `${notes} | Ref: ${order.delivery_address.reference}` : `Ref: ${order.delivery_address.reference}`;
        }

        // Create local order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            tenant_id: tenantId,
            order_type: mapOrderType(order.order_type),
            status: orderStatus,
            customer_name: order.customer?.name || null,
            customer_phone: order.customer?.phone || null,
            customer_address: order.delivery_address ? formatAddress(order.delivery_address) : null,
            notes,
            subtotal,
            total,
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
            is_draft: holdForPayment,
            created_at: order.created_at,
          })
          .select()
          .single();

        if (orderError) {
          if (orderError.code === '23505' || orderError.code === 'PGRST116') {
            console.log('[CardápioWeb Sync] Duplicate suppressed for order:', order.id);
            skipped++;
            continue;
          }
          console.error('[CardápioWeb Sync] Error creating order:', orderError);
          errors++;
          continue;
        }

        // Create order items
        const orderSource = resolveExternalSource(order.sales_channel);
        for (const item of order.items) {
          const mapping = mappingMap.get(item.item_id);

          const optionsTotal = item.options.reduce((sum, opt) => sum + (opt.unit_price * opt.quantity), 0);
          const unitPrice = item.unit_price + optionsTotal;

          const { data: orderItem, error: itemError } = await supabase
            .from('order_items')
            .insert({
              tenant_id: tenantId,
              order_id: newOrder.id,
              product_id: mapping?.local_product_id || null,
              variation_id: mapping?.local_variation_id || null,
              product_name: item.name || null,
              quantity: item.quantity,
              unit_price: unitPrice,
              total_price: item.total_price,
              notes: item.observation,
              status: mapStatus(order.status) === 'delivered' ? 'delivered' : 'pending',
              external_item_id: String(item.order_item_id),
              external_code: item.external_code || null,
              item_kind: item.kind || null,
            })
            .select()
            .single();

          if (itemError) {
            console.error('[CardápioWeb Sync] Error creating order item:', itemError);
            continue;
          }

          // Create extras for options
          if (item.options.length > 0 && orderItem) {
            const extras = item.options.map(opt => {
              const groupName = opt.option_group_name || '';
              const groupNameLower = groupName.toLowerCase();
              let matchedOption = null;
              const optExternalCode = opt.external_code || '';

              if (optExternalCode) {
                if (orderSource === 'ifood') {
                  matchedOption = (complementOptions || []).find(co =>
                    co.ifood_code && co.ifood_code === optExternalCode
                  );
                }
                if (!matchedOption) {
                  matchedOption = (complementOptions || []).find(co =>
                    co.external_code && co.external_code === optExternalCode
                  );
                }
              }
              if (!matchedOption) {
                const optName = (opt.name || '').trim().toLowerCase();
                matchedOption = (complementOptions || []).find(co =>
                  co.name.trim().toLowerCase() === optName
                );
              }

              const matchedGroup = groupName ? (complementGroups || []).find(g =>
                g.name.toLowerCase() === groupNameLower
              ) : null;

              const extraName = groupName ? `${groupName}: ${opt.name}` : opt.name;
              const inferCategory = (): string => {
                const resolved = matchedGroup?.kds_category || 'complement';
                if (resolved !== 'complement') return resolved;
                if (groupNameLower.includes('sabor')) return 'flavor';
                if (/^\d+\/\d+\s/.test(opt.name || '')) return 'flavor';
                return 'complement';
              };

              return {
                tenant_id: tenantId,
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

          // Upsert product mapping if not exists
          if (!mapping) {
            await supabase.from('cardapioweb_product_mappings').upsert({
              tenant_id: tenantId,
              cardapioweb_item_id: item.item_id,
              cardapioweb_item_name: item.name,
            }, {
              onConflict: 'tenant_id,cardapioweb_item_id',
            });
          }
        }

        imported++;
        console.log('[CardápioWeb Sync] Imported order:', order.id, '-> local:', newOrder.id);

        // Auto-send to delivery logistics if order is not held for payment
        if (!holdForPayment && mapOrderType(order.order_type) === 'delivery') {
          try {
            const { data: activeWebhooks } = await supabase
              .from('order_webhooks')
              .select('id')
              .eq('tenant_id', tenantId)
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
                      tenant_id: tenantId,
                    }),
                  });
                  console.log('[CardápioWeb Sync] Sent to delivery webhook:', wh.id);
                } catch (whErr) {
                  console.error('[CardápioWeb Sync] Failed to send to webhook:', wh.id, whErr);
                }
              }
            }
          } catch (deliveryErr) {
            console.error('[CardápioWeb Sync] Error querying delivery webhooks:', deliveryErr);
          }
        }

      } catch (error) {
        console.error('[CardápioWeb Sync] Error processing order:', order.id, error);
        errors++;
      }
    }

    // Update last_sync_at
    await supabase
      .from('cardapioweb_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id);

    // Log the sync
    await supabase.from('cardapioweb_logs').insert({
      tenant_id: tenantId,
      event_type: 'MANUAL_SYNC',
      payload: { start_date, end_date, imported, skipped, errors },
      status: errors === 0 ? 'success' : 'partial',
    });

    console.log('[CardápioWeb Sync] Completed. Imported:', imported, 'Skipped:', skipped, 'Errors:', errors);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        errors,
        total: orders.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[CardápioWeb Sync] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
