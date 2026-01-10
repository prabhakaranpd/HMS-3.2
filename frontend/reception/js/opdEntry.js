/**
 * HMS 3.0 - OPD Entry Module (Polished Version)
 */

const OPDEntry = {
  selectedPatient: null,
  doctors: [],
  complaints: [],
  selectedDoctor: null,
  selectedComplaints: [],
  reviewEligibility: null,

  init() {
    // Load data
    this.loadDoctors();
    this.loadComplaints();
    this.loadTodayStats();

    // Patient search
    const searchInput = document.getElementById('opdPatientSearch');
    const debouncedSearch = ReceptionUtils.debounce((query) => {
      this.searchPatient(query);
    }, 300);

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        debouncedSearch(query);
      } else {
        this.clearPatientSearch();
      }
    });

    // Doctor selection
    document.getElementById('opdDoctor').addEventListener('change', (e) => {
      this.onDoctorChange(e.target.value);
    });

    // Visit type buttons
    document.querySelectorAll('.visit-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectVisitType(e.target.dataset.type);
      });
    });

    // Fee override
    document.getElementById('opdOverrideFee').addEventListener('input', (e) => {
      this.updateFinalAmount();
    });

    // Amount paid
    document.getElementById('opdPaidAmount').addEventListener('input', (e) => {
      this.calculateBalance();
    });

    // Form submit
    document.getElementById('opdEntryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitOPDEntry();
    });

    // Clear button
    document.getElementById('clearOPDBtn').addEventListener('click', () => {
      this.clearForm();
    });

    // Print button (placeholder)
    document.getElementById('printOPSlipBtn').addEventListener('click', () => {
      Utils.showToast('Print OP Slip - Coming Soon', 'info');
    });
  },

  async loadDoctors() {
    try {
      const { doctors } = await API.get('/api/reception/doctors-list');
      this.doctors = doctors;
      
      const select = document.getElementById('opdDoctor');
      select.innerHTML = '<option value="">Select Doctor</option>';
      
      doctors.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = doc.full_name;
        select.appendChild(option);
      });

      // Select first doctor by default
      if (doctors.length > 0) {
        select.value = doctors[0].id;
        this.onDoctorChange(doctors[0].id);
      }
    } catch (error) {
      console.error('Failed to load doctors:', error);
      Utils.showToast('Failed to load doctors', 'error');
    }
  },

  async loadComplaints() {
    try {
      const { complaints } = await API.get('/api/reception/complaints');
      this.complaints = complaints;
      this.renderComplaintsDropdown();
    } catch (error) {
      console.error('Failed to load complaints:', error);
      Utils.showToast('Failed to load complaints', 'error');
    }
  },

  renderComplaintsDropdown() {
    const container = document.getElementById('complaintsCheckboxList');
    container.innerHTML = '';

    this.complaints.forEach(complaint => {
      const item = document.createElement('div');
      item.className = 'complaint-checkbox-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `complaint_${complaint.id}`;
      checkbox.value = complaint.id;
      checkbox.checked = this.selectedComplaints.includes(complaint.id);
      
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedComplaints.push(complaint.id);
        } else {
          this.selectedComplaints = this.selectedComplaints.filter(id => id !== complaint.id);
        }
        this.updateComplaintsDisplay();
      });

      const label = document.createElement('label');
      label.htmlFor = `complaint_${complaint.id}`;
      label.textContent = complaint.complaint_text;

      item.appendChild(checkbox);
      item.appendChild(label);
      container.appendChild(item);
    });
  },

  updateComplaintsDisplay() {
    const selectedTexts = this.selectedComplaints
      .map(id => this.complaints.find(c => c.id === id)?.complaint_text)
      .filter(Boolean);
    
    const display = document.getElementById('selectedComplaintsDisplay');
    if (selectedTexts.length > 0) {
      display.textContent = selectedTexts.join(', ');
    } else {
      display.textContent = 'Select complaints...';
    }
  },

  toggleComplaintsDropdown() {
    const dropdown = document.getElementById('complaintsDropdownContent');
    dropdown.classList.toggle('show');
  },

  async addNewComplaint() {
    const input = document.getElementById('newComplaintInput');
    const text = input.value.trim();

    if (!text) {
      Utils.showToast('Please enter complaint text', 'error');
      return;
    }

    try {
      const { complaint } = await API.post('/api/reception/complaints', {
        complaint_text: text
      });

      this.complaints.push(complaint);
      this.selectedComplaints.push(complaint.id);
      
      this.renderComplaintsDropdown();
      this.updateComplaintsDisplay();
      
      input.value = '';
      Utils.showToast('Complaint added successfully', 'success');
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },

  async onDoctorChange(doctorId) {
    if (!doctorId) {
      this.selectedDoctor = null;
      this.clearFeeCalculation();
      return;
    }

    try {
      // Show loading
      document.getElementById('feeBreakdownCard').style.opacity = '0.5';

      const { doctor } = await API.get(`/api/reception/doctors/${doctorId}/settings`);
      this.selectedDoctor = doctor;

      // Check review eligibility if patient selected
      if (this.selectedPatient) {
        await this.checkReviewEligibility();
      }

      // Calculate fee based on current visit type
      this.calculateFee();

      document.getElementById('feeBreakdownCard').style.opacity = '1';
    } catch (error) {
      console.error('Failed to load doctor settings:', error);
      Utils.showToast('Failed to load doctor settings', 'error');
      document.getElementById('feeBreakdownCard').style.opacity = '1';
    }
  },

  async checkReviewEligibility() {
    if (!this.selectedPatient || !this.selectedDoctor) {
      return;
    }

    try {
      const data = await API.get(
        `/api/reception/patients/${this.selectedPatient.id}/review-eligibility/${this.selectedDoctor.id}`
      );
      
      this.reviewEligibility = data;

      // Enable/disable review button
      const reviewBtn = document.querySelector('[data-type="review"]');
      const badge = document.getElementById('reviewBadge');

      if (data.eligible) {
        reviewBtn.disabled = false;
        reviewBtn.title = '';
        badge.style.display = 'block';
        badge.textContent = `Free Review Available (${data.reviews_used}/${data.reviews_allowed} used, ${data.days_remaining} days left)`;
      } else {
        reviewBtn.disabled = true;
        reviewBtn.title = data.reason || 'Review not available';
        badge.style.display = 'none';
      }
    } catch (error) {
      console.error('Failed to check review eligibility:', error);
      // Disable review button on error
      document.querySelector('[data-type="review"]').disabled = true;
    }
  },

  selectVisitType(type) {
    // Update active button
    document.querySelectorAll('.visit-type-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');

    // Calculate fee
    this.calculateFee();
  },

  calculateFee() {
    if (!this.selectedDoctor) {
      return;
    }

    const visitType = document.querySelector('.visit-type-btn.active')?.dataset.type || 'new';
    
    let consultationFee = 0;
    let surcharge = 0;

    if (visitType === 'new') {
      consultationFee = this.selectedDoctor.consultation_fee;
    } else if (visitType === 'review') {
      consultationFee = 0; // Free review
    } else if (visitType === 'emergency') {
      consultationFee = this.selectedDoctor.consultation_fee;
      surcharge = this.selectedDoctor.emergency_surcharge;
    }

    const total = consultationFee + surcharge;

    // Update display
    document.getElementById('feeConsultation').textContent = `₹${consultationFee.toFixed(2)}`;
    document.getElementById('feeSurcharge').textContent = `₹${surcharge.toFixed(2)}`;
    document.getElementById('feeTotal').textContent = `₹${total.toFixed(2)}`;
    document.getElementById('opdAmountToPay').textContent = `₹${total.toFixed(2)}`;

    // Store values
    document.getElementById('opdConsultationFeeHidden').value = total;

    // Update final amount
    this.updateFinalAmount();
  },

  updateFinalAmount() {
    const override = document.getElementById('opdOverrideFee').value;
    const calculatedFee = parseFloat(document.getElementById('opdConsultationFeeHidden').value || 0);
    
    const finalAmount = override ? parseFloat(override) : calculatedFee;
    
    document.getElementById('opdFinalAmount').textContent = `₹${finalAmount.toFixed(2)}`;
    document.getElementById('opdAmountToPay').textContent = `₹${finalAmount.toFixed(2)}`;

    this.calculateBalance();
  },

  calculateBalance() {
    const finalAmountText = document.getElementById('opdFinalAmount').textContent;
    const finalAmount = parseFloat(finalAmountText.replace('₹', ''));
    const paidAmount = parseFloat(document.getElementById('opdPaidAmount').value || 0);
    
    const balance = finalAmount - paidAmount;
    
    document.getElementById('opdBalance').textContent = `₹${balance.toFixed(2)}`;
  },

  clearFeeCalculation() {
    document.getElementById('feeConsultation').textContent = '₹0.00';
    document.getElementById('feeSurcharge').textContent = '₹0.00';
    document.getElementById('feeTotal').textContent = '₹0.00';
    document.getElementById('opdFinalAmount').textContent = '₹0.00';
    document.getElementById('opdAmountToPay').textContent = '₹0.00';
    document.getElementById('opdBalance').textContent = '₹0.00';
  },

  async searchPatient(query) {
    try {
      const data = await API.get(`/api/reception/patients/smart-search?q=${encodeURIComponent(query)}&limit=5`);
      this.renderPatientResults(data.patients);
    } catch (error) {
      Utils.showToast('Search failed', 'error');
    }
  },

  renderPatientResults(patients) {
    const container = document.getElementById('opdPatientResults');
    
    if (patients.length === 0) {
      container.innerHTML = '<div class="opd-search-empty">No patients found</div>';
      return;
    }

    container.innerHTML = '';
    patients.forEach(patient => {
      const age = ReceptionUtils.calculateAge(patient.dob);
      
      const card = document.createElement('div');
      card.className = 'opd-patient-result';
      card.innerHTML = `
        <div class="opd-patient-info">
          <div class="opd-patient-name">${patient.name}</div>
          <div class="opd-patient-meta">
            RegNo: ${patient.regno} | ${age} | ${patient.gender === 'M' ? 'Male' : 'Female'}
          </div>
        </div>
        <button type="button" class="btn-select-patient" onclick="OPDEntry.selectPatient(${patient.id})">
          Select
        </button>
      `;
      
      container.appendChild(card);
    });
  },

  async selectPatient(patientId) {
    try {
      const { patient } = await API.get(`/api/reception/patients/${patientId}`);
      this.selectedPatient = patient;
      
      // Fill patient details
      document.getElementById('opdSelectedRegno').textContent = patient.regno;
      document.getElementById('opdSelectedName').textContent = patient.name;
      document.getElementById('opdSelectedAge').textContent = ReceptionUtils.calculateAge(patient.dob);
      document.getElementById('opdSelectedGender').textContent = patient.gender === 'M' ? 'Male' : 'Female';
      document.getElementById('opdSelectedFather').textContent = patient.father || '-';
      document.getElementById('opdSelectedMother').textContent = patient.mother || '-';
      document.getElementById('opdSelectedMobile').textContent = patient.mobile || '-';
      document.getElementById('opdSelectedAddress').textContent = patient.address || '-';
      
      // Show selected patient section
      document.getElementById('opdSelectedPatient').style.display = 'block';
      
      // Clear search
      document.getElementById('opdPatientSearch').value = '';
      document.getElementById('opdPatientResults').innerHTML = '';
      
      // Check review eligibility if doctor is selected
      if (this.selectedDoctor) {
        await this.checkReviewEligibility();
      }
      
      // Load previous visits
      this.loadPreviousVisits(patient.id);
      
      Utils.showToast('Patient selected', 'success');
    } catch (error) {
      Utils.showToast('Failed to load patient details', 'error');
    }
  },

  clearPatientSelection() {
    this.selectedPatient = null;
    this.reviewEligibility = null;
    document.getElementById('opdSelectedPatient').style.display = 'none';
    document.getElementById('opdPreviousVisits').style.display = 'none';
    
    // Disable review button
    const reviewBtn = document.querySelector('[data-type="review"]');
    reviewBtn.disabled = true;
    reviewBtn.title = 'Select patient first';
    document.getElementById('reviewBadge').style.display = 'none';
  },

  clearPatientSearch() {
    document.getElementById('opdPatientResults').innerHTML = '';
  },

  async loadPreviousVisits(patientId) {
    try {
      const { visits } = await API.get(`/api/reception/opd/patient-history/${patientId}?limit=5`);
      
      if (visits.length === 0) {
        document.getElementById('opdPreviousVisits').style.display = 'none';
        return;
      }

      const container = document.getElementById('opdVisitsList');
      container.innerHTML = '';
      
      visits.forEach(visit => {
        const visitCard = document.createElement('div');
        visitCard.className = 'opd-previous-visit';
        visitCard.innerHTML = `
          <div class="visit-date">${Utils.formatDate(visit.visit_date)}</div>
          <div class="visit-info">
            <strong>OP#:</strong> ${visit.op_number} | 
            <strong>Type:</strong> ${visit.visit_type.toUpperCase()} |
            <strong>Doctor:</strong> ${visit.doctor_name || '-'}
          </div>
          <div class="visit-complaints">${visit.chief_complaints || 'No complaints recorded'}</div>
        `;
        container.appendChild(visitCard);
      });
      
      document.getElementById('opdPreviousVisits').style.display = 'block';
    } catch (error) {
      console.error('Failed to load previous visits:', error);
    }
  },

  async submitOPDEntry() {
    // Validation
    if (!this.selectedPatient) {
      Utils.showToast('Please select a patient first', 'error');
      return;
    }

    const doctorId = document.getElementById('opdDoctor').value;
    if (!doctorId) {
      Utils.showToast('Please select a doctor', 'error');
      return;
    }

    const visitType = document.querySelector('.visit-type-btn.active')?.dataset.type;
    if (!visitType) {
      Utils.showToast('Please select visit type', 'error');
      return;
    }

    if (this.selectedComplaints.length === 0) {
      Utils.showToast('Please select at least one complaint', 'error');
      return;
    }

    const paidAmount = parseFloat(document.getElementById('opdPaidAmount').value || 0);
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    
    if (paidAmount > 0 && !paymentMethod) {
      Utils.showToast('Please select payment method', 'error');
      return;
    }

    // Get complaints text
    const complaintsText = this.selectedComplaints
      .map(id => this.complaints.find(c => c.id === id)?.complaint_text)
      .filter(Boolean)
      .join(', ');

    const finalAmountText = document.getElementById('opdFinalAmount').textContent;
    const finalAmount = parseFloat(finalAmountText.replace('₹', ''));

    const formData = {
      patient_id: this.selectedPatient.id,
      visit_type: visitType,
      doctor_id: parseInt(doctorId),
      
      // Vitals
      vitals_bp: document.getElementById('opdBP').value || null,
      vitals_temp: document.getElementById('opdTemp').value || null,
      vitals_pulse: document.getElementById('opdPulse').value || null,
      vitals_rr: document.getElementById('opdRR').value || null,
      vitals_spo2: document.getElementById('opdSPO2').value || null,
      vitals_weight: document.getElementById('opdWeight').value || null,
      vitals_height: document.getElementById('opdHeight').value || null,
      vitals_hc: document.getElementById('opdHC').value || null,
      vitals_muac: document.getElementById('opdMUAC').value || null,
      
      // Complaints
      chief_complaints: complaintsText,
      previous_complaints: document.getElementById('opdPreviousComplaints').value || null,
      
      // Payment
      consultation_fee: finalAmount,
      override_fee: document.getElementById('opdOverrideFee').value || null,
      payment_method: paymentMethod || null,
      paid_amount: paidAmount
    };

    try {
      // Disable save button
      const saveBtn = document.querySelector('#opdEntryForm button[type="submit"]');
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Creating OP Entry...';

      const result = await API.post('/api/reception/opd/entry', formData);
      
      Utils.showToast(`✅ OPD Entry created! OP#: ${result.op_number}`, 'success');
      
      // Update stats
      await this.loadTodayStats();
      
      // Clear form
      this.clearForm();
      
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
      
    } catch (error) {
      Utils.showToast(error.message, 'error');
      const saveBtn = document.querySelector('#opdEntryForm button[type="submit"]');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Entry';
    }
  },

  clearForm() {
    document.getElementById('opdEntryForm').reset();
    this.clearPatientSelection();
    this.selectedComplaints = [];
    this.updateComplaintsDisplay();
    
    // Reset visit type to 'new'
    document.querySelectorAll('.visit-type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-type="new"]').classList.add('active');
    
    // Reselect first doctor
    if (this.doctors.length > 0) {
      document.getElementById('opdDoctor').value = this.doctors[0].id;
      this.onDoctorChange(this.doctors[0].id);
    }
    
    // Reset fee display
    this.clearFeeCalculation();
  },

  async loadTodayStats() {
    try {
      const { stats } = await API.get('/api/reception/opd/today-stats');
      
      document.getElementById('opdTodayTotal').textContent = stats.total || 0;
      document.getElementById('opdTodayNew').textContent = stats.new || 0;
      document.getElementById('opdTodayReview').textContent = stats.review || 0;
      document.getElementById('opdTodayEmergency').textContent = stats.emergency || 0;
      document.getElementById('opdTodayWaiting').textContent = stats.waiting || 0;
      
    } catch (error) {
      console.error('Failed to load today stats:', error);
    }
  }
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.complaints-dropdown-container')) {
    const dropdown = document.getElementById('complaintsDropdownContent');
    if (dropdown) dropdown.classList.remove('show');
  }
});
