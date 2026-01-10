/**
 * HMS 3.0 - OPD Entry Modal Templates
 * HTML templates using template literals
 */

const OPDTemplates = {
  
  /**
   * Main OPD Entry Modal
   */
  modalHTML(patient, visitType, doctorId = null, reviewData = null) {
    const modalTitle = visitType === 'new' ? '🏥 New OPD Entry' : 
                       visitType === 'review' ? '🔄 Review Visit' : 
                       '🚨 Emergency Visit';
    
    const age = ReceptionUtils.calculateAge(patient.dob);
    const gender = patient.gender === 'M' ? 'Male' : 'Female';
    
    return `
      <div class="modal-overlay active" id="opdEntryModal" data-patient-id="${patient.id}" data-visit-type="${visitType}">
        <div class="modal-container opd-modal">
          <div class="modal-header">
            <h3>${modalTitle} - ${patient.name}</h3>
            <button type="button" class="modal-close" onclick="OPDEntry.closeModal()">✖️</button>
          </div>
          
          <div class="modal-body">
            ${this.loadingHTML()}
            <div id="opdModalContent" style="display: none;">
              
              <!-- Patient Snapshot -->
              ${this.patientSnapshotHTML(patient, age, gender)}
              
              <!-- Doctor & Fee Section -->
              ${this.doctorFeeSection(visitType, doctorId, reviewData)}
              
              <!-- Vitals Section -->
              ${this.vitalsSection()}
              
              <!-- Complaints Section -->
              ${this.complaintsSection(visitType)}
              
              <!-- Payment Section -->
              ${this.paymentSection()}
              
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-modern btn-secondary" onclick="OPDEntry.showPreviousVisits()">
              📅 Previous Visits
            </button>
            <button type="button" class="btn-modern btn-primary" onclick="OPDEntry.saveEntry()" id="opdSaveBtn">
              💾 Save Entry
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Loading State
   */
  loadingHTML() {
    return `
      <div id="opdModalLoading" class="modal-loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading...</div>
      </div>
    `;
  },

  /**
   * Patient Snapshot
   */
  patientSnapshotHTML(patient, age, gender) {
    return `
      <div class="patient-snapshot">
        <div class="patient-snapshot-main">
          <div>
            <div class="patient-name-large">${patient.name}</div>
            <div class="patient-regno-large">RegNo: ${patient.regno}</div>
          </div>
        </div>
        <div class="info-icon">
          ℹ️
          <div class="tooltip">
            <div class="tooltip-row"><strong>Age:</strong> ${age}</div>
            <div class="tooltip-row"><strong>Gender:</strong> ${gender}</div>
            <div class="tooltip-row"><strong>Father:</strong> ${patient.father || '-'}</div>
            <div class="tooltip-row"><strong>Mother:</strong> ${patient.mother || '-'}</div>
            <div class="tooltip-row"><strong>Mobile:</strong> ${patient.mobile || '-'}</div>
            <div class="tooltip-row"><strong>Address:</strong> ${patient.address || '-'}</div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Doctor & Fee Section
   */
  doctorFeeSection(visitType, doctorId, reviewData) {
    return `
      <div class="collapsible-section">
        <div class="collapsible-header active" onclick="OPDEntry.toggleSection(this)">
          <div class="collapsible-title">👨‍⚕️ Doctor & Fee</div>
          <div class="collapsible-arrow">▼</div>
        </div>
        <div class="collapsible-content active" id="doctorFeeContent">
          
          ${visitType === 'review' && reviewData ? `
            <div class="fee-badge review-badge">
              ✅ Free Review (${reviewData.reviews_used}/${reviewData.reviews_allowed} used, ${reviewData.days_remaining} days left)
            </div>
          ` : ''}
          
          ${visitType === 'emergency' ? `
            <div class="fee-badge emergency-badge">
              🚨 Emergency Visit - Includes Surcharge
            </div>
          ` : ''}
          
          <div class="form-group mb-3">
            <label class="form-label">Doctor <span class="required">*</span></label>
            <select class="form-select" id="opdModalDoctor" required>
              <option value="">Select Doctor</option>
            </select>
          </div>

          <div class="fee-breakdown-card" id="opdFeeBreakdown" style="display: none;">
            <div class="fee-breakdown-header">Fee Breakdown</div>
            <div class="fee-breakdown-body">
              <div class="fee-item">
                <span>Consultation Fee:</span>
                <strong id="opdFeeConsultation">₹0</strong>
              </div>
              <div class="fee-item">
                <span>Emergency Surcharge:</span>
                <strong id="opdFeeSurcharge">₹0</strong>
              </div>
              <div class="fee-item fee-total">
                <span>Total:</span>
                <strong id="opdFeeTotal">₹0</strong>
              </div>
            </div>
          </div>

          <div class="form-row form-row-2 mt-3">
            <div class="form-group">
              <label class="form-label">Override Amount (Optional)</label>
              <input type="number" class="form-input" id="opdOverrideFee" 
                     step="0.01" min="0" placeholder="Leave blank to use calculated fee">
            </div>
            <div class="form-group">
              <label class="form-label">Final Amount</label>
              <div class="final-amount-display" id="opdFinalAmount">₹0.00</div>
            </div>
          </div>

          <input type="hidden" id="opdCalculatedFee" value="0">
        </div>
      </div>
    `;
  },

  /**
   * Vitals Section
   */
  vitalsSection() {
    return `
      <div class="collapsible-section">
        <div class="collapsible-header" onclick="OPDEntry.toggleSection(this)">
          <div class="collapsible-title">🩺 Vitals (Optional)</div>
          <div class="collapsible-arrow">▼</div>
        </div>
        <div class="collapsible-content">
          <div class="vitals-grid">
            <div class="form-group">
              <label class="form-label">BP (mmHg)</label>
              <input type="text" class="form-input" id="opdBP" placeholder="120/80">
            </div>
            <div class="form-group">
              <label class="form-label">Temperature (°F)</label>
              <input type="number" class="form-input" id="opdTemp" step="0.1" placeholder="98.6">
            </div>
            <div class="form-group">
              <label class="form-label">Pulse (bpm)</label>
              <input type="number" class="form-input" id="opdPulse" placeholder="72">
            </div>
            <div class="form-group">
              <label class="form-label">RR (breaths/min)</label>
              <input type="number" class="form-input" id="opdRR" placeholder="16">
            </div>
            <div class="form-group">
              <label class="form-label">SpO₂ (%)</label>
              <input type="number" class="form-input" id="opdSPO2" min="0" max="100" placeholder="98">
            </div>
            <div class="form-group">
              <label class="form-label">Weight (kg)</label>
              <input type="number" class="form-input" id="opdWeight" step="0.1" placeholder="70">
            </div>
            <div class="form-group">
              <label class="form-label">Height (cm)</label>
              <input type="number" class="form-input" id="opdHeight" step="0.1" placeholder="170">
            </div>
            <div class="form-group">
              <label class="form-label">HC (cm)</label>
              <input type="number" class="form-input" id="opdHC" step="0.1" placeholder="Head Circumference">
            </div>
            <div class="form-group">
              <label class="form-label">MUAC (cm)</label>
              <input type="number" class="form-input" id="opdMUAC" step="0.1" placeholder="Mid-Upper Arm">
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Complaints Section
   */
  complaintsSection(visitType) {
    return `
      <div class="collapsible-section">
        <div class="collapsible-header active" onclick="OPDEntry.toggleSection(this)">
          <div class="collapsible-title">💬 Complaints <span class="required">*</span></div>
          <div class="collapsible-arrow">▼</div>
        </div>
        <div class="collapsible-content active">
          
          <div class="form-group mb-3">
            <label class="form-label">Chief Complaints <span class="required">*</span></label>
            <div class="complaints-dropdown-container">
              <div class="complaints-dropdown-trigger" onclick="OPDEntry.toggleComplaintsDropdown()" id="opdComplaintsTrigger">
                <span class="selected-complaints-display placeholder" id="opdSelectedComplaints">
                  Select complaints...
                </span>
                <span class="dropdown-arrow">▼</span>
              </div>
              <div class="complaints-dropdown-content" id="opdComplaintsDropdown">
                <div class="complaints-checkbox-list" id="opdComplaintsList">
                  <!-- Will be populated by JS -->
                </div>
                <div class="add-complaint-section">
                  <input type="text" class="add-complaint-input" id="opdNewComplaintInput" 
                         placeholder="Type new complaint..." style="text-transform: uppercase;">
                  <button type="button" class="btn-add-complaint" onclick="OPDEntry.addNewComplaint()">
                    ➕ Add to List
                  </button>
                </div>
              </div>
            </div>
          </div>

          ${visitType === 'review' ? `
            <div class="form-group">
              <label class="form-label">Previous Complaints (from last visit)</label>
              <textarea class="form-input" id="opdPreviousComplaints" rows="2" 
                        readonly style="background: #f8fafc;"></textarea>
            </div>
          ` : ''}
          
        </div>
      </div>
    `;
  },

  /**
   * Payment Section
   */
  paymentSection() {
    return `
      <div class="collapsible-section">
        <div class="collapsible-header active" onclick="OPDEntry.toggleSection(this)">
          <div class="collapsible-title">💰 Payment</div>
          <div class="collapsible-arrow">▼</div>
        </div>
        <div class="collapsible-content active">
          
          <div class="form-group mb-3">
            <label class="form-label">Payment Method</label>
            <div class="payment-method-group">
              <label class="payment-method-option">
                <input type="radio" name="opdPaymentMethod" value="Cash">
                <span class="payment-method-label">💵 Cash</span>
              </label>
              <label class="payment-method-option">
                <input type="radio" name="opdPaymentMethod" value="UPI">
                <span class="payment-method-label">📱 UPI</span>
              </label>
              <label class="payment-method-option">
                <input type="radio" name="opdPaymentMethod" value="Card">
                <span class="payment-method-label">💳 Card</span>
              </label>
              <label class="payment-method-option">
                <input type="radio" name="opdPaymentMethod" value="Other">
                <span class="payment-method-label">🏦 Other</span>
              </label>
            </div>
          </div>

          <div class="form-row form-row-3">
            <div class="form-group">
              <label class="form-label">Amount to Pay</label>
              <div class="amount-display" id="opdAmountToPay">₹0.00</div>
            </div>
            <div class="form-group">
              <label class="form-label">Amount Paid</label>
              <input type="number" class="form-input" id="opdPaidAmount" 
                     step="0.01" min="0" value="0" placeholder="0.00">
            </div>
            <div class="form-group">
              <label class="form-label">Balance</label>
              <div class="amount-display balance-display" id="opdBalance">₹0.00</div>
            </div>
          </div>
          
        </div>
      </div>
    `;
  },

  /**
   * OPD Success Modal
   */
  successModalHTML(opdData) {
    return `
      <div class="modal-overlay active" id="opdSuccessModal">
        <div class="modal-container success-modal">
          <div class="modal-header success-header">
            <h3>✅ OPD Entry Created Successfully</h3>
          </div>
          
          <div class="modal-body">
            <div class="success-op-number">
              ${opdData.op_number}
            </div>
            
            <div class="success-details">
              <div class="detail-row">
                <strong>Patient:</strong>
                <span>${opdData.patient_name} (${opdData.regno})</span>
              </div>
              <div class="detail-row">
                <strong>Doctor:</strong>
                <span>${opdData.doctor_name}</span>
              </div>
              <div class="detail-row">
                <strong>Visit Type:</strong>
                <span>${opdData.visit_type.toUpperCase()}</span>
              </div>
              <div class="detail-row">
                <strong>Complaints:</strong>
                <span>${opdData.complaints}</span>
              </div>
              <div class="detail-row">
                <strong>Payment Method:</strong>
                <span>${opdData.payment_method || '-'}</span>
              </div>
              <div class="detail-row">
                <strong>Amount Paid:</strong>
                <span>₹${opdData.amount_paid.toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <strong>Balance:</strong>
                <span>₹${opdData.balance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-modern btn-secondary" onclick="OPDEntry.printOPSlip()">
              🖨️ Print OP Slip
            </button>
            <button type="button" class="btn-modern btn-primary" onclick="OPDEntry.closeSuccess()">
              ✓ Close
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Previous Visits Modal
   */
  previousVisitsModalHTML(visits, patientName) {
    return `
      <div class="modal-overlay active" id="previousVisitsModal" style="z-index: 10000;">
        <div class="modal-container previous-visits-modal">
          <div class="modal-header">
            <h3>📅 Previous Visits - ${patientName}</h3>
            <button type="button" class="modal-close" onclick="OPDEntry.closePreviousVisits()">✖️</button>
          </div>
          
          <div class="modal-body">
            ${visits.length === 0 ? `
              <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>No previous visits found</p>
              </div>
            ` : visits.map(visit => `
              <div class="visit-card">
                <div class="visit-date">${Utils.formatDate(visit.visit_date)}</div>
                <div class="visit-info">
                  <strong>OP#:</strong> ${visit.op_number} | 
                  <strong>Type:</strong> ${visit.visit_type.toUpperCase()} | 
                  <strong>Doctor:</strong> ${visit.doctor_name || '-'}
                </div>
                <div class="visit-complaints">${visit.chief_complaints || 'No complaints recorded'}</div>
              </div>
            `).join('')}
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-modern btn-secondary" onclick="OPDEntry.closePreviousVisits()">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
  }
};
