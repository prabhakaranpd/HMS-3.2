/**
 * HMS 3.0 - Import/Export (All Tables)
 */

const ImportExport = {
  init() {
    // Export button
    document.getElementById('exportAllBtn').addEventListener('click', () => {
      this.exportTable();
    });

    // Import button
    document.getElementById('importAllBtn').addEventListener('click', () => {
      this.importTable();
    });

    // Download template
    document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
      this.downloadTemplate();
    });

    // Legacy import button
    document.getElementById('importLegacyBtn').addEventListener('click', () => {
      this.importLegacyTable();
    });

    // Download legacy template
    document.getElementById('downloadLegacyTemplateBtn').addEventListener('click', () => {
      this.downloadLegacyTemplate();
    });

    // Edit mobile validation
    const editMobileInput = document.getElementById('editMobile');
    const editMobileStatus = document.getElementById('editMobileStatus');
    
    editMobileInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      if (e.target.value.length > 10) {
        e.target.value = e.target.value.slice(0, 10);
      }
      
      const status = ReceptionUtils.getMobileStatus(e.target.value);
      editMobileStatus.textContent = status.text;
      editMobileStatus.className = `mobile-status ${status.class}`;
    });

    // Modal buttons
    document.getElementById('closeEditModal').addEventListener('click', () => {
      SmartSearch.closeEditModal();
    });

    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      SmartSearch.closeEditModal();
    });

    document.getElementById('saveEditBtn').addEventListener('click', () => {
      SmartSearch.saveEdit();
    });
  },

  exportTable() {
    const table = document.getElementById('exportTableSelect').value;
    window.location.href = `/api/reception/export-table/${table}`;
    Utils.showToast('CSV export started', 'success');
  },

  downloadTemplate() {
    const table = document.getElementById('importTableSelect').value;
    
    let csv = '';
    
    if (table === 'patients') {
      csv = 'RegNo (optional - auto-assigned),Name (required),DOB (optional YYYY-MM-DD),Gender (required M/F),Father (optional),Mother (optional),Address (required),Mobile (required)\n';
      csv += ',"JOHN DOE",2020-01-15,M,FATHER NAME,MOTHER NAME,"123 MAIN STREET CITY",9876543210\n';
      csv += ',"JANE SMITH",2018-05-20,F,FATHER NAME,MOTHER NAME,"456 ELM STREET TOWN",9876543211\n';
    } else if (table === 'op-register') {
      csv = 'RegNo (required),Name (required),Age (optional),Gender (required),Mobile (optional),Visit Date (required YYYY-MM-DD),Visit Time (optional HH:MM),Chief Complaints (optional),Doctor ID (optional - default 1),Consultation Fee (optional - default 0)\n';
      csv += '1,SAMPLE PATIENT,5,M,9876543210,2025-01-04,10:00,FEVER AND COUGH,1,100\n';
      csv += '2,ANOTHER PATIENT,3,F,9876543211,2025-01-04,11:30,VACCINATION,,0\n';
    } else if (table === 'vaccines') {
      csv = 'Patient ID (required - RegNo),Vaccine Type (required),Brand (optional),Dose Number (optional - default 1),Route (optional - default IM),Site (optional - default Left Arm),Batch Number (required),Expiry Date (required YYYY-MM-DD),Administered Date (required YYYY-MM-DD),Next Dose Due (optional YYYY-MM-DD)\n';
      csv += '1,BCG,BRAND X,1,ID,Left Arm,B12345,2025-12-31,2025-01-04,\n';
      csv += '2,POLIO,BRAND Y,1,Oral,,P67890,2025-11-30,2025-01-04,2025-02-04\n';
    } else if (table === 'followup') {
      csv = 'Patient ID (required - RegNo),Follow-up Type (required),Reason (required),Next Visit Date (required YYYY-MM-DD),Status (optional - default pending),Contact Confirmed (optional Yes/No)\n';
      csv += '1,VACCINATION,DOSE 2 DUE,2025-02-04,pending,Yes\n';
      csv += '2,REVIEW,CHECK PROGRESS,2025-02-15,pending,No\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table}-import-template.csv`;
    a.click();
    
    Utils.showToast('Template downloaded', 'success');
  },

  async importTable() {
    const table = document.getElementById('importTableSelect').value;
    const fileInput = document.getElementById('importCsvFile');
    const file = fileInput.files[0];

    if (!file) {
      Utils.showToast('Please select a CSV file', 'error');
      return;
    }

    try {
      const text = await file.text();
      let records = [];

      if (table === 'patients') {
        records = this.parsePatientCSV(text);
        await this.importPatients(records);
      } else if (table === 'op-register') {
        records = this.parseOPRegisterCSV(text);
        await this.importOPRegister(records);
      } else if (table === 'vaccines') {
        records = this.parseVaccinesCSV(text);
        await this.importVaccines(records);
      } else if (table === 'followup') {
        records = this.parseFollowupCSV(text);
        await this.importFollowup(records);
      }

      fileInput.value = '';

    } catch (error) {
      Utils.showToast('Import failed: ' + error.message, 'error');
    }
  },

  parsePatientCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const patients = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      // Validate regno
      let regno = values[0]?.trim() || '';
      if (regno && !/^\d+$/.test(regno)) {
        regno = '';
      }

      // Validate DOB
      let dob = this.validateAndConvertDOB(values[2]);

      patients.push({
        regno: regno,
        name: (values[1] || '').toUpperCase().trim(),
        dob: dob,
        gender: (values[3] || '').toUpperCase().trim(),
        father: (values[4] || '').toUpperCase().trim(),
        mother: (values[5] || '').toUpperCase().trim(),
        address: (values[6] || '').toUpperCase().trim(),
        mobile: (values[7] || '').trim()
      });
    }

    return patients;
  },

  parseOPRegisterCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        regno: values[0]?.trim() || '',
        name: (values[1] || '').toUpperCase().trim(),
        age: values[2] || '',
        gender: values[3] || 'M',
        mobile: values[4] || '',
        visit_date: values[5] || new Date().toISOString().split('T')[0],
        visit_time: values[6] || '09:00',
        chief_complaints: (values[7] || '').toUpperCase(),
        doctor_id: values[8] || 1,
        consultation_fee: values[9] || 0
      });
    }

    return records;
  },

  parseVaccinesCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        patient_id: values[0]?.trim() || '',
        vaccine_type: (values[1] || '').toUpperCase().trim(),
        vaccine_brand: (values[2] || '').toUpperCase().trim(),
        dose_number: values[3] || 1,
        route: values[4] || 'IM',
        site: values[5] || 'Left Arm',
        batch_number: values[6] || '',
        expiry_date: values[7] || '',
        administered_date: values[8] || new Date().toISOString().split('T')[0],
        next_dose_due_date: values[9] || ''
      });
    }

    return records;
  },

  parseFollowupCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        patient_id: values[0]?.trim() || '',
        followup_type: (values[1] || '').toUpperCase().trim(),
        followup_reason: (values[2] || '').toUpperCase().trim(),
        next_visit_date: values[3] || '',
        status: values[4] || 'pending',
        followup_contact_confirmed: values[5]?.toLowerCase() === 'yes' ? 1 : 0
      });
    }

    return records;
  },

  async importPatients(patients) {
    const results = await API.post('/api/reception/import', { patients });
    this.showImportSummary(results, 'Patients');
  },

  async importOPRegister(records) {
    const results = await API.post('/api/reception/import-op-register', { records });
    this.showImportSummary(results, 'OP Register');
  },

  async importVaccines(records) {
    const results = await API.post('/api/reception/import-vaccines', { records });
    this.showImportSummary(results, 'Vaccines');
  },

  async importFollowup(records) {
    const results = await API.post('/api/reception/import-followup', { records });
    this.showImportSummary(results, 'Follow-up');
  },

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  },

  validateAndConvertDOB(dobString) {
    if (!dobString || !dobString.trim()) return null;

    const dob = dobString.trim();
    
    let dateObj = null;

    if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(dob)) {
      const parts = dob.split(/[-\/]/);
      dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    } else if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(dob)) {
      const parts = dob.split(/[-\/]/);
      dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  },

  showImportSummary(results, tableName) {
    const container = document.getElementById('importAllSummary');
    
    let html = `
      <div class="import-summary">
        <h3>${tableName} Import Summary</h3>
        
        <div class="import-stat">
          <strong>✅ Imported:</strong>
          <span>${results.imported} records</span>
        </div>
        
        ${results.skipped && results.skipped.length > 0 ? `
          <div class="import-stat">
            <strong>⚠️ Skipped:</strong>
            <span>${results.skipped.length} records</span>
          </div>
          <div class="import-details">
            ${results.skipped.map(s => `
              <div class="import-item">Row ${s.row || 'Unknown'}: ${s.reason}</div>
            `).join('')}
          </div>
        ` : ''}
        
        ${results.rejected && results.rejected.length > 0 ? `
          <div class="import-stat">
            <strong>❌ Rejected:</strong>
            <span>${results.rejected.length} rows</span>
          </div>
          <div class="import-details">
            ${results.rejected.map(r => `
              <div class="import-item">Row ${r.row}: ${r.reason}</div>
            `).join('')}
          </div>
        ` : ''}
        
        ${results.new_regnos && results.new_regnos.length > 0 ? `
          <div class="import-stat">
            <strong>🆕 New RegNos Assigned:</strong>
            <span>${results.new_regnos.length} patients</span>
          </div>
          <div class="import-details">
            ${results.new_regnos.slice(0, 5).map(n => `
              <div class="import-item">${n.name} → RegNo ${n.new_regno}</div>
            `).join('')}
            ${results.new_regnos.length > 5 ? `<div class="import-item">... and ${results.new_regnos.length - 5} more</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;
    Utils.showToast(`${tableName} import complete: ${results.imported} records imported`, 'success');
  },

  /* ========================================
     LEGACY IMPORT FUNCTIONS (HMS 2.0)
  ======================================== */

  downloadLegacyTemplate() {
    const table = document.getElementById('legacyTableSelect').value;
    
    let csv = '';
    
    if (table === 'op-register') {
      csv = 'Legacy OP No,RegNo,Name,Age,Gender,Father,Mother,Address,Mobile,Visit Date,Visit Time,Chief Complaints,Fee\n';
      csv += 'OP001,1,SAMPLE PATIENT,5,M,FATHER NAME,MOTHER NAME,COMPLETE ADDRESS,9876543210,2024-01-15,10:30,FEVER AND COUGH,100\n';
    } else if (table === 'vaccines') {
      csv = 'S.No,Next Vaccine Date,Entry Date,Reg. No,Name,Age/Sex,Father Name,Mother Name,Adress,Mobile No.,Visit Date,Vaccine Given,Next Vaccine,Addl.Instructions\n';
      csv += '1,2024-02-15,2024-01-10,1,SAMPLE PATIENT,5/M,FATHER NAME,MOTHER NAME,COMPLETE ADDRESS,9876543210,2024-01-15,BCG,POLIO,FOLLOW UP AFTER 1 MONTH\n';
    } else if (table === 'followup') {
      csv = 'S.No,Followup Date,Entry Date,Entry Type,Reg. No,Name,Age/Sex,Father Name,Mother Name,Adress,Mobile No.,Visit Date,Present Complaints,Followup Reason,Addl.Instructions,Status,Log\n';
      csv += '1,2024-02-15,2024-01-10,GENERAL,1,SAMPLE PATIENT,5/M,FATHER NAME,MOTHER NAME,COMPLETE ADDRESS,9876543210,2024-01-15,COUGH,REVIEW AFTER MEDICATION,BRING OLD PRESCRIPTION,Completed,\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legacy-${table}-template.csv`;
    a.click();
    
    Utils.showToast('Legacy template downloaded', 'success');
  },

  async importLegacyTable() {
    const table = document.getElementById('legacyTableSelect').value;
    const fileInput = document.getElementById('legacyCsvFile');
    const file = fileInput.files[0];

    if (!file) {
      Utils.showToast('Please select a CSV file', 'error');
      return;
    }

    try {
      const text = await file.text();
      let records = [];

      if (table === 'op-register') {
        records = this.parseLegacyOPCSV(text);
        await this.importLegacyOP(records);
      } else if (table === 'vaccines') {
        records = this.parseLegacyVaccinesCSV(text);
        await this.importLegacyVaccines(records);
      } else if (table === 'followup') {
        records = this.parseLegacyFollowupCSV(text);
        await this.importLegacyFollowup(records);
      }

      fileInput.value = '';

    } catch (error) {
      Utils.showToast('Legacy import failed: ' + error.message, 'error');
    }
  },

  parseLegacyOPCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        legacy_op_number: values[0] || '',
        regno: values[1] || '',
        name: values[2] || '',
        age: values[3] || '',
        gender: values[4] || 'M',
        father: values[5] || '',
        mother: values[6] || '',
        address: values[7] || '',
        mobile: values[8] || '',
        visit_date: values[9] || '',
        visit_time: values[10] || '09:00',
        chief_complaints: values[11] || '',
        consultation_fee: values[12] || 0
      });
    }

    return records;
  },

  parseLegacyVaccinesCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        sno: values[0] || '',
        next_vaccine_date: values[1] || '',
        entry_date: values[2] || '',
        regno: values[3] || '',
        name: values[4] || '',
        age_sex: values[5] || '',
        father: values[6] || '',
        mother: values[7] || '',
        address: values[8] || '',
        mobile: values[9] || '',
        visit_date: values[10] || '',
        vaccine_given: values[11] || '',
        next_vaccine: values[12] || '',
        additional_instructions: values[13] || ''
      });
    }

    return records;
  },

  parseLegacyFollowupCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        sno: values[0] || '',
        followup_date: values[1] || '',
        entry_date: values[2] || '',
        entry_type: values[3] || '',
        regno: values[4] || '',
        name: values[5] || '',
        age_sex: values[6] || '',
        father: values[7] || '',
        mother: values[8] || '',
        address: values[9] || '',
        mobile: values[10] || '',
        visit_date: values[11] || '',
        present_complaints: values[12] || '',
        followup_reason: values[13] || '',
        additional_instructions: values[14] || '',
        status: values[15] || '',
        log: values[16] || ''
      });
    }

    return records;
  },

  async importLegacyOP(records) {
    const results = await API.post('/api/reception/import-legacy-op', { records });
    this.showLegacyImportSummary(results, 'Legacy OP Register');
  },

  async importLegacyVaccines(records) {
    const results = await API.post('/api/reception/import-legacy-vaccines', { records });
    this.showLegacyImportSummary(results, 'Legacy Vaccines');
  },

  async importLegacyFollowup(records) {
    const results = await API.post('/api/reception/import-legacy-followup', { records });
    this.showLegacyImportSummary(results, 'Legacy Follow-up');
  },

  showLegacyImportSummary(results, tableName) {
    const container = document.getElementById('legacyImportSummary');
    
    let html = `
      <div class="import-summary" style="background: #fef3c7; border: 2px solid #fbbf24;">
        <h3 style="color: #92400e;">🕰️ ${tableName} Import Summary</h3>
        
        <div class="import-stat">
          <strong>✅ Imported to Legacy Table:</strong>
          <span>${results.imported} records</span>
        </div>
        
        ${results.rejected && results.rejected.length > 0 ? `
          <div class="import-stat">
            <strong>❌ Rejected:</strong>
            <span>${results.rejected.length} rows</span>
          </div>
          <div class="import-details">
            ${results.rejected.map(r => `
              <div class="import-item">Row ${r.row}: ${r.reason}</div>
            `).join('')}
          </div>
        ` : ''}
        
        <div style="margin-top: 16px; padding: 12px; background: white; border-radius: 8px; color: #78350f;">
          <strong>📋 Note:</strong> Legacy data is stored separately for historical reference. 
          ${tableName.includes('OP') ? 'OP numbers have been converted to HMS 3.0 format with original numbers preserved.' : 
            'Patient snapshots preserved. Not linked to OP Register.'}
        </div>
      </div>
    `;

    container.innerHTML = html;
    Utils.showToast(`${tableName} legacy import complete: ${results.imported} records imported`, 'success');
  },

  // ==========================================
  // LEGACY IMPORT METHODS
  // ==========================================

  async importLegacyTable() {
    const table = document.getElementById('legacyTableSelect').value;
    const fileInput = document.getElementById('legacyCsvFile');
    const file = fileInput.files[0];

    if (!file) {
      Utils.showToast('Please select a CSV file', 'error');
      return;
    }

    try {
      const text = await file.text();
      let records = [];

      if (table === 'op-register') {
        records = this.parseLegacyOPCSV(text);
        await this.importLegacyOP(records);
      } else if (table === 'vaccines') {
        records = this.parseLegacyVaccinesCSV(text);
        await this.importLegacyVaccines(records);
      } else if (table === 'followup') {
        records = this.parseLegacyFollowupCSV(text);
        await this.importLegacyFollowup(records);
      }

      fileInput.value = '';

    } catch (error) {
      Utils.showToast('Legacy import failed: ' + error.message, 'error');
    }
  },

  downloadLegacyTemplate() {
    const table = document.getElementById('legacyTableSelect').value;
    
    let csv = '';
    
    if (table === 'op-register') {
      csv = 'Legacy OP No,Visit Date,Visit Time,Reg.No,Name,Age/Sex,Father Name,Mother Name,Address,Mobile No,Chief Complaints,Consultation Fee\n';
      csv += 'OP001,2024-05-15,10:30,123,SAMPLE PATIENT,5/M,FATHER NAME,MOTHER NAME,ADDRESS,9876543210,FEVER,100\n';
    } else if (table === 'vaccines') {
      csv = 'S.No,Next Vaccine Date,Entry Date,Reg. No,Name,Age/Sex,Father Name,Mother Name,Adress,Mobile No.,Visit Date,Vaccine Given,Next Vaccine,Addl.Instructions\n';
      csv += '1,2024-06-15,2024-05-15,123,RAVI,5/M,FATHER,MOTHER,ADDRESS,9876543210,2024-05-15,BCG,POLIO,NONE\n';
    } else if (table === 'followup') {
      csv = 'S.No,Followup Date,Entry Date,Entry Type,Reg. No,Name,Age/Sex,Father Name,Mother Name,Adress,Mobile No.,Visit Date,Present Complaints,Followup Reason,Addl.Instructions,Status,Log\n';
      csv += '1,2024-06-15,2024-05-15,VACCINATION,123,RAVI,5/M,FATHER,MOTHER,ADDRESS,9876543210,2024-05-15,NONE,DOSE 2 DUE,NONE,Pending,NONE\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legacy-${table}-template.csv`;
    a.click();
    
    Utils.showToast('Legacy template downloaded', 'success');
  },

  parseLegacyOPCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        legacy_op_number: values[0] || '',
        visit_date: values[1] || '',
        visit_time: values[2] || '',
        regno: values[3] || '',
        name: values[4] || '',
        age_sex: values[5] || '',
        father: values[6] || '',
        mother: values[7] || '',
        address: values[8] || '',
        mobile: values[9] || '',
        chief_complaints: values[10] || '',
        consultation_fee: values[11] || 0
      });
    }

    return records;
  },

  parseLegacyVaccinesCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        s_no: values[0] || null,
        next_vaccine_date: values[1] || null,
        entry_date: values[2] || null,
        regno: values[3] || '',
        name: values[4] || '',
        age_sex: values[5] || '',
        father_name: values[6] || '',
        mother_name: values[7] || '',
        address: values[8] || '',
        mobile_no: values[9] || '',
        visit_date: values[10] || '',
        vaccine_given: values[11] || '',
        next_vaccine: values[12] || '',
        additional_instructions: values[13] || ''
      });
    }

    return records;
  },

  parseLegacyFollowupCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      records.push({
        s_no: values[0] || null,
        followup_date: values[1] || null,
        entry_date: values[2] || null,
        entry_type: values[3] || '',
        regno: values[4] || '',
        name: values[5] || '',
        age_sex: values[6] || '',
        father_name: values[7] || '',
        mother_name: values[8] || '',
        address: values[9] || '',
        mobile_no: values[10] || '',
        visit_date: values[11] || '',
        present_complaints: values[12] || '',
        followup_reason: values[13] || '',
        additional_instructions: values[14] || '',
        status: values[15] || '',
        log: values[16] || ''
      });
    }

    return records;
  },

  async importLegacyOP(records) {
    const results = await API.post('/api/reception/import-legacy-op', { records });
    this.showLegacyImportSummary(results, 'Legacy OP Register');
  },

  async importLegacyVaccines(records) {
    const results = await API.post('/api/reception/import-legacy-vaccines', { records });
    this.showLegacyImportSummary(results, 'Legacy Vaccine Register');
  },

  async importLegacyFollowup(records) {
    const results = await API.post('/api/reception/import-legacy-followup', { records });
    this.showLegacyImportSummary(results, 'Legacy Follow-up Register');
  },

  showLegacyImportSummary(results, tableName) {
    const container = document.getElementById('legacyImportSummary');
    
    let html = `
      <div class="import-summary" style="margin-top: 20px;">
        <h3>${tableName} - Import Complete</h3>
        
        <div class="import-stat">
          <strong>✅ Imported:</strong>
          <span>${results.imported} records</span>
        </div>
        
        ${results.skipped && results.skipped.length > 0 ? `
          <div class="import-stat">
            <strong>⚠️ Skipped:</strong>
            <span>${results.skipped.length} records</span>
          </div>
        ` : ''}
        
        ${results.rejected && results.rejected.length > 0 ? `
          <div class="import-stat">
            <strong>❌ Rejected:</strong>
            <span>${results.rejected.length} rows</span>
          </div>
          <div class="import-details">
            ${results.rejected.slice(0, 10).map(r => `
              <div class="import-item">Row ${r.row}: ${r.reason}</div>
            `).join('')}
            ${results.rejected.length > 10 ? `<div class="import-item">... and ${results.rejected.length - 10} more</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;
    Utils.showToast(`${tableName}: ${results.imported} records imported`, 'success');
  }
};
