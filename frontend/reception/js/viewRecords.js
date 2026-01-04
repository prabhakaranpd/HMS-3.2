/**
 * HMS 3.0 - Records Viewer
 */

const ViewRecords = {
  currentTable: 'patients',
  currentPage: 1,
  perPage: 20,
  totalRecords: 0,
  currentFilters: {},

  init() {
    // Tab switching
    document.querySelectorAll('.records-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTable(e.target.dataset.table);
      });
    });

    // Filter form
    document.getElementById('recordsFilterForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.currentPage = 1;
      this.applyFilters();
    });

    // Date quick filter - clear custom dates when using quick filter
    document.getElementById('dateQuickFilter').addEventListener('change', (e) => {
      if (e.target.value !== 'custom' && e.target.value !== '') {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
      }
    });

    // Per page selector
    document.getElementById('perPageSelect').addEventListener('change', (e) => {
      this.perPage = parseInt(e.target.value);
      this.currentPage = 1;
      this.loadRecords();
    });

    // Sort order toggle
    document.getElementById('sortOrderBtn').addEventListener('click', () => {
      const btn = document.getElementById('sortOrderBtn');
      const currentOrder = btn.dataset.order || 'DESC';
      btn.dataset.order = currentOrder === 'DESC' ? 'ASC' : 'DESC';
      btn.textContent = currentOrder === 'DESC' ? '↑' : '↓';
      this.loadRecords();
    });

    // Sort by selector
    document.getElementById('sortBySelect').addEventListener('change', () => {
      this.loadRecords();
    });

    // Export CSV
    document.getElementById('exportCsvBtn').addEventListener('click', () => {
      this.exportCSV();
    });

    // Print
    document.getElementById('printBtn').addEventListener('click', () => {
      window.print();
    });

    // Modal close buttons
    document.getElementById('closeRecordModal').addEventListener('click', () => {
      this.closeRecordModal();
    });
    
    document.getElementById('closeRecordModalBtn').addEventListener('click', () => {
      this.closeRecordModal();
    });

    // Load initial data
    this.loadRecords();
  },

  clearFilters() {
    document.getElementById('recordsFilterForm').reset();
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    this.currentPage = 1;
    this.currentFilters = {};
    this.loadRecords();
  },

  switchTable(tableName) {
    this.currentTable = tableName;
    this.currentPage = 1;
    this.currentFilters = {};

    // Update active tab
    document.querySelectorAll('.records-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-table="${tableName}"]`).classList.add('active');

    // Reset filters
    document.getElementById('recordsFilterForm').reset();
    document.getElementById('dateQuickFilter').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';

    // Show/hide table-specific filters
    this.updateFilterVisibility();

    // Load records
    this.loadRecords();
  },

  updateFilterVisibility() {
    // Hide all specific filters
    document.getElementById('opFilters').style.display = 'none';
    document.getElementById('opFilters2').style.display = 'none';
    document.getElementById('vaccineFilters').style.display = 'none';
    document.getElementById('followupFilters').style.display = 'none';

    // Show relevant filters
    if (this.currentTable === 'op-register') {
      document.getElementById('opFilters').style.display = 'block';
      document.getElementById('opFilters2').style.display = 'block';
      this.loadDoctorsList();
    } else if (this.currentTable === 'vaccines') {
      document.getElementById('vaccineFilters').style.display = 'block';
    } else if (this.currentTable === 'followup') {
      document.getElementById('followupFilters').style.display = 'block';
    }
  },

  async loadDoctorsList() {
    try {
      const { doctors } = await API.get('/api/reception/doctors-list');
      const select = document.getElementById('doctorFilter');
      select.innerHTML = '<option value="">All Doctors</option>';
      doctors.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.full_name}</option>`;
      });
    } catch (error) {
      console.error('Failed to load doctors:', error);
    }
  },

  applyFilters() {
    const dateQuick = document.getElementById('dateQuickFilter').value;
    
    this.currentFilters = {
      date: dateQuick === 'custom' ? '' : dateQuick,
      date_from: dateQuick === 'custom' ? document.getElementById('dateFrom').value : '',
      date_to: dateQuick === 'custom' ? document.getElementById('dateTo').value : '',
      search: document.getElementById('searchFilter').value
    };

    // Table-specific filters
    if (this.currentTable === 'op-register') {
      this.currentFilters.doctor = document.getElementById('doctorFilter').value;
      this.currentFilters.chief_complaints = document.getElementById('complaintsFilter').value;
    } else if (this.currentTable === 'vaccines') {
      this.currentFilters.vaccine_brand = document.getElementById('vaccineBrandFilter').value;
    } else if (this.currentTable === 'followup') {
      this.currentFilters.followup_reason = document.getElementById('followupReasonFilter').value;
    }

    this.loadRecords();
  },

  async loadRecords() {
    try {
      const params = new URLSearchParams({
        ...this.currentFilters,
        sort_by: document.getElementById('sortBySelect').value,
        sort_order: document.getElementById('sortOrderBtn').dataset.order || 'DESC',
        limit: this.perPage,
        offset: (this.currentPage - 1) * this.perPage
      });

      const { records, total } = await API.get(`/api/reception/records/${this.currentTable}?${params}`);
      
      this.totalRecords = total;
      this.renderTable(records);
      this.renderPagination();
      
    } catch (error) {
      Utils.showToast('Failed to load records', 'error');
      console.error(error);
    }
  },

  renderTable(records) {
    const container = document.getElementById('recordsTableContainer');
    
    if (records.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>No records found</p></div>';
      return;
    }

    let tableHTML = '<table class="records-table"><thead><tr>';

    // Table headers based on current table
    if (this.currentTable === 'patients') {
      tableHTML += '<th>RegNo</th><th>Name</th><th>DOB</th><th>Age</th><th>Gender</th><th>Father</th><th>Mother</th><th>Mobile</th><th>Address</th><th>Registered</th>';
    } else if (this.currentTable === 'op-register') {
      tableHTML += '<th>OP Number</th><th>Visit Date</th><th>RegNo</th><th>Name</th><th>Age</th><th>Gender</th><th>Mobile</th><th>Doctor</th><th>Complaints</th><th>Fee</th>';
    } else if (this.currentTable === 'vaccines') {
      tableHTML += '<th>Visit Date</th><th>RegNo</th><th>Name</th><th>Age</th><th>Vaccines Given</th><th>Batch</th><th>Next Dose Due</th>';
    } else if (this.currentTable === 'followup') {
      tableHTML += '<th>Follow-up Date</th><th>RegNo</th><th>Name</th><th>Age</th><th>Type</th><th>Reason</th><th>Next Visit</th><th>Status</th><th>Contact</th>';
    }

    tableHTML += '</tr></thead><tbody>';

    // Table rows
    records.forEach((record, index) => {
      const rowClass = this.getRowClass(record, index);
      tableHTML += `<tr class="${rowClass}" onclick="ViewRecords.openModal('${this.currentTable}', ${record.id || record.op_register_id})">`;

      if (this.currentTable === 'patients') {
        const age = ReceptionUtils.calculateAge(record.dob);
        tableHTML += `
          <td>${record.regno}</td>
          <td>${record.name}</td>
          <td>${this.formatDate(record.dob)}</td>
          <td>${age}</td>
          <td>${record.gender === 'M' ? 'MALE' : 'FEMALE'}</td>
          <td>${record.father || '-'}</td>
          <td>${record.mother || '-'}</td>
          <td>${record.mobile || '-'}</td>
          <td>${this.truncate(record.address, 30)}</td>
          <td>${this.formatDate(record.created_at)}</td>
        `;
      } else if (this.currentTable === 'op-register') {
        tableHTML += `
          <td>${record.op_number}</td>
          <td>${this.formatDate(record.visit_date)}</td>
          <td>${record.regno}</td>
          <td>${record.name}</td>
          <td>${record.age || '-'}</td>
          <td>${record.gender === 'M' ? 'M' : 'F'}</td>
          <td>${record.mobile || '-'}</td>
          <td>${record.doctor_name || '-'}</td>
          <td>${this.truncate(record.chief_complaints, 40)}</td>
          <td>₹${record.consultation_fee || 0}</td>
        `;
      } else if (this.currentTable === 'vaccines') {
        tableHTML += `
          <td>${this.formatDate(record.administered_date)}</td>
          <td>${record.regno}</td>
          <td>${record.name}</td>
          <td>${record.age || '-'}</td>
          <td>${record.vaccines_given} (${record.vaccine_count})</td>
          <td>${record.batch_display}</td>
          <td>${this.formatDate(record.next_dose_due)}</td>
        `;
      } else if (this.currentTable === 'followup') {
        tableHTML += `
          <td>${this.formatDate(record.created_at)}</td>
          <td>${record.regno}</td>
          <td>${record.name}</td>
          <td>${record.age || '-'}</td>
          <td>${record.followup_type}</td>
          <td>${this.truncate(record.followup_reason, 30)}</td>
          <td>${this.formatDate(record.next_visit_date)}</td>
          <td>${record.status === 'completed' ? '✅' : '⏳'}</td>
          <td>${record.followup_contact_confirmed ? '✅' : '❌'}</td>
        `;
      }

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  },

  getRowClass(record, index) {
    // Color coding for vaccines and followup
    if (this.currentTable === 'vaccines') {
      const today = new Date();
      const nextDose = record.next_dose_due ? new Date(record.next_dose_due) : null;
      
      if (!nextDose) return 'row-completed';
      
      const daysUntil = Math.floor((nextDose - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil < 0) return 'row-overdue';
      if (daysUntil <= 7) return 'row-due-soon';
      return 'row-future';
    } else if (this.currentTable === 'followup') {
      if (record.status === 'completed') return 'row-completed';
      
      const today = new Date();
      const nextVisit = new Date(record.next_visit_date);
      const daysUntil = Math.floor((nextVisit - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil < 0) return 'row-overdue';
      if (daysUntil <= 7) return 'row-due-soon';
      return 'row-future';
    } else {
      // Alternating rows for patients and OP
      return index % 2 === 0 ? 'row-even' : 'row-odd';
    }
  },

  renderPagination() {
    const totalPages = Math.ceil(this.totalRecords / this.perPage);
    const container = document.getElementById('paginationContainer');
    
    let html = `<div class="pagination-info">Showing ${((this.currentPage - 1) * this.perPage) + 1}-${Math.min(this.currentPage * this.perPage, this.totalRecords)} of ${this.totalRecords}</div>`;
    html += '<div class="pagination-buttons">';
    
    // Previous button
    html += `<button class="btn-modern btn-secondary" ${this.currentPage === 1 ? 'disabled' : ''} onclick="ViewRecords.goToPage(${this.currentPage - 1})">◀ Prev</button>`;
    
    // Page numbers
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
      html += `<button class="btn-modern ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}" onclick="ViewRecords.goToPage(${i})">${i}</button>`;
    }
    
    if (totalPages > 5) {
      html += '<span>...</span>';
    }
    
    // Next button
    html += `<button class="btn-modern btn-secondary" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="ViewRecords.goToPage(${this.currentPage + 1})">Next ▶</button>`;
    
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
      modalBody.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner">Loading...</div></div>';
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('active'), 10);

      let endpoint = '';
      if (type === 'patients') {
        endpoint = `/api/reception/records/patient/${id}`;
      } else if (type === 'op-register') {
        endpoint = `/api/reception/records/op/${id}`;
      } else if (type === 'vaccines') {
        endpoint = `/api/reception/records/vaccine/${id}`;
      } else if (type === 'followup') {
        endpoint = `/api/reception/records/followup/${id}`;
      }

      const response = await API.get(endpoint);

      if (type === 'patients') {
        this.renderPatientModal(response.record, modalBody, modalTitle);
      } else if (type === 'op-register') {
        this.renderOPModal(response.record, modalBody, modalTitle);
      } else if (type === 'vaccines') {
        this.renderVaccineModal(response.records, response.patient, modalBody, modalTitle);
      } else if (type === 'followup') {
        this.renderFollowupModal(response.record, modalBody, modalTitle);
      }

    } catch (error) {
      Utils.showToast('Failed to load details', 'error');
      this.closeRecordModal();
    }
  },

  renderPatientModal(record, modalBody, modalTitle) {
    modalTitle.textContent = `👤 Patient Details - ${record.name}`;
    const age = ReceptionUtils.calculateAge(record.dob);

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h3>Basic Information</h3>
          <div class="detail-row">
            <span class="detail-label">Registration Number:</span>
            <span class="detail-value">${record.regno}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${record.name}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date of Birth:</span>
            <span class="detail-value">${this.formatDate(record.dob)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Age:</span>
            <span class="detail-value">${age}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Gender:</span>
            <span class="detail-value">${record.gender === 'M' ? 'MALE' : 'FEMALE'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Family Information</h3>
          <div class="detail-row">
            <span class="detail-label">Father's Name:</span>
            <span class="detail-value">${record.father || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Mother's Name:</span>
            <span class="detail-value">${record.mother || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Contact Information</h3>
          <div class="detail-row">
            <span class="detail-label">Mobile Number:</span>
            <span class="detail-value">${record.mobile || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Address:</span>
            <span class="detail-value">${record.address || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Registration Details</h3>
          <div class="detail-row">
            <span class="detail-label">Registered On:</span>
            <span class="detail-value">${this.formatDateTime(record.created_at)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Last Updated:</span>
            <span class="detail-value">${this.formatDateTime(record.updated_at)}</span>
          </div>
        </div>
      </div>
    `;
  },

  renderOPModal(record, modalBody, modalTitle) {
    modalTitle.textContent = `🏥 OP Visit Details - ${record.name}`;

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h3>Visit Information</h3>
          <div class="detail-row">
            <span class="detail-label">OP Number:</span>
            <span class="detail-value">${record.op_number}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Visit Date:</span>
            <span class="detail-value">${this.formatDate(record.visit_date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Visit Time:</span>
            <span class="detail-value">${record.visit_time}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Visit Type:</span>
            <span class="detail-value">${record.visit_type === 'new' ? 'NEW' : 'FOLLOW-UP'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Appointment Type:</span>
            <span class="detail-value">${record.appointment_type || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Patient Information</h3>
          <div class="detail-row">
            <span class="detail-label">RegNo:</span>
            <span class="detail-value">${record.regno}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${record.name}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Age:</span>
            <span class="detail-value">${record.age || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Gender:</span>
            <span class="detail-value">${record.gender === 'M' ? 'MALE' : 'FEMALE'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Mobile:</span>
            <span class="detail-value">${record.mobile || '-'}</span>
          </div>
        </div>

        <div class="detail-section full-width">
          <h3>Vitals</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            <div class="detail-row">
              <span class="detail-label">BP:</span>
              <span class="detail-value">${record.vitals_bp || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Temperature:</span>
              <span class="detail-value">${record.vitals_temp || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Pulse:</span>
              <span class="detail-value">${record.vitals_pulse || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">RR:</span>
              <span class="detail-value">${record.vitals_rr || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">SpO2:</span>
              <span class="detail-value">${record.vitals_spo2 || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Weight:</span>
              <span class="detail-value">${record.vitals_weight || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Height:</span>
              <span class="detail-value">${record.vitals_height || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Head Circumference:</span>
              <span class="detail-value">${record.vitals_hc || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">MUAC:</span>
              <span class="detail-value">${record.vitals_muac || '-'}</span>
            </div>
          </div>
        </div>

        <div class="detail-section full-width">
          <h3>Complaints</h3>
          <div class="detail-row">
            <span class="detail-label">Chief Complaints:</span>
            <span class="detail-value">${record.chief_complaints || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Previous Complaints:</span>
            <span class="detail-value">${record.previous_complaints || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Consultation Details</h3>
          <div class="detail-row">
            <span class="detail-label">Doctor:</span>
            <span class="detail-value">${record.doctor_name || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${record.consultation_status?.toUpperCase() || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Fee:</span>
            <span class="detail-value">₹${record.consultation_fee || 0}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Payment Status:</span>
            <span class="detail-value">${record.payment_status?.toUpperCase() || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Record Information</h3>
          <div class="detail-row">
            <span class="detail-label">Created By:</span>
            <span class="detail-value">${record.created_by_name || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Created At:</span>
            <span class="detail-value">${this.formatDateTime(record.created_at)}</span>
          </div>
        </div>
      </div>
    `;
  },

  renderVaccineModal(records, patient, modalBody, modalTitle) {
    if (!records || records.length === 0) {
      modalBody.innerHTML = '<p>No vaccine records found.</p>';
      return;
    }

    modalTitle.textContent = `💉 Vaccination Details - ${patient?.name || 'Patient'}`;

    let html = `
      <div class="detail-section" style="margin-bottom: 20px;">
        <h3>Patient Information</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
          <div class="detail-row">
            <span class="detail-label">RegNo:</span>
            <span class="detail-value">${patient?.regno || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${patient?.name || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Age:</span>
            <span class="detail-value">${patient?.age || '-'}</span>
          </div>
        </div>
      </div>

      <div class="detail-section full-width">
        <h3>Vaccines Administered (${records.length} ${records.length === 1 ? 'vaccine' : 'vaccines'})</h3>
        <div class="vaccine-table-container">
          <table class="vaccine-detail-table">
            <thead>
              <tr>
                <th>Vaccine</th>
                <th>Brand</th>
                <th>Dose</th>
                <th>Route</th>
                <th>Site</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Next Dose Due</th>
              </tr>
            </thead>
            <tbody>
    `;

    records.forEach(v => {
      html += `
        <tr>
          <td><strong>${v.vaccine_type}</strong></td>
          <td>${v.vaccine_brand || '-'}</td>
          <td>${v.dose_number}${v.dose_label ? ' (' + v.dose_label + ')' : ''}</td>
          <td>${v.route}</td>
          <td>${v.site}</td>
          <td>${v.batch_number}</td>
          <td>${this.formatDate(v.expiry_date)}</td>
          <td>${this.formatDate(v.next_dose_due_date)}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>

      <div class="detail-section full-width">
        <h3>Additional Information</h3>
        <div class="detail-row">
          <span class="detail-label">Administered Date:</span>
          <span class="detail-value">${this.formatDateTime(records[0].administered_date + ' ' + records[0].administered_time)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Administered By:</span>
          <span class="detail-value">${records[0].administered_by_name || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Adverse Reactions:</span>
          <span class="detail-value">${records[0].adverse_reaction_observed ? '⚠️ Yes - ' + (records[0].adverse_reaction_details || 'Details not provided') : '✅ None observed'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Follow-up Contact:</span>
          <span class="detail-value">${records[0].followup_contact_confirmed ? '✅ Confirmed - ' + records[0].followup_contact_number : '❌ Not confirmed'}</span>
        </div>
        ${records[0].comments ? `
        <div class="detail-row">
          <span class="detail-label">Comments:</span>
          <span class="detail-value">${records[0].comments}</span>
        </div>
        ` : ''}
      </div>
    `;

    modalBody.innerHTML = html;
  },

  renderFollowupModal(record, modalBody, modalTitle) {
    modalTitle.textContent = `📅 Follow-up Details - ${record.name}`;

    const today = new Date();
    const nextVisit = new Date(record.next_visit_date);
    const daysUntil = Math.floor((nextVisit - today) / (1000 * 60 * 60 * 24));
    let statusBadge = '';
    
    if (record.status === 'completed') {
      statusBadge = '<span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-weight: 600;">✅ COMPLETED</span>';
    } else if (daysUntil < 0) {
      statusBadge = '<span style="background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 12px; font-weight: 600;">🔴 OVERDUE</span>';
    } else if (daysUntil <= 7) {
      statusBadge = '<span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-weight: 600;">⚠️ DUE SOON</span>';
    } else {
      statusBadge = '<span style="background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 12px; font-weight: 600;">📅 SCHEDULED</span>';
    }

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h3>Patient Information</h3>
          <div class="detail-row">
            <span class="detail-label">RegNo:</span>
            <span class="detail-value">${record.regno}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${record.name}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Age:</span>
            <span class="detail-value">${record.age || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Follow-up Details</h3>
          <div class="detail-row">
            <span class="detail-label">Type:</span>
            <span class="detail-value">${record.followup_type}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Reason:</span>
            <span class="detail-value">${record.followup_reason}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Period:</span>
            <span class="detail-value">${record.followup_period || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Schedule</h3>
          <div class="detail-row">
            <span class="detail-label">Next Visit Date:</span>
            <span class="detail-value">${this.formatDate(record.next_visit_date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Days Until Visit:</span>
            <span class="detail-value">${daysUntil >= 0 ? daysUntil + ' days' : 'Overdue by ' + Math.abs(daysUntil) + ' days'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${statusBadge}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Contact Information</h3>
          <div class="detail-row">
            <span class="detail-label">Contact Confirmed:</span>
            <span class="detail-value">${record.followup_contact_confirmed ? '✅ Yes' : '❌ No'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Contact Number:</span>
            <span class="detail-value">${record.followup_contact_number || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Record Information</h3>
          <div class="detail-row">
            <span class="detail-label">Advised By:</span>
            <span class="detail-value">${record.advised_by_name || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Created At:</span>
            <span class="detail-value">${this.formatDateTime(record.created_at)}</span>
          </div>
          ${record.completion_date ? `
          <div class="detail-row">
            <span class="detail-label">Completed On:</span>
            <span class="detail-value">${this.formatDateTime(record.completion_date)}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  closeRecordModal() {
    const modal = document.getElementById('recordDetailModal');
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  },

  formatDateTime(dateTimeString) {
    if (!dateTimeString) return '-';
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  async exportCSV() {
    try {
      const params = new URLSearchParams({
        ...this.currentFilters,
        sort_by: document.getElementById('sortBySelect').value,
        sort_order: document.getElementById('sortOrderBtn').dataset.order || 'DESC',
        limit: 10000, // Export all
        offset: 0
      });

      const { records } = await API.get(`/api/reception/records/${this.currentTable}?${params}`);
      
      this.downloadCSV(records);
      Utils.showToast('CSV exported successfully', 'success');
      
    } catch (error) {
      Utils.showToast('Export failed', 'error');
    }
  },

  downloadCSV(records) {
    if (records.length === 0) {
      Utils.showToast('No records to export', 'error');
      return;
    }

    let csv = '';
    
    // CSV Headers
    if (this.currentTable === 'patients') {
      csv = 'RegNo,Name,DOB,Age,Gender,Father,Mother,Mobile,Address,Registered\n';
      records.forEach(r => {
        const age = ReceptionUtils.calculateAge(r.dob);
        csv += `${r.regno},"${r.name}",${r.dob || ''},${age},"${r.gender === 'M' ? 'MALE' : 'FEMALE'}","${r.father || ''}","${r.mother || ''}",${r.mobile || ''},"${r.address || ''}",${r.created_at}\n`;
      });
    } else if (this.currentTable === 'op-register') {
      csv = 'OP Number,Visit Date,RegNo,Name,Age,Gender,Mobile,Doctor,Chief Complaints,Fee\n';
      records.forEach(r => {
        csv += `${r.op_number},${r.visit_date},${r.regno},"${r.name}",${r.age || ''},"${r.gender}",${r.mobile || ''},"${r.doctor_name || ''}","${(r.chief_complaints || '').replace(/"/g, '""')}",${r.consultation_fee || 0}\n`;
      });
    } else if (this.currentTable === 'vaccines') {
      csv = 'Visit Date,RegNo,Name,Age,Vaccines Given,Count,Batch,Next Dose Due\n';
      records.forEach(r => {
        csv += `${r.administered_date},${r.regno},"${r.name}",${r.age || ''},"${r.vaccines_given}",${r.vaccine_count},${r.batch_display},${r.next_dose_due || ''}\n`;
      });
    } else if (this.currentTable === 'followup') {
      csv = 'Follow-up Date,RegNo,Name,Age,Type,Reason,Next Visit,Status,Contact Confirmed\n';
      records.forEach(r => {
        csv += `${r.created_at},${r.regno},"${r.name}",${r.age || ''},"${r.followup_type}","${(r.followup_reason || '').replace(/"/g, '""')}",${r.next_visit_date},${r.status},${r.followup_contact_confirmed ? 'Yes' : 'No'}\n`;
      });
    }

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentTable}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  },

  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
  },

  truncate(str, len) {
    if (!str) return '-';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }
};
