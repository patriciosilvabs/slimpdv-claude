const fs = require('fs');

const inputFile = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
let code = fs.readFileSync(inputFile, 'utf8');

// ── NEW TOOLS to add to AI_TOOLS array ──────────────────────────────────────
const newTools = `
  {
    name: 'listar_mesas',
    description: 'Lista todas as mesas do estabelecimento com status (available/occupied/reserved) e pedido ativo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'Filtrar por status: available, occupied, reserved (opcional)' },
      }
    }
  },
  {
    name: 'atualizar_mesa',
    description: 'Atualiza o status de uma mesa.',
    parameters: {
      type: 'OBJECT',
      properties: {
        numero: { type: 'NUMBER', description: 'Número da mesa' },
        status: { type: 'STRING', enum: ['available', 'occupied', 'reserved'], description: 'Novo status' },
      },
      required: ['numero', 'status']
    }
  },
  {
    name: 'listar_usuarios',
    description: 'Lista todos os usuários/funcionários cadastrados no sistema com seus papéis.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'listar_pagamentos',
    description: 'Lista pagamentos recebidos com totais por método (dinheiro, cartão, pix, etc.).',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: { type: 'STRING', enum: ['hoje', '7dias', '30dias', 'mes'], description: 'Período (padrão: hoje)' },
      }
    }
  },
  {
    name: 'listar_estoque',
    description: 'Lista ingredientes com estoque atual, mínimo e custo. Pode filtrar ingredientes com estoque baixo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        apenas_baixo: { type: 'BOOLEAN', description: 'Se true, mostra apenas ingredientes abaixo do mínimo' },
        busca: { type: 'STRING', description: 'Buscar por nome do ingrediente (opcional)' },
      }
    }
  },
  {
    name: 'atualizar_estoque',
    description: 'Atualiza o estoque atual e/ou estoque mínimo de um ingrediente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome_ingrediente: { type: 'STRING', description: 'Nome do ingrediente' },
        estoque_atual: { type: 'NUMBER', description: 'Novo valor de estoque atual (opcional)' },
        estoque_minimo: { type: 'NUMBER', description: 'Novo valor de estoque mínimo (opcional)' },
        custo_por_unidade: { type: 'NUMBER', description: 'Novo custo por unidade (opcional)' },
      },
      required: ['nome_ingrediente']
    }
  },
  {
    name: 'listar_caixa',
    description: 'Lista os caixas registradores com status (open/closed), saldo inicial, total de vendas e recebimentos.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'listar_reservas',
    description: 'Lista reservas de mesas com data, horário, cliente e status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data: { type: 'STRING', description: 'Data no formato YYYY-MM-DD (padrão: hoje)' },
        status: { type: 'STRING', description: 'Filtrar por status: confirmed, cancelled, completed (opcional)' },
      }
    }
  },
  {
    name: 'criar_reserva',
    description: 'Cria uma nova reserva de mesa.',
    parameters: {
      type: 'OBJECT',
      properties: {
        cliente_nome: { type: 'STRING', description: 'Nome do cliente' },
        cliente_telefone: { type: 'STRING', description: 'Telefone (opcional)' },
        numero_mesa: { type: 'NUMBER', description: 'Número da mesa (opcional)' },
        data: { type: 'STRING', description: 'Data no formato YYYY-MM-DD' },
        horario: { type: 'STRING', description: 'Horário no formato HH:MM' },
        pessoas: { type: 'NUMBER', description: 'Número de pessoas (padrão 2)' },
        observacoes: { type: 'STRING', description: 'Observações (opcional)' },
      },
      required: ['cliente_nome', 'data', 'horario']
    }
  },
  {
    name: 'listar_itens_pedido',
    description: 'Lista itens detalhados de pedidos: produtos mais vendidos, quantidade, receita. Use para análises de vendas por produto.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: { type: 'STRING', enum: ['hoje', '7dias', '30dias'], description: 'Período de análise' },
        produto_nome: { type: 'STRING', description: 'Filtrar por nome do produto (opcional)' },
        limite: { type: 'NUMBER', description: 'Quantidade máxima de resultados (padrão 20)' },
      }
    }
  },
  {
    name: 'relatorio_pagamentos',
    description: 'Relatório de pagamentos agrupados por método: total em dinheiro, cartão, pix, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: { type: 'STRING', enum: ['hoje', '7dias', '30dias'], description: 'Período' },
      },
      required: ['periodo']
    }
  },
  {
    name: 'listar_variacoes',
    description: 'Lista variações de um produto (ex: tamanhos P, M, G com preços diferentes).',
    parameters: {
      type: 'OBJECT',
      properties: {
        produto_nome: { type: 'STRING', description: 'Nome do produto' },
      },
      required: ['produto_nome']
    }
  },
  {
    name: 'atualizar_variacao',
    description: 'Atualiza preço, disponibilidade ou nome de uma variação de produto.',
    parameters: {
      type: 'OBJECT',
      properties: {
        produto_nome: { type: 'STRING', description: 'Nome do produto' },
        variacao_nome: { type: 'STRING', description: 'Nome da variação (ex: "Grande", "P", "M")' },
        preco: { type: 'NUMBER', description: 'Novo preço (opcional)' },
        disponivel: { type: 'BOOLEAN', description: 'true/false disponibilidade (opcional)' },
      },
      required: ['produto_nome', 'variacao_nome']
    }
  },
  {
    name: 'listar_configuracoes',
    description: 'Lista todas as configurações gerais do sistema (horários, taxas, limites, integrações, etc.).',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'atualizar_configuracao',
    description: 'Atualiza uma configuração do sistema pelo nome da chave.',
    parameters: {
      type: 'OBJECT',
      properties: {
        chave: { type: 'STRING', description: 'Chave da configuração (ex: "delivery_fee", "min_order_value")' },
        valor: { type: 'STRING', description: 'Novo valor (será armazenado como JSON)' },
      },
      required: ['chave', 'valor']
    }
  },
  {
    name: 'listar_kds_stations',
    description: 'Lista as estações KDS (Kitchen Display System) configuradas.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'listar_movimentos_caixa',
    description: 'Lista movimentos de caixa (entradas e saídas) de um período.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: { type: 'STRING', enum: ['hoje', '7dias', '30dias'], description: 'Período' },
      }
    }
  },
`;

