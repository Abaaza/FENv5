import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadExcel } from '../middleware/upload';
import {
  uploadBOQ,
  startMatching,
  getJobStatus,
  getMatchResults,
  updateMatchResult,
  exportResults,
  stopJob,
  stopAllJobs,
  autoSaveResult,
  getUserJobs,
  getAllJobs,
  runMatch,
  uploadAndMatch,
  deleteJob,
  getProcessorStatus,
  getMatchingMethods,
  testLocalMatch,
} from '../controllers/priceMatching.controller';

const router = Router();

// All price matching routes require authentication
router.use(authenticate);

// Get all user jobs
router.get('/jobs', getUserJobs);

// Get all jobs (for admin/client counting)
router.get('/all-jobs', getAllJobs);

// Upload BOQ file
router.post('/upload', uploadExcel, uploadBOQ);

// Upload and match in one step
router.post('/upload-and-match', uploadExcel, uploadAndMatch);

// Start matching process
router.post('/:jobId/start', startMatching);

// Get job status
router.get('/:jobId/status', getJobStatus);

// Get match results
router.get('/:jobId/results', getMatchResults);

// Update a match result
router.patch('/results/:resultId', updateMatchResult);

// Re-match a single result
router.post('/results/:resultId/rematch', runMatch);

// Export results to Excel
router.get('/:jobId/export', exportResults);

// Stop a running job
router.post('/:jobId/stop', stopJob);

// Stop all running jobs
router.post('/stop-all', stopAllJobs);

// Auto-save match result
router.post('/results/:resultId/autosave', autoSaveResult);

// Run match for a specific result
router.post('/results/:resultId/match', runMatch);

// Delete a job and all its results
router.delete('/:jobId', deleteJob);

// Get processor status
router.get('/processor/status', getProcessorStatus);

// Get available matching methods
router.get('/matching-methods', getMatchingMethods);

// Test local match for single item (instant test)
router.post('/test/local', testLocalMatch);

export default router;
