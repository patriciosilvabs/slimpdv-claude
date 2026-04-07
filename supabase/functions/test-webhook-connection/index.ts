import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const body = await req.json();
    const { url, headers: customHeaders, payload, tenant_id, webhook_id } = body;

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL é obrigatória" }), { status: 400, headers: jsonHeaders });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), { status: 400, headers: jsonHeaders });
    }

    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(customHeaders || {}),
    };

    const payloadBody = JSON.stringify(payload || {});
    const startTime = Date.now();

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      response = await fetch(url, {
        method: "POST",
        headers: fetchHeaders,
        body: payloadBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (fetchErr: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = fetchErr.name === "AbortError"
        ? "Timeout: servidor não respondeu em 10 segundos"
        : `Erro de conexão: ${fetchErr.message}`;

      // Log the failed test if tenant_id provided
      if (tenant_id) {
        try {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          await supabase.from("order_webhook_logs").insert({
            tenant_id,
            webhook_id: webhook_id || null,
            event: "test.connection",
            request_url: url,
            request_body: payload,
            request_headers: customHeaders || null,
            response_status: null,
            response_body: null,
            success: false,
            error_message: errorMessage,
            duration_ms: durationMs,
            attempted_at: new Date().toISOString(),
          });
        } catch { /* ignore log errors */ }
      }

      return new Response(JSON.stringify({
        success: false,
        status: null,
        response_body: null,
        error: errorMessage,
        duration_ms: durationMs,
      }), { status: 200, headers: jsonHeaders });
    }

    const durationMs = Date.now() - startTime;
    const responseBody = await response.text();
    const success = response.status >= 200 && response.status < 300;

    // Log the test
    if (tenant_id) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase.from("order_webhook_logs").insert({
          tenant_id,
          webhook_id: webhook_id || null,
          event: "test.connection",
          request_url: url,
          request_body: payload,
          request_headers: customHeaders || null,
          response_status: response.status,
          response_body: responseBody.slice(0, 2000),
          success,
          error_message: success ? null : `HTTP ${response.status}`,
          duration_ms: durationMs,
          attempted_at: new Date().toISOString(),
        });
      } catch { /* ignore log errors */ }
    }

    return new Response(JSON.stringify({
      success,
      status: response.status,
      response_body: responseBody.slice(0, 2000),
      duration_ms: durationMs,
    }), { status: 200, headers: jsonHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), { status: 500, headers: jsonHeaders });
  }
});
