import crypto from 'crypto';
import { z } from 'zod';
import { query, queryOne, execute } from '../db/db.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const assignPrescriptionSchema = z.object({
  patient_id: z.string().min(1, 'Patient selection is required'),
  medication_id: z.string().min(1, 'Medication selection is required'),
  dosage: z.string().min(1, 'Dosage amount is required (e.g. 500 mg)'),
  route: z.string().min(1, 'Route is required (e.g. Oral, IV)'),
  instructions: z.string().optional().default('Take as prescribed'),
  slots: z.array(z.enum(['MORNING', 'AFTERNOON', 'EVENING'])).min(1, 'At least one daily time slot is required'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional().nullable()
});

/**
 * List prescriptions with filters: patient_id, status
 */
export async function getPrescriptions(req, res) {
  try {
    const { patient_id, status = 'ACTIVE' } = req.query;

    let sql = `
      SELECT pr.*,
             m.trade_name, m.generic_name, m.dosage_form, m.strength, m.default_route, m.warnings,
             p.full_name as patient_name, p.mrn, p.bed_number, p.allergies as patient_allergies,
             w.name as ward_name, w.code as ward_code,
             u.name as prescribed_by_name, u.role as prescribed_by_role
      FROM prescriptions pr
      INNER JOIN medications m ON pr.medication_id = m.id
      INNER JOIN patients p ON pr.patient_id = p.id
      INNER JOIN wards w ON p.ward_id = w.id
      INNER JOIN users u ON pr.prescribed_by_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (patient_id) {
      sql += ' AND pr.patient_id = ?';
      params.push(patient_id);
    }

    if (status && status !== 'ALL') {
      sql += ' AND pr.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY pr.created_at DESC';

    const rows = await query(sql, params);

    const formatted = rows.map(r => {
      let slots = [];
      try {
        slots = typeof r.slots === 'string' ? JSON.parse(r.slots) : r.slots;
      } catch (e) {
        slots = ['MORNING'];
      }
      return {
        ...r,
        slots
      };
    });

    return res.json({
      success: true,
      count: formatted.length,
      prescriptions: formatted
    });
  } catch (error) {
    console.error('[Get Prescriptions Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve prescriptions.'
    });
  }
}

/**
 * Assign a new medication to a patient (Pharmacist only)
 */
export async function assignPrescription(req, res) {
  try {
    const parseResult = assignPrescriptionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid prescription assignment'
      });
    }

    const {
      patient_id,
      medication_id,
      dosage,
      route,
      instructions,
      slots,
      start_date = new Date().toISOString().slice(0, 10),
      end_date = null
    } = parseResult.data;

    // 1. Verify patient exists and is admitted
    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [patient_id]);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found.'
      });
    }
    if (patient.status !== 'ADMITTED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot assign medication to a discharged patient.'
      });
    }

    // 2. Verify medication exists in catalog
    const medication = await queryOne('SELECT * FROM medications WHERE id = ?', [medication_id]);
    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Selected medication not found in hospital catalog.'
      });
    }

    // 3. Prevent duplicate active prescription of same medication to the patient
    const duplicate = await queryOne(`
      SELECT id FROM prescriptions 
      WHERE patient_id = ? AND medication_id = ? AND status = 'ACTIVE'
    `, [patient_id, medication_id]);

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `Patient already has an active prescription for ${medication.trade_name}. Please modify or discontinue the existing order first.`
      });
    }

    // 4. Check for allergy conflicts
    let allergyWarning = null;
    if (patient.allergies && patient.allergies.toLowerCase() !== 'none' && patient.allergies.toLowerCase() !== 'none known') {
      const patientAllergies = patient.allergies.toLowerCase();
      if (
        patientAllergies.includes(medication.generic_name.toLowerCase()) ||
        patientAllergies.includes(medication.trade_name.toLowerCase()) ||
        (patientAllergies.includes('penicillin') && medication.generic_name.toLowerCase().includes('amoxicillin'))
      ) {
        allergyWarning = `CRITICAL WARNING: Patient is documented allergic to '${patient.allergies}'. Prescribing '${medication.trade_name}' (${medication.generic_name}) carries high allergic risk!`;
      }
    }

    const id = 'rx-' + crypto.randomUUID().slice(0, 8);
    const slotsJson = JSON.stringify(slots);

    await execute(`
      INSERT INTO prescriptions (id, patient_id, medication_id, prescribed_by_id, dosage, route, instructions, slots, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [id, patient_id, medication_id, req.user.id, dosage, route, instructions, slotsJson, start_date, end_date]);

    // 5. Automatically create daily dose schedules for today for the assigned slots
    const today = new Date().toISOString().slice(0, 10);
    const slotTimes = {
      MORNING: '08:00',
      AFTERNOON: '14:00',
      EVENING: '20:00'
    };

    for (const slot of slots) {
      const doseId = `dose-${id}-${today}-${slot.toLowerCase()}`;
      try {
        await execute(`
          INSERT INTO dose_schedules (id, prescription_id, patient_id, date, slot, status, target_time)
          VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
        `, [doseId, id, patient_id, today, slot, slotTimes[slot]]);
      } catch (e) {
        // Ignored if already scheduled by constraint
      }
    }

    await logAuditEvent({
      userId: req.user.id,
      action: 'PRESCRIPTION_ASSIGNED',
      entityType: 'PRESCRIPTION',
      entityId: id,
      wardId: patient.ward_id,
      details: {
        patient_mrn: patient.mrn,
        patient_name: patient.full_name,
        medication: medication.trade_name,
        dosage,
        slots,
        allergyWarning
      },
      req
    });

    return res.status(201).json({
      success: true,
      message: `Prescription for ${medication.trade_name} successfully assigned to ${patient.full_name}`,
      allergyWarning,
      prescription: {
        id,
        patient_id,
        patient_name: patient.full_name,
        medication_id,
        trade_name: medication.trade_name,
        generic_name: medication.generic_name,
        dosage,
        route,
        instructions,
        slots,
        start_date,
        end_date,
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('[Assign Prescription Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to assign prescription.'
    });
  }
}

/**
 * Discontinue an active prescription (Pharmacist only)
 */
export async function discontinuePrescription(req, res) {
  try {
    const { id } = req.params;

    const prescription = await queryOne(`
      SELECT pr.*, m.trade_name, p.full_name, p.ward_id
      FROM prescriptions pr
      INNER JOIN medications m ON pr.medication_id = m.id
      INNER JOIN patients p ON pr.patient_id = p.id
      WHERE pr.id = ?
    `, [id]);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription order not found.'
      });
    }

    if (prescription.status === 'DISCONTINUED') {
      return res.status(400).json({
        success: false,
        error: 'Prescription is already discontinued.'
      });
    }

    await execute("UPDATE prescriptions SET status = 'DISCONTINUED' WHERE id = ?", [id]);

    await logAuditEvent({
      userId: req.user.id,
      action: 'PRESCRIPTION_DISCONTINUED',
      entityType: 'PRESCRIPTION',
      entityId: id,
      wardId: prescription.ward_id,
      details: {
        patient: prescription.full_name,
        medication: prescription.trade_name,
        discontinued_by: req.user.name
      },
      req
    });

    return res.json({
      success: true,
      message: `Prescription for ${prescription.trade_name} has been discontinued.`
    });
  } catch (error) {
    console.error('[Discontinue Prescription Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to discontinue prescription.'
    });
  }
}
