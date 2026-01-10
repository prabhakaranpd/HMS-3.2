const express = require('express');
const db = require('../config/db');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require reception or admin or doctor
const requireReceptionAccess = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const allowedRoles = ['admin', 'reception', 'doctor'];
  if (!allowedRoles.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
};

router.use(requireReceptionAccess);

/* ==================================================
   GET NEXT REGNO
================================================== */
function getNextRegNo() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT MAX(CAST(regno AS INTEGER)) as max_regno FROM patients`,
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        const nextRegNo = (row && row.max_regno) ? row.max_regno + 1 : 1;
        resolve(nextRegNo.toString());
      }
    );
  });
}

/* ==================================================
   GET NEXT REGNO (API)
================================================== */
router.get('/patients/next-regno', async (req, res) => {
  try {
    const nextRegNo = await getNextRegNo();
    res.json({ next_regno: nextRegNo });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get next RegNo' });
  }
});

/* ==================================================
   CREATE PATIENT
================================================== */
router.post('/patients', async (req, res) => {
  const { name, dob, gender, father, mother, address, mobile } = req.body;

  // Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!gender) {
    return res.status(400).json({ error: 'Gender is required' });
  }

  if (!address || !address.trim()) {
    return res.status(400).json({ error: 'Address is required' });
  }

  if (!mobile || mobile.length !== 10) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number is required' });
  }

  try {
    const regno = await getNextRegNo();
    
    const sql = `
      INSERT INTO patients (regno, name, dob, gender, father, mother, address, mobile)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [
      regno,
      name.trim().toUpperCase(),
      dob || null,
      gender,
      father?.trim().toUpperCase() || null,
      mother?.trim().toUpperCase() || null,
      address.trim().toUpperCase(),
      mobile
    ], function(err) {
      if (err) {
        console.error('❌ Patient creation failed:', err.message);
        return res.status(500).json({ error: 'Failed to register patient' });
      }

      res.json({
        message: 'Patient registered successfully',
        patient_id: this.lastID,
        regno: regno
      });
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Failed to register patient' });
  }
});

/* ==================================================
   SMART SEARCH WITH PRIORITY ORDERING
================================================== */
router.get('/patients/smart-search', (req, res) => {
  const { q, limit = 10, offset = 0 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json({ patients: [], total: 0 });
  }

  const searchTerm = q.trim().toUpperCase();
  const isNumeric = /^\d+$/.test(searchTerm);

  let sql, params;

  if (isNumeric) {
    // NUMERIC SEARCH: RegNo first, then Mobile
    sql = `
      SELECT *, 
        CASE 
          WHEN regno LIKE ? THEN 1          -- Exact/contains RegNo = priority 1
          WHEN mobile LIKE ? THEN 2         -- Contains Mobile = priority 2
          ELSE 3
        END as priority
      FROM patients 
      WHERE regno LIKE ? OR mobile LIKE ?
      ORDER BY priority ASC, CAST(regno AS INTEGER) ASC
      LIMIT ? OFFSET ?
    `;
    const likeTerm = `%${searchTerm}%`;
    params = [likeTerm, likeTerm, likeTerm, likeTerm, parseInt(limit), parseInt(offset)];

  } else {
    // TEXT SEARCH: Name → Father → Mother → Address
    sql = `
      SELECT *, 
        CASE 
          WHEN name LIKE ? THEN 1           -- Name = priority 1
          WHEN father LIKE ? THEN 2         -- Father = priority 2
          WHEN mother LIKE ? THEN 3         -- Mother = priority 3
          WHEN address LIKE ? THEN 4        -- Address = priority 4
          ELSE 5
        END as priority
      FROM patients 
      WHERE name LIKE ? 
         OR father LIKE ? 
         OR mother LIKE ? 
         OR address LIKE ?
      ORDER BY priority ASC, name ASC
      LIMIT ? OFFSET ?
    `;
    const likeTerm = `%${searchTerm}%`;
    params = [likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, parseInt(limit), parseInt(offset)];
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('❌ Smart search error:', err.message);
      return res.status(500).json({ error: 'Search failed' });
    }

    // Get total count (simplified)
    res.json({
      patients: rows,
      total: rows.length
    });
  });
});

/* ==================================================
   REGULAR SEARCH (Legacy - keeping for compatibility)
================================================== */
router.get('/patients/search', (req, res) => {
  const { q, limit = 10, offset = 0 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json({ patients: [], total: 0 });
  }

  const searchTerm = `%${q.trim()}%`;

  const sql = `
    SELECT * FROM patients 
    WHERE regno LIKE ? 
       OR name LIKE ? 
       OR mobile LIKE ? 
       OR father LIKE ? 
       OR mother LIKE ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit), parseInt(offset)], 
    (err, rows) => {
      if (err) {
        console.error('❌ Search error:', err.message);
        return res.status(500).json({ error: 'Search failed' });
      }

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total FROM patients 
        WHERE regno LIKE ? 
           OR name LIKE ? 
           OR mobile LIKE ? 
           OR father LIKE ? 
           OR mother LIKE ?
      `;

      db.get(countSql, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm], (err, countRow) => {
        if (err) {
          return res.json({ patients: rows, total: rows.length });
        }

        res.json({
          patients: rows,
          total: countRow.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      });
    }
  );
});

/* ==================================================
   GET SINGLE PATIENT
================================================== */
router.get('/patients/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM patients WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error('❌ Error fetching patient:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ patient: row });
  });
});

/* ==================================================
   UPDATE PATIENT
================================================== */
router.put('/patients/:id', (req, res) => {
  const { id } = req.params;
  const { name, dob, gender, father, mother, address, mobile } = req.body;

  // Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!gender) {
    return res.status(400).json({ error: 'Gender is required' });
  }

  if (!address || !address.trim()) {
    return res.status(400).json({ error: 'Address is required' });
  }

  if (!mobile || mobile.length !== 10) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number is required' });
  }

  const sql = `
    UPDATE patients 
    SET name = ?, dob = ?, gender = ?, father = ?, mother = ?, address = ?, mobile = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.run(sql, [
    name.trim().toUpperCase(),
    dob || null,
    gender,
    father?.trim().toUpperCase() || null,
    mother?.trim().toUpperCase() || null,
    address.trim().toUpperCase(),
    mobile,
    id
  ], function(err) {
    if (err) {
      console.error('❌ Update failed:', err.message);
      return res.status(500).json({ error: 'Failed to update patient' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ message: 'Patient updated successfully' });
  });
});

/* ==================================================
   GET LAST REGISTERED PATIENT
================================================== */
router.get('/patients/last/registered', (req, res) => {
  db.get(
    `SELECT * FROM patients ORDER BY created_at DESC LIMIT 1`,
    (err, row) => {
      if (err) {
        console.error('❌ Error fetching last patient:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ patient: row || null });
    }
  );
});

/* ==================================================
   GET QUEUE COUNT (STATS)
================================================== */
router.get('/stats/queue', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  db.get(
    `SELECT COUNT(*) as count FROM op_register 
     WHERE visit_date = ? AND consultation_status = 'waiting'`,
    [today],
    (err, row) => {
      if (err) {
        console.error('❌ Error fetching queue:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ queue_count: row.count || 0 });
    }
  );
});

/* ==================================================
   EXPORT PATIENTS TO CSV
================================================== */
router.get('/export', (req, res) => {
  db.all(`SELECT * FROM patients ORDER BY regno ASC`, (err, rows) => {
    if (err) {
      console.error('❌ Export error:', err.message);
      return res.status(500).json({ error: 'Export failed' });
    }

    // Create CSV content
    const headers = 'RegNo,Name,DOB,Gender,Father,Mother,Address,Mobile\n';
    const csvContent = rows.map(p => 
      `${p.regno},"${p.name}",${p.dob || ''},"${p.gender || ''}","${p.father || ''}","${p.mother || ''}","${p.address || ''}",${p.mobile || ''}`
    ).join('\n');

    const csv = headers + csvContent;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=patients-export.csv');
    res.send(csv);
  });
});

/* ==================================================
   EXPORT ANY TABLE TO CSV
================================================== */
router.get('/export-table/:table', (req, res) => {
  const { table } = req.params;
  
  let sql = '';
  let filename = '';
  let headerMap = null;
  
  if (table === 'patients') {
    sql = `SELECT * FROM patients ORDER BY id DESC`;
    filename = 'patients-export.csv';
    headerMap = {
      headers: 'RegNo,Name,DOB,Gender,Father,Mother,Address,Mobile',
      mapper: (p) => `${p.regno},"${p.name}",${p.dob || ''},"${p.gender || ''}","${p.father || ''}","${p.mother || ''}","${p.address || ''}",${p.mobile || ''}`
    };
  } else if (table === 'op-register') {
    sql = `SELECT op.*, u.full_name as doctor_name FROM op_register op LEFT JOIN users u ON op.doctor_id = u.id ORDER BY op.id DESC`;
    filename = 'op-register-export.csv';
    headerMap = {
      headers: 'OP Number,Visit Date,Visit Time,RegNo,Name,Age,Gender,Mobile,Doctor,Chief Complaints,Consultation Fee,Payment Status',
      mapper: (r) => `${r.op_number},${r.visit_date},${r.visit_time},${r.regno},"${r.name}",${r.age || ''},"${r.gender}",${r.mobile || ''},"${r.doctor_name || ''}","${(r.chief_complaints || '').replace(/"/g, '""')}",${r.consultation_fee || 0},${r.payment_status || ''}`
    };
  } else if (table === 'vaccines') {
    sql = `
      SELECT 
        v.*,
        op.regno, op.name, op.age, op.gender, op.father, op.mother, op.address, op.mobile,
        op.visit_date
      FROM vaccine_register v
      LEFT JOIN op_register op ON v.op_register_id = op.id
      ORDER BY v.id DESC
    `;
    filename = 'vaccines-export.csv';
    headerMap = {
      headers: 'Date,RegNo,Name,Age,Gender,Father,Mother,Address,Mobile,Vaccine Type,Brand,Dose Number,Route,Site,Batch Number,Expiry Date,Next Dose Due',
      mapper: (v) => `${v.administered_date || ''},"${v.regno || ''}","${v.name || ''}",${v.age || ''},"${v.gender || ''}","${v.father || ''}","${v.mother || ''}","${v.address || ''}","${v.mobile || ''}","${v.vaccine_type}","${v.vaccine_brand || ''}",${v.dose_number},"${v.route}","${v.site}","${v.batch_number}","${v.expiry_date}","${v.next_dose_due_date || ''}"`
    };
  } else if (table === 'followup') {
    sql = `
      SELECT 
        f.*,
        op.regno, op.name, op.age, op.gender, op.father, op.mother, op.address, op.mobile,
        op.visit_date
      FROM followup_register f
      LEFT JOIN op_register op ON f.op_register_id = op.id
      ORDER BY f.id DESC
    `;
    filename = 'followup-export.csv';
    headerMap = {
      headers: 'RegNo,Name,Age,Gender,Father,Mother,Address,Mobile,Follow-up Type,Reason,Next Visit Date,Status,Contact Confirmed',
      mapper: (f) => `"${f.regno || ''}","${f.name || ''}",${f.age || ''},"${f.gender || ''}","${f.father || ''}","${f.mother || ''}","${f.address || ''}","${f.mobile || ''}","${f.followup_type}","${(f.followup_reason || '').replace(/"/g, '""')}","${f.next_visit_date}","${f.status}",${f.followup_contact_confirmed ? 'Yes' : 'No'}`
    };
  } else {
    return res.status(400).json({ error: 'Invalid table' });
  }

  db.all(sql, (err, rows) => {
    if (err) {
      console.error('❌ Export error:', err.message);
      return res.status(500).json({ error: 'Export failed' });
    }

    const csv = headerMap.headers + '\n' + rows.map(headerMap.mapper).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv);
  });
});

