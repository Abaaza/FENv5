import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getSettings, updateSetting, getApiKeys, updateApiKey } from '../controllers/settings.controller';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// Get all settings (admin only)
router.get('/', requireAdmin, getSettings);

// Update a setting (admin only)
router.put('/:key', requireAdmin, updateSetting);

// Get API keys (admin only, keys are masked)
router.get('/api-keys', requireAdmin, getApiKeys);

// Update API key (admin only)
router.put('/api-keys/:provider', requireAdmin, updateApiKey);

export default router;