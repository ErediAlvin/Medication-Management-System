import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { queryOne, query } from '../db/db.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-hospital-mms-secret-key-change-in-prod-2026!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required')
});

function getPermissionsForRole(role) {
  return {
    canAdministerMedication: role === 'NURSE',
    canAssignMedication: role === 'PHARMACIST' || role === 'ADMIN',
    canManageUsers: role === 'ADMIN',
    canManageWards: role === 'ADMIN',
    canViewAllWards: role === 'ADMIN' || role === 'PHARMACIST',
    isNurse: role === 'NURSE',
    isPharmacist: role === 'PHARMACIST',
    isAdmin: role === 'ADMIN'
  };
}

export async function login(req, res) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid login payload'
      });
    }

    const { email, password } = parseResult.data;

    const user = await queryOne(`
      SELECT u.*, w.name as ward_name, w.code as ward_code
      FROM users u
      LEFT JOIN wards w ON u.assigned_ward_id = w.id
      WHERE LOWER(u.email) = LOWER(?)
    `, [email]);

    if (!user) {
      await logAuditEvent({
        userId: null,
        action: 'LOGIN_FAILURE',
        entityType: 'AUTH',
        details: { email, reason: 'User not found' },
        req
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated. Please contact Administrator.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_FAILURE',
        entityType: 'AUTH',
        wardId: user.assigned_ward_id,
        details: { email, reason: 'Invalid credentials' },
        req
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      assigned_ward_id: user.assigned_ward_id,
      name: user.name
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      wardId: user.assigned_ward_id,
      details: { role: user.role, ward: user.ward_name },
      req
    });

    const { password_hash, ...safeUser } = user;

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser,
      permissions: getPermissionsForRole(user.role)
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication.'
    });
  }
}

export function getMe(req, res) {
  try {
    const { password_hash, ...safeUser } = req.user;
    return res.json({
      success: true,
      user: safeUser,
      permissions: getPermissionsForRole(req.user.role)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user profile.'
    });
  }
}

export async function logout(req, res) {
  if (req.user) {
    await logAuditEvent({
      userId: req.user.id,
      action: 'LOGOUT',
      entityType: 'AUTH',
      wardId: req.user.assigned_ward_id,
      details: 'User logged out',
      req
    });
  }
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
}

export async function getDemoAccounts(req, res) {
  try {
    const users = await query(`
      SELECT u.id, u.name, u.email, u.role, u.license_number, u.assigned_ward_id,
             w.name as ward_name, w.code as ward_code
      FROM users u
      LEFT JOIN wards w ON u.assigned_ward_id = w.id
      ORDER BY 
        CASE u.role 
          WHEN 'ADMIN' THEN 1 
          WHEN 'PHARMACIST' THEN 2 
          WHEN 'NURSE' THEN 3 
          ELSE 4 
        END, u.name
    `);

    // Default passwords for demo convenience
    const demoAccounts = users.map(u => ({
      ...u,
      demoPassword: u.role === 'ADMIN' ? 'admin123' : u.role === 'PHARMACIST' ? 'pharm123' : 'nurse123',
      permissions: getPermissionsForRole(u.role)
    }));

    return res.json({
      success: true,
      accounts: demoAccounts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch demo accounts.'
    });
  }
}
