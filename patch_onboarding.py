import json

TEMPLATES = {
    'pizzaria': {
        'categories': [
            {'name': 'Pizzas Salgadas', 'color': '#EF4444', 'sort_order': 1, 'products': [
                {'name': 'Margherita', 'description': 'Molho de tomate, mussarela e manjericao fresco', 'price': 45.00, 'cost_price': 18.00},
                {'name': 'Calabresa', 'description': 'Calabresa fatiada, cebola e azeitona', 'price': 48.00, 'cost_price': 19.00},
                {'name': 'Portuguesa', 'description': 'Presunto, ovo, cebola, azeitona e mussarela', 'price': 52.00, 'cost_price': 21.00},
                {'name': 'Frango com Catupiry', 'description': 'Frango desfiado temperado com catupiry cremoso', 'price': 54.00, 'cost_price': 22.00},
                {'name': 'Quatro Queijos', 'description': 'Mussarela, provolone, catupiry e parmesao', 'price': 58.00, 'cost_price': 24.00},
                {'name': 'Pepperoni', 'description': 'Pepperoni fatiado, mussarela e molho de tomate', 'price': 58.00, 'cost_price': 23.00},
            ]},
            {'name': 'Pizzas Doces', 'color': '#F59E0B', 'sort_order': 2, 'products': [
                {'name': 'Chocolate com Morango', 'description': 'Chocolate ao leite, morangos frescos e granulado', 'price': 50.00, 'cost_price': 20.00},
                {'name': 'Romeu e Julieta', 'description': 'Goiabada cremosa e mussarela', 'price': 46.00, 'cost_price': 18.00},
                {'name': 'Nutella com Banana', 'description': 'Creme de avela, banana e leite condensado', 'price': 54.00, 'cost_price': 22.00},
            ]},
            {'name': 'Bebidas', 'color': '#3B82F6', 'sort_order': 3, 'products': [
                {'name': 'Coca-Cola 2L', 'description': '', 'price': 14.00, 'cost_price': 7.00},
                {'name': 'Coca-Cola Lata 350ml', 'description': '', 'price': 7.00, 'cost_price': 3.50},
                {'name': 'Suco de Laranja Natural 400ml', 'description': 'Feito na hora', 'price': 12.00, 'cost_price': 4.00},
                {'name': 'Agua Mineral 500ml', 'description': '', 'price': 5.00, 'cost_price': 2.00},
                {'name': 'Cerveja Long Neck 355ml', 'description': '', 'price': 9.00, 'cost_price': 4.00},
            ]},
            {'name': 'Sobremesas', 'color': '#8B5CF6', 'sort_order': 4, 'products': [
                {'name': 'Petit Gateau', 'description': 'Bolo de chocolate quente com sorvete de baunilha', 'price': 22.00, 'cost_price': 8.00},
                {'name': 'Tiramisu', 'description': 'Sobremesa italiana com mascarpone e cafe', 'price': 18.00, 'cost_price': 7.00},
            ]},
        ]
    },
    'hamburgueria': {
        'categories': [
            {'name': 'Hamburgeres', 'color': '#F59E0B', 'sort_order': 1, 'products': [
                {'name': 'X-Burguer', 'description': 'Pao brioche, hamburguer 150g, queijo, alface e tomate', 'price': 28.00, 'cost_price': 11.00},
                {'name': 'X-Bacon', 'description': 'Pao brioche, hamburguer 150g, bacon crocante e molho especial', 'price': 35.00, 'cost_price': 14.00},
                {'name': 'X-Tudo', 'description': 'Pao, hamburguer 200g, bacon, ovo, queijo, alface e tomate', 'price': 42.00, 'cost_price': 17.00},
                {'name': 'Smash Burguer', 'description': 'Dois smash de 80g, queijo americano e molho especial', 'price': 38.00, 'cost_price': 15.00},
            ]},
            {'name': 'Acompanhamentos', 'color': '#10B981', 'sort_order': 2, 'products': [
                {'name': 'Batata Frita Media', 'description': 'Porcao 250g crocante e temperada', 'price': 18.00, 'cost_price': 5.00},
                {'name': 'Batata Frita Grande', 'description': 'Porcao 400g crocante e temperada', 'price': 25.00, 'cost_price': 7.00},
                {'name': 'Onion Rings', 'description': 'Aneis de cebola empanados e crocantes', 'price': 20.00, 'cost_price': 6.00},
            ]},
            {'name': 'Bebidas', 'color': '#3B82F6', 'sort_order': 3, 'products': [
                {'name': 'Milkshake Chocolate 400ml', 'description': '', 'price': 20.00, 'cost_price': 7.00},
                {'name': 'Milkshake Morango 400ml', 'description': '', 'price': 20.00, 'cost_price': 7.00},
                {'name': 'Coca-Cola 2L', 'description': '', 'price': 14.00, 'cost_price': 7.00},
                {'name': 'Agua Mineral', 'description': '', 'price': 5.00, 'cost_price': 2.00},
            ]},
        ]
    },
    'restaurante': {
        'categories': [
            {'name': 'Entradas', 'color': '#F59E0B', 'sort_order': 1, 'products': [
                {'name': 'Tabua de Frios', 'description': 'Queijos, presunto e calabresa fatiada', 'price': 48.00, 'cost_price': 20.00},
                {'name': 'Bolinho de Bacalhau 6un', 'description': 'Tradicional com azeitona', 'price': 28.00, 'cost_price': 10.00},
                {'name': 'Caldo de Feijao', 'description': 'Caldo temperado com bacon e linguica', 'price': 18.00, 'cost_price': 6.00},
            ]},
            {'name': 'Pratos Principais', 'color': '#EF4444', 'sort_order': 2, 'products': [
                {'name': 'File ao Molho Madeira', 'description': 'File mignon, molho madeira, arroz e fritas', 'price': 72.00, 'cost_price': 28.00},
                {'name': 'Frango Grelhado', 'description': 'Peito de frango, arroz, feijao e salada', 'price': 48.00, 'cost_price': 18.00},
                {'name': 'Peixe Grelhado', 'description': 'Tilapia grelhada, arroz, pure e vinagrete', 'price': 55.00, 'cost_price': 22.00},
                {'name': 'Prato Executivo', 'description': 'Prato do dia com acompanhamentos', 'price': 38.00, 'cost_price': 14.00},
            ]},
            {'name': 'Porcoes', 'color': '#10B981', 'sort_order': 3, 'products': [
                {'name': 'Porcao de Frango 500g', 'description': 'Frango temperado, molho e fritas', 'price': 58.00, 'cost_price': 22.00},
                {'name': 'Costela Bovina 500g', 'description': 'Costelinha assada na brasa', 'price': 75.00, 'cost_price': 30.00},
                {'name': 'Calabresa Acebolada 400g', 'description': 'Linguica grelhada com cebola caramelizada', 'price': 45.00, 'cost_price': 16.00},
            ]},
            {'name': 'Bebidas', 'color': '#3B82F6', 'sort_order': 4, 'products': [
                {'name': 'Cerveja Lata 350ml', 'description': '', 'price': 8.00, 'cost_price': 4.00},
                {'name': 'Caipirinha de Limao', 'description': '', 'price': 22.00, 'cost_price': 6.00},
                {'name': 'Refrigerante 2L', 'description': '', 'price': 14.00, 'cost_price': 7.00},
                {'name': 'Agua Mineral', 'description': '', 'price': 5.00, 'cost_price': 2.00},
            ]},
        ]
    },
    'lanchonete': {
        'categories': [
            {'name': 'Lanches', 'color': '#F59E0B', 'sort_order': 1, 'products': [
                {'name': 'Misto Quente', 'description': 'Pao de forma, queijo e presunto na chapa', 'price': 12.00, 'cost_price': 4.00},
                {'name': 'Bauru', 'description': 'Pao frances, rosbife, queijo derretido e tomate', 'price': 20.00, 'cost_price': 7.00},
                {'name': 'Cachorro Quente', 'description': 'Salsicha, molho de tomate, mostarda e ketchup', 'price': 12.00, 'cost_price': 4.00},
                {'name': 'Wrap de Frango', 'description': 'Tortilla, frango desfiado, alface e cream cheese', 'price': 24.00, 'cost_price': 8.00},
            ]},
            {'name': 'Salgados', 'color': '#10B981', 'sort_order': 2, 'products': [
                {'name': 'Coxinha de Frango', 'description': '', 'price': 7.00, 'cost_price': 2.50},
                {'name': 'Esfiha de Carne', 'description': '', 'price': 6.00, 'cost_price': 2.00},
                {'name': 'Pao de Queijo 3un', 'description': '', 'price': 9.00, 'cost_price': 3.00},
                {'name': 'Pastel de Queijo', 'description': '', 'price': 8.00, 'cost_price': 2.50},
                {'name': 'Kibe Frito', 'description': '', 'price': 7.00, 'cost_price': 2.50},
            ]},
            {'name': 'Bebidas', 'color': '#3B82F6', 'sort_order': 3, 'products': [
                {'name': 'Suco de Laranja 400ml', 'description': 'Natural feito na hora', 'price': 10.00, 'cost_price': 3.00},
                {'name': 'Cafe Expresso', 'description': '', 'price': 5.00, 'cost_price': 1.50},
                {'name': 'Cappuccino 300ml', 'description': '', 'price': 9.00, 'cost_price': 3.00},
                {'name': 'Refrigerante Lata', 'description': '', 'price': 6.00, 'cost_price': 3.00},
            ]},
            {'name': 'Doces', 'color': '#EC4899', 'sort_order': 4, 'products': [
                {'name': 'Bolo de Cenoura (fatia)', 'description': 'Com cobertura de chocolate', 'price': 9.00, 'cost_price': 3.00},
                {'name': 'Pudim de Leite', 'description': 'Caseiro com calda de caramelo', 'price': 10.00, 'cost_price': 3.50},
                {'name': 'Brigadeiro 3un', 'description': '', 'price': 8.00, 'cost_price': 2.50},
            ]},
        ]
    },
    'acai': {
        'categories': [
            {'name': 'Acais', 'color': '#8B5CF6', 'sort_order': 1, 'products': [
                {'name': 'Acai 300ml', 'description': 'Creme de acai com banana e granola', 'price': 18.00, 'cost_price': 7.00},
                {'name': 'Acai 500ml', 'description': 'Creme de acai com banana e granola', 'price': 26.00, 'cost_price': 10.00},
                {'name': 'Acai 700ml', 'description': 'Creme de acai com banana e granola', 'price': 34.00, 'cost_price': 13.00},
                {'name': 'Acai 1L', 'description': 'Creme de acai com banana e granola', 'price': 44.00, 'cost_price': 17.00},
            ]},
            {'name': 'Sorvetes', 'color': '#EC4899', 'sort_order': 2, 'products': [
                {'name': 'Sorvete 1 Bola', 'description': 'Escolha o sabor', 'price': 9.00, 'cost_price': 3.00},
                {'name': 'Sorvete 2 Bolas', 'description': 'Escolha os sabores', 'price': 15.00, 'cost_price': 5.00},
                {'name': 'Sorvete 3 Bolas', 'description': 'Escolha os sabores', 'price': 20.00, 'cost_price': 7.00},
                {'name': 'Sundae Chocolate', 'description': 'Sorvete com calda de chocolate e granulado', 'price': 18.00, 'cost_price': 6.00},
            ]},
            {'name': 'Complementos', 'color': '#10B981', 'sort_order': 3, 'products': [
                {'name': 'Granola extra', 'description': '', 'price': 3.00, 'cost_price': 1.00},
                {'name': 'Leite Condensado', 'description': '', 'price': 4.00, 'cost_price': 1.50},
                {'name': 'Mel', 'description': '', 'price': 4.00, 'cost_price': 1.50},
                {'name': 'Morango extra', 'description': '', 'price': 5.00, 'cost_price': 2.00},
                {'name': 'Paçoca', 'description': '', 'price': 3.00, 'cost_price': 1.00},
            ]},
            {'name': 'Bebidas', 'color': '#3B82F6', 'sort_order': 4, 'products': [
                {'name': 'Vitamina de Acai 400ml', 'description': '', 'price': 18.00, 'cost_price': 6.00},
                {'name': 'Suco Natural 400ml', 'description': '', 'price': 12.00, 'cost_price': 4.00},
                {'name': 'Agua Mineral', 'description': '', 'price': 5.00, 'cost_price': 2.00},
            ]},
        ]
    },
    'outro': {
        'categories': [
            {'name': 'Produtos', 'color': '#6366F1', 'sort_order': 1, 'products': [
                {'name': 'Produto 1', 'description': 'Edite o nome e preco conforme seu cardapio', 'price': 20.00, 'cost_price': 8.00},
                {'name': 'Produto 2', 'description': 'Edite o nome e preco conforme seu cardapio', 'price': 35.00, 'cost_price': 14.00},
                {'name': 'Produto 3', 'description': 'Edite o nome e preco conforme seu cardapio', 'price': 50.00, 'cost_price': 20.00},
            ]},
            {'name': 'Bebidas', 'color': '#3B82F6', 'sort_order': 2, 'products': [
                {'name': 'Agua Mineral 500ml', 'description': '', 'price': 5.00, 'cost_price': 2.00},
                {'name': 'Refrigerante Lata', 'description': '', 'price': 6.00, 'cost_price': 3.00},
                {'name': 'Suco Natural', 'description': '', 'price': 10.00, 'cost_price': 3.50},
            ]},
        ]
    },
}

