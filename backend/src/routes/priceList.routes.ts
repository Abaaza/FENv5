import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { uploadCSV } from '../middleware/upload';
import {
  getAllPriceItems,
  getPriceListStats,
  createPriceItem,
  updatePriceItem,
  importCSV,
  exportCSV,
  deactivatePriceItem,
  deleteAllPriceItems,
  getImportStatus,
  searchPriceItems,
} from '../controllers/priceList.controller';

const router = Router();

// All price list routes require authentication
router.use(authenticate);

// Get all price items
router.get('/', getAllPriceItems);

// Get price list stats
router.get('/stats', getPriceListStats);

// Export to CSV
router.get('/export', exportCSV);

// Search price items
router.post('/search', searchPriceItems);

// Create new price item (admin only)
router.post('/', requireAdmin, createPriceItem);

// Update price item (admin only)
router.patch('/:id', requireAdmin, updatePriceItem);

// Import from CSV (admin only)
router.post('/import', requireAdmin, uploadCSV, importCSV);

// Get import status
router.get('/import/:jobId', getImportStatus);

// Delete all price items (admin only)
router.delete('/all', requireAdmin, deleteAllPriceItems);

// Deactivate price item (admin only)
router.delete('/:id', requireAdmin, deactivatePriceItem);

export default router;
