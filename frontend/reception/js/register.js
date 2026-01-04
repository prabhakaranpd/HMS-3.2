/**
 * HMS 3.0 - Patient Registration
 */

const Register = {
  init() {
    // Set max date to today
    document.getElementById('dob').max = new Date().toISOString().split('T')[0];

    // Auto-uppercase text inputs
    ['name', 'father', 'mother', 'address'].forEach(id => {
      document.getElementById(id).addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    });

    // DOB change - calculate age
    document.getElementById('dob').addEventListener('change', (e) => {
      const age = ReceptionUtils.calculateAge(e.target.value);
      document.getElementById('ageDisplay').textContent = age;
    });

    // Mobile validation
    const mobileInput = document.getElementById('mobile');
    const mobileStatus = document.getElementById('mobileStatus');
    
    mobileInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      if (e.target.value.length > 10) {
        e.target.value = e.target.value.slice(0, 10);
      }
      
      const status = ReceptionUtils.getMobileStatus(e.target.value);
      mobileStatus.textContent = status.text;
      mobileStatus.className = `mobile-status ${status.class}`;
    });

    // Form submit
    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.registerPatient();
    });

    // Clear form button
    document.getElementById('clearFormBtn').addEventListener('click', () => {
      this.clearForm();
    });

    // Load data
    this.loadNextRegNo();
    this.loadLastRegistration();
  },

  async loadNextRegNo() {
    try {
      const { next_regno } = await API.get('/api/reception/patients/next-regno');
      document.getElementById('displayRegNo').value = next_regno;
    } catch (error) {
      document.getElementById('displayRegNo').value = '-';
    }
  },

  async registerPatient() {
    const formData = {
      name: document.getElementById('name').value.toUpperCase(),
      dob: document.getElementById('dob').value || null,
      gender: document.getElementById('gender').value,
      father: document.getElementById('father').value.toUpperCase(),
      mother: document.getElementById('mother').value.toUpperCase(),
      address: document.getElementById('address').value.toUpperCase(),
      mobile: document.getElementById('mobile').value
    };

    try {
      const result = await API.post('/api/reception/patients', formData);
      
      Utils.showToast(`✅ Patient registered! RegNo: ${result.regno}`, 'success');
      
      // Update UI
      await this.loadNextRegNo();
      await this.loadLastRegistration();
      
      // Clear form after 3 seconds
      const form = document.getElementById('registerForm');
      form.classList.add('form-clearing');
      
      setTimeout(() => {
        this.clearForm();
        form.classList.remove('form-clearing');
      }, 3000);
      
      // Update queue count
      this.loadQueueCount();
      
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },

  clearForm() {
    document.getElementById('registerForm').reset();
    document.getElementById('mobileStatus').textContent = '';
    document.getElementById('ageDisplay').textContent = '-';
    this.loadNextRegNo();
  },

  async loadLastRegistration() {
    try {
      const { patient } = await API.get('/api/reception/patients/last/registered');
      
      if (patient) {
        const container = document.getElementById('lastRegistration');
        const details = document.getElementById('lastRegistrationDetails');
        
        const age = ReceptionUtils.calculateAge(patient.dob);
        
        details.innerHTML = `
          <div class="detail-item">
            <div class="detail-label">RegNo</div>
            <div class="detail-value">${patient.regno}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Name</div>
            <div class="detail-value">${patient.name}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Age</div>
            <div class="detail-value">${age}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Gender</div>
            <div class="detail-value">${patient.gender === 'M' ? 'MALE' : 'FEMALE'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Father</div>
            <div class="detail-value">${patient.father || '-'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Mother</div>
            <div class="detail-value">${patient.mother || '-'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Mobile</div>
            <div class="detail-value">${patient.mobile || '-'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Address</div>
            <div class="detail-value">${patient.address || '-'}</div>
          </div>
        `;
        
        container.style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to load last registration:', error);
    }
  },

  async loadQueueCount() {
    try {
      const { queue_count } = await API.get('/api/reception/stats/queue');
      document.getElementById('queueCount').textContent = queue_count;
    } catch (error) {
      document.getElementById('queueCount').textContent = '-';
    }
  }
};