templates_json = json.dumps(TEMPLATES, ensure_ascii=False)

with open('/var/www/slimpdv/backend/server.js', 'r') as f:
    content = f.read()

new_routes = """
// ============================================================
// ONBOARDING — tenant creation with template seeding
// ============================================================

const BUSINESS_TEMPLATES = """ + templates_json + """;

// GET /api/onboarding/check-slug
app.get('/api/onboarding/check-slug', authMiddleware, async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.json({ available: false });
    const result = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/onboarding — create tenant + seed catalog (ALL rows isolated by tenant_id)
app.post('/api/onboarding', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, slug, business_type } = req.body;
    const userId = req.user.sub;
    if (!name || !slug) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'name e slug sao obrigatorios' });
    }
    const slugCheck = await client.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.json({ error: 'Identificador ja esta em uso' });
    }
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug, owner_id, is_active, trial_ends_at, plan, business_type)
       VALUES ($1, $2, $3, true, $4, 'trial', $5) RETURNING id`,
      [name.trim(), slug.trim(), userId, trialEnd.toISOString(), business_type || 'outro']
    );
    const tenantId = tenantResult.rows[0].id;
    await client.query(
      `INSERT INTO tenant_members (tenant_id, user_id, is_owner) VALUES ($1, $2, true)`,
      [tenantId, userId]
    );
    await client.query(`UPDATE profiles SET tenant_id = $1 WHERE id = $2`, [tenantId, userId]);
    await client.query(
      `INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
      [userId, tenantId]
    );
    await client.query(
      `INSERT INTO kds_global_settings (tenant_id, operation_mode, compact_mode, show_pending_column,
        sla_green_minutes, sla_yellow_minutes, cancellation_alerts_enabled, auto_print_cancellations,
        highlight_special_borders, delay_alert_enabled, delay_alert_minutes, show_party_size,
        timer_green_minutes, timer_yellow_minutes)
       VALUES ($1, 'traditional', false, true, 8, 12, true, true, true, true, 10, true, 5, 10)`,
      [tenantId]
    );
    const stations = [
      { name: 'Em Preparacao', station_type: 'prep_start', color: '#F59E0B', icon: 'ChefHat', sort_order: 1 },
      { name: 'Em Montagem', station_type: 'item_assembly', color: '#8B5CF6', icon: 'Package', sort_order: 2 },
      { name: 'Em Producao', station_type: 'assembly', color: '#3B82F6', icon: 'Flame', sort_order: 3 },
      { name: 'Finalizando', station_type: 'oven_expedite', color: '#EF4444', icon: 'Timer', sort_order: 4 },
      { name: 'Status do Pedido', station_type: 'order_status', color: '#10B981', icon: 'ClipboardCheck', sort_order: 5 },
    ];
    for (const s of stations) {
      await client.query(
        `INSERT INTO kds_stations (tenant_id, name, station_type, color, icon, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [tenantId, s.name, s.station_type, s.color, s.icon, s.sort_order]
      );
    }
    for (let i = 1; i <= 10; i++) {
      await client.query(
        `INSERT INTO tables (tenant_id, number, capacity, status) VALUES ($1, $2, 4, 'available')`,
        [tenantId, i]
      );
    }
    const template = BUSINESS_TEMPLATES[business_type] || BUSINESS_TEMPLATES['outro'];
    for (const cat of template.categories) {
      const catResult = await client.query(
        `INSERT INTO categories (tenant_id, name, color, sort_order, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [tenantId, cat.name, cat.color, cat.sort_order]
      );
      const catId = catResult.rows[0].id;
      for (let pi = 0; pi < cat.products.length; pi++) {
        const p = cat.products[pi];
        await client.query(
          `INSERT INTO products (tenant_id, category_id, name, description, price, cost_price, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
          [tenantId, catId, p.name, p.description, p.price, p.cost_price, pi]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, tenantId, trialEndsAt: trialEnd.toISOString() });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Onboarding error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

"""

