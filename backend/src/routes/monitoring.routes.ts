import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getJobPerformanceMetrics,
  getSystemMetrics,
  getMethodComparison,
  clearJobMetrics
} from '../controllers/monitoring.controller';

const router = Router();

// All monitoring routes require authentication
router.use(authenticate);

// Job-specific metrics
router.get('/jobs/:jobId/performance', getJobPerformanceMetrics);
router.delete('/jobs/:jobId/metrics', clearJobMetrics);

// System-wide metrics
router.get('/system', getSystemMetrics);

// Method comparison
router.get('/methods/comparison', getMethodComparison);

export default router;