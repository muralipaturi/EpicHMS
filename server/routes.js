const { queryAll, queryOne, execute, getDb } = require('./db');
const { seedDatabase, hashPassword } = require('./seed');

function getUserFromRequest(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer epichms_token_')) return null;
  const base64Str = auth.replace('Bearer epichms_token_', '');
  try {
    const decoded = Buffer.from(base64Str, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length >= 2) {
      const id = parseInt(parts[0], 10);
      const email = parts[1];
      const user = queryOne('SELECT * FROM users WHERE id = ? AND email = ?', [id, email]);
      return user;
    }
  } catch(e) { return null; }
  return null;
}

function registerRoutes(router) {
  // --- HEALTH & PING ---
  router.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      app: 'EpicHMS Healthcare Platform',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      automation_ready: true
    });
  });

  // --- TEST AUTOMATION HOOKS ---
  router.post('/api/test/reset-db', (req, res) => {
    const start = Date.now();
    try {
      seedDatabase();
      const elapsed = Date.now() - start;
      res.json({
        success: true,
        message: `EpicHMS database reset to baseline in ${elapsed}ms`,
        elapsed_ms: elapsed,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/api/test/summary', (req, res) => {
    try {
      const stats = {
        users: queryOne('SELECT COUNT(*) as count FROM users').count,
        patients: queryOne('SELECT COUNT(*) as count FROM patients').count,
        doctors: queryOne('SELECT COUNT(*) as count FROM doctors').count,
        departments: queryOne('SELECT COUNT(*) as count FROM departments').count,
        appointments: queryOne('SELECT COUNT(*) as count FROM appointments').count,
        ipd_admissions: queryOne('SELECT COUNT(*) as count FROM ipd_admissions').count,
        emergency_cases: queryOne('SELECT COUNT(*) as count FROM emergency_cases').count,
        pharmacy_items: queryOne('SELECT COUNT(*) as count FROM pharmacy_items').count,
        prescriptions: queryOne('SELECT COUNT(*) as count FROM prescriptions').count,
        lab_orders: queryOne('SELECT COUNT(*) as count FROM lab_orders').count,
        radiology_orders: queryOne('SELECT COUNT(*) as count FROM radiology_orders').count,
        ot_schedules: queryOne('SELECT COUNT(*) as count FROM operation_theatre').count,
        billing_invoices: queryOne('SELECT COUNT(*) as count FROM billing_invoices').count,
        insurance_claims: queryOne('SELECT COUNT(*) as count FROM insurance_claims').count,
        blood_bank_units: queryOne('SELECT COUNT(*) as count FROM blood_bank_units').count,
        ambulances: queryOne('SELECT COUNT(*) as count FROM ambulance_fleet').count,
        employees: queryOne('SELECT COUNT(*) as count FROM employees_hr').count,
        helpdesk_tickets: queryOne('SELECT COUNT(*) as count FROM helpdesk_tickets').count,
        audit_logs: queryOne('SELECT COUNT(*) as count FROM audit_logs').count,
        beds: queryOne('SELECT COUNT(*) as count FROM beds').count,
        biomedical_waste: queryOne('SELECT COUNT(*) as count FROM biomedical_waste').count,
        purchase_orders: queryOne('SELECT COUNT(*) as count FROM purchase_orders').count,
        stock_movements: queryOne('SELECT COUNT(*) as count FROM stock_movements').count,
        billing_advances: queryOne('SELECT COUNT(*) as count FROM billing_advances').count
      };
      res.json({ success: true, stats });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/api/test/fixtures', (req, res) => {
    res.json({
      test_users: [
        { role: 'superadmin', email: 'superadmin@epichms.local', password: 'pass123', name: 'Dr. Arthur Sterling' },
        { role: 'admin', email: 'admin@epichms.local', password: 'pass123', name: 'Clara Oswald' },
        { role: 'doctor', email: 'doctor@epichms.local', password: 'pass123', name: 'Dr. Evelyn Reed, MD' },
        { role: 'nurse', email: 'nurse@epichms.local', password: 'pass123', name: 'Sarah Jenkins, RN' },
        { role: 'pharmacist', email: 'pharmacist@epichms.local', password: 'pass123', name: 'James Chen, PharmD' },
        { role: 'lab', email: 'lab@epichms.local', password: 'pass123', name: 'Dr. Julian Bashir, MSc' },
        { role: 'radiology', email: 'radiology@epichms.local', password: 'pass123', name: 'Elena Rostova, RT' },
        { role: 'receptionist', email: 'receptionist@epichms.local', password: 'pass123', name: 'Alice Walker' },
        { role: 'billing', email: 'billing@epichms.local', password: 'pass123', name: 'Marcus Thorne, CPA' },
        { role: 'inventory', email: 'inventory@epichms.local', password: 'pass123', name: 'Vikram Patel' },
        { role: 'hr', email: 'hr@epichms.local', password: 'pass123', name: 'Beatrice Stone' },
        { role: 'patient', email: 'patient@epichms.local', password: 'pass123', name: 'Johnathan Vance' },
        { role: 'staff', email: 'staff@epichms.local', password: 'pass123', name: 'Alice Walker' }
      ],
      quick_testids: {
        login: ['login-email-input', 'login-password-input', 'login-submit-btn', 'role-quick-select'],
        patient: ['patient-reg-fname', 'patient-reg-lname', 'patient-reg-phone', 'patient-reg-submit', 'patient-search-input'],
        appointment: ['appointment-patient-select', 'appointment-doctor-select', 'appointment-date-input', 'appointment-submit-btn'],
        pharmacy: ['pharmacy-search-input', 'pharmacy-dispense-btn', 'pharmacy-stock-table'],
        billing: ['billing-patient-select', 'billing-amount-input', 'billing-pay-btn', 'invoice-table-row'],
        beds: ['bed-matrix-grid', 'bed-status-select', 'bed-transfer-btn'],
        waste: ['waste-category-select', 'waste-barcode-input', 'waste-weight-input', 'waste-submit-btn'],
        procurement: ['po-supplier-input', 'po-amount-input', 'po-submit-btn']
      }
    });
  });

  // --- AUTHENTICATION & ACCESS MANAGEMENT ---
  router.post('/api/auth/login', (req, res) => {
    const identifier = req.body.email || req.body.username;
    const password = req.body.password;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    const hashed = hashPassword(password);
    const user = queryOne('SELECT * FROM users WHERE (email = ? OR username = ?) AND password_hash = ?', [identifier, identifier, hashed]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate token
    const token = 'epichms_token_' + Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');
    
    // Log audit
    execute('INSERT INTO audit_logs (user_email, user_role, action, module, details) VALUES (?, ?, ?, ?, ?)',
      [user.email, user.role, 'LOGIN_SUCCESS', 'Auth', `User logged in from ${req.ip || '127.0.0.1'}`]);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        department: user.department,
        phone: user.phone,
        account_status: user.account_status || 'Active',
        employment_status: user.employment_status || 'Full-Time',
        clinical_status: user.clinical_status || 'Available'
      }
    });
  });

  router.post('/api/auth/switch-role', (req, res) => {
    const { role } = req.body || {};
    const user = queryOne('SELECT * FROM users WHERE role = ? LIMIT 1', [role]);
    if (!user) {
      return res.status(404).json({ error: `User with role "${role}" not found.` });
    }
    const token = 'epichms_token_' + Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        department: user.department,
        phone: user.phone,
        account_status: user.account_status || 'Active',
        employment_status: user.employment_status || 'Full-Time',
        clinical_status: user.clinical_status || 'Available'
      }
    });
  });

  router.get('/api/auth/me', (req, res) => {
    // Return first user or role-based user
    const role = req.query.role || 'superadmin';
    const user = queryOne('SELECT id, username, email, role, full_name, department, phone, account_status, employment_status, clinical_status FROM users WHERE role = ? LIMIT 1', [role]);
    res.json(user || {});
  });

  // --- PUBLIC WEBSITE ENDPOINTS ---
  router.get('/api/public/hospital-info', (req, res) => {
    const settings = queryAll('SELECT key, value FROM system_settings');
    const settingsMap = {};
    settings.forEach(s => settingsMap[s.key] = s.value);

    res.json({
      name: settingsMap.HOSPITAL_NAME || 'EpicHMS Multi-Speciality Medical Center',
      tagline: 'Leading the Future of Compassionate, Advanced Healthcare',
      stats: {
        doctors: queryOne('SELECT COUNT(*) as c FROM doctors').c,
        departments: queryOne('SELECT COUNT(*) as c FROM departments').c,
        beds: 250,
        patientsServed: '50,000+'
      },
      phone: settingsMap.EMERGENCY_HOTLINE || '+1-800-EPIC-911',
      address: '100 Medical Excellence Boulevard, Metro City'
    });
  });

  router.get('/api/public/doctors', (req, res) => {
    const docs = queryAll(`
      SELECT d.*, dept.name as department_name 
      FROM doctors d 
      LEFT JOIN departments dept ON d.department_id = dept.id
    `);
    res.json(docs);
  });

  router.get('/api/public/departments', (req, res) => {
    const depts = queryAll('SELECT * FROM departments ORDER BY id ASC');
    res.json(depts);
  });

  router.post('/api/public/appointment-request', (req, res) => {
    const { first_name, last_name, phone, email, doctor_id, department_id, appointment_date, symptoms } = req.body || {};
    if (!first_name || !last_name || !phone || !doctor_id || !appointment_date) {
      return res.status(400).json({ error: 'Please provide patient name, phone, doctor, and preferred date.' });
    }

    // Check if patient exists, else create
    let patient = queryOne('SELECT id FROM patients WHERE phone = ?', [phone]);
    let patientId = patient ? patient.id : null;

    if (!patientId) {
      const code = 'P-' + Math.floor(1000 + Math.random() * 9000);
      const insert = execute(`
        INSERT INTO patients (patient_code, first_name, last_name, gender, dob, age, blood_group, phone, email, address)
        VALUES (?, ?, ?, 'Unspecified', '1990-01-01', 35, 'Unknown', ?, ?, 'Online Booking')
      `, [code, first_name, last_name, phone, email || '']);
      patientId = insert.lastInsertRowid;
    }

    const apptNo = 'APT-WEB-' + Math.floor(10000 + Math.random() * 90000);
    const insertAppt = execute(`
      INSERT INTO appointments (appointment_no, patient_id, doctor_id, department_id, appointment_date, time_slot, visit_type, symptoms, status)
      VALUES (?, ?, ?, ?, ?, '11:00 AM', 'Online Booking', ?, 'Confirmed')
    `, [apptNo, patientId, doctor_id, department_id || 1, appointment_date, symptoms || 'Online appointment request']);

    // Add communication log
    execute(`
      INSERT INTO communication_logs (channel, recipient, subject, message_body, status)
      VALUES ('SMS', ?, 'Appointment Confirmed', ?, 'Delivered')
    `, [phone, `Your EpicHMS appointment ${apptNo} has been confirmed for ${appointment_date}.`]);

    res.status(201).json({
      success: true,
      appointment_no: apptNo,
      message: 'Appointment successfully booked! A confirmation SMS has been sent.',
      patient_id: patientId
    });
  });

  // --- MODULE 1: PATIENT MANAGEMENT ---
  router.get('/api/patients', (req, res) => {
    const user = getUserFromRequest(req);
    const search = req.query.search;
    let query = 'SELECT * FROM patients';
    let params = [];
    
    let whereConditions = [];
    
    if (user && user.role === 'patient') {
      whereConditions.push('email = ?');
      params.push(user.email);
    }
    
    if (search) {
      whereConditions.push('(first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR patient_code LIKE ? OR uhid LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY id DESC';
    res.json(queryAll(query, params));
  });

  router.post('/api/patients', (req, res) => {
    const { first_name, last_name, gender, dob, age, blood_group, phone, email, address, emergency_contact, allergies, uhid } = req.body || {};
    if (!first_name || !last_name || !phone) {
      return res.status(400).json({ error: 'First name, last name, and phone are mandatory.' });
    }

    // Duplicate detection check
    const existing = queryOne('SELECT id, uhid, patient_code FROM patients WHERE phone = ? LIMIT 1', [phone]);
    const duplicateFlag = existing ? 1 : 0;

    const code = 'P-' + Math.floor(1000 + Math.random() * 9000);
    const assignedUhid = uhid || ('UHID-2026-' + Math.floor(100000 + Math.random() * 900000));
    const calculatedAge = age || 30;
    const calcDob = dob || '1995-01-01';

    const result = execute(`
      INSERT INTO patients (patient_code, uhid, first_name, last_name, gender, dob, age, blood_group, phone, email, address, emergency_contact, allergies, duplicate_check_flag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [code, assignedUhid, first_name, last_name, gender || 'Other', calcDob, calculatedAge, blood_group || 'O+', phone, email || '', address || '', emergency_contact || '', allergies || 'None Reported', duplicateFlag]);

    const newPatient = queryOne('SELECT * FROM patients WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({
      ...newPatient,
      duplicate_detected: duplicateFlag === 1,
      duplicate_warning: duplicateFlag === 1 ? `A patient record already exists with phone ${phone} (UHID: ${existing.uhid})` : null
    });
  });

  router.get('/api/patients/:id', (req, res) => {
    const p = queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    res.json(p);
  });

  // --- MODULE 2: APPOINTMENT MANAGEMENT ---
  router.get('/api/appointments', (req, res) => {
    const user = getUserFromRequest(req);
    let whereClause = '';
    let params = [];
    
    if (user && user.role === 'doctor') {
      const doc = queryOne('SELECT id FROM doctors WHERE full_name = ?', [user.full_name]);
      if (doc) {
        whereClause = ' WHERE a.doctor_id = ? ';
        params.push(doc.id);
      } else {
        whereClause = ' WHERE a.id = -1 '; // doctor record not found
      }
    } else if (user && user.role === 'patient') {
      const pat = queryOne('SELECT id FROM patients WHERE email = ?', [user.email]);
      if (pat) {
        whereClause = ' WHERE a.patient_id = ? ';
        params.push(pat.id);
      } else {
        whereClause = ' WHERE a.id = -1 '; // patient record not found
      }
    }

    const appts = queryAll(`
      SELECT a.*, 
             p.first_name || ' ' || p.last_name as patient_name, p.phone as patient_phone, p.patient_code,
             d.full_name as doctor_name, d.specialization,
             dept.name as department_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN departments dept ON a.department_id = dept.id
      ${whereClause}
      ORDER BY a.appointment_date DESC, a.id DESC
    `, params);
    res.json(appts);
  });

  router.post('/api/appointments', (req, res) => {
    const { patient_id, doctor_id, department_id, appointment_date, time_slot, visit_type, symptoms } = req.body || {};
    if (!patient_id || !doctor_id || !appointment_date) {
      return res.status(400).json({ error: 'Patient, Doctor, and Appointment Date are required.' });
    }

    const no = 'APT-2026-' + Math.floor(100 + Math.random() * 900);
    const result = execute(`
      INSERT INTO appointments (appointment_no, patient_id, doctor_id, department_id, appointment_date, time_slot, visit_type, symptoms, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled')
    `, [no, patient_id, doctor_id, department_id || 1, appointment_date, time_slot || '10:00 AM', visit_type || 'Consultation', symptoms || '']);

    res.status(201).json({ id: result.lastInsertRowid, appointment_no: no, success: true });
  });

  router.put('/api/appointments/:id/status', (req, res) => {
    const { status } = req.body || {};
    execute('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, status });
  });

  // --- MODULE 3: OPD MANAGEMENT ---
  router.get('/api/opd/queue', (req, res) => {
    const user = getUserFromRequest(req);
    let whereClause = '';
    let params = [];
    
    if (user && user.role === 'doctor') {
      const doc = queryOne('SELECT id FROM doctors WHERE full_name = ?', [user.full_name]);
      if (doc) {
        whereClause = ' WHERE q.doctor_id = ? ';
        params.push(doc.id);
      } else {
        whereClause = ' WHERE q.id = -1 ';
      }
    } else if (user && user.role === 'patient') {
      const pat = queryOne('SELECT id FROM patients WHERE email = ?', [user.email]);
      if (pat) {
        whereClause = ' WHERE q.patient_id = ? ';
        params.push(pat.id);
      } else {
        whereClause = ' WHERE q.id = -1 ';
      }
    }

    const queue = queryAll(`
      SELECT q.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name, p.gender, p.age,
             d.full_name as doctor_name, d.room_no
      FROM opd_queue q
      JOIN patients p ON q.patient_id = p.id
      JOIN doctors d ON q.doctor_id = d.id
      ${whereClause}
      ORDER BY q.token_no ASC
    `, params);
    res.json(queue);
  });

  router.post('/api/opd/check-in', (req, res) => {
    const { patient_id, doctor_id, vital_bp, vital_pulse, vital_temp, vital_weight, vital_spo2 } = req.body || {};
    if (!patient_id || !doctor_id) return res.status(400).json({ error: 'Patient and Doctor required.' });

    const maxToken = queryOne('SELECT MAX(token_no) as maxT FROM opd_queue').maxT || 100;
    const nextToken = maxToken + 1;
    const checkInTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const result = execute(`
      INSERT INTO opd_queue (token_no, patient_id, doctor_id, check_in_time, vital_bp, vital_pulse, vital_temp, vital_weight, vital_spo2, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Waiting')
    `, [nextToken, patient_id, doctor_id, checkInTime, vital_bp || '120/80', vital_pulse || '72', vital_temp || '98.6', vital_weight || '70', vital_spo2 || '99%']);

    res.status(201).json({ id: result.lastInsertRowid, token_no: nextToken, success: true });
  });

  // --- MODULE 4: IPD / ADMISSIONS ---
  router.get('/api/ipd/admissions', (req, res) => {
    const admissions = queryAll(`
      SELECT ip.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name, p.blood_group,
             d.full_name as doctor_name, dept.name as department_name
      FROM ipd_admissions ip
      JOIN patients p ON ip.patient_id = p.id
      JOIN doctors d ON ip.attending_doctor_id = d.id
      LEFT JOIN departments dept ON ip.department_id = dept.id
      ORDER BY ip.id DESC
    `);
    res.json(admissions);
  });

  router.post('/api/ipd/admit', (req, res) => {
    const { patient_id, attending_doctor_id, ward, bed_no, admitting_diagnosis } = req.body || {};
    if (!patient_id || !attending_doctor_id || !ward || !bed_no || !admitting_diagnosis) {
      return res.status(400).json({ error: 'Patient, Doctor, Ward, Bed, and Diagnosis are required.' });
    }

    const code = 'IPD-2026-' + Math.floor(100 + Math.random() * 900);
    const result = execute(`
      INSERT INTO ipd_admissions (ipd_code, patient_id, attending_doctor_id, ward, bed_no, admitting_diagnosis, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Admitted')
    `, [code, patient_id, attending_doctor_id, ward, bed_no, admitting_diagnosis]);

    res.status(201).json({ id: result.lastInsertRowid, ipd_code: code, success: true });
  });

  // --- MODULE 5: EMERGENCY / CASUALTY ---
  router.get('/api/emergency/cases', (req, res) => {
    res.json(queryAll('SELECT * FROM emergency_cases ORDER BY id DESC'));
  });

  router.post('/api/emergency/triage', (req, res) => {
    const { patient_name, age, gender, triage_level, trauma_type, arrival_mode, vitals_summary, attending_doctor } = req.body || {};
    if (!patient_name || !triage_level) {
      return res.status(400).json({ error: 'Patient name and triage level are required.' });
    }

    const caseNo = 'ER-CASE-' + Math.floor(500 + Math.random() * 500);
    const result = execute(`
      INSERT INTO emergency_cases (case_no, patient_name, age, gender, triage_level, trauma_type, arrival_mode, vitals_summary, attending_doctor, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Under Treatment')
    `, [caseNo, patient_name, age || 30, gender || 'Male', triage_level, trauma_type || 'Acute Assessment', arrival_mode || 'Walk-in', vitals_summary || 'Normal', attending_doctor || 'ER Resident']);

    res.status(201).json({ id: result.lastInsertRowid, case_no: caseNo, success: true });
  });

  // --- MODULE 6: DOCTOR MANAGEMENT ---
  router.get('/api/doctors', (req, res) => {
    const docs = queryAll(`
      SELECT d.*, dept.name as department_name 
      FROM doctors d
      LEFT JOIN departments dept ON d.department_id = dept.id
      ORDER BY d.id ASC
    `);
    res.json(docs);
  });

  router.post('/api/doctors', (req, res) => {
    const { full_name, department_id, specialization, qualification, room_no, consultation_fee, available_days } = req.body || {};
    if (!full_name || !specialization) return res.status(400).json({ error: 'Doctor name and specialization required.' });

    const code = 'DOC-' + Math.floor(100 + Math.random() * 900);
    const result = execute(`
      INSERT INTO doctors (doctor_code, full_name, department_id, specialization, qualification, room_no, consultation_fee, available_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [code, full_name, department_id || 1, specialization, qualification || 'MD', room_no || 'Room 101', consultation_fee || 500, available_days || 'Mon-Fri']);

    res.status(201).json({ id: result.lastInsertRowid, doctor_code: code, success: true });
  });

  // --- MODULE 7: DEPARTMENT MANAGEMENT ---
  router.get('/api/departments', (req, res) => {
    res.json(queryAll('SELECT * FROM departments ORDER BY id ASC'));
  });

  // --- MODULE 8: PHARMACY MANAGEMENT ---
  router.get('/api/pharmacy/inventory', (req, res) => {
    res.json(queryAll('SELECT * FROM pharmacy_items ORDER BY id ASC'));
  });

  router.get('/api/pharmacy/prescriptions', (req, res) => {
    const user = getUserFromRequest(req);
    let whereClause = '';
    let params = [];
    
    if (user && user.role === 'doctor') {
      const doc = queryOne('SELECT id FROM doctors WHERE full_name = ?', [user.full_name]);
      if (doc) {
        whereClause = ' WHERE rx.doctor_id = ? ';
        params.push(doc.id);
      } else {
        whereClause = ' WHERE rx.id = -1 ';
      }
    } else if (user && user.role === 'patient') {
      const pat = queryOne('SELECT id FROM patients WHERE email = ?', [user.email]);
      if (pat) {
        whereClause = ' WHERE rx.patient_id = ? ';
        params.push(pat.id);
      } else {
        whereClause = ' WHERE rx.id = -1 ';
      }
    }

    const rxs = queryAll(`
      SELECT rx.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name,
             d.full_name as doctor_name
      FROM prescriptions rx
      JOIN patients p ON rx.patient_id = p.id
      JOIN doctors d ON rx.doctor_id = d.id
      ${whereClause}
      ORDER BY rx.id DESC
    `, params);
    for (const r of rxs) {
      r.items = queryAll(`
        SELECT pi.*, drug.drug_name, drug.unit_price, drug.stock_qty
        FROM prescription_items pi
        JOIN pharmacy_items drug ON pi.drug_id = drug.id
        WHERE pi.prescription_id = ?
      `, [r.id]);
    }
    res.json(rxs);
  });

  router.post('/api/pharmacy/dispense', (req, res) => {
    const { prescription_id, drug_ids } = req.body || {};
    if (!prescription_id) return res.status(400).json({ error: 'Prescription ID required' });

    execute(`UPDATE prescription_items SET dispensed_status = 'Dispensed' WHERE prescription_id = ?`, [prescription_id]);
    execute(`UPDATE prescriptions SET status = 'Fully Dispensed' WHERE id = ?`, [prescription_id]);

    // Decrement stock
    const items = queryAll('SELECT drug_id, quantity FROM prescription_items WHERE prescription_id = ?', [prescription_id]);
    for (const it of items) {
      execute('UPDATE pharmacy_items SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?', [it.quantity, it.drug_id]);
    }

    res.json({ success: true, message: 'Medications dispensed and inventory updated.' });
  });

  // --- MODULE 9: LABORATORY ---
  router.get('/api/lab/tests', (req, res) => {
    res.json(queryAll('SELECT * FROM lab_tests ORDER BY id ASC'));
  });

  router.get('/api/lab/orders', (req, res) => {
    const orders = queryAll(`
      SELECT lo.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name,
             d.full_name as doctor_name,
             lt.test_name, lt.category as test_category, lt.normal_range, lt.units
      FROM lab_orders lo
      JOIN patients p ON lo.patient_id = p.id
      JOIN doctors d ON lo.doctor_id = d.id
      JOIN lab_tests lt ON lo.test_id = lt.id
      ORDER BY lo.id DESC
    `);
    res.json(orders);
  });

  router.post('/api/lab/orders', (req, res) => {
    const { patient_id, doctor_id, test_id, notes } = req.body || {};
    if (!patient_id || !doctor_id || !test_id) return res.status(400).json({ error: 'Patient, Doctor, and Test are required.' });

    const orderNo = 'LBO-2026-' + Math.floor(1000 + Math.random() * 9000);
    const result = execute(`
      INSERT INTO lab_orders (order_no, patient_id, doctor_id, test_id, sample_status, technician_notes, status)
      VALUES (?, ?, ?, ?, 'Sample Collected', ?, 'Pending')
    `, [orderNo, patient_id, doctor_id, test_id, notes || 'Routine order']);

    res.status(201).json({ id: result.lastInsertRowid, order_no: orderNo, success: true });
  });

  router.put('/api/lab/orders/:id/result', (req, res) => {
    const { test_result, normal_flag, notes } = req.body || {};
    execute(`
      UPDATE lab_orders 
      SET test_result = ?, normal_flag = ?, technician_notes = ?, sample_status = 'Completed', status = 'Approved'
      WHERE id = ?
    `, [test_result || 'Normal', normal_flag || 'Normal', notes || '', req.params.id]);

    res.json({ success: true, message: 'Lab test results recorded and approved.' });
  });

  // --- MODULE 10: RADIOLOGY / IMAGING ---
  router.get('/api/radiology/orders', (req, res) => {
    const rads = queryAll(`
      SELECT ro.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name,
             d.full_name as doctor_name
      FROM radiology_orders ro
      JOIN patients p ON ro.patient_id = p.id
      JOIN doctors d ON ro.doctor_id = d.id
      ORDER BY ro.id DESC
    `);
    res.json(rads);
  });

  router.post('/api/radiology/orders', (req, res) => {
    const { patient_id, doctor_id, modality, body_part, clinical_indication } = req.body || {};
    if (!patient_id || !doctor_id || !modality || !body_part) return res.status(400).json({ error: 'All fields required' });

    const reqNo = 'RAD-2026-' + Math.floor(100 + Math.random() * 900);
    const result = execute(`
      INSERT INTO radiology_orders (req_no, patient_id, doctor_id, modality, body_part, clinical_indication, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Scheduled')
    `, [reqNo, patient_id, doctor_id, modality, body_part, clinical_indication || 'Standard diagnostic workup']);

    res.status(201).json({ id: result.lastInsertRowid, req_no: reqNo, success: true });
  });

  // --- MODULE 11: OPERATION THEATRE (OT) ---
  router.get('/api/ot/schedules', (req, res) => {
    const ot = queryAll(`
      SELECT ot.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name,
             d.full_name as surgeon_name
      FROM operation_theatre ot
      JOIN patients p ON ot.patient_id = p.id
      JOIN doctors d ON ot.primary_surgeon_id = d.id
      ORDER BY ot.id DESC
    `);
    res.json(ot);
  });

  // --- MODULE 12: NURSING MANAGEMENT ---
  router.get('/api/nursing/records', (req, res) => {
    const records = queryAll(`
      SELECT nr.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name,
             ip.ward, ip.bed_no
      FROM nursing_records nr
      JOIN patients p ON nr.patient_id = p.id
      JOIN ipd_admissions ip ON nr.ipd_id = ip.id
      ORDER BY nr.id DESC
    `);
    res.json(records);
  });

  router.post('/api/nursing/vitals', (req, res) => {
    const { ipd_id, patient_id, nurse_name, bp, heart_rate, resp_rate, spo2, temp_c, medication_given, nursing_notes } = req.body || {};
    if (!ipd_id || !patient_id) return res.status(400).json({ error: 'IPD and Patient ID required' });

    const result = execute(`
      INSERT INTO nursing_records (ipd_id, patient_id, nurse_name, bp, heart_rate, resp_rate, spo2, temp_c, medication_given, nursing_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [ipd_id, patient_id, nurse_name || 'Staff Nurse', bp || '120/80', heart_rate || '75', resp_rate || '16', spo2 || '99%', temp_c || '37.0', medication_given || '', nursing_notes || 'Patient comfortable']);

    res.status(201).json({ id: result.lastInsertRowid, success: true });
  });

  // --- MODULE 13: BILLING & PAYMENTS ---
  router.get('/api/billing/invoices', (req, res) => {
    const invoices = queryAll(`
      SELECT inv.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name, p.phone as patient_phone
      FROM billing_invoices inv
      JOIN patients p ON inv.patient_id = p.id
      ORDER BY inv.id DESC
    `);
    for (const inv of invoices) {
      inv.items = queryAll('SELECT * FROM billing_items WHERE invoice_id = ?', [inv.id]);
    }
    res.json(invoices);
  });

  router.post('/api/billing/invoices', (req, res) => {
    const { patient_id, total_amount, discount_amount, tax_amount, payment_mode, items } = req.body || {};
    if (!patient_id || !total_amount) return res.status(400).json({ error: 'Patient ID and total amount required' });

    const tot = parseFloat(total_amount);
    const disc = parseFloat(discount_amount || 0);
    const tax = parseFloat(tax_amount || 0);
    const net = tot - disc + tax;
    const invNo = 'INV-2026-' + Math.floor(1000 + Math.random() * 9000);

    const result = execute(`
      INSERT INTO billing_invoices (invoice_no, patient_id, total_amount, discount_amount, tax_amount, net_amount, paid_amount, due_amount, payment_mode, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, ?, 'Paid')
    `, [invNo, patient_id, tot, disc, tax, net, net, payment_mode || 'Cash']);

    const invId = result.lastInsertRowid;
    if (Array.isArray(items)) {
      for (const it of items) {
        execute(`
          INSERT INTO billing_items (invoice_id, item_type, description, quantity, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [invId, it.type || 'Service', it.desc || 'General Hospital Service', it.qty || 1, it.price || net, it.price || net]);
      }
    } else {
      execute(`
        INSERT INTO billing_items (invoice_id, item_type, description, quantity, unit_price, total_price)
        VALUES (?, 'Consultation', 'Hospital Medical Consultation & Care', 1, ?, ?)
      `, [invId, net, net]);
    }

    res.status(201).json({ id: invId, invoice_no: invNo, net_amount: net, success: true });
  });

  // --- MODULE 14: INSURANCE / TPA ---
  router.get('/api/insurance/claims', (req, res) => {
    const claims = queryAll(`
      SELECT c.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name,
             inv.invoice_no, inv.net_amount
      FROM insurance_claims c
      JOIN patients p ON c.patient_id = p.id
      JOIN billing_invoices inv ON c.invoice_id = inv.id
      ORDER BY c.id DESC
    `);
    res.json(claims);
  });

  // --- MODULE 15: INVENTORY & PROCUREMENT ---
  router.get('/api/inventory/items', (req, res) => {
    res.json(queryAll('SELECT * FROM inventory_items ORDER BY id ASC'));
  });

  router.post('/api/inventory/restock', (req, res) => {
    const { item_id, quantity } = req.body || {};
    if (!item_id || !quantity) return res.status(400).json({ error: 'Item ID and quantity required' });
    execute('UPDATE inventory_items SET quantity_in_stock = quantity_in_stock + ?, last_restocked = DATE("now") WHERE id = ?', [quantity, item_id]);
    res.json({ success: true, message: 'Stock restocked successfully' });
  });

  // --- MODULE 16: BLOOD BANK ---
  router.get('/api/blood-bank/units', (req, res) => {
    res.json(queryAll('SELECT * FROM blood_bank_units ORDER BY id ASC'));
  });

  // --- MODULE 17: DISCHARGE MANAGEMENT ---
  router.get('/api/discharge/summaries', (req, res) => {
    const discharges = queryAll(`
      SELECT ds.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name,
             d.full_name as doctor_name,
             ip.ward, ip.bed_no
      FROM discharge_summaries ds
      JOIN patients p ON ds.patient_id = p.id
      JOIN doctors d ON ds.doctor_id = d.id
      JOIN ipd_admissions ip ON ds.ipd_id = ip.id
      ORDER BY ds.id DESC
    `);
    res.json(discharges);
  });

  // --- MODULE 18: MEDICAL RECORDS / EMR ---
  router.get('/api/emr/records', (req, res) => {
    const user = getUserFromRequest(req);
    let whereClause = '';
    let params = [];
    
    if (user && user.role === 'doctor') {
      const doc = queryOne('SELECT id FROM doctors WHERE full_name = ?', [user.full_name]);
      if (doc) {
        whereClause = ' WHERE em.doctor_id = ? ';
        params.push(doc.id);
      } else {
        whereClause = ' WHERE em.id = -1 ';
      }
    } else if (user && user.role === 'patient') {
      const pat = queryOne('SELECT id FROM patients WHERE email = ?', [user.email]);
      if (pat) {
        whereClause = ' WHERE em.patient_id = ? ';
        params.push(pat.id);
      } else {
        whereClause = ' WHERE em.id = -1 ';
      }
    }

    const emr = queryAll(`
      SELECT em.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name,
             d.full_name as doctor_name
      FROM medical_records em
      JOIN patients p ON em.patient_id = p.id
      JOIN doctors d ON em.doctor_id = d.id
      ${whereClause}
      ORDER BY em.id DESC
    `, params);
    res.json(emr);
  });

  // --- MODULE 19: AMBULANCE MANAGEMENT ---
  router.get('/api/ambulance/fleet', (req, res) => {
    res.json(queryAll('SELECT * FROM ambulance_fleet ORDER BY id ASC'));
  });

  router.post('/api/ambulance/dispatch', (req, res) => {
    const { ambulance_id, destination } = req.body || {};
    execute(`UPDATE ambulance_fleet SET status = 'Dispatched', current_location = ? WHERE id = ?`,
      [destination || 'En route to Emergency Scene', ambulance_id || 1]);
    res.json({ success: true, message: 'Ambulance successfully dispatched!' });
  });

  // --- MODULE 20: DIET & NUTRITION ---
  router.get('/api/diet/plans', (req, res) => {
    const diets = queryAll(`
      SELECT dp.*, 
             p.patient_code, p.first_name || ' ' || p.last_name as patient_name
      FROM diet_plans dp
      JOIN patients p ON dp.patient_id = p.id
      ORDER BY dp.id DESC
    `);
    res.json(diets);
  });

  // --- MODULE 21: MORTUARY MANAGEMENT ---
  router.get('/api/mortuary/records', (req, res) => {
    res.json(queryAll('SELECT * FROM mortuary_records ORDER BY id DESC'));
  });

  // --- MODULE 22: HOUSEKEEPING MANAGEMENT ---
  router.get('/api/housekeeping/tasks', (req, res) => {
    res.json(queryAll('SELECT * FROM housekeeping_tasks ORDER BY id DESC'));
  });

  router.put('/api/housekeeping/tasks/:id/status', (req, res) => {
    const { status } = req.body || {};
    execute('UPDATE housekeeping_tasks SET inspection_status = ? WHERE id = ?', [status || 'Cleaned', req.params.id]);
    res.json({ success: true, status });
  });

  // --- MODULE 23: HR & EMPLOYEE MANAGEMENT ---
  router.get('/api/hr/employees', (req, res) => {
    const emps = queryAll(`
      SELECT emp.*, dept.name as department_name
      FROM employees_hr emp
      LEFT JOIN departments dept ON emp.department_id = dept.id
      ORDER BY emp.id ASC
    `);
    res.json(emps);
  });

  // --- MODULE 24: PAYROLL MANAGEMENT ---
  router.get('/api/payroll/records', (req, res) => {
    const payroll = queryAll(`
      SELECT pr.*, emp.full_name as employee_name, emp.role_title
      FROM payroll_records pr
      JOIN employees_hr emp ON pr.employee_id = emp.id
      ORDER BY pr.id DESC
    `);
    res.json(payroll);
  });

  // --- MODULE 25: ASSETS & MAINTENANCE ---
  router.get('/api/assets/items', (req, res) => {
    res.json(queryAll('SELECT * FROM assets_maintenance ORDER BY id ASC'));
  });

  // --- MODULE 26: HELPDESK & SUPPORT ---
  router.get('/api/helpdesk/tickets', (req, res) => {
    res.json(queryAll('SELECT * FROM helpdesk_tickets ORDER BY id DESC'));
  });

  router.post('/api/helpdesk/tickets', (req, res) => {
    const { requester_name, department, subject, description, priority } = req.body || {};
    const no = 'HD-2026-' + Math.floor(400 + Math.random() * 500);
    const result = execute(`
      INSERT INTO helpdesk_tickets (ticket_no, requester_name, department, category, subject, description, priority, status)
      VALUES (?, ?, ?, 'General Support', ?, ?, ?, 'Open')
    `, [no, requester_name || 'Staff User', department || 'Hospital Staff', subject || 'Issue Report', description || '', priority || 'Medium']);

    res.status(201).json({ id: result.lastInsertRowid, ticket_no: no, success: true });
  });

  // --- MODULE 27: REPORTS & ANALYTICS ---
  router.get('/api/reports/kpis', (req, res) => {
    const totalPatients = queryOne('SELECT COUNT(*) as c FROM patients').c;
    const totalAppointments = queryOne('SELECT COUNT(*) as c FROM appointments').c;
    const activeIpd = queryOne("SELECT COUNT(*) as c FROM ipd_admissions WHERE status = 'Admitted'").c;
    const emergencyCases = queryOne('SELECT COUNT(*) as c FROM emergency_cases').c;
    const totalRevenue = queryOne('SELECT SUM(paid_amount) as s FROM billing_invoices').s || 0;
    const pendingDue = queryOne('SELECT SUM(due_amount) as s FROM billing_invoices').s || 0;
    const bedOccupancy = Math.round((activeIpd / 120) * 100);

    res.json({
      total_patients: totalPatients,
      total_appointments: totalAppointments,
      active_inpatients: activeIpd,
      bed_occupancy_rate: `${bedOccupancy}%`,
      emergency_cases_today: emergencyCases,
      total_revenue_collected: totalRevenue,
      pending_receivables: pendingDue
    });
  });

  // --- MODULE 28: AUDIT & COMPLIANCE ---
  router.get('/api/audit/logs', (req, res) => {
    res.json(queryAll('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50'));
  });

  // --- MODULE 29: DOCUMENT MANAGEMENT ---
  router.get('/api/documents', (req, res) => {
    const docs = queryAll(`
      SELECT df.*, p.patient_code, p.first_name || ' ' || p.last_name as patient_name
      FROM document_files df
      JOIN patients p ON df.patient_id = p.id
      ORDER BY df.id DESC
    `);
    res.json(docs);
  });

  // --- PLATFORM SERVICES ---
  router.get('/api/services/notifications', (req, res) => {
    res.json(queryAll('SELECT * FROM notifications ORDER BY id DESC LIMIT 20'));
  });

  router.post('/api/services/notifications/read-all', (req, res) => {
    execute('UPDATE notifications SET read_status = 1');
    res.json({ success: true });
  });

  router.get('/api/services/comms', (req, res) => {
    res.json(queryAll('SELECT * FROM communication_logs ORDER BY id DESC LIMIT 30'));
  });

  router.get('/api/services/search', (req, res) => {
    const q = req.query.q || '';
    if (!q || q.trim().length < 2) return res.json({ patients: [], doctors: [], appointments: [] });

    const term = `%${q.trim()}%`;
    const patients = queryAll('SELECT id, patient_code, first_name, last_name, phone FROM patients WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? LIMIT 5', [term, term, term]);
    const doctors = queryAll('SELECT id, doctor_code, full_name, specialization FROM doctors WHERE full_name LIKE ? OR specialization LIKE ? LIMIT 5', [term, term]);
    const appointments = queryAll("SELECT a.id, a.appointment_no, a.appointment_date, p.first_name || ' ' || p.last_name as patient_name FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.appointment_no LIKE ? OR p.first_name LIKE ? LIMIT 5", [term, term]);

    res.json({ patients, doctors, appointments });
  });

  // --- MULTI-TENANCY ORGANIZATION HIERARCHY ---
  router.get('/api/org/hierarchy', (req, res) => {
    try {
      const org = queryOne('SELECT * FROM organizations LIMIT 1');
      const hospitals = queryAll('SELECT * FROM hospitals WHERE org_id = ?', [org ? org.id : 1]);
      const branches = queryAll('SELECT * FROM branches');
      const buildings = queryAll('SELECT * FROM buildings_floors');
      const departments = queryAll('SELECT id, dept_code, name, location, total_beds FROM departments');
      res.json({
        organization: org,
        hospitals,
        branches,
        buildings_floors: buildings,
        departments
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- BED MANAGEMENT & CONTROLLED TRANSITIONS ---
  router.get('/api/facility/beds', (req, res) => {
    try {
      const statusFilter = req.query.status;
      const wardFilter = req.query.ward;
      let query = `
        SELECT b.*, 
               d.name as department_name, d.dept_code,
               p.patient_code, p.uhid, p.first_name || ' ' || p.last_name as patient_name,
               p.age as patient_age, p.gender as patient_gender
        FROM beds b
        LEFT JOIN departments d ON b.department_id = d.id
        LEFT JOIN patients p ON b.current_patient_id = p.id
      `;
      const conditions = [];
      const params = [];
      if (statusFilter && statusFilter !== 'All') {
        conditions.push('b.status = ?');
        params.push(statusFilter);
      }
      if (wardFilter && wardFilter !== 'All') {
        conditions.push('b.ward_name LIKE ?');
        params.push(`%${wardFilter}%`);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY b.ward_name, b.bed_code';
      const beds = queryAll(query, params);

      // Bed metrics summary
      const counts = {
        total: queryOne('SELECT COUNT(*) as count FROM beds').count,
        available: queryOne("SELECT COUNT(*) as count FROM beds WHERE status = 'Available'").count,
        occupied: queryOne("SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'").count,
        cleaning: queryOne("SELECT COUNT(*) as count FROM beds WHERE status = 'Cleaning'").count,
        maintenance: queryOne("SELECT COUNT(*) as count FROM beds WHERE status = 'Maintenance'").count,
        reserved: queryOne("SELECT COUNT(*) as count FROM beds WHERE status = 'Reserved'").count,
        blocked: queryOne("SELECT COUNT(*) as count FROM beds WHERE status = 'Blocked'").count
      };

      res.json({ beds, counts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/facility/beds/:id/status', (req, res) => {
    try {
      const { status, notes, patient_id } = req.body || {};
      const validStatuses = ['Available', 'Occupied', 'Reserved', 'Cleaning', 'Maintenance', 'Blocked'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const bed = queryOne('SELECT * FROM beds WHERE id = ?', [req.params.id]);
      if (!bed) return res.status(404).json({ error: 'Bed not found' });

      let currentPatient = patient_id !== undefined ? patient_id : bed.current_patient_id;
      let occupiedSince = status === 'Occupied' ? (bed.occupied_since || new Date().toISOString()) : null;
      if (status !== 'Occupied') {
        currentPatient = null;
      }

      execute(`
        UPDATE beds
        SET status = ?, current_patient_id = ?, occupied_since = ?, notes = COALESCE(?, notes)
        WHERE id = ?
      `, [status, currentPatient, occupiedSince, notes || null, req.params.id]);

      execute('INSERT INTO audit_logs (user_email, user_role, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        ['system@epichms.local', 'admin', 'BED_STATUS_TRANSITION', 'Bed Management', bed.bed_code, `Bed ${bed.bed_code} transitioned from ${bed.status} to ${status}`]);

      const updated = queryOne('SELECT * FROM beds WHERE id = ?', [req.params.id]);
      res.json({ success: true, bed: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/facility/beds/transfer', (req, res) => {
    try {
      const { patient_id, from_bed_id, to_bed_id, transfer_reason, requested_by, approved_by } = req.body || {};
      if (!patient_id || !from_bed_id || !to_bed_id || !transfer_reason) {
        return res.status(400).json({ error: 'patient_id, from_bed_id, to_bed_id, and transfer_reason are required.' });
      }

      const fromBed = queryOne('SELECT * FROM beds WHERE id = ?', [from_bed_id]);
      const toBed = queryOne('SELECT * FROM beds WHERE id = ?', [to_bed_id]);

      if (!fromBed || !toBed) {
        return res.status(404).json({ error: 'Source or target bed not found' });
      }
      if (toBed.status === 'Occupied') {
        return res.status(400).json({ error: `Target bed ${toBed.bed_code} is currently Occupied` });
      }

      // Record transfer
      const transferInsert = execute(`
        INSERT INTO bed_transfers (patient_id, from_bed_id, to_bed_id, transfer_reason, requested_by, approved_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [patient_id, from_bed_id, to_bed_id, transfer_reason, requested_by || 'Attending Nurse', approved_by || 'Attending Physician']);

      // Update source bed to Cleaning
      execute("UPDATE beds SET status = 'Cleaning', current_patient_id = NULL, occupied_since = NULL WHERE id = ?", [from_bed_id]);

      // Update target bed to Occupied
      execute("UPDATE beds SET status = 'Occupied', current_patient_id = ?, occupied_since = CURRENT_TIMESTAMP WHERE id = ?", [patient_id, to_bed_id]);

      // Audit log
      execute('INSERT INTO audit_logs (user_email, user_role, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        ['nurse@epichms.local', 'nurse', 'BED_TRANSFER', 'Bed Management', `P-${patient_id}`, `Transferred from ${fromBed.bed_code} to ${toBed.bed_code}. Reason: ${transfer_reason}`]);

      res.status(201).json({
        success: true,
        transfer_id: transferInsert.lastInsertRowid,
        message: `Patient successfully transferred from ${fromBed.bed_code} to ${toBed.bed_code}. Source bed is queued for terminal cleaning.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- BIOMEDICAL WASTE MANAGEMENT ---
  router.get('/api/waste/records', (req, res) => {
    try {
      const records = queryAll('SELECT * FROM biomedical_waste ORDER BY id DESC');
      const stats = {
        total_kg: queryOne('SELECT COALESCE(SUM(weight_kg), 0) as sum FROM biomedical_waste').sum,
        yellow_kg: queryOne("SELECT COALESCE(SUM(weight_kg), 0) as sum FROM biomedical_waste WHERE category = 'Yellow'").sum,
        red_kg: queryOne("SELECT COALESCE(SUM(weight_kg), 0) as sum FROM biomedical_waste WHERE category = 'Red'").sum,
        blue_kg: queryOne("SELECT COALESCE(SUM(weight_kg), 0) as sum FROM biomedical_waste WHERE category = 'Blue'").sum,
        white_kg: queryOne("SELECT COALESCE(SUM(weight_kg), 0) as sum FROM biomedical_waste WHERE category = 'White'").sum,
        dispatched_count: queryOne("SELECT COUNT(*) as count FROM biomedical_waste WHERE status = 'Dispatched'").count,
        stored_count: queryOne("SELECT COUNT(*) as count FROM biomedical_waste WHERE status = 'Stored'").count
      };
      res.json({ records, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/waste/log', (req, res) => {
    try {
      const { category, weight_kg, department, collected_by, bag_barcode, storage_room } = req.body || {};
      if (!category || !weight_kg || !department) {
        return res.status(400).json({ error: 'category, weight_kg, and department are required.' });
      }

      const wasteCode = 'BMW-2026-' + category[0].toUpperCase() + Math.floor(100 + Math.random() * 900);
      const barcode = bag_barcode || ('BC-' + category.substring(0, 3).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000));

      const insert = execute(`
        INSERT INTO biomedical_waste (waste_code, category, bag_barcode, weight_kg, department, collected_by, storage_room, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Stored')
      `, [wasteCode, category, barcode, weight_kg, department, collected_by || 'Housekeeping Staff', storage_room || 'Central Waste Holding A']);

      execute('INSERT INTO audit_logs (user_email, user_role, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        ['housekeeping@epichms.local', 'admin', 'BIOWASTE_LOGGED', 'Biomedical Waste', wasteCode, `Logged ${weight_kg}kg ${category} waste from ${department}`]);

      const record = queryOne('SELECT * FROM biomedical_waste WHERE id = ?', [insert.lastInsertRowid]);
      res.status(201).json({ success: true, record });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/waste/dispatch', (req, res) => {
    try {
      const { ids, disposal_vendor, vehicle_no, manifest_no, compliance_cert } = req.body || {};
      const vendor = disposal_vendor || 'BioClean Healthcare Disposal Ltd';
      const manifest = manifest_no || ('MNF-2026-' + Math.floor(1000 + Math.random() * 9000));
      const cert = compliance_cert || ('EPA-CERT-' + Math.floor(10000 + Math.random() * 90000));
      const veh = vehicle_no || 'TS-09-UB-4421';

      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        execute(`
          UPDATE biomedical_waste
          SET status = 'Dispatched', disposal_vendor = ?, vehicle_no = ?, manifest_no = ?, compliance_cert = ?, dispatched_at = CURRENT_TIMESTAMP
          WHERE id IN (${placeholders})
        `, [vendor, veh, manifest, cert, ...ids]);
      } else {
        // Dispatch all currently stored
        execute(`
          UPDATE biomedical_waste
          SET status = 'Dispatched', disposal_vendor = ?, vehicle_no = ?, manifest_no = ?, compliance_cert = ?, dispatched_at = CURRENT_TIMESTAMP
          WHERE status = 'Stored' OR status = 'Collected'
        `, [vendor, veh, manifest, cert]);
      }

      res.json({
        success: true,
        manifest_no: manifest,
        compliance_cert: cert,
        message: `Biomedical waste consignment handed over to ${vendor}. Manifest #${manifest} generated.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- INVENTORY & PROCUREMENT ---
  router.get('/api/procurement/orders', (req, res) => {
    try {
      const orders = queryAll('SELECT * FROM purchase_orders ORDER BY id DESC');
      const ordersWithItems = orders.map(po => {
        const items = queryAll('SELECT * FROM purchase_order_items WHERE po_id = ?', [po.id]);
        return { ...po, items };
      });
      res.json(ordersWithItems);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/procurement/orders', (req, res) => {
    try {
      const { supplier_name, department, items, expected_delivery, created_by } = req.body || {};
      if (!supplier_name || !department || !items || items.length === 0) {
        return res.status(400).json({ error: 'supplier_name, department, and items list are required.' });
      }

      const totalAmount = items.reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.unit_price || 0)), 0);
      const poNo = 'PO-2026-' + Math.floor(100 + Math.random() * 900);

      const poInsert = execute(`
        INSERT INTO purchase_orders (po_no, supplier_name, department, total_amount, status, created_by, expected_delivery)
        VALUES (?, ?, ?, ?, 'Approved', ?, ?)
      `, [poNo, supplier_name, department, totalAmount, created_by || 'Vikram Patel', expected_delivery || '2026-10-01']);

      const poId = poInsert.lastInsertRowid;
      for (const it of items) {
        execute(`
          INSERT INTO purchase_order_items (po_id, item_name, item_code, quantity, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [poId, it.name, it.code || 'ITEM-' + Math.floor(100 + Math.random() * 900), it.quantity, it.unit_price, Number(it.quantity) * Number(it.unit_price)]);
      }

      res.status(201).json({
        success: true,
        po_id: poId,
        po_no: poNo,
        total_amount: totalAmount,
        message: `Purchase Order ${poNo} created and approved.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/inventory/movements', (req, res) => {
    try {
      const movements = queryAll('SELECT * FROM stock_movements ORDER BY id DESC LIMIT 50');
      res.json(movements);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/inventory/movements', (req, res) => {
    try {
      const { movement_type, item_type, item_id, item_code, item_name, batch_no, qty_change, reference_no, notes, performed_by } = req.body || {};
      if (!movement_type || !item_code || qty_change === undefined) {
        return res.status(400).json({ error: 'movement_type, item_code, and qty_change are required.' });
      }

      let balanceAfter = 100;
      if (item_type === 'Pharmacy' && item_id) {
        execute('UPDATE pharmacy_items SET stock_qty = stock_qty + ? WHERE id = ?', [qty_change, item_id]);
        const item = queryOne('SELECT stock_qty FROM pharmacy_items WHERE id = ?', [item_id]);
        if (item) balanceAfter = item.stock_qty;
      } else if (item_id) {
        execute('UPDATE inventory_items SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?', [qty_change, item_id]);
        const item = queryOne('SELECT quantity_in_stock FROM inventory_items WHERE id = ?', [item_id]);
        if (item) balanceAfter = item.quantity_in_stock;
      }

      const insert = execute(`
        INSERT INTO stock_movements (movement_type, item_type, item_id, item_code, item_name, batch_no, qty_change, balance_after, reference_no, notes, performed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [movement_type, item_type || 'Pharmacy', item_id || 1, item_code, item_name || item_code, batch_no || 'N/A', qty_change, balanceAfter, reference_no || 'ADJ-MANUAL', notes || '', performed_by || 'Staff']);

      res.status(201).json({ success: true, movement_id: insert.lastInsertRowid, balance_after: balanceAfter });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- BILLING ADVANCES & DEPOSITS ---
  router.get('/api/billing/advances', (req, res) => {
    try {
      const advances = queryAll(`
        SELECT a.*, p.patient_code, p.uhid, p.first_name || ' ' || p.last_name as patient_name
        FROM billing_advances a
        JOIN patients p ON a.patient_id = p.id
        ORDER BY a.id DESC
      `);
      res.json(advances);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/billing/advances', (req, res) => {
    try {
      const { patient_id, ipd_id, amount, payment_mode, purpose, collected_by } = req.body || {};
      if (!patient_id || !amount) {
        return res.status(400).json({ error: 'patient_id and amount are required.' });
      }

      const receiptNo = 'ADV-2026-' + Math.floor(100 + Math.random() * 900);
      const insert = execute(`
        INSERT INTO billing_advances (receipt_no, patient_id, ipd_id, amount, payment_mode, purpose, collected_by, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Settled')
      `, [receiptNo, patient_id, ipd_id || null, amount, payment_mode || 'Cash', purpose || 'IPD Admission Advance Deposit', collected_by || 'Cashier']);

      res.status(201).json({
        success: true,
        advance_id: insert.lastInsertRowid,
        receipt_no: receiptNo,
        amount,
        message: `Advance deposit of $${amount} received. Receipt #${receiptNo} generated.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- 12 ROLE WORKSPACE PORTAL SUMMARIES ---
  router.get('/api/portal/:role/summary', (req, res) => {
    try {
      const role = req.params.role;
      let summary = {};

      switch (role) {
        case 'doctor': {
          const waitingOpd = queryAll("SELECT q.*, p.first_name || ' ' || p.last_name as patient_name, p.patient_code, p.uhid FROM opd_queue q JOIN patients p ON q.patient_id = p.id WHERE q.status = 'Waiting' ORDER BY q.token_no");
          const myPatients = queryAll("SELECT ipd.*, p.first_name || ' ' || p.last_name as patient_name, p.uhid FROM ipd_admissions ipd JOIN patients p ON ipd.patient_id = p.id WHERE ipd.status = 'Admitted'");
          const pendingLabs = queryAll("SELECT lo.*, lt.test_name, p.first_name || ' ' || p.last_name as patient_name FROM lab_orders lo JOIN lab_tests lt ON lo.test_id = lt.id JOIN patients p ON lo.patient_id = p.id WHERE lo.status = 'Pending' LIMIT 5");
          summary = {
            role: 'Doctor Workstation',
            opd_queue: waitingOpd,
            admitted_patients: myPatients,
            pending_lab_orders: pendingLabs,
            stats: { waiting_count: waitingOpd.length, inpatients_count: myPatients.length }
          };
          break;
        }
        case 'nurse': {
          const occupiedBeds = queryAll("SELECT b.*, p.first_name || ' ' || p.last_name as patient_name, p.uhid FROM beds b LEFT JOIN patients p ON b.current_patient_id = p.id WHERE b.status = 'Occupied'");
          const cleaningBeds = queryAll("SELECT * FROM beds WHERE status = 'Cleaning'");
          const recentVitals = queryAll("SELECT nr.*, p.first_name || ' ' || p.last_name as patient_name FROM nursing_records nr JOIN patients p ON nr.patient_id = p.id ORDER BY nr.id DESC LIMIT 5");
          summary = {
            role: 'Nursing Station',
            occupied_beds: occupiedBeds,
            beds_needing_cleaning: cleaningBeds,
            recent_vitals: recentVitals,
            stats: { active_bed_count: occupiedBeds.length, cleaning_count: cleaningBeds.length }
          };
          break;
        }
        case 'receptionist': {
          const todayTokens = queryAll("SELECT q.*, p.first_name || ' ' || p.last_name as patient_name, p.uhid, d.full_name as doctor_name FROM opd_queue q JOIN patients p ON q.patient_id = p.id JOIN doctors d ON q.doctor_id = d.id ORDER BY q.token_no DESC");
          const scheduledAppts = queryAll("SELECT a.*, p.first_name || ' ' || p.last_name as patient_name, d.full_name as doctor_name FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id WHERE a.status = 'Scheduled' LIMIT 10");
          summary = {
            role: 'Front Desk & Reception Desk',
            queue: todayTokens,
            appointments: scheduledAppts,
            stats: { tokens_issued: todayTokens.length, upcoming_appointments: scheduledAppts.length }
          };
          break;
        }
        case 'pharmacist': {
          const pendingRx = queryAll("SELECT rx.*, p.first_name || ' ' || p.last_name as patient_name, p.uhid, d.full_name as doctor_name FROM prescriptions rx JOIN patients p ON rx.patient_id = p.id JOIN doctors d ON rx.doctor_id = d.id WHERE rx.status = 'Pending Dispense'");
          const lowStock = queryAll("SELECT * FROM pharmacy_items WHERE stock_qty <= reorder_level");
          summary = {
            role: 'Central Pharmacy Counter',
            pending_prescriptions: pendingRx,
            low_stock_items: lowStock,
            stats: { pending_rx_count: pendingRx.length, low_stock_count: lowStock.length }
          };
          break;
        }
        case 'lab': {
          const pendingOrders = queryAll("SELECT lo.*, lt.test_name, lt.category as test_category, lt.sample_type, p.first_name || ' ' || p.last_name as patient_name, p.uhid FROM lab_orders lo JOIN lab_tests lt ON lo.test_id = lt.id JOIN patients p ON lo.patient_id = p.id WHERE lo.status = 'Pending'");
          const completedOrders = queryAll("SELECT lo.*, lt.test_name, p.first_name || ' ' || p.last_name as patient_name FROM lab_orders lo JOIN lab_tests lt ON lo.test_id = lt.id JOIN patients p ON lo.patient_id = p.id WHERE lo.status = 'Completed' LIMIT 5");
          summary = {
            role: 'Laboratory Diagnostic Station',
            pending_orders: pendingOrders,
            completed_orders: completedOrders,
            stats: { pending_samples: pendingOrders.length, verified_today: completedOrders.length }
          };
          break;
        }
        case 'radiology': {
          const orders = queryAll("SELECT ro.*, p.first_name || ' ' || p.last_name as patient_name, p.uhid, d.full_name as doctor_name FROM radiology_orders ro JOIN patients p ON ro.patient_id = p.id JOIN doctors d ON ro.doctor_id = d.id ORDER BY ro.id DESC");
          summary = {
            role: 'Radiology & Imaging Hub',
            orders,
            stats: { total_scans: orders.length, scheduled: orders.filter(o => o.status === 'Scheduled').length }
          };
          break;
        }
        case 'billing': {
          const invoices = queryAll("SELECT b.*, p.first_name || ' ' || p.last_name as patient_name, p.uhid FROM billing_invoices b JOIN patients p ON b.patient_id = p.id ORDER BY b.id DESC LIMIT 10");
          const advances = queryAll("SELECT a.*, p.first_name || ' ' || p.last_name as patient_name FROM billing_advances a JOIN patients p ON a.patient_id = p.id ORDER BY a.id DESC LIMIT 5");
          const totalPaid = queryOne("SELECT COALESCE(SUM(paid_amount), 0) as sum FROM billing_invoices").sum;
          const totalDue = queryOne("SELECT COALESCE(SUM(due_amount), 0) as sum FROM billing_invoices").sum;
          summary = {
            role: 'Billing & Cashier Terminal',
            invoices,
            advances,
            stats: { total_paid: totalPaid, total_due: totalDue, invoice_count: invoices.length }
          };
          break;
        }
        case 'inventory': {
          const orders = queryAll("SELECT * FROM purchase_orders ORDER BY id DESC LIMIT 5");
          const movements = queryAll("SELECT * FROM stock_movements ORDER BY id DESC LIMIT 10");
          const lowStockGeneral = queryAll("SELECT * FROM inventory_items WHERE quantity_in_stock <= min_reorder_qty");
          summary = {
            role: 'Procurement & Inventory Desk',
            purchase_orders: orders,
            recent_movements: movements,
            low_stock_items: lowStockGeneral,
            stats: { po_count: orders.length, low_stock_count: lowStockGeneral.length }
          };
          break;
        }
        case 'hr': {
          const employees = queryAll("SELECT e.*, d.name as department_name FROM employees_hr e LEFT JOIN departments d ON e.department_id = d.id");
          const payroll = queryAll("SELECT p.*, e.full_name as employee_name FROM payroll_records p JOIN employees_hr e ON p.employee_id = e.id LIMIT 5");
          summary = {
            role: 'Human Resources & Roster Office',
            employees,
            payroll,
            stats: { total_staff: employees.length, active_staff: employees.filter(e => e.status === 'Active').length }
          };
          break;
        }
        case 'superadmin':
        case 'admin': {
          const bedCounts = {
            total: queryOne("SELECT COUNT(*) as count FROM beds").count,
            occupied: queryOne("SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'").count,
            available: queryOne("SELECT COUNT(*) as count FROM beds WHERE status = 'Available'").count
          };
          const wasteStats = queryOne("SELECT COALESCE(SUM(weight_kg), 0) as total_kg FROM biomedical_waste").total_kg;
          summary = {
            role: 'Executive & Facility Administration',
            bed_metrics: bedCounts,
            biomedical_waste_kg: wasteStats,
            recent_audit: queryAll("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8")
          };
          break;
        }
        case 'patient': {
          const myAppts = queryAll("SELECT a.*, d.full_name as doctor_name, d.specialization FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.patient_id = 1");
          const myRx = queryAll("SELECT rx.*, d.full_name as doctor_name FROM prescriptions rx JOIN doctors d ON rx.doctor_id = d.id WHERE rx.patient_id = 1");
          const myLabs = queryAll("SELECT lo.*, lt.test_name FROM lab_orders lo JOIN lab_tests lt ON lo.test_id = lt.id WHERE lo.patient_id = 1");
          const myBills = queryAll("SELECT * FROM billing_invoices WHERE patient_id = 1");
          summary = {
            role: 'Patient Health Portal',
            appointments: myAppts,
            prescriptions: myRx,
            lab_reports: myLabs,
            invoices: myBills
          };
          break;
        }
        default: {
          summary = { role, message: 'Portal operational' };
        }
      }

      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerRoutes };
