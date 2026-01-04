/**
 * HMS 3.0 - Security Management
 */

const Security = {
  async load() {
    await this.loadSessions();
    await this.loadLoginHistory();
  },

  async loadSessions() {
    try {
      const sessions = await API.get('/api/admin/sessions');
      const tbody = document.getElementById('sessionsTableBody');
      
      if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No active sessions</td></tr>';
        return;
      }

      tbody.innerHTML = sessions.map(session => `
        <tr>
          <td>
            <div><strong>${session.username}</strong></div>
            <div class="text-muted" style="font-size: 12px;">${session.role}</div>
          </td>
          <td>${session.ip_address}</td>
          <td>${Utils.formatDateTime(session.login_time)}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="Security.terminateSession('${session.session_id}', '${session.username}')">
              Force Logout
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      Utils.showToast('Failed to load sessions', 'error');
    }
  },

  async terminateSession(sessionId, username) {
    const confirmed = await Utils.confirm(`Force logout user "${username}"?`);
    if (!confirmed) return;

    try {
      await API.delete(`/api/admin/sessions/${sessionId}`);
      Utils.showToast('Session terminated successfully', 'success');
      this.loadSessions();
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },

  async loadLoginHistory() {
    try {
      const history = await API.get('/api/admin/login-history?days=30');
      const tbody = document.getElementById('loginHistoryBody');
      
      if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No login history</td></tr>';
        return;
      }

      tbody.innerHTML = history.map(record => `
        <tr>
          <td>${record.username}</td>
          <td>
            <div>${Utils.formatDateTime(record.login_time)}</div>
            ${record.logout_time ? 
              `<div class="text-muted" style="font-size: 11px;">Logged out: ${Utils.formatDateTime(record.logout_time)}</div>` : 
              '<div class="badge badge-success" style="font-size: 10px;">Active</div>'}
          </td>
          <td>${record.session_duration ? Utils.formatDuration(record.session_duration) : '-'}</td>
        </tr>
      `).join('');
    } catch (error) {
      Utils.showToast('Failed to load login history', 'error');
    }
  }
};
