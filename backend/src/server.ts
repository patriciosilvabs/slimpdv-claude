import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import dotenv from 'dotenv';
import { testConnection, query } from './database/client.js';
import authRoutes from './auth/routes.js';
import kdsRoutes from './functions/kds/routes.js';
import ordersRoutes from './functions/orders/routes.js';
import productsRoutes from './functions/products/routes.js';
import settingsRoutes from './functions/settings/routes.js';
import cardapioWebRoutes, { syncOrderToCardapioWeb } from './functions/cardapioweb/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://www.pdvslim.com.br',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Backward compat health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'api ok', timestamp: new Date().toISOString() });
});

// VAPID public key endpoint (Web Push notifications)
const vapidHandler = (req: express.Request, res: express.Response) => {
  const key = process.env.VAPID_PUBLIC_KEY || null;
  res.json({ publicKey: key });
};
app.get('/push/vapid-public-key', vapidHandler);
app.get('/api/push/vapid-public-key', vapidHandler);

// API Routes
app.use('/auth', authRoutes);
app.use('/api/kds', kdsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/functions', cardapioWebRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Background: poll and sync recently-ready CardapioWeb orders ─────────────
const _syncedReady = new Set<string>();

async function pollAndSyncReadyOrders() {
  try {
    const result = await query(
      `SELECT o.id, o.tenant_id
       FROM orders o
       WHERE o.external_source = 'cardapioweb'
         AND o.status = 'ready'
         AND o.ready_at > NOW() - INTERVAL '5 minutes'`,
      []
    );
    for (const row of result.rows) {
      if (_syncedReady.has(row.id)) continue;
      _syncedReady.add(row.id);
      console.log(`[Poll] Syncing ready order ${row.id} to CardapioWeb`);
      syncOrderToCardapioWeb(row.id, 'ready').catch(err =>
        console.error(`[Poll] Sync failed for ${row.id}:`, err.message)
      );
    }
    // Clean up old entries (> 10 min)
    if (_syncedReady.size > 500) _syncedReady.clear();
  } catch (err: any) {
    // Silently ignore if table doesn't exist yet
    if (!err.message?.includes('does not exist')) {
      console.error('[Poll] pollAndSyncReadyOrders error:', err.message);
    }
  }
}

// ── Background: keep-alive ping to CardapioWeb every 20 min ─────────────────
async function keepCardapioWebAlive() {
  try {
    const result = await query(
      `SELECT api_token FROM cardapioweb_integrations WHERE is_active = true`,
      []
    );
    for (const row of result.rows) {
      fetch('https://integracao.cardapioweb.com/api/partner/v1/merchant', {
        headers: { 'X-API-KEY': row.api_token, 'Accept': 'application/json' },
      })
        .then(r => console.log(`[KeepAlive] CardapioWeb ping: ${r.status}`))
        .catch(err => console.error('[KeepAlive] Ping failed:', err.message));
    }
  } catch (err: any) {
    if (!err.message?.includes('does not exist')) {
      console.error('[KeepAlive] Error:', err.message);
    }
  }
}

async function start() {
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('Failed to connect to database');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`✓ SlimPDV Backend running on http://localhost:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Start background tasks
    setInterval(pollAndSyncReadyOrders, 30_000);   // every 30s
    setInterval(keepCardapioWebAlive, 20 * 60_000); // every 20min
    // Initial run after 5s (let server settle)
    setTimeout(pollAndSyncReadyOrders, 5_000);
    setTimeout(keepCardapioWebAlive, 10_000);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
