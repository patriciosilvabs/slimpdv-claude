import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  try {
    const { api_token } = await req.json();

    if (!api_token) {
      return new Response(JSON.stringify({
        success: false,
        message: "O campo api_token é obrigatório",
      }), { status: 200, headers: jsonHeaders });
    }

    const response = await fetch(
      "https://integracao.cardapioweb.com/api/partner/v1/merchant",
      {
        headers: {
          "X-API-KEY": api_token,
          Accept: "application/json",
        },
      }
    );

    const body = await response.text();

    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        message: `API retornou status ${response.status}`,
        details: body,
      }), { status: 200, headers: jsonHeaders });
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = { raw: body };
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Conexão estabelecida com sucesso",
      merchantName: parsed.name || parsed.trading_name || parsed.company_name || null,
      merchantId: parsed.id || parsed.merchant_id || null,
      raw: parsed,
    }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      message: err.message || "Erro interno ao testar conexão",
    }), { status: 200, headers: jsonHeaders });
  }
});