# Insert before approval-requests section
target = '// ============================================================\n// APPROVAL REQUESTS'
if target in content:
    content = content.replace(target, new_routes + target, 1)
else:
    content = content + new_routes

# Update /api/tenant SELECT to include trial fields
old_q = "SELECT t.id, t.name, t.slug, tm.is_owner"
new_q = "SELECT t.id, t.name, t.slug, t.created_at, t.is_active, t.trial_ends_at, t.plan, t.business_type, tm.is_owner"
content = content.replace(old_q, new_q, 1)

# Update tenant response to include trial fields
old_map = """        res.json({
      tenants: result.rows.map(row => ({
        tenant_id: row.id,
        is_owner: row.is_owner,
        tenant: { id: row.id, name: row.name, slug: row.slug, created_at: row.created_at, is_active: row.is_active }
      }))
    });"""
new_map = """        res.json({
      tenants: result.rows.map(row => ({
        tenant_id: row.id,
        is_owner: row.is_owner,
        trial_ends_at: row.trial_ends_at,
        plan: row.plan,
        tenant: { id: row.id, name: row.name, slug: row.slug, created_at: row.created_at, is_active: row.is_active }
      }))
    });"""
content = content.replace(old_map, new_map, 1)

with open('/var/www/slimpdv/backend/server.js', 'w') as f:
    f.write(content)

print("Backend patch OK")
