const db = require('../config/database');

/**
 * Authentication and Role-Based Access Control (RBAC) Middleware
 * Enforces permissions for ADMIN, TEACHER, and STUDENT
 */
function extractUserFromRequest(req) {
  const users = db.getUsers();

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }

  if (token) {
    if (db.isTokenRevoked && db.isTokenRevoked(token)) {
      return null;
    }
    // Format: edumanage_jwt_<userId>_<timestamp>[_<random>]
    const match = token.match(/^edumanage_jwt_(.+?)_\d+(?:_[a-z0-9]+)?$/i) || token.match(/^edumanage_jwt_([^_]+)/);
    if (match) {
      const userId = match[1];
      const found = users.find(u => u.id === userId || u.studentId === userId || u.teacherId === userId);
      if (found) return found;
    }
    return null;
  }

  // 2. Check X-User-Id header
  const userIdHeader = req.headers['x-user-id'];
  if (userIdHeader) {
    const found = users.find(u => 
      u.id === userIdHeader || 
      u.studentId === userIdHeader || 
      u.teacherId === userIdHeader || 
      u.email?.toLowerCase() === userIdHeader.toLowerCase()
    );
    if (found) return found;
  }

  // 3. Check X-User-Email header
  const userEmailHeader = req.headers['x-user-email'];
  if (userEmailHeader) {
    const found = users.find(u => u.email?.toLowerCase() === userEmailHeader.toLowerCase());
    if (found) return found;
  }

  // 4. Check X-User-Role header
  const roleHeader = req.headers['x-user-role'];
  if (roleHeader) {
    const found = users.find(u => u.role.toUpperCase() === roleHeader.toUpperCase());
    if (found) return found;
  }

  return null;
}

function authenticate(req, res, next) {
  const user = extractUserFromRequest(req);
  const authHeader = req.headers.authorization;
  if (authHeader && !user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please sign in again.'
    });
  }
  req.user = user || null;
  req.userRole = user ? user.role : null;
  next();
}

function requireAuth(req, res, next) {
  const user = extractUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a valid Bearer token or credentials.'
    });
  }
  if (user.status === 'INACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'Account is deactivated / inactive. Access denied.'
    });
  }
  // Institution suspension check
  const instId = user.institutionId || 'inst-001';
  if (user.role !== 'SUPER_ADMIN' && instId !== 'system') {
    const institution = db.institutions.find(i => i.id === instId);
    if (institution && institution.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Institution subscription is suspended. Access denied. Please contact system administrator.'
      });
    }
  }
  req.user = user;
  req.userRole = user.role;
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const user = extractUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }
    if (user.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated / inactive. Access denied.'
      });
    }
    // Institution suspension check
    const instId = user.institutionId || 'inst-001';
    if (user.role !== 'SUPER_ADMIN' && instId !== 'system') {
      const institution = db.institutions.find(i => i.id === instId);
      if (institution && institution.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: 'Institution subscription is suspended. Access denied. Please contact system administrator.'
        });
      }
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Access restricted to: ${roles.join(', ')}.`
      });
    }
    req.user = user;
    req.userRole = user.role;
    next();
  };
}

module.exports = {
  extractUserFromRequest,
  authenticate,
  requireAuth,
  requireRoles
};
