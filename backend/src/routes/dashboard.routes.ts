import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStats, getRecentActivity, getRecentJobs, getSystemHealth, getActivitySummary, getActivityStats } from '../controllers/dashboard.controller';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

router.get('/stats', getStats);
router.get('/activity', getRecentActivity);
router.get('/recent-jobs', getRecentJobs);
router.get('/system-health', getSystemHealth);
router.get('/activity-summary', getActivitySummary);
router.get('/activity-stats', getActivityStats);

export default router;
