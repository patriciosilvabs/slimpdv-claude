import { Router, Request, Response } from 'express';
import { query } from '../../database/client.js';
import { authMiddleware } from '../../auth/middleware.js';
import { AuthRequest } from '../../auth/jwt.js';

const router = Router();

// Get pending orders for KDS
router.get('/pending-orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const result = await query(
      `SELECT o.id, o.order_number, o.order_type, o.status, o.created_at,
              oi.id as item_id, oi.product_id, oi.quantity, oi.notes,
              p.name as product_name, p.preparation_time
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       WHERE o.tenant_id = $1
       AND o.status IN ('pending', 'preparing')
       ORDER BY o.created_at ASC`,
      [req.user.tenant_id]
    );

    res.json({ orders: result.rows });
  } catch (err) {
    console.error('KDS error:', err);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

// Mark order as ready in KDS
router.put('/order/:orderId/ready', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenant_id) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const { orderId } = req.params;

    const result = await query(
      `UPDATE orders
       SET status = 'ready', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [orderId, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: result.rows[0] });
  } catch (err) {
    console.error('KDS update error:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Get KDS device auth
router.post('/device-auth', async (req: Request, res: Response) => {
  try {
    const { device_id, tenant_id } = req.body;

    // Verificar se device existe e está ativo
    const result = await query(
      `SELECT id, device_id, name, is_active FROM kds_devices
       WHERE device_id = $1 AND tenant_id = $2 AND is_active = true`,
      [device_id, tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Device not authorized' });
    }

    res.json({
      device: result.rows[0],
      auth: 'success',
    });
  } catch (err) {
    console.error('Device auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
