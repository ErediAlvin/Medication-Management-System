import crypto from 'crypto';
import { query, queryOne, execute } from '../db/db.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const SLOT_TIMES = {
  MORNING: '08:00',
  AFTERNOON: '14:00',
  EVENING: '20:00'
};

const SLOT_ORDER = {
  MORNING: 1,
  AFTERNOON: 2,
  EVENING: 3
};

/**
 * Determine the current active time slot based on system clock
 */
export function getCurrentSlot() {
  const hour = new Date().getHours();
  if (hour < 12) return 'MORNING';
  if (hour < 18) return 'AFTERNOON';
  return 'EVENING';
}

/**
 * Compute clinical guidance label for a scheduled dose
 */
function computeGuidanceTag(doseStatus, doseSlot, currentSlot, doseDate, todayStr) {
  if (doseStatus === 'ADMINISTERED') return 'COMPLETED';
  if (doseStatus === 'HELD') return 'HELD';
  if (doseStatus === 'MISSED') return 'MISSED';

  // If viewing a past date and still pending
  if (doseDate < todayStr) return 'OVERDUE';
  if (doseDate > todayStr) return 'UPCOMING';

  // For today's pending doses
  const doseSlotOrder = SLOT_ORDER[doseSlot] || 1;
  const currentSlotOrder = SLOT_ORDER[currentSlot] || 1;

  if (doseSlotOrder === currentSlotOrder) {
    return 'DUE_NOW'; // Active window: nurse action required right now
  } else if (doseSlotOrder < currentSlotOrder) {
    return 'OVERDUE'; // Missed entry warning: slot passed without administration
  } else {
    return 'UPCOMING'; // Scheduled for later round today
  }
}

/**
 * Automatically ensure dose schedules exist for all active prescriptions for a given date
 */
export async function ensureDailySchedules(dateStr) {
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);

  // Find all active prescriptions valid for targetDate
  const activePrescriptions = await query(`
    SELECT pr.id, pr.patient_id, pr.slots
    FROM prescriptions pr
    INNER JOIN patients p ON pr.patient_id = p.id
    WHERE pr.status = 'ACTIVE'
      AND p.status = 'ADMITTED'
      AND pr.start_date <= ?
      AND (pr.end_date IS NULL OR pr.end_date >= ?)
  `, [targetDate, targetDate]);

  for (const rx of activePrescriptions) {
    let slots = [];
    try {
      slots = typeof rx.slots === 'string' ? JSON.parse(rx.slots) : rx.slots;
    } catch {
      slots = ['MORNING'];
    }

    for (const slot of slots) {
      const doseId = `dose-${rx.id}-${targetDate}-${slot.toLowerCase()}`;
      const targetTime = SLOT_TIMES[slot] || '08:00';

      // Insert if not already existing (MySQL INSERT IGNORE via UK constraint)
      await execute(`
        INSERT IGNORE INTO dose_schedules (id, prescription_id, patient_id, date, slot, status, target_time)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
      `, [doseId, rx.id, rx.patient_id, targetDate, slot, targetTime]);
    }
  }
}

/**
 * Get daily medication administration schedule with clinical guidance
 * Supports filtering by: date, ward_id, my_patients, slot, status
 */
