const express = require('express');
const path = require('path');
const db = require('../config/db');
const { getClientIP, isIPBlocked, recordFailedAttempt, clearFailedAttempts } = require('../middleware/auth');

const router = express.Router();

/**
 * Create session record
 */
function createSessionRecord(sessionId, user, req) {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const now = new Date().toISOString();

  // Insert into active_sessions
  db.run(
    `INSERT OR REPLACE INTO active_sessions 
     (session_id, user_id, username, role, ip_address, user_agent, login_time, last_activity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, user.username, user.role, ip, userAgent, now, now]
  );

  // Insert into login_history (only if no recent active session)
  db.get(
    `SELECT id FROM login_history 
     WHERE user_id = ? AND logout_time IS NULL 
     AND datetime(login_time) > datetime('now', '-5 minutes')`,
    [user.id],
    (err, existing) => {
      if (!err && !existing) {
        db.run(
          `INSERT INTO login_history (user_id, username, login_time, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?)`,
          [user.id, user.username, now, ip, userAgent]
        );
      }
    }
  );
}

/**
 * Remove session record
 */
function removeSessionRecord(sessionId, reason = 'Manual Logout') {
  if (!sessionId) return;

  db.get(
    `SELECT user_id, username, login_time FROM active_sessions WHERE session_id = ?`,
    [sessionId],
    (err, session) => {
      if (err || !session) return;

      const loginTime = new Date(session.login_time);
      const logoutTime = new Date();
      const duration = Math.floor((logoutTime - loginTime) / 1000);

      // Update login_history - find the most recent active session first
      db.get(
        `SELECT id FROM login_history 
         WHERE user_id = ? AND username = ? AND logout_time IS NULL
         ORDER BY login_time DESC LIMIT 1`,
        [session.user_id, session.username],
        (err, record) => {
          if (!err && record) {
            db.run(
              `UPDATE login_history 
               SET logout_time = ?, session_duration = ?, logout_reason = ?
               WHERE id = ?`,
              [logoutTime.toISOString(), duration, reason, record.id]
            );
          }
        }
      );

      // Remove from active_sessions
      db.run(`DELETE FROM active_sessions WHERE session_id = ?`, [sessionId]);
    }
  );
}

/**
 * GET /login - Login page
 */
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'public', 'login.html'));
});

/**
 * POST /login - Login handler
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIP(req);
  
  // Check if IP is blocked
  if (isIPBlocked(ip)) {
    return res.status(429).json({ 
      error: 'Too many failed login attempts. Please try again in 30 minutes.' 
    });
  }

  db.get(
    `SELECT id, username, full_name, role
     FROM users
     WHERE username = ? COLLATE NOCASE AND password = ? AND is_active = 1`,
    [username, password],
    (err, user) => {
      if (err) {
        console.error('❌ Login error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        recordFailedAttempt(ip);
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Successful login
      clearFailedAttempts(ip);
      
      req.session.user = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      };

      createSessionRecord(req.sessionID, user, req);

      console.log(`✅ Login: ${user.username} (${user.role})`);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role
        },
        redirect: user.role === 'admin' ? '/admin-dashboard' : 
                  user.role === 'reception' ? '/reception-dashboard' :
                  `/${user.role}`
      });
    }
  );
});

/**
 * GET /logout - Logout
 */
router.get('/logout', (req, res) => {
  const sessionId = req.sessionID;
  removeSessionRecord(sessionId);
  
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

/**
 * POST /logout - Also handle POST logout
 */
router.post('/logout', (req, res) => {
  const sessionId = req.sessionID;
  removeSessionRecord(sessionId);
  
  req.session.destroy(() => {
    res.json({ success: true, redirect: '/login' });
  });
});

/**
 * GET / - Root redirect
 */
router.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect(`/${req.session.user.role}`);
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
