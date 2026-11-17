import { Router } from 'express';
import { getAllUsers, createUser, toggleUserStatus } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/rbacMiddleware.js';

const router = Router();

// All user management routes require Admin privileges
router.use(authenticate);
router.use(requireAdmin);

router.get('/', getAllUsers);
router.post('/', createUser);
router.patch('/:id/status', toggleUserStatus);

export default router;
