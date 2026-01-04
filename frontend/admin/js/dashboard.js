/**
 * HMS 3.0 - Admin Dashboard
 */

const Dashboard = {
  async load() {
    await this.loadStats();
    await this.loadActivity();
  },

  async loadStats() {
    try {
      const stats = await API.get('/api/admin/stats');
      
      document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
      document.getElementById('activeSessions').textContent = stats.activeSessions || 0;
      document.getElementById('todayPatients').textContent = stats.todayPatients || 0;
      document.getElementById('totalPatients').textContent = stats.totalPatients || 0;
    } catch (error) {
      Utils.showToast('Failed to load stats', 'error');
    }
  },

  async loadActivity() {
    try {
      const activity = await API.get('/api/admin/activity');
      const list = document.getElementById('activityList');
      
      if (activity.length === 0) {
        list.innerHTML = `
          <li class="activity-item">
            <div class="empty-state">
              <div class="empty-state-icon">📭</div>
              <p>No recent activity</p>
            </div>
          </li>
        `;
        return;
      }

      list.innerHTML = activity.map(item => `
        <li class="activity-item">
          <div class="activity-icon">🔑</div>
          <div class="activity-content">
            <div class="activity-message">${item.message}</div>
            <div class="activity-time">${Utils.timeAgo(item.timestamp)}</div>
          </div>
        </li>
      `).join('');
    } catch (error) {
      console.error('Failed to load activity:', error);
    }
  }
};
