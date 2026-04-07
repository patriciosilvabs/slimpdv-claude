import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

function generateCode(): string {
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  const num = ((array[0] << 16) | (array[1] << 8) | array[2]) % 900000 + 100000;
  return num.toString();
}

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...params } = await req.json();

    if (action === "register") {
      const { name, station_id, tenant_id } = params;

      if (!name || !tenant_id) {
        return new Response(
          JSON.stringify({ error: "name e tenant_id são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate unique verification code (retry on collision)
      let verification_code = "";
      for (let i = 0; i < 10; i++) {
        const candidate = generateCode();
        const { data: existing } = await supabase
          .from("kds_devices")
          .select("id")
          .eq("verification_code", candidate)
          .maybeSingle();
        if (!existing) {
          verification_code = candidate;
          break;
        }
      }
      if (!verification_code) {
        return new Response(
          JSON.stringify({ error: "Não foi possível gerar código único. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const auth_code = generateCode();
      const deviceId = crypto.randomUUID();

      const { data: device, error } = await supabase
        .from("kds_devices")
        .insert({
          device_id: deviceId,
          name,
          station_id: station_id || null,
          tenant_id,
          operation_mode: "production_line",
          verification_code,
          auth_code,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, device, verification_code, auth_code }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "login_by_codes") {
      const { verification_code, auth_code } = params;

      if (!verification_code || !auth_code) {
        return new Response(
          JSON.stringify({ error: "verification_code e auth_code são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Lookup by verification_code globally (no tenant needed)
      const { data: device, error } = await supabase
        .from("kds_devices")
        .select("*")
        .eq("verification_code", verification_code)
        .maybeSingle();

      if (error) throw error;

      if (!device) {
        return new Response(
          JSON.stringify({ error: "Código verificador inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (device.auth_code !== auth_code) {
        return new Response(
          JSON.stringify({ error: "Código de autenticação inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last_seen_at
      await supabase
        .from("kds_devices")
        .update({ last_seen_at: new Date().toISOString(), is_active: true })
        .eq("id", device.id);

      return new Response(
        JSON.stringify({
          success: true,
          device: { ...device, password_hash: undefined, auth_code: undefined, verification_code: undefined },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "regenerate_codes") {
      const { device_id } = params;

      if (!device_id) {
        return new Response(
          JSON.stringify({ error: "device_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new unique verification code
      let verification_code = "";
      for (let i = 0; i < 10; i++) {
        const candidate = generateCode();
        const { data: existing } = await supabase
          .from("kds_devices")
          .select("id")
          .eq("verification_code", candidate)
          .maybeSingle();
        if (!existing) {
          verification_code = candidate;
          break;
        }
      }
      if (!verification_code) {
        return new Response(
          JSON.stringify({ error: "Não foi possível gerar código único. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const auth_code = generateCode();

      const { error } = await supabase
        .from("kds_devices")
        .update({ verification_code, auth_code })
        .eq("id", device_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, verification_code, auth_code }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_codes") {
      const { device_id } = params;

      if (!device_id) {
        return new Response(
          JSON.stringify({ error: "device_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: device, error } = await supabase
        .from("kds_devices")
        .select("verification_code, auth_code")
        .eq("id", device_id)
        .single();

      if (error) throw error;

      // If codes are missing (legacy device), generate them
      if (!device.verification_code || !device.auth_code) {
        let verification_code = "";
        for (let i = 0; i < 10; i++) {
          const candidate = generateCode();
          const { data: existing } = await supabase
            .from("kds_devices")
            .select("id")
            .eq("verification_code", candidate)
            .maybeSingle();
          if (!existing) {
            verification_code = candidate;
            break;
          }
        }
        if (!verification_code) {
          return new Response(
            JSON.stringify({ error: "Não foi possível gerar código único." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const auth_code = generateCode();

        await supabase
          .from("kds_devices")
          .update({ verification_code, auth_code })
          .eq("id", device_id);

        return new Response(
          JSON.stringify({ success: true, verification_code, auth_code }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, verification_code: device.verification_code, auth_code: device.auth_code }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
