const fs = require('fs');
let code = fs.readFileSync('/tmp/server_current.js', 'utf8');

const webhookEndpoint = `
// POST /api/functions/cardapioweb-webhook
app.post('/api/functions/cardapioweb-webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    const eventType = payload.event_type || payload.event || 'unknown';
    const order = payload.order || payload.data || payload;
    const merchantId = payload.merchant_id || payload.store_id || order?.merchant_id || null;

    // Find tenant by store_id or webhook_secret
    const webhookSecret = req.headers['x-webhook-secret'] || req.headers['authorization']?.replace('Bearer ', '') || null;

    let integration = null;
    if (merchantId) {
      const r = await pool.query(
        'SELECT * FROM cardapioweb_integrations WHERE store_id=$1 AND is_active=true LIMIT 1', [String(merchantId)]
      );
      integration = r.rows[0] || null;
    }
    if (!integration && webhookSecret) {
      const r = await pool.query(
        'SELECT * FROM cardapioweb_integrations WHERE webhook_secret=$1 AND is_active=true LIMIT 1', [webhookSecret]
      );
      integration = r.rows[0] || null;
    }
    if (!integration) {
      // Log unmatched webhook for debugging
      console.warn('[CardapioWeb Webhook] No integration found for merchant_id:', merchantId);
      await pool.query(
        'INSERT INTO cardapioweb_logs (tenant_id,event_type,external_order_id,payload,status,error_message) VALUES (NULL,$1,$2,$3,$4,$5)',
        [eventType, order?.id ? String(order.id) : null, JSON.stringify(payload), 'error', 'No integration found for merchant_id: ' + merchantId]
      ).catch(()=>{});
      return res.status(200).json({ received: true, processed: false, error: 'No integration found' });
    }

    const tenantId = integration.tenant_id;

    // Log receipt
    await pool.query(
      'INSERT INTO cardapioweb_logs (tenant_id,event_type,external_order_id,payload,status) VALUES ($1,$2,$3,$4,$5)',
      [tenantId, eventType, order?.id ? String(order.id) : null, JSON.stringify(payload), 'received']
    ).catch(()=>{});

    // Only process new/updated orders
    if (!order || !order.id) {
      return res.status(200).json({ received: true, processed: false, message: 'No order in payload' });
    }

    // Helper functions (same as sync-orders)
    const statusMap = { waiting_confirmation:'pending', pending_payment:'pending', pending_online_payment:'pending', scheduled_confirmed:'pending', confirmed:'preparing', ready:'ready', released:'ready', waiting_to_catch:'ready', delivered:'delivered', canceling:'cancelled', canceled:'cancelled', closed:'delivered' };
    const typeMap = { delivery:'delivery', takeout:'takeaway', onsite:'takeaway', closed_table:'table' };
    const mapStatus = s => statusMap[s] || 'pending';
    const mapType = t => typeMap[t] || 'takeaway';
    const mapPayment = r => { const n=(r||'').trim().toUpperCase(); if(!n)return null; if(n.includes('PIX'))return'pix'; if(n.includes('CREDIT'))return'credit'; if(n.includes('DEBIT'))return'debit'; if(n.includes('CASH'))return'cash'; return n.toLowerCase(); };
    const resolveSource = s => ((s||'').toUpperCase().includes('IFOOD') ? 'ifood' : 'cardapioweb');
    const fmtAddr = a => { if(!a)return''; const p=[a.street,a.number,a.neighborhood,a.complement,a.city,a.state].filter(Boolean).join(', '); return a.reference?p+' (Ref: '+a.reference+')':p; };

    // Check if order already exists
    const existRes = await pool.query(
      "SELECT id, status FROM orders WHERE external_source IN ('cardapioweb','ifood') AND external_order_id=$1 AND tenant_id=$2 LIMIT 1",
      [String(order.id), tenantId]
    );

    if (existRes.rows.length > 0) {
      // Order exists — update status if needed
      const existingOrder = existRes.rows[0];
      const newStatus = mapStatus(order.status);
      if (eventType.includes('cancel') || order.status === 'canceled' || order.status === 'canceling') {
        await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1 AND tenant_id=$2", [existingOrder.id, tenantId]);
      } else if (newStatus !== existingOrder.status) {
        await pool.query("UPDATE orders SET status=$1 WHERE id=$2 AND tenant_id=$3", [newStatus, existingOrder.id, tenantId]);
      }
      await pool.query(
        'UPDATE cardapioweb_logs SET status=$1 WHERE tenant_id=$2 AND external_order_id=$3 AND status=$4',
        ['updated', tenantId, String(order.id), 'received']
      ).catch(()=>{});
      return res.status(200).json({ received: true, processed: true, action: 'updated', order_id: existingOrder.id });
    }

    // New order — insert it (same logic as sync-orders)
    const items = order.items || [];
    const payments = order.payments || [];
    const payment = payments[0];
    const isOnline = (payment?.payment_type||'').toUpperCase()==='ONLINE';
    const isPaid = ['AUTHORIZED','PAID','APPROVED'].includes((payment?.status||'').toUpperCase());
    const holdForPayment = isOnline && !isPaid;
    const resolvedPaymentStatus = isPaid ? 'paid' : (holdForPayment ? 'pending_online' : 'pending');
    const allMethods = payments.length > 1 ? payments.map(p=>mapPayment(p.payment_method)).filter(Boolean).join(', ') : mapPayment(payment?.payment_method);
    const changeFor = payments.find(p=>p.change_for!=null)?.change_for ?? null;
    const subtotal = items.reduce((s,i)=>s+i.total_price, 0);
    const baseStatus = mapStatus(order.status);
    const orderStatus = holdForPayment ? 'pending' : (integration.auto_accept && baseStatus==='pending') ? 'preparing' : baseStatus;
    let notes = order.observation || '';
    if (order.delivery_address?.reference) notes = notes ? notes+' | Ref: '+order.delivery_address.reference : 'Ref: '+order.delivery_address.reference;

    const newOrderRes = await pool.query(
      \`INSERT INTO orders (tenant_id,order_type,status,customer_name,customer_phone,customer_address,notes,subtotal,total,discount,external_source,external_order_id,external_display_id,delivery_fee,service_fee,additional_fee,change_for,fiscal_document,external_customer_id,delivery_lat,delivery_lng,external_raw_payload,payment_method,payment_status,scheduled_for,is_draft,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING *\`,
      [tenantId, mapType(order.order_type), orderStatus, order.customer?.name||null, order.customer?.phone||null,
       order.delivery_address ? fmtAddr(order.delivery_address) : null, notes, subtotal, order.total,
       resolveSource(order.sales_channel), String(order.id), order.display_id!=null?String(order.display_id):null,
       order.delivery_fee||0, order.service_fee||0, order.additional_fee||0, changeFor, order.fiscal_document||null,
       order.customer?.id?String(order.customer.id):null,
       order.delivery_address?.latitude?parseFloat(order.delivery_address.latitude):null,
       order.delivery_address?.longitude?parseFloat(order.delivery_address.longitude):null,
       JSON.stringify(order), allMethods, resolvedPaymentStatus, order.schedule?.scheduled_date_time_start||null,
       holdForPayment, order.created_at || new Date().toISOString()]
    );
    const newOrder = newOrderRes.rows[0];

    const mappingsRes = await pool.query('SELECT * FROM cardapioweb_product_mappings WHERE tenant_id=$1', [tenantId]);
    const mappingMap = new Map(mappingsRes.rows.map(m => [m.cardapioweb_item_id, m]));
    const compOptRes = await pool.query('SELECT id, name, external_code FROM complement_options WHERE tenant_id=$1 AND is_active=true', [tenantId]);
    const compGrpRes = await pool.query('SELECT name, kds_category FROM complement_groups WHERE tenant_id=$1', [tenantId]);

    for (const item of items) {
      const mapping = mappingMap.get(item.item_id);
      const optTotal = (item.options||[]).reduce((s,o)=>s+(o.unit_price*o.quantity),0);
      const unitPrice = item.unit_price + optTotal;
      const itemRes = await pool.query(
        \`INSERT INTO order_items (tenant_id,order_id,product_id,variation_id,quantity,unit_price,total_price,notes,status,external_item_id,external_code,item_kind)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id\`,
        [tenantId, newOrder.id, mapping?.local_product_id||null, mapping?.local_variation_id||null,
         item.quantity, unitPrice, item.total_price, item.observation||null,
         mapStatus(order.status)==='delivered'?'delivered':'pending',
         String(item.order_item_id), item.external_code||null, item.kind||null]
      ).catch(()=>null);
      if (!itemRes) continue;
      const orderItemId = itemRes.rows[0].id;

      for (const opt of (item.options||[])) {
        const gn = opt.option_group_name || '';
        const gnl = gn.toLowerCase();
        let matchedOpt = compOptRes.rows.find(co => opt.external_code && co.external_code === opt.external_code);
        if (!matchedOpt) matchedOpt = compOptRes.rows.find(co => co.name.trim().toLowerCase() === opt.name.trim().toLowerCase());
        const matchedGrp = gn ? compGrpRes.rows.find(g => g.name.toLowerCase() === gnl) : null;
        const extraName = gn ? gn+': '+opt.name : opt.name;
        let kdsCategory = matchedGrp?.kds_category || 'complement';
        if (kdsCategory === 'complement') { if (gnl.includes('sabor')) kdsCategory='flavor'; else if (/^\d+\/\d+\s/.test(opt.name||'')) kdsCategory='flavor'; }
        await pool.query(
          'INSERT INTO order_item_extras (tenant_id,order_item_id,extra_name,extra_id,price,quantity,external_option_id,external_group_id,kds_category) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [tenantId, orderItemId, extraName, matchedOpt?.id||null, opt.unit_price*opt.quantity, opt.quantity, String(opt.option_id), String(opt.option_group_id), kdsCategory]
        ).catch(()=>{});
      }

      if (!mapping) {
        await pool.query(
          'INSERT INTO cardapioweb_product_mappings (tenant_id,cardapioweb_item_id,cardapioweb_item_name) VALUES ($1,$2,$3) ON CONFLICT (tenant_id,cardapioweb_item_id) DO NOTHING',
          [tenantId, item.item_id, item.name]
        ).catch(()=>{});
      }
    }

    await pool.query(
      'UPDATE cardapioweb_logs SET status=$1 WHERE tenant_id=$2 AND external_order_id=$3 AND status=$4',
      ['success', tenantId, String(order.id), 'received']
    ).catch(()=>{});

    console.log('[CardapioWeb Webhook] New order imported:', newOrder.id, 'external:', order.id);
    return res.status(200).json({ received: true, processed: true, action: 'created', order_id: newOrder.id });

  } catch (err) {
    console.error('[CardapioWeb Webhook] Error:', err.message);
    return res.status(200).json({ received: true, processed: false, error: err.message });
  }
});

`;

const anchor = '// POST /api/functions/cardapioweb-test-connection';
if (!code.includes(anchor)) { console.error('anchor not found'); process.exit(1); }
code = code.replace(anchor, webhookEndpoint + anchor);

fs.writeFileSync('/tmp/server_patched.js', code);
console.log('cardapioweb-webhook added:', code.includes('/api/functions/cardapioweb-webhook'));