/* ==================================================
   IMPORT OP REGISTER
================================================== */
router.post('/import-op-register', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: [],
    errors: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rowNum = i + 2;

      // Validate required fields
      if (!r.regno || !r.name || !r.visit_date) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing required fields (regno, name, visit_date)',
          data: r
        });
        continue;
      }

      // Check if patient exists
      const patient = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM patients WHERE regno = ?`, [r.regno], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!patient) {
        results.rejected.push({
          row: rowNum,
          reason: `Patient with RegNo ${r.regno} not found`,
          data: r
        });
        continue;
      }

      // Generate OP number (simplified)
      const opNumber = `OP-${new Date().getFullYear()}-${r.regno}-${Date.now().toString().slice(-4)}`;

      // Insert OP record
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO op_register (
            op_number, op_hash, op_cycle, op_sequence, op_year,
            patient_id, regno, name, age, gender, father, mother, address, mobile,
            visit_date, visit_time, visit_type, chief_complaints,
            doctor_id, consultation_status, consultation_fee, payment_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          opNumber, opNumber, 1, 1, new Date().getFullYear(),
          patient.id, r.regno, r.name.toUpperCase(), r.age || null, r.gender || 'M',
          r.father || '', r.mother || '', r.address || '', r.mobile || '',
          r.visit_date, r.visit_time || '09:00', r.visit_type || 'new',
          r.chief_complaints || '',
          r.doctor_id || 1, 'waiting', r.consultation_fee || 0, r.payment_status || 'pending'
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* ==================================================
   IMPORT VACCINES
================================================== */
router.post('/import-vaccines', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: [],
    errors: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const v = records[i];
      const rowNum = i + 2;

      // Validate required fields
      if (!v.patient_id || !v.vaccine_type || !v.batch_number || !v.expiry_date || !v.administered_date) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing required fields',
          data: v
        });
        continue;
      }

      // Check if patient exists
      const patient = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM patients WHERE id = ? OR regno = ?`, [v.patient_id, v.patient_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!patient) {
        results.rejected.push({
          row: rowNum,
          reason: `Patient ID ${v.patient_id} not found`,
          data: v
        });
        continue;
      }

      // Create dummy OP register entry if needed
      let opRegisterId = v.op_register_id;
      if (!opRegisterId) {
        opRegisterId = await new Promise((resolve, reject) => {
          const opNumber = `OP-${new Date().getFullYear()}-VACC-${Date.now()}`;
          db.run(`
            INSERT INTO op_register (
              op_number, op_hash, op_cycle, op_sequence, op_year,
              patient_id, regno, name, visit_date, visit_time, doctor_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            opNumber, opNumber, 1, 1, new Date().getFullYear(),
            patient.id, v.patient_id, 'VACCINATION', v.administered_date, '09:00', 1
          ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });
      }

      // Insert vaccine record
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO vaccine_register (
            op_register_id, patient_id, vaccine_type, vaccine_brand,
            dose_number, route, site, batch_number, expiry_date,
            administered_date, administered_time, administered_by,
            next_dose_due_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          opRegisterId, patient.id, v.vaccine_type.toUpperCase(),
          v.vaccine_brand?.toUpperCase() || '', v.dose_number || 1,
          v.route || 'IM', v.site || 'Left Arm', v.batch_number, v.expiry_date,
          v.administered_date, v.administered_time || '09:00', v.administered_by || 1,
          v.next_dose_due_date || null
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* ==================================================
   IMPORT FOLLOW-UP
================================================== */
router.post('/import-followup', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: [],
    errors: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const f = records[i];
      const rowNum = i + 2;

      // Validate required fields
      if (!f.patient_id || !f.followup_type || !f.followup_reason || !f.next_visit_date) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing required fields',
          data: f
        });
        continue;
      }

      // Check if patient exists
      const patient = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM patients WHERE id = ? OR regno = ?`, [f.patient_id, f.patient_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!patient) {
        results.rejected.push({
          row: rowNum,
          reason: `Patient ID ${f.patient_id} not found`,
          data: f
        });
        continue;
      }

      // Create dummy OP register entry if needed
      let opRegisterId = f.op_register_id;
      if (!opRegisterId) {
        opRegisterId = await new Promise((resolve, reject) => {
          const opNumber = `OP-${new Date().getFullYear()}-FU-${Date.now()}`;
          db.run(`
            INSERT INTO op_register (
              op_number, op_hash, op_cycle, op_sequence, op_year,
              patient_id, regno, name, visit_date, visit_time, doctor_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            opNumber, opNumber, 1, 1, new Date().getFullYear(),
            patient.id, f.patient_id, 'FOLLOW-UP', new Date().toISOString().split('T')[0], '09:00', 1
          ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });
      }

      // Insert follow-up record
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO followup_register (
            op_register_id, patient_id, followup_type, followup_reason,
            next_visit_date, status, followup_contact_confirmed, advised_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          opRegisterId, patient.id, f.followup_type.toUpperCase(),
          f.followup_reason.toUpperCase(), f.next_visit_date,
          f.status || 'pending', f.followup_contact_confirmed ? 1 : 0,
          f.advised_by || 1
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* ==================================================
   IMPORT FOLLOW-UP
================================================== */
router.post('/import-followup', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: [],
    errors: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const f = records[i];
      const rowNum = i + 2;

      // Validate required fields
      if (!f.patient_id || !f.followup_type || !f.followup_reason || !f.next_visit_date) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing required fields',
          data: f
        });
        continue;
      }

      // Check if patient exists
      const patient = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM patients WHERE id = ? OR regno = ?`, [f.patient_id, f.patient_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!patient) {
        results.rejected.push({
          row: rowNum,
          reason: `Patient ID ${f.patient_id} not found`,
          data: f
        });
        continue;
      }

      // Create dummy OP register entry if needed
      let opRegisterId = f.op_register_id;
      if (!opRegisterId) {
        opRegisterId = await new Promise((resolve, reject) => {
          const opNumber = `OP-${new Date().getFullYear()}-FU-${Date.now()}`;
          db.run(`
            INSERT INTO op_register (
              op_number, op_hash, op_cycle, op_sequence, op_year,
              patient_id, regno, name, visit_date, visit_time, doctor_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            opNumber, opNumber, 1, 1, new Date().getFullYear(),
            patient.id, f.patient_id, 'FOLLOW-UP', new Date().toISOString().split('T')[0], '09:00', 1
          ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });
      }

      // Insert follow-up record
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO followup_register (
            op_register_id, patient_id, followup_type, followup_reason,
            next_visit_date, status, followup_contact_confirmed, advised_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          opRegisterId, patient.id, f.followup_type.toUpperCase(),
          f.followup_reason.toUpperCase(), f.next_visit_date,
          f.status || 'pending', f.followup_contact_confirmed ? 1 : 0,
          f.advised_by || 1
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* ==================================================
   LEGACY IMPORTS - HMS 2.0 DATA MIGRATION
================================================== */

/* Import Legacy OP Register */
router.post('/import-legacy-op', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: [],
    errors: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rowNum = i + 2;

      // Validate required fields
      if (!r.regno || !r.name || !r.visit_date) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing required fields (regno, name, visit_date)',
          data: r
        });
        continue;
      }

      // Check if patient exists
      const patient = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM patients WHERE regno = ?`, [r.regno], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!patient) {
        results.rejected.push({
          row: rowNum,
          reason: `Patient with RegNo ${r.regno} not found`,
          data: r
        });
        continue;
      }

      // Generate new OP number in HMS 3.0 format
      const visitYear = new Date(r.visit_date).getFullYear();
      const timestamp = Date.now().toString().slice(-4);
      const opNumber = `OP-${visitYear}-${r.regno.toString().padStart(4, '0')}-${timestamp}`;

      // Insert OP record
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO op_register (
            op_number, op_hash, op_cycle, op_sequence, op_year,
            legacy_op_number, is_legacy,
            patient_id, regno, name, age, gender, father, mother, address, mobile,
            visit_date, visit_time, visit_type, chief_complaints,
            doctor_id, consultation_status, consultation_fee, payment_status,
            created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          opNumber, opNumber, 1, 1, visitYear,
          r.legacy_op_number || '',  // Store old OP number
          1,  // Mark as legacy
          patient.id, r.regno, r.name.toUpperCase(), r.age || null, r.gender || 'M',
          r.father?.toUpperCase() || '', r.mother?.toUpperCase() || '', 
          r.address?.toUpperCase() || '', r.mobile || '',
          r.visit_date, r.visit_time || '09:00', r.visit_type || 'new',
          r.chief_complaints?.toUpperCase() || '',
          r.doctor_id || 1, 
          'completed',  // Default to completed for legacy
          r.consultation_fee || 0, 
          'paid',  // Default to paid for legacy
          r.created_by || 1
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Legacy OP import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* Import Legacy Vaccines */
router.post('/import-legacy-vaccines', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: [],
    errors: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const v = records[i];
      const rowNum = i + 2;

      // Validate required fields
      if (!v.regno || !v.name || !v.visit_date || !v.vaccine_given) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing required fields (regno, name, visit_date, vaccine_given)',
          data: v
        });
        continue;
      }

      // Insert into legacy table (patient snapshot, not linked to OP)
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO vaccine_register_legacy (
            regno, name, age_sex, father, mother, address, mobile,
            entry_date, visit_date, vaccine_given, next_vaccine, 
            next_vaccine_date, additional_instructions, legacy_sno
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          v.regno,
          v.name.toUpperCase(),
          v.age_sex || '',
          v.father?.toUpperCase() || '',
          v.mother?.toUpperCase() || '',
          v.address?.toUpperCase() || '',
          v.mobile || '',
          v.entry_date || '',
          v.visit_date,
          v.vaccine_given.toUpperCase(),
          v.next_vaccine?.toUpperCase() || '',
          v.next_vaccine_date || null,
          v.additional_instructions?.toUpperCase() || '',
          v.sno || null
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Legacy vaccine import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* Import Legacy Follow-ups */
router.post('/import-legacy-followup', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: [],
    errors: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const f = records[i];
      const rowNum = i + 2;

      // Validate required fields
      if (!f.regno || !f.name || !f.followup_date || !f.followup_reason) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing required fields (regno, name, followup_date, followup_reason)',
          data: f
        });
        continue;
      }

      // Insert into legacy table (patient snapshot, not linked to OP)
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO followup_register_legacy (
            regno, name, age_sex, father, mother, address, mobile,
            entry_date, entry_type, visit_date, followup_date,
            present_complaints, followup_reason, additional_instructions,
            status, log, legacy_sno
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          f.regno,
          f.name.toUpperCase(),
          f.age_sex || '',
          f.father?.toUpperCase() || '',
          f.mother?.toUpperCase() || '',
          f.address?.toUpperCase() || '',
          f.mobile || '',
          f.entry_date || '',
          f.entry_type?.toUpperCase() || '',
          f.visit_date || '',
          f.followup_date,
          f.present_complaints?.toUpperCase() || '',
          f.followup_reason.toUpperCase(),
          f.additional_instructions?.toUpperCase() || '',
          f.status?.toUpperCase() || 'PENDING',
          f.log || '',
          f.sno || null
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Legacy follow-up import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* ==================================================
   LEGACY DATA VIEWER - GET LEGACY VACCINES
================================================== */
router.get('/legacy/vaccines', (req, res) => {
  const { search, sort_by = 'id', sort_order = 'DESC', limit = 20, offset = 0 } = req.query;

  let sql = `SELECT * FROM vaccine_register_legacy WHERE 1=1`;
  const params = [];

  // Search filter
  if (search && search.trim()) {
    sql += ` AND (regno LIKE ? OR name LIKE ? OR mobile_no LIKE ?)`;
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Sort
  const validSortColumns = ['id', 'regno', 'name', 'visit_date'];
  const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'id';
  const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortColumn} ${sortDir}`;

  // Pagination
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('❌ Legacy vaccines fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch legacy records' });
    }

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM vaccine_register_legacy WHERE 1=1`;
    const countParams = [];

    if (search && search.trim()) {
      countSql += ` AND (regno LIKE ? OR name LIKE ? OR mobile_no LIKE ?)`;
      const searchTerm = `%${search.trim()}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    db.get(countSql, countParams, (err, countRow) => {
      if (err) {
        return res.json({ records: rows, total: rows.length });
      }

      res.json({
        records: rows,
        total: countRow.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    });
  });
});

/* ==================================================
   LEGACY DATA VIEWER - GET LEGACY FOLLOW-UPS
================================================== */
router.get('/legacy/followup', (req, res) => {
  const { search, sort_by = 'id', sort_order = 'DESC', limit = 20, offset = 0 } = req.query;

  let sql = `SELECT * FROM followup_register_legacy WHERE 1=1`;
  const params = [];

  // Search filter
  if (search && search.trim()) {
    sql += ` AND (regno LIKE ? OR name LIKE ? OR mobile_no LIKE ?)`;
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Sort
  const validSortColumns = ['id', 'regno', 'name', 'followup_date'];
  const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'id';
  const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortColumn} ${sortDir}`;

  // Pagination
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('❌ Legacy follow-up fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch legacy records' });
    }

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM followup_register_legacy WHERE 1=1`;
    const countParams = [];

    if (search && search.trim()) {
      countSql += ` AND (regno LIKE ? OR name LIKE ? OR mobile_no LIKE ?)`;
      const searchTerm = `%${search.trim()}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    db.get(countSql, countParams, (err, countRow) => {
      if (err) {
        return res.json({ records: rows, total: rows.length });
      }

      res.json({
        records: rows,
        total: countRow.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    });
  });
});

/* ==================================================
   LEGACY DATA VIEWER - GET SINGLE LEGACY RECORD
================================================== */
router.get('/legacy/:type/:id', (req, res) => {
  const { type, id } = req.params;

  if (type === 'vaccine') {
    db.get(`SELECT * FROM vaccine_register_legacy WHERE id = ?`, [id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ record: row });
    });
  } else if (type === 'followup') {
    db.get(`SELECT * FROM followup_register_legacy WHERE id = ?`, [id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ record: row });
    });
  } else {
    res.status(400).json({ error: 'Invalid type' });
  }
});

/* ==================================================
   EXPORT LEGACY DATA TO CSV
================================================== */
router.get('/legacy/export/:type', (req, res) => {
  const { type } = req.params;
  
  let sql = '';
  let filename = '';
  let headers = '';
  let mapper = null;
  
  if (type === 'vaccines') {
    sql = `SELECT * FROM vaccine_register_legacy ORDER BY id DESC`;
    filename = 'legacy-vaccines-export.csv';
    headers = 'S.No,Next Vaccine Date,Entry Date,Reg.No,Name,Age/Sex,Father Name,Mother Name,Address,Mobile No,Visit Date,Vaccine Given,Next Vaccine,Additional Instructions,Imported At';
    mapper = (r) => `${r.s_no || ''},"${r.next_vaccine_date || ''}","${r.entry_date || ''}","${r.regno || ''}","${r.name || ''}","${r.age_sex || ''}","${r.father_name || ''}","${r.mother_name || ''}","${r.address || ''}","${r.mobile_no || ''}","${r.visit_date || ''}","${r.vaccine_given || ''}","${r.next_vaccine || ''}","${(r.additional_instructions || '').replace(/"/g, '""')}","${r.imported_at || ''}"`;
  } else if (type === 'followup') {
    sql = `SELECT * FROM followup_register_legacy ORDER BY id DESC`;
    filename = 'legacy-followup-export.csv';
    headers = 'S.No,Followup Date,Entry Date,Entry Type,Reg.No,Name,Age/Sex,Father Name,Mother Name,Address,Mobile No,Visit Date,Present Complaints,Followup Reason,Additional Instructions,Status,Log,Imported At';
    mapper = (r) => `${r.s_no || ''},"${r.followup_date || ''}","${r.entry_date || ''}","${r.entry_type || ''}","${r.regno || ''}","${r.name || ''}","${r.age_sex || ''}","${r.father_name || ''}","${r.mother_name || ''}","${r.address || ''}","${r.mobile_no || ''}","${r.visit_date || ''}","${(r.present_complaints || '').replace(/"/g, '""')}","${(r.followup_reason || '').replace(/"/g, '""')}","${(r.additional_instructions || '').replace(/"/g, '""')}","${r.status || ''}","${(r.log || '').replace(/"/g, '""')}","${r.imported_at || ''}"`;
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  db.all(sql, (err, rows) => {
    if (err) {
      console.error('❌ Legacy export error:', err.message);
      return res.status(500).json({ error: 'Export failed' });
    }

    const csv = headers + '\n' + rows.map(mapper).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv);
  });
});

/* ==================================================
   IMPORT LEGACY VACCINE REGISTER (HMS 2.0)
================================================== */
router.post('/import-legacy-vaccines', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rowNum = i + 2;

      // Insert into legacy table (all fields as-is)
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO vaccine_register_legacy (
            s_no, next_vaccine_date, entry_date, regno, name, age_sex,
            father_name, mother_name, address, mobile_no, visit_date,
            vaccine_given, next_vaccine, additional_instructions
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          r.s_no || null,
          r.next_vaccine_date || null,
          r.entry_date || null,
          r.regno || null,
          r.name || null,
          r.age_sex || null,
          r.father_name || null,
          r.mother_name || null,
          r.address || null,
          r.mobile_no || null,
          r.visit_date || null,
          r.vaccine_given || null,
          r.next_vaccine || null,
          r.additional_instructions || null
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Legacy vaccine import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* ==================================================
   IMPORT LEGACY FOLLOW-UP REGISTER (HMS 2.0)
================================================== */
router.post('/import-legacy-followup', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rowNum = i + 2;

      // Insert into legacy table (all fields as-is)
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO followup_register_legacy (
            s_no, followup_date, entry_date, entry_type, regno, name, age_sex,
            father_name, mother_name, address, mobile_no, visit_date,
            present_complaints, followup_reason, additional_instructions, status, log
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          r.s_no || null,
          r.followup_date || null,
          r.entry_date || null,
          r.entry_type || null,
          r.regno || null,
          r.name || null,
          r.age_sex || null,
          r.father_name || null,
          r.mother_name || null,
          r.address || null,
          r.mobile_no || null,
          r.visit_date || null,
          r.present_complaints || null,
          r.followup_reason || null,
          r.additional_instructions || null,
          r.status || null,
          r.log || null
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Legacy follow-up import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* ==================================================
   IMPORT LEGACY OP REGISTER (HMS 2.0)
================================================== */
router.post('/import-legacy-op', async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rowNum = i + 2;

      // Validate required fields
      if (!r.regno || !r.name || !r.visit_date) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing required fields (regno, name, visit_date)',
          data: r
        });
        continue;
      }

      // Check if patient exists
      const patient = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM patients WHERE regno = ?`, [r.regno], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!patient) {
        results.rejected.push({
          row: rowNum,
          reason: `Patient with RegNo ${r.regno} not found. Import patients first.`,
          data: r
        });
        continue;
      }

      // Extract year from visit_date
      const visitYear = new Date(r.visit_date).getFullYear();

      // Generate new OP number in HMS 3.0 format
      const opSequence = await new Promise((resolve, reject) => {
        db.get(`
          SELECT COUNT(*) as count 
          FROM op_register 
          WHERE patient_id = ? AND op_year = ?
        `, [patient.id, visitYear], (err, row) => {
          if (err) reject(err);
          else resolve((row.count || 0) + 1);
        });
      });

      const opNumber = `OP-${visitYear}-${String(r.regno).padStart(4, '0')}-${String(opSequence).padStart(2, '0')}`;
      const opHash = opNumber;

      // Parse age/sex if provided
      let age = r.age;
      let gender = r.gender;
      if (r.age_sex && r.age_sex.includes('/')) {
        const parts = r.age_sex.split('/');
        age = parseInt(parts[0]) || null;
        gender = parts[1]?.trim().toUpperCase() || null;
      }

      // Insert OP record
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO op_register (
            op_number, op_hash, op_cycle, op_sequence, op_year, legacy_op_number,
            patient_id, regno, name, age, gender, father, mother, address, mobile,
            visit_date, visit_time, visit_type, chief_complaints,
            doctor_id, consultation_status, consultation_fee, payment_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          opNumber,
          opHash,
          opSequence,
          opSequence,
          visitYear,
          r.legacy_op_number || r.old_op_no || null,
          patient.id,
          r.regno,
          r.name.toUpperCase(),
          age || null,
          gender || 'M',
          r.father?.toUpperCase() || '',
          r.mother?.toUpperCase() || '',
          r.address?.toUpperCase() || '',
          r.mobile || '',
          r.visit_date,
          r.visit_time || '09:00',
          r.visit_type || 'new',
          r.chief_complaints?.toUpperCase() || '',
          r.doctor_id || 1,
          'completed',  // Default for legacy
          'completed',  // Default for legacy (payment_status)
          r.consultation_fee || 0
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Legacy OP import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/* ==================================================
   IMPORT PATIENTS FROM CSV
================================================== */
router.post('/import', async (req, res) => {
  const { patients } = req.body;

  if (!patients || !Array.isArray(patients) || patients.length === 0) {
    return res.status(400).json({ error: 'No patient data provided' });
  }

  const results = {
    imported: 0,
    skipped: [],
    rejected: [],
    new_regnos: []
  };

  try {
    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      const rowNum = i + 2; // +2 because row 1 is header, array starts at 0

      // Validate name
      if (!patient.name || !patient.name.trim()) {
        results.rejected.push({
          row: rowNum,
          reason: 'Missing name',
          data: patient
        });
        continue;
      }

      // Check if regno exists
      if (patient.regno && patient.regno.trim()) {
        const existing = await new Promise((resolve, reject) => {
          db.get(`SELECT id FROM patients WHERE regno = ?`, [patient.regno.trim()], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (existing) {
          results.skipped.push({
            regno: patient.regno,
            name: patient.name,
            reason: 'Duplicate RegNo'
          });
          continue;
        }
      }

      // Get new regno if empty
      const regno = patient.regno && patient.regno.trim() ? patient.regno.trim() : await getNextRegNo();
      
      if (!patient.regno || !patient.regno.trim()) {
        results.new_regnos.push({
          name: patient.name,
          new_regno: regno
        });
      }

      // Insert patient
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO patients (regno, name, dob, gender, father, mother, address, mobile)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          regno,
          patient.name.trim().toUpperCase(),
          patient.dob || null,
          patient.gender?.toUpperCase() || null,
          patient.father?.trim().toUpperCase() || null,
          patient.mother?.trim().toUpperCase() || null,
          patient.address?.trim().toUpperCase() || null,
          patient.mobile || null
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      results.imported++;
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

module.exports = router;

/* ==================================================
   RECORDS VIEWER - GET PATIENTS WITH FILTERS
================================================== */
router.get('/records/patients', (req, res) => {
  const { date, date_from, date_to, search, sort_by = 'id', sort_order = 'DESC', limit = 20, offset = 0 } = req.query;

  let sql = `SELECT * FROM patients WHERE 1=1`;
  const params = [];

  // Date filters
  if (date === 'today') {
    sql += ` AND DATE(created_at) = DATE('now')`;
  } else if (date === 'yesterday') {
    sql += ` AND DATE(created_at) = DATE('now', '-1 day')`;
  } else if (date === 'last7days') {
    sql += ` AND DATE(created_at) >= DATE('now', '-7 days')`;
  } else if (date === 'last30days') {
    sql += ` AND DATE(created_at) >= DATE('now', '-30 days')`;
  } else if (date_from && date_to) {
    sql += ` AND DATE(created_at) BETWEEN ? AND ?`;
    params.push(date_from, date_to);
  }

  // Search filter
  if (search && search.trim()) {
    sql += ` AND (regno LIKE ? OR name LIKE ? OR mobile LIKE ?)`;
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Sort
  const validSortColumns = ['id', 'regno', 'name', 'created_at'];
  let sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'id';
  
  // Cast regno to INTEGER for numerical sorting
  if (sortColumn === 'regno') {
    sortColumn = 'CAST(regno AS INTEGER)';
  }
  
  const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortColumn} ${sortDir}`;

  // Pagination
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('❌ Records fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch records' });
    }

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM patients WHERE 1=1`;
    const countParams = [];

    if (date === 'today') {
      countSql += ` AND DATE(created_at) = DATE('now')`;
    } else if (date === 'yesterday') {
      countSql += ` AND DATE(created_at) = DATE('now', '-1 day')`;
    } else if (date === 'last7days') {
      countSql += ` AND DATE(created_at) >= DATE('now', '-7 days')`;
    } else if (date === 'last30days') {
      countSql += ` AND DATE(created_at) >= DATE('now', '-30 days')`;
    } else if (date_from && date_to) {
      countSql += ` AND DATE(created_at) BETWEEN ? AND ?`;
      countParams.push(date_from, date_to);
    }

    if (search && search.trim()) {
      countSql += ` AND (regno LIKE ? OR name LIKE ? OR mobile LIKE ?)`;
      const searchTerm = `%${search.trim()}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    db.get(countSql, countParams, (err, countRow) => {
      if (err) {
        return res.json({ records: rows, total: rows.length });
      }

      res.json({
        records: rows,
        total: countRow.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    });
  });
});

/* ==================================================
   RECORDS VIEWER - GET OP REGISTER WITH FILTERS
================================================== */
router.get('/records/op-register', (req, res) => {
  const { date, date_from, date_to, search, doctor, chief_complaints, sort_by = 'id', sort_order = 'DESC', limit = 20, offset = 0 } = req.query;

  let sql = `
    SELECT 
      op.*, 
      u.full_name as doctor_name
    FROM op_register op
    LEFT JOIN users u ON op.doctor_id = u.id
    WHERE 1=1
  `;
  const params = [];

  // Date filters
  if (date === 'today') {
    sql += ` AND DATE(op.visit_date) = DATE('now')`;
  } else if (date === 'yesterday') {
    sql += ` AND DATE(op.visit_date) = DATE('now', '-1 day')`;
  } else if (date === 'last7days') {
    sql += ` AND DATE(op.visit_date) >= DATE('now', '-7 days')`;
  } else if (date === 'last30days') {
    sql += ` AND DATE(op.visit_date) >= DATE('now', '-30 days')`;
  } else if (date_from && date_to) {
    sql += ` AND DATE(op.visit_date) BETWEEN ? AND ?`;
    params.push(date_from, date_to);
  }

  // Search filter
  if (search && search.trim()) {
    sql += ` AND (op.regno LIKE ? OR op.name LIKE ? OR op.mobile LIKE ? OR op.op_number LIKE ?)`;
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  // Doctor filter
  if (doctor) {
    sql += ` AND op.doctor_id = ?`;
    params.push(parseInt(doctor));
  }

  // Chief complaints filter
  if (chief_complaints && chief_complaints.trim()) {
    sql += ` AND op.chief_complaints LIKE ?`;
    params.push(`%${chief_complaints.trim()}%`);
  }

  // Sort
  const validSortColumns = ['id', 'op_number', 'visit_date', 'name', 'regno'];
  const sortColumn = validSortColumns.includes(sort_by) ? `op.${sort_by}` : 'op.id';
  const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortColumn} ${sortDir}`;

  // Pagination
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('❌ OP records fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch OP records' });
    }

    // Get total count (simplified - same filters without pagination)
    res.json({
      records: rows,
      total: rows.length, // Simplified for now
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  });
});

/* ==================================================
   RECORDS VIEWER - GET VACCINE REGISTER WITH FILTERS (GROUPED)
================================================== */
router.get('/records/vaccines', (req, res) => {
  const { date, date_from, date_to, search, vaccine_brand, sort_by = 'op_register_id', sort_order = 'DESC', limit = 20, offset = 0 } = req.query;

  let sql = `
    SELECT 
      vr.op_register_id,
      vr.patient_id,
      op.regno,
      op.name,
      op.age,
      op.visit_date as administered_date,
      GROUP_CONCAT(vr.vaccine_type, ', ') as vaccines_given,
      COUNT(*) as vaccine_count,
      CASE 
        WHEN COUNT(*) > 1 THEN 'Multiple'
        ELSE MAX(vr.batch_number)
      END as batch_display,
      MIN(vr.next_dose_due_date) as next_dose_due
    FROM vaccine_register vr
    LEFT JOIN op_register op ON vr.op_register_id = op.id
    WHERE 1=1
  `;
  const params = [];

  // Date filters
  if (date === 'today') {
    sql += ` AND DATE(vr.administered_date) = DATE('now')`;
  } else if (date === 'yesterday') {
    sql += ` AND DATE(vr.administered_date) = DATE('now', '-1 day')`;
  } else if (date === 'last7days') {
    sql += ` AND DATE(vr.administered_date) >= DATE('now', '-7 days')`;
  } else if (date === 'last30days') {
    sql += ` AND DATE(vr.administered_date) >= DATE('now', '-30 days')`;
  } else if (date_from && date_to) {
    sql += ` AND DATE(vr.administered_date) BETWEEN ? AND ?`;
    params.push(date_from, date_to);
  }

  // Search filter
  if (search && search.trim()) {
    sql += ` AND (op.regno LIKE ? OR op.name LIKE ? OR op.mobile LIKE ?)`;
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Vaccine brand filter
  if (vaccine_brand && vaccine_brand.trim()) {
    sql += ` AND vr.op_register_id IN (
      SELECT DISTINCT op_register_id FROM vaccine_register WHERE vaccine_brand LIKE ?
    )`;
    params.push(`%${vaccine_brand.trim()}%`);
  }

  sql += ` GROUP BY vr.op_register_id`;

  // Sort
  const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  sql += ` ORDER BY vr.op_register_id ${sortDir}`;

  // Pagination
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('❌ Vaccine records fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch vaccine records' });
    }

    res.json({
      records: rows,
      total: rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  });
});

/* ==================================================
   RECORDS VIEWER - GET FOLLOW-UP REGISTER WITH FILTERS
================================================== */
router.get('/records/followup', (req, res) => {
  const { date, date_from, date_to, search, followup_reason, sort_by = 'id', sort_order = 'DESC', limit = 20, offset = 0 } = req.query;

  let sql = `
    SELECT 
      fr.*,
      op.regno,
      op.name,
      op.age,
      u.full_name as advised_by_name
    FROM followup_register fr
    LEFT JOIN op_register op ON fr.op_register_id = op.id
    LEFT JOIN users u ON fr.advised_by = u.id
    WHERE 1=1
  `;
  const params = [];

  // Date filters (on next_visit_date)
  if (date === 'today') {
    sql += ` AND DATE(fr.next_visit_date) = DATE('now')`;
  } else if (date === 'yesterday') {
    sql += ` AND DATE(fr.next_visit_date) = DATE('now', '-1 day')`;
  } else if (date === 'last7days') {
    sql += ` AND DATE(fr.next_visit_date) >= DATE('now', '-7 days')`;
  } else if (date === 'last30days') {
    sql += ` AND DATE(fr.next_visit_date) >= DATE('now', '-30 days')`;
  } else if (date_from && date_to) {
    sql += ` AND DATE(fr.next_visit_date) BETWEEN ? AND ?`;
    params.push(date_from, date_to);
  }

  // Search filter
  if (search && search.trim()) {
    sql += ` AND (op.regno LIKE ? OR op.name LIKE ? OR op.mobile LIKE ?)`;
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Follow-up reason filter
  if (followup_reason && followup_reason.trim()) {
    sql += ` AND fr.followup_reason LIKE ?`;
    params.push(`%${followup_reason.trim()}%`);
  }

  // Sort
  const validSortColumns = ['id', 'next_visit_date', 'regno', 'name'];
  const sortColumn = validSortColumns.includes(sort_by) ? (sort_by === 'regno' || sort_by === 'name' ? `op.${sort_by}` : `fr.${sort_by}`) : 'fr.id';
  const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortColumn} ${sortDir}`;

  // Pagination
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('❌ Follow-up records fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch follow-up records' });
    }

    res.json({
      records: rows,
      total: rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  });
});

/* ==================================================
   GET SINGLE RECORD DETAILS (FOR MODAL)
================================================== */
router.get('/records/:type/:id', (req, res) => {
  const { type, id } = req.params;

  if (type === 'patient') {
    db.get(`SELECT * FROM patients WHERE id = ?`, [id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ record: row });
    });
  } else if (type === 'op') {
    db.get(`
      SELECT op.*, u.full_name as doctor_name, u2.full_name as created_by_name
      FROM op_register op
      LEFT JOIN users u ON op.doctor_id = u.id
      LEFT JOIN users u2 ON op.created_by = u2.id
      WHERE op.id = ?
    `, [id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ record: row });
    });
  } else if (type === 'vaccine') {
    // Get all vaccines for this op_register_id
    db.all(`
      SELECT vr.*, u.full_name as administered_by_name
      FROM vaccine_register vr
      LEFT JOIN users u ON vr.administered_by = u.id
      WHERE vr.op_register_id = ?
      ORDER BY vr.id
    `, [id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      // Also get patient info
      if (rows.length > 0) {
        db.get(`SELECT regno, name, age FROM op_register WHERE id = ?`, [id], (err, patient) => {
          res.json({ records: rows, patient: patient });
        });
      } else {
        res.json({ records: rows, patient: null });
      }
    });
  } else if (type === 'followup') {
    db.get(`
      SELECT fr.*, op.regno, op.name, op.age, u.full_name as advised_by_name
      FROM followup_register fr
      LEFT JOIN op_register op ON fr.op_register_id = op.id
      LEFT JOIN users u ON fr.advised_by = u.id
      WHERE fr.id = ?
    `, [id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ record: row });
    });
  } else {
    res.status(400).json({ error: 'Invalid type' });
  }
});

