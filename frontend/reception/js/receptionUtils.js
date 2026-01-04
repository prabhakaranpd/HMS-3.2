/**
 * HMS 3.0 - Reception Utilities
 * Age calculation and mobile validation
 */

const ReceptionUtils = {
  /**
   * Calculate age from DOB with specific formatting
   * - First month: "15 days"
   * - First year: "3 months 15 days"
   * - Up to 12 years: "5 years 3 months"
   * - Above 12 years: "25 years"
   */
  calculateAge(dob) {
    if (!dob) return 'Not provided';

    const birthDate = new Date(dob);
    const today = new Date();
    
    // Calculate difference
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    // Adjust for negative values
    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    // Total days for first month check
    const totalDays = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));

    // Format based on age
    if (totalDays < 30) {
      // First month: show days only
      return `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
    } else if (years < 1) {
      // First year: show months and days
      if (days === 0) {
        return `${months} month${months !== 1 ? 's' : ''}`;
      }
      return `${months} month${months !== 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`;
    } else if (years <= 12) {
      // Up to 12 years: show years and months
      if (months === 0) {
        return `${years} year${years !== 1 ? 's' : ''}`;
      }
      return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`;
    } else {
      // Above 12 years: show years only
      return `${years} year${years !== 1 ? 's' : ''}`;
    }
  },

  /**
   * Validate mobile number (10 digits only)
   */
  validateMobile(mobile) {
    return /^\d{10}$/.test(mobile);
  },

  /**
   * Get mobile validation status message
   */
  getMobileStatus(mobile) {
    const length = mobile.length;
    
    if (length === 0) {
      return { text: '', valid: false, class: '' };
    } else if (length < 10) {
      return { 
        text: `${length} digit${length !== 1 ? 's' : ''} (needs 10)`, 
        valid: false, 
        class: 'invalid' 
      };
    } else if (length === 10) {
      return { 
        text: '✅ Valid mobile number', 
        valid: true, 
        class: 'valid' 
      };
    }
    
    return { text: '', valid: false, class: '' };
  },

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};
