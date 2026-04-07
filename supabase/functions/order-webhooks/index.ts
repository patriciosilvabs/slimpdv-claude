import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const FUNCTION_VERSION = '4.0.0';
console.log(`[DEPLOY] order-webhooks iniciado — Versão ${FUNCTION_VERSION}`);

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const AUTO_PAUSE_THRESHOLD = 15;

interface WebhookConfig {
  id: string;
  tenant_id: string;
  name: string;
  identifier: string;
  url: string;
  secret: string | null;
  client_id: string | null;
  client_secret: string | null;
  auth_url: string | null;
  is_active: boolean;
  status: string;
  is_paused: boolean;
  failure_count: number;
  events: string[];
  order_types: string[];
  headers: Record<string, string>;
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;

    if (!isServiceRole) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    const body = await req.json();
    const { order_id, event, tenant_id, webhook_id } = body;

    if (!order_id || !event || !tenant_id) {
      return json({ error: 'Missing order_id, event, or tenant_id' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ALL webhooks for the tenant (not just matching ones)
    let webhookQuery = supabase
      .from('order_webhooks')
      .select('*')
      .eq('tenant_id', tenant_id);

    if (webhook_id) {
      webhookQuery = webhookQuery.eq('id', webhook_id);
    }

    const { data: allWebhooks, error: whError } = await webhookQuery;
    if (whError) throw whError;

    if (!allWebhooks || allWebhooks.length === 0) {
      // Log that no webhooks exist at all
      await supabase.from('order_webhook_logs').insert({
        tenant_id,
        webhook_id: null,
        identifier: null,
        event,
        order_id,
        request_url: '—',
        request_body: { event, order_id },
        success: false,
        error_message: 'Nenhum webhook configurado para este tenant',
        dispatch_status: 'no_webhooks',
        skip_reason: 'Nenhum webhook configurado',
        attempted_at: new Date().toISOString(),
      });
      return json({ message: 'No webhooks configured', logged: true });
    }

    // Fetch full order data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id, product_id, product_name, variation_id, quantity, unit_price, total_price, notes, status, station_status,
          order_item_extras (id, extra_name, price, kds_category),
          order_item_sub_items (
            id, sub_item_index, notes,
            order_item_sub_item_extras (id, option_name, price, kds_category)
          )
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError) throw orderError;

    // Resolve product names
    const productIds = [...new Set(
      (order.order_items || [])
        .filter((i: any) => i.product_id && !i.product_name)
        .map((i: any) => i.product_id)
    )];

    let productMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      if (products) {
        productMap = Object.fromEntries(products.map((p: any) => [p.id, p.name]));
      }
    }

    // Fetch payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order_id);

    // Build payload
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      order: {
        id: order.id,
        external_order_id: order.external_order_id,
        external_display_id: order.external_display_id,
        external_source: order.external_source,
        order_type: order.order_type,
        status: order.status,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address || order.delivery_address,
        customer_lat: order.delivery_lat ?? null,
        customer_lng: order.delivery_lng ?? null,
        notes: order.notes,
        subtotal: order.subtotal,
        discount: order.discount,
        delivery_fee: order.delivery_fee,
        service_fee: order.service_fee ?? 0,
        change_for: order.change_for ?? null,
        total: order.total,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        scheduled_for: order.scheduled_for ?? null,
        created_at: order.created_at,
        ready_at: order.ready_at,
        delivered_at: order.delivered_at,
        cancelled_at: order.cancelled_at,
        cancellation_reason: order.cancellation_reason,
        items: (order.order_items || []).map((item: any) => {
          const name = item.product_name || productMap[item.product_id] || `Produto ${item.product_id?.substring(0, 8)}`;
          const directExtras = (item.order_item_extras || []).map((e: any) => ({
            name: e.extra_name, price: e.price, category: e.kds_category || 'complement',
          }));
          const subItemExtras: any[] = [];
          for (const sub of (item.order_item_sub_items || [])) {
            for (const se of (sub.order_item_sub_item_extras || [])) {
              subItemExtras.push({ name: se.option_name, price: se.price, category: se.kds_category || 'sabor' });
            }
          }
          return {
            id: item.id, name, product_id: item.product_id, variation_id: item.variation_id,
            quantity: item.quantity, unit_price: item.unit_price, total_price: item.total_price,
            notes: item.notes, status: item.status, extras: [...directExtras, ...subItemExtras],
          };
        }),
        payments: (payments || []).map((p: any) => ({
          id: p.id, amount: p.amount, payment_method: p.payment_method, created_at: p.created_at,
        })),
      },
    };

