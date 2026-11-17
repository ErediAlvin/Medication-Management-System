import { Router } from 'express';
import {
  getPrescriptions,
  assignPrescription,
  discontinuePrescription
} from '../controllers/prescriptionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePharmacistOrAdmin } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// View prescriptions (Both Nurses and Pharmacists)
router.get('/', getPrescriptions);

// Assign prescription (Pharmacists & Admins only)
router.post('/', requirePharmacistOrAdmin, assignPrescription);

// Discontinue prescription (Pharmacists & Admins only)
router.patch('/:id/discontinue', requirePharmacistOrAdmin, discontinuePrescription);

export default router;
