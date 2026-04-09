import { Router, Response, NextFunction } from 'express';
import { query } from '../../database/client.js';
import { authMiddleware, AuthRequest } from '../../auth/middleware.js';
import { getTokenFromHeader, verifyToken } from '../../auth/jwt.js';

const router = Router();

const CW_API_BASE = 'https://integracao.cardapioweb.com/api/partner/v1';

// Maps our local status to CardapioWeb endpoint action
function getEndpointForStatus(status: string): string | null {
  const map: Record<string, string> = {
    preparing: 'confirm',
    ready: 'ready',
    delivered: 'finalize',
    cancelled: 'cancel',
  };
  return map[status] || null;
}

// Optional auth: sets req.user if token present, continues anyway
function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token = getTokenFromHeader(req.headers.authorization);
    if (token) {
      try { req.user = verifyToken(token); } catch { /* invalid — ignore */ }
    }
  } catch { /* ignore */ }
  next();
}

// ── Internal sync helper (used by polling) ─────────────────────────────────
export async function syncOrderToCardapioWeb(orderId: string, newStatus: string): Promise<void> {
  const orderRes = await query(
    'SELECT id, external_source, external_order_id, tenant_id FROM orders WHERE id = $1',
    [orderId]
  );
  const order = orderRes.rows[0];
  if (!order || order.external_source !== 'cardapioweb' || !order.external_order_id) return;

  const integRes = await query(
    'SELECT api_token FROM cardapioweb_integrations WHERE tenant_id = $1 AND is_active = true LIMIT 1',
    [order.tenant_id]
  );
  const apiToken = integRes.rows[0]?.api_token;
  if (!apiToken) return;

  const endpoint = getEndpointForStatus(newStatus);
  if (!endpoint) return;

  const apiUrl = `${CW_API_BASE}/orders/${order.external_order_id}/${endpoint}`;
  console.log(`[CW-Sync] POST ${apiUrl} (order ${orderId})`);

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiToken,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const body = await resp.text();
  console.log(`[CW-Sync] Response ${resp.status}: ${body}`);
}

// ── POST /api/functions/cardapioweb-sync-status ────────────────────────────
router.post('/cardapioweb-sync-status', optionalAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { order_id, new_status, cancellation_reason } = req.body;
    console.log(`[SyncStatus] Called: order_id=${order_id} new_status=${new_status}`);

    if (!order_id || !new_status) {
      return res.status(400).json({ error: 'Missing order_id or new_status' });
    }

    // Fetch order — use tenant_id from auth token if available, else look up by order_id
    let orderRes;
    if (req.user?.tenant_id) {
      orderRes = await query(
        'SELECT id, external_source, external_order_id, tenant_id FROM orders WHERE id = $1 AND tenant_id = $2',
        [order_id, req.user.tenant_id]
      );
    } else {
      orderRes = await query(
        'SELECT id, external_source, external_order_id, tenant_id FROM orders WHERE id = $1',
        [order_id]
      );
    }

    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.external_source !== 'cardapioweb') {
      return res.json({ success: true, message: 'Not a CardapioWeb order' });
    }
    if (!order.external_order_id) {
      return res.json({ success: true, message: 'No external order ID' });
    }

    const integRes = await query(
      'SELECT api_token FROM cardapioweb_integrations WHERE tenant_id = $1 AND is_active = true LIMIT 1',
      [order.tenant_id]
    );
    const apiToken = integRes.rows[0]?.api_token;
    if (!apiToken) {
      return res.status(400).json({ error: 'CardapioWeb integration not configured' });
    }

    const endpoint = getEndpointForStatus(new_status);
    if (!endpoint) {
      return res.json({ success: true, message: 'No sync needed for this status' });
    }

    const apiUrl = `${CW_API_BASE}/orders/${order.external_order_id}/${endpoint}`;
    console.log(`[SyncStatus] Calling: ${apiUrl}`);

    const body = endpoint === 'cancel' && cancellation_reason
      ? JSON.stringify({ cancellation_reason })
      : undefined;

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    });

    const responseText = await resp.text();
    console.log(`[SyncStatus] CardapioWeb response: ${resp.status} ${responseText}`);

    if (!resp.ok) {
      return res.json({ success: false, message: `CardapioWeb API returned ${resp.status}`, error: responseText });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[SyncStatus] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/functions/cardapioweb-test-connection ───────────────────────
router.post('/cardapioweb-test-connection', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { api_token } = req.body;
    if (!api_token) return res.json({ success: false, message: 'O campo api_token é obrigatório' });

    const resp = await fetch(`${CW_API_BASE}/merchant`, {
      headers: { 'X-API-KEY': api_token, 'Accept': 'application/json' },
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.json({ success: false, message: `API retornou status ${resp.status}`, details: text });
    }

    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    return res.json({
      success: true,
      message: 'Conexão estabelecida com sucesso',
      merchantName: parsed.name || parsed.trading_name || parsed.company_name || null,
      merchantId: parsed.id || parsed.merchant_id || null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/functions/cardapioweb-save-integration ─────────────────────
router.post('/cardapioweb-save-integration', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { api_token, auto_accept, webhook_enabled } = req.body;
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });
    if (!api_token) return res.status(400).json({ error: 'api_token required' });

    // Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS cardapioweb_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL UNIQUE,
        api_token TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        auto_accept BOOLEAN DEFAULT false,
        webhook_enabled BOOLEAN DEFAULT true,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    const result = await query(
      `INSERT INTO cardapioweb_integrations (tenant_id, api_token, auto_accept, webhook_enabled, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (tenant_id) DO UPDATE SET
         api_token = EXCLUDED.api_token,
         auto_accept = EXCLUDED.auto_accept,
         webhook_enabled = EXCLUDED.webhook_enabled,
         is_active = true,
         updated_at = NOW()
       RETURNING *`,
      [tenantId, api_token, auto_accept ?? false, webhook_enabled ?? true]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error('[CW SaveIntegration] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/functions/cardapioweb-product-mappings ─────────────────────
router.post('/cardapioweb-product-mappings', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { id, local_product_id, local_variation_id } = req.body;
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    const result = await query(
      `UPDATE cardapioweb_product_mappings
       SET local_product_id = $1, local_variation_id = $2
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [local_product_id || null, local_variation_id || null, id, tenantId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Mapping not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/functions/cardapioweb-sync-orders ───────────────────────────
router.post('/cardapioweb-sync-orders', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.body;
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    const integRes = await query(
      'SELECT * FROM cardapioweb_integrations WHERE tenant_id = $1 AND is_active = true LIMIT 1',
      [tenantId]
    );
    if (!integRes.rows[0]) return res.status(404).json({ error: 'Integration not configured or inactive' });
    const integration = integRes.rows[0];

    let apiUrl = `${CW_API_BASE}/orders`;
    const params = new URLSearchParams();
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (params.toString()) apiUrl += `?${params.toString()}`;

    const ordersResp = await fetch(apiUrl, {
      headers: { 'X-API-KEY': integration.api_token, 'Accept': 'application/json' },
    });
    if (!ordersResp.ok) return res.status(502).json({ error: `CardapioWeb API error: ${ordersResp.status}` });

    const ordersData = await ordersResp.json();
    const orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []);

    // Simple import: just count — full import logic lives in the webhook handler
    return res.json({ success: true, total: orders.length, message: 'Use webhook for real-time order ingestion' });
  } catch (err: any) {
    console.error('[CW SyncOrders] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
