/**
 * HMS 3.0 - Smart Search (UPDATED with Modal Integration)
 * 
 * CHANGES FROM ORIGINAL:
 * 1. Added review eligibility check
 * 2. Added 4-button layout to patient cards
 * 3. Added doctor validation before opening OPD modal
 * 4. Integrated with Registration and OPD modals
 * 5. RESTORED: Direct edit functionality (viewPatient & saveEdit methods)
 * 6. FIXED: Changed OPDEntry to OPDEntryModal
 */

const SmartSearch = {
  searchTimeout: null,
  
  init() {
    const searchInput = document.getElementById('smartSearchInput');
    
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      const query = e.target.value.trim();
      
      if (query.length >= 2) {
        this.searchTimeout = setTimeout(() => {
          this.performSearch(query);
        }, 300);
      } else {
        this.clearResults();
      }
    });
  },

  async performSearch(query) {
    try {
      const data = await API.get(`/api/reception/patients/smart-search?q=${encodeURIComponent(query)}&limit=10`);
      
      if (data.patients.length === 0) {
        this.showNoResults(query);
      } else {
        await this.renderResults(data.patients);
      }
    } catch (error) {
      Utils.showToast('Search failed', 'error');
    }
  },

  async renderResults(patients) {
    const container = document.getElementById('smartSearchResults');
    container.innerHTML = '';

    for (const patient of patients) {
      const card = await this.createPatientCard(patient);
      container.appendChild(card);
    }
  },

  async createPatientCard(patient) {
    const age = ReceptionUtils.calculateAge(patient.dob);
    const gender = patient.gender === 'M' ? 'Male' : 'Female';

    const card = document.createElement('div');
    card.className = 'patient-result-card';
    
    // Patient info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'patient-card-info';
    infoDiv.innerHTML = `
      <div class="patient-card-name">${patient.name}</div>
      <div class="patient-card-meta">
        RegNo: ${patient.regno} | ${age} | ${gender} | Mobile: ${patient.mobile || '-'}
      </div>
    `;
    card.appendChild(infoDiv);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'patient-card-actions';
    
    // Edit button - FIXED: Now calls viewPatient instead of editPatient
    const editBtn = this.createActionButton('✏️ Edit', 'btn-edit', () => {
      this.viewPatient(patient.id);
    });
    actionsDiv.appendChild(editBtn);

    // New OP button
    const newOpBtn = this.createActionButton('🆕 New OP', 'btn-new-op', async () => {
      await this.openOPDModal(patient, 'new');
    });
    actionsDiv.appendChild(newOpBtn);

    // Review button (check eligibility)
    const reviewBtn = await this.createReviewButton(patient);
    if (reviewBtn) {
      actionsDiv.appendChild(reviewBtn);
    }

    // Emergency button
    const emergencyBtn = this.createActionButton('🚨 Emergency', 'btn-emergency', async () => {
      await this.openOPDModal(patient, 'emergency');
    });
    actionsDiv.appendChild(emergencyBtn);

    card.appendChild(actionsDiv);
    return card;
  },

  createActionButton(text, className, onClick) {
    const btn = document.createElement('button');
    btn.className = `btn-patient-action ${className}`;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  },

  async createReviewButton(patient) {
    try {
      // Check review eligibility (last 5 days)
      const eligibility = await this.checkReviewEligibility(patient.id);
      
      if (eligibility.eligible) {
        const reviewText = `🔄 Review - ${eligibility.doctor_name} (${eligibility.reviews_used}/${eligibility.reviews_allowed})`;
        
        const btn = this.createActionButton(reviewText, 'btn-review', async () => {
          await this.openOPDModal(patient, 'review', eligibility.doctor_id, eligibility);
        });
        
        return btn;
      }
      
      return null; // Not eligible, don't show button
      
    } catch (error) {
      console.error('Failed to check review eligibility:', error);
      return null;
    }
  },

  async checkReviewEligibility(patientId) {
    // First, get any doctor to check eligibility
    const { doctors } = await API.get('/api/reception/doctors-list');
    
    if (doctors.length === 0) {
      return { eligible: false };
    }

    // Check with first doctor (or we could check all doctors and show if ANY doctor has eligibility)
    // For simplicity, checking with most recent doctor
    const response = await API.get(`/api/reception/patients/${patientId}/review-eligibility-last-5-days`);
    
    return response;
  },

  async openOPDModal(patient, visitType, doctorId = null, reviewData = null) {
    // Validate doctors exist
    try {
      const { doctors } = await API.get('/api/reception/doctors-list');
      
      if (doctors.length === 0) {
        Utils.showToast('No doctors available. Please add doctors via Admin page first.', 'error');
        return;
      }

      // Open OPD modal - FIXED: Changed to OPDEntryModal
      await OPDEntryModal.openModal(patient, visitType, doctorId, reviewData);
      
    } catch (error) {
      Utils.showToast('Failed to open OPD entry', 'error');
    }
  },

  // RESTORED FROM OLD VERSION: Direct edit functionality
  async viewPatient(patientId) {
    try {
      // Fetch patient data
      const { patient } = await API.get(`/api/reception/patients/${patientId}`);
      
      // Open edit modal
      document.getElementById('editPatientId').value = patient.id;
      document.getElementById('editRegno').value = patient.regno;
      document.getElementById('editName').value = patient.name;
      document.getElementById('editDob').value = patient.dob || '';
      document.getElementById('editGender').value = patient.gender || '';
      document.getElementById('editFather').value = patient.father || '';
      document.getElementById('editMother').value = patient.mother || '';
      document.getElementById('editAddress').value = patient.address || '';
      document.getElementById('editMobile').value = patient.mobile || '';
      
      // Update mobile status
      const status = ReceptionUtils.getMobileStatus(patient.mobile || '');
      const mobileStatus = document.getElementById('editMobileStatus');
      mobileStatus.textContent = status.text;
      mobileStatus.className = `mobile-status ${status.class}`;
      
      // Setup uppercase conversion for edit fields
      ['editName', 'editFather', 'editMother', 'editAddress'].forEach(id => {
        const field = document.getElementById(id);
        field.oninput = (e) => e.target.value = e.target.value.toUpperCase();
      });
      
      document.getElementById('editModal').style.display = 'flex';
      setTimeout(() => {
        document.getElementById('editModal').classList.add('active');
      }, 10);
    } catch (error) {
      Utils.showToast('Failed to load patient details', 'error');
    }
  },

  // RESTORED FROM OLD VERSION: Save edit functionality
  async saveEdit() {
    const patientId = document.getElementById('editPatientId').value;
    
    const formData = {
      name: document.getElementById('editName').value.toUpperCase(),
      dob: document.getElementById('editDob').value || null,
      gender: document.getElementById('editGender').value,
      father: document.getElementById('editFather').value.toUpperCase(),
      mother: document.getElementById('editMother').value.toUpperCase(),
      address: document.getElementById('editAddress').value.toUpperCase(),
      mobile: document.getElementById('editMobile').value
    };

    try {
      await API.put(`/api/reception/patients/${patientId}`, formData);
      
      Utils.showToast('Patient updated successfully', 'success');
      this.closeEditModal();
      
      // Refresh search if there's an active query
      const currentQuery = document.getElementById('smartSearchInput').value.trim();
      if (currentQuery && currentQuery.length >= 2) {
        this.performSearch(currentQuery);
      }
      
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },

  // RESTORED FROM OLD VERSION: Close modal
  closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  },

  showNoResults(query) {
    const container = document.getElementById('smartSearchResults');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p>No patients found for "${query}"</p>
        <button class="btn-modern btn-primary mt-3" onclick="Registration.openModal({name: '${query}'})">
          + Register New Patient
        </button>
      </div>
    `;
  },

  clearResults() {
    document.getElementById('smartSearchResults').innerHTML = '';
  }
};