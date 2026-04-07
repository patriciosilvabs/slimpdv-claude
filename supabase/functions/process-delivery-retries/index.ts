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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending retries that are due
    const { data: retries, error: fetchErr } = await supabase
      .from('delivery_retry_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(10);

    if (fetchErr || !retries || retries.length === 0) {
      return json({ processed: 0 });
    }

    let processed = 0;
    let succeeded = 0;

    for (const retry of retries) {
      const newAttempts = retry.attempts + 1;

      try {
        // Call send-order-to-delivery internally using service role
        // We need a valid session, so we invoke the function via HTTP
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-order-to-delivery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            order_id: retry.order_id,
            webhook_id: retry.webhook_id,
            tenant_id: retry.tenant_id,
          }),
          signal: AbortSignal.timeout(20000),
        });

        const resBody = await sendRes.text();

        if (sendRes.ok) {
          // Mark as success
          await supabase
            .from('delivery_retry_queue')
            .update({ status: 'success', attempts: newAttempts, last_error: null })
            .eq('id', retry.id);
          succeeded++;
        } else {
          // Increment attempts, calculate next retry with exponential backoff
          if (newAttempts >= retry.max_attempts) {
            await supabase
              .from('delivery_retry_queue')
              .update({ status: 'failed', attempts: newAttempts, last_error: resBody.substring(0, 500) })
              .eq('id', retry.id);
          } else {
            const backoffSeconds = Math.min(30 * Math.pow(2, newAttempts - 1), 3600); // 30s, 60s, 120s, 240s... max 1h
            const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString();
            await supabase
              .from('delivery_retry_queue')
              .update({ attempts: newAttempts, next_retry_at: nextRetry, last_error: resBody.substring(0, 500) })
              .eq('id', retry.id);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        if (newAttempts >= retry.max_attempts) {
          await supabase
            .from('delivery_retry_queue')
            .update({ status: 'failed', attempts: newAttempts, last_error: errMsg })
            .eq('id', retry.id);
        } else {
          const backoffSeconds = Math.min(30 * Math.pow(2, newAttempts - 1), 3600);
          const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString();
          await supabase
            .from('delivery_retry_queue')
            .update({ attempts: newAttempts, next_retry_at: nextRetry, last_error: errMsg })
            .eq('id', retry.id);
        }
      }

      processed++;
    }

    return json({ processed, succeeded });
  } catch (error) {
    console.error('process-delivery-retries error:', error);
    return json({ error: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});
