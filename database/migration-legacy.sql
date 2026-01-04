-- HMS 3.0 - Legacy Data Migration Schema Updates
-- Run this BEFORE importing legacy data

-- ==============================================
-- ADD LEGACY COLUMNS TO OP REGISTER
-- ==============================================

-- Add legacy OP number column
ALTER TABLE op_register ADD COLUMN legacy_op_number TEXT;

-- Add legacy flag
ALTER TABLE op_register ADD COLUMN is_legacy INTEGER DEFAULT 0;

-- ==============================================
-- CREATE LEGACY VACCINE REGISTER TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS vaccine_register_legacy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Snapshot patient info (from old system)
  regno TEXT NOT NULL,
  name TEXT NOT NULL,
  age_sex TEXT,
  father TEXT,
  mother TEXT,
  address TEXT,
  mobile TEXT,
  
  -- Vaccine details
  entry_date TEXT,
  visit_date TEXT NOT NULL,
  vaccine_given TEXT NOT NULL,
  next_vaccine TEXT,
  next_vaccine_date TEXT,
  additional_instructions TEXT,
  
  -- Metadata
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  legacy_sno INTEGER,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_vaccine_legacy_regno ON vaccine_register_legacy(regno);
CREATE INDEX IF NOT EXISTS idx_vaccine_legacy_visit_date ON vaccine_register_legacy(visit_date);

-- ==============================================
-- CREATE LEGACY FOLLOWUP REGISTER TABLE  
-- ==============================================

CREATE TABLE IF NOT EXISTS followup_register_legacy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Snapshot patient info (from old system)
  regno TEXT NOT NULL,
  name TEXT NOT NULL,
  age_sex TEXT,
  father TEXT,
  mother TEXT,
  address TEXT,
  mobile TEXT,
  
  -- Follow-up details
  entry_date TEXT,
  entry_type TEXT,
  visit_date TEXT,
  followup_date TEXT NOT NULL,
  present_complaints TEXT,
  followup_reason TEXT NOT NULL,
  additional_instructions TEXT,
  status TEXT,
  log TEXT,
  
  -- Metadata
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  legacy_sno INTEGER,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_followup_legacy_regno ON followup_register_legacy(regno);
CREATE INDEX IF NOT EXISTS idx_followup_legacy_followup_date ON followup_register_legacy(followup_date);
