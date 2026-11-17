import { Router } from 'express';
import { getDailySchedule, getPatientSchedule, ensureDailySchedules } from '../controllers/scheduleController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

// Get daily schedule with real-time guidance (All clinical staff: Nurses, Pharmacists, Admins)
router.get('/today', getDailySchedule);
router.get('/daily', getDailySchedule);

// Get schedule for specific patient
router.get('/patient/:patientId', getPatientSchedule);

// Ensure schedule generated for a date
router.post('/generate', async (req, res) => {
  try {
    const { date } = req.body;
    await ensureDailySchedules(date);
    return res.json({ success: true, message: 'Daily schedules generated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to generate schedules.' });
  }
});

export default router;
