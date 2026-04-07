import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Archive orders from before today in São Paulo timezone.
    // The cron runs at 3 AM UTC (midnight BRT). Using UTC midnight
    // would miss orders created between 21h-0h BRT (0-3h UTC),
    // so we compute the start of today in America/Sao_Paulo.
    const spNow = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const spToday = new Date(spNow);
    spToday.setHours(0, 0, 0, 0);
    // Convert back to UTC ISO string for the DB query
    const offsetMs = new Date().getTime() - new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getTime();
    const cutoff = new Date(spToday.getTime() + offsetMs).toISOString();

    // Set archived_at on non-archived orders before today that are delivered or cancelled
    const { data, error } = await supabase
      .from("orders")
      .update({ archived_at: new Date().toISOString() })
      .is("archived_at", null)
      .lt("created_at", cutoff)
      .select("id");

    if (error) throw error;

    const count = data?.length ?? 0;

    return new Response(
      JSON.stringify({ success: true, archived_count: count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
