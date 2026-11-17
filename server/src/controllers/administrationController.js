import crypto from 'crypto';
import { z } from 'zod';
import { query, queryOne, execute } from '../db/db.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const recordAdministrationSchema = z.object({
  dose_schedule_id: z.string().min(1, 'Dose schedule ID is required'),
  status: z.enum(['ADMINISTERED', 'HELD', 'REFUSED']),
  notes: z.string().optional().default(''),
  vitals: z.string().optional().default('')
});

/**
 * Record medication administration
 * STRICT SAFETY RULES:
 * 1. Only nurses can administer (Pharmacists are strictly blocked).
 * 2. DUPLICATE PREVENTION: Rejects if already ADMINISTERED.
 * 3. Immutable audit log recorded.
 */
export async function recordAdministration(req, res) {
  try {
    // 1. Strict Pharmacist Block
    if (req.user.role === 'PHARMACIST') {
      return res.status(403).json({
        success: false,
        error: 'Security Policy Violation: Pharmacists cannot administer medications to patients directly. Doses must be administered by an authorized nurse.'
      });
    }

    if (req.user.role !== 'NURSE') {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: Only registered hospital nurses can record medication administration.'
      });
    }

    const parseResult = recordAdministrationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid administration data'
      });
    }

    const { dose_schedule_id, status, notes, vitals } = parseResult.data;

    // 2. Fetch the dose schedule and related prescription/patient
    const dose = await queryOne(`
      SELECT ds.*, 
             pr.dosage, pr.route, pr.instructions,
             m.trade_name, m.generic_name,
             p.full_name as patient_name, p.mrn, p.ward_id, p.bed_number
      FROM dose_schedules ds
      INNER JOIN prescriptions pr ON ds.prescription_id = pr.id
      INNER JOIN medications m ON pr.medication_id = m.id
      INNER JOIN patients p ON ds.patient_id = p.id
      WHERE ds.id = ?
    `, [dose_schedule_id]);

    if (!dose) {
      return res.status(404).json({
        success: false,
        error: 'Dose schedule record not found.'
      });
    }

    // 3. DUPLICATE ENTRY PREVENTION CHECK
    if (dose.status === 'ADMINISTERED') {
      // Fetch details of previous administration
      const existingLog = await queryOne(`
        SELECT al.*, u.name as nurse_name
        FROM administration_logs al
        INNER JOIN users u ON al.administered_by_id = u.id
        WHERE al.dose_schedule_id = ?
        ORDER BY al.administered_at DESC
        LIMIT 1
      `, [dose_schedule_id]);

      return res.status(409).json({
        success: false,
        error: `SAFETY ALERT: DUPLICATE ENTRY PREVENTED! This dose of ${dose.trade_name} (${dose.slot} slot on ${dose.date}) was ALREADY administered by Nurse ${existingLog?.nurse_name || 'Staff'} at ${existingLog?.administered_at || 'earlier today'}. Duplicate administration is strictly blocked.`,
        existingLog
      });
    }

    const logId = 'admin-log-' + crypto.randomUUID().slice(0, 8);
    const administeredAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 4. Update dose_schedules status
    await execute(`
      UPDATE dose_schedules 
      SET status = ?
      WHERE id = ?
    `, [status, dose_schedule_id]);

    // 5. Insert immutable administration log
    await execute(`
      INSERT INTO administration_logs (id, dose_schedule_id, prescription_id, patient_id, administered_by_id, administered_at, status, notes, vitals)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [logId, dose_schedule_id, dose.prescription_id, dose.patient_id, req.user.id, administeredAt, status, notes, vitals]);

    // 6. Security & Clinical Audit Log
    await logAuditEvent({
      userId: req.user.id,
      action: 'DOSE_ADMINISTERED',
      entityType: 'DOSE_SCHEDULE',
      entityId: dose_schedule_id,
      wardId: dose.ward_id,
      details: {
        patient_mrn: dose.mrn,
        patient_name: dose.patient_name,
        medication: dose.trade_name,
        dosage: dose.dosage,
        slot: dose.slot,
        status,
        nurse_name: req.user.name,
        vitals
      },
      req
    });

    return res.status(200).json({
      success: true,
      message: `Dose of ${dose.trade_name} (${dose.dosage}) recorded as ${status} for ${dose.patient_name}`,
      administration: {
        id: logId,
        dose_schedule_id,
        patient_name: dose.patient_name,
        trade_name: dose.trade_name,
        dosage: dose.dosage,
        slot: dose.slot,
        status,
        administered_by: req.user.name,
        administered_at: administeredAt,
        notes,
        vitals
      }
    });
  } catch (error) {
    console.error('[Record Administration Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record medication administration.'
    });
  }
}

/**
 * Get administration history for a specific patient
 */
export async function getPatientAdministrationHistory(req, res) {
  try {
    const { patientId } = req.params;

    const history = await query(`
      SELECT al.*, 
             m.trade_name, m.generic_name, pr.dosage, pr.route,
             ds.date, ds.slot,
             u.name as nurse_name, u.license_number as nurse_license
      FROM administration_logs al
      INNER JOIN dose_schedules ds ON al.dose_schedule_id = ds.id
      INNER JOIN prescriptions pr ON al.prescription_id = pr.id
      INNER JOIN medications m ON pr.medication_id = m.id
      INNER JOIN users u ON al.administered_by_id = u.id
      WHERE al.patient_id = ?
      ORDER BY al.administered_at DESC
    `, [patientId]);

    return res.json({
      success: true,
      patientId,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('[Get Administration History Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve administration history.'
    });
  }
}

/**
 * Shift handover reconciliation: check for pending or missed doses in ward
 */
export async function getShiftReconciliation(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const wardId = req.query.ward_id || req.user.assigned_ward_id;

    let sql = `
      SELECT ds.*, 
             pr.dosage, pr.route,
             m.trade_name, m.generic_name,
             p.full_name as patient_name, p.mrn, p.bed_number,
             w.name as ward_name, w.code as ward_code
      FROM dose_schedules ds
      INNER JOIN prescriptions pr ON ds.prescription_id = pr.id
      INNER JOIN medications m ON pr.medication_id = m.id
      INNER JOIN patients p ON ds.patient_id = p.id
      INNER JOIN wards w ON p.ward_id = w.id
      WHERE ds.date = ? AND p.status = 'ADMITTED'
    `;
    const params = [today];

    if (wardId && wardId !== 'all') {
      sql += ' AND p.ward_id = ?';
      params.push(wardId);
    }

    const allDoses = await query(sql, params);

    const pending = allDoses.filter(d => d.status === 'PENDING');
    const administered = allDoses.filter(d => d.status === 'ADMINISTERED');
    const held = allDoses.filter(d => d.status === 'HELD' || d.status === 'REFUSED');

    return res.json({
      success: true,
      date: today,
      wardId: wardId || 'all',
      summary: {
        totalScheduled: allDoses.length,
        administeredCount: administered.length,
        pendingCount: pending.length,
        heldCount: held.length,
        isCleanHandover: pending.length === 0
      },
      unadministeredDoses: pending
    });
  } catch (error) {
    console.error('[Shift Reconciliation Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve shift reconciliation report.'
    });
  }
}
