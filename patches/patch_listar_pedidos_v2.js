/**
 * Patch: upgrade listar_pedidos tool
 * - Adds filters: periodo, hora_inicio, hora_fim, metodo_pagamento, order_type, cliente
 * - JOINs with payments table so AI can filter by payment method
 * - Also upgrades listar_pagamentos to support hora_inicio/hora_fim
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

// ── Safety check ──────────────────────────────────────────────────────────────
if (code.includes('// PATCH: listar_pedidos v2')) {
  console.log('listar_pedidos v2 already applied — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

// ── 1. Replace tool DEFINITION ────────────────────────────────────────────────
// Exact anchor as found in server.js (no leading spaces before {, ends with  },)
const OLD_TOOL_DEF = `{
    name: 'listar_pedidos',
    description: 'Lista pedidos com filtros.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING' },
        limite: { type: 'NUMBER' },
      }
    }
  },`;

const NEW_TOOL_DEF = `// PATCH: listar_pedidos v2
  {
    name: 'listar_pedidos',
    description: 'Lista pedidos com filtros avançados: status, período, horário, método de pagamento, tipo de pedido e cliente. Use para buscar pedidos pagos com PIX, pedidos da tarde, pedidos delivery, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'], description: 'Filtrar por status (opcional)' },
        periodo: { type: 'STRING', enum: ['hoje', '7dias', '30dias'], description: 'Período de busca (padrão: hoje)' },
        hora_inicio: { type: 'STRING', description: 'Hora de início no formato HH:MM (ex: "17:00") — filtra pedidos criados a partir desse horário' },
        hora_fim: { type: 'STRING', description: 'Hora de fim no formato HH:MM (ex: "23:59")' },
        metodo_pagamento: { type: 'STRING', description: 'Filtrar por método de pagamento: pix, dinheiro, credito, debito, voucher (opcional)' },
        order_type: { type: 'STRING', enum: ['delivery', 'takeaway', 'dine_in'], description: 'Tipo do pedido (opcional)' },
        cliente: { type: 'STRING', description: 'Nome parcial do cliente para buscar (opcional)' },
        limite: { type: 'NUMBER', description: 'Limite de resultados (padrão 30)' },
      }
    }
  },`;

if (!code.includes(OLD_TOOL_DEF)) {
  console.log('listar_pedidos tool definition anchor not found — skipping tool def replacement');
  const idx = code.indexOf("name: 'listar_pedidos'");
  if (idx >= 0) {
    const ctx = code.slice(Math.max(0, idx - 5), idx + 200);
    console.log('Context around listar_pedidos:', JSON.stringify(ctx));
  }
} else {
  code = code.replace(OLD_TOOL_DEF, NEW_TOOL_DEF);
  console.log('listar_pedidos tool definition updated');
}
// ── 2. Replace case implementation ────────────────────────────────────────────
const OLD_CASE = `case 'listar_pedidos': {
      let q = \`SELECT o.id, o.status, o.total, o.order_type, o.customer_name, o.created_at,
               t.number as mesa FROM orders o LEFT JOIN tables t ON o.table_id = t.id
               WHERE o.tenant_id = $1 AND o.is_draft = false\`;
      const params = [tenantId];
      if (args.status) { params.push(args.status); q += \` AND o.status = $\${params.length}\`; }
      q += \` ORDER BY o.created_at DESC LIMIT \${args.limite || 20}\`;
      const r = await pool.query(q, params);
      return { total: r.rowCount, pedidos: r.rows };
    }`;

const NEW_CASE = `case 'listar_pedidos': {
      const intervalMap = { hoje: '1 day', '7dias': '7 days', '30dias': '30 days' };
      const interval = intervalMap[args.periodo || 'hoje'] || '1 day';
      let q = \`SELECT DISTINCT ON (o.id) o.id, o.status, o.total, o.order_type,
               o.customer_name, o.created_at, o.display_number,
               t.number as mesa, p.payment_method as metodo_pagamento
               FROM orders o
               LEFT JOIN tables t ON o.table_id = t.id
               LEFT JOIN payments p ON p.order_id = o.id
               WHERE o.tenant_id = $1 AND o.is_draft = false
               AND o.created_at >= NOW() - INTERVAL '\${interval}'\`;
      const params = [tenantId];
      if (args.status) { params.push(args.status); q += \` AND o.status = $\${params.length}\`; }
      if (args.metodo_pagamento) { params.push(\`%\${args.metodo_pagamento}%\`); q += \` AND p.payment_method ILIKE $\${params.length}\`; }
      if (args.order_type) { params.push(args.order_type); q += \` AND o.order_type = $\${params.length}\`; }
      if (args.cliente) { params.push(\`%\${args.cliente}%\`); q += \` AND o.customer_name ILIKE $\${params.length}\`; }
      if (args.hora_inicio) { params.push(args.hora_inicio); q += \` AND (o.created_at AT TIME ZONE 'America/Sao_Paulo')::time >= $\${params.length}::time\`; }
      if (args.hora_fim)    { params.push(args.hora_fim);    q += \` AND (o.created_at AT TIME ZONE 'America/Sao_Paulo')::time <= $\${params.length}::time\`; }
      q += \` ORDER BY o.id, o.created_at DESC LIMIT \${args.limite || 30}\`;
      const r = await pool.query(q, params);
      return { total: r.rowCount, pedidos: r.rows };
    }`;

if (!code.includes(OLD_CASE)) {
  console.log('listar_pedidos case anchor not found — skipping case replacement');
  const caseIdx = code.indexOf("case 'listar_pedidos'");
  if (caseIdx >= 0) console.log('Case context:', JSON.stringify(code.slice(caseIdx, caseIdx + 300)));
} else {
  code = code.replace(OLD_CASE, NEW_CASE);
  console.log('listar_pedidos case updated');
}

// ── 3. Upgrade listar_pagamentos tool definition ──────────────────────────────
const OLD_PAG_TOOL = `'Lista pagamentos recebidos com totais por método (dinheiro, cartão, pix, etc.).',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: { type: 'STRING', enum: ['hoje', '7dias', '30dias', 'mes'], description: 'Período (padrão: hoje)' },
      }
    }`;

const NEW_PAG_TOOL = `'Lista pagamentos recebidos com totais por método (dinheiro, cartão, pix, etc.) e opcionalmente filtra por faixa de horário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: { type: 'STRING', enum: ['hoje', '7dias', '30dias', 'mes'], description: 'Período (padrão: hoje)' },
        hora_inicio: { type: 'STRING', description: 'Hora de início HH:MM para filtrar (ex: "17:00")' },
        hora_fim: { type: 'STRING', description: 'Hora de fim HH:MM (ex: "23:59")' },
      }
    }`;

if (code.includes(OLD_PAG_TOOL)) {
  code = code.replace(OLD_PAG_TOOL, NEW_PAG_TOOL);
  console.log('listar_pagamentos tool definition updated');
} else {
  console.log('listar_pagamentos tool definition — anchor not found, skipping');
}

// ── 4. Upgrade listar_pagamentos case ─────────────────────────────────────────
const OLD_PAG_CASE_START = `case 'listar_pagamentos': {
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
      );`;

const NEW_PAG_CASE_START = `case 'listar_pagamentos': {
      const intervalMap = { hoje: '1 day', '7dias': '7 days', '30dias': '30 days', mes: '30 days' };
      const interval = intervalMap[args.periodo || 'hoje'] || '1 day';
      let pq = \`SELECT p.method, p.payment_method, p.amount, p.status, p.created_at,
               o.customer_name, o.total as total_pedido
               FROM payments p
               LEFT JOIN orders o ON o.id = p.order_id
               WHERE p.tenant_id = $1 AND p.created_at >= NOW() - INTERVAL '\${interval}'\`;
      const pparams = [tenantId];
      if (args.hora_inicio) { pparams.push(args.hora_inicio); pq += \` AND (p.created_at AT TIME ZONE 'America/Sao_Paulo')::time >= $\${pparams.length}::time\`; }
      if (args.hora_fim)    { pparams.push(args.hora_fim);    pq += \` AND (p.created_at AT TIME ZONE 'America/Sao_Paulo')::time <= $\${pparams.length}::time\`; }
      pq += ' ORDER BY p.created_at DESC LIMIT 100';
      const r = await pool.query(pq, pparams);`;

if (code.includes(OLD_PAG_CASE_START)) {
  code = code.replace(OLD_PAG_CASE_START, NEW_PAG_CASE_START);
  // Also update return to include hora filters
  code = code.replace(
    `return { periodo: args.periodo || 'hoje', total_geral: totalGeral.toFixed(2), por_metodo: totais, pagamentos: r.rows };`,
    `return { periodo: args.periodo || 'hoje', hora_inicio: args.hora_inicio, hora_fim: args.hora_fim, total_geral: totalGeral.toFixed(2), por_metodo: totais, pagamentos: r.rows };`
  );
  console.log('listar_pagamentos case updated');
} else {
  console.log('listar_pagamentos case — anchor not found, skipping');
}

fs.writeFileSync(OUTPUT, code);
console.log('listar_pedidos v2 patch applied successfully');
