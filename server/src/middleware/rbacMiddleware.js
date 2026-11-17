/**
 * Role-Based Access Control (RBAC) & Separation of Duties (SoD) Middleware
 */

// General role guard
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Role '${req.user.role}' lacks sufficient privileges. Required: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
}

/**
 * STRICT SAFETY RULE:
 * A Pharmacist can NEVER administer any medication directly to patients!
 * Administration is strictly reserved for authorized Hospital Nurses.
 */
export function preventPharmacistAdministration(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
  }

  if (req.user.role === 'PHARMACIST') {
    return res.status(403).json({
      success: false,
      error: 'Security Policy Violation: Pharmacists cannot administer medications directly to patients. Administration must be performed by an authorized Nurse.'
    });
  }

  if (req.user.role !== 'NURSE') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Only registered Hospital Nurses can administer medication doses.'
    });
  }

  next();
}

/**
 * Pharmacist or Admin only: For medication assignment and catalog management
 */
export function requirePharmacistOrAdmin(req, res, next) {
  return requireRoles('PHARMACIST', 'ADMIN')(req, res, next);
}

/**
 * Admin only: For user management, ward configuration, audit reviews
 */
export function requireAdmin(req, res, next) {
  return requireRoles('ADMIN')(req, res, next);
}

/**
 * Nurse only: For patient monitoring and medication administration
 */
export function requireNurse(req, res, next) {
  return requireRoles('NURSE')(req, res, next);
}
