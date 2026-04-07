#!/usr/bin/env node
/**
 * Patch: add user management functions
 * Routes: /api/functions/create-user, /api/functions/admin-update-user, /api/functions/admin-delete-user
 *
 * Strategy:
 * - Auto-discovers profiles table columns at runtime (no schema assumptions)
 * - Tries bcryptjs → bcrypt → SHA-256 fallback
 * - Returns actual DB error details in 500 response for easy debugging
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

// Safety check: don't double-apply
if (code.includes('// PATCH: user management functions')) {
  console.log('Already patched — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

const ANCHOR = `// ============================================================
// REALTIME: stub para evitar erros 404
app.all('/realtime/v1/*', (req, res) => res.json({}));`;

if (!code.includes(ANCHOR)) {
  console.error('ERROR: REALTIME anchor not found in server.js');
  process.exit(1);
}

const NEW_ROUTES = `// ============================================================
// PATCH: user management functions (create-user, admin-update-user, admin-delete-user)

// Helper: hash password using whatever bcrypt module is available (ESM-safe)
async function _hashPassword(password) {
  try {
    const b = (await import('bcryptjs')).default;
    return await b.hash(password, 10);
  } catch (_) {}
  try {
    const b = (await import('bcrypt')).default;
    return await b.hash(password, 10);
  } catch (_) {}
  // Last resort: crypto SHA-256
  const { createHash } = await import('crypto');
  console.warn('[user-mgmt] Using SHA-256 fallback — bcryptjs/bcrypt not available');
  return '$sha256$' + createHash('sha256').update(password).digest('hex');
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

// POST /api/functions/create-user — Admin creates a new user with role
app.post('/api/functions/create-user', authMiddleware, async (req, res) => {
  try {
    const { email, name, password, role, tenant_id } = req.body || {};
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, nome e senha são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const displayName = name.toUpperCase().trim();
    const targetTenantId = tenant_id || req.user?.tenant_id || null;

    // 1. Check for existing email
    const existing = await pool.query(
      \`SELECT id FROM profiles WHERE email = $1\`,
      [cleanEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // 2. Hash password (with fallback chain)
    const hashedPassword = await _hashPassword(password);

    // 3. Discover which columns profiles actually has
    const profileCols = await _getColumns(pool, 'profiles');
    console.log('[create-user] profiles columns found:', profileCols.join(', '));

    // 4. Build INSERT dynamically — only use columns that exist
    //    Always insert 'name' (original column, always present)
    const insertCols = ['name'];
    const insertVals = [displayName];

    if (profileCols.includes('email')) {
      insertCols.push('email');
      insertVals.push(cleanEmail);
    }
    if (profileCols.includes('encrypted_password')) {
      insertCols.push('encrypted_password');
      insertVals.push(hashedPassword);
    }
    if (profileCols.includes('full_name')) {
      insertCols.push('full_name');
      insertVals.push(displayName);
    }
    if (profileCols.includes('tenant_id')) {
      insertCols.push('tenant_id');
      insertVals.push(targetTenantId);
    }
    // NOTE: intentionally skip 'role' column in profiles to avoid enum constraint issues
    // The role is managed through user_roles and tenant_members tables

    const placeholders = insertVals.map((_, i) => \`$\${i + 1}\`).join(', ');
    const insertSQL = \`INSERT INTO profiles (\${insertCols.join(', ')}) VALUES (\${placeholders}) RETURNING id\`;

    console.log('[create-user] Running:', insertSQL.replace(hashedPassword, '***'));

    const insertResult = await pool.query(insertSQL, insertVals);
    const userId = insertResult.rows[0].id;
    console.log('[create-user] Profile created, userId:', userId);

    // 5. Add to tenant_members
    if (targetTenantId) {
      try {
        await pool.query(
          \`INSERT INTO tenant_members (user_id, tenant_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, user_id) DO NOTHING\`,
          [userId, targetTenantId, role || 'waiter']
        );
        console.log('[create-user] tenant_members OK');
      } catch (tmErr) {
        console.warn('[create-user] tenant_members warning:', tmErr.message);
      }

      // 6. Assign role in user_roles
      if (role) {
        try {
          await pool.query(
            \`INSERT INTO user_roles (user_id, role, tenant_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING\`,
            [userId, role, targetTenantId]
          );
          console.log('[create-user] user_roles OK');
        } catch (roleErr) {
          console.warn('[create-user] user_roles warning:', roleErr.message);
        }
      }
    }

    return res.json({ user: { id: userId, email: cleanEmail, name: displayName }, success: true });
  } catch (err) {
    console.error('[create-user] FATAL:', err.message, '| code:', err.code, '| detail:', err.detail);
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    // Return full error info so we can debug without needing server logs
    return res.status(500).json({
      error: err.message,
      pg_code: err.code,
      pg_detail: err.detail,
      pg_hint: err.hint,
    });
  }
});

// POST /api/functions/admin-update-user — Admin updates user name/email/password
app.post('/api/functions/admin-update-user', authMiddleware, async (req, res) => {
  try {
    const { userId, name, email, password } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });

    if (name) {
      const displayName = name.toUpperCase().trim();
      try {
        await pool.query(\`UPDATE profiles SET name=$1, updated_at=NOW() WHERE id=$2\`, [displayName, userId]);
      } catch (e) { console.warn('[admin-update-user] name update:', e.message); }
      try {
        await pool.query(\`UPDATE profiles SET full_name=$1 WHERE id=$2\`, [displayName, userId]);
      } catch (_) { /* full_name may not exist */ }
    }
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      try {
        await pool.query(\`UPDATE profiles SET email=$1 WHERE id=$2\`, [cleanEmail, userId]);
      } catch (_) {
        try {
          await pool.query(\`UPDATE auth.users SET email=$1 WHERE id=$2\`, [cleanEmail, userId]);
        } catch (e2) { console.warn('[admin-update-user] email update failed:', e2.message); }
      }
    }
    if (password) {
      const hashedPassword = await _hashPassword(password);
      try {
        await pool.query(\`UPDATE profiles SET encrypted_password=$1 WHERE id=$2\`, [hashedPassword, userId]);
      } catch (_) {
        try {
          await pool.query(\`UPDATE auth.users SET encrypted_password=$1 WHERE id=$2\`, [hashedPassword, userId]);
        } catch (e2) { console.warn('[admin-update-user] password update failed:', e2.message); }
      }
    }

    console.log('[admin-update-user] Updated:', userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin-update-user] Error:', err.message);
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    return res.status(500).json({ error: err.message, pg_code: err.code });
  }
});

// POST /api/functions/admin-delete-user — Admin deletes user completely
app.post('/api/functions/admin-delete-user', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });

    // Delete in FK-safe order
    const deletes = [
      'DELETE FROM user_permissions WHERE user_id=$1',
      'DELETE FROM user_roles WHERE user_id=$1',
      'DELETE FROM tenant_members WHERE user_id=$1',
      'DELETE FROM profiles WHERE id=$1',
    ];
    for (const sql of deletes) {
      try {
        await pool.query(sql, [userId]);
      } catch (e) {
        console.warn('[admin-delete-user] Warning on:', sql.split(' ')[2], e.message);
      }
    }
    try {
      await pool.query('DELETE FROM auth.users WHERE id=$1', [userId]);
    } catch (_) { /* auth.users may not exist */ }

    console.log('[admin-delete-user] Deleted:', userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin-delete-user] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

`;

code = code.replace(ANCHOR, NEW_ROUTES + ANCHOR);
fs.writeFileSync(OUTPUT, code);
console.log('User management patch applied successfully');
