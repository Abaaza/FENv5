import { Router } from 'express';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'mjd-price-matcher-backend',
    version: process.env.npm_package_version || '1.0.0',
  });
});

router.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'mjd-price-matcher-backend',
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      memory: {
        status: 'ok',
        details: process.memoryUsage(),
      },
      uptime: {
        status: 'ok',
        seconds: process.uptime(),
      },
      convex: {
        status: 'checking',
        message: '',
      },
    },
  };

  // Check Convex connection
  try {
    const convex = getConvexClient();
    // Try a simple query
    await convex.query(api.applicationSettings.getAll);
    health.checks.convex.status = 'ok';
    health.checks.convex.message = 'Connected';
  } catch (error) {
    health.status = 'degraded';
    health.checks.convex.status = 'error';
    health.checks.convex.message = 'Connection failed';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

export default router;
