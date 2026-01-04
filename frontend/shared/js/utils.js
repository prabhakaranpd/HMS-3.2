/**
 * HMS 3.0 - Utility Functions
 */

const Utils = {
  /**
   * Format date to readable string
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
   * Format datetime to readable string
   */
  formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * Format time ago (e.g., "5 minutes ago")
   */
  timeAgo(dateString) {
    if (!dateString) return '-';
    
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    return this.formatDate(dateString);
  },

  /**
   * Format duration in seconds to readable string
   */
  formatDuration(seconds) {
    if (!seconds) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && hours === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  },

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="flex: 1;">${message}</div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-in-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Confirm dialog
   */
  async confirm(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">Confirm Action</div>
          <div class="modal-body">${message}</div>
          <div class="modal-footer">
            <button class="btn btn-ghost" data-action="cancel">Cancel</button>
            <button class="btn btn-primary" data-action="confirm">Confirm</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.dataset.action === 'cancel') {
          overlay.remove();
          resolve(false);
        } else if (e.target.dataset.action === 'confirm') {
          overlay.remove();
          resolve(true);
        }
      });
    });
  },

  /**
   * Validate input
   */
  validate: {
    required: (value) => {
      return value && value.toString().trim().length > 0;
    },
    minLength: (value, min) => {
      return value && value.toString().length >= min;
    },
    maxLength: (value, max) => {
      return value && value.toString().length <= max;
    },
    email: (value) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(value);
    },
    number: (value) => {
      return !isNaN(value) && value !== '';
    }
  }
};
