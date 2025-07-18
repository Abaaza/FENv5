import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadExcel } from '../middleware/upload';
import {
  uploadForProject,
  uploadAndMatchForProject,
  exportProjectResults,
  getProjectJobs,
  linkJobToProject,
  unlinkJobFromProject
} from '../controllers/projects.controller';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// Upload BOQ file for a specific project
router.post('/upload', uploadExcel, uploadForProject);

// Upload and match BOQ for a specific project in one step
router.post('/upload-and-match', uploadExcel, uploadAndMatchForProject);

// Get all matching jobs for a specific project
router.get('/:projectId/jobs', getProjectJobs);

// Export project job results to Excel
router.get('/jobs/:jobId/export', exportProjectResults);

// Link existing job to a project
router.post('/jobs/:jobId/link', linkJobToProject);

// Unlink job from project
router.delete('/jobs/:jobId/link', unlinkJobFromProject);

export default router;
