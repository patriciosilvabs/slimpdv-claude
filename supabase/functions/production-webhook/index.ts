import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ApiKeyData {
  id: string;
  tenant_id: string;
  permissions: {
    demand?: boolean;
    ingredients?: boolean;
    targets?: boolean;
    webhook?: boolean;
  };
}

interface ShipmentItem {
  ingredient_name: string;
  ingredient_id?: string;
  quantity: number;
  unit: string;
}

interface ShipmentPayload {
  event: 'SHIPMENT_CREATED' | 'SHIPMENT_RECEIVED';
  shipment: {
    external_id: string;
    items: ShipmentItem[];
    shipped_at?: string;
    received_at?: string;
    notes?: string;
  };
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock?: number | null;
}

async function validateApiKey(apiKey: string): Promise<ApiKeyData | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data, error } = await supabase
    .from('production_api_keys')
    .select('id, tenant_id, permissions')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error || !data) return null;
  
  // Update last used timestamp
  await supabase
    .from('production_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);
  
  return data as ApiKeyData;
}

async function logRequest(
  tenantId: string,
  apiKeyId: string | null,
  endpoint: string,
  method: string,
  statusCode: number,
  requestBody: unknown,
  responseSummary: string,
  req: Request
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase.from('production_api_logs').insert({
      tenant_id: tenantId,
      api_key_id: apiKeyId,
      endpoint,
      method,
      status_code: statusCode,
      request_body: requestBody,
      response_summary: responseSummary,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
  } catch (e) {
    console.error('Failed to log request:', e);
  }
}

async function findIngredientByName(
  tenantId: string,
  name: string
): Promise<Ingredient | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data } = await supabase
    .from('ingredients')
    .select('id, name, unit')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  
  return data as Ingredient | null;
}

async function processShipment(
  tenantId: string,
  payload: ShipmentPayload
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const results: { item: string; status: string; message: string }[] = [];
  
  for (const item of payload.shipment.items) {
    try {
      // Find ingredient by ID or name
      let ingredientData: Ingredient | null = null;
      
      if (item.ingredient_id) {
        const { data } = await supabase
          .from('ingredients')
          .select('id, name, unit')
          .eq('id', item.ingredient_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        ingredientData = data as Ingredient | null;
      }
      
      if (!ingredientData && item.ingredient_name) {
        ingredientData = await findIngredientByName(tenantId, item.ingredient_name);
      }
      
      if (!ingredientData) {
        results.push({
          item: item.ingredient_name,
          status: 'error',
          message: 'Ingredient not found in this store',
        });
        continue;
      }
      
      // Get current stock
      const { data: currentIngredient } = await supabase
        .from('ingredients')
        .select('current_stock')
        .eq('id', ingredientData.id)
        .single();
      
      const previousStock = (currentIngredient as { current_stock: number | null } | null)?.current_stock || 0;
      const newStock = previousStock + item.quantity;
      
      // Update stock
      await supabase
        .from('ingredients')
        .update({ 
          current_stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', ingredientData.id);
      
      // Register stock movement
      await supabase.from('stock_movements').insert({
        ingredient_id: ingredientData.id,
        movement_type: 'entry',
        quantity: item.quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        tenant_id: tenantId,
        notes: `Envio CPD: ${payload.shipment.external_id}${payload.shipment.notes ? ` - ${payload.shipment.notes}` : ''}`,
      });
      
      results.push({
        item: ingredientData.name,
        status: 'success',
        message: `Stock updated: ${previousStock} → ${newStock} ${ingredientData.unit}`,
      });
      
    } catch (e) {
      console.error('Error processing item:', e);
      results.push({
        item: item.ingredient_name,
        status: 'error',
        message: 'Failed to process item',
      });
    }
  }
  
  return results;
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);
  
  try {
    // Only POST allowed
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate API key
    const apiKey = req.headers.get('X-API-KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing X-API-KEY header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const keyData = await validateApiKey(apiKey);
    if (!keyData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!keyData.permissions.webhook) {
      return new Response(
        JSON.stringify({ success: false, error: 'Permission denied for webhook operations' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse body
    let payload: ShipmentPayload;
    try {
      payload = await req.json();
    } catch {
      await logRequest(keyData.tenant_id, keyData.id, 'webhook', req.method, 400, null, 'Invalid JSON', req);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate payload
    if (!payload.event || !payload.shipment || !payload.shipment.external_id || !Array.isArray(payload.shipment.items)) {
      await logRequest(keyData.tenant_id, keyData.id, 'webhook', req.method, 400, payload, 'Invalid payload structure', req);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid payload structure',
          expected: {
            event: 'SHIPMENT_CREATED | SHIPMENT_RECEIVED',
            shipment: {
              external_id: 'string (required)',
              items: [
                {
                  ingredient_name: 'string (required)',
                  ingredient_id: 'uuid (optional - for precise matching)',
                  quantity: 'number (required)',
                  unit: 'string (required)',
                }
              ],
              shipped_at: 'ISO datetime (optional)',
              notes: 'string (optional)',
            }
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process based on event type
    let results: { item: string; status: string; message: string }[];
    
    switch (payload.event) {
      case 'SHIPMENT_CREATED':
      case 'SHIPMENT_RECEIVED':
        results = await processShipment(keyData.tenant_id, payload);
        break;
        
      default:
        await logRequest(keyData.tenant_id, keyData.id, 'webhook', req.method, 400, payload, 'Unknown event type', req);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unknown event type: ${payload.event}`,
            supported_events: ['SHIPMENT_CREATED', 'SHIPMENT_RECEIVED'],
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    await logRequest(
      keyData.tenant_id, 
      keyData.id, 
      `webhook/${payload.event}`, 
      req.method, 
      200, 
      payload, 
      `Processed: ${successCount} success, ${errorCount} errors`, 
      req
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        event: payload.event,
        external_id: payload.shipment.external_id,
        processed_at: new Date().toISOString(),
        summary: {
          total_items: payload.shipment.items.length,
          success: successCount,
          errors: errorCount,
        },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Production Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
