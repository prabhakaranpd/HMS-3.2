/**
 * HMS 3.0 - Legacy Data Viewer
 */

const LegacyViewer = {
  currentTable: 'vaccines',
  currentPage: 1,
  perPage: 20,
  totalRecords: 0,
  currentFilters: {},

  init() {
    // Tab switching
    document.querySelectorAll('[data-legacy-table]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTable(e.target.dataset.legacyTable);
      });
    });

    // Filter form
    document.getElementById('legacyFilterForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.currentPage = 1;
      this.applyFilters();
    });

    // Per page selector
    document.getElementById('legacyPerPageSelect').addEventListener('change', (e) => {
      this.perPage = parseInt(e.target.value);
      this.currentPage = 1;
      this.loadRecords();
    });

    // Sort order toggle
    document.getElementById('legacySortOrderBtn').addEventListener('click', () => {
      const btn = document.getElementById('legacySortOrderBtn');
      const currentOrder = btn.dataset.order || 'DESC';
      btn.dataset.order = currentOrder === 'DESC' ? 'ASC' : 'DESC';
      btn.textContent = currentOrder === 'DESC' ? '↑' : '↓';
      this.loadRecords();
    });

    // Sort by selector
    document.getElementById('legacySortBySelect').addEventListener('change', () => {
      this.loadRecords();
    });

    // Export CSV
    document.getElementById('exportLegacyCsvBtn').addEventListener('click', () => {
      this.exportCSV();
    });

    // Print
    document.getElementById('printLegacyBtn').addEventListener('click', () => {
      window.print();
    });

    // Load initial data
    this.loadRecords();
  },

  switchTable(tableName) {
    this.currentTable = tableName;
    this.currentPage = 1;
    this.currentFilters = {};

    // Update active tab
    document.querySelectorAll('[data-legacy-table]').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-legacy-table="${tableName}"]`).classList.add('active');

    // Reset filters
    document.getElementById('legacyFilterForm').reset();

    // Load records
    this.loadRecords();
  },

  applyFilters() {
    this.currentFilters = {
      search: document.getElementById('legacySearchFilter').value
    };

    this.loadRecords();
  },

  async loadRecords() {
    try {
      const params = new URLSearchParams({
        ...this.currentFilters,
        sort_by: document.getElementById('legacySortBySelect').value,
        sort_order: document.getElementById('legacySortOrderBtn').dataset.order || 'DESC',
        limit: this.perPage,
        offset: (this.currentPage - 1) * this.perPage
      });

      const { records, total } = await API.get(`/api/reception/legacy/${this.currentTable}?${params}`);
      
      this.totalRecords = total;
      this.renderTable(records);
      this.renderPagination();
      
    } catch (error) {
      Utils.showToast('Failed to load legacy records', 'error');
      console.error(error);
    }
  },

  renderTable(records) {
    const container = document.getElementById('legacyTableContainer');
    
    if (records.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><p>No legacy records found</p><p style="font-size: 13px; color: #64748b;">Import HMS 2.0 data from Import/Export tab</p></div>';
      return;
    }

    let tableHTML = '<table class="records-table"><thead><tr>';

    // Table headers based on current table
    if (this.currentTable === 'vaccines') {
      tableHTML += '<th>S.No</th><th>RegNo</th><th>Name</th><th>Age/Sex</th><th>Father</th><th>Mother</th><th>Mobile</th><th>Visit Date</th><th>Vaccine Given</th><th>Next Vaccine</th><th>Next Date</th>';
    } else if (this.currentTable === 'followup') {
      tableHTML += '<th>S.No</th><th>RegNo</th><th>Name</th><th>Age/Sex</th><th>Mobile</th><th>Visit Date</th><th>Entry Type</th><th>Followup Reason</th><th>Followup Date</th><th>Status</th>';
    }

    tableHTML += '</tr></thead><tbody>';

    // Table rows
    records.forEach((record, index) => {
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
      tableHTML += `<tr class="${rowClass}" onclick="LegacyViewer.openModal('${this.currentTable}', ${record.id})">`;

      if (this.currentTable === 'vaccines') {
        tableHTML += `
          <td>${record.s_no || '-'}</td>
          <td>${record.regno || '-'}</td>
          <td>${record.name || '-'}</td>
          <td>${record.age_sex || '-'}</td>
          <td>${record.father_name || '-'}</td>
          <td>${record.mother_name || '-'}</td>
          <td>${record.mobile_no || '-'}</td>
          <td>${this.formatDate(record.visit_date)}</td>
          <td><strong>${record.vaccine_given || '-'}</strong></td>
          <td>${record.next_vaccine || '-'}</td>
          <td>${this.formatDate(record.next_vaccine_date)}</td>
        `;
      } else if (this.currentTable === 'followup') {
        tableHTML += `
          <td>${record.s_no || '-'}</td>
          <td>${record.regno || '-'}</td>
          <td>${record.name || '-'}</td>
          <td>${record.age_sex || '-'}</td>
          <td>${record.mobile_no || '-'}</td>
          <td>${this.formatDate(record.visit_date)}</td>
          <td>${record.entry_type || '-'}</td>
          <td>${this.truncate(record.followup_reason, 40)}</td>
          <td>${this.formatDate(record.followup_date)}</td>
          <td>${record.status || '-'}</td>
        `;
      }

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  },

  renderPagination() {
    const totalPages = Math.ceil(this.totalRecords / this.perPage);
    const container = document.getElementById('legacyPaginationContainer');
    
    let html = `<div class="pagination-info">Showing ${((this.currentPage - 1) * this.perPage) + 1}-${Math.min(this.currentPage * this.perPage, this.totalRecords)} of ${this.totalRecords}</div>`;
    html += '<div class="pagination-buttons">';
    
    // Previous button
    html += `<button class="btn-modern btn-secondary" ${this.currentPage === 1 ? 'disabled' : ''} onclick="LegacyViewer.goToPage(${this.currentPage - 1})">◀ Prev</button>`;
    
    // Page numbers
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
      html += `<button class="btn-modern ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}" onclick="LegacyViewer.goToPage(${i})">${i}</button>`;
    }
    
    if (totalPages > 5) {
      html += '<span>...</span>';
    }
    
    // Next button
    html += `<button class="btn-modern btn-secondary" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="LegacyViewer.goToPage(${this.currentPage + 1})">Next ▶</button>`;
    
    html += '</div>';
    container.innerHTML = html;
  },

  goToPage(page) {
    this.currentPage = page;
    this.loadRecords();
  },

  async openModal(type, id) {
    const modal = document.getElementById('recordDetailModal');
    const modalBody = document.getElementById('recordModalBody');
    const modalTitle = document.getElementById('recordModalTitle');
    
    try {
      modalBody.innerHTML = '<div style="text-align: center; padding: 40px;">Loading...</div>';
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('active'), 10);

      const { record } = await API.get(`/api/reception/legacy/${type}/${id}`);

      if (type === 'vaccines') {
        this.renderVaccineModal(record, modalBody, modalTitle);
      } else if (type === 'followup') {
        this.renderFollowupModal(record, modalBody, modalTitle);
      }

    } catch (error) {
      Utils.showToast('Failed to load details', 'error');
      ViewRecords.closeRecordModal();
    }
  },

  renderVaccineModal(record, modalBody, modalTitle) {
    modalTitle.textContent = `💉 Legacy Vaccine Record - ${record.name || 'Unknown'}`;

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h3>Patient Information</h3>
          <div class="detail-row">
            <span class="detail-label">S.No:</span>
            <span class="detail-value">${record.s_no || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Reg.No:</span>
            <span class="detail-value">${record.regno || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${record.name || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Age/Sex:</span>
            <span class="detail-value">${record.age_sex || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Family Information</h3>
          <div class="detail-row">
            <span class="detail-label">Father's Name:</span>
            <span class="detail-value">${record.father_name || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Mother's Name:</span>
            <span class="detail-value">${record.mother_name || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Contact Information</h3>
          <div class="detail-row">
            <span class="detail-label">Mobile No:</span>
            <span class="detail-value">${record.mobile_no || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Address:</span>
            <span class="detail-value">${record.address || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Vaccine Details</h3>
          <div class="detail-row">
            <span class="detail-label">Visit Date:</span>
            <span class="detail-value">${this.formatDate(record.visit_date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Vaccine Given:</span>
            <span class="detail-value"><strong>${record.vaccine_given || '-'}</strong></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Next Vaccine:</span>
            <span class="detail-value">${record.next_vaccine || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Next Vaccine Date:</span>
            <span class="detail-value">${this.formatDate(record.next_vaccine_date)}</span>
          </div>
        </div>

        <div class="detail-section full-width">
          <h3>Additional Information</h3>
          <div class="detail-row">
            <span class="detail-label">Entry Date:</span>
            <span class="detail-value">${this.formatDate(record.entry_date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Additional Instructions:</span>
            <span class="detail-value">${record.additional_instructions || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Imported At:</span>
            <span class="detail-value">${this.formatDateTime(record.imported_at)}</span>
          </div>
        </div>
      </div>
    `;
  },

  renderFollowupModal(record, modalBody, modalTitle) {
    modalTitle.textContent = `📅 Legacy Follow-up Record - ${record.name || 'Unknown'}`;

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h3>Patient Information</h3>
          <div class="detail-row">
            <span class="detail-label">S.No:</span>
            <span class="detail-value">${record.s_no || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Reg.No:</span>
            <span class="detail-value">${record.regno || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${record.name || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Age/Sex:</span>
            <span class="detail-value">${record.age_sex || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Family Information</h3>
          <div class="detail-row">
            <span class="detail-label">Father's Name:</span>
            <span class="detail-value">${record.father_name || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Mother's Name:</span>
            <span class="detail-value">${record.mother_name || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Contact Information</h3>
          <div class="detail-row">
            <span class="detail-label">Mobile No:</span>
            <span class="detail-value">${record.mobile_no || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Address:</span>
            <span class="detail-value">${record.address || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Follow-up Details</h3>
          <div class="detail-row">
            <span class="detail-label">Entry Type:</span>
            <span class="detail-value">${record.entry_type || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Visit Date:</span>
            <span class="detail-value">${this.formatDate(record.visit_date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Followup Date:</span>
            <span class="detail-value">${this.formatDate(record.followup_date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${record.status || '-'}</span>
          </div>
        </div>

        <div class="detail-section full-width">
          <h3>Complaints & Reason</h3>
          <div class="detail-row">
            <span class="detail-label">Present Complaints:</span>
            <span class="detail-value">${record.present_complaints || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Followup Reason:</span>
            <span class="detail-value">${record.followup_reason || '-'}</span>
          </div>
        </div>

        <div class="detail-section full-width">
          <h3>Additional Information</h3>
          <div class="detail-row">
            <span class="detail-label">Entry Date:</span>
            <span class="detail-value">${this.formatDate(record.entry_date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Additional Instructions:</span>
            <span class="detail-value">${record.additional_instructions || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Log:</span>
            <span class="detail-value">${record.log || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Imported At:</span>
            <span class="detail-value">${this.formatDateTime(record.imported_at)}</span>
          </div>
        </div>
      </div>
    `;
  },

  exportCSV() {
    window.location.href = `/api/reception/legacy/export/${this.currentTable}`;
    Utils.showToast('Legacy CSV export started', 'success');
  },

  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return as-is if invalid
    return date.toLocaleDateString('en-GB');
  },

  formatDateTime(dateTimeString) {
    if (!dateTimeString) return '-';
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return dateTimeString;
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  truncate(str, len) {
    if (!str) return '-';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }
};
