import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const CARDAPIOWEB_API_URL = 'https://integracao.cardapioweb.com/api/partner/v1';

/**
 * Reconciliation job: every 5 minutes, fetches recent orders from CW API
 * and imports any that were missed by the webhook.
 */

function resolveExternalSource(salesChannel: string): string {
  return (salesChannel || '').toUpperCase().includes('IFOOD') ? 'ifood' : 'cardapioweb';
}

function mapStatus(cwStatus: string): string {
  const m: Record<string, string> = {
    waiting_confirmation: 'pending', pending_payment: 'pending', pending_online_payment: 'pending',
    scheduled_confirmed: 'pending', confirmed: 'preparing', ready: 'ready', released: 'ready',
    waiting_to_catch: 'ready', delivered: 'delivered', canceling: 'cancelled', canceled: 'cancelled',
    closed: 'delivered',
  };
  return m[cwStatus] || 'pending';
}

function mapOrderType(cwType: string): string {
  const m: Record<string, string> = { delivery: 'delivery', takeout: 'takeaway', onsite: 'takeaway', closed_table: 'table' };
  return m[cwType] || 'takeaway';
}

function formatAddress(addr: { street: string; number: string | null; neighborhood: string; complement: string | null; city: string; state: string } | null): string {
  if (!addr) return '';
  return [addr.street, addr.number, addr.neighborhood, addr.complement, addr.city, addr.state].filter(Boolean).join(', ');
}

