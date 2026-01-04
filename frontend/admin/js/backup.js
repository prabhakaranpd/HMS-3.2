/**
 * HMS 3.0 - Backup Management
 */

const Backup = {
  init() {
    // Download backup button
    document.getElementById('downloadBackupBtn').addEventListener('click', () => {
      this.downloadBackup();
    });

    // Save backup settings button
    document.getElementById('saveBackupSettings').addEventListener('click', () => {
      this.saveSettings();
    });
  },

  async load() {
    await this.loadSettings();
    await this.loadBackupList();
  },

  async loadSettings() {
    try {
      const settings = await API.get('/api/admin/backup/settings');
      
      document.getElementById('autoBackupEnabled').checked = settings.auto_backup_enabled === 'true';
      document.getElementById('backupTime').value = settings.auto_backup_time || '23:00';
      document.getElementById('retentionDays').value = settings.backup_retention_days || '30';
    } catch (error) {
      console.error('Failed to load backup settings:', error);
    }
  },

  async saveSettings() {
    const settings = {
      auto_backup_enabled: document.getElementById('autoBackupEnabled').checked,
      auto_backup_time: document.getElementById('backupTime').value,
      backup_retention_days: document.getElementById('retentionDays').value
    };

    try {
      await API.put('/api/admin/backup/settings', settings);
      Utils.showToast('Backup settings saved successfully', 'success');
    } catch (error) {
      Utils.showToast('Failed to save settings', 'error');
    }
  },

  downloadBackup() {
    // Create temporary link to download
    const timestamp = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.href = '/api/admin/backup/download';
    link.download = `hospital-backup-${timestamp}.db`;
    link.click();
    
    Utils.showToast('Backup download started', 'success');
  },

  async loadBackupList() {
    try {
      const { backups } = await API.get('/api/admin/backup/list');
      const container = document.getElementById('backupsList');
      
      if (backups.length === 0) {
        container.innerHTML = '<p class="text-muted">No backups available</p>';
        return;
      }

      container.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${backups.map(backup => `
              <tr>
                <td>${backup.filename}</td>
                <td>${Utils.formatFileSize(backup.size)}</td>
                <td>${Utils.formatDateTime(backup.created)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      document.getElementById('backupsList').innerHTML = '<p class="text-muted">Failed to load backups</p>';
    }
  }
};
