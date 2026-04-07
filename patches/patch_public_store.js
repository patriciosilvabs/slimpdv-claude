const fs = require('fs');
let code = fs.readFileSync('/tmp/server_current.js', 'utf8');

const newEndpoint = `
// GET/POST /api/functions/public-store — public customer-facing store (replaces Supabase edge function)
app.use('/api/functions/public-store', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const slug = req.query.slug || req.body?.slug;
    const action = req.query.action || req.body?.action || 'menu';

    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const tenantRes = await pool.query(
      'SELECT id, name, slug, logo_url, phone, address FROM tenants WHERE slug = $1 AND is_active = true LIMIT 1',
      [slug]
    );
    const tenant = tenantRes.rows[0];
    if (!tenant) return res.status(404).json({ error: 'Loja não encontrada' });

    if (action === 'menu') {
      const tableId = req.query.table_id;

      const [catRes, prodRes] = await Promise.all([
        pool.query('SELECT id, name, description, icon, sort_order FROM categories WHERE tenant_id = $1 AND is_active = true ORDER BY sort_order', [tenant.id]),
        pool.query('SELECT id, name, description, price, image_url, category_id, is_promotion, promotion_price, is_featured, label, preparation_time, sort_order FROM products WHERE tenant_id = $1 AND is_available = true ORDER BY sort_order', [tenant.id]),
      ]);

      const productIds = prodRes.rows.map(p => p.id);
      let variations = [], productGroups = [], complementGroups = [], groupOptions = [], complementOptions = [];

      if (productIds.length > 0) {
        const [varRes, pgRes] = await Promise.all([
          pool.query('SELECT id, product_id, name, description, price_modifier FROM product_variations WHERE tenant_id = $1 AND is_active = true AND product_id = ANY($2)', [tenant.id, productIds]),
          pool.query('SELECT product_id, group_id, sort_order, skip_flavor_modal FROM product_complement_groups WHERE tenant_id = $1 AND product_id = ANY($2) ORDER BY sort_order', [tenant.id, productIds]),
        ]);
        variations = varRes.rows;
        productGroups = pgRes.rows;

        const groupIds = [...new Set(productGroups.map(pg => pg.group_id))];
        if (groupIds.length > 0) {
          const [cgRes, goRes, coRes] = await Promise.all([
            pool.query('SELECT id, name, description, selection_type, is_required, min_selections, max_selections, sort_order, price_calculation_type, channels, visibility, kds_category, applies_per_unit, unit_count, flavor_modal_enabled, flavor_modal_channels, flavor_options, applicable_flavor_counts FROM complement_groups WHERE tenant_id = $1 AND is_active = true AND id = ANY($2) ORDER BY sort_order', [tenant.id, groupIds]),
            pool.query('SELECT id, group_id, option_id, price_override, sort_order, max_quantity FROM complement_group_options WHERE tenant_id = $1 AND group_id = ANY($2) ORDER BY sort_order', [tenant.id, groupIds]),
            pool.query('SELECT id, name, description, price, image_url FROM complement_options WHERE tenant_id = $1 AND is_active = true', [tenant.id]),
          ]);
          complementGroups = cgRes.rows;
          groupOptions = goRes.rows;
          complementOptions = coRes.rows;
        }
      }

      let table = null;
      if (tableId) {
        const tRes = await pool.query('SELECT id, number, capacity FROM tables WHERE id = $1 AND tenant_id = $2', [tableId, tenant.id]);
        table = tRes.rows[0] || null;
      }

      return res.json({ tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, logo_url: tenant.logo_url, phone: tenant.phone, address: tenant.address }, categories: catRes.rows, products: prodRes.rows, variations, productGroups, complementGroups, groupOptions, complementOptions, table });
    }

    if (action === 'order-status') {
      const orderId = req.query.order_id;
      if (!orderId) return res.status(400).json({ error: 'order_id is required' });
      const oRes = await pool.query('SELECT id, status, updated_at, order_type FROM orders WHERE id = $1 AND tenant_id = $2', [orderId, tenant.id]);
      const order = oRes.rows[0];
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
      return res.json({ order_id: order.id, status: order.status, order_type: order.order_type, updated_at: order.updated_at });
    }

    if (action === 'create-order') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { order_type, customer_name, customer_phone, customer_address, notes, items, table_id, payment_method } = req.body;

      if (!items || items.length === 0) return res.status(400).json({ error: 'Pedido deve ter pelo menos um item' });

      const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
      const finalOrderType = table_id ? 'dine_in' : (order_type || 'takeaway');

      const orderRes = await pool.query(
        \`INSERT INTO orders (tenant_id, order_type, customer_name, customer_phone, customer_address, notes, table_id, subtotal, total, status, payment_method, payment_status, is_draft, external_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,false,'website') RETURNING *\`,
        [tenant.id, finalOrderType, customer_name||null, customer_phone||null, finalOrderType==='delivery'?customer_address:null, notes||null, table_id||null, subtotal, subtotal, payment_method||null, payment_method==='online'?'pending':null]
      );
      const order = orderRes.rows[0];

      for (const item of items) {
        const itemRes = await pool.query(
          \`INSERT INTO order_items (order_id, product_id, variation_id, quantity, unit_price, total_price, notes, tenant_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id\`,
          [order.id, item.product_id, item.variation_id||null, item.quantity, item.unit_price, item.unit_price*item.quantity, item.notes||null, tenant.id]
        );
        const orderItemId = itemRes.rows[0].id;

        if (item.complements && item.complements.length > 0) {
          const extraVals = item.complements.map(c => \`('\${order.id}','\${orderItemId}','\${c.option_id || ''}','\${(c.option_name||'').replace(/'/g,"\\\\'")}',\${c.price*(c.quantity||1)},'\${tenant.id}','\${c.kds_category||'complement'}')\`);
          if (extraVals.length > 0) {
            await pool.query(\`INSERT INTO order_item_extras (order_id, order_item_id, extra_id, extra_name, price, tenant_id, kds_category) VALUES \${extraVals.join(',')}\`).catch(e => console.error('extras insert error:', e.message));
          }
        }
      }

      if (table_id) {
        await pool.query('UPDATE tables SET status = $1 WHERE id = $2', ['occupied', table_id]).catch(() => {});
      }

      if (customer_phone) {
        const custRes = await pool.query('SELECT id, total_orders, total_spent FROM customers WHERE tenant_id = $1 AND phone = $2', [tenant.id, customer_phone]);
        if (custRes.rows.length > 0) {
          const c = custRes.rows[0];
          await pool.query('UPDATE customers SET name=$1, total_orders=$2, total_spent=$3, last_order_at=NOW() WHERE id=$4', [customer_name||c.id, (c.total_orders||0)+1, (parseFloat(c.total_spent)||0)+subtotal, c.id]);
          await pool.query('UPDATE orders SET customer_id=$1 WHERE id=$2', [c.id, order.id]);
        } else if (customer_name) {
          const newCust = await pool.query('INSERT INTO customers (tenant_id, name, phone, address, total_orders, total_spent, last_order_at) VALUES ($1,$2,$3,$4,1,$5,NOW()) RETURNING id', [tenant.id, customer_name, customer_phone, customer_address||null, subtotal]);
          await pool.query('UPDATE orders SET customer_id=$1 WHERE id=$2', [newCust.rows[0].id, order.id]);
        }
      }

      return res.json({ success: true, order_id: order.id, message: 'Pedido criado com sucesso!' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('/api/functions/public-store error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

`;

// Insert before the existing kds-data endpoint comment
const insertBefore = '// POST /api/functions/kds-data';
if (!code.includes(insertBefore)) {
  console.error('ERROR: anchor not found');
  process.exit(1);
}
code = code.replace(insertBefore, newEndpoint + insertBefore);

fs.writeFileSync('/tmp/server_patched.js', code);
console.log('public-store endpoint added:', code.includes('/api/functions/public-store'));