// ── NEW executarFerramenta CASES ─────────────────────────────────────────────
const newCases = `
    case 'listar_mesas': {
      let q = \`SELECT t.id, t.number, t.capacity, t.status,
               (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND o.status NOT IN ('delivered','cancelled') AND o.is_draft=false) as pedidos_ativos
               FROM tables t WHERE t.tenant_id = $1\`;
      const params = [tenantId];
      if (args.status) { params.push(args.status); q += \` AND t.status = $\${params.length}\`; }
      q += ' ORDER BY t.number';
      const r = await pool.query(q, params);
      return { total: r.rowCount, mesas: r.rows };
    }

    case 'atualizar_mesa': {
      const r = await pool.query(
        'UPDATE tables SET status=$1 WHERE tenant_id=$2 AND number=$3 RETURNING number, status',
        [args.status, tenantId, args.numero]
      );
      if (!r.rows.length) return { erro: \`Mesa \${args.numero} não encontrada\` };
      return { atualizada: r.rows[0] };
    }

    case 'listar_usuarios': {
      const r = await pool.query(
        \`SELECT p.id, p.email, p.full_name, p.role, p.created_at,
         COALESCE(json_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '[]'::json) as funcoes
         FROM profiles p
         LEFT JOIN user_roles ur ON ur.user_id = p.id AND ur.tenant_id = $1
         WHERE p.tenant_id = $1
         GROUP BY p.id ORDER BY p.full_name\`,
        [tenantId]
      );
      return { total: r.rowCount, usuarios: r.rows };
    }

    case 'listar_pagamentos': {
      const intervalMap = { hoje: '1 day', '7dias': '7 days', '30dias': '30 days', mes: '30 days' };
      const interval = intervalMap[args.periodo || 'hoje'] || '1 day';
      const r = await pool.query(
        \`SELECT p.method, p.payment_method, p.amount, p.status, p.created_at,
         o.customer_name, o.total as total_pedido
         FROM payments p
         LEFT JOIN orders o ON o.id = p.order_id
         WHERE p.tenant_id = $1 AND p.created_at >= NOW() - INTERVAL '\${interval}'
         ORDER BY p.created_at DESC LIMIT 50\`,
        [tenantId]
      );
      const totais = {};
      let totalGeral = 0;
      for (const row of r.rows) {
        const met = row.payment_method || row.method || 'outros';
        totais[met] = (totais[met] || 0) + parseFloat(row.amount);
        totalGeral += parseFloat(row.amount);
      }
      return { periodo: args.periodo || 'hoje', total_geral: totalGeral.toFixed(2), por_metodo: totais, pagamentos: r.rows };
    }

    case 'listar_estoque': {
      let q = \`SELECT name, unit, current_stock, min_stock, cost_per_unit,
               CASE WHEN current_stock <= min_stock THEN true ELSE false END as estoque_baixo
               FROM ingredients WHERE tenant_id = $1\`;
      const params = [tenantId];
      if (args.apenas_baixo) q += ' AND current_stock <= min_stock';
      if (args.busca) { params.push(\`%\${args.busca}%\`); q += \` AND name ILIKE $\${params.length}\`; }
      q += ' ORDER BY estoque_baixo DESC, name';
      const r = await pool.query(q, params);
      return { total: r.rowCount, ingredientes: r.rows };
    }

    case 'atualizar_estoque': {
      const ing = await pool.query('SELECT id FROM ingredients WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.nome_ingrediente}%\`]);
      if (!ing.rows.length) return { erro: \`Ingrediente "\${args.nome_ingrediente}" não encontrado\` };
      const fields = [];
      const params = [ing.rows[0].id];
      if (args.estoque_atual !== undefined) { params.push(args.estoque_atual); fields.push(\`current_stock = $\${params.length}\`); }
      if (args.estoque_minimo !== undefined) { params.push(args.estoque_minimo); fields.push(\`min_stock = $\${params.length}\`); }
      if (args.custo_por_unidade !== undefined) { params.push(args.custo_por_unidade); fields.push(\`cost_per_unit = $\${params.length}\`); }
      if (!fields.length) return { erro: 'Nenhum campo para atualizar' };
      fields.push('updated_at = NOW()');
      const r = await pool.query(\`UPDATE ingredients SET \${fields.join(', ')} WHERE id = $1 RETURNING name, current_stock, min_stock\`, params);
      return { atualizado: r.rows[0] };
    }

    case 'listar_caixa': {
      const r = await pool.query(
        \`SELECT name, status, initial_amount, final_amount, total_sales, total_received,
         opened_at, closed_at, notes
         FROM cash_registers WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10\`,
        [tenantId]
      );
      return { caixas: r.rows };
    }

    case 'listar_reservas': {
      const data = args.data || new Date().toISOString().slice(0, 10);
      let q = \`SELECT r.id, r.customer_name, r.customer_phone, r.reservation_date,
               r.reservation_time, r.party_size, r.status, r.notes,
               t.number as mesa_numero
               FROM reservations r
               LEFT JOIN tables t ON t.id = r.table_id
               WHERE r.tenant_id = $1 AND r.reservation_date = $2\`;
      const params = [tenantId, data];
      if (args.status) { params.push(args.status); q += \` AND r.status = $\${params.length}\`; }
      q += ' ORDER BY r.reservation_time';
      const r = await pool.query(q, params);
      return { data, total: r.rowCount, reservas: r.rows };
    }

    case 'criar_reserva': {
      let tableId = null;
      if (args.numero_mesa) {
        const t = await pool.query('SELECT id FROM tables WHERE tenant_id=$1 AND number=$2 LIMIT 1', [tenantId, args.numero_mesa]);
        if (t.rows.length) tableId = t.rows[0].id;
      }
      const r = await pool.query(
        \`INSERT INTO reservations (tenant_id, table_id, customer_name, customer_phone, reservation_date, reservation_time, party_size, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confirmed') RETURNING id, customer_name, reservation_date, reservation_time\`,
        [tenantId, tableId, args.cliente_nome, args.cliente_telefone || null, args.data, args.horario, args.pessoas || 2, args.observacoes || null]
      );
      return { criada: r.rows[0] };
    }

    case 'listar_itens_pedido': {
      const intervalMap = { hoje: '1 day', '7dias': '7 days', '30dias': '30 days' };
      const interval = intervalMap[args.periodo || 'hoje'] || '1 day';
      let q = \`SELECT p.name as produto, SUM(oi.quantity) as quantidade,
               SUM(oi.total_price) as receita,
               AVG(oi.unit_price) as preco_medio
               FROM order_items oi
               JOIN products p ON p.id = oi.product_id
               JOIN orders o ON o.id = oi.order_id
               WHERE o.tenant_id=$1 AND o.created_at >= NOW() - INTERVAL '\${interval}'
               AND o.status != 'cancelled' AND o.is_draft = false\`;
      const params = [tenantId];
      if (args.produto_nome) { params.push(\`%\${args.produto_nome}%\`); q += \` AND p.name ILIKE $\${params.length}\`; }
      q += \` GROUP BY p.name ORDER BY quantidade DESC LIMIT \${args.limite || 20}\`;
      const r = await pool.query(q, params);
      return { periodo: args.periodo || 'hoje', total_itens: r.rowCount, itens: r.rows };
    }

    case 'relatorio_pagamentos': {
      const intervalMap = { hoje: '1 day', '7dias': '7 days', '30dias': '30 days' };
      const interval = intervalMap[args.periodo] || '1 day';
      const r = await pool.query(
        \`SELECT COALESCE(payment_method, method, 'outros') as metodo,
         COUNT(*) as transacoes,
         SUM(amount) as total
         FROM payments
         WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '\${interval}'
         AND status = 'completed'
         GROUP BY metodo ORDER BY total DESC\`,
        [tenantId]
      );
      const totalGeral = r.rows.reduce((s, row) => s + parseFloat(row.total), 0);
      return { periodo: args.periodo, total_geral: totalGeral.toFixed(2), por_metodo: r.rows };
    }

    case 'listar_variacoes': {
      const prod = await pool.query('SELECT id, name FROM products WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.produto_nome}%\`]);
      if (!prod.rows.length) return { erro: \`Produto "\${args.produto_nome}" não encontrado\` };
      const r = await pool.query(
        'SELECT id, name, price, is_available FROM product_variations WHERE product_id=$1 ORDER BY name',
        [prod.rows[0].id]
      );
      return { produto: prod.rows[0].name, total: r.rowCount, variacoes: r.rows };
    }

    case 'atualizar_variacao': {
      const prod = await pool.query('SELECT id FROM products WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.produto_nome}%\`]);
      if (!prod.rows.length) return { erro: \`Produto "\${args.produto_nome}" não encontrado\` };
      const fields = [];
      const params = [prod.rows[0].id, \`%\${args.variacao_nome}%\`];
      if (args.preco !== undefined) { params.push(args.preco); fields.push(\`price = $\${params.length}\`); }
      if (args.disponivel !== undefined) { params.push(args.disponivel); fields.push(\`is_available = $\${params.length}\`); }
      if (!fields.length) return { erro: 'Nenhum campo para atualizar' };
      const r = await pool.query(
        \`UPDATE product_variations SET \${fields.join(', ')} WHERE product_id=$1 AND name ILIKE $2 RETURNING name, price, is_available\`,
        params
      );
      return { atualizadas: r.rowCount, variacoes: r.rows };
    }

    case 'listar_configuracoes': {
      const r = await pool.query(
        'SELECT key, value, updated_at FROM global_settings WHERE tenant_id=$1 ORDER BY key',
        [tenantId]
      );
      return { total: r.rowCount, configuracoes: r.rows };
    }

    case 'atualizar_configuracao': {
      let valorJson;
      try { valorJson = JSON.parse(args.valor); } catch { valorJson = args.valor; }
      await pool.query(
        \`INSERT INTO global_settings (tenant_id, key, value) VALUES ($1,$2,$3::jsonb)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()\`,
        [tenantId, args.chave, JSON.stringify(valorJson)]
      );
      return { atualizado: true, chave: args.chave, valor: valorJson };
    }

    case 'listar_kds_stations': {
      const r = await pool.query(
        'SELECT id, name, type, is_active, created_at FROM kds_stations WHERE tenant_id=$1 ORDER BY name',
        [tenantId]
      );
      return { total: r.rowCount, estacoes: r.rows };
    }

    case 'listar_movimentos_caixa': {
      const intervalMap = { hoje: '1 day', '7dias': '7 days', '30dias': '30 days' };
      const interval = intervalMap[args.periodo || 'hoje'] || '1 day';
      const r = await pool.query(
        \`SELECT cm.type, cm.amount, cm.description, cm.created_at, cr.name as caixa
         FROM cash_movements cm
         LEFT JOIN cash_registers cr ON cr.id = cm.cash_register_id
         WHERE cm.tenant_id=$1 AND cm.created_at >= NOW() - INTERVAL '\${interval}'
         ORDER BY cm.created_at DESC LIMIT 50\`,
        [tenantId]
      );
      const entrada = r.rows.filter(x => x.type === 'in').reduce((s, x) => s + parseFloat(x.amount), 0);
      const saida = r.rows.filter(x => x.type === 'out').reduce((s, x) => s + parseFloat(x.amount), 0);
      return { periodo: args.periodo || 'hoje', entrada: entrada.toFixed(2), saida: saida.toFixed(2), saldo: (entrada - saida).toFixed(2), movimentos: r.rows };
    }

`;

// Safety check: don't double-apply
if (code.includes("name: 'listar_mesas'")) {
  console.log('AI tools expand already applied — skipping');
  fs.writeFileSync('/tmp/server_patched.js', code);
  process.exit(0);
}

// Insert new tools before the closing ]; of AI_TOOLS
const toolsAnchor = '];\n\nasync function executarFerramenta';
if (!code.includes(toolsAnchor)) {
  console.error('AI_TOOLS closing anchor not found');
  process.exit(1);
}
code = code.replace(toolsAnchor, newTools + toolsAnchor);

// Insert new cases before the default case
const casesAnchor = "\n    default:\n      return { erro: `Ferramenta desconhecida: ${nome}` };";
if (!code.includes(casesAnchor)) {
  console.error('executarFerramenta default case anchor not found');
  process.exit(1);
}
code = code.replace(casesAnchor, newCases + casesAnchor);

fs.writeFileSync('/tmp/server_patched.js', code);
console.log('AI tools expanded: mesas, usuários, pagamentos, estoque, caixa, reservas, itens, configurações, KDS, variacoes');
