const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// All routes require admin
router.use(requireAdmin);

/* ==================================================
   DASHBOARD STATS
================================================== */
router.get('/stats', (req, res) => {
  const stats = {};

  // Total users
  db.get(`SELECT COUNT(*) as count FROM users WHERE is_active = 1`, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.totalUsers = row.count;

    // Active sessions
    db.get(`SELECT COUNT(*) as count FROM active_sessions`, (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.activeSessions = row.count;

      // Today's patients
      const today = new Date().toISOString().split('T')[0];
      db.get(
        `SELECT COUNT(*) as count FROM op_register WHERE visit_date = ?`,
        [today],
        (err, row) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          stats.todayPatients = row.count;

          // Total patients
          db.get(`SELECT COUNT(*) as count FROM patients`, (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            stats.totalPatients = row.count;

            res.json(stats);
          });
        }
      );
    });
  });
});

/* ==================================================
   RECENT ACTIVITY
================================================== */
router.get('/activity', (req, res) => {
  const sql = `
    SELECT username, login_time, ip_address
    FROM login_history
    ORDER BY login_time DESC
    LIMIT 10
  `;

  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    const activity = rows.map(row => ({
      type: 'login',
      message: `${row.username} logged in from ${row.ip_address}`,
      timestamp: row.login_time
    }));

    res.json(activity);
  });
});

/* ==================================================
   USER MANAGEMENT
================================================== */

// Get all users
router.get('/users', (req, res) => {
  db.all(
    `SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

// Create user
router.post('/users', (req, res) => {
  const { username, password, full_name, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validRoles = ['admin', 'reception', 'doctor', 'nurse', 'lab', 'pharmacy', 'management'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  db.run(
    `INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)`,
    [username, password, full_name || null, role],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: 'Failed to create user' });
      }

      res.json({
        message: 'User created successfully',
        userId: this.lastID
      });
    }
  );
});

// Update user
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { username, full_name, role, is_active } = req.body;

  const validRoles = ['admin', 'reception', 'doctor', 'nurse', 'lab', 'pharmacy', 'management'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  db.run(
    `UPDATE users 
     SET username = ?, full_name = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [username, full_name, role, is_active, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: 'Update failed' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User updated successfully' });
    }
  );
});

// Delete user
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (parseInt(id) === req.session.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  db.run(`DELETE FROM users WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  });
});

// Reset password
router.put('/users/:id/password', (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  db.run(
    `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [newPassword, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Password reset failed' });
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'Password reset successfully' });
    }
  );
});

/* ==================================================
   SECURITY MANAGEMENT
================================================== */

// Get active sessions
router.get('/sessions', (req, res) => {
  db.all(
    `SELECT session_id, username, role, ip_address, login_time, last_activity 
     FROM active_sessions 
     ORDER BY login_time DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

// Force logout session
router.delete('/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // Prevent admin from logging themselves out
  if (sessionId === req.sessionID) {
    return res.status(400).json({ error: 'Cannot terminate your own session' });
  }

  db.run(`DELETE FROM active_sessions WHERE session_id = ?`, [sessionId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to terminate session' });
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session terminated successfully' });
  });
});

// Get login history
router.get('/login-history', (req, res) => {
  const { days = 30 } = req.query;

  db.all(
    `SELECT id, username, login_time, logout_time, session_duration, ip_address, logout_reason
     FROM login_history
     WHERE datetime(login_time) >= datetime('now', '-${parseInt(days)} days')
     ORDER BY login_time DESC
     LIMIT 100`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

/* ==================================================
   BACKUP MANAGEMENT
================================================== */

// Get backup settings
router.get('/backup/settings', (req, res) => {
  db.all(
    `SELECT key, value FROM system_settings WHERE key LIKE 'auto_backup%' OR key LIKE 'backup_%'`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      const settings = {};
      rows.forEach(row => settings[row.key] = row.value);
      
      res.json(settings);
    }
  );
});

// Update backup settings
router.put('/backup/settings', (req, res) => {
  const { auto_backup_enabled, auto_backup_time, backup_retention_days } = req.body;

  const updates = [];
  if (auto_backup_enabled !== undefined) {
    updates.push(['auto_backup_enabled', auto_backup_enabled.toString()]);
  }
  if (auto_backup_time) {
    updates.push(['auto_backup_time', auto_backup_time]);
  }
  if (backup_retention_days) {
    updates.push(['backup_retention_days', backup_retention_days.toString()]);
  }

  let completed = 0;
  updates.forEach(([key, value]) => {
    db.run(
      `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [key, value],
      (err) => {
        if (err) console.error('Setting update error:', err);
        completed++;
        
        if (completed === updates.length) {
          res.json({ message: 'Settings updated successfully' });
        }
      }
    );
  });

  if (updates.length === 0) {
    res.json({ message: 'No settings to update' });
  }
});

// Download backup
router.get('/backup/download', (req, res) => {
  const dbPath = path.join(__dirname, '..', '..', 'database', 'hospital.db');
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `hospital-backup-${timestamp}.db`;

  res.download(dbPath, filename, (err) => {
    if (err) {
      console.error('Backup download error:', err);
      res.status(500).json({ error: 'Backup download failed' });
    }
  });
});

// List available backups
router.get('/backup/list', (req, res) => {
  const backupDir = path.join(__dirname, '..', '..', 'database', 'backups');
  
  if (!fs.existsSync(backupDir)) {
    return res.json({ backups: [] });
  }

  fs.readdir(backupDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to list backups' });

    const backups = files
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          size: stats.size,
          created: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({ backups });
  });
});

module.exports = router;