/* ==================================================
   GET DOCTORS LIST (FOR FILTER DROPDOWN)
================================================== */
router.get('/doctors-list', (req, res) => {
  db.all(`SELECT id, full_name FROM users WHERE role = 'doctor' AND is_active = 1 ORDER BY full_name`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ doctors: rows });
  });
});

/* ==================================================
   OPD ENTRY ROUTES
   Add these routes to backend/routes/reception.js
================================================== */

/* ==================================================
   GENERATE OP NUMBER (Using hash-based system)
================================================== */
function generateOPNumber() {
  return new Promise((resolve, reject) => {
    // Get current date components
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Create hash from date (YYYYMMDD → base36)
    const dateStr = `${year}${month}${day}`;
    const hash = parseInt(dateStr).toString(36).toUpperCase();
    
    // Get the max sequence for today
    const sql = `
      SELECT MAX(op_sequence) as max_seq 
      FROM op_register 
      WHERE op_hash = ? AND op_year = ?
    `;
    
    db.get(sql, [hash, year], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      const sequence = (row && row.max_seq) ? row.max_seq + 1 : 1;
      const opNumber = `${hash}${String(sequence).padStart(4, '0')}`;
      
      resolve({
        op_number: opNumber,
        op_hash: hash,
        op_cycle: 1, // Can be used for yearly cycles if needed
        op_sequence: sequence,
        op_year: year
      });
    });
  });
}

