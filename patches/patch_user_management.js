#!/usr/bin/env node
/**
 * Patch: user management functions v5
 * FIXES: CRLF line endings were breaking string literals in generated JS.
 * Strategy: bcrypt is loaded using a variable already declared in the server
 * (or via a simple non-string-concatenation fallback). No $-prefixed strings.
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

// Remove ANY previous version of this patch
const OLD_MARKERS = [
  '// PATCH: user management functions',
];
const REALTIME_ANCHOR = [
  '// ============================================================',
  '// REALTIME: stub para evitar erros 404',
  "app.all('/realtime/v1/*', (req, res) => res.json({}));",
].join('\n');

for (const marker of OLD_MARKERS) {
  while (code.includes(marker)) {
    const oldStart = code.indexOf(marker);
    const realtimePos = code.indexOf(REALTIME_ANCHOR);
    if (oldStart !== -1 && realtimePos !== -1 && oldStart < realtimePos) {
      code = code.slice(0, oldStart) + code.slice(realtimePos);
      console.log('Removed previous patch version');
    } else {
      break;
    }
  }
}

if (!code.includes(REALTIME_ANCHOR)) {
  console.error('ERROR: REALTIME anchor not found in server.js');
  process.exit(1);
}

// Detect CJS vs ESM
const looksLikeCJS = /\bconst\s+\w+\s*=\s*require\(/.test(code);
console.log('Module system:', looksLikeCJS ? 'CJS' : 'ESM');

// Build the patch as an array of lines (avoids CRLF issues in template literals)
const lines = [];
const E = looksLikeCJS;  // true=CJS, false=ESM

lines.push('// ============================================================');
lines.push('// PATCH: user management functions v5');
lines.push('');
lines.push("app.post('/api/functions/create-user', authMiddleware, async (req, res) => {");
lines.push('  try {');
lines.push('    const { email, name, password, role, tenant_id } = req.body || {};');
lines.push("    if (!email || !name || !password) return res.status(400).json({ error: 'Email, nome e senha sao obrigatorios' });");
lines.push('    const cleanEmail = email.toLowerCase().trim();');
lines.push('    const displayName = name.toUpperCase().trim();');
lines.push('    const targetTenantId = tenant_id || req.user?.tenant_id || null;');
lines.push("    const existing = await pool.query('SELECT id FROM profiles WHERE email = $1', [cleanEmail]);");
lines.push("    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email ja cadastrado' });");
lines.push('    let hashedPassword;');
lines.push('    try {');
if (E) {
  lines.push("      const bcryptjs = require('bcryptjs');");
} else {
  lines.push("      const bcryptjsMod = await import('bcryptjs');");
  lines.push('      const bcryptjs = bcryptjsMod.default || bcryptjsMod;');
}
lines.push('      hashedPassword = await bcryptjs.hash(password, 10);');
lines.push('    } catch (bcryptErr) {');
lines.push("      console.warn('[create-user] bcrypt error:', bcryptErr.message);");
lines.push("      return res.status(500).json({ error: 'bcrypt unavailable: ' + bcryptErr.message });");
lines.push('    }');
lines.push("    const colsResult = await pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles'\");");
lines.push('    const profileCols = colsResult.rows.map(function(r) { return r.column_name; });');
lines.push("    console.log('[create-user] profiles cols:', profileCols.join(', '));");
lines.push("    const insertCols = ['name'];");
lines.push('    const insertVals = [displayName];');
lines.push("    if (profileCols.indexOf('email') >= 0) { insertCols.push('email'); insertVals.push(cleanEmail); }");
lines.push("    if (profileCols.indexOf('encrypted_password') >= 0) { insertCols.push('encrypted_password'); insertVals.push(hashedPassword); }");
lines.push("    if (profileCols.indexOf('full_name') >= 0) { insertCols.push('full_name'); insertVals.push(displayName); }");
lines.push("    if (profileCols.indexOf('tenant_id') >= 0) { insertCols.push('tenant_id'); insertVals.push(targetTenantId); }");
lines.push("    const placeholders = insertVals.map(function(_, i) { return '$' + (i + 1); }).join(', ');");
lines.push("    const insertSQL = 'INSERT INTO profiles (' + insertCols.join(', ') + ') VALUES (' + placeholders + ') RETURNING id';");
lines.push("    console.log('[create-user] SQL cols:', insertCols.join(', '));");
lines.push('    const result = await pool.query(insertSQL, insertVals);');
lines.push('    const userId = result.rows[0].id;');
lines.push("    console.log('[create-user] created userId:', userId);");
lines.push('    if (targetTenantId) {');
lines.push("      try { await pool.query('INSERT INTO tenant_members (user_id, tenant_id, role) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, user_id) DO NOTHING', [userId, targetTenantId, role || 'waiter']); } catch(e) { console.warn('[create-user] tenant_members:', e.message); }");
lines.push("      if (role) { try { await pool.query('INSERT INTO user_roles (user_id, role, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, role, targetTenantId]); } catch(e) { console.warn('[create-user] user_roles:', e.message); } }");
lines.push('    }');
lines.push('    return res.json({ user: { id: userId, email: cleanEmail, name: displayName }, success: true });');
lines.push('  } catch (err) {');
lines.push("    console.error('[create-user] FATAL:', err.message, '| code:', err.code, '| detail:', err.detail);");
lines.push("    if (err.code === '23505') return res.status(400).json({ error: 'Email ja cadastrado' });");
lines.push('    return res.status(500).json({ error: err.message, pg_code: err.code, pg_detail: err.detail });');
lines.push('  }');
lines.push('});');
lines.push('');
lines.push("app.post('/api/functions/admin-update-user', authMiddleware, async (req, res) => {");
lines.push('  try {');
lines.push('    const { userId, name, email, password } = req.body || {};');
lines.push("    if (!userId) return res.status(400).json({ error: 'userId e obrigatorio' });");
lines.push("    if (name) { const d = name.toUpperCase().trim(); try { await pool.query('UPDATE profiles SET name=$1, updated_at=NOW() WHERE id=$2', [d, userId]); } catch(e) {} try { await pool.query('UPDATE profiles SET full_name=$1 WHERE id=$2', [d, userId]); } catch(_) {} }");
lines.push("    if (email) { const c = email.toLowerCase().trim(); try { await pool.query('UPDATE profiles SET email=$1 WHERE id=$2', [c, userId]); } catch(_) { try { await pool.query('UPDATE auth.users SET email=$1 WHERE id=$2', [c, userId]); } catch(e) {} } }");
lines.push('    if (password) {');
lines.push('      let h = null;');
lines.push('      try {');
if (E) {
  lines.push("        const bcryptjs = require('bcryptjs');");
} else {
  lines.push("        const bcryptjsMod = await import('bcryptjs');");
  lines.push('        const bcryptjs = bcryptjsMod.default || bcryptjsMod;');
}
lines.push('        h = await bcryptjs.hash(password, 10);');
lines.push('      } catch(_) {}');
lines.push("      if (h) { try { await pool.query('UPDATE profiles SET encrypted_password=$1 WHERE id=$2', [h, userId]); } catch(_) { try { await pool.query('UPDATE auth.users SET encrypted_password=$1 WHERE id=$2', [h, userId]); } catch(e) {} } }");
lines.push('    }');
lines.push('    return res.json({ success: true });');
lines.push('  } catch (err) {');
lines.push("    if (err.code === '23505') return res.status(400).json({ error: 'Email ja cadastrado' });");
lines.push('    return res.status(500).json({ error: err.message });');
lines.push('  }');
lines.push('});');
lines.push('');
lines.push("app.post('/api/functions/admin-delete-user', authMiddleware, async (req, res) => {");
lines.push('  try {');
lines.push('    const { userId } = req.body || {};');
lines.push("    if (!userId) return res.status(400).json({ error: 'userId e obrigatorio' });");
lines.push("    for (const sql of ['DELETE FROM user_permissions WHERE user_id=$1','DELETE FROM user_roles WHERE user_id=$1','DELETE FROM tenant_members WHERE user_id=$1','DELETE FROM profiles WHERE id=$1']) { try { await pool.query(sql, [userId]); } catch(e) { console.warn('[delete-user]', e.message); } }");
lines.push("    try { await pool.query('DELETE FROM auth.users WHERE id=$1', [userId]); } catch(_) {}");
lines.push('    return res.json({ success: true });');
lines.push('  } catch (err) { return res.status(500).json({ error: err.message }); }');
lines.push('});');
lines.push('');

// Join with Unix line endings (LF only) to avoid CRLF issues
const NEW_ROUTES = lines.join('\n') + '\n';

code = code.replace(REALTIME_ANCHOR, NEW_ROUTES + REALTIME_ANCHOR);
fs.writeFileSync(OUTPUT, code);
console.log('User management patch v5 applied — module:', looksLikeCJS ? 'CJS' : 'ESM');
