const fs = require('fs');
let code = fs.readFileSync('/tmp/server_current.js', 'utf8');

const newEndpoints = `
// POST /api/functions/cardapioweb-sync-orders
app.post('/api/functions/cardapioweb-sync-orders', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });
    const { start_date, end_date } = req.body || {};

    const intRes = await pool.query(
      'SELECT * FROM cardapioweb_integrations WHERE tenant_id=$1 AND is_active=true LIMIT 1', [tenantId]
    );
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
        if (order.order_type !== 'delivery') { skipped++; continue; }

        const existRes = await pool.query(
          "SELECT id FROM orders WHERE external_source IN ('cardapioweb','ifood') AND external_order_id=$1 AND tenant_id=$2 LIMIT 1",
          [String(order.id), tenantId]
        );
        if (existRes.rows.length > 0) { skipped++; continue; }

        const payments = order.payments || [];
        const payment = payments[0];
        const isOnline = (payment?.payment_type||'').toUpperCase()==='ONLINE';
        const isPaid = ['AUTHORIZED','PAID','APPROVED'].includes((payment?.status||'').toUpperCase());
        const holdForPayment = isOnline && !isPaid;
        const resolvedPaymentStatus = isPaid ? 'paid' : (holdForPayment ? 'pending_online' : 'pending');
        const allMethods = payments.length > 1 ? payments.map(p=>mapPayment(p.payment_method)).filter(Boolean).join(', ') : mapPayment(payment?.payment_method);
        const changeFor = payments.find(p=>p.change_for!=null)?.change_for ?? null;

        const items = order.items || [];
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
           holdForPayment, order.created_at]
        );
        const newOrder = newOrderRes.rows[0];

        for (const item of items) {
          const mapping = mappingMap.get(item.item_id);
          const optTotal = item.options.reduce((s,o)=>s+(o.unit_price*o.quantity),0);
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

          if (item.options.length > 0) {
            for (const opt of item.options) {
              const gn = opt.option_group_name || '';
              const gnl = gn.toLowerCase();
              let matchedOpt = compOptRes.rows.find(co => opt.external_code && co.external_code === opt.external_code);
              if (!matchedOpt) matchedOpt = compOptRes.rows.find(co => co.name.trim().toLowerCase() === opt.name.trim().toLowerCase());
              const matchedGrp = gn ? compGrpRes.rows.find(g => g.name.toLowerCase() === gnl) : null;
              const extraName = gn ? gn+': '+opt.name : opt.name;
              let kdsCategory = matchedGrp?.kds_category || 'complement';
              if (kdsCategory === 'complement') { if (gnl.includes('sabor')) kdsCategory='flavor'; else if (/^\\d+\\/\\d+\\s/.test(opt.name||'')) kdsCategory='flavor'; }
              await pool.query(
                'INSERT INTO order_item_extras (tenant_id,order_item_id,extra_name,extra_id,price,quantity,external_option_id,external_group_id,kds_category) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
                [tenantId, orderItemId, extraName, matchedOpt?.id||null, opt.unit_price*opt.quantity, opt.quantity, String(opt.option_id), String(opt.option_group_id), kdsCategory]
              ).catch(()=>{});
            }
          }

          if (!mapping) {
            await pool.query(
              'INSERT INTO cardapioweb_product_mappings (tenant_id,cardapioweb_item_id,cardapioweb_item_name) VALUES ($1,$2,$3) ON CONFLICT (tenant_id,cardapioweb_item_id) DO NOTHING',
              [tenantId, item.item_id, item.name]
            ).catch(()=>{});
          }
        }

        imported++;
      } catch (err) {
        console.error('[CardapioWeb Sync] Error processing order:', order.id, err.message);
        errors++;
      }
    }

    await pool.query('UPDATE cardapioweb_integrations SET last_sync_at=NOW() WHERE id=$1', [integration.id]).catch(()=>{});
    await pool.query(
      'INSERT INTO cardapioweb_logs (tenant_id,event_type,payload,status) VALUES ($1,$2,$3,$4)',
      [tenantId, 'MANUAL_SYNC', JSON.stringify({start_date,end_date,imported,skipped,errors}), errors===0?'success':'partial']
    ).catch(()=>{});

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

`;

const anchor = '// POST /api/functions/cardapioweb-test-connection';
if (!code.includes(anchor)) { console.error('anchor not found'); process.exit(1); }
code = code.replace(anchor, newEndpoints + anchor);

fs.writeFileSync('/tmp/server_patched.js', code);
console.log('sync-orders added:', code.includes('cardapioweb-sync-orders'));
console.log('sync-status added:', code.includes('cardapioweb-sync-status'));