function mapPaymentMethod(raw: string | null | undefined): string | null {
  const n = (raw || '').trim().toUpperCase();
  if (!n) return null;
  if (n.includes('PIX')) return 'pix';
  if (n.includes('CREDIT')) return 'credit';
  if (n.includes('DEBIT')) return 'debit';
  if (n.includes('CASH')) return 'cash';
  if (n.includes('VOUCHER') || n.includes('VALE')) return 'voucher';
  return n.toLowerCase();
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Fetch all active integrations
    const { data: integrations, error: intErr } = await supabase
      .from('cardapioweb_integrations')
      .select('*')
      .eq('is_active', true);

    if (intErr) throw intErr;
    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No active integrations' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalImported = 0;
    let totalSkipped = 0;

    for (const integration of integrations) {
      try {
        // Fetch orders from last 2 hours
        const startDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });

        const resp = await fetch(`${CARDAPIOWEB_API_URL}/orders?${params}`, {
          headers: { 'X-API-KEY': integration.api_token, Accept: 'application/json' },
        });

        if (!resp.ok) {
          console.error(`[Reconcile] API error for tenant ${integration.tenant_id}: ${resp.status}`);
          continue;
        }

        const data = await resp.json();
        // deno-lint-ignore no-explicit-any
        const orders: any[] = Array.isArray(data) ? data : (data.orders || data.data || []);

        // Fetch complement data in parallel
        const [mappingsRes, groupsRes, optionsRes] = await Promise.all([
          supabase.from('cardapioweb_product_mappings').select('*').eq('tenant_id', integration.tenant_id),
          supabase.from('complement_groups').select('name, kds_category').eq('tenant_id', integration.tenant_id),
          supabase.from('complement_options').select('id, name, external_code, ifood_code').eq('tenant_id', integration.tenant_id).eq('is_active', true),
        ]);

        // deno-lint-ignore no-explicit-any
        const mappingMap = new Map((mappingsRes.data || []).map((m: any) => [m.cardapioweb_item_id, m]));
        const complementGroups = groupsRes.data || [];
        const complementOptions = optionsRes.data || [];

        for (const order of orders) {
          // Only delivery
          if (order.order_type !== 'delivery') { totalSkipped++; continue; }

          // Check if exists
          const { data: existing } = await supabase
            .from('orders')
            .select('id, total, external_raw_payload')
            .in('external_source', ['cardapioweb', 'ifood'])
            .eq('external_order_id', String(order.id))
            .eq('tenant_id', integration.tenant_id)
            .maybeSingle();

          if (existing) {
            // Repair: if existing order has empty data, update it
            const needsRepair = existing.total === 0 || existing.total === null || !existing.external_raw_payload;
            if (needsRepair && (order.items || []).length > 0 && order.total > 0) {
              console.log(`[Reconcile] Repairing incomplete order ${order.id}...`);
              const subtotal = (order.items || []).reduce((s: number, i: { total_price: number }) => s + i.total_price, 0);
              const payment = (order.payments || [])[0];
              const isPaid = ['AUTHORIZED', 'PAID', 'APPROVED'].includes((payment?.status || '').toUpperCase());
              const isOnline = (payment?.payment_type || '').toUpperCase() === 'ONLINE';
              const paymentStatus = isPaid ? 'paid' : (isOnline && !isPaid ? 'pending_online' : 'pending');

              // Build notes with reference point
              let repairNotes = order.observation || '';
              if (order.delivery_address?.reference) {
                repairNotes = repairNotes ? `${repairNotes} | Ref: ${order.delivery_address.reference}` : `Ref: ${order.delivery_address.reference}`;
              }

              await supabase.from('orders').update({
                customer_name: order.customer?.name || null,
                customer_phone: order.customer?.phone || null,
                customer_address: order.delivery_address ? formatAddress(order.delivery_address) : null,
                notes: repairNotes,
                subtotal,
                total: order.total,
                delivery_fee: order.delivery_fee || 0,
                service_fee: order.service_fee || 0,
                additional_fee: order.additional_fee || 0,
                change_for: (order.payments || []).find((p: any) => p.change_for != null)?.change_for ?? null,
                fiscal_document: order.fiscal_document || null,
                external_customer_id: order.customer?.id ? String(order.customer.id) : null,
                delivery_lat: order.delivery_address?.latitude ? parseFloat(order.delivery_address.latitude) : null,
                delivery_lng: order.delivery_address?.longitude ? parseFloat(order.delivery_address.longitude) : null,
                external_raw_payload: order,
                external_display_id: order.display_id != null ? String(order.display_id) : null,
                payment_method: mapPaymentMethod(payment?.payment_method),
                payment_status: paymentStatus,
              }).eq('id', existing.id);

              // Also create items if missing
              const { data: existingItems } = await supabase.from('order_items').select('id').eq('order_id', existing.id).limit(1);
              if (!existingItems || existingItems.length === 0) {
                const orderSource = resolveExternalSource(order.sales_channel);
                for (const item of (order.items || [])) {
                  const mapping = mappingMap.get(item.item_id) as any;
                  const optionsTotal = (item.options || []).reduce((s: number, o: { unit_price: number; quantity: number }) => s + o.unit_price * o.quantity, 0);
                  const { data: orderItem } = await supabase.from('order_items').insert({
                    tenant_id: integration.tenant_id, order_id: existing.id,
                    product_id: mapping?.local_product_id || null, variation_id: mapping?.local_variation_id || null,
                    product_name: item.name || null, quantity: item.quantity,
                    unit_price: item.unit_price + optionsTotal, total_price: item.total_price,
                    notes: item.observation, status: 'pending',
                  }).select().single();
                  if (orderItem && (item.options || []).length > 0) {
                    const extras = item.options.map((opt: any) => {
                      const groupName = opt.option_group_name || '';
                      const groupNameLower = groupName.toLowerCase();
                      const matchedGroup = groupName ? complementGroups.find((g: { name: string }) => g.name.toLowerCase() === groupNameLower) : null;
                      let matchedOption = null;
                      const optCode = opt.external_code || '';
                      if (optCode) {
                        if (orderSource === 'ifood') matchedOption = complementOptions.find((co: { ifood_code: string | null }) => co.ifood_code && co.ifood_code === optCode);
                        if (!matchedOption) matchedOption = complementOptions.find((co: { external_code: string | null }) => co.external_code && co.external_code === optCode);
                      }
                      if (!matchedOption) matchedOption = complementOptions.find((co: { name: string }) => co.name.trim().toLowerCase() === (opt.name || '').trim().toLowerCase());
                      const extraName = groupName ? `${groupName}: ${opt.name}` : opt.name;
                      const inferCategory = (): string => {
                        const resolved = matchedGroup?.kds_category || 'complement';
                        if (resolved !== 'complement') return resolved;
                        if (groupNameLower.includes('sabor')) return 'flavor';
                        if (/^\d+\/\d+\s/.test(opt.name || '')) return 'flavor';
                        return 'complement';
                      };
                      return { tenant_id: integration.tenant_id, order_item_id: orderItem.id, extra_name: extraName, extra_id: matchedOption?.id || null, price: opt.unit_price * opt.quantity, kds_category: inferCategory() };
                    });
                    await supabase.from('order_item_extras').insert(extras);
                  }
                  if (!mapping) {
                    await supabase.from('cardapioweb_product_mappings').upsert({ tenant_id: integration.tenant_id, cardapioweb_item_id: item.item_id, cardapioweb_item_name: item.name }, { onConflict: 'tenant_id,cardapioweb_item_id' });
                  }
                }
              }
              totalImported++;
              continue;
            }
            totalSkipped++; continue;
          }

          // Import the order
          const subtotal = (order.items || []).reduce((s: number, i: { total_price: number }) => s + i.total_price, 0);
          const payment = (order.payments || [])[0];
          const rawType = (payment?.payment_type || '').toUpperCase();
          const rawStatus = (payment?.status || '').toUpperCase();
          const isOnline = rawType === 'ONLINE';
          const isPaid = ['AUTHORIZED', 'PAID', 'APPROVED'].includes(rawStatus);

          const baseStatus = mapStatus(order.status);
          let orderStatus: string;
          if (isOnline && !isPaid) orderStatus = 'pending';
          else if (integration.auto_accept && baseStatus === 'pending') orderStatus = 'preparing';
          else orderStatus = baseStatus;

          const paymentStatus = isPaid ? 'paid' : (isOnline && !isPaid ? 'pending_online' : 'pending');

          // Build notes with reference point
          let notes = order.observation || '';
          if (order.delivery_address?.reference) {
            notes = notes ? `${notes} | Ref: ${order.delivery_address.reference}` : `Ref: ${order.delivery_address.reference}`;
          }

          const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
              tenant_id: integration.tenant_id,
              order_type: mapOrderType(order.order_type),
              status: orderStatus,
              customer_name: order.customer?.name || null,
              customer_phone: order.customer?.phone || null,
              customer_address: order.delivery_address ? formatAddress(order.delivery_address) : null,
              notes,
              subtotal,
              total: order.total,
              discount: 0,
              external_source: resolveExternalSource(order.sales_channel),
              external_order_id: String(order.id),
              external_display_id: order.display_id != null ? String(order.display_id) : null,
              delivery_fee: order.delivery_fee || 0,
              service_fee: order.service_fee || 0,
              additional_fee: order.additional_fee || 0,
              change_for: (order.payments || []).find((p: any) => p.change_for != null)?.change_for ?? null,
              fiscal_document: order.fiscal_document || null,
              external_customer_id: order.customer?.id ? String(order.customer.id) : null,
              delivery_lat: order.delivery_address?.latitude ? parseFloat(order.delivery_address.latitude) : null,
              delivery_lng: order.delivery_address?.longitude ? parseFloat(order.delivery_address.longitude) : null,
              external_raw_payload: order,
              payment_method: mapPaymentMethod(payment?.payment_method),
              payment_status: paymentStatus,
              scheduled_for: order.schedule?.scheduled_date_time_start || null,
              is_draft: false,
              created_at: order.created_at,
            })
            .select()
            .single();

          if (orderError) {
            if (orderError.code === '23505') { totalSkipped++; continue; }
            console.error('[Reconcile] Order error:', orderError);
            continue;
          }

          // Create items
          const orderSource = resolveExternalSource(order.sales_channel);
          for (const item of (order.items || [])) {
            // deno-lint-ignore no-explicit-any
            const mapping = mappingMap.get(item.item_id) as any;
            const optionsTotal = (item.options || []).reduce((s: number, o: { unit_price: number; quantity: number }) => s + o.unit_price * o.quantity, 0);

            const { data: orderItem, error: itemErr } = await supabase
              .from('order_items')
              .insert({
                tenant_id: integration.tenant_id,
                order_id: newOrder.id,
                product_id: mapping?.local_product_id || null,
                variation_id: mapping?.local_variation_id || null,
                product_name: item.name || null,
                quantity: item.quantity,
                unit_price: item.unit_price + optionsTotal,
                total_price: item.total_price,
                notes: item.observation,
                status: mapStatus(order.status) === 'delivered' ? 'delivered' : 'pending',
              })
              .select()
              .single();

            if (itemErr || !orderItem) continue;

            if ((item.options || []).length > 0) {
              // deno-lint-ignore no-explicit-any
              const extras = item.options.map((opt: any) => {
                const groupName = opt.option_group_name || '';
                const groupNameLower = groupName.toLowerCase();
                const matchedGroup = groupName ? complementGroups.find((g: { name: string }) => g.name.toLowerCase() === groupNameLower) : null;
                let matchedOption = null;
                const optCode = opt.external_code || '';
                if (optCode) {
                  if (orderSource === 'ifood') matchedOption = complementOptions.find((co: { ifood_code: string | null }) => co.ifood_code && co.ifood_code === optCode);
                  if (!matchedOption) matchedOption = complementOptions.find((co: { external_code: string | null }) => co.external_code && co.external_code === optCode);
                }
                if (!matchedOption) matchedOption = complementOptions.find((co: { name: string }) => co.name.trim().toLowerCase() === (opt.name || '').trim().toLowerCase());
                const extraName = groupName ? `${groupName}: ${opt.name}` : opt.name;
                const inferCategory = (): string => {
                  const resolved = matchedGroup?.kds_category || 'complement';
                  if (resolved !== 'complement') return resolved;
                  if (groupNameLower.includes('sabor')) return 'flavor';
                  if (/^\d+\/\d+\s/.test(opt.name || '')) return 'flavor';
                  return 'complement';
                };
                return {
                  tenant_id: integration.tenant_id,
                  order_item_id: orderItem.id,
                  extra_name: extraName,
                  extra_id: matchedOption?.id || null,
                  price: opt.unit_price * opt.quantity,
                  kds_category: inferCategory(),
                };
              });
              await supabase.from('order_item_extras').insert(extras);
            }

            if (!mapping) {
              await supabase.from('cardapioweb_product_mappings').upsert({
                tenant_id: integration.tenant_id,
                cardapioweb_item_id: item.item_id,
                cardapioweb_item_name: item.name,
              }, { onConflict: 'tenant_id,cardapioweb_item_id' });
            }
          }

          totalImported++;
          console.log(`[Reconcile] Imported missing order ${order.id} -> ${newOrder.id}`);
        }

        // Update last_sync_at
        await supabase
          .from('cardapioweb_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', integration.id);

      } catch (err) {
        console.error(`[Reconcile] Error for tenant ${integration.tenant_id}:`, err);
      }
    }

    // Log
    await supabase.from('cardapioweb_logs').insert({
      event_type: 'RECONCILIATION',
      payload: { imported: totalImported, skipped: totalSkipped },
      status: 'success',
    });

    console.log(`[Reconcile] Done: ${totalImported} imported, ${totalSkipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, imported: totalImported, skipped: totalSkipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[Reconcile] Fatal:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
