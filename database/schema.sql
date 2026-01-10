-- HMS 3.0 Clean Database Schema
-- SQLite Database

-- ==============================================
-- USERS & AUTHENTICATION
-- ==============================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'reception', 'doctor', 'nurse', 'lab', 'pharmacy', 'management')),
  is_active INTEGER DEFAULT 1,
  consultation_fee REAL DEFAULT 200,
  review_days INTEGER DEFAULT 4,
  review_count INTEGER DEFAULT 4,
  emergency_surcharge REAL DEFAULT 100,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS active_sessions (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  login_time TEXT NOT NULL,
  last_activity TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  login_time TEXT NOT NULL,
  logout_time TEXT,
  session_duration INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  logout_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- PATIENT MANAGEMENT
-- ==============================================

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regno TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  father TEXT,
  mother TEXT,
  address TEXT,
  mobile TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- COMPLAINTS MASTER
-- ==============================================

CREATE TABLE IF NOT EXISTS complaints_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_text TEXT NOT NULL UNIQUE,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ==============================================
-- OP REGISTER
-- ==============================================

CREATE TABLE IF NOT EXISTS op_register (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_number TEXT UNIQUE NOT NULL,
  op_hash TEXT NOT NULL,
  op_cycle INTEGER NOT NULL,
  op_sequence INTEGER NOT NULL,
  op_year INTEGER NOT NULL,
  legacy_op_number TEXT,
  
  patient_id INTEGER NOT NULL,
  regno TEXT NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  father TEXT,
  mother TEXT,
  address TEXT,
  mobile TEXT,
  
  appointment_id INTEGER,
  appointment_type TEXT,
  visit_date TEXT NOT NULL,
  visit_time TEXT NOT NULL,
  visit_type TEXT DEFAULT 'new',
  
  vitals_bp TEXT,
  vitals_temp TEXT,
  vitals_pulse TEXT,
  vitals_rr TEXT,
  vitals_spo2 TEXT,
  vitals_weight TEXT,
  vitals_height TEXT,
  vitals_hc TEXT,
  vitals_muac TEXT,
  
  chief_complaints TEXT,
  previous_complaints TEXT,
  
  doctor_id INTEGER NOT NULL,
  consultation_status TEXT DEFAULT 'waiting',
  consultation_fee REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

-- ==============================================
-- PAYMENTS
-- ==============================================

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_type TEXT NOT NULL CHECK(reference_type IN ('opd', 'lab', 'pharmacy', 'procedure')),
  reference_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'partial')),
  paid_amount REAL DEFAULT 0,
  balance_amount REAL DEFAULT 0,
  payment_date TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ==============================================
-- VACCINE REGISTER
-- ==============================================

CREATE TABLE IF NOT EXISTS vaccine_register (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_register_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  
  vaccine_type TEXT NOT NULL,
  vaccine_brand TEXT,
  composition TEXT,
  
  dose_number INTEGER NOT NULL,
  dose_label TEXT,
  
  route TEXT NOT NULL CHECK(route IN ('IM', 'SC', 'ID', 'Oral', 'Intranasal')),
  site TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  manufacturer TEXT,
  
  administered_date TEXT NOT NULL,
  administered_time TEXT NOT NULL,
  administered_by INTEGER NOT NULL,
  
  next_vaccine_type TEXT,
  next_dose_number INTEGER,
  next_dose_due_date TEXT,
  
  adverse_reaction_observed INTEGER DEFAULT 0,
  adverse_reaction_details TEXT,
  adverse_reaction_severity TEXT CHECK(adverse_reaction_severity IN ('Mild', 'Moderate', 'Severe', NULL)),
  
  followup_contact_confirmed INTEGER DEFAULT 0,
  followup_contact_number TEXT,
  
  comments TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (op_register_id) REFERENCES op_register(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (administered_by) REFERENCES users(id)
);

-- ==============================================
-- FOLLOW-UP REGISTER
-- ==============================================

CREATE TABLE IF NOT EXISTS followup_register (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_register_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  
  followup_type TEXT NOT NULL,
  followup_reason TEXT NOT NULL,
  followup_period TEXT,
  next_visit_date TEXT NOT NULL,
  
  followup_contact_confirmed INTEGER DEFAULT 0,
  followup_contact_number TEXT,
  
  status TEXT DEFAULT 'pending',
  completion_date TEXT,
  
  advised_by INTEGER NOT NULL,
  comments TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (op_register_id) REFERENCES op_register(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (advised_by) REFERENCES users(id)
);

-- ==============================================
-- LEGACY TABLES (HMS 2.0 Data - Reference Only)
-- ==============================================

CREATE TABLE IF NOT EXISTS vaccine_register_legacy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  s_no INTEGER,
  next_vaccine_date TEXT,
  entry_date TEXT,
  regno TEXT,
  name TEXT,
  age_sex TEXT,
  father_name TEXT,
  mother_name TEXT,
  address TEXT,
  mobile_no TEXT,
  visit_date TEXT,
  vaccine_given TEXT,
  next_vaccine TEXT,
  additional_instructions TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS followup_register_legacy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  s_no INTEGER,
  followup_date TEXT,
  entry_date TEXT,
  entry_type TEXT,
  regno TEXT,
  name TEXT,
  age_sex TEXT,
  father_name TEXT,
  mother_name TEXT,
  address TEXT,
  mobile_no TEXT,
  visit_date TEXT,
  present_complaints TEXT,
  followup_reason TEXT,
  additional_instructions TEXT,
  status TEXT,
  log TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- SEED DATA
-- ==============================================

-- Default Admin User (username: admin, password: admin123)
INSERT OR IGNORE INTO users (username, password, full_name, role, is_active)
VALUES ('admin', 'admin123', 'System Administrator', 'admin', 1);

-- Default System Settings
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('auto_backup_enabled', 'true');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('auto_backup_time', '23:00');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('backup_retention_days', '30');

-- Seed Complaints Master Data
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('FEVER');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('COUGH');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('COLD');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('HEADACHE');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('BODY PAIN');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('ABDOMINAL PAIN');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('VOMITING');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('DIARRHEA');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('RASH');
INSERT OR IGNORE INTO complaints_master (complaint_text) VALUES ('WEAKNESS');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_patients_regno ON patients(regno);
CREATE INDEX IF NOT EXISTS idx_op_register_patient_id ON op_register(patient_id);
CREATE INDEX IF NOT EXISTS idx_op_register_visit_date ON op_register(visit_date);
CREATE INDEX IF NOT EXISTS idx_op_register_doctor_id ON op_register(doctor_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_vaccine_register_patient_id ON vaccine_register(patient_id);
CREATE INDEX IF NOT EXISTS idx_followup_register_patient_id ON followup_register(patient_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
