/**
 * HMS 3.0 - Smart Search with Priority Ordering
 */

const SmartSearch = {
  currentResults: [],
  currentOffset: 0,
  currentQuery: '',
  totalResults: 0,

  init() {
    const searchInput = document.getElementById('smartSearchInput');
    
    // Debounced search
    const debouncedSearch = ReceptionUtils.debounce((query) => {
      this.search(query, 0);
    }, 300);

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      this.currentQuery = query;
      
      if (query.length >= 2) {
        debouncedSearch(query);
      } else {
        this.clearResults();
      }
    });
  },

  async search(query, offset = 0) {
    if (!query || query.length < 2) return;

    try {
      const data = await API.get(`/api/reception/patients/smart-search?q=${encodeURIComponent(query)}&limit=10&offset=${offset}`);
      
      this.currentResults = data.patients;
      this.currentOffset = offset;
      this.totalResults = data.total;
      
      this.renderResults(offset === 0);
      
    } catch (error) {
      Utils.showToast('Search failed', 'error');
    }
  },

  renderResults(clearFirst = true) {
    const container = document.getElementById('smartSearchResults');
    
    if (clearFirst) {
      container.innerHTML = '';
    }

    if (this.currentResults.length === 0 && this.currentOffset === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>No patients found</p></div>';
      return;
    }

    this.currentResults.forEach(patient => {
      const age = ReceptionUtils.calculateAge(patient.dob);
      
      const card = document.createElement('div');
      card.className = 'patient-card';
      
      card.innerHTML = `
        <div class="patient-card-header">
          <div class="patient-name-section">
            <div class="patient-name">${patient.name}</div>
            <span class="patient-regno">RegNo: ${patient.regno}</span>
          </div>
          <button class="btn-edit" onclick="SmartSearch.viewPatient(${patient.id})">
            ✏️ Edit
          </button>
        </div>
        <div class="patient-details-grid">
          <div class="patient-detail-item"><strong>Age:</strong> ${age}</div>
          <div class="patient-detail-item"><strong>Gender:</strong> ${patient.gender === 'M' ? 'Male' : 'Female'}</div>
          <div class="patient-detail-item"><strong>Mobile:</strong> ${patient.mobile || '-'}</div>
          <div class="patient-detail-item"><strong>Father:</strong> ${patient.father || '-'}</div>
          <div class="patient-detail-item"><strong>Mother:</strong> ${patient.mother || '-'}</div>
          <div class="patient-detail-item" style="grid-column: 1 / -1;"><strong>Address:</strong> ${patient.address || '-'}</div>
        </div>
      `;
      
      container.appendChild(card);
    });

    // Load more button
    if (this.currentOffset + this.currentResults.length < this.totalResults) {
      const loadMoreBtn = document.getElementById('loadMoreBtn') || document.createElement('button');
      loadMoreBtn.id = 'loadMoreBtn';
      loadMoreBtn.className = 'btn-modern load-more-btn';
      loadMoreBtn.textContent = `Load More (${this.totalResults - (this.currentOffset + this.currentResults.length)} remaining)`;
      loadMoreBtn.onclick = () => this.loadMore();
      
      if (!document.getElementById('loadMoreBtn')) {
        container.appendChild(loadMoreBtn);
      }
    } else {
      document.getElementById('loadMoreBtn')?.remove();
    }
  },

  async loadMore() {
    const newOffset = this.currentOffset + 10;
    await this.search(this.currentQuery, newOffset);
  },

  clearResults() {
    document.getElementById('searchResults').innerHTML = '';
    this.currentResults = [];
    this.currentOffset = 0;
    this.totalResults = 0;
  },

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
      
      // Refresh search
      if (this.currentQuery) {
        this.search(this.currentQuery, 0);
      }
      
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },

  closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  }
};
