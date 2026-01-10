/**
 * HMS 3.0 - Registration Modal Templates
 * HTML templates using template literals
 */

const RegistrationTemplates = {
  
  /**
   * Main Registration Modal
   */
  modalHTML(data = {}) {
    return `
      <div class="modal-overlay active" id="registrationModal">
        <div class="modal-container registration-modal">
          <div class="modal-header">
            <h3>📝 Patient Registration</h3>
            <button type="button" class="modal-close" onclick="Registration.closeModal()">✖️</button>
          </div>
          
          <form id="registrationModalForm">
            <div class="modal-body">
              
              <!-- RegNo Display -->
              <div class="form-group mb-3">
                <label class="form-label">Registration Number</label>
                <input type="text" class="form-input" id="regModalDisplayRegno" disabled 
                       style="background: #f0f4ff; font-weight: 700; color: #667eea; text-align: center;">
              </div>

              <!-- Row 1: Name -->
              <div class="form-row form-row-1">
                <div class="form-group">
                  <label class="form-label">Name <span class="required">*</span></label>
                  <input type="text" class="form-input" id="regModalName" 
                         value="${data.name || ''}" required 
                         style="text-transform: uppercase;">
                </div>
              </div>

              <!-- Row 2: DOB + Gender -->
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label class="form-label">Date of Birth</label>
                  <input type="date" class="form-input" id="regModalDob" 
                         value="${data.dob || ''}" max="${new Date().toISOString().split('T')[0]}">
                  <div id="regModalAgeDisplay" class="mobile-status" style="color: #667eea; margin-top: 4px;"></div>
                </div>
                
                <div class="form-group">
                  <label class="form-label">Gender <span class="required">*</span></label>
                  <select class="form-select" id="regModalGender" required>
                    <option value="">Select Gender</option>
                    <option value="M" ${data.gender === 'M' ? 'selected' : ''}>Male</option>
                    <option value="F" ${data.gender === 'F' ? 'selected' : ''}>Female</option>
                  </select>
                </div>
              </div>

              <!-- Row 3: Father + Mother -->
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label class="form-label">Father's Name <span class="required">*</span></label>
                  <input type="text" class="form-input" id="regModalFather" 
                         value="${data.father || ''}" required 
                         style="text-transform: uppercase;">
                </div>
                
                <div class="form-group">
                  <label class="form-label">Mother's Name <span class="required">*</span></label>
                  <input type="text" class="form-input" id="regModalMother" 
                         value="${data.mother || ''}" required 
                         style="text-transform: uppercase;">
                </div>
              </div>

              <!-- Row 4: Address -->
              <div class="form-row form-row-1">
                <div class="form-group">
                  <label class="form-label">Address <span class="required">*</span></label>
                  <textarea class="form-textarea" id="regModalAddress" 
                            required rows="2" 
                            style="text-transform: uppercase;">${data.address || ''}</textarea>
                </div>
              </div>

              <!-- Row 5: Mobile -->
              <div class="form-row form-row-1">
                <div class="form-group">
                  <label class="form-label">Mobile Number <span class="required">*</span></label>
                  <input type="tel" class="form-input" id="regModalMobile" 
                         value="${data.mobile || ''}" required 
                         maxlength="10" pattern="[0-9]{10}" 
                         placeholder="10-digit mobile number">
                  <div id="regModalMobileStatus" class="mobile-status"></div>
                </div>
              </div>

            </div>

            <div class="modal-footer">
              <button type="button" class="btn-modern btn-secondary" onclick="Registration.closeModal()">
                Cancel
              </button>
              <button type="submit" class="btn-modern btn-primary" id="regModalSaveBtn">
                💾 Save Registration
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  /**
   * Registration Success Modal
   */
  successModalHTML(patient, regno) {
    const age = ReceptionUtils.calculateAge(patient.dob);
    const gender = patient.gender === 'M' ? 'Male' : 'Female';
    
    return `
      <div class="modal-overlay active" id="registrationSuccessModal">
        <div class="modal-container success-modal">
          <div class="modal-header success-header">
            <h3>✅ Patient Registered Successfully</h3>
          </div>
          
          <div class="modal-body">
            <div class="success-op-number">
              ${regno}
            </div>
            
            <div class="success-details">
              <div class="detail-row">
                <strong>Name:</strong>
                <span>${patient.name}</span>
              </div>
              <div class="detail-row">
                <strong>Age:</strong>
                <span>${age}</span>
              </div>
              <div class="detail-row">
                <strong>Gender:</strong>
                <span>${gender}</span>
              </div>
              <div class="detail-row">
                <strong>Father:</strong>
                <span>${patient.father || '-'}</span>
              </div>
              <div class="detail-row">
                <strong>Mother:</strong>
                <span>${patient.mother || '-'}</span>
              </div>
              <div class="detail-row">
                <strong>Mobile:</strong>
                <span>${patient.mobile || '-'}</span>
              </div>
              <div class="detail-row">
                <strong>Address:</strong>
                <span>${patient.address || '-'}</span>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-modern btn-primary" 
                    onclick="Registration.createNewVisit(${patient.id})">
              🏥 New Visit Entry
            </button>
            <button type="button" class="btn-modern btn-secondary" 
                    onclick="Registration.closeSuccess()">
              ✓ Close
            </button>
          </div>
        </div>
      </div>
    `;
  }
};
