import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const { order_id, webhook_id, tenant_id, cancelled } = body;

    if (!order_id || !webhook_id || !tenant_id) {
      return json({ error: 'Missing order_id, webhook_id, or tenant_id' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch webhook config
    const { data: webhook, error: whErr } = await supabase
      .from('order_webhooks')
      .select('*')
      .eq('id', webhook_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (whErr || !webhook) {
      return json({ error: 'Webhook não encontrado' }, 404);
    }

    const useOAuth = !!webhook.auth_url;
    const useBearerDirect = !webhook.auth_url && !!webhook.client_secret;

    if (useOAuth && (!webhook.api_url || !webhook.client_id || !webhook.client_secret)) {
      return json({ error: 'Credenciais OAuth incompletas no webhook' }, 400);
    }
    if (!useOAuth && !useBearerDirect) {
      return json({ error: 'Nenhuma autenticação configurada (OAuth ou Bearer token)' }, 400);
    }

    const targetUrl = webhook.api_url || webhook.url;
    if (!targetUrl) {
      return json({ error: 'URL de destino não configurada' }, 400);
    }

    // Fetch full order data with sub-items
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id, product_id, quantity, unit_price, total_price, notes, status, product_name,
          order_item_extras (id, extra_name, price, quantity),
          order_item_sub_items (
            id, sub_item_index, notes,
            order_item_sub_item_extras (id, group_name, option_name, price, quantity)
          )
        )
      `)
      .eq('id', order_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (orderErr || !order) {
      return json({ error: 'Pedido não encontrado' }, 404);
    }

    // Fetch product names
    const productIds = (order.order_items || [])
      .map((i: any) => i.product_id)
      .filter(Boolean);

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

    // --- Determine access token ---
    const startTime = Date.now();
    let accessToken: string;

    // (keep existing OAuth / Bearer logic unchanged — lines 109-165)
    if (useOAuth) {
      try {
        const tokenRes = await fetch(webhook.auth_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: webhook.client_id,
            client_secret: webhook.client_secret,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          await logDelivery(supabase, {
            tenant_id, webhook_id, identifier: webhook.identifier, event: 'delivery.auth_failed', order_id,
            request_url: webhook.auth_url, request_body: { client_id: webhook.client_id },
            response_status: tokenRes.status, response_body: errText,
            success: false, error_message: `Auth failed: ${tokenRes.status}`,
            duration_ms: Date.now() - startTime,
          });
          await updateLogisticaStatus(supabase, order_id, 'erro', `Auth failed: ${tokenRes.status}`);
          return json({ error: 'Falha na autenticação OAuth', status: tokenRes.status }, 502);
        }

        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token || tokenData.token;

        if (!accessToken) {
          await logDelivery(supabase, {
            tenant_id, webhook_id, identifier: webhook.identifier, event: 'delivery.auth_failed', order_id,
            request_url: webhook.auth_url, request_body: { client_id: webhook.client_id },
            response_status: tokenRes.status, response_body: JSON.stringify(tokenData),
            success: false, error_message: 'Token não encontrado na resposta',
            duration_ms: Date.now() - startTime,
          });
          await updateLogisticaStatus(supabase, order_id, 'erro', 'Token não retornado pela API');
          return json({ error: 'Token não retornado pela API' }, 502);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Erro de conexão';
        await logDelivery(supabase, {
          tenant_id, webhook_id, identifier: webhook.identifier, event: 'delivery.auth_failed', order_id,
          request_url: webhook.auth_url, request_body: { client_id: webhook.client_id },
          response_status: 0, response_body: errMsg,
          success: false, error_message: errMsg,
          duration_ms: Date.now() - startTime,
        });
        await updateLogisticaStatus(supabase, order_id, 'erro', `Erro OAuth: ${errMsg}`);
        return json({ error: `Erro ao autenticar: ${errMsg}` }, 502);
      }
    } else {
      accessToken = webhook.client_secret;
    }

    // --- Build order payload (unified English format) ---
    const origem = mapOrigem(order.external_source);
    const totalVal = Number(order.total || 0);
    const deliveryFeeVal = Number(order.delivery_fee || 0);
    const serviceFeeVal = Number(order.service_fee || 0);
    const additionalFeeVal = Number(order.additional_fee || 0);
    const discountVal = Number(order.discount || 0);
    const subtotal = totalVal - deliveryFeeVal - serviceFeeVal - additionalFeeVal + discountVal;

    const orderPayload: Record<string, unknown> = cancelled ? {
      external_id: order.id,
      status: 'cancelled',
    } : {
      external_id: order.id,
      external_order_id: order.external_order_id || null,
      external_source: order.external_source || null,

      customer_name: order.customer_name || 'Cliente',
      customer_phone: order.customer_phone || '',
      customer_address: order.customer_address || 'Endereço não informado',
      delivery_address: order.delivery_address || order.customer_address || '',
      delivery_neighborhood: order.delivery_neighborhood || '',
      delivery_lat: order.delivery_lat || null,
      delivery_lng: order.delivery_lng || null,

      subtotal: Number(subtotal.toFixed(2)),
      delivery_fee: Number(deliveryFeeVal.toFixed(2)),
      service_fee: Number(serviceFeeVal.toFixed(2)),
      additional_fee: Number(additionalFeeVal.toFixed(2)),
      discount: Number(discountVal.toFixed(2)),
      total: Number(totalVal.toFixed(2)),

      payment_method: mapPaymentMethod(order.payment_method),
      payment_status: order.payment_status || 'pending',
      change_for: order.change_for ? Number(order.change_for) : null,

      origin: origem,
      scheduled_for: order.scheduled_for || null,
      notes: order.notes || '',
      status: 'new',

      items: (order.order_items || [])
        .filter((i: any) => i.status !== 'cancelled')
        .map((i: any) => {
          const subItems = (i.order_item_sub_items || [])
            .sort((a: any, b: any) => (a.sub_item_index || 0) - (b.sub_item_index || 0))
            .map((si: any) => ({
              name: (si.order_item_sub_item_extras || []).map((e: any) => e.option_name).join(', ') || `Sabor ${si.sub_item_index + 1}`,
              notes: si.notes || undefined,
              extras: (si.order_item_sub_item_extras || []).map((e: any) => ({
                group: e.group_name,
                name: e.option_name,
                price: Number(e.price || 0),
                quantity: e.quantity || 1,
              })),
            }));

          return {
            product_name: i.product_name || productMap[i.product_id] || 'Produto',
            quantity: i.quantity,
            unit_price: Number(i.unit_price || 0),
            total_price: Number(i.total_price || 0),
            notes: i.notes || undefined,
            extras: (i.order_item_extras || []).map((e: any) => ({
              name: e.extra_name,
              price: Number(e.price || 0),
              quantity: e.quantity || 1,
            })),
            sub_items: subItems.length > 0 ? subItems : undefined,
          };
        }),
    };

    // --- Send to external API ---
    const sendStart = Date.now();
    try {
      const sendHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...(webhook.headers || {}),
      };

      const sendRes = await fetch(targetUrl, {
        method: 'POST',
        headers: sendHeaders,
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(15000),
      });

      let responseBody = '';
      try { responseBody = await sendRes.text(); } catch { /* ignore */ }
      if (responseBody.length > 2000) responseBody = responseBody.substring(0, 2000);

      const duration = Date.now() - sendStart;
      const eventName = cancelled ? 'delivery.cancelled' : 'delivery.sent';

      await logDelivery(supabase, {
        tenant_id, webhook_id, identifier: webhook.identifier, event: eventName, order_id,
        request_url: targetUrl, request_body: orderPayload,
        response_status: sendRes.status, response_body: responseBody,
        success: sendRes.ok, error_message: sendRes.ok ? null : `API retornou ${sendRes.status}`,
        duration_ms: duration,
      });

      if (sendRes.ok) {
        let externalId: string | null = null;
        try {
          const resData = JSON.parse(responseBody);
          externalId = resData.id || resData.delivery_id || resData.order_id || resData.external_id || null;
        } catch { /* ignore */ }

        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          integracao_logistica_status: 'enviado',
          integracao_logistica_log: `OK ${sendRes.status} - ${responseBody.substring(0, 200)}`,
        };
        if (!cancelled) {
          updateData.delivery_status = 'enviado';
          if (externalId) updateData.external_delivery_id = String(externalId);
        }

        await supabase.from('orders').update(updateData).eq('id', order_id);

        return json({
          success: true,
          external_delivery_id: externalId,
          status: sendRes.status,
        });
      } else {
        await updateLogisticaStatus(supabase, order_id, 'erro', `API retornou ${sendRes.status}: ${responseBody.substring(0, 200)}`);
        return json({
          success: false,
          status: sendRes.status,
          error: `API retornou ${sendRes.status}`,
          response: responseBody,
        }, 502);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erro de conexão';
      await logDelivery(supabase, {
        tenant_id, webhook_id, identifier: webhook.identifier, event: cancelled ? 'delivery.cancel_failed' : 'delivery.send_failed', order_id,
        request_url: targetUrl, request_body: orderPayload,
        response_status: 0, response_body: errMsg,
        success: false, error_message: errMsg,
        duration_ms: Date.now() - sendStart,
      });
      await updateLogisticaStatus(supabase, order_id, 'erro', `Erro envio: ${errMsg}`);
      return json({ error: `Erro ao enviar pedido: ${errMsg}` }, 502);
    }
  } catch (error) {
    console.error('send-order-to-delivery error:', error);
    return json({ error: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});

// --- Helpers ---

function parseAddress(addr: string): { bairro: string; cidade: string; complemento: string } {
  // Try common patterns: "Rua X, 123, Complemento, Bairro, Cidade - UF"
  const parts = addr.split(',').map(s => s.trim());
  if (parts.length >= 4) {
    return {
      complemento: parts[2] || '',
      bairro: parts[parts.length - 2] || '',
      cidade: (parts[parts.length - 1] || '').replace(/\s*-\s*[A-Z]{2}$/, ''),
    };
  }
  if (parts.length === 3) {
    return { complemento: '', bairro: parts[1] || '', cidade: (parts[2] || '').replace(/\s*-\s*[A-Z]{2}$/, '') };
  }
  return { bairro: '', cidade: '', complemento: '' };
}

function mapOrigem(externalSource: string | null): string {
  if (externalSource === 'ifood') return 'iFood';
  if (externalSource === 'cardapioweb') return 'Cardápio Web';
  if (externalSource === 'website') return 'Loja Online';
  return 'Balcão';
}

function mapPaymentMethod(method: string | null): string {
  if (!method) return 'dinheiro';
  const map: Record<string, string> = {
    cash: 'dinheiro', credit: 'cartao', debit: 'cartao',
    pix: 'pix', credit_card: 'cartao', debit_card: 'cartao',
  };
  return map[method] || method;
}

async function updateLogisticaStatus(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  status: string,
  log: string,
) {
  try {
    await supabase.from('orders').update({
      integracao_logistica_status: status,
      integracao_logistica_log: log.substring(0, 500),
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
  } catch { /* ignore */ }
}

async function logDelivery(
  supabase: ReturnType<typeof createClient>,
  opts: {
    tenant_id: string;
    webhook_id: string;
    identifier?: string;
    event: string;
    order_id: string;
    request_url: string;
    request_body: unknown;
    response_status: number;
    response_body: string | null;
    success: boolean;
    error_message: string | null;
    duration_ms: number;
  },
) {
  try {
    await supabase.from('order_webhook_logs').insert({
      tenant_id: opts.tenant_id,
      webhook_id: opts.webhook_id,
      identifier: opts.identifier || null,
      event: opts.event,
      order_id: opts.order_id,
      request_url: opts.request_url,
      request_body: opts.request_body,
      response_status: opts.response_status,
      response_body: opts.response_body,
      success: opts.success,
      error_message: opts.error_message,
      duration_ms: opts.duration_ms,
      attempted_at: new Date().toISOString(),
    });
  } catch { /* ignore */ }
}
