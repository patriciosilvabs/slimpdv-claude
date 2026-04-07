import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_VERSION = '2.0.0';
console.log(`[DEPLOY] generic-order-webhook iniciado — Versão ${FUNCTION_VERSION}`);

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function extractRequestMeta(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const contentType = req.headers.get('content-type') || 'unknown';
  return { ip, headers: { 'user-agent': userAgent, 'content-type': contentType } };
}

async function logCallback(
  supabase: ReturnType<typeof createClient>,
  opts: {
    tenant_id?: string;
    webhook_id?: string;
    event: string;
    order_id?: string;
    request_url: string;
    payload: unknown;
    meta: { ip: string; headers: Record<string, string> };
    response_status: number;
    success: boolean;
    error_message?: string;
  },
) {
  try {
    await supabase.from('order_webhook_logs').insert({
      tenant_id: opts.tenant_id || null,
      webhook_id: opts.webhook_id || null,
      event: opts.event,
      order_id: opts.order_id || null,
      request_url: opts.request_url,
      request_body: { payload: opts.payload, headers: opts.meta.headers, ip: opts.meta.ip },
      response_status: opts.response_status,
      response_body: opts.success ? '{"success":true}' : JSON.stringify({ error: opts.error_message }),
      success: opts.success,
      error_message: opts.error_message || null,
      duration_ms: 0,
    });
  } catch (_) {
    // silently ignore log failures
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const meta = extractRequestMeta(req);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);

    // Reject tokens sent via query param
    if (url.searchParams.has('token')) {
      await logCallback(supabase, {
        event: 'callback.auth_failed',
        request_url: req.url,
        payload: null,
        meta,
        response_status: 401,
        success: false,
        error_message: 'Token via query param não é permitido',
      });
      return json({ error: 'Envie o token via header Authorization: Bearer <token>, não via URL' }, 401);
    }

    // Extract token from Authorization: Bearer header
    const token = extractBearerToken(req);

    if (!token) {
      await logCallback(supabase, {
        event: 'callback.auth_failed',
        request_url: req.url,
        payload: null,
        meta,
        response_status: 401,
        success: false,
        error_message: 'Header Authorization: Bearer não fornecido',
      });
      return json({ error: 'Header Authorization: Bearer <token> obrigatório' }, 401);
    }

    const { data: webhook, error: whErr } = await supabase
      .from('order_webhooks')
      .select('id, tenant_id, is_active, name')
      .eq('callback_token', token)
      .single();

    if (whErr || !webhook) {
      await logCallback(supabase, {
        event: 'callback.auth_failed',
        request_url: req.url,
        payload: null,
        meta,
        response_status: 401,
        success: false,
        error_message: 'Token inválido',
      });
      return json({ error: 'Token inválido' }, 401);
    }

    if (!webhook.is_active) {
      await logCallback(supabase, {
        tenant_id: webhook.tenant_id,
        webhook_id: webhook.id,
        event: 'callback.rejected',
        request_url: req.url,
        payload: null,
        meta,
        response_status: 403,
        success: false,
        error_message: 'Webhook desativado',
      });
      return json({ error: 'Webhook desativado' }, 403);
    }

    const body = await req.json();
    const { order_id, status, courier_name, notes, metadata } = body;

    if (!order_id || !status) {
      await logCallback(supabase, {
        tenant_id: webhook.tenant_id,
        webhook_id: webhook.id,
        event: 'callback.validation_error',
        request_url: req.url,
        payload: body,
        meta,
        response_status: 400,
        success: false,
        error_message: 'Campos obrigatórios: order_id, status',
      });
      return json({
        error: 'Campos obrigatórios: order_id, status',
        format: {
          order_id: 'string (UUID interno ou external_order_id)',
          status: 'string (preparing | ready | dispatched | delivered | cancelled)',
          courier_name: 'string (opcional)',
          notes: 'string (opcional)',
          metadata: 'object (opcional)',
        },
      }, 400);
    }

    const STATUS_MAP: Record<string, string> = {
      preparando: 'preparing', pronto: 'ready', despachado: 'dispatched',
      saiu_para_entrega: 'dispatched', a_caminho: 'dispatched',
      entregue: 'delivered', cancelado: 'cancelled',
      preparing: 'preparing', ready: 'ready', dispatched: 'dispatched',
      out_for_delivery: 'dispatched', delivered: 'delivered', cancelled: 'cancelled',
      canceled: 'cancelled', collected: 'dispatched', picked_up: 'dispatched',
      completed: 'delivered', in_transit: 'dispatched', arrived: 'delivered',
      aceito: 'preparing', coletado: 'dispatched',
    };

    const internalStatus = STATUS_MAP[status.toLowerCase()] || status.toLowerCase();
    const VALID_STATUSES = ['pending', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled'];

    if (!VALID_STATUSES.includes(internalStatus)) {
      await logCallback(supabase, {
        tenant_id: webhook.tenant_id,
        webhook_id: webhook.id,
        event: 'callback.validation_error',
        request_url: req.url,
        payload: body,
        meta,
        response_status: 400,
        success: false,
        error_message: `Status inválido: "${status}"`,
      });
      return json({ error: `Status inválido: "${status}". Valores aceitos: ${VALID_STATUSES.join(', ')}` }, 400);
    }

    // Find order
    let orderQuery = supabase
      .from('orders')
      .select('id, status, tenant_id, external_order_id')
      .eq('tenant_id', webhook.tenant_id);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(order_id)) {
      orderQuery = orderQuery.eq('id', order_id);
    } else {
      orderQuery = orderQuery.eq('external_order_id', order_id);
    }

    const { data: order, error: orderErr } = await orderQuery.single();

    if (orderErr || !order) {
      await logCallback(supabase, {
        tenant_id: webhook.tenant_id,
        webhook_id: webhook.id,
        event: 'callback.order_not_found',
        request_url: req.url,
        payload: body,
        meta,
        response_status: 404,
        success: false,
        error_message: `Pedido não encontrado: ${order_id}`,
      });
      return json({ error: `Pedido não encontrado: ${order_id}` }, 404);
    }

    // Update order
    const updateData: Record<string, unknown> = {
      status: internalStatus,
      delivery_status: status.toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    if (internalStatus === 'ready') updateData.ready_at = new Date().toISOString();
    else if (internalStatus === 'delivered') updateData.delivered_at = new Date().toISOString();
    else if (internalStatus === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      if (notes) updateData.cancellation_reason = notes;
    }

    if (courier_name) {
      updateData.notes = [order.status !== internalStatus ? `Entregador: ${courier_name}` : '', notes || '']
        .filter(Boolean).join(' | ') || undefined;
    }

    const { error: updateErr } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id);

    if (updateErr) {
      console.error('Update error:', updateErr);
      await logCallback(supabase, {
        tenant_id: webhook.tenant_id,
        webhook_id: webhook.id,
        event: `callback.${internalStatus}`,
        order_id: order.id,
        request_url: req.url,
        payload: body,
        meta,
        response_status: 500,
        success: false,
        error_message: 'Erro ao atualizar pedido',
      });
      return json({ error: 'Erro ao atualizar pedido' }, 500);
    }

    // Log success
    await logCallback(supabase, {
      tenant_id: webhook.tenant_id,
      webhook_id: webhook.id,
      event: `callback.${internalStatus}`,
      order_id: order.id,
      request_url: req.url,
      payload: body,
      meta,
      response_status: 200,
      success: true,
    });

    return json({
      success: true,
      order_id: order.id,
      previous_status: order.status,
      new_status: internalStatus,
    });

  } catch (err) {
    console.error('generic-order-webhook error:', err);
    const errMsg = err instanceof Error ? err.message : 'Erro interno';
    await logCallback(supabase, {
      event: 'callback.error',
      request_url: req.url,
      payload: null,
      meta,
      response_status: 500,
      success: false,
      error_message: errMsg,
    });
    return json({ error: errMsg }, 500);
  }
});
