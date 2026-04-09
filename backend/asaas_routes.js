
// ── ASAAS INTEGRATION ──────────────────────────────────────────────────────

const ASAAS_API_URL = 'https://api.asaas.com/v3';
const ASAAS_KEY = process.env.ASAAS_API_KEY;

const PLANS = {
  monthly:   { name: 'Mensal',     value: 299.90,  cycle: 'MONTHLY',   months: 1  },
  quarterly: { name: 'Trimestral', value: 764.74,  cycle: 'QUARTERLY', months: 3  },
  annual:    { name: 'Anual',      value: 2699.10, cycle: 'YEARLY',    months: 12 },
};

async function asaasReq(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_KEY } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(ASAAS_API_URL + path, opts);
  return r.json();
}

// POST /api/subscriptions/checkout
app.post('/api/subscriptions/checkout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { planType = 'monthly' } = req.body;
    const plan = PLANS[planType];
    if (!plan) return res.status(400).json({ error: 'Plano invalido' });

    const tRes = await pool.query(
      `SELECT t.id, t.name, t.asaas_customer_id, t.asaas_subscription_id, t.plan_type,
              p.email, p.full_name
       FROM tenants t
       JOIN tenant_members tm ON t.id = tm.tenant_id
       JOIN profiles p ON p.id = $1
       WHERE tm.user_id = $1 LIMIT 1`,
      [userId]
    );
    if (!tRes.rows[0]) return res.status(404).json({ error: 'Tenant nao encontrado' });
    const tenant = tRes.rows[0];

    let customerId = tenant.asaas_customer_id;
    if (!customerId) {
      const cust = await asaasReq('POST', '/customers', {
        name: tenant.full_name || tenant.name,
        email: tenant.email,
        externalReference: tenant.id,
      });
      if (cust.errors) return res.status(400).json({ error: cust.errors[0].description });
      customerId = cust.id;
      await pool.query('UPDATE tenants SET asaas_customer_id = $1 WHERE id = $2', [customerId, tenant.id]);
    }

    if (tenant.asaas_subscription_id && tenant.plan_type !== planType) {
      await asaasReq('DELETE', '/subscriptions/' + tenant.asaas_subscription_id).catch(() => {});
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const sub = await asaasReq('POST', '/subscriptions', {
      customer: customerId,
      billingType: 'PIX',
      value: plan.value,
      nextDueDate: dueDate.toISOString().split('T')[0],
      cycle: plan.cycle,
      description: 'slim PDV - Plano ' + plan.name,
      externalReference: tenant.id,
    });
    if (sub.errors) return res.status(400).json({ error: sub.errors[0].description });

    await pool.query(
      'UPDATE tenants SET asaas_subscription_id = $1, plan_type = $2 WHERE id = $3',
      [sub.id, planType, tenant.id]
    );

    await new Promise(r => setTimeout(r, 2000));
    const charges = await asaasReq('GET', '/payments?subscription=' + sub.id + '&limit=1');
    const charge = charges.data && charges.data[0];
    if (!charge) return res.status(202).json({ subscriptionId: sub.id, pending: true });

    const pix = await asaasReq('GET', '/payments/' + charge.id + '/pixQrCode');

    res.json({
      subscriptionId: sub.id,
      paymentId: charge.id,
      value: plan.value,
      planName: plan.name,
      dueDate: charge.dueDate,
      pixQrCode: pix.encodedImage,
      pixCopiaECola: pix.payload,
    });
  } catch (err) {
    console.error('Asaas checkout:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscriptions/status
app.get('/api/subscriptions/status', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT t.id, t.name, t.plan, t.plan_type, t.plan_expires_at, t.trial_ends_at
       FROM tenants t JOIN tenant_members tm ON t.id = tm.tenant_id
       WHERE tm.user_id = $1 LIMIT 1`,
      [req.user.sub]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/webhooks/asaas
app.post('/api/webhooks/asaas', async (req, res) => {
  try {
    const { event, payment, subscription } = req.body;
    console.log('[Asaas]', event);

    if (event === 'PAYMENT_RECEIVED' && payment && payment.externalReference) {
      const tRes = await pool.query('SELECT id, plan_type FROM tenants WHERE id = $1', [payment.externalReference]);
      const t = tRes.rows[0];
      if (t) {
        const pm = { monthly: 1, quarterly: 3, annual: 12 };
        const m = pm[t.plan_type] || 1;
        const exp = new Date();
        exp.setMonth(exp.getMonth() + m);
        await pool.query("UPDATE tenants SET plan = 'active', plan_expires_at = $1 WHERE id = $2", [exp, t.id]);
        console.log('[Asaas] Tenant activated:', t.id);
      }
    }
    if (event === 'PAYMENT_OVERDUE' && payment && payment.externalReference) {
      await pool.query("UPDATE tenants SET plan = 'overdue' WHERE id = $1", [payment.externalReference]);
    }
    if (event === 'SUBSCRIPTION_DELETED' && subscription && subscription.externalReference) {
      await pool.query("UPDATE tenants SET plan = 'cancelled', asaas_subscription_id = NULL WHERE id = $1", [subscription.externalReference]);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook err:', err.message);
    res.status(500).json({ error: 'Webhook error' });
  }
});

// GET /api/admin/subscriptions
app.get('/api/admin/subscriptions', authMiddleware, async (req, res) => {
  try {
    const adm = await pool.query("SELECT 1 FROM profiles WHERE id = $1 AND role = 'platform_admin'", [req.user.sub]);
    if (!adm.rows[0]) return res.status(403).json({ error: 'Acesso negado' });
    const r = await pool.query(
      `SELECT t.id, t.name, t.slug, t.plan, t.plan_type, t.plan_expires_at,
              t.trial_ends_at, t.created_at, t.is_active, t.business_type,
              t.asaas_customer_id, t.asaas_subscription_id,
              COUNT(DISTINCT tm.user_id)::int as user_count
       FROM tenants t LEFT JOIN tenant_members tm ON t.id = tm.tenant_id
       GROUP BY t.id ORDER BY t.created_at DESC`
    );
    res.json({ tenants: r.rows });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/admin/subscriptions/:id/activate
app.post('/api/admin/subscriptions/:tenantId/activate', authMiddleware, async (req, res) => {
  try {
    const adm = await pool.query("SELECT 1 FROM profiles WHERE id = $1 AND role = 'platform_admin'", [req.user.sub]);
    if (!adm.rows[0]) return res.status(403).json({ error: 'Acesso negado' });
    const months = Number(req.body.months) || 1;
    const exp = new Date();
    exp.setMonth(exp.getMonth() + months);
    await pool.query("UPDATE tenants SET plan = 'active', plan_expires_at = $1, is_active = true WHERE id = $2", [exp, req.params.tenantId]);
    res.json({ success: true, expires: exp.toISOString() });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/admin/subscriptions/:id/extend-trial
app.post('/api/admin/subscriptions/:tenantId/extend-trial', authMiddleware, async (req, res) => {
  try {
    const adm = await pool.query("SELECT 1 FROM profiles WHERE id = $1 AND role = 'platform_admin'", [req.user.sub]);
    if (!adm.rows[0]) return res.status(403).json({ error: 'Acesso negado' });
    const days = Number(req.body.days) || 7;
    const r = await pool.query('SELECT trial_ends_at FROM tenants WHERE id = $1', [req.params.tenantId]);
    const cur = r.rows[0] && r.rows[0].trial_ends_at ? new Date(r.rows[0].trial_ends_at) : new Date();
    const newEnd = new Date(Math.max(cur.getTime(), Date.now()));
    newEnd.setDate(newEnd.getDate() + days);
    await pool.query("UPDATE tenants SET trial_ends_at = $1, plan = 'trial' WHERE id = $2", [newEnd, req.params.tenantId]);
    res.json({ success: true, trialEndsAt: newEnd.toISOString() });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/admin/subscriptions/:id/cancel
app.post('/api/admin/subscriptions/:tenantId/cancel', authMiddleware, async (req, res) => {
  try {
    const adm = await pool.query("SELECT 1 FROM profiles WHERE id = $1 AND role = 'platform_admin'", [req.user.sub]);
    if (!adm.rows[0]) return res.status(403).json({ error: 'Acesso negado' });
    const r = await pool.query('SELECT asaas_subscription_id FROM tenants WHERE id = $1', [req.params.tenantId]);
    const subId = r.rows[0] && r.rows[0].asaas_subscription_id;
    if (subId) await asaasReq('DELETE', '/subscriptions/' + subId).catch(() => {});
    await pool.query("UPDATE tenants SET plan = 'cancelled', asaas_subscription_id = NULL, is_active = false WHERE id = $1", [req.params.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

