import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Find the least-busy prep station (item_assembly) for smart routing
async function findLeastBusyPrepStation(supabase: any, tenantId: string, excludeStationId?: string) {
  // Get all item_assembly stations
  const { data: prepStations } = await supabase
    .from("kds_stations")
    .select("id, name, sort_order")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("station_type", "item_assembly")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!prepStations || prepStations.length === 0) return null;

  // Count items in each prep station
  let leastBusyStation = prepStations[0];
  let minCount = Infinity;

  for (const station of prepStations) {
    const { count } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("current_station_id", station.id)
      .in("station_status", ["waiting", "in_progress"]);

    const itemCount = count || 0;
    if (itemCount < minCount) {
      minCount = itemCount;
      leastBusyStation = station;
    }
  }

  return leastBusyStation;
}

// Find the dispatch/order_status station
async function findDispatchStation(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("kds_stations")
    .select("id, name, station_type")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("station_type", "order_status")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, device_id, tenant_id, auth_code: deviceAuthCode } = body;

    if (!device_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "device_id e tenant_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate device belongs to tenant AND verify auth_code
    const { data: device, error: deviceError } = await supabase
      .from("kds_devices")
      .select("id, tenant_id, is_active, station_id, auth_code")
      .eq("device_id", device_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (deviceError) throw deviceError;

    if (!device) {
      return new Response(
        JSON.stringify({ error: "Dispositivo não encontrado ou não pertence ao tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify device auth_code for data access
    console.log(`[kds-data] Auth check — device_id: ${device_id}, auth_code present: ${!!deviceAuthCode}, auth_code length: ${deviceAuthCode?.length || 0}, db auth_code length: ${device.auth_code?.length || 0}, match: ${deviceAuthCode === device.auth_code}`);
    if (!deviceAuthCode || device.auth_code !== deviceAuthCode) {
      console.warn(`[kds-data] 401 — device_id: ${device_id}, sent code: "${deviceAuthCode?.substring(0, 4)}…", db code: "${device.auth_code?.substring(0, 4)}…"`);
      return new Response(
        JSON.stringify({ error: "Código de autenticação do dispositivo inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update heartbeat
    await supabase
      .from("kds_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    if (action === "get_orders") {
      const statuses = body.statuses || ["pending", "preparing", "ready", "delivered", "cancelled"];
      
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          *,
          table:tables(number),
          order_items(
            *,
            added_by,
            product:products(name, image_url),
            variation:product_variations(name),
            extras:order_item_extras(extra_name, price, kds_category),
            current_station:kds_stations!order_items_current_station_id_fkey(id, name, station_type, color, icon, sort_order),
            sub_items:order_item_sub_items(
              id, sub_item_index, notes,
              sub_extras:order_item_sub_item_extras(id, group_name, option_name, price, quantity, kds_category)
            )
          )
        `)
        .eq("tenant_id", tenant_id)
        .in("status", statuses)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch profiles
      const createdByIds = (orders || []).map((o: any) => o.created_by).filter(Boolean);
      const addedByIds = (orders || []).flatMap((o: any) =>
        (o.order_items || []).map((item: any) => item.added_by).filter(Boolean)
      );
      const allUserIds = [...new Set([...createdByIds, ...addedByIds])];
      let profilesMap: Record<string, { name: string }> = {};

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", allUserIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc: any, p: any) => {
            acc[p.id] = { name: p.name };
            return acc;
          }, {});
        }
      }

      const ordersWithProfiles = (orders || []).map((order: any) => ({
        ...order,
        created_by_profile: order.created_by ? profilesMap[order.created_by] || null : null,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          added_by_profile: item.added_by ? profilesMap[item.added_by] || null : null,
        })),
      }));

      // Filter items by station's displayed_item_kinds if configured
      let filteredOrders = ordersWithProfiles;
      if (device.station_id) {
        const { data: stationConfig } = await supabase
          .from("kds_stations")
          .select("displayed_item_kinds")
          .eq("id", device.station_id)
          .maybeSingle();

        const kinds = stationConfig?.displayed_item_kinds;
        if (kinds && Array.isArray(kinds) && kinds.length > 0) {
          filteredOrders = ordersWithProfiles.map((order: any) => ({
            ...order,
            order_items: (order.order_items || []).filter((item: any) =>
              item.item_kind ? kinds.includes(item.item_kind) : true
            ),
          })).filter((order: any) => order.order_items.length > 0);
        }
      }

      return new Response(
        JSON.stringify({ orders: filteredOrders }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_settings") {
      const { data: settings, error } = await supabase
        .from("kds_global_settings")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ settings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_stations") {
      const { data: stations, error } = await supabase
        .from("kds_stations")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ stations }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_all") {
      const statuses = body.statuses || ["pending", "preparing", "ready", "delivered", "cancelled"];
      
      const [ordersResult, settingsResult, stationsResult] = await Promise.all([
        supabase
          .from("orders")
          .select(`
            *,
            table:tables(number),
            order_items(
              *,
              added_by,
              product:products(name, image_url),
              variation:product_variations(name),
              extras:order_item_extras(extra_name, price, kds_category),
              current_station:kds_stations!order_items_current_station_id_fkey(id, name, station_type, color, icon, sort_order),
              sub_items:order_item_sub_items(
                id, sub_item_index, notes,
                sub_extras:order_item_sub_item_extras(id, group_name, option_name, price, quantity, kds_category)
              )
            )
          `)
          .eq("tenant_id", tenant_id)
          .in("status", statuses)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("kds_global_settings")
          .select("*")
          .eq("tenant_id", tenant_id)
          .maybeSingle(),
        supabase
          .from("kds_stations")
          .select("*")
          .eq("tenant_id", tenant_id)
          .order("sort_order", { ascending: true }),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (stationsResult.error) throw stationsResult.error;

      // Fetch profiles
      const orders = ordersResult.data || [];
      const createdByIds = orders.map((o: any) => o.created_by).filter(Boolean);
      const addedByIds = orders.flatMap((o: any) =>
        (o.order_items || []).map((item: any) => item.added_by).filter(Boolean)
      );
      const allUserIds = [...new Set([...createdByIds, ...addedByIds])];
      let profilesMap: Record<string, { name: string }> = {};

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", allUserIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc: any, p: any) => {
            acc[p.id] = { name: p.name };
            return acc;
          }, {});
        }
      }

      const ordersWithProfiles = orders.map((order: any) => ({
        ...order,
        created_by_profile: order.created_by ? profilesMap[order.created_by] || null : null,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          added_by_profile: item.added_by ? profilesMap[item.added_by] || null : null,
        })),
      }));

      // Filter items by station's displayed_item_kinds if configured
      let filteredOrders = ordersWithProfiles;
      if (device.station_id) {
        const stationData = (stationsResult.data || []).find((s: any) => s.id === device.station_id);
        const kinds = stationData?.displayed_item_kinds;
        if (kinds && Array.isArray(kinds) && kinds.length > 0) {
          filteredOrders = ordersWithProfiles.map((order: any) => ({
            ...order,
            order_items: (order.order_items || []).filter((item: any) =>
              item.item_kind ? kinds.includes(item.item_kind) : true
            ),
          })).filter((order: any) => order.order_items.length > 0);
        }
      }

      return new Response(
        JSON.stringify({
          orders: filteredOrders,
          settings: settingsResult.data,
          stations: stationsResult.data || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Smart move: routes item to the correct next station with load balancing
    if (action === "smart_move_item") {
      const { item_id, current_station_id } = body;
      
      if (!item_id || !current_station_id) {
        return new Response(
          JSON.stringify({ error: "item_id e current_station_id são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const now = new Date().toISOString();

      // Get current station info
      const { data: currentStation } = await supabase
        .from("kds_stations")
        .select("id, station_type, sort_order")
        .eq("id", current_station_id)
        .single();

      if (!currentStation) {
        return new Response(
          JSON.stringify({ error: "Estação atual não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let targetStationId: string | null = null;
      let targetStationStatus = "waiting";

      // SMART ROUTING LOGIC
      if (currentStation.station_type === "prep_start") {
        const leastBusy = await findLeastBusyPrepStation(supabase, tenant_id);
        if (leastBusy) {
          targetStationId = leastBusy.id;
        } else {
          const dispatch = await findDispatchStation(supabase, tenant_id);
          targetStationId = dispatch?.id || null;
        }
      } else if (currentStation.station_type === "item_assembly") {
        const dispatch = await findDispatchStation(supabase, tenant_id);
        if (dispatch) {
          targetStationId = dispatch.id;
        } else {
          targetStationId = null;
          targetStationStatus = "done";
        }
      } else if (currentStation.station_type === "order_status") {
        // ORDER_STATUS routing: depends on order_type
        // Fetch the order_type from the order linked to this item
        const { data: itemOrder } = await supabase
          .from("order_items")
          .select("order_id, orders!inner(order_type)")
          .eq("id", item_id)
          .single();

        const orderType = (itemOrder as any)?.orders?.order_type || "takeaway";

        if (orderType === "dine_in") {
          // Mesa: find next order_status station with higher sort_order
          const { data: nextOrderStatusStations } = await supabase
            .from("kds_stations")
            .select("id, station_type, sort_order")
            .eq("tenant_id", tenant_id)
            .eq("is_active", true)
            .eq("station_type", "order_status")
            .gt("sort_order", currentStation.sort_order)
            .order("sort_order", { ascending: true })
            .limit(1);

          if (nextOrderStatusStations && nextOrderStatusStations.length > 0) {
            targetStationId = nextOrderStatusStations[0].id;
          } else {
            // No more order_status stations → done
            targetStationId = null;
            targetStationStatus = "done";
          }
        } else {
          // Delivery/Takeaway: done immediately
          targetStationId = null;
          targetStationStatus = "done";
        }
      } else {
        // Default: find next station by sort_order
        const { data: nextStations } = await supabase
          .from("kds_stations")
          .select("id, station_type")
          .eq("tenant_id", tenant_id)
          .eq("is_active", true)
          .neq("station_type", "order_status")
          .gt("sort_order", currentStation.sort_order)
          .order("sort_order", { ascending: true })
          .limit(1);

        if (nextStations && nextStations.length > 0) {
          targetStationId = nextStations[0].id;
        } else {
          const dispatch = await findDispatchStation(supabase, tenant_id);
          targetStationId = dispatch?.id || null;
          if (!targetStationId) targetStationStatus = "done";
        }
      }

      // Update the item
      const updates: any = {
        current_station_id: targetStationId,
        station_status: targetStationId ? "waiting" : "done",
        station_started_at: null,
        station_completed_at: now,
      };

      if (!targetStationId) {
        updates.status = "delivered";
      }

      const { error: updateError } = await supabase
        .from("order_items")
        .update(updates)
        .eq("id", item_id)
        .eq("tenant_id", tenant_id);

      if (updateError) throw updateError;

      // Log completion at current station (fire-and-forget, ignore errors)
      try {
        await supabase.from("kds_station_logs").insert({
          order_item_id: item_id,
          station_id: current_station_id,
          action: "completed",
          tenant_id,
        });
      } catch (_) { /* ignore */ }

      // Log entry at new station
      if (targetStationId) {
        try {
          await supabase.from("kds_station_logs").insert({
            order_item_id: item_id,
            station_id: targetStationId,
            action: "entered",
            tenant_id,
          });
        } catch (_) { /* ignore */ }
      }

      // Check if all items of the order are done/in order_status → mark order as ready
      if (!targetStationId || currentStation.station_type === "item_assembly") {
        const { data: itemData } = await supabase
          .from("order_items")
          .select("order_id")
          .eq("id", item_id)
          .single();

        if (itemData?.order_id) {
          const { data: orderStatusStations } = await supabase
            .from("kds_stations")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("is_active", true)
            .eq("station_type", "order_status");

          const osIds = (orderStatusStations || []).map((s: any) => s.id);

          const { data: allItems } = await supabase
            .from("order_items")
            .select("id, current_station_id, station_status")
            .eq("order_id", itemData.order_id);

          const allReady = allItems?.every((item: any) =>
            (item.current_station_id && osIds.includes(item.current_station_id)) ||
            item.station_status === "done"
          );

          if (allReady) {
            await supabase
              .from("orders")
              .update({ status: "ready", ready_at: now })
              .eq("id", itemData.order_id);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, target_station_id: targetStationId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Claim item (INICIAR) — uses SQL RPC with FOR UPDATE NOWAIT
    if (action === "claim_item") {
      const { item_id } = body;

      if (!item_id) {
        return new Response(
          JSON.stringify({ error: "item_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error: claimError } = await supabase.rpc("claim_order_item", {
        _item_id: item_id,
        _user_id: null,
      });

      if (claimError) throw claimError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to oven — uses SQL RPC
    if (action === "send_to_oven") {
      const { item_id, oven_minutes } = body;

      if (!item_id) {
        return new Response(
          JSON.stringify({ error: "item_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error: ovenError } = await supabase.rpc("send_to_oven", {
        _item_id: item_id,
        _user_id: null,
        _oven_minutes: oven_minutes ?? null,
      });

      if (ovenError) throw ovenError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark item ready (PRONTO) — uses SQL RPC with check_order_completion
    if (action === "mark_item_ready") {
      const { item_id } = body;

      if (!item_id) {
        return new Response(
          JSON.stringify({ error: "item_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error: readyError } = await supabase.rpc("mark_item_ready", {
        _item_id: item_id,
        _user_id: null,
      });

      if (readyError) throw readyError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Complete edge preparation (MONTAGEM) — uses SQL RPC with atomic routing
    if (action === "complete_edge") {
      const { item_id } = body;

      if (!item_id) {
        return new Response(
          JSON.stringify({ error: "item_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error: edgeError } = await supabase.rpc("complete_edge_preparation", {
        _item_id: item_id,
        _user_id: null,
      });

      if (edgeError) throw edgeError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_item_station") {
      const { item_id, station_id, station_status } = body;
      
      if (!item_id) {
        return new Response(
          JSON.stringify({ error: "item_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: any = {};
      if (station_id !== undefined) updates.current_station_id = station_id;
      if (station_status !== undefined) updates.station_status = station_status;
      if (station_status === 'in_progress') updates.station_started_at = new Date().toISOString();
      if (station_status === 'completed') updates.station_completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("order_items")
        .update(updates)
        .eq("id", item_id)
        .eq("tenant_id", tenant_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_order_status") {
      const { order_id, status } = body;
      
      if (!order_id || !status) {
        return new Response(
          JSON.stringify({ error: "order_id e status são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'ready') updates.ready_at = new Date().toISOString();
      if (status === 'delivered') updates.delivered_at = new Date().toISOString();

      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", order_id)
        .eq("tenant_id", tenant_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "log_station") {
      const { order_item_id, station_id, action: logAction, duration_seconds, notes } = body;
      
      const { error } = await supabase
        .from("kds_station_logs")
        .insert({
          order_item_id,
          station_id,
          action: logAction,
          duration_seconds,
          notes,
          tenant_id,
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dispatch oven items — clears current_station_id so items leave the oven view
    if (action === "dispatch_oven_items") {
      const { item_ids } = body;

      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "item_ids é obrigatório (array)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const now = new Date().toISOString();

      // Get order_ids and current_station_id before updating (needed for logs)
      const { data: itemRows } = await supabase
        .from("order_items")
        .select("id, order_id, current_station_id")
        .in("id", item_ids)
        .eq("tenant_id", tenant_id);

      const { error: dispatchError } = await supabase
        .from("order_items")
        .update({
          current_station_id: null,
          station_status: "dispatched",
          station_completed_at: now,
        })
        .in("id", item_ids)
        .eq("tenant_id", tenant_id);

      if (dispatchError) throw dispatchError;

      // Insert dispatch logs into kds_station_logs
      if (itemRows && itemRows.length > 0) {
        const logs = itemRows
          .filter((r: any) => r.current_station_id)
          .map((r: any) => ({
            order_item_id: r.id,
            station_id: r.current_station_id,
            action: "dispatched",
            tenant_id,
          }));
        if (logs.length > 0) {
          await supabase.from("kds_station_logs").insert(logs);
        }

        // Trigger order completion check for each affected order
        const orderIds = [...new Set(itemRows.map((r: any) => r.order_id))];
        for (const orderId of orderIds) {
          await supabase.rpc("check_order_completion", { _order_id: orderId });
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_stations") {
      const { data: stations, error } = await supabase
        .from("kds_stations")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ stations: stations || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get station history for oven/sector views (device mode)
    if (action === "get_station_history") {
      const { station_id } = body;

      if (!station_id) {
        return new Response(
          JSON.stringify({ error: "station_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: logs, error: logsError } = await supabase
        .from("kds_station_logs")
        .select(`
          id, action, created_at, order_item_id
        `)
        .eq("station_id", station_id)
        .eq("tenant_id", tenant_id)
        .in("action", ["completed", "marked_ready", "dispatched"])
        .order("created_at", { ascending: false })
        .limit(30);

      if (logsError) throw logsError;

      // Fetch order_items details
      const itemIds = [...new Set((logs || []).map((l: any) => l.order_item_id).filter(Boolean))];
      let itemsMap: Record<string, any> = {};
      let extrasMap: Record<string, any[]> = {};
      if (itemIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("id, quantity, notes, order_id, product:products(name), variation:product_variations(name)")
          .in("id", itemIds);
        if (items) {
          itemsMap = items.reduce((acc: any, i: any) => { acc[i.id] = i; return acc; }, {});
        }

        // Fetch extras for all items
        const { data: extras } = await supabase
          .from("order_item_extras")
          .select("id, extra_name, kds_category, price, order_item_id")
          .in("order_item_id", itemIds);
        if (extras) {
          for (const ex of extras as any[]) {
            if (!extrasMap[ex.order_item_id]) extrasMap[ex.order_item_id] = [];
            extrasMap[ex.order_item_id].push(ex);
          }
        }
      }

      // Fetch orders details
      const orderIds = [...new Set(Object.values(itemsMap).map((i: any) => i.order_id).filter(Boolean))];
      let ordersMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, order_type, customer_name, customer_address, table:tables(number)")
          .in("id", orderIds);
        if (orders) {
          ordersMap = orders.reduce((acc: any, o: any) => { acc[o.id] = o; return acc; }, {});
        }
      }

      const entries = (logs || []).map((entry: any) => {
        const item = itemsMap[entry.order_item_id] || null;
        return {
          ...entry,
          order_item: item ? {
            ...item,
            extras: extrasMap[item.id] || [],
            order: item.order_id ? ordersMap[item.order_id] || null : null,
          } : null,
        };
      });

      return new Response(
        JSON.stringify({ entries }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get station history GROUPED by order (for complete order verification)
    if (action === "get_station_history_grouped") {
      const { station_id } = body;

      if (!station_id) {
        return new Response(
          JSON.stringify({ error: "station_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get logs to find which orders passed through this station
      const { data: logs, error: logsError } = await supabase
        .from("kds_station_logs")
        .select("id, action, created_at, order_item_id")
        .eq("station_id", station_id)
        .eq("tenant_id", tenant_id)
        .in("action", ["completed", "marked_ready", "dispatched"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      // Get unique order IDs via order_items
      const logItemIds = [...new Set((logs || []).map((l: any) => l.order_item_id).filter(Boolean))];
      if (logItemIds.length === 0) {
        return new Response(
          JSON.stringify({ orders: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: logItems } = await supabase
        .from("order_items")
        .select("id, order_id")
        .in("id", logItemIds);

      const orderTimestamps: Record<string, string> = {};
      const itemOrderMap: Record<string, string> = {};
      for (const li of (logItems || []) as any[]) {
        itemOrderMap[li.id] = li.order_id;
      }
      for (const log of (logs || []) as any[]) {
        const orderId = itemOrderMap[log.order_item_id];
        if (orderId && !orderTimestamps[orderId]) {
          orderTimestamps[orderId] = log.created_at;
        }
      }

      const orderIds = Object.keys(orderTimestamps);
      if (orderIds.length === 0) {
        return new Response(
          JSON.stringify({ orders: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch full order details
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, order_type, customer_name, customer_address, table:tables(number)")
        .in("id", orderIds);

      // Fetch ALL items from these orders
      const { data: allItems } = await supabase
        .from("order_items")
        .select("id, quantity, notes, order_id, product:products(name), variation:product_variations(name)")
        .in("order_id", orderIds)
        .neq("status", "cancelled");

      // Fetch extras
      const allItemIds = (allItems || []).map((i: any) => i.id);
      let extrasMap: Record<string, any[]> = {};
      if (allItemIds.length > 0) {
        const { data: extras } = await supabase
          .from("order_item_extras")
          .select("id, extra_name, kds_category, price, order_item_id")
          .in("order_item_id", allItemIds);
        for (const ex of (extras || []) as any[]) {
          if (!extrasMap[ex.order_item_id]) extrasMap[ex.order_item_id] = [];
          extrasMap[ex.order_item_id].push(ex);
        }
      }

      const ordersMap = (ordersData || []).reduce((acc: any, o: any) => { acc[o.id] = o; return acc; }, {});

      const groups = orderIds
        .map(orderId => {
          const order = ordersMap[orderId];
          if (!order) return null;
          const orderItems = (allItems || [])
            .filter((i: any) => i.order_id === orderId)
            .map((i: any) => ({
              id: i.id,
              quantity: i.quantity,
              notes: i.notes,
              product: i.product,
              variation: i.variation,
              extras: extrasMap[i.id] || [],
            }));
          return {
            orderId,
            order_type: order.order_type,
            customer_name: order.customer_name,
            customer_address: order.customer_address,
            table_number: order.table?.number || null,
            dispatched_at: orderTimestamps[orderId],
            items: orderItems,
          };
        })
        .filter(Boolean);

      groups.sort((a: any, b: any) => new Date(b.dispatched_at).getTime() - new Date(a.dispatched_at).getTime());

      return new Response(
        JSON.stringify({ orders: groups.slice(0, 20) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