    // Process each webhook: determine if it should send or skip, and LOG either way
    const results = await Promise.allSettled(
      (allWebhooks as WebhookConfig[]).map(async (wh) => {
        // Check filters
        const isInactive = !wh.is_active || wh.is_paused || wh.status !== 'active';
        const eventMismatch = !webhook_id && !wh.events.includes(event);
        const typeMismatch = wh.order_types.length > 0 && !wh.order_types.includes(order.order_type);

        // Determine skip reason
        let skipReason: string | null = null;
        if (isInactive) skipReason = `Webhook ${wh.is_paused ? 'pausado' : !wh.is_active ? 'desativado' : 'inativo'}`;
        else if (eventMismatch) skipReason = `Evento "${event}" não configurado neste webhook`;
        else if (typeMismatch) skipReason = `Tipo "${order.order_type}" não aceito (aceita: ${wh.order_types.join(', ')})`;

        if (skipReason) {
          // Log the skip
          await supabase.from('order_webhook_logs').insert({
            tenant_id: wh.tenant_id,
            webhook_id: wh.id,
            identifier: wh.identifier,
            event,
            order_id,
            request_url: wh.url,
            request_body: payload,
            success: false,
            error_message: skipReason,
            dispatch_status: 'skipped',
            skip_reason: skipReason,
            attempted_at: new Date().toISOString(),
          });
          return { webhook_id: wh.id, identifier: wh.identifier, success: false, skipped: true, skip_reason: skipReason };
        }

        // Actually send
        const startTime = Date.now();
        const reqHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'PDVSlim-Webhook/1.0',
          'X-Webhook-Identifier': wh.identifier,
          ...(wh.headers || {}),
        };

        if (wh.secret) {
          reqHeaders['Authorization'] = `Bearer ${wh.secret}`;
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey('raw', encoder.encode(wh.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
          const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(payload)));
          const hexSignature = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
          reqHeaders['X-Webhook-Signature'] = `sha256=${hexSignature}`;
        } else if (wh.auth_url && wh.client_id && wh.client_secret) {
          try {
            const tokenRes = await fetch(wh.auth_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ grant_type: 'client_credentials', client_id: wh.client_id, client_secret: wh.client_secret }),
              signal: AbortSignal.timeout(5000),
            });
            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              reqHeaders['Authorization'] = `Bearer ${tokenData.access_token}`;
            } else {
              console.warn(`[Webhook ${wh.identifier}] OAuth token request failed: ${tokenRes.status}`);
            }
          } catch (oauthErr) {
            console.warn(`[Webhook ${wh.identifier}] OAuth error: ${oauthErr}`);
          }
        } else if (wh.client_secret) {
          reqHeaders['Authorization'] = `Bearer ${wh.client_secret}`;
        }

        let response: Response | null = null;
        let error: string | null = null;

        try {
          response = await fetch(wh.url, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
        }

        const duration = Date.now() - startTime;
        let responseBody: string | null = null;
        try {
          if (response) {
            responseBody = await response.text();
            if (responseBody.length > 1000) responseBody = responseBody.substring(0, 1000);
          }
        } catch { /* ignore */ }

        const success = response ? response.ok : false;

        // Log the delivery
        await supabase.from('order_webhook_logs').insert({
          tenant_id: wh.tenant_id,
          webhook_id: wh.id,
          identifier: wh.identifier,
          event,
          order_id,
          request_url: wh.url,
          request_body: payload,
          request_headers: reqHeaders,
          response_status: response?.status || null,
          response_body: responseBody || error,
          success,
          error_message: error,
          duration_ms: duration,
          dispatch_status: success ? 'sent' : 'error',
          skip_reason: null,
          attempted_at: new Date().toISOString(),
        });

        // Update webhook success/failure tracking
        if (success) {
          await supabase.from('order_webhooks').update({
            last_success_at: new Date().toISOString(),
            failure_count: 0,
            updated_at: new Date().toISOString(),
          }).eq('id', wh.id);
        } else {
          const httpStatus = response?.status || 0;
          const isAuthError = httpStatus === 401 || httpStatus === 403;

          if (isAuthError) {
            await supabase.from('order_webhooks').update({
              last_failure_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', wh.id);
          } else {
            const newFailureCount = (wh.failure_count || 0) + 1;
            const updateData: Record<string, unknown> = {
              last_failure_at: new Date().toISOString(),
              failure_count: newFailureCount,
              updated_at: new Date().toISOString(),
            };
            if (newFailureCount >= AUTO_PAUSE_THRESHOLD) {
              updateData.is_paused = true;
              updateData.pause_reason = `Pausado automaticamente após ${newFailureCount} falhas consecutivas`;
              updateData.status = 'paused';
            }
            await supabase.from('order_webhooks').update(updateData).eq('id', wh.id);
          }
        }

        return { webhook_id: wh.id, identifier: wh.identifier, success, status: response?.status };
      })
    );

    return json({
      sent: results.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: (r as any).reason?.message }),
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
