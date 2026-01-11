/**
 * HMS 3.0 - Smart Search (UPDATED with Modal Integration)
 * 
 * CHANGES FROM ORIGINAL:
 * 1. Added review eligibility check
 * 2. Added 4-button layout to patient cards
 * 3. Added doctor validation before opening OPD modal
 * 4. Integrated with Registration and OPD modals
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
    
    // Edit button
    const editBtn = this.createActionButton('✏️ Edit', 'btn-edit', () => {
      this.editPatient(patient.id);
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

      // Open OPD modal
      await OPDEntry.openModal(patient, visitType, doctorId, reviewData);
      
    } catch (error) {
      Utils.showToast('Failed to open OPD entry', 'error');
    }
  },

  editPatient(patientId) {
    // Existing edit functionality (already implemented)
    // This opens the edit patient modal
    ViewRecords.editPatient(patientId);
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
