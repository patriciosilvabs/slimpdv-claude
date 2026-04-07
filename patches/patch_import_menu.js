const fs = require('fs');

const inputFile = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
let code = fs.readFileSync(inputFile, 'utf8');

const importMenuEndpoint = `
// POST /api/import-menu — import products/categories/groups/options from xlsx/csv
app.post('/api/import-menu', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'Tenant não encontrado' });

    // Lazy-load multer and xlsx (installed separately)
    let multerPkg, XLSX;
    try {
      multerPkg = (await import('multer')).default;
      XLSX = (await import('xlsx')).default;
    } catch (e) {
      return res.status(500).json({ error: 'Pacotes multer/xlsx não instalados no servidor. Execute: npm install multer xlsx no container.' });
    }

    // Parse multipart file upload
    const upload = multerPkg({ storage: multerPkg.memoryStorage() });
    await new Promise((resolve, reject) => {
      upload.single('file')(req, res, (err) => { if (err) reject(err); else resolve(); });
    });

    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

    // Parse spreadsheet
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet);

    const rows = rawRows.map(r => ({
      tipo: String(r['Tipo'] || '').trim().toUpperCase(),
      categoria: String(r['Categoria/Complemento'] || '').trim(),
      nome: String(r['Nome'] || '').trim(),
      codigo: String(r['Código interno'] || r['Codigo interno'] || r['Código CardápioWeb'] || r['Codigo CardapioWeb'] || '').trim(),
      preco: parseFloat(String(r['Preço'] || r['Preco'] || '0').replace(',', '.')) || 0,
    })).filter(r => r.tipo && r.nome);

    const stats = {
      categories_created: 0, products_created: 0,
      groups_created: 0, options_created: 0, links_created: 0,
      total_rows: rows.length,
      deleted: { categories: 0, products: 0, groups: 0, options: 0 },
      errors: [],
    };

    // ========== LIMPAR DADOS EXISTENTES ==========
    await pool.query('DELETE FROM product_complement_groups WHERE tenant_id=$1', [tenantId]);
    await pool.query('DELETE FROM complement_group_options WHERE tenant_id=$1', [tenantId]);
    await pool.query('DELETE FROM complement_options WHERE tenant_id=$1', [tenantId]);
    await pool.query('DELETE FROM complement_groups WHERE tenant_id=$1', [tenantId]);
    await pool.query('DELETE FROM product_variations WHERE tenant_id=$1', [tenantId]).catch(() => {});
    await pool.query('DELETE FROM products WHERE tenant_id=$1', [tenantId]);
    await pool.query('DELETE FROM categories WHERE tenant_id=$1', [tenantId]);

    // ========== PHASE 1: Coletar categorias e grupos únicos ==========
    const uniqueCategories = new Map(); // lowercase -> { name, order }
    const uniqueGroups = new Map();
    let catOrder = 0, grpOrder = 0;

    for (const row of rows) {
      if (row.tipo === 'PRODUTO') {
        const key = row.categoria.toLowerCase();
        if (!uniqueCategories.has(key)) uniqueCategories.set(key, { name: row.categoria, order: catOrder++ });
      } else if (row.tipo === 'OPÇÃO' || row.tipo === 'OPCAO') {
        const key = row.categoria.toLowerCase();
        if (!uniqueGroups.has(key)) uniqueGroups.set(key, { name: row.categoria, order: grpOrder++ });
      }
    }

    // ========== PHASE 2: Inserir categorias ==========
    const categoryCache = new Map(); // lowercase -> id
    for (const [key, val] of uniqueCategories) {
      const r = await pool.query(
        'INSERT INTO categories (name, tenant_id, is_active, sort_order) VALUES ($1,$2,true,$3) RETURNING id',
        [val.name, tenantId, val.order]
      ).catch(e => { stats.errors.push('Categoria: ' + e.message); return null; });
      if (r?.rows[0]) { categoryCache.set(key, r.rows[0].id); stats.categories_created++; }
    }

    // ========== PHASE 3: Inserir grupos de complemento ==========
    const groupCache = new Map(); // lowercase -> id
    for (const [key, val] of uniqueGroups) {
      const r = await pool.query(
        \`INSERT INTO complement_groups (name, tenant_id, is_active, selection_type, is_required, min_selections, max_selections, sort_order)
         VALUES ($1,$2,true,'multiple',false,0,10,$3) RETURNING id\`,
        [val.name, tenantId, val.order]
      ).catch(e => { stats.errors.push('Grupo: ' + e.message); return null; });
      if (r?.rows[0]) { groupCache.set(key, r.rows[0].id); stats.groups_created++; }
    }

    // ========== PHASE 4: Inserir produtos ==========
    const productIdByRowIndex = new Map(); // rowIndex -> productId

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.tipo !== 'PRODUTO') continue;
      const categoryId = categoryCache.get(row.categoria.toLowerCase());
      if (!categoryId) { stats.errors.push(\`Linha \${i+2}: Categoria "\${row.categoria}" não encontrada\`); continue; }

      // cardapioweb_code is also set from the same "Código interno" column
      const r = await pool.query(
        \`INSERT INTO products (name, price, category_id, tenant_id, is_available, preparation_time, sort_order, internal_code, cardapioweb_code)
         VALUES ($1,$2,$3,$4,true,15,$5,$6,$7) RETURNING id\`,
        [row.nome, row.preco, categoryId, tenantId, stats.products_created, row.codigo || null, row.codigo || null]
      ).catch(e => { stats.errors.push(\`Produto "\${row.nome}": \${e.message}\`); return null; });

      if (r?.rows[0]) { productIdByRowIndex.set(i, r.rows[0].id); stats.products_created++; }
    }

    // ========== PHASE 5: Inserir opções ==========
    const optionIdByIndex = new Map(); // optionInsertIndex -> optionId
    const optionMeta = []; // { groupKey, productRowIndex }
    let lastProductRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.tipo === 'PRODUTO') { lastProductRowIndex = i; continue; }
      if (row.tipo !== 'OPÇÃO' && row.tipo !== 'OPCAO') continue;
      if (lastProductRowIndex < 0 || !productIdByRowIndex.has(lastProductRowIndex)) {
        stats.errors.push(\`Linha \${i+2}: OPÇÃO sem PRODUTO anterior válido\`); continue;
      }

      const r = await pool.query(
        \`INSERT INTO complement_options (name, price, tenant_id, is_active, sort_order, internal_code, external_code)
         VALUES ($1,$2,$3,true,$4,$5,$6) RETURNING id\`,
        [row.nome, row.preco, tenantId, stats.options_created, row.codigo || null, row.codigo || null]
      ).catch(e => { stats.errors.push(\`Opção "\${row.nome}": \${e.message}\`); return null; });

      if (r?.rows[0]) {
        optionIdByIndex.set(optionMeta.length, r.rows[0].id);
        optionMeta.push({ groupKey: row.categoria.toLowerCase(), productRowIndex: lastProductRowIndex });
        stats.options_created++;
      }
    }

    // ========== PHASE 6: Ligar opções a grupos (complement_group_options) ==========
    for (let j = 0; j < optionMeta.length; j++) {
      const { groupKey } = optionMeta[j];
      const groupId = groupCache.get(groupKey);
      const optionId = optionIdByIndex.get(j);
      if (!groupId || !optionId) continue;
      await pool.query(
        'INSERT INTO complement_group_options (group_id, option_id, tenant_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [groupId, optionId, tenantId]
      ).catch(() => {});
      stats.links_created++;
    }

    // ========== PHASE 7: Ligar produtos a grupos (product_complement_groups) ==========
    const productGroupLinks = new Map(); // productId -> Set<groupId>
    for (let j = 0; j < optionMeta.length; j++) {
      const { groupKey, productRowIndex } = optionMeta[j];
      const productId = productIdByRowIndex.get(productRowIndex);
      const groupId = groupCache.get(groupKey);
      if (!productId || !groupId) continue;
      if (!productGroupLinks.has(productId)) productGroupLinks.set(productId, new Set());
      productGroupLinks.get(productId).add(groupId);
    }
    let pgOrder = 0;
    for (const [productId, groupIds] of productGroupLinks) {
      for (const groupId of groupIds) {
        await pool.query(
          'INSERT INTO product_complement_groups (product_id, group_id, tenant_id, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [productId, groupId, tenantId, pgOrder++]
        ).catch(() => {});
      }
    }

    return res.json({ success: true, stats });
  } catch (err) {
    console.error('[import-menu] error:', err.message);
    res.status(500).json({ success: false, error: err.message, stats: null });
  }
});

`;

// Insert before kds-data anchor
const anchor = '// POST /api/functions/kds-data';
if (!code.includes(anchor)) { console.error('anchor not found'); process.exit(1); }
code = code.replace(anchor, importMenuEndpoint + anchor);

fs.writeFileSync('/tmp/server_patched.js', code);
console.log('import-menu endpoint added (with cardapioweb_code from Código interno)');
