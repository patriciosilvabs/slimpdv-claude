#!/usr/bin/env node
/**
 * Patch: add user management functions
 * Routes: /api/functions/create-user, /api/functions/admin-update-user, /api/functions/admin-delete-user
 *
 * The VPS backend stores users in the 'profiles' table with columns:
 *   email, encrypted_password, full_name, name, role, tenant_id (added to the base schema)
 * Password hashing uses the 'bcryptjs' package (not 'bcrypt').
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

// POST /api/functions/create-user — Admin creates a new user with role
app.post('/api/functions/create-user', authMiddleware, async (req, res) => {
  try {
    const { email, name, password, role, tenant_id } = req.body || {};
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, nome e senha são obrigatórios' });
    }

    // Check for existing user in profiles table
    const existing = await pool.query(
      \`SELECT id FROM profiles WHERE email = $1\`,
      [email.toLowerCase().trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const bcryptjs = require('bcryptjs');
    const hashedPassword = await bcryptjs.hash(password, 10);
    const targetTenantId = tenant_id || req.user?.tenant_id || null;
    const displayName = name.toUpperCase().trim();

    // Insert into profiles — which doubles as the users table on this VPS
    // Columns email/encrypted_password/full_name/role/tenant_id were added to profiles during VPS setup
    let userId;
    try {
      const result = await pool.query(
        \`INSERT INTO profiles (email, encrypted_password, full_name, name, role, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id\`,
        [email.toLowerCase().trim(), hashedPassword, displayName, displayName, 'user', targetTenantId]
      );
      userId = result.rows[0].id;
    } catch (profileErr) {
      // Fallback: profiles may not have all those extra columns — try minimal insert
      if (profileErr.code === '42703') {
        // Column does not exist — try inserting into auth.users first then profiles
        const authResult = await pool.query(
          \`INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
           VALUES (gen_random_uuid(), $1, $2, NOW(), NOW(), $3::jsonb)
           RETURNING id\`,
          [email.toLowerCase().trim(), hashedPassword, JSON.stringify({ name: displayName })]
        );
        userId = authResult.rows[0].id;
        await pool.query(
          \`INSERT INTO profiles (id, name, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET name=$2, updated_at=NOW()\`,
          [userId, displayName]
        );
      } else {
        throw profileErr;
      }
    }

    // Add to tenant_members
    if (targetTenantId) {
      try {
        await pool.query(
          \`INSERT INTO tenant_members (user_id, tenant_id, role) VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, user_id) DO NOTHING\`,
          [userId, targetTenantId, role || 'waiter']
        );
      } catch (tmErr) {
        console.warn('[create-user] tenant_members insert warning:', tmErr.message);
      }
      // Assign role in user_roles
      if (role) {
        try {
          await pool.query(
            \`INSERT INTO user_roles (user_id, role, tenant_id) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING\`,
            [userId, role, targetTenantId]
          );
        } catch (roleErr) {
          console.warn('[create-user] user_roles insert warning:', roleErr.message);
        }
      }
    }

    console.log('[create-user] Created user:', userId, email);
    return res.json({ user: { id: userId, email, name: displayName }, success: true });
  } catch (err) {
    console.error('[create-user] Error:', err.message, err.code);
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/admin-update-user — Admin updates user name/email/password
app.post('/api/functions/admin-update-user', authMiddleware, async (req, res) => {
  try {
    const { userId, name, email, password } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });

    if (name) {
      const displayName = name.toUpperCase().trim();
      // Update both name and full_name (whichever columns exist)
      await pool.query(\`UPDATE profiles SET name=$1, updated_at=NOW() WHERE id=$2\`, [displayName, userId]);
      try {
        await pool.query(\`UPDATE profiles SET full_name=$1 WHERE id=$2\`, [displayName, userId]);
      } catch (_) { /* full_name column may not exist */ }
    }
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      try {
        await pool.query(\`UPDATE profiles SET email=$1 WHERE id=$2\`, [cleanEmail, userId]);
      } catch (_) {
        // email column may be on auth.users instead
        await pool.query(\`UPDATE auth.users SET email=$1 WHERE id=$2\`, [cleanEmail, userId]);
      }
    }
    if (password) {
      const bcryptjs = require('bcryptjs');
      const hashedPassword = await bcryptjs.hash(password, 10);
      try {
        await pool.query(\`UPDATE profiles SET encrypted_password=$1 WHERE id=$2\`, [hashedPassword, userId]);
      } catch (_) {
        // encrypted_password may be on auth.users instead
        await pool.query(\`UPDATE auth.users SET encrypted_password=$1 WHERE id=$2\`, [hashedPassword, userId]);
      }
    }

    console.log('[admin-update-user] Updated:', userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin-update-user] Error:', err.message);
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/admin-delete-user — Admin deletes user completely
app.post('/api/functions/admin-delete-user', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });

    // Delete in FK-safe order (most specific first)
    const deletes = [
      'DELETE FROM user_permissions WHERE user_id=$1',
      'DELETE FROM user_roles WHERE user_id=$1',
      'DELETE FROM tenant_members WHERE user_id=$1',
      'DELETE FROM profiles WHERE id=$1',
    ];
    for (const sql of deletes) {
      try { await pool.query(sql, [userId]); } catch (e) {
        console.warn('[admin-delete-user] Warning on:', sql.split(' ')[2], e.message);
      }
    }
    // Try to delete from auth.users if it exists
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
