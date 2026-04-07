#!/usr/bin/env node
/**
 * Patch: add user management functions v3
 * Routes: /api/functions/create-user, /api/functions/admin-update-user, /api/functions/admin-delete-user
 *
 * IMPORTANT: Uses dynamic import() — NOT require() — because server.js is an ES Module.
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

// Remove any previous version of this patch (old require()-based code)
// so we can always re-apply with the latest version
const OLD_PATCH_START = '// ============================================================\n// PATCH: user management functions (create-user, admin-update-user, admin-delete-user)';
const REALTIME_ANCHOR = `// ============================================================
// REALTIME: stub para evitar erros 404
app.all('/realtime/v1/*', (req, res) => res.json({}));`;

if (code.includes(OLD_PATCH_START)) {
  // Strip everything from the old patch start up to (but not including) the REALTIME anchor
  const oldStart = code.indexOf(OLD_PATCH_START);
  const realtimePos = code.indexOf(REALTIME_ANCHOR);
  if (oldStart !== -1 && realtimePos !== -1 && oldStart < realtimePos) {
    code = code.slice(0, oldStart) + code.slice(realtimePos);
    console.log('Removed previous user management patch — will re-apply with latest version');
  }
}

// Safety check: already up to date?
if (code.includes('// PATCH: user management functions v3')) {
  console.log('Already patched v3 — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

if (!code.includes(REALTIME_ANCHOR)) {
  console.error('ERROR: REALTIME anchor not found in server.js');
  process.exit(1);
}

const NEW_ROUTES = `// ============================================================
// PATCH: user management functions v3 (create-user, admin-update-user, admin-delete-user)
// Uses dynamic import() — ESM-compatible

// Helper: hash password (ESM dynamic import chain)
async function _hashPassword(password) {
  try {
    const mod = await import('bcryptjs');
    const b = mod.default || mod;
    return await b.hash(password, 10);
  } catch (_e1) {
    try {
      const mod = await import('bcrypt');
      const b = mod.default || mod;
      return await b.hash(password, 10);
    } catch (_e2) {
      // Last resort: built-in crypto (always available in Node)
      const { createHash } = await import('node:crypto');
      console.warn('[user-mgmt] Using SHA-256 fallback — bcryptjs/bcrypt unavailable');
      return '$sha256$' + createHash('sha256').update(password).digest('hex');
    }
  }
}

// Helper: get column names for a table
async function _getColumns(pool, tableName) {
  try {
    const r = await pool.query(
      \`SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1\`,
      [tableName]
    );
    return r.rows.map(row => row.column_name);
  } catch (e) {
    console.warn('[user-mgmt] Could not read columns for', tableName, e.message);
    return [];
  }
}

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

    // Check for existing email
    const existing = await pool.query(
      \`SELECT id FROM profiles WHERE email = $1\`,
      [cleanEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash password using ESM-safe dynamic import
    const hashedPassword = await _hashPassword(password);

    // Discover which columns profiles actually has
    const profileCols = await _getColumns(pool, 'profiles');
    console.log('[create-user] profiles columns:', profileCols.join(', '));

    // Build INSERT only with columns that exist
    const insertCols = ['name'];
    const insertVals = [displayName];

    if (profileCols.includes('email')) { insertCols.push('email'); insertVals.push(cleanEmail); }
    if (profileCols.includes('encrypted_password')) { insertCols.push('encrypted_password'); insertVals.push(hashedPassword); }
    if (profileCols.includes('full_name')) { insertCols.push('full_name'); insertVals.push(displayName); }
    if (profileCols.includes('tenant_id')) { insertCols.push('tenant_id'); insertVals.push(targetTenantId); }
    // NOTE: skip 'role' column in profiles to avoid enum constraint issues

    const placeholders = insertVals.map((_, i) => \`$\${i + 1}\`).join(', ');
    const insertSQL = \`INSERT INTO profiles (\${insertCols.join(', ')}) VALUES (\${placeholders}) RETURNING id\`;
    console.log('[create-user] SQL:', insertSQL.split('VALUES')[0] + 'VALUES (...)');

    const insertResult = await pool.query(insertSQL, insertVals);
    const userId = insertResult.rows[0].id;
    console.log('[create-user] Created userId:', userId);

    // Add to tenant_members
    if (targetTenantId) {
      try {
        await pool.query(
          \`INSERT INTO tenant_members (user_id, tenant_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, user_id) DO NOTHING\`,
          [userId, targetTenantId, role || 'waiter']
        );
      } catch (e) { console.warn('[create-user] tenant_members:', e.message); }

      if (role) {
        try {
          await pool.query(
            \`INSERT INTO user_roles (user_id, role, tenant_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING\`,
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
      try { await pool.query(\`UPDATE profiles SET name=$1, updated_at=NOW() WHERE id=$2\`, [d, userId]); } catch (e) { console.warn('[update-user] name:', e.message); }
      try { await pool.query(\`UPDATE profiles SET full_name=$1 WHERE id=$2\`, [d, userId]); } catch (_) {}
    }
    if (email) {
      const c = email.toLowerCase().trim();
      try { await pool.query(\`UPDATE profiles SET email=$1 WHERE id=$2\`, [c, userId]); } catch (_) {
        try { await pool.query(\`UPDATE auth.users SET email=$1 WHERE id=$2\`, [c, userId]); } catch (e) { console.warn('[update-user] email:', e.message); }
      }
    }
    if (password) {
      const h = await _hashPassword(password);
      try { await pool.query(\`UPDATE profiles SET encrypted_password=$1 WHERE id=$2\`, [h, userId]); } catch (_) {
        try { await pool.query(\`UPDATE auth.users SET encrypted_password=$1 WHERE id=$2\`, [h, userId]); } catch (e) { console.warn('[update-user] password:', e.message); }
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[admin-update-user] Error:', err.message);
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    return res.status(500).json({ error: err.message, pg_code: err.code });
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
    ]) {
      try { await pool.query(sql, [userId]); } catch (e) { console.warn('[delete-user]', sql.split(' ')[2], e.message); }
    }
    try { await pool.query('DELETE FROM auth.users WHERE id=$1', [userId]); } catch (_) {}

    return res.json({ success: true });
  } catch (err) {
    console.error('[admin-delete-user] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

`;

code = code.replace(REALTIME_ANCHOR, NEW_ROUTES + REALTIME_ANCHOR);
fs.writeFileSync(OUTPUT, code);
console.log('User management patch v3 applied successfully');