export async function getDailySchedule(req, res) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const date = req.query.date || todayStr;
    const { ward_id, my_patients, slot, status } = req.query;

    // Automatically generate today's doses if needed
    await ensureDailySchedules(date);

    const currentSlot = getCurrentSlot();

    let sql = `
      SELECT ds.id as dose_id, ds.date, ds.slot, ds.status as dose_status, ds.target_time,
             pr.id as prescription_id, pr.dosage, pr.route, pr.instructions, pr.slots as rx_slots,
             m.id as medication_id, m.trade_name, m.generic_name, m.dosage_form, m.strength, m.warnings as med_warnings,
             p.id as patient_id, p.full_name as patient_name, p.mrn, p.bed_number, p.dob, p.gender, p.allergies as patient_allergies,
             w.id as ward_id, w.name as ward_name, w.code as ward_code,
             u.name as prescribed_by_name,
             al.id as log_id, al.administered_at, al.administered_by_id, al.notes as admin_notes,
             nurse.name as administered_by_name
      FROM dose_schedules ds
      INNER JOIN prescriptions pr ON ds.prescription_id = pr.id
      INNER JOIN medications m ON pr.medication_id = m.id
      INNER JOIN patients p ON ds.patient_id = p.id
      INNER JOIN wards w ON p.ward_id = w.id
      INNER JOIN users u ON pr.prescribed_by_id = u.id
      LEFT JOIN administration_logs al ON al.dose_schedule_id = ds.id
      LEFT JOIN users nurse ON al.administered_by_id = nurse.id
      WHERE ds.date = ? AND p.status = 'ADMITTED'
    `;
    const params = [date];

    // Ward filtering
    if (my_patients === 'true' && req.user?.assigned_ward_id) {
      sql += ' AND p.ward_id = ?';
      params.push(req.user.assigned_ward_id);
    } else if (ward_id && ward_id !== 'all') {
      sql += ' AND p.ward_id = ?';
      params.push(ward_id);
    }

    // Slot filtering (MORNING, AFTERNOON, EVENING)
    if (slot && slot !== 'ALL') {
      sql += ' AND ds.slot = ?';
      params.push(slot);
    }

    // Status filtering
    if (status && status !== 'ALL') {
      sql += ' AND ds.status = ?';
      params.push(status);
    }

    sql += `
      ORDER BY 
        CASE ds.slot 
          WHEN 'MORNING' THEN 1 
          WHEN 'AFTERNOON' THEN 2 
          WHEN 'EVENING' THEN 3 
          ELSE 4 
        END,
        w.code ASC,
        p.bed_number ASC
    `;

    const rawDoses = await query(sql, params);

    // Format doses and compute dynamic guidance tags
    const doses = rawDoses.map(dose => {
      const guidance = computeGuidanceTag(dose.dose_status, dose.slot, currentSlot, dose.date, todayStr);
      return {
        ...dose,
        id: dose.dose_id,
        status: dose.dose_status,
        guidance,
        isDueNow: guidance === 'DUE_NOW',
        isOverdue: guidance === 'OVERDUE',
        isCompleted: guidance === 'COMPLETED',
        isUpcoming: guidance === 'UPCOMING'
      };
    });

    // Calculate shift metrics (Pending vs Completed)
    const totalDoses = doses.length;
    const completedDoses = doses.filter(d => d.isCompleted).length;
    const pendingDoses = doses.filter(d => d.dose_status === 'PENDING').length;
    const dueNowDoses = doses.filter(d => d.isDueNow).length;
    const overdueDoses = doses.filter(d => d.isOverdue).length;
    const completionRate = totalDoses > 0 ? Math.round((completedDoses / totalDoses) * 100) : 0;

    return res.json({
      success: true,
      date,
      currentSlot,
      activeSlotTime: SLOT_TIMES[currentSlot],
      metrics: {
        totalDoses,
        completedDoses,
        pendingDoses,
        dueNowDoses,
        overdueDoses,
        completionRate
      },
      count: doses.length,
      doses
    });
  } catch (error) {
    console.error('[Get Daily Schedule Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve daily medication schedule.'
    });
  }
}

/**
 * Get daily schedule for a specific patient
 */
export async function getPatientSchedule(req, res) {
  try {
    const { patientId } = req.params;
    const todayStr = new Date().toISOString().slice(0, 10);
    const date = req.query.date || todayStr;
    const currentSlot = getCurrentSlot();

    await ensureDailySchedules(date);

    const doses = await query(`
      SELECT ds.id as dose_id, ds.date, ds.slot, ds.status as dose_status, ds.target_time,
             pr.dosage, pr.route, pr.instructions,
             m.trade_name, m.generic_name, m.dosage_form, m.strength, m.warnings as med_warnings,
             al.administered_at, al.notes as admin_notes, nurse.name as administered_by_name
      FROM dose_schedules ds
      INNER JOIN prescriptions pr ON ds.prescription_id = pr.id
      INNER JOIN medications m ON pr.medication_id = m.id
      LEFT JOIN administration_logs al ON al.dose_schedule_id = ds.id
      LEFT JOIN users nurse ON al.administered_by_id = nurse.id
      WHERE ds.patient_id = ? AND ds.date = ?
      ORDER BY 
        CASE ds.slot 
          WHEN 'MORNING' THEN 1 
          WHEN 'AFTERNOON' THEN 2 
          WHEN 'EVENING' THEN 3 
          ELSE 4 
        END
    `, [patientId, date]);

    const formatted = doses.map(dose => ({
      ...dose,
      guidance: computeGuidanceTag(dose.dose_status, dose.slot, currentSlot, dose.date, todayStr)
    }));

    return res.json({
      success: true,
      patientId,
      date,
      currentSlot,
      doses: formatted
    });
  } catch (error) {
    console.error('[Get Patient Schedule Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve patient schedule.'
    });
  }
}
