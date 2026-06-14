import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dns from 'dns';

// Configure public DNS servers to bypass unstable local router DNS for Mongo SRV queries
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err: any) {
  console.warn('[dns] Could not set custom DNS servers:', err.message || err);
}

import authRouter from './routes/auth';
import customersRouter from './routes/customers';
import remindersRouter from './routes/reminders';
import paymentsRouter from './routes/payments';
import employeesRouter from './routes/employees';
import medicinesRouter from './routes/medicines';
import activityRouter from './routes/activity';
import settingsRouter from './routes/settings';
import dashboardRouter from './routes/dashboard';
import { errorHandler } from './middleware/error';
import { ensureSettings } from './models/Settings';
import {
  connectAllTenants,
  getTenantConnection,
  tenantConnectionStatus,
} from './db/connections';
import { getModels } from './db/models';
import { TENANT_IDS } from './config/tenants';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

async function main() {
  const app = express();
  app.use(cors({ origin: CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(morgan('tiny'));

  app.get('/api/health', (_req, res) => {
    const tenants = tenantConnectionStatus();
    const allConnected = Object.values(tenants).every(Boolean);
    res.json({
      status: allConnected ? 'ok' : 'degraded',
      uptime: process.uptime(),
      tenants,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/reminders', remindersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/medicines', medicinesRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
  });

  app.use(errorHandler);

  await connectAllTenants();

  // Ensure each tenant has its Settings singleton if connected.
  for (const t of TENANT_IDS) {
    const conn = getTenantConnection(t);
    if (conn.readyState === 1) {
      const { Settings } = getModels(conn);
      try {
        await ensureSettings(Settings);
      } catch (err: any) {
        console.warn(`[settings] Could not ensure settings for tenant ${t}:`, err.message || err);
      }
    } else {
      console.warn(`[settings] Tenant ${t} is not fully connected. Settings initialization will run lazily.`);
    }
  }

  app.listen(PORT, () => {
    console.log(`[api] listening on :${PORT}`); // reloaded to retry connections
  });
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
