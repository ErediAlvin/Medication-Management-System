import crypto from 'crypto';
import { z } from 'zod';
import { query, queryOne, execute } from '../db/db.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const createWardSchema = z.object({
  name: z.string().min(2, 'Ward name must be at least 2 characters'),
  code: z.string().min(2, 'Ward code must be at least 2 characters').toUpperCase(),
  capacity: z.number().int().positive().default(10),
  location: z.string().optional()
});

export async function getAllWards(req, res) {
  try {
    const wards = await query(`
      SELECT w.*, 
             (SELECT COUNT(*) FROM patients p WHERE p.ward_id = w.id AND p.status = 'ADMITTED') as occupied_beds,
             (SELECT COUNT(*) FROM users u WHERE u.assigned_ward_id = w.id AND u.status = 'ACTIVE') as assigned_staff_count
      FROM wards w
      ORDER BY w.name ASC
    `);

    return res.json({
      success: true,
      wards
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve wards.'
    });
  }
}

export async function createWard(req, res) {
  try {
    const parseResult = createWardSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid ward data'
      });
    }

    const { name, code, capacity, location } = parseResult.data;

    const existing = await queryOne('SELECT id FROM wards WHERE code = ?', [code]);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `A ward with code '${code}' already exists.`
      });
    }

    const id = 'ward-' + code.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await execute(`
      INSERT INTO wards (id, name, code, capacity, location)
      VALUES (?, ?, ?, ?, ?)
    `, [id, name, code, capacity, location || null]);

    await logAuditEvent({
      userId: req.user.id,
      action: 'WARD_CREATED',
      entityType: 'WARD',
      entityId: id,
      details: { name, code, capacity },
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Ward created successfully',
      ward: { id, name, code, capacity, location }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to create ward.'
    });
  }
}