/* ==================================================
   CREATE OPD ENTRY
================================================== */
router.post('/opd/entry', async (req, res) => {
  const {
    patient_id,
    visit_type,
    doctor_id,
    vitals_bp,
    vitals_temp,
    vitals_pulse,
    vitals_rr,
    vitals_spo2,
    vitals_weight,
    vitals_height,
    vitals_hc,
    vitals_muac,
    chief_complaints,
    previous_complaints,
    consultation_fee,
    payment_status
  } = req.body;

  // Validation
  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  if (!doctor_id) {
    return res.status(400).json({ error: 'Doctor is required' });
  }

  try {
    // Get patient details
    const patient = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM patients WHERE id = ?', [patient_id], (err, row) => {
        if (err) reject(err);
        else if (!row) reject(new Error('Patient not found'));
        else resolve(row);
      });
    });

    // Generate OP Number
    const opData = await generateOPNumber();

    // Get current date and time
    const now = new Date();
    const visitDate = now.toISOString().split('T')[0];
    const visitTime = now.toTimeString().split(' ')[0];

    // Calculate age from DOB
    let age = null;
    if (patient.dob) {
      const birthDate = new Date(patient.dob);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Insert OP entry
    const sql = `
      INSERT INTO op_register (
        op_number, op_hash, op_cycle, op_sequence, op_year,
        patient_id, regno, name, age, gender, father, mother, address, mobile,
        visit_date, visit_time, visit_type,
        vitals_bp, vitals_temp, vitals_pulse, vitals_rr, vitals_spo2,
        vitals_weight, vitals_height, vitals_hc, vitals_muac,
        chief_complaints, previous_complaints,
        doctor_id, consultation_status, consultation_fee, payment_status,
        created_by
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?
      )
    `;

    const params = [
      opData.op_number, opData.op_hash, opData.op_cycle, opData.op_sequence, opData.op_year,
      patient_id, patient.regno, patient.name, age, patient.gender,
      patient.father, patient.mother, patient.address, patient.mobile,
      visitDate, visitTime, visit_type || 'new',
      vitals_bp, vitals_temp, vitals_pulse, vitals_rr, vitals_spo2,
      vitals_weight, vitals_height, vitals_hc, vitals_muac,
      chief_complaints, previous_complaints,
      doctor_id, 'waiting', consultation_fee || 0, payment_status || 'pending',
      req.session.user.id
    ];

    db.run(sql, params, function(err) {
      if (err) {
        console.error('❌ OPD entry creation failed:', err.message);
        return res.status(500).json({ error: 'Failed to create OPD entry' });
      }

      res.json({
        message: 'OPD entry created successfully',
        op_register_id: this.lastID,
        op_number: opData.op_number
      });
    });

  } catch (error) {
    console.error('❌ OPD entry error:', error);
    res.status(500).json({ error: error.message || 'Failed to create OPD entry' });
  }
});

