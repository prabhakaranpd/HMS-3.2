/**
 * HMS 3.0 - Reception Utilities
 */

const ReceptionUtils = {
  /**
   * Calculate age from date of birth
   */
  calculateAge(dob) {
    if (!dob) return '-';
    
    const birthDate = new Date(dob);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    if (days < 0) {
      months--;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    if (years === 0 && months === 0) {
      return `${days}d`;
    } else if (years === 0) {
      return `${months}m ${days}d`;
    } else if (months === 0 && days === 0) {
      return `${years}y`;
    } else if (years < 2) {
      return `${years}y ${months}m`;
    } else {
      return `${years}y`;
    }
  },

  /**
   * Get mobile number validation status
   */
  getMobileStatus(mobile) {
    if (!mobile) {
      return { text: '', class: '' };
    }
    
    if (mobile.length === 10) {
      return { 
        text: '✓ Valid', 
        class: 'valid' 
      };
    } else {
      return { 
        text: `✗ Invalid (${mobile.length}/10)`, 
        class: 'invalid' 
      };
    }
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
  },

  /**
   * Format date to DD/MM/YYYY
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  },

  /**
   * Format datetime to DD/MM/YYYY HH:MM
   */
  formatDateTime(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  },

  /**
   * Validate form fields
   */
  validateRequired(fields) {
    const errors = [];
    
    fields.forEach(field => {
      const element = document.getElementById(field.id);
      const value = element.value.trim();
      
      if (!value) {
        errors.push(field.label);
        element.classList.add('error');
      } else {
        element.classList.remove('error');
      }
    });
    
    return errors;
  },

  /**
   * Generate tooltip
   */
  showTooltip(element, message) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = message;
    
    element.appendChild(tooltip);
    
    setTimeout(() => {
      tooltip.remove();
    }, 2000);
  }
};
