#!/usr/bin/env node
/**
 * Patch: add user management functions
 * Routes: /api/functions/create-user, /api/functions/admin-update-user, /api/functions/admin-delete-user
 * Anchor: inserts BEFORE the realtime stub at the end of the file
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
    const bcryptMod = require('bcrypt');
    const password_hash = await bcryptMod.hash(password, 10);
    const userId = require('crypto').randomUUID();
    const targetTenantId = tenant_id || req.user?.tenant_id || null;

    // Create user in users table
    await pool.query(
      \`INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, NOW())\`,
      [userId, email.toLowerCase().trim(), password_hash]
    );

    // Create profile
    await pool.query(
      \`INSERT INTO profiles (id, name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name=$2, updated_at=NOW()\`,
      [userId, name.toUpperCase().trim()]
    );

    // Add to tenant
    if (targetTenantId) {
      await pool.query(
        \`INSERT INTO tenant_members (user_id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING\`,
        [userId, targetTenantId]
      );
      // Assign role
      if (role) {
        await pool.query(
          \`INSERT INTO user_roles (user_id, role, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING\`,
          [userId, role, targetTenantId]
        );
      }
    }

    console.log('[create-user] Created:', userId, email);
    return res.json({ user: { id: userId, email, name }, success: true });
  } catch (err) {
    console.error('[create-user] Error:', err.message);
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
      await pool.query(
        \`UPDATE profiles SET name=$1, updated_at=NOW() WHERE id=$2\`,
        [name.toUpperCase().trim(), userId]
      );
    }
    if (email) {
      await pool.query(\`UPDATE users SET email=$1 WHERE id=$2\`, [email.toLowerCase().trim(), userId]);
    }
    if (password) {
      const bcryptMod = require('bcrypt');
      const password_hash = await bcryptMod.hash(password, 10);
      await pool.query(\`UPDATE users SET password_hash=$1 WHERE id=$2\`, [password_hash, userId]);
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

    // Delete in FK-safe order
    await pool.query(\`DELETE FROM user_permissions WHERE user_id=$1\`, [userId]);
    await pool.query(\`DELETE FROM user_roles WHERE user_id=$1\`, [userId]);
    await pool.query(\`DELETE FROM tenant_members WHERE user_id=$1\`, [userId]);
    await pool.query(\`DELETE FROM profiles WHERE id=$1\`, [userId]);
    await pool.query(\`DELETE FROM users WHERE id=$1\`, [userId]);

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
