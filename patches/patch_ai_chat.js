const fs = require('fs');

const inputFile = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
let code = fs.readFileSync(inputFile, 'utf8');

if (code.includes("app.post('/api/ai/chat'")) {
  console.log('ai/chat already present — skipping');
  fs.writeFileSync('/tmp/server_patched.js', code);
  process.exit(0);
}

const aiBlock = `
// AI ASSISTANT — POST /api/ai/chat
// Uses Google Gemini with function calling for full CRUD access
// ============================================================

const AI_TOOLS = [
  {
    name: 'listar_produtos',
    description: 'Lista produtos do cardápio com filtros opcionais. Use para buscar produtos por nome, categoria ou status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        busca: { type: 'STRING', description: 'Texto para buscar no nome do produto (opcional)' },
        categoria: { type: 'STRING', description: 'Nome da categoria para filtrar (opcional)' },
        apenas_ativos: { type: 'BOOLEAN', description: 'Se true, retorna apenas produtos ativos' },
      }
    }
  },
  {
    name: 'atualizar_preco_em_massa',
    description: 'Atualiza o preço de vários produtos de uma vez. Pode multiplicar, somar ou definir valor fixo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        operacao: { type: 'STRING', enum: ['multiplicar', 'somar', 'definir'] },
        valor: { type: 'NUMBER' },
        filtro_categoria: { type: 'STRING' },
        filtro_nome: { type: 'STRING' },
      },
      required: ['operacao', 'valor']
    }
  },
  {
    name: 'atualizar_produto',
    description: 'Atualiza campos de UM produto específico: nome, preço, descrição, status. O campo produto_id aceita UUID ou nome.',
    parameters: {
      type: 'OBJECT',
      properties: {
        produto_id: { type: 'STRING' },
        nome: { type: 'STRING' },
        preco: { type: 'NUMBER' },
        descricao: { type: 'STRING' },
        ativo: { type: 'BOOLEAN' },
        disponivel: { type: 'BOOLEAN' },
      },
      required: ['produto_id']
    }
  },
  {
    name: 'criar_produto',
    description: 'Cria um novo produto no cardápio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome: { type: 'STRING' },
        preco: { type: 'NUMBER' },
        categoria_nome: { type: 'STRING' },
        descricao: { type: 'STRING' },
        codigo_interno: { type: 'STRING' },
      },
      required: ['nome', 'preco']
    }
  },
  {
    name: 'pausar_ou_ativar_categoria',
    description: 'Pausa ou ativa todos os produtos de uma categoria.',
    parameters: {
      type: 'OBJECT',
      properties: {
        categoria_nome: { type: 'STRING' },
        acao: { type: 'STRING', enum: ['pausar', 'ativar'] },
      },
      required: ['categoria_nome', 'acao']
    }
  },
  {
    name: 'listar_categorias',
    description: 'Lista todas as categorias do cardápio.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'criar_categoria',
    description: 'Cria uma nova categoria no cardápio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome: { type: 'STRING' },
        descricao: { type: 'STRING' },
      },
      required: ['nome']
    }
  },
  {
    name: 'listar_pedidos',
    description: 'Lista pedidos com filtros.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING' },
        limite: { type: 'NUMBER' },
      }
    }
  },
  {
    name: 'atualizar_status_pedido',
    description: 'Atualiza o status de um pedido.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pedido_id: { type: 'STRING' },
        status: { type: 'STRING', enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'] },
      },
      required: ['pedido_id', 'status']
    }
  },
  {
    name: 'listar_clientes',
    description: 'Lista clientes cadastrados com busca opcional.',
    parameters: {
      type: 'OBJECT',
      properties: {
        busca: { type: 'STRING' },
        limite: { type: 'NUMBER' },
      }
    }
  },
  {
    name: 'criar_cliente',
    description: 'Cadastra um novo cliente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome: { type: 'STRING' },
        telefone: { type: 'STRING' },
        email: { type: 'STRING' },
        endereco: { type: 'STRING' },
      },
      required: ['nome']
    }
  },
  {
    name: 'relatorio_vendas',
    description: 'Gera relatório de vendas: total faturado, pedidos, produtos mais vendidos, ticket médio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: { type: 'STRING', enum: ['hoje', 'semana', 'mes', '7dias', '30dias'] },
      },
      required: ['periodo']
    }
  },
  {
    name: 'configurar_limite_pedidos',
    description: 'Define o número máximo de pedidos simultâneos abertos.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limite: { type: 'NUMBER' },
      },
      required: ['limite']
    }
  },
  {
    name: 'estatisticas_dashboard',
    description: 'Retorna estatísticas gerais: pedidos abertos, faturamento hoje, produtos ativos, clientes.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'atualizar_preco_complemento',
    description: 'Atualiza preço de opções de complemento em massa.',
    parameters: {
      type: 'OBJECT',
      properties: {
        operacao: { type: 'STRING', enum: ['multiplicar', 'somar', 'definir'] },
        valor: { type: 'NUMBER' },
        filtro_grupo: { type: 'STRING' },
      },
      required: ['operacao', 'valor']
    }
  },
  {
    name: 'buscar_item',
    description: 'Busca um item pelo nome em produtos e opções de complemento. Use sempre antes de editar quando não souber o tipo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome: { type: 'STRING' },
      },
      required: ['nome']
    }
  },
  {
    name: 'atualizar_produtos_em_massa',
    description: 'Atualiza campos de MÚLTIPLOS produtos de uma vez.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filtro_categoria: { type: 'STRING' },
        filtro_nome: { type: 'STRING' },
        descricao: { type: 'STRING' },
        ativo: { type: 'BOOLEAN' },
        disponivel: { type: 'BOOLEAN' },
      }
    }
  },
  {
    name: 'pausar_produto',
    description: 'Pausa ou ativa um produto específico pelo nome.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome_produto: { type: 'STRING' },
        acao: { type: 'STRING', enum: ['pausar', 'ativar'] },
      },
      required: ['nome_produto', 'acao']
    }
  },
  {
    name: 'atualizar_categoria',
    description: 'Edita uma categoria: renomear, mudar descrição, pausar ou ativar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        categoria_nome: { type: 'STRING' },
        novo_nome: { type: 'STRING' },
        descricao: { type: 'STRING' },
        ativa: { type: 'BOOLEAN' },
      },
      required: ['categoria_nome']
    }
  },
  {
    name: 'listar_complementos',
    description: 'Lista grupos de complemento e suas opções.',
    parameters: {
      type: 'OBJECT',
      properties: {
        busca_grupo: { type: 'STRING' },
        produto_nome: { type: 'STRING' },
      }
    }
  },
  {
    name: 'criar_grupo_complemento',
    description: 'Cria um novo grupo de complemento. Pode vincular já a um produto.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome: { type: 'STRING' },
        descricao: { type: 'STRING' },
        obrigatorio: { type: 'BOOLEAN' },
        min_selecoes: { type: 'NUMBER' },
        max_selecoes: { type: 'NUMBER' },
        produto_nome: { type: 'STRING' },
      },
      required: ['nome']
    }
  },
  {
    name: 'atualizar_grupo_complemento',
    description: 'Edita um grupo de complemento existente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        grupo_nome: { type: 'STRING' },
        novo_nome: { type: 'STRING' },
        descricao: { type: 'STRING' },
        obrigatorio: { type: 'BOOLEAN' },
        min_selecoes: { type: 'NUMBER' },
        max_selecoes: { type: 'NUMBER' },
      },
      required: ['grupo_nome']
    }
  },
  {
    name: 'criar_complemento',
    description: 'Cria uma nova opção dentro de um grupo de complemento.',
    parameters: {
      type: 'OBJECT',
      properties: {
        grupo_nome: { type: 'STRING' },
        nome: { type: 'STRING' },
        preco: { type: 'NUMBER' },
        descricao: { type: 'STRING' },
        codigo_interno: { type: 'STRING' },
        codigo_pdv: { type: 'STRING' },
        codigo_integracao: { type: 'STRING' },
        preco_custo: { type: 'NUMBER' },
      },
      required: ['grupo_nome', 'nome', 'preco']
    }
  },
  {
    name: 'atualizar_complemento',
    description: 'Edita qualquer campo de uma opção de complemento: nome, preço, descrição, ativo, códigos, custo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        opcao_id: { type: 'STRING' },
        grupo_nome: { type: 'STRING' },
        opcao_nome: { type: 'STRING' },
        novo_nome: { type: 'STRING' },
        preco: { type: 'NUMBER' },
        descricao: { type: 'STRING' },
        ativo: { type: 'BOOLEAN' },
        codigo_interno: { type: 'STRING' },
        codigo_pdv: { type: 'STRING' },
        codigo_integracao: { type: 'STRING' },
        preco_custo: { type: 'NUMBER' },
        controle_estoque: { type: 'BOOLEAN' },
      }
    }
  },
  {
    name: 'vincular_produto_grupo',
    description: 'Vincula ou desvincula um grupo de complemento a um produto.',
    parameters: {
      type: 'OBJECT',
      properties: {
        produto_nome: { type: 'STRING' },
        grupo_nome: { type: 'STRING' },
        acao: { type: 'STRING', enum: ['vincular', 'desvincular'] },
      },
      required: ['produto_nome', 'grupo_nome', 'acao']
    }
  },
];

async function executarFerramenta(nome, args, tenantId, pool) {
  switch (nome) {
    case 'listar_produtos': {
      let q = \`SELECT p.id, p.name, p.price, p.is_active, p.is_available, c.name as categoria
               FROM products p LEFT JOIN categories c ON p.category_id = c.id
               WHERE p.tenant_id = $1\`;
      const params = [tenantId];
      if (args.apenas_ativos) { q += \` AND p.is_active = true\`; }
      if (args.busca) { params.push(\`%\${args.busca}%\`); q += \` AND p.name ILIKE $\${params.length}\`; }
      if (args.categoria) { params.push(\`%\${args.categoria}%\`); q += \` AND c.name ILIKE $\${params.length}\`; }
      q += \` ORDER BY c.name, p.name LIMIT 50\`;
      const r = await pool.query(q, params);
      return { total: r.rowCount, produtos: r.rows };
    }

    case 'atualizar_preco_em_massa': {
      let setPart;
      if (args.operacao === 'multiplicar') setPart = \`price = price * \${parseFloat(args.valor)}\`;
      else if (args.operacao === 'somar') setPart = \`price = GREATEST(0, price + \${parseFloat(args.valor)})\`;
      else setPart = \`price = \${parseFloat(args.valor)}\`;
      let q = \`UPDATE products SET \${setPart}, updated_at = NOW() WHERE tenant_id = $1\`;
      const params = [tenantId];
      if (args.filtro_categoria) { params.push(\`%\${args.filtro_categoria}%\`); q += \` AND category_id IN (SELECT id FROM categories WHERE tenant_id = $1 AND name ILIKE $\${params.length})\`; }
      if (args.filtro_nome) { params.push(\`%\${args.filtro_nome}%\`); q += \` AND name ILIKE $\${params.length}\`; }
      const r = await pool.query(q, params);
      return { atualizados: r.rowCount };
    }

    case 'atualizar_produto': {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let productId = args.produto_id;
      if (!uuidRegex.test(productId)) {
        const found = await pool.query('SELECT id FROM products WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${productId}%\`]);
        if (!found.rows.length) return { erro: \`Produto "\${productId}" não encontrado\` };
        productId = found.rows[0].id;
      }
      const fields = [];
      const params = [productId, tenantId];
      if (args.nome !== undefined) { params.push(args.nome); fields.push(\`name = $\${params.length}\`); }
      if (args.preco !== undefined) { params.push(args.preco); fields.push(\`price = $\${params.length}\`); }
      if (args.descricao !== undefined) { params.push(args.descricao); fields.push(\`description = $\${params.length}\`); }
      if (args.ativo !== undefined) { params.push(args.ativo); fields.push(\`is_active = $\${params.length}\`); }
      if (args.disponivel !== undefined) { params.push(args.disponivel); fields.push(\`is_available = $\${params.length}\`); }
      if (!fields.length) return { erro: 'Nenhum campo para atualizar' };
      fields.push(\`updated_at = NOW()\`);
      const r = await pool.query(\`UPDATE products SET \${fields.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING name\`, params);
      return { atualizado: r.rows[0]?.name };
    }

    case 'criar_produto': {
      let catId = null;
      if (args.categoria_nome) {
        let cat = await pool.query('SELECT id FROM categories WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, args.categoria_nome]);
        if (cat.rows.length === 0) {
          cat = await pool.query('INSERT INTO categories (tenant_id, name) VALUES ($1,$2) RETURNING id', [tenantId, args.categoria_nome]);
        }
        catId = cat.rows[0].id;
      }
      const r = await pool.query(
        \`INSERT INTO products (tenant_id, category_id, name, price, description, internal_code)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name\`,
        [tenantId, catId, args.nome, args.preco, args.descricao || null, args.codigo_interno || null]
      );
      return { criado: r.rows[0] };
    }

    case 'pausar_ou_ativar_categoria': {
      const ativo = args.acao === 'ativar';
      const cat = await pool.query('SELECT id FROM categories WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.categoria_nome}%\`]);
      if (!cat.rows.length) return { erro: \`Categoria "\${args.categoria_nome}" não encontrada\` };
      const r = await pool.query('UPDATE products SET is_active=$1, updated_at=NOW() WHERE tenant_id=$2 AND category_id=$3', [ativo, tenantId, cat.rows[0].id]);
      return { categoria: args.categoria_nome, acao: args.acao, produtos_afetados: r.rowCount };
    }

    case 'listar_categorias': {
      const r = await pool.query(\`SELECT c.name, c.is_active, COUNT(p.id) as total_produtos
        FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1 GROUP BY c.id, c.name, c.is_active ORDER BY c.name\`, [tenantId]);
      return { categorias: r.rows };
    }

    case 'criar_categoria': {
      const r = await pool.query('INSERT INTO categories (tenant_id, name, description) VALUES ($1,$2,$3) RETURNING id, name', [tenantId, args.nome, args.descricao || null]);
      return { criada: r.rows[0] };
    }

    case 'listar_pedidos': {
      let q = \`SELECT o.id, o.status, o.total, o.order_type, o.customer_name, o.created_at,
               t.number as mesa FROM orders o LEFT JOIN tables t ON o.table_id = t.id
               WHERE o.tenant_id = $1 AND o.is_draft = false\`;
      const params = [tenantId];
      if (args.status) { params.push(args.status); q += \` AND o.status = $\${params.length}\`; }
      q += \` ORDER BY o.created_at DESC LIMIT \${args.limite || 20}\`;
      const r = await pool.query(q, params);
      return { total: r.rowCount, pedidos: r.rows };
    }

    case 'atualizar_status_pedido': {
      const r = await pool.query('UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id', [args.status, args.pedido_id, tenantId]);
      return { atualizado: !!r.rows.length };
    }

    case 'listar_clientes': {
      let q = \`SELECT id, name, phone, email, address FROM customers WHERE tenant_id = $1\`;
      const params = [tenantId];
      if (args.busca) { params.push(\`%\${args.busca}%\`); q += \` AND (name ILIKE $\${params.length} OR phone ILIKE $\${params.length})\`; }
      q += \` ORDER BY name LIMIT \${args.limite || 20}\`;
      const r = await pool.query(q, params);
      return { total: r.rowCount, clientes: r.rows };
    }

    case 'criar_cliente': {
      const r = await pool.query(
        'INSERT INTO customers (tenant_id, name, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING id, name',
        [tenantId, args.nome, args.telefone || null, args.email || null, args.endereco || null]
      );
      return { criado: r.rows[0] };
    }

    case 'relatorio_vendas': {
      const intervalMap = { hoje: '1 day', semana: '7 days', mes: '30 days', '7dias': '7 days', '30dias': '30 days' };
      const interval = intervalMap[args.periodo] || '1 day';
      const [totais, produtos] = await Promise.all([
        pool.query(\`SELECT COUNT(*) as total_pedidos, COALESCE(SUM(total),0) as faturamento,
          COUNT(*) FILTER (WHERE status='delivered') as entregues,
          COUNT(*) FILTER (WHERE status='cancelled') as cancelados,
          COALESCE(AVG(total) FILTER (WHERE status='delivered'),0) as ticket_medio
          FROM orders WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '\${interval}' AND is_draft=false\`, [tenantId]),
        pool.query(\`SELECT p.name, SUM(oi.quantity) as qtd_vendida, SUM(oi.total_price) as total
          FROM order_items oi JOIN products p ON oi.product_id = p.id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.tenant_id=$1 AND o.created_at >= NOW() - INTERVAL '\${interval}' AND o.status != 'cancelled'
          GROUP BY p.name ORDER BY qtd_vendida DESC LIMIT 10\`, [tenantId])
      ]);
      return { periodo: args.periodo, ...totais.rows[0], top_produtos: produtos.rows };
    }

    case 'configurar_limite_pedidos': {
      await pool.query(\`INSERT INTO global_settings (tenant_id, key, value) VALUES ($1, 'max_simultaneous_orders', $2::jsonb)
        ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value\`, [tenantId, JSON.stringify(args.limite)]);
      return { limite_configurado: args.limite };
    }

    case 'estatisticas_dashboard': {
      const [pedidos, produtos, clientes, faturamento] = await Promise.all([
        pool.query(\`SELECT COUNT(*) FILTER (WHERE status NOT IN ('delivered','cancelled')) as abertos,
          COUNT(*) FILTER (WHERE status='delivered' AND created_at >= NOW() - INTERVAL '1 day') as entregues_hoje
          FROM orders WHERE tenant_id=$1 AND is_draft=false\`, [tenantId]),
        pool.query(\`SELECT COUNT(*) FILTER (WHERE is_active=true) as ativos, COUNT(*) as total FROM products WHERE tenant_id=$1\`, [tenantId]),
        pool.query(\`SELECT COUNT(*) as total FROM customers WHERE tenant_id=$1\`, [tenantId]),
        pool.query(\`SELECT COALESCE(SUM(total),0) as hoje FROM orders WHERE tenant_id=$1 AND status='delivered' AND created_at >= NOW() - INTERVAL '1 day'\`, [tenantId]),
      ]);
      return { pedidos: pedidos.rows[0], produtos: produtos.rows[0], clientes: clientes.rows[0], faturamento: faturamento.rows[0] };
    }

    case 'atualizar_preco_complemento': {
      let setPart;
      if (args.operacao === 'multiplicar') setPart = \`price = price * \${parseFloat(args.valor)}\`;
      else if (args.operacao === 'somar') setPart = \`price = GREATEST(0, price + \${parseFloat(args.valor)})\`;
      else setPart = \`price = \${parseFloat(args.valor)}\`;
      let q = \`UPDATE complement_options SET \${setPart} WHERE tenant_id = $1\`;
      const params = [tenantId];
      if (args.filtro_grupo) {
        const g = await pool.query('SELECT id FROM complement_groups WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.filtro_grupo}%\`]);
        if (g.rows.length) { params.push(g.rows[0].id); q += \` AND group_id = $\${params.length}\`; }
      }
      const r = await pool.query(q, params);
      return { atualizados: r.rowCount };
    }

    case 'buscar_item': {
      const [produtos, opcoes] = await Promise.all([
        pool.query(
          \`SELECT p.id, p.name, p.price, p.is_active, 'produto' as tipo, c.name as categoria
           FROM products p LEFT JOIN categories c ON p.category_id = c.id
           WHERE p.tenant_id = $1 AND p.name ILIKE $2 LIMIT 10\`,
          [tenantId, \`%\${args.nome}%\`]
        ),
        pool.query(
          \`SELECT co.id, co.name, co.price, co.is_active, 'complemento' as tipo, cg.name as grupo
           FROM complement_options co
           JOIN complement_groups cg ON co.group_id = cg.id
           WHERE co.tenant_id = $1 AND co.name ILIKE $2 LIMIT 10\`,
          [tenantId, \`%\${args.nome}%\`]
        )
      ]);
      const resultados = [
        ...produtos.rows.map(r => ({ tipo: 'produto', nome: r.name, id: r.id, preco: r.price, ativo: r.is_active, categoria: r.categoria })),
        ...opcoes.rows.map(r => ({ tipo: 'complemento', nome: r.name, id: r.id, preco: r.price, ativo: r.is_active, grupo: r.grupo })),
      ];
      if (!resultados.length) return { encontrado: false, mensagem: \`Nenhum item encontrado com o nome "\${args.nome}"\` };
      return { encontrado: true, total: resultados.length, resultados };
    }

    case 'atualizar_produtos_em_massa': {
      const fields = [];
      const params = [tenantId];
      if (args.descricao !== undefined) { params.push(args.descricao); fields.push(\`description = $\${params.length}\`); }
      if (args.ativo !== undefined) { params.push(args.ativo); fields.push(\`is_active = $\${params.length}\`); }
      if (args.disponivel !== undefined) { params.push(args.disponivel); fields.push(\`is_available = $\${params.length}\`); }
      if (!fields.length) return { erro: 'Nenhum campo para atualizar' };
      fields.push(\`updated_at = NOW()\`);
      let q = \`UPDATE products SET \${fields.join(', ')} WHERE tenant_id = $1\`;
      if (args.filtro_categoria) {
        params.push(\`%\${args.filtro_categoria}%\`);
        q += \` AND category_id IN (SELECT id FROM categories WHERE tenant_id=$1 AND name ILIKE $\${params.length})\`;
      }
      if (args.filtro_nome) { params.push(\`%\${args.filtro_nome}%\`); q += \` AND name ILIKE $\${params.length}\`; }
      const r = await pool.query(q, params);
      return { atualizados: r.rowCount };
    }

    case 'pausar_produto': {
      const ativo = args.acao === 'ativar';
      const r = await pool.query(
        \`UPDATE products SET is_active=$1, updated_at=NOW() WHERE tenant_id=$2 AND name ILIKE $3 RETURNING name\`,
        [ativo, tenantId, \`%\${args.nome_produto}%\`]
      );
      if (!r.rowCount) return { erro: \`Produto "\${args.nome_produto}" não encontrado\` };
      return { acao: args.acao, produtos: r.rows.map(p => p.name) };
    }

    case 'atualizar_categoria': {
      const cat = await pool.query('SELECT id FROM categories WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.categoria_nome}%\`]);
      if (!cat.rows.length) return { erro: \`Categoria "\${args.categoria_nome}" não encontrada\` };
      const catId = cat.rows[0].id;
      const fields = [];
      const params = [catId];
      if (args.novo_nome !== undefined) { params.push(args.novo_nome); fields.push(\`name = $\${params.length}\`); }
      if (args.descricao !== undefined) { params.push(args.descricao); fields.push(\`description = $\${params.length}\`); }
      if (args.ativa !== undefined) { params.push(args.ativa); fields.push(\`is_active = $\${params.length}\`); }
      if (!fields.length) return { erro: 'Nenhum campo para atualizar' };
      const r = await pool.query(\`UPDATE categories SET \${fields.join(', ')} WHERE id = $1 RETURNING name\`, params);
      return { atualizada: r.rows[0]?.name };
    }

    case 'listar_complementos': {
      let q = \`SELECT cg.id as grupo_id, cg.name as grupo, cg.is_required, cg.min_selections, cg.max_selections,
               co.id as opcao_id, co.name as opcao, co.price, co.is_active
               FROM complement_groups cg
               LEFT JOIN complement_options co ON co.group_id = cg.id AND co.tenant_id = cg.tenant_id
               WHERE cg.tenant_id = $1\`;
      const params = [tenantId];
      if (args.busca_grupo) { params.push(\`%\${args.busca_grupo}%\`); q += \` AND cg.name ILIKE $\${params.length}\`; }
      if (args.produto_nome) {
        params.push(\`%\${args.produto_nome}%\`);
        q += \` AND cg.id IN (
          SELECT pcg.group_id FROM product_complement_groups pcg
          JOIN products p ON p.id = pcg.product_id
          WHERE p.tenant_id = $1 AND p.name ILIKE $\${params.length}
        )\`;
      }
      q += \` ORDER BY cg.name, co.name\`;
      const r = await pool.query(q, params);
      const grupos = {};
      for (const row of r.rows) {
        if (!grupos[row.grupo_id]) {
          grupos[row.grupo_id] = { id: row.grupo_id, nome: row.grupo, obrigatorio: row.is_required, min: row.min_selections, max: row.max_selections, opcoes: [] };
        }
        if (row.opcao_id) {
          grupos[row.grupo_id].opcoes.push({ id: row.opcao_id, nome: row.opcao, preco: row.price, ativo: row.is_active });
        }
      }
      return { grupos: Object.values(grupos) };
    }

    case 'criar_grupo_complemento': {
      const r = await pool.query(
        \`INSERT INTO complement_groups (tenant_id, name, description, is_required, min_selections, max_selections)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name\`,
        [tenantId, args.nome, args.descricao || null, args.obrigatorio || false, args.min_selecoes || 0, args.max_selecoes || 1]
      );
      const grupoId = r.rows[0].id;
      let vinculado = null;
      if (args.produto_nome) {
        const prod = await pool.query('SELECT id FROM products WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.produto_nome}%\`]);
        if (prod.rows.length) {
          await pool.query('INSERT INTO product_complement_groups (product_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [prod.rows[0].id, grupoId]);
          vinculado = args.produto_nome;
        }
      }
      return { criado: r.rows[0], vinculado_ao_produto: vinculado };
    }

    case 'atualizar_grupo_complemento': {
      const g = await pool.query('SELECT id FROM complement_groups WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.grupo_nome}%\`]);
      if (!g.rows.length) return { erro: \`Grupo "\${args.grupo_nome}" não encontrado\` };
      const fields = [];
      const params = [g.rows[0].id];
      if (args.novo_nome !== undefined) { params.push(args.novo_nome); fields.push(\`name = $\${params.length}\`); }
      if (args.descricao !== undefined) { params.push(args.descricao); fields.push(\`description = $\${params.length}\`); }
      if (args.obrigatorio !== undefined) { params.push(args.obrigatorio); fields.push(\`is_required = $\${params.length}\`); }
      if (args.min_selecoes !== undefined) { params.push(args.min_selecoes); fields.push(\`min_selections = $\${params.length}\`); }
      if (args.max_selecoes !== undefined) { params.push(args.max_selecoes); fields.push(\`max_selections = $\${params.length}\`); }
      if (!fields.length) return { erro: 'Nenhum campo para atualizar' };
      const r = await pool.query(\`UPDATE complement_groups SET \${fields.join(', ')} WHERE id = $1 RETURNING name\`, params);
      return { atualizado: r.rows[0]?.name };
    }

    case 'criar_complemento': {
      const g = await pool.query('SELECT id FROM complement_groups WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.grupo_nome}%\`]);
      if (!g.rows.length) return { erro: \`Grupo "\${args.grupo_nome}" não encontrado\` };
      const r = await pool.query(
        \`INSERT INTO complement_options (tenant_id, group_id, name, price, description, internal_code, pdv_code, external_code, cost_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name\`,
        [tenantId, g.rows[0].id, args.nome, args.preco, args.descricao || null,
         args.codigo_interno || null, args.codigo_pdv || null, args.codigo_integracao || null, args.preco_custo || 0]
      );
      await pool.query(
        \`INSERT INTO complement_group_options (group_id, option_id) VALUES ($1,$2) ON CONFLICT DO NOTHING\`,
        [g.rows[0].id, r.rows[0].id]
      ).catch(() => {});
      return { criado: r.rows[0], grupo: args.grupo_nome };
    }

    case 'atualizar_complemento': {
      let optionIds = [];
      if (args.opcao_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(args.opcao_id)) { optionIds = [args.opcao_id]; }
      }
      if (!optionIds.length && args.opcao_nome) {
        const nomeExato = args.opcao_nome.trim();
        if (args.grupo_nome) {
          const g = await pool.query('SELECT id FROM complement_groups WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.grupo_nome}%\`]);
          if (!g.rows.length) return { erro: \`Grupo "\${args.grupo_nome}" não encontrado\` };
          let o = await pool.query('SELECT id FROM complement_options WHERE tenant_id=$1 AND group_id=$2 AND name ILIKE $3', [tenantId, g.rows[0].id, nomeExato]);
          if (!o.rows.length) o = await pool.query('SELECT id FROM complement_options WHERE tenant_id=$1 AND group_id=$2 AND name ILIKE $3', [tenantId, g.rows[0].id, \`%\${nomeExato}%\`]);
          optionIds = o.rows.map(r => r.id);
        } else {
          let o = await pool.query(
            \`SELECT co.id, cg.name as grupo FROM complement_options co
             JOIN complement_groups cg ON co.group_id = cg.id
             WHERE co.tenant_id=$1 AND co.name ILIKE $2 ORDER BY cg.name\`,
            [tenantId, nomeExato]
          );
          if (!o.rows.length) {
            o = await pool.query(
              \`SELECT co.id, cg.name as grupo FROM complement_options co
               JOIN complement_groups cg ON co.group_id = cg.id
               WHERE co.tenant_id=$1 AND co.name ILIKE $2 ORDER BY cg.name\`,
              [tenantId, \`%\${nomeExato}%\`]
            );
          }
          if (!o.rows.length) return { erro: \`Opção "\${nomeExato}" não encontrada\` };
          optionIds = o.rows.map(r => r.id);
        }
      }
      if (!optionIds.length) return { erro: 'Informe opcao_id ou opcao_nome' };
      const fields = [];
      const params = [];
      if (args.novo_nome !== undefined)        { params.push(args.novo_nome);         fields.push(\`name = $\${params.length}\`); }
      if (args.preco !== undefined)            { params.push(args.preco);             fields.push(\`price = $\${params.length}\`); }
      if (args.descricao !== undefined)        { params.push(args.descricao);         fields.push(\`description = $\${params.length}\`); }
      if (args.ativo !== undefined)            { params.push(args.ativo);             fields.push(\`is_active = $\${params.length}\`); }
      if (args.codigo_interno !== undefined)   { params.push(args.codigo_interno);    fields.push(\`internal_code = $\${params.length}\`); }
      if (args.codigo_pdv !== undefined)       { params.push(args.codigo_pdv);        fields.push(\`pdv_code = $\${params.length}\`); }
      if (args.codigo_integracao !== undefined){ params.push(args.codigo_integracao); fields.push(\`external_code = $\${params.length}\`); }
      if (args.preco_custo !== undefined)      { params.push(args.preco_custo);       fields.push(\`cost_price = $\${params.length}\`); }
      if (args.controle_estoque !== undefined) { params.push(args.controle_estoque);  fields.push(\`enable_stock_control = $\${params.length}\`); }
      if (!fields.length) return { erro: 'Nenhum campo para atualizar' };
      fields.push(\`updated_at = NOW()\`);
      params.push(optionIds);
      const r = await pool.query(
        \`UPDATE complement_options SET \${fields.join(', ')} WHERE id = ANY($\${params.length}) AND tenant_id='\${tenantId}' RETURNING name\`,
        params
      );
      return { atualizados: r.rowCount, nomes: r.rows.map(x => x.name) };
    }

    case 'vincular_produto_grupo': {
      const prod = await pool.query('SELECT id FROM products WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.produto_nome}%\`]);
      if (!prod.rows.length) return { erro: \`Produto "\${args.produto_nome}" não encontrado\` };
      const grp = await pool.query('SELECT id FROM complement_groups WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1', [tenantId, \`%\${args.grupo_nome}%\`]);
      if (!grp.rows.length) return { erro: \`Grupo "\${args.grupo_nome}" não encontrado\` };
      if (args.acao === 'vincular') {
        await pool.query('INSERT INTO product_complement_groups (product_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [prod.rows[0].id, grp.rows[0].id]);
      } else {
        await pool.query('DELETE FROM product_complement_groups WHERE product_id=$1 AND group_id=$2', [prod.rows[0].id, grp.rows[0].id]);
      }
      return { acao: args.acao, produto: args.produto_nome, grupo: args.grupo_nome };
    }

    default:
      return { erro: \`Ferramenta desconhecida: \${nome}\` };
  }
}

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

  let message, history;
  if (req.body.messages && Array.isArray(req.body.messages)) {
    const msgs = req.body.messages;
    const lastMsg = msgs[msgs.length - 1];
    message = lastMsg?.content || '';
    history = msgs.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  } else {
    message = req.body.message;
    history = req.body.history || [];
  }
  if (!message) return res.status(400).json({ error: 'Mensagem vazia' });

  const keyRow = await pool.query(\`SELECT value FROM global_settings WHERE tenant_id=$1 AND key='gemini_api_key'\`, [tenantId]);
  const geminiKey = keyRow.rows[0]?.value?.replace(/^"|"$/g, '');
  if (!geminiKey) return res.status(400).json({ error: 'Chave da API Gemini não configurada. Vá em Configurações → IA Assistente.' });

  const systemPrompt = \`Você é um assistente de gestão inteligente do SlimPDV, um sistema de restaurante.
Você tem acesso total ao sistema e pode executar qualquer operação solicitada pelo gestor.
Sempre confirme o que foi feito após executar ações.
Responda sempre em português brasileiro de forma clara e objetiva.
Quando executar ações em massa, informe quantos registros foram afetados.
Se o gestor pedir algo que pode ser irreversível, execute sem pedir confirmação — o gestor já sabe o que está fazendo.

REGRA FUNDAMENTAL — PRODUTOS vs OPÇÕES:
O sistema tem DOIS tipos de itens:
1. PRODUTOS — itens principais do cardápio. Use: listar_produtos, criar_produto, atualizar_produto, pausar_produto
2. OPÇÕES DE COMPLEMENTO — sabores, tamanhos, adicionais. Use: buscar_item, listar_complementos, criar_complemento, atualizar_complemento

REGRAS:
- Se o gestor mencionar SABORES → são SEMPRE opções de complemento.
- Se o nome contém (G), (M), (P) ou sufixo de tamanho → é SEMPRE opção de complemento.
- ANTES de editar qualquer item com tipo incerto → chame buscar_item(nome) primeiro.\`;

  const contents = [...history, { role: 'user', parts: [{ text: message }] }];
  const geminiBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: [{ function_declarations: AI_TOOLS }],
    tool_config: { function_calling_config: { mode: 'AUTO' } },
  };

  try {
    let response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${geminiKey}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
    let geminiData = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', JSON.stringify(geminiData));
      return res.status(502).json({ error: geminiData.error?.message || 'Erro na API Gemini' });
    }

    const toolResults = [];
    let finalText = '';
    let loopContents = [...contents];
    const extractText = (parts) => parts.filter(p => !p.thought && p.text).map(p => p.text).join('').trim();

    for (let i = 0; i < 8; i++) {
      const candidate = geminiData.candidates?.[0];
      if (!candidate) break;
      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter(p => p.functionCall);
      if (functionCalls.length === 0) { finalText = extractText(parts); break; }

      const modelParts = parts.filter(p => !p.thought);
      loopContents.push({ role: 'model', parts: modelParts });
      const functionResponseParts = [];

      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        const result = await executarFerramenta(name, args, tenantId, pool);
        toolResults.push({ ferramenta: name, resultado: result });
        functionResponseParts.push({ functionResponse: { name, response: { result } } });
      }

      loopContents.push({ role: 'user', parts: functionResponseParts });
      response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${geminiKey}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...geminiBody, contents: loopContents }),
      });
      geminiData = await response.json();
      if (!response.ok) break;
    }

    if (!finalText && toolResults.length > 0) {
      finalText = toolResults.map(t => {
        const r = t.resultado;
        if (r?.error) return \`⚠️ \${t.ferramenta}: \${r.error}\`;
        if (r?.atualizados !== undefined) return \`✅ \${t.ferramenta}: \${r.atualizados} item(ns) atualizado(s)\`;
        if (r?.criado) return \`✅ Criado com sucesso\`;
        return \`✅ \${t.ferramenta}: concluído\`;
      }).join('\\n');
    }
    if (!finalText) finalText = 'Operação concluída.';

    const newHistory = [
      ...history,
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text: finalText }] },
    ];
    res.json({ reply: finalText, toolResults, history: newHistory });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

`;

const anchor = '// POST /api/import-menu';
if (!code.includes(anchor)) { console.error('anchor not found'); process.exit(1); }
code = code.replace(anchor, aiBlock + anchor);

fs.writeFileSync('/tmp/server_patched.js', code);
console.log('ai/chat endpoint restored (Gemini, with correct column names)');
