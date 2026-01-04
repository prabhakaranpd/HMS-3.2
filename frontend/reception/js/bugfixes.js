/**
 * HMS 3.0 - Bug Fixes Applied on Page Load
 */

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  
  // Fix 1: Set max date for all date inputs (no future dates)
  const dateInputs = ['dob', 'editDob', 'dateFrom', 'dateTo'];
  dateInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.setAttribute('max', today);
    }
  });

  // Fix 2: Date range validation (From <= To)
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  
  if (dateFrom && dateTo) {
    const validateDateRange = () => {
      if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
        dateTo.setCustomValidity('To date must be after From date');
      } else {
        dateTo.setCustomValidity('');
      }
    };
    
    dateFrom.addEventListener('change', validateDateRange);
    dateTo.addEventListener('change', validateDateRange);
  }

  console.log('✅ Bug fixes applied');
});
