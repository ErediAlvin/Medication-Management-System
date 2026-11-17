import { Router } from 'express';
import { login, getMe, logout, getDemoAccounts } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', login);
router.get('/demo-accounts', getDemoAccounts);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
