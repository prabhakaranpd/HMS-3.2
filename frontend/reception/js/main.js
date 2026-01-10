/**
 * HMS 3.0 - Reception Main Entry Point
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
  Navigation.init();
  Register.init();
  SmartSearch.init();
  ImportExport.init();
  ViewRecords.init();
  LegacyViewer.init();
  OPDEntry.init();  // ← ADD THIS LINE

  // Load queue count
  Register.loadQueueCount();

  console.log('✅ HMS 3.0 Reception Module Initialized');
});