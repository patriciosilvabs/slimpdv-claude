import { Router, Response } from 'express';
import { query } from '../../database/client.js';
import { authMiddleware } from '../../auth/middleware.js';
import { AuthRequest } from '../../auth/jwt.js';

const router = Router();

// Ensure global_settings table exists
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.global_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      key TEXT NOT NULL,
      value JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, key)
    )
  `);
}
ensureTable().catch(err => console.error('Failed to create global_settings table:', err));

// GET /api/settings/:key
router.get('/:key', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const result = await query(
      'SELECT value FROM global_settings WHERE tenant_id = $1 AND key = $2',
      [req.user.tenant_id, req.params.key]
    );

    res.json({ value: result.rows[0]?.value || null });
  } catch (err) {
    console.error('Settings fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings/:key
router.put('/:key', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const { value } = req.body;

    await query(`
      INSERT INTO global_settings (tenant_id, key, value)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [req.user.tenant_id, req.params.key, JSON.stringify(value)]);

    res.json({ success: true });
  } catch (err) {
    console.error('Settings save error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
