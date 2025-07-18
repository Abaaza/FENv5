import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAllClients,
  getActiveClients,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/clients.controller';

const router = Router();

// All client routes require authentication
router.use(authenticate);

// Get all clients
router.get('/', getAllClients);

// Get active clients only
router.get('/active', getActiveClients);

// Create new client
router.post('/', createClient);

// Update client
router.put('/:id', updateClient);
router.patch('/:id', updateClient);

// Delete client
router.delete('/:id', deleteClient);

export default router;
