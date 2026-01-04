/**
 * HMS 3.0 - Admin Navigation
 */

const Navigation = {
  init() {
    // Get all nav items
    const navItems = document.querySelectorAll('.nav-item:not([style*="cursor: not-allowed"])');
    
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabName = item.dataset.tab;
        this.switchTab(tabName);
      });
    });
  },

  switchTab(tabName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Load tab data
    this.loadTabData(tabName);
  },

  loadTabData(tabName) {
    switch(tabName) {
      case 'dashboard':
        Dashboard.load();
        break;
      case 'users':
        Users.load();
        break;
      case 'security':
        Security.load();
        break;
      case 'backup':
        Backup.load();
        break;
    }
  }
};
