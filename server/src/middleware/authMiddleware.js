import jwt from 'jsonwebtoken';
import { queryOne } from '../db/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-hospital-mms-secret-key-change-in-prod-2026!';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No Bearer token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await queryOne(`
      SELECT u.id, u.name, u.email, u.role, u.license_number, u.assigned_ward_id, u.status,
             w.name as ward_name, w.code as ward_code
      FROM users u
      LEFT JOIN wards w ON u.assigned_ward_id = w.id
      WHERE u.id = ?
    `, [decoded.id]);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account no longer exists.'
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'User account is deactivated. Contact System Administrator.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid or malformed authentication token.'
    });
  }
}
