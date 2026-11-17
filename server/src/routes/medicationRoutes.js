import { Router } from 'express';
import { getAllMedications, createMedication } from '../controllers/medicationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePharmacistOrAdmin } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// View catalog: all authenticated clinical staff
router.get('/', getAllMedications);

// Add to catalog: Pharmacists & Admins only
router.post('/', requirePharmacistOrAdmin, createMedication);

export default router;