/* ==================================================
   GET PATIENT OPD HISTORY
================================================== */
router.get('/opd/patient-history/:patient_id', (req, res) => {
  const { patient_id } = req.params;
  const { limit = 10 } = req.query;

  const sql = `
    SELECT 
      op.*,
      u.full_name as doctor_name
    FROM op_register op
    LEFT JOIN users u ON op.doctor_id = u.id
    WHERE op.patient_id = ?
    ORDER BY op.visit_date DESC, op.visit_time DESC
    LIMIT ?
  `;

  db.all(sql, [patient_id, parseInt(limit)], (err, rows) => {
    if (err) {
      console.error('❌ Patient history error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch patient history' });
    }

    res.json({ visits: rows });
  });
});

/* ==================================================
   GET TODAY'S OPD STATS
================================================== */
router.get('/opd/today-stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN visit_type = 'new' THEN 1 ELSE 0 END) as new,
      SUM(CASE WHEN visit_type IN ('followup', 'review') THEN 1 ELSE 0 END) as followup,
      SUM(CASE WHEN consultation_status = 'waiting' THEN 1 ELSE 0 END) as waiting
    FROM op_register
    WHERE DATE(visit_date) = ?
  `;

  db.get(sql, [today], (err, row) => {
    if (err) {
      console.error('❌ Stats error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    res.json({ 
      stats: {
        total: row.total || 0,
        new: row.new || 0,
        followup: row.followup || 0,
        waiting: row.waiting || 0
      }
    });
  });
});


/* ==================================================
   GENERATE OP NUMBER (Year-Hash-Cycle format)
================================================== */
function generateOPNumber() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const year = now.getFullYear();
    
    // Get max sequence for this year
    const sql = `
      SELECT MAX(op_sequence) as max_seq 
      FROM op_register 
      WHERE op_year = ?
    `;
    
    db.get(sql, [year], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      const sequence = (row && row.max_seq) ? row.max_seq + 1 : 1;
      
      // Generate 4-character hash from sequence (base36)
      const hash = sequence.toString(36).toUpperCase().padStart(4, '0');
      
      // Calculate cycle (1-100, loops continuously)
      const cycle = ((sequence - 1) % 100) + 1;
      const cycleDisplay = cycle === 100 ? '00' : cycle.toString().padStart(2, '0');
      
      // Format: YEAR-HASH-CYCLE (e.g., 2026-0001-01)
      const opNumber = `${year}-${hash}-${cycleDisplay}`;
      
      resolve({
        op_number: opNumber,
        op_hash: hash,
        op_cycle: cycle,
        op_sequence: sequence,
        op_year: year
      });
    });
  });
}

/* ==================================================
   GET DOCTOR SETTINGS
================================================== */
router.get('/doctors/:id/settings', (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT 
      id,
      full_name,
      consultation_fee,
      review_days,
      review_count,
      emergency_surcharge
    FROM users 
    WHERE id = ? AND role = 'doctor' AND is_active = 1
  `;
  
  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error('❌ Error fetching doctor settings:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    res.json({ doctor: row });
  });
});

