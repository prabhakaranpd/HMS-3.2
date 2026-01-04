const db = require('../config/db');

// Simple in-memory IP blocking (resets on server restart)
const failedAttempts = new Map(); // ip -> { count, blockedUntil }

/**
 * Get client IP address
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         'Unknown';
}

/**
 * Check if IP is temporarily blocked
 */
function isIPBlocked(ip) {
  const record = failedAttempts.get(ip);
  if (!record) return false;
  
  if (Date.now() < record.blockedUntil) {
    return true;
  }
  
  // Block expired, clear it
  failedAttempts.delete(ip);
  return false;
}

/**
 * Record failed login attempt
 */
function recordFailedAttempt(ip) {
  const record = failedAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  record.count++;
  
  if (record.count >= 5) {
    // Block for 30 minutes
    record.blockedUntil = Date.now() + (30 * 60 * 1000);
    console.log(`⚠️  IP ${ip} blocked for 30 minutes (5 failed attempts)`);
  }
  
  failedAttempts.set(ip, record);
}

/**
 * Clear failed attempts on successful login
 */
function clearFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

/**
 * Update session last activity
 */
function updateSessionActivity(sessionId) {
  if (!sessionId) return;
  
  const now = new Date().toISOString();
  
  db.run(
    `UPDATE active_sessions SET last_activity = ? WHERE session_id = ?`,
    [now, sessionId],
    (err) => {
      if (err) console.error('Session update error:', err);
    }
  );
}

/**
 * Middleware: Require login
 */
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  updateSessionActivity(req.sessionID);
  next();
}

/**
 * Middleware: Require admin role
 */
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  updateSessionActivity(req.sessionID);
  next();
}

/**
 * Middleware: Require specific role
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Admins have access to everything
    if (req.session.user.role === 'admin') {
      updateSessionActivity(req.sessionID);
      return next();
    }
    
    if (req.session.user.role !== role) {
      return res.status(403).json({ error: `${role} access required` });
    }
    
    updateSessionActivity(req.sessionID);
    next();
  };
}

module.exports = {
  getClientIP,
  isIPBlocked,
  recordFailedAttempt,
  clearFailedAttempts,
  requireLogin,
  requireAdmin,
  requireRole
};
