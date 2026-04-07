import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface ReopenNotificationRequest {
  orderId: string;
  tableNumber: number;
  userName: string;
  reason: string;
  totalValue: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      console.log('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'Email not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orderId, tableNumber, userName, reason, totalValue }: ReopenNotificationRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (!adminRoles?.length) {
      return new Response(
        JSON.stringify({ success: false, message: 'No admins' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const adminEmails = authUsers?.users
      .filter(u => adminRoles.some(r => r.user_id === u.id) && u.email)
      .map(u => u.email!) || [];

    if (!adminEmails.length) {
      return new Response(
        JSON.stringify({ success: false, message: 'No emails' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue || 0);
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Send via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'slim <onboarding@resend.dev>',
        to: adminEmails,
        subject: `⚠️ Mesa ${tableNumber} foi reaberta`,
        html: `<h2>Mesa ${tableNumber} reaberta</h2><p><strong>Por:</strong> ${userName}</p><p><strong>Valor:</strong> ${formattedValue}</p><p><strong>Horário:</strong> ${now}</p><p><strong>Motivo:</strong> ${reason}</p>`
      })
    });

    const result = await res.json();
    console.log('Email result:', result);

    return new Response(
      JSON.stringify({ success: res.ok, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
