const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('../config/db');

const dbPath = path.join(__dirname, '..', '..', 'database', 'hospital.db');
const backupDir = path.join(__dirname, '..', '..', 'database', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/**
 * Create a backup of the database
 */
function createBackup() {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    // Copy database file
    fs.copyFile(dbPath, backupPath, (err) => {
      if (err) {
        console.error('❌ Backup failed:', err);
        reject(err);
      } else {
        console.log('✅ Backup created:', backupPath);
        resolve(backupPath);
      }
    });
  });
}

/**
 * Delete old backups based on retention policy
 */
function cleanOldBackups(retentionDays = 30) {
  fs.readdir(backupDir, (err, files) => {
    if (err) {
      console.error('Error reading backup directory:', err);
      return;
    }

    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000; // days to milliseconds

    files.forEach(file => {
      const filePath = path.join(backupDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        const age = now - stats.mtime.getTime();
        if (age > maxAge) {
          fs.unlink(filePath, (err) => {
            if (!err) {
              console.log(`🗑️  Deleted old backup: ${file}`);
            }
          });
        }
      });
    });
  });
}

/**
 * Initialize auto-backup scheduler
 */
function initializeAutoBackup() {
  db.all(
    `SELECT key, value FROM system_settings WHERE key IN ('auto_backup_enabled', 'auto_backup_time', 'backup_retention_days')`,
    (err, rows) => {
      if (err) {
        console.error('Error loading backup settings:', err);
        return;
      }

      const settings = {};
      rows.forEach(row => settings[row.key] = row.value);

      const enabled = settings.auto_backup_enabled === 'true';
      const time = settings.auto_backup_time || '23:00';
      const retention = parseInt(settings.backup_retention_days) || 30;

      if (!enabled) {
        console.log('ℹ️  Auto-backup is disabled');
        return;
      }

      // Parse time (HH:MM)
      const [hour, minute] = time.split(':');

      // Schedule daily backup
      const cronExpression = `${minute} ${hour} * * *`;
      
      cron.schedule(cronExpression, () => {
        console.log('⏰ Running scheduled backup...');
        createBackup()
          .then(() => cleanOldBackups(retention))
          .catch(err => console.error('Scheduled backup failed:', err));
      });

      console.log(`✅ Auto-backup scheduled: Daily at ${time} (retention: ${retention} days)`);
    }
  );
}

module.exports = {
  createBackup,
  cleanOldBackups,
  initializeAutoBackup
};
