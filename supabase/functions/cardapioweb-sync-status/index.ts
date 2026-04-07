import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const CARDAPIOWEB_API_URL = 'https://integracao.cardapioweb.com/api/partner/v1';

// Map local status to CardápioWeb endpoint
function getEndpointForStatus(localStatus: string): string | null {
  const endpointMap: Record<string, string> = {
    'preparing': 'confirm',
    'ready': 'ready',
    'delivered': 'finalize',
    'cancelled': 'cancel',
  };
  return endpointMap[localStatus] || null;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { order_id, new_status, cancellation_reason } = await req.json();

    console.log('[CardápioWeb Sync] Syncing status:', { order_id, new_status });

    if (!order_id || !new_status) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id or new_status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, external_source, external_order_id, tenant_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('[CardápioWeb Sync] Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only sync CardápioWeb orders
    if (order.external_source !== 'cardapioweb') {
      console.log('[CardápioWeb Sync] Not a CardápioWeb order, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'Not a CardápioWeb order' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get integration config
    const { data: integration, error: integrationError } = await supabase
      .from('cardapioweb_integrations')
      .select('api_token')
      .eq('tenant_id', order.tenant_id)
      .eq('is_active', true)
      .maybeSingle();

    if (integrationError || !integration) {
      console.error('[CardápioWeb Sync] Integration not found:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Integration not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endpoint = getEndpointForStatus(new_status);

    if (!endpoint) {
      console.log('[CardápioWeb Sync] No endpoint for status:', new_status);
      return new Response(
        JSON.stringify({ success: true, message: 'No sync needed for this status' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build request body for cancel endpoint
    const requestBody = endpoint === 'cancel' && cancellation_reason
      ? JSON.stringify({ cancellation_reason })
      : undefined;

    // Call CardápioWeb API
    const apiUrl = `${CARDAPIOWEB_API_URL}/orders/${order.external_order_id}/${endpoint}`;
    console.log('[CardápioWeb Sync] Calling API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': integration.api_token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CardápioWeb Sync] API error:', response.status, errorText);
      
      // Log the error but don't fail - the local order is already updated
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `CardápioWeb API returned ${response.status}`,
          error: errorText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CardápioWeb Sync] Status synced successfully');

    return new Response(
      JSON.stringify({ success: true }),
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
