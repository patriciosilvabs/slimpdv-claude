#!/usr/bin/env node
/**
 * Patch: add GET /api/orders/:id/dispatch-checklist endpoint
 * Returns items (products + complement options) flagged with check_on_dispatch=true
 * Supports both user JWT (authMiddleware) and KDS device auth (X-Device-Id headers)
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

if (code.includes('// PATCH: dispatch_checklist')) {
  console.log('dispatch_checklist patch already applied — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

const REALTIME_ANCHOR = '// ============================================================\n// REALTIME: stub para evitar erros 404';
if (!code.includes(REALTIME_ANCHOR)) {
  console.error('ERROR: REALTIME anchor not found');
  process.exit(1);
}

const lines = [];
lines.push('// PATCH: dispatch_checklist');
lines.push('app.get(\'/api/orders/:orderId/dispatch-checklist\', async (req, res) => {');
lines.push('  try {');
lines.push('    const { orderId } = req.params;');
lines.push('    let tenantId = null;');
lines.push('');
lines.push('    // Auth: user JWT or KDS device headers');
lines.push('    const authHeader = req.headers[\'authorization\'] || \'\';');
lines.push('    const token = authHeader.startsWith(\'Bearer \') ? authHeader.slice(7) : null;');
lines.push('    if (token) {');
lines.push('      try {');
lines.push('        const { createVerify } = await import(\'crypto\');');
lines.push('        const { default: jwt } = await import(\'jsonwebtoken\');');
lines.push('        const decoded = jwt.verify(token, process.env.JWT_SECRET || \'slimpdv-secret\');');
lines.push('        tenantId = decoded.tenant_id;');
lines.push('      } catch (e) { return res.status(401).json({ error: \'Invalid token\' }); }');
lines.push('    } else {');
lines.push('      // KDS device auth fallback');
lines.push('      const deviceId = req.headers[\'x-device-id\'];');
lines.push('      const authCode = req.headers[\'x-auth-code\'];');
lines.push('      const headerTenant = req.headers[\'x-tenant-id\'];');
lines.push('      if (deviceId && authCode) {');
lines.push('        const devRes = await pool.query(');
lines.push('          \'SELECT tenant_id FROM kds_devices WHERE device_id = $1 AND auth_code = $2\',');
lines.push('          [deviceId, authCode]');
lines.push('        );');
lines.push('        if (!devRes.rows[0]) return res.status(401).json({ error: \'Dispositivo inválido\' });');
lines.push('        tenantId = devRes.rows[0].tenant_id || headerTenant;');
lines.push('      } else {');
lines.push('        return res.status(401).json({ error: \'Unauthorized\' });');
lines.push('      }');
lines.push('    }');
lines.push('');
lines.push('    if (!tenantId) return res.status(400).json({ error: \'Tenant required\' });');
lines.push('');
lines.push('    const checklist = [];');
lines.push('');
lines.push('    // 1. Products with check_on_dispatch=true — expand their dispatch_keywords');
lines.push('    const prodRes = await pool.query(');
lines.push('      \'SELECT unnest(p.dispatch_keywords) as keyword, oi.quantity\' +');
lines.push('      \' FROM order_items oi\' +');
lines.push('      \' JOIN products p ON p.id = oi.product_id\' +');
lines.push('      \' WHERE oi.order_id = $1 AND oi.tenant_id = $2\' +');
lines.push('      \' AND p.check_on_dispatch = true\' +');
lines.push('      \' AND cardinality(p.dispatch_keywords) > 0\',');
lines.push('      [orderId, tenantId]');
lines.push('    );');
lines.push('    for (const row of prodRes.rows) {');
lines.push('      const existing = checklist.find(c => c.keyword === row.keyword);');
lines.push('      if (existing) existing.quantity += row.quantity;');
lines.push('      else checklist.push({ keyword: row.keyword, quantity: row.quantity });');
lines.push('    }');
lines.push('');
lines.push('    // 2. Complement options with check_on_dispatch=true');
lines.push('    const compRes = await pool.query(');
lines.push('      \'SELECT co.name as keyword, oi.quantity\' +');
lines.push('      \' FROM order_items oi\' +');
lines.push('      \' JOIN order_item_extras oie ON oie.order_item_id = oi.id\' +');
lines.push('      \' JOIN complement_options co ON co.id = oie.extra_id\' +');
lines.push('      \' WHERE oi.order_id = $1 AND oi.tenant_id = $2\' +');
lines.push('      \' AND co.check_on_dispatch = true\',');
lines.push('      [orderId, tenantId]');
lines.push('    );');
lines.push('    for (const row of compRes.rows) {');
lines.push('      const existing = checklist.find(c => c.keyword === row.keyword);');
lines.push('      if (existing) existing.quantity += row.quantity;');
lines.push('      else checklist.push({ keyword: row.keyword, quantity: row.quantity });');
lines.push('    }');
lines.push('');
lines.push('    res.json({ checklist });');
lines.push('  } catch (err) {');
lines.push('    console.error(\'/api/orders/:id/dispatch-checklist error:\', err.message);');
lines.push('    res.status(500).json({ error: err.message });');
lines.push('  }');
lines.push('});');
lines.push('');

const NEW_ROUTE = lines.join('\n');

code = code.replace(REALTIME_ANCHOR, function() {
  return NEW_ROUTE + REALTIME_ANCHOR;
});

fs.writeFileSync(OUTPUT, code);
console.log('dispatch_checklist patch applied: GET /api/orders/:id/dispatch-checklist');
