/**
 * HMS 3.0 - Admin Main Entry Point
 */

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
  Navigation.init();
  Users.init();
  Backup.init();

  // Load initial dashboard
  Dashboard.load();

  // Set user info in sidebar (TODO: get from session)
  // For now, using placeholder
  console.log('✅ HMS 3.0 Admin Panel Initialized');
});
