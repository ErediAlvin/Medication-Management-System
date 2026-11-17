import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query, queryOne, execute } from '../db/db.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'NURSE', 'PHARMACIST']),
  license_number: z.string().optional(),
  assigned_ward_id: z.string().nullable().optional()
});

export async function getAllUsers(req, res) {
  try {
    const users = await query(`
      SELECT u.id, u.name, u.email, u.role, u.license_number, u.assigned_ward_id, u.status, u.created_at,
             w.name as ward_name, w.code as ward_code
      FROM users u
      LEFT JOIN wards w ON u.assigned_ward_id = w.id
      ORDER BY u.created_at DESC
    `);

    return res.json({
      success: true,
      users
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve users directory.'
    });
  }
}

export async function createUser(req, res) {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid user data'
      });
    }

    const { name, email, password, role, license_number, assigned_ward_id } = parseResult.data;

    // Check unique email
    const existing = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A user with this email address already exists.'
      });
    }

    // If nurse, verify ward exists if assigned
    if (assigned_ward_id) {
      const ward = await queryOne('SELECT id FROM wards WHERE id = ?', [assigned_ward_id]);
      if (!ward) {
        return res.status(400).json({
          success: false,
          error: 'Assigned ward does not exist.'
        });
      }
    }

    const id = 'user-' + crypto.randomUUID().slice(0, 8);
    const password_hash = await bcrypt.hash(password, 10);

    await execute(`
      INSERT INTO users (id, name, email, password_hash, role, license_number, assigned_ward_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [id, name, email, password_hash, role, license_number || null, assigned_ward_id || null]);

    await logAuditEvent({
      userId: req.user.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: id,
      details: { name, email, role, assigned_ward_id },
      req
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id,
        name,
        email,
        role,
        license_number,
        assigned_ward_id,
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('[Create User Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create user.'
    });
  }
}

export async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;

    const user = await queryOne('SELECT id, name, status, role FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    // Cannot deactivate yourself
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot deactivate your own administrative account.'
      });
    }

    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await execute('UPDATE users SET status = ? WHERE id = ?', [nextStatus, id]);

    await logAuditEvent({
      userId: req.user.id,
      action: 'USER_STATUS_TOGGLED',
      entityType: 'USER',
      entityId: id,
      details: { previous: user.status, current: nextStatus },
      req
    });

    return res.json({
      success: true,
      message: `User status changed to ${nextStatus}`,
      status: nextStatus
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update user status.'
    });
  }
}
