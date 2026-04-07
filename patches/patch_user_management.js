#!/usr/bin/env node
/**
 * Patch: user management functions v4
 * - Detects ESM vs CJS and uses appropriate bcrypt loading strategy
 * - Removes any previous version of this patch before re-applying
 * - Helper functions are inlined into routes (no top-level declarations)
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

// Detect module system from the compiled server.js
// CJS: contains "require(" at top level
// ESM: contains "import " statements but no require
const looksLikeCJS = /\bconst\s+\w+\s*=\s*require\(/.test(code) || /\bvar\s+\w+\s*=\s*require\(/.test(code);
console.log('Module system detected:', looksLikeCJS ? 'CJS (require)' : 'ESM (import)');

// Remove ANY previous version of this patch
const OLD_MARKERS = [
  '// PATCH: user management functions (create-user',
  '// PATCH: user management functions v3',
  '// PATCH: user management functions v4',
];
const REALTIME_ANCHOR = `// ============================================================
// REALTIME: stub para evitar erros 404
app.all('/realtime/v1/*', (req, res) => res.json({}));`;

for (const marker of OLD_MARKERS) {
  if (code.includes(marker)) {
    const oldStart = code.indexOf(marker);
    const realtimePos = code.indexOf(REALTIME_ANCHOR);
    if (oldStart !== -1 && realtimePos !== -1 && oldStart < realtimePos) {
      code = code.slice(0, oldStart) + code.slice(realtimePos);
      console.log('Removed previous patch version containing:', marker);
    }
  }
}

if (code.includes('// PATCH: user management functions v4 FINAL')) {
  console.log('Already patched v4 FINAL — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

if (!code.includes(REALTIME_ANCHOR)) {
  console.error('ERROR: REALTIME anchor not found in server.js');
  process.exit(1);
}

// Build the bcrypt loading snippet based on detected module system
const BCRYPT_LOAD = looksLikeCJS
  ? `const _bcrypt = require('bcryptjs');`
  : `const _bcryptMod = await import('bcryptjs'); const _bcrypt = _bcryptMod.default || _bcryptMod;`;

const CRYPTO_LOAD = looksLikeCJS
  ? `const _crypto = require('crypto');`
  : `const _cryptoMod = await import('crypto'); const _crypto = _cryptoMod;`;

const NEW_ROUTES = `// ============================================================
// PATCH: user management functions v4 FINAL

// POST /api/functions/create-user
app.post('/api/functions/create-user', authMiddleware, async (req, res) => {
  try {
    const { email, name, password, role, tenant_id } = req.body || {};
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, nome e senha são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const displayName = name.toUpperCase().trim();
    const targetTenantId = tenant_id || req.user?.tenant_id || null;

    // Check existing
    const existing = await pool.query('SELECT id FROM profiles WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash password — try bcryptjs first, fallback to crypto
    let hashedPassword;
    try {
      ${BCRYPT_LOAD}
      hashedPassword = await _bcrypt.hash(password, 10);
    } catch (_bcryptErr) {
      console.warn('[create-user] bcrypt failed:', _bcryptErr.message, '— using sha256 fallback');
      try {
        ${CRYPTO_LOAD}
        const salt = _crypto.randomBytes(16).toString('hex');
        hashedPassword = '$sha256$' + salt + '$' + _crypto.createHash('sha256').update(salt + password).digest('hex');
      } catch (_cryptoErr) {
        return res.status(500).json({ error: 'Password hashing unavailable: ' + _bcryptErr.message });
      }
    }

    // Discover profiles columns
    let profileCols = [];
    try {
      const colsResult = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles'"
      );
      profileCols = colsResult.rows.map(r => r.column_name);
      console.log('[create-user] profiles columns:', profileCols.join(', '));
    } catch (e) {
      console.warn('[create-user] could not read columns:', e.message);
    }

    // Build dynamic INSERT
    const insertCols = ['name'];
    const insertVals = [displayName];
    if (profileCols.includes('email'))              { insertCols.push('email');              insertVals.push(cleanEmail); }
    if (profileCols.includes('encrypted_password')) { insertCols.push('encrypted_password'); insertVals.push(hashedPassword); }
    if (profileCols.includes('full_name'))          { insertCols.push('full_name');          insertVals.push(displayName); }
    if (profileCols.includes('tenant_id'))          { insertCols.push('tenant_id');          insertVals.push(targetTenantId); }

    const placeholders = insertVals.map((_, i) => '$' + (i + 1)).join(', ');
    const insertSQL = 'INSERT INTO profiles (' + insertCols.join(', ') + ') VALUES (' + placeholders + ') RETURNING id';
    console.log('[create-user] inserting with cols:', insertCols.join(', '));

    const result = await pool.query(insertSQL, insertVals);
    const userId = result.rows[0].id;
    console.log('[create-user] created userId:', userId);

    if (targetTenantId) {
      try {
        await pool.query(
          'INSERT INTO tenant_members (user_id, tenant_id, role) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, user_id) DO NOTHING',
          [userId, targetTenantId, role || 'waiter']
        );
      } catch (e) { console.warn('[create-user] tenant_members:', e.message); }
      if (role) {
        try {
          await pool.query(
            'INSERT INTO user_roles (user_id, role, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [userId, role, targetTenantId]
          );
        } catch (e) { console.warn('[create-user] user_roles:', e.message); }
      }
    }

    return res.json({ user: { id: userId, email: cleanEmail, name: displayName }, success: true });
  } catch (err) {
    console.error('[create-user] FATAL:', err.message, '| code:', err.code, '| detail:', err.detail);
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    return res.status(500).json({ error: err.message, pg_code: err.code, pg_detail: err.detail });
  }
});

// POST /api/functions/admin-update-user
app.post('/api/functions/admin-update-user', authMiddleware, async (req, res) => {
  try {
    const { userId, name, email, password } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });
    if (name) {
      const d = name.toUpperCase().trim();
      try { await pool.query('UPDATE profiles SET name=$1, updated_at=NOW() WHERE id=$2', [d, userId]); } catch (e) {}
      try { await pool.query('UPDATE profiles SET full_name=$1 WHERE id=$2', [d, userId]); } catch (_) {}
    }
    if (email) {
      const c = email.toLowerCase().trim();
      try { await pool.query('UPDATE profiles SET email=$1 WHERE id=$2', [c, userId]); }
      catch (_) { try { await pool.query('UPDATE auth.users SET email=$1 WHERE id=$2', [c, userId]); } catch (e) {} }
    }
    if (password) {
      let h;
      try {
        ${BCRYPT_LOAD}
        h = await _bcrypt.hash(password, 10);
      } catch (_) { h = null; }
      if (h) {
        try { await pool.query('UPDATE profiles SET encrypted_password=$1 WHERE id=$2', [h, userId]); }
        catch (_) { try { await pool.query('UPDATE auth.users SET encrypted_password=$1 WHERE id=$2', [h, userId]); } catch (e) {} }
      }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin-update-user]', err.message);
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/admin-delete-user
app.post('/api/functions/admin-delete-user', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });
    for (const sql of [
      'DELETE FROM user_permissions WHERE user_id=$1',
      'DELETE FROM user_roles WHERE user_id=$1',
      'DELETE FROM tenant_members WHERE user_id=$1',
      'DELETE FROM profiles WHERE id=$1',
    ]) { try { await pool.query(sql, [userId]); } catch (e) { console.warn('[delete-user]', e.message); } }
    try { await pool.query('DELETE FROM auth.users WHERE id=$1', [userId]); } catch (_) {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

`;

code = code.replace(REALTIME_ANCHOR, NEW_ROUTES + REALTIME_ANCHOR);
fs.writeFileSync(OUTPUT, code);
console.log('User management patch v4 FINAL applied — module system:', looksLikeCJS ? 'CJS' : 'ESM');
