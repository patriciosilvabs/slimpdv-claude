import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("72.61.25.92", username="root", password="sshpass")

# Read current server.js
sftp = ssh.open_sftp()
with sftp.file('/var/www/slimpdv/backend/server.js', 'r') as f:
    content = f.read().decode('utf-8')

print(f"File size: {len(content)} chars, {content.count(chr(10))} lines")

# Find insertion point
MARKER = '// ONBOARDING \u2014 tenant creation with template seeding'
idx = content.find(MARKER)
if idx == -1:
    # Try alternate marker
    MARKER = '// ONBOARDING'
    idx = content.find(MARKER)

print(f"Insertion point found at char {idx}")

# The new code to insert
NEW_CODE = r"""// \u2500\u2500 CARDAPIOWEB FUNCTIONS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const CARDAPIOWEB_API_URL_V1 = 'https://integracao.cardapioweb.com/api/partner/v1';

function cwGetEndpointForStatus(localStatus) {
  const map = { preparing: 'confirm', ready: 'ready', delivered: 'finalize', cancelled: 'cancel' };
  return map[localStatus] || null;
}
function cwMapStatus(cwStatus) {
  const m = { waiting_confirmation:'pending', pending_payment:'pending', pending_online_payment:'pending', scheduled_confirmed:'pending', confirmed:'preparing', ready:'ready', released:'ready', waiting_to_catch:'ready', delivered:'delivered', canceling:'cancelled', canceled:'cancelled', closed:'delivered' };
  return m[cwStatus] || 'pending';
}
function cwMapOrderType(t) {
  const m = { delivery:'delivery', takeout:'takeaway', onsite:'takeaway', closed_table:'table' };
  return m[t] || 'takeaway';
}
function cwFormatAddress(a) {
  if (!a) return '';
  const parts = [a.street, a.number, a.neighborhood, a.complement, a.city, a.state].filter(Boolean);
  let r = parts.join(', ');
  if (a.reference) r += ` (Ref: ${a.reference})`;
  return r;
}
function cwMapPaymentMethod(raw) {
  const n = (raw || '').trim().toUpperCase();
  if (!n) return null;
  if (n.includes('PIX')) return 'pix';
  if (n.includes('CREDIT')) return 'credit';
  if (n.includes('DEBIT')) return 'debit';
  if (n.includes('CASH')) return 'cash';
  if (n.includes('VOUCHER') || n.includes('VALE')) return 'voucher';
  return n.toLowerCase();
}
function cwResolveAllPayments(payments) {
  if (!payments || payments.length === 0) return { mappedMethod: null, resolvedPaymentStatus: 'pending', changeFor: null, holdForPayment: false };
  const payment = payments[0];
  const isOnline = (payment.payment_type || '').toUpperCase() === 'ONLINE';
  const isPaid = ['AUTHORIZED', 'PAID', 'APPROVED'].includes((payment.status || '').toUpperCase());
  const holdForPayment = isOnline && !isPaid;
  const resolvedPaymentStatus = isPaid ? 'paid' : (holdForPayment ? 'pending_online' : 'pending');
  const allMethods = payments.length > 1 ? payments.map(p => cwMapPaymentMethod(p.payment_method)).filter(Boolean).join(', ') : cwMapPaymentMethod(payment.payment_method);
  const changeFor = payments.find(p => p.change_for != null)?.change_for ?? null;
  return { mappedMethod: allMethods, resolvedPaymentStatus, changeFor, holdForPayment };
}
function cwResolveExternalSource(salesChannel) {
  return (salesChannel || '').toUpperCase().includes('IFOOD') ? 'ifood' : 'cardapioweb';
}

// POST /api/functions/cardapioweb-test-connection
app.post('/api/functions/cardapioweb-test-connection', authMiddleware, async (req, res) => {
  try {
    const { api_token } = req.body;
    if (!api_token) return res.json({ success: false, message: 'O campo api_token e obrigatorio' });
    const response = await fetch(`${CARDAPIOWEB_API_URL_V1}/merchant`, {
      headers: { 'X-API-KEY': api_token, 'Accept': 'application/json' },
    });
    const body = await response.text();
    if (!response.ok) return res.json({ success: false, message: `API retornou status ${response.status}`, details: body });
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }
    return res.json({ success: true, message: 'Conexao estabelecida com sucesso', merchantName: parsed.name || parsed.trading_name || parsed.company_name || null, merchantId: parsed.id || parsed.merchant_id || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/functions/cardapioweb-sync-status
app.post('/api/functions/cardapioweb-sync-status', authMiddleware, async (req, res) => {
  try {
    const { order_id, new_status, cancellation_reason } = req.body;
    const tenantId = req.user.tenant_id;
    if (!order_id || !new_status) return res.status(400).json({ error: 'Missing order_id or new_status' });
    const orderRes = await pool.query('SELECT id, external_source, external_order_id FROM orders WHERE id = $1 AND tenant_id = $2', [order_id, tenantId]);
    if (!orderRes.rows[0]) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];
    if (order.external_source !== 'cardapioweb') return res.json({ success: true, message: 'Not a CardapioWeb order' });
    const integRes = await pool.query('SELECT api_token FROM cardapioweb_integrations WHERE tenant_id = $1 AND is_active = true LIMIT 1', [tenantId]);
    if (!integRes.rows[0]) return res.status(400).json({ error: 'Integration not configured' });
    const endpoint = cwGetEndpointForStatus(new_status);
    if (!endpoint) return res.json({ success: true, message: 'No sync needed for this status' });
    const requestBody = endpoint === 'cancel' && cancellation_reason ? JSON.stringify({ cancellation_reason }) : undefined;
    const apiUrl = `${CARDAPIOWEB_API_URL_V1}/orders/${order.external_order_id}/${endpoint}`;
    const response = await fetch(apiUrl, { method: 'POST', headers: { 'X-API-KEY': integRes.rows[0].api_token, 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: requestBody });
    if (!response.ok) {
      const errorText = await response.text();
      return res.json({ success: false, message: `CardapioWeb API returned ${response.status}`, error: errorText });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/cardapioweb-product-mappings
app.post('/api/functions/cardapioweb-product-mappings', authMiddleware, async (req, res) => {
  try {
    const { id, local_product_id, local_variation_id } = req.body;
    const tenantId = req.user.tenant_id;
    const result = await pool.query('UPDATE cardapioweb_product_mappings SET local_product_id = $1, local_variation_id = $2 WHERE id = $3 AND tenant_id = $4 RETURNING *', [local_product_id || null, local_variation_id || null, id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Mapping not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/cardapioweb-sync-orders
app.post('/api/functions/cardapioweb-sync-orders', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    const tenantId = req.user.tenant_id;
    const integRes = await pool.query('SELECT * FROM cardapioweb_integrations WHERE tenant_id = $1 AND is_active = true LIMIT 1', [tenantId]);
    if (!integRes.rows[0]) return res.status(404).json({ error: 'Integration not configured or inactive' });
    const integration = integRes.rows[0];
    let apiUrl = `${CARDAPIOWEB_API_URL_V1}/orders`;
    const params = new URLSearchParams();
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (params.toString()) apiUrl += `?${params.toString()}`;
    const ordersResponse = await fetch(apiUrl, { headers: { 'X-API-KEY': integration.api_token, 'Accept': 'application/json' } });
    if (!ordersResponse.ok) return res.status(502).json({ error: `CardapioWeb API error: ${ordersResponse.status}` });
    const ordersData = await ordersResponse.json();
    const orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []);
    let imported = 0, skipped = 0, errors = 0;
    const mappingsRes = await pool.query('SELECT * FROM cardapioweb_product_mappings WHERE tenant_id = $1', [tenantId]);
    const mappingMap = new Map(mappingsRes.rows.map(m => [m.cardapioweb_item_id, m]));
    const compOptionsRes = await pool.query('SELECT id, name, external_code FROM complement_options WHERE tenant_id = $1 AND is_active = true', [tenantId]).catch(() => ({ rows: [] }));
    const compGroupsRes = await pool.query('SELECT name, kds_category FROM complement_groups WHERE tenant_id = $1', [tenantId]).catch(() => ({ rows: [] }));
    const complementOptions = compOptionsRes.rows;
    const complementGroups = compGroupsRes.rows;
    for (const order of orders) {
      try {
        if (order.order_type !== 'delivery') { skipped++; continue; }
        const existingRes = await pool.query("SELECT id FROM orders WHERE external_source = ANY($1) AND external_order_id = $2 AND tenant_id = $3 LIMIT 1", [['cardapioweb','ifood'], String(order.id), tenantId]);
        if (existingRes.rows[0]) { skipped++; continue; }
        const subtotal = (order.items||[]).reduce((s,i)=>s+(i.total_price||0),0);
        const { mappedMethod, resolvedPaymentStatus, changeFor, holdForPayment } = cwResolveAllPayments(order.payments||[]);
        const baseStatus = cwMapStatus(order.status);
        const orderStatus = holdForPayment ? 'pending' : (integration.auto_accept && baseStatus==='pending') ? 'preparing' : baseStatus;
        let notes = order.observation||'';
        if (order.delivery_address?.reference) notes = notes ? `${notes} | Ref: ${order.delivery_address.reference}` : `Ref: ${order.delivery_address.reference}`;
        const newOrderRes = await pool.query(
          `INSERT INTO orders (tenant_id,order_type,status,customer_name,customer_phone,customer_address,notes,subtotal,total,discount,external_source,external_order_id,external_display_id,delivery_fee,service_fee,additional_fee,change_for,fiscal_document,external_customer_id,delivery_lat,delivery_lng,external_raw_payload,payment_method,payment_status,scheduled_for,is_draft,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING *`,
          [tenantId,cwMapOrderType(order.order_type),orderStatus,order.customer?.name||null,order.customer?.phone||null,order.delivery_address?cwFormatAddress(order.delivery_address):null,notes,subtotal,order.total,cwResolveExternalSource(order.sales_channel),String(order.id),order.display_id!=null?String(order.display_id):null,order.delivery_fee||0,order.service_fee||0,order.additional_fee||0,changeFor,order.fiscal_document||null,order.customer?.id?String(order.customer.id):null,order.delivery_address?.latitude?parseFloat(order.delivery_address.latitude):null,order.delivery_address?.longitude?parseFloat(order.delivery_address.longitude):null,JSON.stringify(order),mappedMethod,resolvedPaymentStatus,order.schedule?.scheduled_date_time_start||null,holdForPayment,order.created_at]
        );
        const newOrder = newOrderRes.rows[0];
        for (const item of (order.items||[])) {
          const mapping = mappingMap.get(item.item_id);
          const optionsTotal = (item.options||[]).reduce((s,o)=>s+(o.unit_price*o.quantity),0);
          const unitPrice = item.unit_price+optionsTotal;
          const itemRes = await pool.query(
            `INSERT INTO order_items (tenant_id,order_id,product_id,variation_id,product_name,quantity,unit_price,total_price,notes,status,external_item_id,external_code,item_kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [tenantId,newOrder.id,mapping?.local_product_id||null,mapping?.local_variation_id||null,item.name||null,item.quantity,unitPrice,item.total_price,item.observation||null,cwMapStatus(order.status)==='delivered'?'delivered':'pending',String(item.order_item_id),item.external_code||null,item.kind||null]
          ).catch(e=>{console.error('order_item insert:',e.message);return{rows:[]};});
          const orderItem = itemRes.rows[0];
          if (orderItem && item.options && item.options.length > 0) {
            const extras = item.options.map(opt => {
              const groupName=opt.option_group_name||'';const groupLower=groupName.toLowerCase();
              let matched=null;
              if(opt.external_code) matched=complementOptions.find(co=>co.external_code&&co.external_code===opt.external_code);
              if(!matched) matched=complementOptions.find(co=>co.name.trim().toLowerCase()===(opt.name||'').trim().toLowerCase());
              const matchedGroup=groupName?complementGroups.find(g=>g.name.toLowerCase()===groupLower):null;
              const extraName=groupName?`${groupName}: ${opt.name}`:opt.name;
              let kdsCategory=matchedGroup?.kds_category||'complement';
              if(kdsCategory==='complement'){if(groupLower.includes('sabor'))kdsCategory='flavor';else if(/^\d+\/\d+\s/.test(opt.name||''))kdsCategory='flavor';}
              return [tenantId,orderItem.id,extraName,matched?.id||null,opt.unit_price*opt.quantity,opt.quantity,String(opt.option_id),String(opt.option_group_id),kdsCategory];
            });
            if(extras.length>0){
              const vals=extras.map((_,i)=>`($${i*9+1},$${i*9+2},$${i*9+3},$${i*9+4},$${i*9+5},$${i*9+6},$${i*9+7},$${i*9+8},$${i*9+9})`).join(',');
              await pool.query(`INSERT INTO order_item_extras (tenant_id,order_item_id,extra_name,extra_id,price,quantity,external_option_id,external_group_id,kds_category) VALUES ${vals}`,extras.flat()).catch(e=>console.error('extras insert:',e.message));
            }
          }
          if(!mapping){await pool.query('INSERT INTO cardapioweb_product_mappings (tenant_id,cardapioweb_item_id,cardapioweb_item_name) VALUES ($1,$2,$3) ON CONFLICT (tenant_id,cardapioweb_item_id) DO NOTHING',[tenantId,item.item_id,item.name]).catch(()=>{});}
        }
        imported++;
      } catch(err){console.error('[CW Sync] order',order.id,err.message);errors++;}
    }
    await pool.query('UPDATE cardapioweb_integrations SET last_sync_at=NOW() WHERE id=$1',[integration.id]).catch(()=>{});
    await pool.query("INSERT INTO cardapioweb_logs (tenant_id,event_type,payload,status) VALUES ($1,'MANUAL_SYNC',$2,$3)",[tenantId,JSON.stringify({start_date,end_date,imported,skipped,errors}),errors===0?'success':'partial']).catch(()=>{});
    return res.json({success:true,imported,skipped,errors,total:orders.length});
  } catch(err){
    console.error('[CW Sync] Error:',err);
    return res.status(500).json({error:err.message});
  }
});

"""

# Insert before the ONBOARDING marker
new_content = content[:idx] + NEW_CODE + content[idx:]

# Write back
with sftp.file('/var/www/slimpdv/backend/server.js', 'w') as f:
    f.write(new_content.encode('utf-8'))

sftp.close()
print(f"Written. New size: {len(new_content)} chars")

# Restart backend
stdin, stdout, stderr = ssh.exec_command("cd /var/www/slimpdv && docker-compose restart backend 2>&1")
print(stdout.read().decode())
print(stderr.read().decode())

# Verify backend is healthy
time.sleep(5)
stdin, stdout, stderr = ssh.exec_command("docker ps | grep backend")
print(stdout.read().decode())

# Test the endpoint exists
stdin, stdout, stderr = ssh.exec_command("grep -n 'cardapioweb-test-connection' /var/www/slimpdv/backend/server.js")
print(stdout.read().decode())

ssh.close()
