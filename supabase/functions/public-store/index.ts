import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'

const PAGE_SIZE = 1000

async function fetchAll(buildQuery: (from: number, to: number) => any): Promise<any[]> {
  let all: any[] = []
  let offset = 0
  while (true) {
    const { data } = await buildQuery(offset, offset + PAGE_SIZE - 1)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  const headers = getCorsHeaders(req)
  headers['Content-Type'] = 'application/json'

  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')
    const action = url.searchParams.get('action') || 'menu'
    const tableId = url.searchParams.get('table_id')

    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug is required' }), { status: 400, headers })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch tenant by slug
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, logo_url, phone, address, settings')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: 'Loja não encontrada' }), { status: 404, headers })
    }

    if (action === 'menu') {
      // Fetch categories
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, description, icon, sort_order')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('sort_order')

      // Fetch products with images
      const { data: products } = await supabase
        .from('products')
        .select('id, name, description, price, image_url, category_id, is_promotion, promotion_price, is_featured, label, preparation_time, sort_order')
        .eq('tenant_id', tenant.id)
        .eq('is_available', true)
        .order('sort_order')

      // Fetch variations for these products
      const productIds = products?.map(p => p.id) || []
      const { data: variations } = await supabase
        .from('product_variations')
        .select('id, product_id, name, description, price_modifier')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .in('product_id', productIds)

      // Fetch complement groups linked to products
      const productGroups = await fetchAll((from, to) =>
        supabase
          .from('product_complement_groups')
          .select('product_id, group_id, sort_order, skip_flavor_modal')
          .eq('tenant_id', tenant.id)
          .in('product_id', productIds)
          .order('sort_order')
          .range(from, to)
      )

      const groupIds = [...new Set(productGroups.map(pg => pg.group_id))]
      
      let complementGroups: any[] = []
      let groupOptions: any[] = []
      let complementOptions: any[] = []

      if (groupIds.length > 0) {
        const { data: groups } = await supabase
          .from('complement_groups')
          .select('id, name, description, selection_type, is_required, min_selections, max_selections, sort_order, price_calculation_type, channels, visibility, kds_category, applies_per_unit, unit_count, flavor_modal_enabled, flavor_modal_channels, flavor_options, applicable_flavor_counts')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .in('id', groupIds)
          .order('sort_order')
        complementGroups = groups || []

        groupOptions = await fetchAll((from, to) =>
          supabase
            .from('complement_group_options')
            .select('id, group_id, option_id, price_override, sort_order, max_quantity')
            .eq('tenant_id', tenant.id)
            .in('group_id', groupIds)
            .order('sort_order')
            .range(from, to)
        )

        // Fetch ALL active complement options for this tenant
        // Avoids .in('id', optionIds) which fails when optionIds > ~200 (URL length limit)
        complementOptions = await fetchAll((from, to) =>
          supabase
            .from('complement_options')
            .select('id, name, description, price, image_url')
            .eq('tenant_id', tenant.id)
            .eq('is_active', true)
            .range(from, to)
        )
      }

      // Fetch table info if table_id provided
      let table = null
      if (tableId) {
        const { data: t } = await supabase
          .from('tables')
          .select('id, number, capacity')
          .eq('id', tableId)
          .eq('tenant_id', tenant.id)
          .single()
        table = t
      }

      return new Response(JSON.stringify({
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, logo_url: tenant.logo_url, phone: tenant.phone, address: tenant.address },
        categories: categories || [],
        products: products || [],
        variations: variations || [],
        productGroups: productGroups || [],
        complementGroups,
        groupOptions,
        complementOptions,
        table,
      }), { headers })
    }

    if (action === 'create-order') {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
      }

      const body = await req.json()
      const { order_type, customer_name, customer_phone, customer_address, notes, items, table_id, payment_method } = body

      if (!items || items.length === 0) {
        return new Response(JSON.stringify({ error: 'Pedido deve ter pelo menos um item' }), { status: 400, headers })
      }

      // Calculate totals
      let subtotal = 0
      for (const item of items) {
        subtotal += item.unit_price * item.quantity
      }

      // Determine order type
      const finalOrderType = table_id ? 'dine_in' : (order_type || 'takeaway')

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: tenant.id,
          order_type: finalOrderType,
          customer_name: customer_name || null,
          customer_phone: customer_phone || null,
          customer_address: finalOrderType === 'delivery' ? customer_address : null,
          notes: notes || null,
          table_id: table_id || null,
          subtotal,
          total: subtotal,
          status: 'pending',
          payment_method: payment_method || null,
          payment_status: payment_method === 'online' ? 'pending' : null,
          is_draft: false,
          external_source: 'website',
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order creation error:', orderError)
        return new Response(JSON.stringify({ error: 'Erro ao criar pedido' }), { status: 500, headers })
      }

      // Create order items
      for (const item of items) {
        const { data: orderItem, error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: order.id,
            product_id: item.product_id,
            variation_id: item.variation_id || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * item.quantity,
            notes: item.notes || null,
            tenant_id: tenant.id,
          })
          .select()
          .single()

        if (itemError) {
          console.error('Item creation error:', itemError)
          continue
        }

        // Create extras/complements
        if (item.complements && item.complements.length > 0) {
          const extras = item.complements.map((c: any) => ({
            order_item_id: orderItem.id,
            extra_id: c.option_id,
            extra_name: c.option_name,
            price: c.price * (c.quantity || 1),
            tenant_id: tenant.id,
            kds_category: c.kds_category || 'complement',
          }))
          await supabase.from('order_item_extras').insert(extras)
        }
      }

      // If table order, update table status
      if (table_id) {
        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', table_id)
      }

      // Handle customer creation/update and link to order
      if (customer_phone) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id, total_orders, total_spent')
          .eq('tenant_id', tenant.id)
          .eq('phone', customer_phone)
          .single()

        let customerId: string | null = null

        if (existingCustomer) {
          customerId = existingCustomer.id
          await supabase
            .from('customers')
            .update({
              name: customer_name || existingCustomer.id,
              address: customer_address || undefined,
              total_orders: (existingCustomer.total_orders || 0) + 1,
              total_spent: (existingCustomer.total_spent || 0) + subtotal,
              last_order_at: new Date().toISOString(),
            })
            .eq('id', existingCustomer.id)
        } else if (customer_name) {
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              tenant_id: tenant.id,
              name: customer_name,
              phone: customer_phone,
              address: customer_address || null,
              total_orders: 1,
              total_spent: subtotal,
              last_order_at: new Date().toISOString(),
            })
            .select('id')
            .single()
          customerId = newCustomer?.id || null
        }

        // Link customer to order
        if (customerId) {
          await supabase
            .from('orders')
            .update({ customer_id: customerId })
            .eq('id', order.id)
        }
      }

      // Dispatch order.created webhook server-side
      try {
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/order-webhooks`;
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            order_id: order.id,
            event: 'order.created',
            tenant_id: tenant.id,
          }),
        });
      } catch (whErr) {
        console.error('[public-store] order.created webhook dispatch error:', whErr);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        order_id: order.id,
        message: 'Pedido criado com sucesso!'
      }), { headers })
    }

    if (action === 'order-status') {
      const orderId = url.searchParams.get('order_id')
      if (!orderId) {
        return new Response(JSON.stringify({ error: 'order_id is required' }), { status: 400, headers })
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, status, updated_at, order_type')
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .single()

      if (orderError || !order) {
        return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), { status: 404, headers })
      }

      return new Response(JSON.stringify({
        order_id: order.id,
        status: order.status,
        order_type: order.order_type,
        updated_at: order.updated_at,
      }), { headers })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...headers } })
  }
})
