import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { preventPharmacistAdministration } from '../middleware/rbacMiddleware.js';
import {
  recordAdministration,
  getPatientAdministrationHistory,
  getShiftReconciliation
} from '../controllers/administrationController.js';

const router = express.Router();

// Strict Safety Rule: Pharmacists CANNOT administer medications! Only Nurses allowed.
router.post('/record', authenticate, preventPharmacistAdministration, recordAdministration);

// Clinical history and handover reports (Nurses, Pharmacists, Admins can inspect)
router.get('/history/:patientId', authenticate, getPatientAdministrationHistory);
router.get('/reconciliation', authenticate, getShiftReconciliation);

export default router;
