import { Router, Response } from 'express';
import { query } from '../../database/client.js';
import { authMiddleware } from '../../auth/middleware.js';
import { AuthRequest } from '../../auth/jwt.js';

const router = Router();

// Get all orders for tenant
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const { status, table_id, limit = '50', offset = '0' } = req.query;

    let sql = `SELECT * FROM orders WHERE tenant_id = $1`;
    const params: any[] = [req.user.tenant_id];

    if (status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (table_id) {
      sql += ` AND table_id = $${params.length + 1}`;
      params.push(table_id);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    res.json({ orders: result.rows });
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const { id } = req.params;

    const result = await query(
      `SELECT * FROM orders WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    // Get order items
    const itemsResult = await query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [id]
    );

    res.json({
      order: {
        ...order,
        items: itemsResult.rows,
      },
    });
  } catch (err) {
    console.error('Order fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create order
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const { table_id, order_type, items, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must have at least one item' });
    }

    // Criar order
    const orderResult = await query(
      `INSERT INTO orders (tenant_id, table_id, order_type, status, notes)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [req.user.tenant_id, table_id || null, order_type || 'dine_in', notes || null]
    );

    const orderId = orderResult.rows[0].id;

    // Adicionar items
    const itemIds = [];
    for (const item of items) {
      const itemResult = await query(
        `INSERT INTO order_items (order_id, product_id, quantity, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [orderId, item.product_id, item.quantity, item.notes || null]
      );
      itemIds.push(itemResult.rows[0]);
    }

    res.status(201).json({
      order: {
        ...orderResult.rows[0],
        items: itemIds,
      },
    });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status
router.put('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    const result = await query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [status, id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: result.rows[0] });
  } catch (err) {
    console.error('Order update error:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

export default router;
