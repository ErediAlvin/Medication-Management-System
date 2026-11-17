import crypto from 'crypto';
import { execute } from '../db/db.js';

/**
 * Logs security, authentication, and clinical actions to the immutable audit log table
 */
export async function logAuditEvent({
  userId,
  action,
  entityType,
  entityId = null,
  wardId = null,
  details = null,
  req = null
}) {
  try {
    const id = 'audit-' + crypto.randomUUID();
    const ipAddress = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';

    const insertSql = `
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, ward_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await execute(insertSql, [
      id,
      userId || null,
      action,
      entityType,
      entityId || null,
      wardId || null,
      typeof details === 'object' ? JSON.stringify(details) : (details || null),
      ipAddress
    ]);
  } catch (err) {
    console.error('[Audit Log Error] Failed to write audit event:', err);
  }
}
