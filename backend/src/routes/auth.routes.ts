import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, refresh, logout, getMe, updateProfile, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validateRequest,
  login
);

router.post('/refresh', refresh);

router.post('/logout', authenticate, logout);

router.get('/me', authenticate, getMe);

router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  ],
  validateRequest,
  updateProfile
);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validateRequest,
  changePassword
);

export default router;
