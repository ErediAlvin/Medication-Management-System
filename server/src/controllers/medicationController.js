import crypto from 'crypto';
import { z } from 'zod';
import { query, queryOne, execute } from '../db/db.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const createMedicationSchema = z.object({
  trade_name: z.string().min(2, 'Trade name is required'),
  generic_name: z.string().min(2, 'Generic name is required'),
  dosage_form: z.string().min(1, 'Dosage form is required (e.g. Tablet, IV, Capsule)'),
  strength: z.string().min(1, 'Strength is required (e.g. 500 mg, 10 ml)'),
  default_route: z.string().min(1, 'Administration route is required (e.g. Oral, IV)'),
  warnings: z.string().optional()
});

export async function getAllMedications(req, res) {
  try {
    const search = req.query.search;
    let sql = 'SELECT * FROM medications WHERE 1=1';
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (trade_name LIKE ? OR generic_name LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY trade_name ASC';
    const medications = await query(sql, params);

    return res.json({
      success: true,
      count: medications.length,
      medications
    });
  } catch (error) {
    console.error('[Get Medications Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve medication catalog.'
    });
  }
}

export async function createMedication(req, res) {
  try {
    const parseResult = createMedicationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid medication payload'
      });
    }

    const { trade_name, generic_name, dosage_form, strength, default_route, warnings } = parseResult.data;

    // Check duplicate
    const existing = await queryOne(`
      SELECT id FROM medications 
      WHERE LOWER(trade_name) = LOWER(?) AND LOWER(strength) = LOWER(?)
    `, [trade_name, strength]);

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Medication '${trade_name} ${strength}' already exists in catalog.`
      });
    }

    const id = 'med-' + crypto.randomUUID().slice(0, 8);
    await execute(`
      INSERT INTO medications (id, trade_name, generic_name, dosage_form, strength, default_route, warnings)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, trade_name, generic_name, dosage_form, strength, default_route, warnings || null]);

    await logAuditEvent({
      userId: req.user.id,
      action: 'MEDICATION_CATALOG_CREATED',
      entityType: 'MEDICATION',
      entityId: id,
      details: { trade_name, generic_name, strength },
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Medication added to catalog successfully',
      medication: { id, trade_name, generic_name, dosage_form, strength, default_route, warnings }
    });
  } catch (error) {
    console.error('[Create Medication Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add medication to catalog.'
    });
  }
}
