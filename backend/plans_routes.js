
// ── SUBSCRIPTION PLANS CRUD ─────────────────────────────────────────────────

async function requireAdmin(req, res) {
  const adm = await pool.query("SELECT 1 FROM profiles WHERE id = $1 AND role = 'platform_admin'", [req.user.sub]);
  if (!adm.rows[0]) { res.status(403).json({ error: 'Acesso negado' }); return false; }
  return true;
}

// GET /api/admin/plans
app.get('/api/admin/plans', authMiddleware, async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const r = await pool.query('SELECT * FROM subscription_plans ORDER BY value ASC');
    res.json({ plans: r.rows });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/admin/plans
app.post('/api/admin/plans', authMiddleware, async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const { key, name, value, cycle, months, is_active, description, discount_pct } = req.body;
    if (!key || !name || !value || !cycle || !months) return res.status(400).json({ error: 'Campos obrigatorios faltando' });
    const r = await pool.query(
      `INSERT INTO subscription_plans (key, name, value, cycle, months, is_active, description, discount_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [key, name, value, cycle, months, is_active !== false, description || null, discount_pct || 0]
    );
    res.status(201).json({ plan: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Chave ja existe' });
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/admin/plans/:id
app.put('/api/admin/plans/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const { key, name, value, cycle, months, is_active, description, discount_pct } = req.body;
    const r = await pool.query(
      `UPDATE subscription_plans SET key=$1, name=$2, value=$3, cycle=$4, months=$5,
       is_active=$6, description=$7, discount_pct=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [key, name, value, cycle, months, is_active !== false, description || null, discount_pct || 0, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Plano nao encontrado' });
    res.json({ plan: r.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// DELETE /api/admin/plans/:id
app.delete('/api/admin/plans/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    await pool.query('DELETE FROM subscription_plans WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/plans (public — plans for checkout)
app.get('/api/plans', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY value ASC');
    res.json({ plans: r.rows });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});
