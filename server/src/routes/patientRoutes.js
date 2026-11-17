import { Router } from 'express';
import {
  getAllPatients,
  getPatientById,
  admitPatient,
  updatePatient,
  dischargePatient
} from '../controllers/patientController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

// All patient routes require authenticated session
router.use(authenticate);

// View patient lists (Ward-partitioned, search, my_patients filter)
router.get('/', getAllPatients);

// View full patient clinical record & assigned medications
router.get('/:id', getPatientById);

// Patient Admission (Admin or Nurse)
router.post('/', requireRoles('ADMIN', 'NURSE'), admitPatient);

// Update patient info / bed
router.patch('/:id', requireRoles('ADMIN', 'NURSE'), updatePatient);

// Patient Discharge
router.post('/:id/discharge', requireRoles('ADMIN', 'NURSE'), dischargePatient);

export default router;
