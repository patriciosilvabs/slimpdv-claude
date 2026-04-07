#!/usr/bin/env node
/**
 * Patch: Web Push notifications (v3)
 *
 * Adds:
 *  - push_subscriptions table migration
 *  - GET    /api/push/vapid-public-key  (+ alias /push/vapid-public-key)
 *  - POST   /api/push/subscribe         (+ alias /push/subscribe)
 *  - DELETE /api/push/unsubscribe       (+ alias /push/unsubscribe)
 *  - Internal sendPushToTenant(tenantId, payload) helper
 *  - Calls sendPushToTenant when order status changes to 'ready'
 *
 * Routes are registered at BOTH /api/push/* and /push/* so that the backend
 * works regardless of whether nginx keeps or strips the /api/ prefix.
 */
const fs = require('fs');

const INPUT  = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

if (code.includes('// PATCH: push_notifications_v3')) {
  console.log('push_notifications v3 already applied — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

// Upgrade v1/v2 → v3: inject standalone /api/push/* route handlers
// (does NOT touch existing /push/* routes — just adds aliases before health route)
if (code.includes('// PATCH: push_notifications_v2') || code.includes('// PATCH: push_notifications')) {
  console.log('Upgrading push_notifications to v3 (adding /api/push/* aliases)...');

  const healthAnchor = "app.get('/api/health'";
  const healthIdx = code.indexOf(healthAnchor);

  if (healthIdx === -1) {
    // Can't find anchor — update marker only and exit gracefully
    code = code
      .replace('// PATCH: push_notifications_v2\n', '// PATCH: push_notifications_v3\n')
      .replace('// PATCH: push_notifications\n', '// PATCH: push_notifications_v3\n');
    fs.writeFileSync(OUTPUT, code);
    console.log('push_notifications v3: marker updated (health anchor not found, aliases skipped)');
    process.exit(0);
  }

  // Update the safety marker
  code = code
    .replace('// PATCH: push_notifications_v2\n', '// PATCH: push_notifications_v3\n')
    .replace('// PATCH: push_notifications\n', '// PATCH: push_notifications_v3\n');

  // Inject /api/push/* aliases (standalone handlers) before the health route
  const apiAliases = `
// PATCH: push_notifications_v3 — /api/push/* aliases (nginx may keep /api/ prefix)
app.get('/api/push/vapid-public-key', function(req, res) {
  var key = process.env.VAPID_PUBLIC_KEY || null;
  res.json({ publicKey: key });
});
app.post('/api/push/subscribe', authenticateToken, async function(req, res) {
  var ep = req.body && req.body.endpoint, keys = req.body && req.body.keys;
  if (!ep || !keys || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'endpoint and keys required' });
  try {
    var tr = await pool.query('SELECT tenant_id FROM tenant_members WHERE user_id = $1 LIMIT 1', [req.user.id]);
    var tid = tr.rows[0] && tr.rows[0].tenant_id;
    if (!tid) return res.status(400).json({ error: 'No tenant found for user' });
    await pool.query('INSERT INTO push_subscriptions (tenant_id,user_id,endpoint,p256dh,auth,user_agent) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (endpoint) DO UPDATE SET tenant_id=$1,user_id=$2,p256dh=$4,auth=$5,user_agent=$6,created_at=NOW()', [tid, req.user.id, ep, keys.p256dh, keys.auth, req.headers['user-agent'] || '']);
    res.json({ success: true });
  } catch(e) { console.error('[push] subscribe error:', e.message); res.status(500).json({ error: e.message }); }
});
app.post('/api/push/unsubscribe', authenticateToken, async function(req, res) {
  var ep = req.body && req.body.endpoint;
  if (!ep) return res.status(400).json({ error: 'endpoint required' });
  try { await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [ep, req.user.id]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/push/unsubscribe', authenticateToken, async function(req, res) {
  var ep = req.body && req.body.endpoint;
  if (!ep) return res.status(400).json({ error: 'endpoint required' });
  try { await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [ep, req.user.id]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

`;

  const updatedHealthIdx = code.indexOf(healthAnchor);
  code = code.slice(0, updatedHealthIdx) + apiAliases + code.slice(updatedHealthIdx);
  fs.writeFileSync(OUTPUT, code);
  console.log('push_notifications upgraded to v3: /api/push/* aliases added before health route');
  process.exit(0);
}

// ── Find insertion anchor (after pool/app setup, before routes) ──────────────
const ANCHOR_ROUTES = "app.get('/api/health'";
const anchorIdx = code.indexOf(ANCHOR_ROUTES);
if (anchorIdx === -1) {
  console.error('ERROR: health route anchor not found');
  process.exit(1);
}

// ── Find order-ready path to inject push trigger ─────────────────────────────
// After the existing mark_item_ready handler in patch_kds_device_actions:
// We look for the order status UPDATE to 'ready' inside mark_item_ready
const ORDER_READY_ANCHOR = "\"UPDATE orders SET status = 'ready', updated_at = NOW(), ready_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('delivered','cancelled')\"";
// There may be multiple occurrences; we patch the first one in mark_item_ready
const orderReadyIdx = code.indexOf(ORDER_READY_ANCHOR);

// ── Build push infrastructure code ───────────────────────────────────────────
const pushSetup = `
// PATCH: push_notifications_v3
// ── Web Push (VAPID) setup — ESM + CJS compatible ────────────────────────────
let webpush = null;
(async () => {
  try {
    // dynamic import() works in both ESM and CJS (Node 12+)
    const mod = await import('web-push');
    webpush = mod.default || mod;
    const vapidPublic  = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail   = process.env.VAPID_EMAIL || 'mailto:admin@pdvslim.com.br';
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
      console.log('[push] web-push initialized, public key:', vapidPublic.slice(0, 20) + '...');
    } else {
      console.warn('[push] VAPID keys not set — push notifications disabled');
      webpush = null;
    }
  } catch (e) {
    console.warn('[push] web-push not available:', e.message);
    webpush = null;
  }
})();

// Create push_subscriptions table if it does not exist
(async () => {
  try {
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL,
        endpoint   TEXT NOT NULL,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(endpoint)
      )
    \`);
    console.log('[push] push_subscriptions table ready');
  } catch (e) {
    console.error('[push] Error creating push_subscriptions table:', e.message);
  }
})();

// ── Helper: send push to all subscriptions of a tenant ───────────────────────
async function sendPushToTenant(tenantId, payload) {
  if (!webpush) return;
  try {
    const rows = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = $1',
      [tenantId]
    );
    const payloadStr = JSON.stringify(payload);
    const failed = [];
    await Promise.all(rows.rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
          { TTL: 60 }
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — remove it
          failed.push(sub.id);
        } else {
          console.warn('[push] Failed to send to', sub.endpoint.slice(0, 40), err.statusCode);
        }
      }
    }));
    if (failed.length) {
      await pool.query('DELETE FROM push_subscriptions WHERE id = ANY($1)', [failed]);
    }
  } catch (e) {
    console.error('[push] sendPushToTenant error:', e.message);
  }
}

// ── GET vapid-public-key — registered at BOTH paths (nginx may keep or strip /api/) ──
const _vapidHandler = (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || null;
  res.json({ publicKey: key });
};
app.get('/push/vapid-public-key', _vapidHandler);
app.get('/api/push/vapid-public-key', _vapidHandler);

// ── POST subscribe — registered at BOTH paths ─────────────────────────────────
const _subscribeHandler = async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint and keys required' });
  }
  try {
    const tenantRes = await pool.query(
      'SELECT tenant_id FROM tenant_members WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    const tenantId = tenantRes.rows[0]?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'No tenant found for user' });

    await pool.query(\`
      INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (endpoint) DO UPDATE SET tenant_id=$1, user_id=$2, p256dh=$4, auth=$5, user_agent=$6, created_at=NOW()
    \`, [tenantId, req.user.id, endpoint, keys.p256dh, keys.auth, req.headers['user-agent'] || '']);

    res.json({ success: true });
  } catch (e) {
    console.error('[push] subscribe error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
app.post('/push/subscribe', authenticateToken, _subscribeHandler);
app.post('/api/push/subscribe', authenticateToken, _subscribeHandler);

// ── DELETE/POST unsubscribe — registered at BOTH paths ───────────────────────
const _unsubscribeHandler = async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [endpoint, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.post('/push/unsubscribe', authenticateToken, _unsubscribeHandler);
app.post('/api/push/unsubscribe', authenticateToken, _unsubscribeHandler);
app.delete('/push/unsubscribe', authenticateToken, _unsubscribeHandler);
app.delete('/api/push/unsubscribe', authenticateToken, _unsubscribeHandler);

`;

// ── Inject push trigger after order-ready UPDATE ─────────────────────────────
let patchedCode = code;

if (orderReadyIdx !== -1) {
  // Find the closing of the if block that does this update to inject the push call
  // The pattern after the UPDATE query is:  [orderId, tenantId]\n          );\n        }\n
  const afterUpdate = code.indexOf("[orderId, tenantId]", orderReadyIdx);
  if (afterUpdate !== -1) {
    const closingParen = code.indexOf('\n', afterUpdate) + 1; // after the line
    const pushTrigger = `          // PATCH: push_notifications — trigger push on order ready
          sendPushToTenant(tenantId, {
            title: '🔔 Pedido Pronto!',
            body: 'Um pedido foi finalizado e está pronto para entrega.',
            tag: 'order-ready-' + orderId,
            requireInteraction: true,
            url: '/orders',
          }).catch(() => {});
`;
    patchedCode = patchedCode.slice(0, closingParen) + pushTrigger + patchedCode.slice(closingParen);
  }
}

// ── Inject push setup before routes ──────────────────────────────────────────
const finalAnchorIdx = patchedCode.indexOf(ANCHOR_ROUTES);
patchedCode = patchedCode.slice(0, finalAnchorIdx) + pushSetup + patchedCode.slice(finalAnchorIdx);

fs.writeFileSync(OUTPUT, patchedCode);
console.log('push_notifications v3 applied: routes at BOTH /push/* and /api/push/* + subscribe/unsubscribe + order-ready trigger');
