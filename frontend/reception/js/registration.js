/**
 * HMS 3.0 - Registration Modal Logic
 */

const Registration = {
  
  /**
   * Open Registration Modal
   */
  async openModal(prefillData = {}) {
    // Show modal
    const html = RegistrationTemplates.modalHTML(prefillData);
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.classList.add('modal-open');
    
    // Load next regno
    await this.loadNextRegno();
    
    // Attach event listeners
    this.attachEventListeners();
  },

  /**
   * Attach Event Listeners
   */
  attachEventListeners() {
    // Form submit
    document.getElementById('registrationModalForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Auto-uppercase fields
    ['regModalName', 'regModalFather', 'regModalMother', 'regModalAddress'].forEach(id => {
      const field = document.getElementById(id);
      field.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    });

    // DOB change - calculate age
    document.getElementById('regModalDob').addEventListener('change', (e) => {
      const age = ReceptionUtils.calculateAge(e.target.value);
      document.getElementById('regModalAgeDisplay').textContent = age ? `Age: ${age}` : '';
    });

    // Mobile validation
    const mobileInput = document.getElementById('regModalMobile');
    mobileInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      if (e.target.value.length > 10) {
        e.target.value = e.target.value.slice(0, 10);
      }
      
      const status = ReceptionUtils.getMobileStatus(e.target.value);
      const statusEl = document.getElementById('regModalMobileStatus');
      statusEl.textContent = status.text;
      statusEl.className = `mobile-status ${status.class}`;
    });
  },

  /**
   * Load Next RegNo
   */
  async loadNextRegno() {
    try {
      const { next_regno } = await API.get('/api/reception/patients/next-regno');
      document.getElementById('regModalDisplayRegno').value = next_regno;
    } catch (error) {
      document.getElementById('regModalDisplayRegno').value = '-';
    }
  },

  /**
   * Handle Form Submit
   */
  async handleSubmit() {
    const formData = {
      name: document.getElementById('regModalName').value.toUpperCase(),
      dob: document.getElementById('regModalDob').value || null,
      gender: document.getElementById('regModalGender').value,
      father: document.getElementById('regModalFather').value.toUpperCase(),
      mother: document.getElementById('regModalMother').value.toUpperCase(),
      address: document.getElementById('regModalAddress').value.toUpperCase(),
      mobile: document.getElementById('regModalMobile').value
    };

    // Validate
    if (!formData.name) {
      Utils.showToast('Name is required', 'error');
      return;
    }

    if (!formData.gender) {
      Utils.showToast('Gender is required', 'error');
      return;
    }

    if (!formData.father) {
      Utils.showToast('Father\'s name is required', 'error');
      return;
    }

    if (!formData.mother) {
      Utils.showToast('Mother\'s name is required', 'error');
      return;
    }

    if (!formData.address) {
      Utils.showToast('Address is required', 'error');
      return;
    }

    if (!formData.mobile || formData.mobile.length !== 10) {
      Utils.showToast('Valid 10-digit mobile number is required', 'error');
      return;
    }

    try {
      // Disable button
      const saveBtn = document.getElementById('regModalSaveBtn');
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const result = await API.post('/api/reception/patients', formData);
      
      // Get full patient data for success modal
      const patient = {
        id: result.patient_id,
        name: formData.name,
        dob: formData.dob,
        gender: formData.gender,
        father: formData.father,
        mother: formData.mother,
        address: formData.address,
        mobile: formData.mobile
      };

      // Show success modal
      this.showSuccess(patient, result.regno);
      
    } catch (error) {
      Utils.showToast(error.message, 'error');
      // Re-enable button
      const saveBtn = document.getElementById('regModalSaveBtn');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Registration';
    }
  },

  /**
   * Show Success Modal
   */
  showSuccess(patient, regno) {
    // Close registration modal
    this.closeModal();
    
    // Show success modal
    const html = RegistrationTemplates.successModalHTML(patient, regno);
    document.body.insertAdjacentHTML('beforeend', html);
  },

  /**
   * Create New Visit from Success Modal
   */
  async createNewVisit(patientId) {
    try {
      // Get full patient data
      const { patient } = await API.get(`/api/reception/patients/${patientId}`);
      
      // Close success modal
      this.closeSuccess();
      
      // Open OPD modal for new visit
      OPDEntry.openModal(patient, 'new');
      
    } catch (error) {
      Utils.showToast('Failed to load patient data', 'error');
    }
  },

  /**
   * Close Registration Modal
   */
  closeModal() {
    document.getElementById('registrationModal')?.remove();
    document.body.classList.remove('modal-open');
  },

  /**
   * Close Success Modal
   */
  closeSuccess() {
    document.getElementById('registrationSuccessModal')?.remove();
    document.body.classList.remove('modal-open');
    
    // Navigate to dashboard
    Navigation.switchTab('dashboard');
    
    // Clear search results (if any)
    document.getElementById('smartSearchInput').value = '';
    document.getElementById('smartSearchResults').innerHTML = '';
  }
};
