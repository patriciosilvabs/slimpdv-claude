import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LogisticsConfig {
  enabled: boolean;
  buffer_minutes: number;
  strategy: "disabled" | "neighborhood" | "proximity";
  geocoding_provider: string;
  max_group_radius_km: number;
}

const DEFAULT_CONFIG: LogisticsConfig = {
  enabled: false,
  buffer_minutes: 3,
  strategy: "disabled",
  geocoding_provider: "nominatim",
  max_group_radius_km: 2,
};

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Extract neighborhood from address string (best effort)
function extractNeighborhood(address: string): string | null {
  if (!address) return null;
  // Common Brazilian address pattern: "Rua X, 123 - Bairro, Cidade - UF"
  const dashParts = address.split(" - ");
  if (dashParts.length >= 2) {
    // The neighborhood is usually the second part
    const neighborhood = dashParts[1].split(",")[0].trim();
    if (neighborhood.length > 2) return neighborhood.toLowerCase();
  }
  return null;
}

// Geocode using Nominatim (free, no API key)
async function geocodeNominatim(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
      { headers: { "User-Agent": "PDVSlim/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const headers = getCorsHeaders(req);

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all tenants that have delivery_logistics enabled
    const { data: settings } = await supabase
      .from("global_settings")
      .select("tenant_id, value")
      .eq("key", "delivery_logistics");

    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    let totalProcessed = 0;

    for (const setting of settings) {
      const config: LogisticsConfig = { ...DEFAULT_CONFIG, ...(setting.value as Record<string, unknown>) };
      if (!config.enabled) continue;

      const tenantId = setting.tenant_id;

      // 1. Geocode pending orders
      const { data: pendingGeocode } = await supabase
        .from("orders")
        .select("id, delivery_address, delivery_neighborhood")
        .eq("tenant_id", tenantId)
        .eq("logistics_status", "buffered")
        .eq("geocode_status", "pending")
        .limit(10);

      if (pendingGeocode) {
        for (const order of pendingGeocode) {
          const address = order.delivery_address || "";
          const neighborhood = extractNeighborhood(address) || order.delivery_neighborhood;

          if (config.strategy === "proximity" && address) {
            const coords = await geocodeNominatim(address);
            if (coords) {
              // Store coords in delivery_neighborhood as "lat,lon" for simplicity
              await supabase
                .from("orders")
                .update({
                  geocode_status: "success",
                  delivery_neighborhood: neighborhood || address,
                })
                .eq("id", order.id);
            } else {
              // Geocoding failed - use neighborhood fallback
              await supabase
                .from("orders")
                .update({
                  geocode_status: "failed",
                  delivery_neighborhood: neighborhood || address,
                })
                .eq("id", order.id);
            }
          } else {
            // neighborhood strategy or no address
            await supabase
              .from("orders")
              .update({
                geocode_status: neighborhood ? "success" : "failed",
                delivery_neighborhood: neighborhood || address,
              })
              .eq("id", order.id);
          }
        }
      }

      // 2. Find buffered orders whose buffer time has expired
      const bufferCutoff = new Date(Date.now() - config.buffer_minutes * 60 * 1000).toISOString();

      const { data: expiredOrders } = await supabase
        .from("orders")
        .select("id, delivery_neighborhood, created_at, logistics_group_id")
        .eq("tenant_id", tenantId)
        .eq("logistics_status", "buffered")
        .lte("created_at", bufferCutoff);

      if (!expiredOrders || expiredOrders.length === 0) continue;

      // 3. Group by strategy
      if (config.strategy === "neighborhood") {
        // Group by neighborhood
        const byNeighborhood = new Map<string, string[]>();
        for (const order of expiredOrders) {
          const key = (order.delivery_neighborhood || "unknown").toLowerCase().trim();
          const group = byNeighborhood.get(key) || [];
          group.push(order.id);
          byNeighborhood.set(key, group);
        }

        for (const [, orderIds] of byNeighborhood) {
          if (orderIds.length > 1) {
            // Create a logistics group
            const { data: group } = await supabase
              .from("delivery_logistics_groups")
              .insert({ tenant_id: tenantId, strategy: "neighborhood", status: "released", released_at: new Date().toISOString() })
              .select("id")
              .single();

            if (group) {
              for (const orderId of orderIds) {
                await supabase
                  .from("orders")
                  .update({ logistics_group_id: group.id, logistics_status: "grouped" })
                  .eq("id", orderId);
              }
            }
          }

          // Release all orders (grouped or not)
          for (const orderId of orderIds) {
            await supabase.rpc("release_buffered_order", { _order_id: orderId });
            totalProcessed++;
          }
        }
      } else {
        // Default: release all expired orders individually
        for (const order of expiredOrders) {
          await supabase.rpc("release_buffered_order", { _order_id: order.id });
          totalProcessed++;
        }
      }
    }

    return new Response(JSON.stringify({ processed: totalProcessed }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delivery logistics processor error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
