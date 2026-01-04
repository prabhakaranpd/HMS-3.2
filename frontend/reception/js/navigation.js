/**
 * HMS 3.0 - Reception Navigation
 */

const Navigation = {
  init() {
    // Tab navigation - using nav-item (sidebar items)
    const navItems = document.querySelectorAll('.nav-item');
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
    document.querySelector(`.nav-item[data-tab="${tabName}"]`)?.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName)?.classList.add('active');

    // Load tab data
    this.loadTabData(tabName);
  },

  loadTabData(tabName) {
    switch(tabName) {
      case 'dashboard':
        SmartSearch.init();
        break;
      case 'register':
        Register.loadLastRegistration();
        break;
      case 'records':
        ViewRecords.loadRecords();
        break;
      case 'legacy-viewer':
        LegacyViewer.loadRecords();
        break;
      case 'import-export':
        // Static tab
        break;
    }
  }
};
