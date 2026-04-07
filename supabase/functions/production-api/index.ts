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
      request_body: requestBody ? JSON.stringify(requestBody) : null,
      response_summary: responseSummary,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
  } catch (e) {
    console.error('Failed to log request:', e);
  }
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number | null;
  min_stock?: number | null;
  cost_per_unit?: number | null;
}

interface Target {
  ingredient_id: string;
  target_quantity: number;
  day_of_week: number;
}

interface Tenant {
  id: string;
  name: string;
}

interface ComplementOptionIngredient {
  ingredient_id: string;
  quantity: number;
}

async function getDemand(tenantId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Get tenant info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .single();
  
  const tenantData = tenant as Tenant | null;
  
  // Get ingredients
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, unit, current_stock')
    .eq('tenant_id', tenantId);
  
  const ingredientsData = (ingredients || []) as Ingredient[];
  
  // Get targets for today
  const { data: targets } = await supabase
    .from('ingredient_daily_targets')
    .select('ingredient_id, target_quantity')
    .eq('tenant_id', tenantId)
    .eq('day_of_week', dayOfWeek);
  
  const targetsData = (targets || []) as Target[];
  const targetMap = new Map(targetsData.map(t => [t.ingredient_id, t.target_quantity]));
  
  // Get complement option ingredients for additional demand info
  const { data: complementIngredients } = await supabase
    .from('complement_option_ingredients')
    .select('ingredient_id, quantity')
    .eq('tenant_id', tenantId);
  
  const complementIngredientsData = (complementIngredients || []) as ComplementOptionIngredient[];
  
  // Aggregate complement ingredients by ingredient_id (for reference in response)
  const complementDemandMap = new Map<string, number>();
  complementIngredientsData.forEach(ci => {
    const current = complementDemandMap.get(ci.ingredient_id) || 0;
    complementDemandMap.set(ci.ingredient_id, current + ci.quantity);
  });
  
  const demand = ingredientsData.map(ing => {
    const targetStock = targetMap.get(ing.id) || 0;
    const currentStock = ing.current_stock || 0;
    const toProduce = Math.max(0, targetStock - currentStock);
    const hasComplementUsage = complementDemandMap.has(ing.id);
    
    let status = 'ok';
    if (toProduce > 0) {
      const ratio = currentStock / (targetStock || 1);
      if (ratio < 0.25) status = 'critical';
      else if (ratio < 0.5) status = 'low';
      else status = 'needed';
    }
    
    return {
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      unit: ing.unit,
      current_stock: currentStock,
      target_stock: targetStock,
      to_produce: toProduce,
      status,
      used_in_complements: hasComplementUsage,
    };
  }).filter(d => d.to_produce > 0);
  
  return {
    success: true,
    date: today.toISOString().split('T')[0],
    day_of_week: dayOfWeek,
    store: tenantData ? { id: tenantData.id, name: tenantData.name } : null,
    demand,
  };
}

async function getIngredients(tenantId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, unit, current_stock, min_stock, cost_per_unit')
    .eq('tenant_id', tenantId)
    .order('name');
  
  return {
    success: true,
    ingredients: ingredients || [],
  };
}

async function getTargets(tenantId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, unit')
    .eq('tenant_id', tenantId)
    .order('name');
  
  const ingredientsData = (ingredients || []) as Ingredient[];
  
  const { data: targets } = await supabase
    .from('ingredient_daily_targets')
    .select('ingredient_id, day_of_week, target_quantity')
    .eq('tenant_id', tenantId);
  
  const targetsData = (targets || []) as Target[];
  
  const targetMap = new Map<string, Record<number, number>>();
  targetsData.forEach(t => {
    if (!targetMap.has(t.ingredient_id)) {
      targetMap.set(t.ingredient_id, {});
    }
    targetMap.get(t.ingredient_id)![t.day_of_week] = t.target_quantity;
  });
  
  const result = ingredientsData.map(ing => ({
    ingredient_id: ing.id,
    ingredient_name: ing.name,
    unit: ing.unit,
    daily_targets: {
      sunday: targetMap.get(ing.id)?.[0] || 0,
      monday: targetMap.get(ing.id)?.[1] || 0,
      tuesday: targetMap.get(ing.id)?.[2] || 0,
      wednesday: targetMap.get(ing.id)?.[3] || 0,
      thursday: targetMap.get(ing.id)?.[4] || 0,
      friday: targetMap.get(ing.id)?.[5] || 0,
      saturday: targetMap.get(ing.id)?.[6] || 0,
    },
  }));
  
  return {
    success: true,
    targets: result,
  };
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);
  
  try {
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
    
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    // Only GET allowed
    if (req.method !== 'GET') {
      await logRequest(keyData.tenant_id, keyData.id, action || 'unknown', req.method, 405, null, 'Method not allowed', req);
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let result: unknown;
    
    switch (action) {
      case 'demand':
        if (!keyData.permissions.demand) {
          await logRequest(keyData.tenant_id, keyData.id, action, req.method, 403, null, 'Permission denied', req);
          return new Response(
            JSON.stringify({ success: false, error: 'Permission denied for this action' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getDemand(keyData.tenant_id);
        break;
        
      case 'ingredients':
        if (!keyData.permissions.ingredients) {
          await logRequest(keyData.tenant_id, keyData.id, action, req.method, 403, null, 'Permission denied', req);
          return new Response(
            JSON.stringify({ success: false, error: 'Permission denied for this action' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getIngredients(keyData.tenant_id);
        break;
        
      case 'targets':
        if (!keyData.permissions.targets) {
          await logRequest(keyData.tenant_id, keyData.id, action, req.method, 403, null, 'Permission denied', req);
          return new Response(
            JSON.stringify({ success: false, error: 'Permission denied for this action' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getTargets(keyData.tenant_id);
        break;
        
      default:
        await logRequest(keyData.tenant_id, keyData.id, action || 'unknown', req.method, 400, null, 'Invalid action', req);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid action. Available actions: demand, ingredients, targets',
            documentation: {
              demand: 'GET ?action=demand - Returns production demand based on current stock vs targets',
              ingredients: 'GET ?action=ingredients - Returns list of all ingredients with stock levels',
              targets: 'GET ?action=targets - Returns daily production targets by day of week',
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    await logRequest(keyData.tenant_id, keyData.id, action!, req.method, 200, null, 'Success', req);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Production API error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
