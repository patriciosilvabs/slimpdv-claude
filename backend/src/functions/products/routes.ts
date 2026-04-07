import { Router, Response } from 'express';
import { query } from '../../database/client.js';
import { authMiddleware } from '../../auth/middleware.js';
import { AuthRequest } from '../../auth/jwt.js';

const router = Router();

// Get all products
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const { category_id } = req.query;

    let sql = `SELECT * FROM products WHERE tenant_id = $1 AND active = true`;
    const params: any[] = [req.user.tenant_id];

    if (category_id) {
      sql += ` AND category_id = $${params.length + 1}`;
      params.push(category_id);
    }

    sql += ` ORDER BY name ASC`;

    const result = await query(sql, params);
    res.json({ products: result.rows });
  } catch (err) {
    console.error('Products fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const { id } = req.params;

    const result = await query(
      `SELECT * FROM products WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error('Product fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get categories
router.get('/categories/list', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const result = await query(
      `SELECT id, name, description, icon FROM categories
       WHERE tenant_id = $1 AND active = true
       ORDER BY sort_order ASC, name ASC`,
      [req.user.tenant_id]
    );

    res.json({ categories: result.rows });
  } catch (err) {
    console.error('Categories fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
