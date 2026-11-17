import crypto from 'crypto';
import { z } from 'zod';
import { query, queryOne, execute } from '../db/db.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const admitPatientSchema = z.object({
  mrn: z.string().min(3, 'Medical Record Number (MRN) is required'),
  full_name: z.string().min(2, 'Full patient name is required'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be in YYYY-MM-DD format'),
  gender: z.enum(['Male', 'Female', 'Other']),
  ward_id: z.string().min(1, 'Ward selection is required'),
  bed_number: z.string().min(1, 'Bed number is required'),
  allergies: z.string().optional().default('None Known'),
  diagnoses: z.string().optional().default('Pending Evaluation')
});

const updatePatientSchema = z.object({
  bed_number: z.string().optional(),
  allergies: z.string().optional(),
  diagnoses: z.string().optional()
});

/**
 * Helper to compute age from birthdate
 */
function calculateAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * List patients partitioned by ward with filtering support
 * Supports: ward_id, my_patients, search, status
 */
export async function getAllPatients(req, res) {
  try {
    const { ward_id, my_patients, search, status = 'ADMITTED' } = req.query;
    
    let sql = `
      SELECT p.*,
             w.name as ward_name, w.code as ward_code, w.location as ward_location,
             (SELECT COUNT(*) FROM prescriptions pr WHERE pr.patient_id = p.id AND pr.status = 'ACTIVE') as active_prescriptions_count
      FROM patients p
      INNER JOIN wards w ON p.ward_id = w.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by status (ADMITTED / DISCHARGED / ALL)
    if (status && status !== 'ALL') {
      sql += ' AND p.status = ?';
      params.push(status);
    }

    // Nurse "My Assigned Ward Patients" filter
    if (my_patients === 'true') {
      if (req.user?.assigned_ward_id) {
        sql += ' AND p.ward_id = ?';
        params.push(req.user.assigned_ward_id);
      }
    } else if (ward_id && ward_id !== 'all') {
      sql += ' AND p.ward_id = ?';
      params.push(ward_id);
    }

    // Search by name, MRN, or bed
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      sql += ' AND (p.full_name LIKE ? OR p.mrn LIKE ? OR p.bed_number LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += ' ORDER BY w.code ASC, p.bed_number ASC, p.full_name ASC';

    const patients = await query(sql, params);

    // Format with computed age
    const formatted = patients.map(p => ({
      ...p,
      age: calculateAge(p.dob),
      hasAllergies: Boolean(p.allergies && p.allergies.toLowerCase() !== 'none' && p.allergies.toLowerCase() !== 'none known')
    }));

    return res.json({
      success: true,
      count: formatted.length,
      patients: formatted
    });
  } catch (error) {
    console.error('[Get Patients Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve patients list.'
    });
  }
}

/**
 * Get full patient details, clinical profile, and assigned medications
 */
export async function getPatientById(req, res) {
  try {
    const { id } = req.params;

    const patient = await queryOne(`
      SELECT p.*,
             w.name as ward_name, w.code as ward_code, w.location as ward_location
      FROM patients p
      INNER JOIN wards w ON p.ward_id = w.id
      WHERE p.id = ?
    `, [id]);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient record not found.'
      });
    }

    // Fetch active and past prescriptions for this patient
    const prescriptions = await query(`
      SELECT pr.*,
             m.trade_name, m.generic_name, m.dosage_form, m.strength, m.default_route, m.warnings,
             u.name as prescribed_by_name
      FROM prescriptions pr
      INNER JOIN medications m ON pr.medication_id = m.id
      INNER JOIN users u ON pr.prescribed_by_id = u.id
      WHERE pr.patient_id = ?
      ORDER BY pr.created_at DESC
    `, [id]);

    // Parse JSON slots safely
    const formattedPrescriptions = prescriptions.map(pr => {
      let slots = [];
      try {
        slots = typeof pr.slots === 'string' ? JSON.parse(pr.slots) : pr.slots;
      } catch (e) {
        slots = ['MORNING'];
      }
      return {
        ...pr,
        slots
      };
    });

    // Audit log: Patient record access (Read tracking for HIPAA / Privacy)
    await logAuditEvent({
      userId: req.user.id,
      action: 'PATIENT_RECORD_VIEW',
      entityType: 'PATIENT',
      entityId: patient.id,
      wardId: patient.ward_id,
      details: { mrn: patient.mrn, patientName: patient.full_name },
      req
    });

    return res.json({
      success: true,
      patient: {
        ...patient,
        age: calculateAge(patient.dob),
        prescriptions: formattedPrescriptions,
        activePrescriptionsCount: formattedPrescriptions.filter(p => p.status === 'ACTIVE').length
      }
    });
  } catch (error) {
    console.error('[Get Patient Details Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve patient record.'
    });
  }
}

/**
 * Admit a new patient to a ward and bed
 */
export async function admitPatient(req, res) {
  try {
    const parseResult = admitPatientSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid patient admission payload'
      });
    }

    const { mrn, full_name, dob, gender, ward_id, bed_number, allergies, diagnoses } = parseResult.data;

    // 1. Verify ward exists
    const ward = await queryOne('SELECT id, name, capacity FROM wards WHERE id = ?', [ward_id]);
    if (!ward) {
      return res.status(400).json({
        success: false,
        error: 'Selected ward does not exist.'
      });
    }

    // 2. Check MRN uniqueness
    const existingMrn = await queryOne('SELECT id FROM patients WHERE LOWER(mrn) = LOWER(?)', [mrn]);
    if (existingMrn) {
      return res.status(409).json({
        success: false,
        error: `A patient with MRN '${mrn}' already exists in the hospital registry.`
      });
    }

    // 3. Check if bed is already occupied by an admitted patient in this ward
    const bedTaken = await queryOne(`
      SELECT id, full_name FROM patients 
      WHERE ward_id = ? AND LOWER(bed_number) = LOWER(?) AND status = 'ADMITTED'
    `, [ward_id, bed_number]);

    if (bedTaken) {
      return res.status(409).json({
        success: false,
        error: `Bed '${bed_number}' in ${ward.name} is already occupied by patient ${bedTaken.full_name}.`
      });
    }

    // 4. Check ward capacity
    const currentCount = await queryOne(`
      SELECT COUNT(*) as count FROM patients WHERE ward_id = ? AND status = 'ADMITTED'
    `, [ward_id]);

    if (currentCount.count >= ward.capacity) {
      return res.status(400).json({
        success: false,
        error: `Ward '${ward.name}' has reached its maximum patient capacity (${ward.capacity} beds).`
      });
    }

    const id = 'pat-' + crypto.randomUUID().slice(0, 8);

    await execute(`
      INSERT INTO patients (id, mrn, full_name, dob, gender, ward_id, bed_number, allergies, diagnoses, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ADMITTED')
    `, [id, mrn.toUpperCase(), full_name, dob, gender, ward_id, bed_number, allergies, diagnoses]);

    await logAuditEvent({
      userId: req.user.id,
      action: 'PATIENT_ADMITTED',
      entityType: 'PATIENT',
      entityId: id,
      wardId: ward_id,
      details: { mrn: mrn.toUpperCase(), full_name, bed_number, ward_name: ward.name },
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Patient admitted successfully',
      patient: {
        id,
        mrn: mrn.toUpperCase(),
        full_name,
        dob,
        gender,
        ward_id,
        ward_name: ward.name,
        bed_number,
        allergies,
        diagnoses,
        status: 'ADMITTED'
      }
    });
  } catch (error) {
    console.error('[Admit Patient Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to admit patient.'
    });
  }
}

/**
 * Update patient record (bed relocation, allergies, diagnoses)
 */
export async function updatePatient(req, res) {
  try {
    const { id } = req.params;
    const parseResult = updatePatientSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid update payload'
      });
    }

    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [id]);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found.'
      });
    }

    const { bed_number, allergies, diagnoses } = parseResult.data;

    // If changing bed, ensure new bed is available
    if (bed_number && bed_number !== patient.bed_number) {
      const bedTaken = await queryOne(`
        SELECT id FROM patients 
        WHERE ward_id = ? AND LOWER(bed_number) = LOWER(?) AND status = 'ADMITTED' AND id != ?
      `, [patient.ward_id, bed_number, id]);

      if (bedTaken) {
        return res.status(409).json({
          success: false,
          error: `Bed '${bed_number}' is already occupied.`
        });
      }
    }

    const newBed = bed_number || patient.bed_number;
    const newAllergies = allergies !== undefined ? allergies : patient.allergies;
    const newDiagnoses = diagnoses !== undefined ? diagnoses : patient.diagnoses;

    await execute(`
      UPDATE patients 
      SET bed_number = ?, allergies = ?, diagnoses = ?
      WHERE id = ?
    `, [newBed, newAllergies, newDiagnoses, id]);

    await logAuditEvent({
      userId: req.user.id,
      action: 'PATIENT_UPDATED',
      entityType: 'PATIENT',
      entityId: id,
      wardId: patient.ward_id,
      details: { previousBed: patient.bed_number, newBed, allergies: newAllergies },
      req
    });

    return res.json({
      success: true,
      message: 'Patient record updated successfully'
    });
  } catch (error) {
    console.error('[Update Patient Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update patient record.'
    });
  }
}

/**
 * Discharge patient
 */
export async function dischargePatient(req, res) {
  try {
    const { id } = req.params;
    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [id]);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found.'
      });
    }

    if (patient.status === 'DISCHARGED') {
      return res.status(400).json({
        success: false,
        error: 'Patient is already discharged.'
      });
    }

    await execute("UPDATE patients SET status = 'DISCHARGED' WHERE id = ?", [id]);

    await logAuditEvent({
      userId: req.user.id,
      action: 'PATIENT_DISCHARGED',
      entityType: 'PATIENT',
      entityId: id,
      wardId: patient.ward_id,
      details: { mrn: patient.mrn, name: patient.full_name },
      req
    });

    return res.json({
      success: true,
      message: `Patient ${patient.full_name} (${patient.mrn}) discharged successfully.`
    });
  } catch (error) {
    console.error('[Discharge Patient Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to discharge patient.'
    });
  }
}
