import { Router } from 'express';
import { getAllWards, createWard } from '../controllers/wardController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// All authenticated staff can list wards
router.get('/', getAllWards);

// Only Admins can create new wards
router.post('/', requireAdmin, createWard);

export default router;
