/**
 * HMS 3.0 - OPD Entry Modal Logic
 * FIXED: Balance calculation and amount parsing bugs
 */

const OPDEntryModal = {
  selectedPatient: null,
  selectedDoctor: null,
  selectedComplaints: [],
  complaints: [],
  visitType: null,
  reviewData: null,

  /**
   * Open OPD Modal
   */
  async openModal(patient, visitType, doctorId = null, reviewData = null) {
    this.selectedPatient = patient;
    this.visitType = visitType;
    this.reviewData = reviewData;
    this.selectedComplaints = [];

    // Show modal
    const html = OPDTemplates.modalHTML(patient, visitType, doctorId, reviewData);
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.classList.add('modal-open');

    // Load data
    await this.loadModalData(doctorId);
  },

  /**
   * Load Modal Data
   */
  async loadModalData(preSelectedDoctorId) {
    try {
      // Load doctors and complaints in parallel
      await Promise.all([
        this.loadDoctors(preSelectedDoctorId),
        this.loadComplaints()
      ]);

      // Hide loading, show content
      this.hideLoading();

      // Attach event listeners
      this.attachEventListeners();

      // If review visit, load previous complaints
      if (this.visitType === 'review' && this.reviewData && this.reviewData.last_new_visit) {
        const prevComplaints = this.reviewData.last_new_visit.complaints || '';
        document.getElementById('opdPreviousComplaints').value = prevComplaints;
      }

    } catch (error) {
      console.error('Failed to load modal data:', error);
      Utils.showToast('Failed to load data. Please try again.', 'error');
      this.closeModal();
    }
  },

  /**
   * Hide Loading State
   */
  hideLoading() {
    document.getElementById('opdModalLoading').style.display = 'none';
    document.getElementById('opdModalContent').style.display = 'block';
  },

  /**
   * Load Doctors
   */
  async loadDoctors(preSelectedDoctorId) {
    const { doctors } = await API.get('/api/reception/doctors-list');
    
    const select = document.getElementById('opdModalDoctor');
    select.innerHTML = '<option value="">Select Doctor</option>';
    
    doctors.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.full_name;
      select.appendChild(option);
    });

    // Pre-select doctor
    if (preSelectedDoctorId) {
      select.value = preSelectedDoctorId;
    } else if (doctors.length > 0) {
      select.value = doctors[0].id;
    }

    // Trigger doctor change to load settings
    if (select.value) {
      await this.onDoctorChange(select.value);
    }
  },

  /**
   * Load Complaints
   */
  async loadComplaints() {
    const { complaints } = await API.get('/api/reception/complaints');
    this.complaints = complaints;
    this.renderComplaintsList();
  },

  /**
   * Render Complaints List
   */
  renderComplaintsList() {
    const container = document.getElementById('opdComplaintsList');
    container.innerHTML = '';

    this.complaints.forEach(complaint => {
      const item = document.createElement('div');
      item.className = 'complaint-checkbox-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `opdComplaint_${complaint.id}`;
      checkbox.value = complaint.id;
      checkbox.dataset.text = complaint.complaint_text;
      
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedComplaints.push({
            id: complaint.id,
            text: complaint.complaint_text
          });
        } else {
          this.selectedComplaints = this.selectedComplaints.filter(c => c.id !== complaint.id);
        }
        this.updateComplaintsDisplay();
      });

      const label = document.createElement('label');
      label.htmlFor = `opdComplaint_${complaint.id}`;
      label.textContent = complaint.complaint_text;

      item.appendChild(checkbox);
      item.appendChild(label);
      container.appendChild(item);
    });
  },

  /**
   * Update Complaints Display
   */
  updateComplaintsDisplay() {
    const display = document.getElementById('opdSelectedComplaints');
    
    if (this.selectedComplaints.length === 0) {
      display.textContent = 'Select complaints...';
      display.classList.add('placeholder');
    } else {
      const texts = this.selectedComplaints.map(c => c.text).join(', ');
      display.textContent = texts;
      display.classList.remove('placeholder');
    }
  },

  /**
   * Toggle Complaints Dropdown
   */
  toggleComplaintsDropdown() {
    const dropdown = document.getElementById('opdComplaintsDropdown');
    const trigger = document.getElementById('opdComplaintsTrigger');
    
    dropdown.classList.toggle('show');
    trigger.classList.toggle('open');
  },

  /**
   * Add New Complaint
   */
  async addNewComplaint() {
    const input = document.getElementById('opdNewComplaintInput');
    const text = input.value.trim().toUpperCase();

    if (!text) {
      Utils.showToast('Please enter complaint text', 'error');
      return;
    }

    try {
      const { complaint } = await API.post('/api/reception/complaints', {
        complaint_text: text
      });

      // Add to list
      this.complaints.push(complaint);
      
      // Auto-select the new complaint
      this.selectedComplaints.push({
        id: complaint.id,
        text: complaint.complaint_text
      });

      // Re-render
      this.renderComplaintsList();
      
      // Check the new complaint
      document.getElementById(`opdComplaint_${complaint.id}`).checked = true;
      
      // Update display
      this.updateComplaintsDisplay();

      // Clear input
      input.value = '';

      Utils.showToast('Complaint added successfully', 'success');

    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },

  /**
   * Attach Event Listeners
   */
  attachEventListeners() {
    // Doctor change
    document.getElementById('opdModalDoctor').addEventListener('change', (e) => {
      this.onDoctorChange(e.target.value);
    });

    // Override fee
    document.getElementById('opdOverrideFee').addEventListener('input', () => {
      this.updateFinalAmount();
    });

    // Amount paid
    document.getElementById('opdPaidAmount').addEventListener('input', () => {
      this.calculateBalance();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.complaints-dropdown-container')) {
        const dropdown = document.getElementById('opdComplaintsDropdown');
        const trigger = document.getElementById('opdComplaintsTrigger');
        if (dropdown) dropdown.classList.remove('show');
        if (trigger) trigger.classList.remove('open');
      }
    });
  },

  /**
   * On Doctor Change
   */
  async onDoctorChange(doctorId) {
    if (!doctorId) {
      this.selectedDoctor = null;
      document.getElementById('opdFeeBreakdown').style.display = 'none';
      return;
    }

    try {
      const { doctor } = await API.get(`/api/reception/doctors/${doctorId}/settings`);
      this.selectedDoctor = doctor;

      // Show fee breakdown
      document.getElementById('opdFeeBreakdown').style.display = 'block';

      // Calculate fee
      this.calculateFee();

    } catch (error) {
      console.error('Failed to load doctor settings:', error);
      Utils.showToast('Failed to load doctor settings', 'error');
    }
  },

  /**
   * Calculate Fee
   */
  calculateFee() {
    if (!this.selectedDoctor) return;

    let consultationFee = 0;
    let surcharge = 0;

    if (this.visitType === 'new') {
      consultationFee = this.selectedDoctor.consultation_fee;
    } else if (this.visitType === 'review') {
      consultationFee = 0; // Free
    } else if (this.visitType === 'emergency') {
      consultationFee = this.selectedDoctor.consultation_fee;
      surcharge = this.selectedDoctor.emergency_surcharge;
    }

    const total = consultationFee + surcharge;

    // Update display
    document.getElementById('opdFeeConsultation').textContent = `₹${consultationFee.toFixed(2)}`;
    document.getElementById('opdFeeSurcharge').textContent = `₹${surcharge.toFixed(2)}`;
    document.getElementById('opdFeeTotal').textContent = `₹${total.toFixed(2)}`;

    // Store calculated fee
    document.getElementById('opdCalculatedFee').value = total;

    // Update final amount
    this.updateFinalAmount();
  },

  /**
   * Update Final Amount
   * FIXED: Properly calculate and update all amounts and balance
   */
  updateFinalAmount() {
    const overrideInput = document.getElementById('opdOverrideFee');
    const override = overrideInput.value.trim();
    const calculated = parseFloat(document.getElementById('opdCalculatedFee').value || 0);

    // Use override if provided, otherwise use calculated
    const finalAmount = override ? parseFloat(override) : calculated;

    // Update final amount display
    document.getElementById('opdFinalAmount').textContent = `₹${finalAmount.toFixed(2)}`;
    document.getElementById('opdAmountToPay').textContent = `₹${finalAmount.toFixed(2)}`;

    // Auto-set paid amount to final amount if it's currently 0 or empty
    const paidInput = document.getElementById('opdPaidAmount');
    const currentPaid = parseFloat(paidInput.value || 0);
    
    if (currentPaid === 0) {
      paidInput.value = finalAmount.toFixed(2);
    }

    // Recalculate balance
    this.calculateBalance();
  },

  /**
   * Calculate Balance
   * FIXED: Properly parse amounts from display elements and input fields
   */
  calculateBalance() {
    // Get final amount (strip ₹ symbol and parse)
    const finalAmountText = document.getElementById('opdFinalAmount').textContent;
    const finalAmount = parseFloat(finalAmountText.replace('₹', '').trim()) || 0;
    
    // Get paid amount from input
    const paidAmount = parseFloat(document.getElementById('opdPaidAmount').value || 0);

    // Calculate balance
    const balance = finalAmount - paidAmount;

    // Update balance display
    document.getElementById('opdBalance').textContent = `₹${balance.toFixed(2)}`;
  },

  /**
   * Toggle Collapsible Section
   */
  toggleSection(header) {
    header.classList.toggle('active');
    const content = header.nextElementSibling;
    content.classList.toggle('active');
  },

  /**
   * Save Entry
   */
  async saveEntry() {
    // Validation
    const doctorId = document.getElementById('opdModalDoctor').value;
    if (!doctorId) {
      Utils.showToast('Please select a doctor', 'error');
      return;
    }

    if (this.selectedComplaints.length === 0) {
      Utils.showToast('Please select at least one complaint', 'error');
      return;
    }

    // Get final amount (strip ₹ symbol)
    const finalAmountText = document.getElementById('opdFinalAmount').textContent;
    const finalAmount = parseFloat(finalAmountText.replace('₹', '').trim()) || 0;
    
    const paidAmount = parseFloat(document.getElementById('opdPaidAmount').value || 0);

    const paymentMethod = document.querySelector('input[name="opdPaymentMethod"]:checked')?.value;
    
    if (paidAmount > 0 && !paymentMethod) {
      Utils.showToast('Please select payment method', 'error');
      return;
    }

    // Prepare data
    const complaintsText = this.selectedComplaints.map(c => c.text).join(', ');
    const overrideFee = document.getElementById('opdOverrideFee').value;

    const formData = {
      patient_id: this.selectedPatient.id,
      visit_type: this.visitType,
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
      previous_complaints: this.visitType === 'review' ? 
        document.getElementById('opdPreviousComplaints').value : null,
      
      // Payment
      consultation_fee: finalAmount,
      override_fee: overrideFee || null,
      payment_method: paymentMethod || null,
      paid_amount: paidAmount
    };

    try {
      // Disable save button
      const saveBtn = document.getElementById('opdSaveBtn');
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Creating OP Entry...';

      const result = await API.post('/api/reception/opd/entry', formData);

      // Prepare success data
      const opdData = {
        op_number: result.op_number,
        patient_name: this.selectedPatient.name,
        regno: this.selectedPatient.regno,
        doctor_name: this.selectedDoctor.full_name,
        visit_type: this.visitType,
        complaints: complaintsText,
        payment_method: paymentMethod || '-',
        amount_paid: paidAmount,
        balance: finalAmount - paidAmount
      };

      // Show success modal
      this.showSuccess(opdData);

    } catch (error) {
      Utils.showToast(error.message, 'error');
      // Re-enable button
      const saveBtn = document.getElementById('opdSaveBtn');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Entry';
    }
  },

  /**
   * Show Success Modal
   */
  showSuccess(opdData) {
    // Close OPD modal
    this.closeModal();

    // Show success modal
    const html = OPDTemplates.successModalHTML(opdData);
    document.body.insertAdjacentHTML('beforeend', html);
  },

  /**
   * Close Success Modal
   */
  closeSuccess() {
    document.getElementById('opdSuccessModal')?.remove();
    document.body.classList.remove('modal-open');

    // Navigate to dashboard
    Navigation.switchTab('dashboard');

    // Clear search results
    document.getElementById('smartSearchInput').value = '';
    document.getElementById('smartSearchResults').innerHTML = '';

    // Show success message
    Utils.showToast('OPD entry saved successfully', 'success');
  },

  /**
   * Show Previous Visits Modal
   */
  async showPreviousVisits() {
    try {
      const { visits } = await API.get(`/api/reception/opd/patient-history/${this.selectedPatient.id}?limit=10`);
      
      const html = OPDTemplates.previousVisitsModalHTML(visits, this.selectedPatient.name);
      document.body.insertAdjacentHTML('beforeend', html);

    } catch (error) {
      Utils.showToast('Failed to load previous visits', 'error');
    }
  },

  /**
   * Close Previous Visits Modal
   */
  closePreviousVisits() {
    document.getElementById('previousVisitsModal')?.remove();
  },

  /**
   * Print OP Slip (Placeholder)
   */
  printOPSlip() {
    Utils.showToast('Print feature coming soon', 'info');
  },

  /**
   * Close Modal
   */
  closeModal() {
    document.getElementById('opdEntryModal')?.remove();
    document.body.classList.remove('modal-open');
    
    // Reset state
    this.selectedPatient = null;
    this.selectedDoctor = null;
    this.selectedComplaints = [];
    this.visitType = null;
    this.reviewData = null;
  }
};
