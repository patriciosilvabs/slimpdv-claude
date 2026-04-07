const fs = require('fs');
// Read from server_patched.js if it exists (preserves previous patches in chain)
let code = fs.readFileSync(fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js', 'utf8');

const allEndpoints = `
// POST /api/functions/cardapioweb-webhook
app.post('/api/functions/cardapioweb-webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    // CardapioWeb sends a notification: { event_type, order_id, merchant_id, order_status, ... }
    const eventType = payload.event_type || payload.event || 'unknown';
    const externalOrderId = payload.order_id ? String(payload.order_id) : null;
    const merchantId = payload.merchant_id ? String(payload.merchant_id) : null;
    const orderStatus = payload.order_status || null;

    // Find integration by merchant_id (store_id)
    let integration = null;
    if (merchantId) {
      const r = await pool.query('SELECT * FROM cardapioweb_integrations WHERE store_id=$1 AND is_active=true LIMIT 1', [merchantId]);
      integration = r.rows[0] || null;
    }
    if (!integration) {
      const webhookSecret = req.headers['x-webhook-secret'] || null;
      if (webhookSecret) {
        const r = await pool.query('SELECT * FROM cardapioweb_integrations WHERE webhook_secret=$1 AND is_active=true LIMIT 1', [webhookSecret]);
        integration = r.rows[0] || null;
      }
    }
    if (!integration) {
      console.warn('[CardapioWeb Webhook] No integration found for merchant_id:', merchantId);
      await pool.query('INSERT INTO cardapioweb_logs (tenant_id,event_type,external_order_id,payload,status,error_message) VALUES (NULL,$1,$2,$3,$4,$5)',
        [eventType, externalOrderId, JSON.stringify(payload), 'error', 'No integration found for merchant_id: ' + merchantId]).catch(()=>{});
      return res.status(200).json({ received: true, processed: false, error: 'No integration found' });
    }

    const tenantId = integration.tenant_id;
    // Log webhook receipt immediately so CardapioWeb knows we received it
    await pool.query('INSERT INTO cardapioweb_logs (tenant_id,event_type,external_order_id,payload,status) VALUES ($1,$2,$3,$4,$5)',
      [tenantId, eventType, externalOrderId, JSON.stringify(payload), 'received']).catch(()=>{});

    // Respond immediately so CardapioWeb doesn't timeout
    res.status(200).json({ received: true });

    // Process asynchronously after response
    if (!externalOrderId) return;

    // Handle cancellation
    if (eventType === 'ORDER_STATUS_UPDATED' && (orderStatus === 'canceled' || orderStatus === 'canceling')) {
      await pool.query("UPDATE orders SET status='cancelled' WHERE external_order_id=$1 AND tenant_id=$2 AND external_source='cardapioweb'",
        [externalOrderId, tenantId]).catch(()=>{});
      return;
    }

    // Check if order already exists
    const existRes = await pool.query("SELECT id, status FROM orders WHERE external_source IN ('cardapioweb','ifood') AND external_order_id=$1 AND tenant_id=$2 LIMIT 1",
      [externalOrderId, tenantId]);
    if (existRes.rows.length > 0) {
      // Already imported — just update status if needed
      const statusMap = { waiting_confirmation:'pending', pending_payment:'pending', pending_online_payment:'pending', scheduled_confirmed:'pending', confirmed:'preparing', ready:'ready', released:'ready', waiting_to_catch:'ready', delivered:'delivered', canceling:'cancelled', canceled:'cancelled', closed:'delivered' };
      const mapStatus = s => statusMap[s] || 'pending';
      const newStatus = mapStatus(orderStatus);
      if (newStatus && newStatus !== existRes.rows[0].status) {
        await pool.query("UPDATE orders SET status=$1 WHERE id=$2", [newStatus, existRes.rows[0].id]).catch(()=>{});
      }
      return;
    }

    // Fetch full order from CardapioWeb API
    const orderResp = await fetch('https://integracao.cardapioweb.com/api/partner/v1/orders/' + externalOrderId, {
      headers: { 'X-API-KEY': integration.api_token, 'Accept': 'application/json' }
    });
    if (!orderResp.ok) {
      console.error('[CardapioWeb Webhook] Failed to fetch order', externalOrderId, orderResp.status);
      return;
    }
    const order = await orderResp.json();

    const statusMap = { waiting_confirmation:'pending', pending_payment:'pending', pending_online_payment:'pending', scheduled_confirmed:'pending', confirmed:'preparing', ready:'ready', released:'ready', waiting_to_catch:'ready', delivered:'delivered', canceling:'cancelled', canceled:'cancelled', closed:'delivered' };
    const typeMap = { delivery:'delivery', takeout:'takeaway', onsite:'takeaway', closed_table:'table' };
    const mapStatus = s => statusMap[s] || 'pending';
    const mapType = t => typeMap[t] || 'takeaway';
    const mapPayment = r => { const n=(r||'').trim().toUpperCase(); if(!n)return null; if(n.includes('PIX'))return'pix'; if(n.includes('CREDIT'))return'credit'; if(n.includes('DEBIT'))return'debit'; if(n.includes('CASH'))return'cash'; return n.toLowerCase(); };
    const resolveSource = s => ((s||'').toUpperCase().includes('IFOOD') ? 'ifood' : 'cardapioweb');
    const fmtAddr = a => { if(!a)return''; const p=[a.street,a.number,a.neighborhood,a.complement,a.city,a.state].filter(Boolean).join(', '); return a.reference?p+' (Ref: '+a.reference+')':p; };

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
    // For ORDER_CREATED: always import as pending/preparing — never as cancelled.
    // Status updates (cancellation etc) arrive via ORDER_STATUS_UPDATED webhooks separately.
    const orderStatusFinal = holdForPayment ? 'pending' : (integration.auto_accept ? 'preparing' : 'pending');
    let notes = order.observation || '';
    if (order.delivery_address?.reference) notes = notes ? notes+' | Ref: '+order.delivery_address.reference : 'Ref: '+order.delivery_address.reference;

    const newOrderRes = await pool.query(
      \`INSERT INTO orders (tenant_id,order_type,status,customer_name,customer_phone,customer_address,notes,subtotal,total,discount,external_source,external_order_id,external_display_id,service_fee,additional_fee,change_for,fiscal_document,external_customer_id,delivery_lat,delivery_lng,external_raw_payload,payment_method,payment_status,scheduled_for,is_draft,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *\`,
      [tenantId, mapType(order.order_type), orderStatusFinal, order.customer?.name||null, order.customer?.phone||null,
       order.delivery_address ? fmtAddr(order.delivery_address) : null, notes, subtotal, order.total,
       resolveSource(order.sales_channel), String(order.id), order.display_id!=null?String(order.display_id):null,
       order.service_fee||0, order.additional_fee||0, changeFor, order.fiscal_document||null,
       order.customer?.id?String(order.customer.id):null,
       order.delivery_address?.latitude?parseFloat(order.delivery_address.latitude):null,
       order.delivery_address?.longitude?parseFloat(order.delivery_address.longitude):null,
       JSON.stringify(order), allMethods, resolvedPaymentStatus, order.schedule?.scheduled_date_time_start||null,
       holdForPayment, order.created_at || new Date().toISOString()]
    );
    const newOrder = newOrderRes.rows[0];

    const mappingsRes = await pool.query('SELECT * FROM cardapioweb_product_mappings WHERE tenant_id=$1', [tenantId]);
    const mappingMap = new Map(mappingsRes.rows.map(m => [m.cardapioweb_item_id, m]));
    // Also load products/variations by cardapioweb_code for auto-recognition
    const productsByCodeRes = await pool.query('SELECT id, cardapioweb_code FROM products WHERE tenant_id=$1 AND cardapioweb_code IS NOT NULL', [tenantId]);
    const productsByCode = new Map(productsByCodeRes.rows.map(p => [p.cardapioweb_code, p.id]));
    const variationsByCodeRes = await pool.query('SELECT pv.id, pv.cardapioweb_code, pv.product_id FROM product_variations pv JOIN products p ON p.id=pv.product_id WHERE p.tenant_id=$1 AND pv.cardapioweb_code IS NOT NULL', [tenantId]);
    const variationsByCode = new Map(variationsByCodeRes.rows.map(v => [v.cardapioweb_code, v]));

    const compOptRes = await pool.query('SELECT id, name, external_code FROM complement_options WHERE tenant_id=$1 AND is_active=true', [tenantId]);
    const compOptByCode = new Map(compOptRes.rows.filter(o => o.external_code).map(o => [o.external_code, o]));
    const compGrpRes = await pool.query('SELECT id, name, kds_category FROM complement_groups WHERE tenant_id=$1', [tenantId]);
    const optMappingsRes = await pool.query('SELECT cardapioweb_option_id, local_option_id FROM cardapioweb_option_mappings WHERE tenant_id=$1 AND local_option_id IS NOT NULL', [tenantId]);
    const optMappingMap = new Map(optMappingsRes.rows.map(m => [m.cardapioweb_option_id, m.local_option_id]));
    const grpMappingsRes = await pool.query('SELECT cardapioweb_group_id, local_group_id, kds_category FROM cardapioweb_group_mappings WHERE tenant_id=$1', [tenantId]);
    const grpMappingMap = new Map(grpMappingsRes.rows.map(m => [m.cardapioweb_group_id, m]));

    for (const item of items) {
      // Resolve product: 1) by cardapioweb_code on product, 2) by mapping table
      const itemCode = String(item.item_id);
      let resolvedProductId = productsByCode.get(itemCode) || null;
      let resolvedVariationId = null;
      const varByCode = variationsByCode.get(itemCode);
      if (varByCode) { resolvedProductId = varByCode.product_id; resolvedVariationId = varByCode.id; }
      const mapping = mappingMap.get(item.item_id);
      if (!resolvedProductId && mapping?.local_product_id) resolvedProductId = mapping.local_product_id;
      if (!resolvedVariationId && mapping?.local_variation_id) resolvedVariationId = mapping.local_variation_id;
      const optTotal = (item.options||[]).reduce((s,o)=>s+(o.unit_price*o.quantity),0);
      const unitPrice = item.unit_price + optTotal;
      const itemRes = await pool.query(
        \`INSERT INTO order_items (tenant_id,order_id,product_id,variation_id,quantity,unit_price,total_price,notes,status,external_item_id,external_code,item_kind)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id\`,
        [tenantId, newOrder.id, resolvedProductId, resolvedVariationId,
         item.quantity, unitPrice, item.total_price, item.observation||null,
         mapStatus(order.status)==='delivered'?'delivered':'pending',
         String(item.order_item_id), item.external_code||null, item.kind||null]
      ).catch(()=>null);
      if (!itemRes) continue;
      const orderItemId = itemRes.rows[0].id;
      for (const opt of (item.options||[])) {
        const gn = opt.option_group_name || '';
        const gnl = gn.toLowerCase();
        const optCode = String(opt.option_id);
        // Resolve option: 1) by option_mapping table, 2) by external_code on complement_options, 3) by name
        let matchedOpt = null;
        const mappedOptId = optMappingMap.get(opt.option_id);
        if (mappedOptId) matchedOpt = compOptRes.rows.find(co => co.id === mappedOptId);
        if (!matchedOpt) matchedOpt = compOptByCode.get(optCode) || null;
        if (!matchedOpt && opt.external_code) matchedOpt = compOptByCode.get(opt.external_code) || null;
        if (!matchedOpt) matchedOpt = compOptRes.rows.find(co => co.name.trim().toLowerCase() === opt.name.trim().toLowerCase());
        // kds_category: 1) group mapping table, 2) local group by name, 3) infer from name
        const grpMapping = opt.option_group_id ? grpMappingMap.get(opt.option_group_id) : null;
        const matchedGrp = gn ? compGrpRes.rows.find(g => g.name.toLowerCase() === gnl) : null;
        const extraName = gn ? gn+': '+opt.name : opt.name;
        let kdsCategory = grpMapping?.kds_category || matchedGrp?.kds_category || 'complement';
        if (kdsCategory === 'complement') {
          const on = (opt.name||'').trim();
          if (gnl.includes('sabor') || gnl.includes('flavor')) kdsCategory='flavor';
          else if (/^\d+\/\d+\s/.test(on)) kdsCategory='flavor';
          else if (/\([GgMmPp]\)$/.test(on) && !gnl.includes('massa') && !gnl.includes('borda')) kdsCategory='flavor';
        }
        await pool.query('INSERT INTO order_item_extras (tenant_id,order_item_id,extra_name,extra_id,price,quantity,external_option_id,external_group_id,kds_category) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [tenantId, orderItemId, extraName, matchedOpt?.id||null, opt.unit_price*opt.quantity, opt.quantity, String(opt.option_id), String(opt.option_group_id), kdsCategory]).catch(()=>{});
        // Auto-register option mapping
        await pool.query(
          'INSERT INTO cardapioweb_option_mappings (tenant_id,cardapioweb_option_id,cardapioweb_option_name,cardapioweb_group_id,cardapioweb_group_name,local_option_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id,cardapioweb_option_id) DO UPDATE SET cardapioweb_option_name=EXCLUDED.cardapioweb_option_name, cardapioweb_group_name=EXCLUDED.cardapioweb_group_name',
          [tenantId, opt.option_id, opt.name, opt.option_group_id||null, gn||null, matchedOpt?.id||null]
        ).catch(()=>{});
        // Auto-register group mapping
        if (opt.option_group_id) {
          await pool.query(
            'INSERT INTO cardapioweb_group_mappings (tenant_id,cardapioweb_group_id,cardapioweb_group_name,local_group_id,kds_category) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,cardapioweb_group_id) DO UPDATE SET cardapioweb_group_name=EXCLUDED.cardapioweb_group_name',
            [tenantId, opt.option_group_id, gn||'Grupo '+opt.option_group_id, matchedGrp?.id||null, matchedGrp?.kds_category||null]
          ).catch(()=>{});
        }
      }
      // Register in mapping table (upsert — keep existing local_product_id if already set)
      await pool.query(
        'INSERT INTO cardapioweb_product_mappings (tenant_id,cardapioweb_item_id,cardapioweb_item_name,local_product_id,local_variation_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,cardapioweb_item_id) DO UPDATE SET cardapioweb_item_name=EXCLUDED.cardapioweb_item_name, local_product_id=COALESCE(cardapioweb_product_mappings.local_product_id, EXCLUDED.local_product_id), local_variation_id=COALESCE(cardapioweb_product_mappings.local_variation_id, EXCLUDED.local_variation_id)',
        [tenantId, item.item_id, item.name, resolvedProductId, resolvedVariationId]
      ).catch(()=>{});
    }

    await pool.query('UPDATE cardapioweb_logs SET status=$1 WHERE tenant_id=$2 AND external_order_id=$3 AND status=$4',
      ['success', tenantId, String(order.id), 'received']).catch(()=>{});
    console.log('[CardapioWeb Webhook] Order imported:', newOrder.id, 'external:', order.id);

  } catch (err) {
    console.error('[CardapioWeb Webhook] Error:', err.message);
  }
});

// POST /api/functions/cardapioweb-test-connection
app.post('/api/functions/cardapioweb-test-connection', async (req, res) => {
  try {
    const { api_token } = req.body || {};
    if (!api_token) return res.json({ success: false, message: 'O campo api_token é obrigatório' });

    const response = await fetch('https://integracao.cardapioweb.com/api/partner/v1/merchant', {
      headers: { 'X-API-KEY': api_token, 'Accept': 'application/json' },
    });

    const body = await response.text();
    if (!response.ok) {
      return res.json({ success: false, message: 'API retornou status ' + response.status, details: body });
    }

    let parsed = {};
    try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }

    return res.json({
      success: true,
      message: 'Conexão estabelecida com sucesso',
      merchantName: parsed.name || parsed.trading_name || parsed.company_name || null,
      merchantId: parsed.id || parsed.merchant_id || null,
      raw: parsed,
    });
  } catch (err) {
    res.json({ success: false, message: err.message || 'Erro interno ao testar conexão' });
  }
});

// POST /api/functions/cardapioweb-sync-orders
app.post('/api/functions/cardapioweb-sync-orders', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });
    const { start_date, end_date } = req.body || {};

    const intRes = await pool.query('SELECT * FROM cardapioweb_integrations WHERE tenant_id=$1 AND is_active=true LIMIT 1', [tenantId]);
    const integration = intRes.rows[0];
    if (!integration) return res.status(404).json({ error: 'Integration not configured or inactive' });

    let apiUrl = 'https://integracao.cardapioweb.com/api/partner/v1/orders';
    const params = new URLSearchParams();
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (params.toString()) apiUrl += '?' + params.toString();

    const ordersResp = await fetch(apiUrl, {
      headers: { 'X-API-KEY': integration.api_token, 'Accept': 'application/json' }
    });
    if (!ordersResp.ok) return res.status(502).json({ error: 'CardápioWeb API error: ' + ordersResp.status });

    const ordersData = await ordersResp.json();
    const orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []);

    const mappingsRes = await pool.query('SELECT * FROM cardapioweb_product_mappings WHERE tenant_id=$1', [tenantId]);
    const mappingMap = new Map(mappingsRes.rows.map(m => [m.cardapioweb_item_id, m]));
    const compOptRes = await pool.query('SELECT id, name, external_code FROM complement_options WHERE tenant_id=$1 AND is_active=true', [tenantId]);
    const compGrpRes = await pool.query('SELECT name, kds_category FROM complement_groups WHERE tenant_id=$1', [tenantId]);

    const statusMap = { waiting_confirmation:'pending', pending_payment:'pending', pending_online_payment:'pending', scheduled_confirmed:'pending', confirmed:'preparing', ready:'ready', released:'ready', waiting_to_catch:'ready', delivered:'delivered', canceling:'cancelled', canceled:'cancelled', closed:'delivered' };
    const typeMap = { delivery:'delivery', takeout:'takeaway', onsite:'takeaway', closed_table:'table' };
    const mapStatus = s => statusMap[s] || 'pending';
    const mapType = t => typeMap[t] || 'takeaway';
    const mapPayment = r => { const n=(r||'').trim().toUpperCase(); if(!n)return null; if(n.includes('PIX'))return'pix'; if(n.includes('CREDIT'))return'credit'; if(n.includes('DEBIT'))return'debit'; if(n.includes('CASH'))return'cash'; return n.toLowerCase(); };
    const resolveSource = s => ((s||'').toUpperCase().includes('IFOOD') ? 'ifood' : 'cardapioweb');
    const fmtAddr = a => { if(!a)return''; const p=[a.street,a.number,a.neighborhood,a.complement,a.city,a.state].filter(Boolean).join(', '); return a.reference?p+' (Ref: '+a.reference+')':p; };

    let imported=0, skipped=0, errors=0;

    for (const order of orders) {
      try {
        const existRes = await pool.query(
          "SELECT id FROM orders WHERE external_source IN ('cardapioweb','ifood') AND external_order_id=$1 AND tenant_id=$2 LIMIT 1",
          [String(order.id), tenantId]
        );
        if (existRes.rows.length > 0) { skipped++; continue; }

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
           order.service_fee||0, order.additional_fee||0, changeFor, order.fiscal_document||null,
           order.customer?.id?String(order.customer.id):null,
           order.delivery_address?.latitude?parseFloat(order.delivery_address.latitude):null,
           order.delivery_address?.longitude?parseFloat(order.delivery_address.longitude):null,
           JSON.stringify(order), allMethods, resolvedPaymentStatus, order.schedule?.scheduled_date_time_start||null,
           holdForPayment, order.created_at]
        );
        const newOrder = newOrderRes.rows[0];

        const syncProdByCodeRes = await pool.query('SELECT id, cardapioweb_code FROM products WHERE tenant_id=$1 AND cardapioweb_code IS NOT NULL', [tenantId]);
        const syncProdByCode = new Map(syncProdByCodeRes.rows.map(p => [p.cardapioweb_code, p.id]));
        const syncVarByCodeRes = await pool.query('SELECT pv.id, pv.cardapioweb_code, pv.product_id FROM product_variations pv JOIN products p ON p.id=pv.product_id WHERE p.tenant_id=$1 AND pv.cardapioweb_code IS NOT NULL', [tenantId]);
        const syncVarByCode = new Map(syncVarByCodeRes.rows.map(v => [v.cardapioweb_code, v]));
        const syncOptMappingRes = await pool.query('SELECT cardapioweb_option_id, local_option_id FROM cardapioweb_option_mappings WHERE tenant_id=$1 AND local_option_id IS NOT NULL', [tenantId]);
        const syncOptMap = new Map(syncOptMappingRes.rows.map(m => [m.cardapioweb_option_id, m.local_option_id]));
        const syncGrpMappingRes = await pool.query('SELECT cardapioweb_group_id, local_group_id, kds_category FROM cardapioweb_group_mappings WHERE tenant_id=$1', [tenantId]);
        const syncGrpMap = new Map(syncGrpMappingRes.rows.map(m => [m.cardapioweb_group_id, m]));

        for (const item of items) {
          const mapping = mappingMap.get(item.item_id);
          const itemCode = String(item.item_id);
          let resolvedProductId = syncProdByCode.get(itemCode) || mapping?.local_product_id || null;
          let resolvedVariationId = null;
          const varByCode = syncVarByCode.get(itemCode);
          if (varByCode) { resolvedProductId = varByCode.product_id; resolvedVariationId = varByCode.id; }
          if (!resolvedVariationId && mapping?.local_variation_id) resolvedVariationId = mapping.local_variation_id;

          const optTotal = (item.options||[]).reduce((s,o)=>s+(o.unit_price*o.quantity),0);
          const unitPrice = item.unit_price + optTotal;
          const itemRes = await pool.query(
            \`INSERT INTO order_items (tenant_id,order_id,product_id,variation_id,quantity,unit_price,total_price,notes,status,external_item_id,external_code,item_kind)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id\`,
            [tenantId, newOrder.id, resolvedProductId, resolvedVariationId,
             item.quantity, unitPrice, item.total_price, item.observation||null,
             mapStatus(order.status)==='delivered'?'delivered':'pending',
             String(item.order_item_id), item.external_code||null, item.kind||null]
          ).catch(()=>null);
          if (!itemRes) continue;
          const orderItemId = itemRes.rows[0].id;

          for (const opt of (item.options||[])) {
            const gn = opt.option_group_name || '';
            const gnl = gn.toLowerCase();
            const optCode = String(opt.option_id);
            let matchedOpt = null;
            const mappedOptId = syncOptMap.get(opt.option_id);
            if (mappedOptId) matchedOpt = compOptRes.rows.find(co => co.id === mappedOptId);
            if (!matchedOpt) matchedOpt = compOptRes.rows.find(co => co.external_code === optCode);
            if (!matchedOpt && opt.external_code) matchedOpt = compOptRes.rows.find(co => co.external_code === opt.external_code);
            if (!matchedOpt) matchedOpt = compOptRes.rows.find(co => co.name.trim().toLowerCase() === opt.name.trim().toLowerCase());
            const syncGrpM = opt.option_group_id ? syncGrpMap.get(opt.option_group_id) : null;
            const matchedGrp = gn ? compGrpRes.rows.find(g => g.name.toLowerCase() === gnl) : null;
            const extraName = gn ? gn+': '+opt.name : opt.name;
            let kdsCategory = syncGrpM?.kds_category || matchedGrp?.kds_category || 'complement';
            if (kdsCategory === 'complement') {
              const on = (opt.name||'').trim();
              if (gnl.includes('sabor') || gnl.includes('flavor')) kdsCategory='flavor';
              else if (/^\d+\/\d+\s/.test(on)) kdsCategory='flavor';
              else if (/\([GgMmPp]\)$/.test(on) && !gnl.includes('massa') && !gnl.includes('borda')) kdsCategory='flavor';
            }
            await pool.query(
              'INSERT INTO order_item_extras (tenant_id,order_item_id,extra_name,extra_id,price,quantity,external_option_id,external_group_id,kds_category) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
              [tenantId, orderItemId, extraName, matchedOpt?.id||null, opt.unit_price*opt.quantity, opt.quantity, String(opt.option_id), String(opt.option_group_id), kdsCategory]
            ).catch(()=>{});
            await pool.query(
              'INSERT INTO cardapioweb_option_mappings (tenant_id,cardapioweb_option_id,cardapioweb_option_name,cardapioweb_group_id,cardapioweb_group_name,local_option_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id,cardapioweb_option_id) DO UPDATE SET cardapioweb_option_name=EXCLUDED.cardapioweb_option_name, local_option_id=COALESCE(cardapioweb_option_mappings.local_option_id, EXCLUDED.local_option_id)',
              [tenantId, opt.option_id, opt.name, opt.option_group_id||null, gn||null, matchedOpt?.id||null]
            ).catch(()=>{});
            if (opt.option_group_id) {
              await pool.query(
                'INSERT INTO cardapioweb_group_mappings (tenant_id,cardapioweb_group_id,cardapioweb_group_name,local_group_id,kds_category) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,cardapioweb_group_id) DO UPDATE SET cardapioweb_group_name=EXCLUDED.cardapioweb_group_name',
                [tenantId, opt.option_group_id, gn||'Grupo '+opt.option_group_id, matchedGrp?.id||null, matchedGrp?.kds_category||null]
              ).catch(()=>{});
            }
          }

          await pool.query(
            'INSERT INTO cardapioweb_product_mappings (tenant_id,cardapioweb_item_id,cardapioweb_item_name,local_product_id,local_variation_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,cardapioweb_item_id) DO UPDATE SET cardapioweb_item_name=EXCLUDED.cardapioweb_item_name, local_product_id=COALESCE(cardapioweb_product_mappings.local_product_id, EXCLUDED.local_product_id), local_variation_id=COALESCE(cardapioweb_product_mappings.local_variation_id, EXCLUDED.local_variation_id)',
            [tenantId, item.item_id, item.name, resolvedProductId, resolvedVariationId]
          ).catch(()=>{});
        }

        imported++;
      } catch (err) {
        console.error('[CardapioWeb Sync] Error processing order:', order.id, err.message);
        errors++;
      }
    }

    await pool.query('UPDATE cardapioweb_integrations SET last_sync_at=NOW() WHERE id=$1', [integration.id]).catch(()=>{});
    await pool.query('INSERT INTO cardapioweb_logs (tenant_id,event_type,payload,status) VALUES ($1,$2,$3,$4)',
      [tenantId, 'MANUAL_SYNC', JSON.stringify({start_date,end_date,imported,skipped,errors}), errors===0?'success':'partial']).catch(()=>{});

    res.json({ success: true, imported, skipped, errors, total: orders.length });
  } catch (err) {
    console.error('[CardapioWeb Sync] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/cardapioweb-sync-status
app.post('/api/functions/cardapioweb-sync-status', optionalAuth, async (req, res) => {
  try {
    const { order_id, new_status, cancellation_reason } = req.body || {};
    if (!order_id || !new_status) return res.status(400).json({ error: 'Missing order_id or new_status' });

    const orderRes = await pool.query('SELECT id, external_source, external_order_id, tenant_id FROM orders WHERE id=$1', [order_id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.external_source !== 'cardapioweb') return res.json({ success: true, message: 'Not a CardápioWeb order' });

    const intRes = await pool.query('SELECT api_token FROM cardapioweb_integrations WHERE tenant_id=$1 AND is_active=true LIMIT 1', [order.tenant_id]);
    const integration = intRes.rows[0];
    if (!integration) return res.status(400).json({ error: 'Integration not configured' });

    const endpointMap = { preparing:'confirm', ready:'ready', delivered:'finalize', cancelled:'cancel' };
    const endpoint = endpointMap[new_status];
    if (!endpoint) return res.json({ success: true, message: 'No sync needed for this status' });

    const apiUrl = 'https://integracao.cardapioweb.com/api/partner/v1/orders/' + order.external_order_id + '/' + endpoint;
    const body = endpoint === 'cancel' && cancellation_reason ? JSON.stringify({ cancellation_reason }) : undefined;

    const apiResp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'X-API-KEY': integration.api_token, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body,
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return res.json({ success: false, message: 'CardápioWeb API returned ' + apiResp.status, error: errText });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[CardapioWeb Sync Status] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/functions/cardapioweb-group-mappings
app.get('/api/functions/cardapioweb-group-mappings', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const r = await pool.query(
      'SELECT m.*, cg.name as local_group_name, cg.kds_category as local_kds_category FROM cardapioweb_group_mappings m LEFT JOIN complement_groups cg ON cg.id=m.local_group_id WHERE m.tenant_id=$1 ORDER BY m.cardapioweb_group_name',
      [tenantId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/functions/cardapioweb-group-mappings
app.patch('/api/functions/cardapioweb-group-mappings', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id, local_group_id, kds_category } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    // If local_group_id given, pull kds_category from that group
    let resolvedKdsCategory = kds_category || null;
    if (local_group_id) {
      const grpRes = await pool.query('SELECT kds_category FROM complement_groups WHERE id=$1', [local_group_id]);
      if (grpRes.rows[0]?.kds_category) resolvedKdsCategory = grpRes.rows[0].kds_category;
    }

    await pool.query(
      'UPDATE cardapioweb_group_mappings SET local_group_id=$1, kds_category=$2 WHERE id=$3 AND tenant_id=$4',
      [local_group_id || null, resolvedKdsCategory, id, tenantId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/functions/cardapioweb-group-mappings/:id
app.delete('/api/functions/cardapioweb-group-mappings/:id', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    await pool.query('DELETE FROM cardapioweb_group_mappings WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/functions/cardapioweb-product-mappings  (writes code back to products)
app.patch('/api/functions/cardapioweb-product-mappings', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id, local_product_id, local_variation_id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    // Update mapping table via PostgREST path (table is RLS-protected)
    const mappingRes = await pool.query(
      'UPDATE cardapioweb_product_mappings SET local_product_id=$1, local_variation_id=$2 WHERE id=$3 AND tenant_id=$4 RETURNING cardapioweb_item_id',
      [local_product_id || null, local_variation_id || null, id, tenantId]
    );

    // Write cardapioweb_code back to product/variation for auto-recognition on future orders
    if (mappingRes.rows[0]) {
      const externalId = String(mappingRes.rows[0].cardapioweb_item_id);
      if (local_variation_id) {
        await pool.query(
          'UPDATE product_variations SET cardapioweb_code=$1 WHERE id=$2',
          [externalId, local_variation_id]
        ).catch(() => {});
      } else if (local_product_id) {
        await pool.query(
          'UPDATE products SET cardapioweb_code=$1 WHERE id=$2 AND tenant_id=$3',
          [externalId, local_product_id, tenantId]
        ).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/functions/cardapioweb-option-mappings
app.get('/api/functions/cardapioweb-option-mappings', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const r = await pool.query(
      'SELECT m.*, co.name as local_option_name, cg.name as local_group_name FROM cardapioweb_option_mappings m LEFT JOIN complement_options co ON co.id=m.local_option_id LEFT JOIN complement_groups cg ON cg.id=co.group_id WHERE m.tenant_id=$1 ORDER BY m.cardapioweb_group_name, m.cardapioweb_option_name',
      [tenantId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/functions/cardapioweb-option-mappings
app.patch('/api/functions/cardapioweb-option-mappings', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id, local_option_id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    // Update mapping table
    const mappingRes = await pool.query(
      'UPDATE cardapioweb_option_mappings SET local_option_id=$1 WHERE id=$2 AND tenant_id=$3 RETURNING cardapioweb_option_id',
      [local_option_id || null, id, tenantId]
    );

    // Write code back to complement_options.external_code for auto-recognition on future orders
    if (local_option_id && mappingRes.rows[0]) {
      const externalId = String(mappingRes.rows[0].cardapioweb_option_id);
      await pool.query(
        'UPDATE complement_options SET external_code=$1 WHERE id=$2 AND tenant_id=$3',
        [externalId, local_option_id, tenantId]
      ).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/functions/cardapioweb-option-mappings/:id
app.delete('/api/functions/cardapioweb-option-mappings/:id', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    await pool.query('DELETE FROM cardapioweb_option_mappings WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

`;

// Safety check: don't double-apply (was missing, caused 12x duplication)
if (code.includes("// POST /api/functions/cardapioweb-webhook")) {
  console.log('cardapioweb routes already present — skipping insert');
  fs.writeFileSync('/tmp/server_patched.js', code);
  console.log('cardapioweb-webhook added:', true);
  console.log('cardapioweb-test-connection added:', code.includes('/api/functions/cardapioweb-test-connection'));
  console.log('cardapioweb-sync-orders added:', code.includes('/api/functions/cardapioweb-sync-orders'));
  console.log('cardapioweb-sync-status added:', code.includes('/api/functions/cardapioweb-sync-status'));
  process.exit(0);
}

const anchor = "// POST /api/functions/kds-data";
if (!code.includes(anchor)) { console.error('anchor not found'); process.exit(1); }
code = code.replace(anchor, allEndpoints + anchor);

fs.writeFileSync('/tmp/server_patched.js', code);
console.log('cardapioweb-webhook added:', code.includes('/api/functions/cardapioweb-webhook'));
console.log('cardapioweb-test-connection added:', code.includes('/api/functions/cardapioweb-test-connection'));
console.log('cardapioweb-sync-orders added:', code.includes('/api/functions/cardapioweb-sync-orders'));
console.log('cardapioweb-sync-status added:', code.includes('/api/functions/cardapioweb-sync-status'));
