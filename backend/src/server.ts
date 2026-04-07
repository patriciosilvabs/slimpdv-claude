import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import dotenv from 'dotenv';
import { testConnection } from './database/client.js';
import authRoutes from './auth/routes.js';
import kdsRoutes from './functions/kds/routes.js';
import ordersRoutes from './functions/orders/routes.js';
import productsRoutes from './functions/products/routes.js';
import settingsRoutes from './functions/settings/routes.js';

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
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