/* ==================================================
   CHECK REVIEW ELIGIBILITY
================================================== */
router.get('/patients/:patient_id/review-eligibility/:doctor_id', (req, res) => {
  const { patient_id, doctor_id } = req.params;
  
  // Get last 'new' visit with this doctor
  const sql = `
    SELECT 
      id,
      visit_date,
      visit_time
    FROM op_register
    WHERE patient_id = ? 
      AND doctor_id = ? 
      AND visit_type = 'new'
    ORDER BY visit_date DESC, visit_time DESC
    LIMIT 1
  `;
  
  db.get(sql, [patient_id, doctor_id], (err, lastNewVisit) => {
    if (err) {
      console.error('❌ Error checking review eligibility:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!lastNewVisit) {
      return res.json({
        eligible: false,
        reason: 'No previous visits',
        reviews_used: 0,
        days_remaining: 0
      });
    }
    
    // Get doctor's review settings
    db.get('SELECT review_days, review_count FROM users WHERE id = ?', [doctor_id], (err, doctor) => {
      if (err || !doctor) {
        return res.json({ eligible: false, reason: 'Doctor settings not found' });
      }
      
      // Calculate days since last new visit
      const lastVisitDate = new Date(lastNewVisit.visit_date);
      const today = new Date();
      const daysSince = Math.floor((today - lastVisitDate) / (1000 * 60 * 60 * 24));
      
      // Count review visits after that new visit
      const countSql = `
        SELECT COUNT(*) as count
        FROM op_register
        WHERE patient_id = ?
          AND doctor_id = ?
          AND visit_type = 'review'
          AND visit_date >= ?
      `;
      
      db.get(countSql, [patient_id, doctor_id, lastNewVisit.visit_date], (err, countRow) => {
        if (err) {
          return res.json({ eligible: false, reason: 'Error counting reviews' });
        }
        
        const reviewsUsed = countRow.count || 0;
        const daysRemaining = doctor.review_days - daysSince;
        
        // Check eligibility
        const eligible = daysSince <= doctor.review_days && reviewsUsed < doctor.review_count;
        
        res.json({
          eligible: eligible,
          reviews_used: reviewsUsed,
          reviews_allowed: doctor.review_count,
          days_remaining: daysRemaining > 0 ? daysRemaining : 0,
          days_allowed: doctor.review_days,
          last_new_visit_date: lastNewVisit.visit_date,
          reason: !eligible ? (daysSince > doctor.review_days ? 'Review period expired' : 'Review limit reached') : null
        });
      });
    });
  });
});

/* ==================================================
   GET ALL COMPLAINTS
================================================== */
router.get('/complaints', (req, res) => {
  const sql = `
    SELECT id, complaint_text 
    FROM complaints_master 
    ORDER BY complaint_text ASC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('❌ Error fetching complaints:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ complaints: rows || [] });
  });
});

/* ==================================================
   ADD NEW COMPLAINT
================================================== */
router.post('/complaints', (req, res) => {
  const { complaint_text } = req.body;
  
  if (!complaint_text || !complaint_text.trim()) {
    return res.status(400).json({ error: 'Complaint text is required' });
  }
  
  const text = complaint_text.trim().toUpperCase();
  
  const sql = `
    INSERT INTO complaints_master (complaint_text, created_by)
    VALUES (?, ?)
  `;
  
  db.run(sql, [text, req.session.user.id], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'This complaint already exists' });
      }
      console.error('❌ Error adding complaint:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      message: 'Complaint added successfully',
      complaint: {
        id: this.lastID,
        complaint_text: text
      }
    });
  });
});

/* ==================================================
   CREATE OPD ENTRY (WITH TRANSACTION)
================================================== */
router.post('/opd/entry', async (req, res) => {
  const {
    patient_id,
    visit_type,
    doctor_id,
    vitals_bp,
    vitals_temp,
    vitals_pulse,
    vitals_rr,
    vitals_spo2,
    vitals_weight,
    vitals_height,
    vitals_hc,
    vitals_muac,
    chief_complaints,
    previous_complaints,
    consultation_fee,
    payment_method,
    paid_amount,
    override_fee
  } = req.body;

  // Validation
  if (!patient_id) {
    return res.status(400).json({ error: 'Patient is required' });
  }

  if (!doctor_id) {
    return res.status(400).json({ error: 'Doctor is required' });
  }

  if (!visit_type) {
    return res.status(400).json({ error: 'Visit type is required' });
  }

  if (!chief_complaints || !chief_complaints.trim()) {
    return res.status(400).json({ error: 'At least one complaint is required' });
  }

  try {
    // Get patient details
    const patient = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM patients WHERE id = ?', [patient_id], (err, row) => {
        if (err) reject(err);
        else if (!row) reject(new Error('Patient not found'));
        else resolve(row);
      });
    });

    // Generate OP Number
    const opData = await generateOPNumber();

    // Get current date and time
    const now = new Date();
    const visitDate = now.toISOString().split('T')[0];
    const visitTime = now.toTimeString().split(' ')[0];

    // Calculate age from DOB
    let age = null;
    if (patient.dob) {
      const birthDate = new Date(patient.dob);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Calculate final fee (use override if provided, otherwise use consultation_fee)
    const finalFee = override_fee !== null && override_fee !== undefined ? parseFloat(override_fee) : parseFloat(consultation_fee || 0);
    const paidAmt = parseFloat(paid_amount || 0);
    const balanceAmt = finalFee - paidAmt;

    // Determine payment status
    let paymentStatus = 'pending';
    if (paidAmt >= finalFee && finalFee > 0) {
      paymentStatus = 'paid';
    } else if (paidAmt > 0 && paidAmt < finalFee) {
      paymentStatus = 'partial';
    }

    // BEGIN TRANSACTION
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('❌ Transaction begin error:', err.message);
          return res.status(500).json({ error: 'Transaction error' });
        }

        // Insert OP entry
        const opSql = `
          INSERT INTO op_register (
            op_number, op_hash, op_cycle, op_sequence, op_year,
            patient_id, regno, name, age, gender, father, mother, address, mobile,
            visit_date, visit_time, visit_type,
            vitals_bp, vitals_temp, vitals_pulse, vitals_rr, vitals_spo2,
            vitals_weight, vitals_height, vitals_hc, vitals_muac,
            chief_complaints, previous_complaints,
            doctor_id, consultation_status, consultation_fee, payment_status, payment_method,
            created_by
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?,
            ?
          )
        `;

        const opParams = [
          opData.op_number, opData.op_hash, opData.op_cycle, opData.op_sequence, opData.op_year,
          patient_id, patient.regno, patient.name, age, patient.gender,
          patient.father, patient.mother, patient.address, patient.mobile,
          visitDate, visitTime, visit_type,
          vitals_bp, vitals_temp, vitals_pulse, vitals_rr, vitals_spo2,
          vitals_weight, vitals_height, vitals_hc, vitals_muac,
          chief_complaints, previous_complaints,
          doctor_id, 'waiting', finalFee, paymentStatus, payment_method,
          req.session.user.id
        ];

        db.run(opSql, opParams, function(opErr) {
          if (opErr) {
            console.error('❌ OP entry creation failed:', opErr.message);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to create OPD entry. Please try again.' });
          }

          const opRegisterId = this.lastID;

          // Insert payment record if amount > 0
          if (finalFee > 0) {
            const paymentSql = `
              INSERT INTO payments (
                reference_type, reference_id, amount,
                payment_method, payment_status,
                paid_amount, balance_amount, payment_date,
                created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const paymentParams = [
              'opd',
              opRegisterId,
              finalFee,
              payment_method || null,
              paymentStatus,
              paidAmt,
              balanceAmt,
              paymentStatus !== 'pending' ? visitDate : null,
              req.session.user.id
            ];

            db.run(paymentSql, paymentParams, function(payErr) {
              if (payErr) {
                console.error('❌ Payment creation failed:', payErr.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Payment processing failed. Please make entry again.' });
              }

              // COMMIT TRANSACTION
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  console.error('❌ Transaction commit error:', commitErr.message);
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Transaction error. Please try again.' });
                }

                res.json({
                  message: 'OPD entry created successfully',
                  op_register_id: opRegisterId,
                  op_number: opData.op_number,
                  payment_id: this.lastID
                });
              });
            });
          } else {
            // No payment needed (free review or zero fee)
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('❌ Transaction commit error:', commitErr.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Transaction error. Please try again.' });
              }

              res.json({
                message: 'OPD entry created successfully',
                op_register_id: opRegisterId,
                op_number: opData.op_number
              });
            });
          }
        });
      });
    });

  } catch (error) {
    console.error('❌ OPD entry error:', error);
    res.status(500).json({ error: error.message || 'Failed to create OPD entry' });
  }
});

