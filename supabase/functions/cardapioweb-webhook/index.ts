import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Ultra-fast webhook endpoint: receive → save → respond 200
 * NO external API calls, NO heavy processing.
 * All processing happens asynchronously via cardapioweb-process-queue.
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  // Health check endpoint
  if (req.method === 'GET') {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { data: stats } = await supabase
        .from('cardapioweb_webhook_queue')
        .select('status', { count: 'exact', head: false })
        .in('status', ['pending', 'processing', 'dead_letter']);

      const pendingCount = (stats || []).filter(s => s.status === 'pending').length;
      const processingCount = (stats || []).filter(s => s.status === 'processing').length;
      const deadLetterCount = (stats || []).filter(s => s.status === 'dead_letter').length;

      const { data: lastReceived } = await supabase
        .from('cardapioweb_webhook_queue')
        .select('received_at')
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          status: 'ok',
          last_received: lastReceived?.received_at || null,
          pending_count: pendingCount,
          processing_count: processingCount,
          dead_letter_count: deadLetterCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch {
      return new Response(
        JSON.stringify({ status: 'ok' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // POST — receive webhook payload
  try {
    const bodyText = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch {
      // Even if body is invalid JSON, respond 200 to avoid CW disabling webhook
      console.warn('[Webhook] Invalid JSON body received');
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const merchantId = String(body.merchant_id || '');
    const orderId = String(body.order_id || '');
    const eventType = String(body.event_type || 'UNKNOWN');
    const orderStatus = body.order_status ? String(body.order_status) : null;

    // Capture relevant headers for audit
    const headerEntries: Record<string, string> = {};
    for (const key of ['x-webhook-token', 'x-request-id', 'content-type', 'user-agent']) {
      const val = req.headers.get(key);
      if (val) headerEntries[key] = val;
    }

    console.log('[Webhook] Received:', eventType, 'merchant:', merchantId, 'order:', orderId);

    // Fast INSERT into queue — this is the ONLY database operation
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabase.from('cardapioweb_webhook_queue').insert({
      merchant_id: merchantId || 'unknown',
      event_type: eventType,
      external_order_id: orderId || null,
      order_status: orderStatus,
      payload: body,
      headers: headerEntries,
      status: 'pending',
    });

    if (error) {
      // Log but STILL respond 200
      console.error('[Webhook] Queue insert error:', error.message);
    }

    // Always respond 200 — NEVER return 4xx/5xx
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // Catch-all: even unexpected errors respond 200
    console.error('[Webhook] Unexpected error:', err);
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
