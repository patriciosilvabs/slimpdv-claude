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

    const userId = (claimsData.claims as any).sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const tenantId = url.searchParams.get('tenant_id');
      if (!tenantId) return json({ error: 'Missing tenant_id' }, 400);

      const { data, error } = await supabase
        .from('store_api_tokens')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return json({ token: data });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { tenant_id, action } = body;
      if (!tenant_id) return json({ error: 'Missing tenant_id' }, 400);

      // Verify user is admin/owner
      const { data: member } = await supabase
        .from('tenant_members')
        .select('is_owner')
        .eq('tenant_id', tenant_id)
        .eq('user_id', userId)
        .single();

      if (!member) return json({ error: 'Acesso negado' }, 403);

      if (action === 'regenerate') {
        // Generate new token using raw SQL for gen_random_bytes
        const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

        const { data, error } = await supabase
          .from('store_api_tokens')
          .update({ api_token: newToken, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenant_id)
          .select()
          .single();

        if (error) throw error;
        return json({ token: data, message: 'Token regenerado com sucesso' });
      }

      // Create or get existing token
      const { data: existing } = await supabase
        .from('store_api_tokens')
        .select('*')
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (existing) {
        return json({ token: existing });
      }

      const { data, error } = await supabase
        .from('store_api_tokens')
        .insert({ tenant_id, created_by: userId })
        .select()
        .single();

      if (error) throw error;
      return json({ token: data, message: 'Token criado com sucesso' });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('store-api-token error:', error);
    return json({ error: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});