/* ==================================================
   GET PATIENT OPD HISTORY
================================================== */
router.get('/opd/patient-history/:patient_id', (req, res) => {
  const { patient_id } = req.params;
  const { limit = 10 } = req.query;

  const sql = `
    SELECT 
      op.*,
      u.full_name as doctor_name
    FROM op_register op
    LEFT JOIN users u ON op.doctor_id = u.id
    WHERE op.patient_id = ?
    ORDER BY op.visit_date DESC, op.visit_time DESC
    LIMIT ?
  `;

  db.all(sql, [patient_id, parseInt(limit)], (err, rows) => {
    if (err) {
      console.error('❌ Patient history error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch patient history' });
    }

    res.json({ visits: rows || [] });
  });
});

/* ==================================================
   GET TODAY'S OPD STATS
================================================== */
router.get('/opd/today-stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN visit_type = 'new' THEN 1 ELSE 0 END) as new,
      SUM(CASE WHEN visit_type IN ('review') THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN visit_type = 'emergency' THEN 1 ELSE 0 END) as emergency,
      SUM(CASE WHEN consultation_status = 'waiting' THEN 1 ELSE 0 END) as waiting
    FROM op_register
    WHERE DATE(visit_date) = ?
  `;

  db.get(sql, [today], (err, row) => {
    if (err) {
      console.error('❌ Stats error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    res.json({ 
      stats: {
        total: row.total || 0,
        new: row.new || 0,
        review: row.review || 0,
        emergency: row.emergency || 0,
        waiting: row.waiting || 0
      }
    });
  });
});

/* =========================================================
   BACKEND ROUTES - UPDATES FOR MODAL-BASED OPD
   Add these modifications to backend/routes/reception.js
========================================================= */

/* ==================================================
   NEW ENDPOINT: Review Eligibility (Last 5 Days)
   
   This replaces the patient-specific check and returns
   the LAST doctor the patient visited in the last 5 days
================================================== */

router.get('/patients/:patient_id/review-eligibility-last-5-days', (req, res) => {
  const { patient_id } = req.params;
  
  // Get last 'new' visit within last 5 days
  const sql = `
    SELECT 
      op.id,
      op.visit_date,
      op.doctor_id,
      op.chief_complaints,
      u.full_name as doctor_name,
      u.review_days,
      u.review_count
    FROM op_register op
    JOIN users u ON op.doctor_id = u.id
    WHERE op.patient_id = ? 
      AND op.visit_type = 'new'
      AND DATE(op.visit_date) >= DATE('now', '-5 days')
    ORDER BY op.visit_date DESC, op.visit_time DESC
    LIMIT 1
  `;
  
  db.get(sql, [patient_id], (err, lastNewVisit) => {
    if (err) {
      console.error('❌ Error checking review eligibility:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!lastNewVisit) {
      return res.json({
        eligible: false,
        reason: 'No paid visit in last 5 days'
      });
    }
    
    // Calculate days since last new visit
    const lastVisitDate = new Date(lastNewVisit.visit_date);
    const today = new Date();
    const daysSince = Math.floor((today - lastVisitDate) / (1000 * 60 * 60 * 24));
    
    // Count review visits after that new visit
    const countSql = `
      SELECT COUNT(*) as count
      FROM op_register
      WHERE patient_id = ?
        AND doctor_id = ?
        AND visit_type = 'review'
        AND visit_date >= ?
    `;
    
    db.get(countSql, [patient_id, lastNewVisit.doctor_id, lastNewVisit.visit_date], (err, countRow) => {
      if (err) {
        return res.json({ eligible: false, reason: 'Error counting reviews' });
      }
      
      const reviewsUsed = countRow.count || 0;
      const daysRemaining = lastNewVisit.review_days - daysSince;
      
      // Check eligibility
      const eligible = daysSince <= lastNewVisit.review_days && reviewsUsed < lastNewVisit.review_count;
      
      res.json({
        eligible: eligible,
        doctor_id: lastNewVisit.doctor_id,
        doctor_name: lastNewVisit.doctor_name,
        reviews_used: reviewsUsed,
        reviews_allowed: lastNewVisit.review_count,
        days_remaining: daysRemaining > 0 ? daysRemaining : 0,
        days_allowed: lastNewVisit.review_days,
        last_new_visit: {
          visit_date: lastNewVisit.visit_date,
          complaints: lastNewVisit.chief_complaints
        },
        reason: !eligible ? (daysSince > lastNewVisit.review_days ? 'Review period expired' : 'Review limit reached') : null
      });
    });
  });
});

/* ==================================================
   MODIFIED ENDPOINT: Review Eligibility (Original - Keep for compatibility)
   
   This is the patient + doctor specific check
================================================== */

router.get('/patients/:patient_id/review-eligibility/:doctor_id', (req, res) => {
  const { patient_id, doctor_id } = req.params;
  
  // Get last 'new' visit with this doctor in last 5 days
  const sql = `
    SELECT 
      id,
      visit_date,
      visit_time,
      chief_complaints
    FROM op_register
    WHERE patient_id = ? 
      AND doctor_id = ? 
      AND visit_type = 'new'
      AND DATE(visit_date) >= DATE('now', '-5 days')
    ORDER BY visit_date DESC, visit_time DESC
    LIMIT 1
  `;
  
  db.get(sql, [patient_id, doctor_id], (err, lastNewVisit) => {
    if (err) {
      console.error('❌ Error checking review eligibility:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!lastNewVisit) {
      return res.json({
        eligible: false,
        reason: 'No paid visit with this doctor in last 5 days',
        reviews_used: 0,
        days_remaining: 0
      });
    }
    
    // Get doctor's review settings
    db.get('SELECT review_days, review_count FROM users WHERE id = ?', [doctor_id], (err, doctor) => {
      if (err || !doctor) {
        return res.json({ eligible: false, reason: 'Doctor settings not found' });
      }
      
      // Calculate days since last new visit
      const lastVisitDate = new Date(lastNewVisit.visit_date);
      const today = new Date();
      const daysSince = Math.floor((today - lastVisitDate) / (1000 * 60 * 60 * 24));
      
      // Count review visits after that new visit
      const countSql = `
        SELECT COUNT(*) as count
        FROM op_register
        WHERE patient_id = ?
          AND doctor_id = ?
          AND visit_type = 'review'
          AND visit_date >= ?
      `;
      
      db.get(countSql, [patient_id, doctor_id, lastNewVisit.visit_date], (err, countRow) => {
        if (err) {
          return res.json({ eligible: false, reason: 'Error counting reviews' });
        }
        
        const reviewsUsed = countRow.count || 0;
        const daysRemaining = doctor.review_days - daysSince;
        
        // Check eligibility
        const eligible = daysSince <= doctor.review_days && reviewsUsed < doctor.review_count;
        
        res.json({
          eligible: eligible,
          reviews_used: reviewsUsed,
          reviews_allowed: doctor.review_count,
          days_remaining: daysRemaining > 0 ? daysRemaining : 0,
          days_allowed: doctor.review_days,
          last_new_visit: {
            visit_date: lastNewVisit.visit_date,
            complaints: lastNewVisit.chief_complaints
          },
          reason: !eligible ? (daysSince > doctor.review_days ? 'Review period expired' : 'Review limit reached') : null
        });
      });
    });
  });
});

/* ==================================================
   NOTES FOR INTEGRATION:
   
   1. Add the new endpoint: /patients/:patient_id/review-eligibility-last-5-days
   2. Update the existing endpoint to use 5-day check instead of all history
   3. Both endpoints now return last_new_visit.complaints for pre-filling
   4. The new endpoint returns doctor_id and doctor_name for button display
   
   These changes are BACKWARD COMPATIBLE with existing code.
================================================== */
