const crypto = require('node:crypto');
const { getDb, initSchema, execute } = require('./db');

function hashPassword(password) {
  // Deterministic SHA-256 for test seed predictability
  return crypto.createHash('sha256').update(password + 'epichms_salt').digest('hex');
}

function seedDatabase() {
  const db = getDb();
  initSchema();

  console.log('[EpicHMS Seed] Clearing existing tables...');
  const tables = [
    'communication_logs', 'notifications', 'document_files', 'audit_logs',
    'helpdesk_tickets', 'assets_maintenance', 'payroll_records', 'employees_hr',
    'housekeeping_tasks', 'mortuary_records', 'diet_plans', 'ambulance_fleet',
    'medical_records', 'discharge_summaries', 'blood_bank_units', 'goods_receipts',
    'purchase_order_items', 'purchase_orders', 'stock_movements', 'inventory_items',
    'biomedical_waste', 'billing_advances', 'insurance_claims', 'billing_items', 'billing_invoices',
    'nursing_records', 'operation_theatre', 'radiology_orders', 'lab_orders', 'lab_tests',
    'prescription_items', 'prescriptions', 'pharmacy_items', 'emergency_cases',
    'bed_transfers', 'beds', 'buildings_floors', 'branches', 'hospitals', 'organizations',
    'ipd_admissions', 'opd_queue', 'appointments', 'patients', 'doctors',
    'departments', 'users', 'system_settings'
  ];

  db.exec('PRAGMA foreign_keys = OFF;');
  for (const table of tables) {
    db.exec(`DELETE FROM ${table};`);
    try {
      db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
    } catch (e) {}
  }
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('[EpicHMS Seed] Seeding Multi-Tenancy Organization Hierarchy...');
  const insertOrg = db.prepare(`
    INSERT INTO organizations (org_code, name, tax_id, address, contact_email, contact_phone, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Active')
  `);
  insertOrg.run('ORG-001', 'Epic Healthcare Group', 'TAX-89210-EPC', '700 Ocean Boulevard, Tech City', 'contact@epichealth.org', '+1-800-555-0199');

  const insertHosp = db.prepare(`
    INSERT INTO hospitals (org_id, hospital_code, name, type, license_no, phone, email, address, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
  `);
  insertHosp.run(1, 'HOSP-01', 'Epic Central Hospital', 'Multi-Specialty Tertiary Care & Research Center', 'LIC-2026-MED-99', '+1-555-0190', 'info@epiccentral.org', '100 Medical Campus Way');

  const insertBranch = db.prepare(`
    INSERT INTO branches (hospital_id, branch_code, name, city, address, phone, is_main, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
  `);
  insertBranch.run(1, 'BR-01', 'Epic Central Hospital - Main Campus', 'Hyderabad', 'Financial District, Gachibowli', '+91-40-555-0100', 1);
  insertBranch.run(1, 'BR-02', 'Epic Specialty Clinic - Jubilee Hills', 'Hyderabad', 'Road No 36, Jubilee Hills', '+91-40-555-0200', 0);

  const insertBldg = db.prepare(`
    INSERT INTO buildings_floors (branch_id, building_name, floor_number, floor_name, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertBldg.run(1, 'Block A - Critical Care & Surgery Tower', 1, '1st Floor - Emergency & Resuscitation', 'Level-1 Trauma & Emergency');
  insertBldg.run(1, 'Block A - Critical Care & Surgery Tower', 2, '2nd Floor - Intensive Care Units (ICU/NICU)', 'Critical Care Services');
  insertBldg.run(1, 'Block A - Critical Care & Surgery Tower', 3, '3rd Floor - Operation Theatres & Cath Lab', 'Surgical Suites & Interventional Labs');
  insertBldg.run(1, 'Block B - Ambulatory & Diagnostics Pavilion', 1, 'Ground Floor - Front Desk & Registration', 'Outpatient reception, Triage, Cashier');
  insertBldg.run(1, 'Block B - Ambulatory & Diagnostics Pavilion', 2, '2nd Floor - Pathology & Imaging Wing', 'Laboratory, MRI, CT Scan');

  console.log('[EpicHMS Seed] Seeding Users (12 CRD Roles with Account Status Separation)...');
  const defaultPasswordHash = hashPassword('pass123');

  const users = [
    { username: 'superadmin', email: 'superadmin@epichms.local', role: 'superadmin', full_name: 'Dr. Arthur Sterling', dept: 'Executive Suite', phone: '+1-555-0100', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'admin', email: 'admin@epichms.local', role: 'admin', full_name: 'Clara Oswald', dept: 'Hospital Administration', phone: '+1-555-0101', acct: 'Active', emp: 'Full-Time', clin: 'Off-Duty' },
    { username: 'doctor', email: 'doctor@epichms.local', role: 'doctor', full_name: 'Dr. Evelyn Reed, MD', dept: 'Cardiology & Vascular', phone: '+1-555-0102', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'nurse', email: 'nurse@epichms.local', role: 'nurse', full_name: 'Sarah Jenkins, RN', dept: 'Inpatient Nursing / ICU', phone: '+1-555-0103', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'pharmacist', email: 'pharmacist@epichms.local', role: 'pharmacist', full_name: 'James Chen, PharmD', dept: 'Central Pharmacy', phone: '+1-555-0104', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'lab', email: 'lab@epichms.local', role: 'lab', full_name: 'Dr. Julian Bashir, MSc', dept: 'Pathology & Clinical Lab', phone: '+1-555-0107', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'radiology', email: 'radiology@epichms.local', role: 'radiology', full_name: 'Elena Rostova, RT', dept: 'Radiology & Imaging', phone: '+1-555-0108', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'receptionist', email: 'receptionist@epichms.local', role: 'receptionist', full_name: 'Alice Walker', dept: 'Front Desk & OPD Registration', phone: '+1-555-0106', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'billing', email: 'billing@epichms.local', role: 'billing', full_name: 'Marcus Thorne, CPA', dept: 'Revenue & Patient Accounts', phone: '+1-555-0109', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'inventory', email: 'inventory@epichms.local', role: 'inventory', full_name: 'Vikram Patel', dept: 'Supply Chain & Procurement', phone: '+1-555-0110', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'hr', email: 'hr@epichms.local', role: 'hr', full_name: 'Beatrice Stone', dept: 'Human Resources & Talent', phone: '+1-555-0111', acct: 'Active', emp: 'Full-Time', clin: 'Available' },
    { username: 'patient', email: 'patient@epichms.local', role: 'patient', full_name: 'Johnathan Vance', dept: 'Outpatient Services', phone: '+1-555-0105', acct: 'Active', emp: 'Full-Time', clin: 'Off-Duty' },
    // Backward compatibility for legacy tests
    { username: 'staff', email: 'staff@epichms.local', role: 'staff', full_name: 'Alice Walker', dept: 'Front Desk Operations', phone: '+1-555-0106', acct: 'Active', emp: 'Full-Time', clin: 'Available' }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, role, full_name, department, phone, account_status, employment_status, clinical_status, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);
  for (const u of users) {
    insertUser.run(u.username, u.email, defaultPasswordHash, u.role, u.full_name, u.dept, u.phone, u.acct, u.emp, u.clin);
  }

  console.log('[EpicHMS Seed] Seeding Departments...');
  const departments = [
    { code: 'CARD', name: 'Cardiology & Vascular', desc: 'Comprehensive cardiac diagnostics, interventional catheterization, and post-infarct rehabilitation.', head: 'Dr. Evelyn Reed', loc: 'Block A, 3rd Floor', phone: 'Ext. 301', beds: 35 },
    { code: 'NEUR', name: 'Neurology & Neurosurgery', desc: 'Advanced stroke care, epilepsy monitoring, neuro-oncology, and spine surgery.', head: 'Dr. Marcus Vance', loc: 'Block B, 4th Floor', phone: 'Ext. 402', beds: 30 },
    { code: 'ORTH', name: 'Orthopedics & Joint Replacement', desc: 'Arthroscopy, trauma surgery, joint reconstruction, and sports medicine.', head: 'Dr. Robert Miller', loc: 'Block A, 1st Floor', phone: 'Ext. 104', beds: 40 },
    { code: 'PEDI', name: 'Pediatrics & Neonatal Care', desc: 'Comprehensive pediatric care, NICU, PICU, and childhood immunization.', head: 'Dr. Sophia Martinez', loc: 'Block C, 2nd Floor', phone: 'Ext. 208', beds: 25 },
    { code: 'ONCO', name: 'Medical & Surgical Oncology', desc: 'Precision cancer chemotherapy, radiation therapy, and surgical resection.', head: 'Dr. Diane Thorne', loc: 'Block D, Ground Floor', phone: 'Ext. 505', beds: 28 },
    { code: 'EMER', name: 'Emergency & Trauma Care', desc: '24/7 Level-1 trauma resuscitation, acute cardiac and stroke response unit.', head: 'Dr. Gregory Chase', loc: 'Ground Floor, North Gate', phone: 'Ext. 911', beds: 20 },
    { code: 'GENM', name: 'General & Internal Medicine', desc: 'Diabetic management, infectious diseases, preventive care, and geriatric health.', head: 'Dr. Laura Palmer', loc: 'Block B, 2nd Floor', phone: 'Ext. 201', beds: 45 },
    { code: 'RADS', name: 'Radiology & Diagnostic Imaging', desc: '3T MRI, 128-slice CT, digital fluoroscopy, ultrasound, and mammography.', head: 'Dr. Nathan Drake', loc: 'Basement 1, Diagnostic Wing', phone: 'Ext. 112', beds: 0 }
  ];

  const insertDept = db.prepare(`
    INSERT INTO departments (dept_code, name, description, head_doctor_name, location, phone, total_beds)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const d of departments) {
    insertDept.run(d.code, d.name, d.desc, d.head, d.loc, d.phone, d.beds);
  }

  console.log('[EpicHMS Seed] Seeding Doctors...');
  const doctors = [
    { code: 'DOC-101', name: 'Dr. Evelyn Reed, MD', deptId: 1, spec: 'Interventional Cardiology', qual: 'MD (Cardiology), FACC', room: 'A-302', fee: 850, days: 'Mon,Tue,Wed,Thu,Fri', shift: '09:00 - 15:00' },
    { code: 'DOC-102', name: 'Dr. Marcus Vance, MD', deptId: 2, spec: 'Neurovascular Surgery', qual: 'MD, MCh (Neurosurgery)', room: 'B-405', fee: 950, days: 'Mon,Wed,Fri', shift: '10:00 - 16:00' },
    { code: 'DOC-103', name: 'Dr. Robert Miller, MS', deptId: 3, spec: 'Orthopedic & Joint Surgeon', qual: 'MS (Orthopedics), FRCS', room: 'A-108', fee: 700, days: 'Tue,Thu,Sat', shift: '09:00 - 14:00' },
    { code: 'DOC-104', name: 'Dr. Sophia Martinez, MD', deptId: 4, spec: 'Pediatric Pulmonology', qual: 'MD (Pediatrics), FAAP', room: 'C-204', fee: 650, days: 'Mon,Tue,Wed,Thu,Fri', shift: '08:30 - 14:30' },
    { code: 'DOC-105', name: 'Dr. Gregory Chase, MBBS', deptId: 6, spec: 'Emergency Medicine', qual: 'MBBS, FACEM, Dip. Trauma', room: 'ER-01', fee: 500, days: 'Mon,Tue,Wed,Thu,Fri,Sat', shift: '14:00 - 22:00' },
    { code: 'DOC-106', name: 'Dr. Laura Palmer, MD', deptId: 7, spec: 'Internal Medicine & Endocrinology', qual: 'MD (Internal Med), MRCP', room: 'B-201', fee: 600, days: 'Mon,Tue,Wed,Thu,Sat', shift: '09:00 - 17:00' }
  ];

  const insertDoctor = db.prepare(`
    INSERT INTO doctors (doctor_code, full_name, department_id, specialization, qualification, room_no, consultation_fee, available_days, shift_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const doc of doctors) {
    insertDoctor.run(doc.code, doc.name, doc.deptId, doc.spec, doc.qual, doc.room, doc.fee, doc.days, doc.shift);
  }

  console.log('[EpicHMS Seed] Seeding Patients with UHID & Duplication Check...');
  const patients = [
    { code: 'P-1001', uhid: 'UHID-2026-000101', fname: 'Johnathan', lname: 'Vance', gender: 'Male', dob: '1984-06-14', age: 42, bg: 'O+', phone: '+1-555-4321', email: 'patient@epichms.local', addr: '742 Evergreen Terrace, Springfield', emg: 'Emily Vance (+1-555-4322)', alg: 'Penicillin, Shellfish' },
    { code: 'P-1002', uhid: 'UHID-2026-000102', fname: 'Eleanor', lname: 'Rigby', gender: 'Female', dob: '1965-03-22', age: 61, bg: 'A+', phone: '+1-555-8812', email: 'eleanor.rigby@example.com', addr: '12 Abbey Road, Liverpool', emg: 'Father McKenzie (+1-555-8813)', alg: 'Sulfa Drugs' },
    { code: 'P-1003', uhid: 'UHID-2026-000103', fname: 'Michael', lname: 'Corleone', gender: 'Male', dob: '1976-11-05', age: 50, bg: 'B+', phone: '+1-555-9921', email: 'm.corleone@example.com', addr: '110 Long Beach Road, NY', emg: 'Kay Adams (+1-555-9922)', alg: 'None Reported' },
    { code: 'P-1004', uhid: 'UHID-2026-000104', fname: 'Aria', lname: 'Stark', gender: 'Female', dob: '2004-09-18', age: 22, bg: 'AB-', phone: '+1-555-7734', email: 'aria.stark@example.com', addr: 'Winterfell Manor, Suite 3', emg: 'Jon Snow (+1-555-7735)', alg: 'Ibuprofen' },
    { code: 'P-1005', uhid: 'UHID-2026-000105', fname: 'David', lname: 'Copperfield', gender: 'Male', dob: '1990-01-30', age: 36, bg: 'O-', phone: '+1-555-2345', email: 'david.c@example.com', addr: '45 Bleak House Court, London', emg: 'Agnes Wickfield (+1-555-2346)', alg: 'Aspirin' },
    { code: 'P-1006', uhid: 'UHID-2026-000106', fname: 'Beatrice', lname: 'Prior', gender: 'Female', dob: '2001-05-12', age: 25, bg: 'A-', phone: '+1-555-6677', email: 'beatrice.p@example.com', addr: 'Abnegation Sector 4, Chicago', emg: 'Tobias Eaton (+1-555-6678)', alg: 'None Reported' }
  ];

  const insertPatient = db.prepare(`
    INSERT INTO patients (patient_code, uhid, first_name, last_name, gender, dob, age, blood_group, phone, email, address, emergency_contact, allergies)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of patients) {
    insertPatient.run(p.code, p.uhid, p.fname, p.lname, p.gender, p.dob, p.age, p.bg, p.phone, p.email, p.addr, p.emg, p.alg);
  }

  console.log('[EpicHMS Seed] Seeding Appointments & OPD Queue...');
  const appointments = [
    { no: 'APT-2026-001', patientId: 1, docId: 1, deptId: 1, date: '2026-09-17', slot: '09:30 AM', type: 'Consultation', sym: 'Recurrent palpitation, exertional dyspnea, occasional chest tightness', status: 'In-Consultation' },
    { no: 'APT-2026-002', patientId: 2, docId: 2, deptId: 2, date: '2026-09-17', slot: '10:15 AM', type: 'Follow-up', sym: 'Post-migraine visual aura review, medication titration', status: 'Scheduled' },
    { no: 'APT-2026-003', patientId: 3, docId: 3, deptId: 3, date: '2026-09-17', slot: '11:00 AM', type: 'Consultation', sym: 'Left knee effusion and severe medial joint pain following minor stumble', status: 'Scheduled' },
    { no: 'APT-2026-004', patientId: 4, docId: 4, deptId: 4, date: '2026-09-18', slot: '09:00 AM', type: 'Routine Checkup', sym: 'Annual pediatric health assessment and asthma maintenance review', status: 'Scheduled' },
    { no: 'APT-2026-005', patientId: 5, docId: 6, deptId: 7, date: '2026-09-18', slot: '10:30 AM', type: 'Consultation', sym: 'HbA1c elevated (8.4%), polyuria, fatigue, glycemic variability', status: 'Confirmed' }
  ];

  const insertApt = db.prepare(`
    INSERT INTO appointments (appointment_no, patient_id, doctor_id, department_id, appointment_date, time_slot, visit_type, symptoms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of appointments) {
    insertApt.run(a.no, a.patientId, a.docId, a.deptId, a.date, a.slot, a.type, a.sym, a.status);
  }

  // OPD Queue Tokens
  const opdList = [
    { token: 101, aptId: 1, pId: 1, dId: 1, checkIn: '09:15 AM', bp: '138/88 mmHg', pulse: '84 bpm', temp: '98.6 F', wt: '78 kg', spo2: '98%', notes: 'ECG recommended. Patient reports intermittent stress episodes.', status: 'In-Consultation' },
    { token: 102, aptId: 2, pId: 2, dId: 2, checkIn: '09:45 AM', bp: '124/80 mmHg', pulse: '72 bpm', temp: '98.4 F', wt: '62 kg', spo2: '99%', notes: 'Awaiting neurologist review.', status: 'Waiting' },
    { token: 103, aptId: 3, pId: 3, dId: 3, checkIn: '10:10 AM', bp: '130/82 mmHg', pulse: '76 bpm', temp: '98.8 F', wt: '85 kg', spo2: '98%', notes: 'Bilateral knee X-Ray requested prior to physical exam.', status: 'Waiting' }
  ];

  const insertOpd = db.prepare(`
    INSERT INTO opd_queue (token_no, appointment_id, patient_id, doctor_id, check_in_time, vital_bp, vital_pulse, vital_temp, vital_weight, vital_spo2, doctor_notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const o of opdList) {
    insertOpd.run(o.token, o.aptId, o.pId, o.dId, o.checkIn, o.bp, o.pulse, o.temp, o.wt, o.spo2, o.notes, o.status);
  }

  console.log('[EpicHMS Seed] Seeding IPD Admissions & Emergency...');
  const ipdList = [
    { code: 'IPD-2026-088', patientId: 2, docId: 1, deptId: 1, ward: 'ICU', bed: 'ICU-Bed-04', diag: 'Non-ST-Elevation Myocardial Infarction (NSTEMI)', cond: 'Critical but Stable', status: 'Admitted' },
    { code: 'IPD-2026-089', patientId: 5, docId: 6, deptId: 7, ward: 'General Male', bed: 'GM-Bed-12', diag: 'Severe Diabetic Ketoacidosis with electrolyte imbalance', cond: 'Improving', status: 'Admitted' },
    { code: 'IPD-2026-090', patientId: 6, docId: 3, deptId: 3, ward: 'Private Deluxe', bed: 'PD-Bed-201', diag: 'Compound fracture right tibia/fibula, post-ORIF surgery', cond: 'Stable', status: 'Admitted' }
  ];

  const insertIpd = db.prepare(`
    INSERT INTO ipd_admissions (ipd_code, patient_id, attending_doctor_id, department_id, ward, bed_no, admitting_diagnosis, current_condition, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ip of ipdList) {
    insertIpd.run(ip.code, ip.patientId, ip.docId, ip.deptId, ip.ward, ip.bed, ip.diag, ip.cond, ip.status);
  }

  // Emergency Cases
  const emergencyCases = [
    { no: 'ER-CASE-501', name: 'Marcus Brody', age: 34, gender: 'Male', triage: 'Level 1 (Resuscitation / Red)', trauma: 'High-speed motor vehicle collision, multi-trauma', arrival: 'Ambulance Unit 03', vitals: 'BP 90/60, HR 128, SpO2 91%', doctor: 'Dr. Gregory Chase', status: 'Under Treatment' },
    { no: 'ER-CASE-502', name: 'Clara Bennett', age: 58, gender: 'Female', triage: 'Level 2 (Emergent / Orange)', trauma: 'Acute left-sided hemiparesis and facial droop (Code Stroke)', arrival: 'Walk-in with family', vitals: 'BP 175/105, HR 92, SpO2 97%', doctor: 'Dr. Marcus Vance', status: 'Under Treatment' },
    { no: 'ER-CASE-503', name: 'Tommy Clark', age: 14, gender: 'Male', triage: 'Level 3 (Urgent / Yellow)', trauma: 'Deep laceration right forearm with active bleeding', arrival: 'Walk-in', vitals: 'BP 118/74, HR 80, SpO2 99%', doctor: 'Dr. Robert Miller', status: 'Under Treatment' }
  ];

  const insertEr = db.prepare(`
    INSERT INTO emergency_cases (case_no, patient_name, age, gender, triage_level, trauma_type, arrival_mode, vitals_summary, attending_doctor, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const er of emergencyCases) {
    insertEr.run(er.no, er.name, er.age, er.gender, er.triage, er.trauma, er.arrival, er.vitals, er.doctor, er.status);
  }

  console.log('[EpicHMS Seed] Seeding Pharmacy Items & Prescriptions...');
  const drugs = [
    { code: 'DRUG-001', name: 'Amoxicillin + Clavulanic Acid 625mg', generic: 'Amoxicillin / Clavulanate', cat: 'Antibiotics', form: 'Tablet', price: 18.50, stock: 450, reorder: 80, exp: '2027-08-30', batch: 'AMX-2026A', mfg: 'GlaxoSmithKline' },
    { code: 'DRUG-002', name: 'Atorvastatin 20mg', generic: 'Atorvastatin Calcium', cat: 'Cardiovascular', form: 'Tablet', price: 12.00, stock: 600, reorder: 100, exp: '2027-11-15', batch: 'ATV-8819', mfg: 'Pfizer' },
    { code: 'DRUG-003', name: 'Metformin Hydrochloride 500mg ER', generic: 'Metformin HCl', cat: 'Antidiabetic', form: 'Tablet', price: 6.50, stock: 1200, reorder: 200, exp: '2028-02-28', batch: 'MET-4412', mfg: 'Merck' },
    { code: 'DRUG-004', name: 'Paracetamol IV 100ml Infusion', generic: 'Acetaminophen', cat: 'Analgesic / Antipyretic', form: 'IV Infusion', price: 95.00, stock: 180, reorder: 40, exp: '2027-05-10', batch: 'PCM-1002', mfg: 'Fresenius Kabi' },
    { code: 'DRUG-005', name: 'Pantoprazole 40mg IV Injection', generic: 'Pantoprazole Sodium', cat: 'Gastrointestinal', form: 'Injection', price: 54.00, stock: 240, reorder: 50, exp: '2027-09-01', batch: 'PAN-9943', mfg: 'Sun Pharma' },
    { code: 'DRUG-006', name: 'Enoxaparin Sodium 40mg/0.4ml', generic: 'Low Molecular Weight Heparin', cat: 'Anticoagulant', form: 'Prefilled Syringe', price: 340.00, stock: 85, reorder: 25, exp: '2026-12-31', batch: 'ENO-7104', mfg: 'Sanofi' },
    { code: 'DRUG-007', name: 'Salbutamol Inhaler 100mcg', generic: 'Albuterol Sulfate', cat: 'Respiratory', form: 'Inhaler', price: 145.00, stock: 95, reorder: 30, exp: '2027-04-18', batch: 'SLB-5531', mfg: 'Cipla' },
    { code: 'DRUG-008', name: 'Normal Saline 0.9% 500ml', generic: 'Sodium Chloride IV', cat: 'IV Fluids', form: 'IV Infusion', price: 42.00, stock: 850, reorder: 150, exp: '2028-10-15', batch: 'NS-3321', mfg: 'Baxter' }
  ];

  const insertDrug = db.prepare(`
    INSERT INTO pharmacy_items (item_code, drug_name, generic_name, category, dosage_form, unit_price, stock_qty, reorder_level, expiry_date, batch_no, manufacturer)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const dg of drugs) {
    insertDrug.run(dg.code, dg.name, dg.generic, dg.cat, dg.form, dg.price, dg.stock, dg.reorder, dg.exp, dg.batch, dg.mfg);
  }

  // Prescriptions
  const insertRx = db.prepare(`
    INSERT INTO prescriptions (rx_no, patient_id, doctor_id, encounter_type, diagnosis, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertRx.run('RX-2026-1001', 1, 1, 'OPD', 'Essential Hypertension with Borderline Hyperlipidemia', 'Lifestyle modification + dietary salt reduction recommended.', 'Pending Dispense');
  insertRx.run('RX-2026-1002', 2, 1, 'IPD', 'Acute Coronary Syndrome / Post-Angioplasty Care', 'Initiate dual antiplatelet and high-intensity statin regimen.', 'Fully Dispensed');

  const insertRxItem = db.prepare(`
    INSERT INTO prescription_items (prescription_id, drug_id, dosage, frequency, duration_days, quantity, dispensed_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertRxItem.run(1, 2, '20mg', '1-0-0 (Once daily bedtime)', 30, 30, 'Pending');
  insertRxItem.run(1, 3, '500mg', '1-0-1 (Twice daily with meals)', 30, 60, 'Pending');
  insertRxItem.run(2, 2, '40mg', '1-0-0 (Once daily bedtime)', 14, 14, 'Dispensed');
  insertRxItem.run(2, 6, '40mg/0.4ml', 'Once daily SubQ', 5, 5, 'Dispensed');

  console.log('[EpicHMS Seed] Seeding Laboratory Tests & Orders...');
  const labTests = [
    { code: 'LAB-CBC', name: 'Complete Blood Count (CBC with Automated Diff)', cat: 'Hematology', sample: 'Whole Blood (EDTA)', fee: 450, range: 'Hb: 13.5-17.5 g/dL, WBC: 4000-11000 /uL', units: 'Standard' },
    { code: 'LAB-LFT', name: 'Comprehensive Liver Function Test (LFT)', cat: 'Biochemistry', sample: 'Serum', fee: 750, range: 'Bilirubin: 0.2-1.2 mg/dL, ALT: 7-56 U/L', units: 'mg/dL, U/L' },
    { code: 'LAB-KFT', name: 'Kidney Function Test (BUN, Creatinine, Electrolytes)', cat: 'Biochemistry', sample: 'Serum', fee: 650, range: 'Creatinine: 0.7-1.3 mg/dL, BUN: 7-20 mg/dL', units: 'mg/dL' },
    { code: 'LAB-LIPID', name: 'Lipid Profile Extended', cat: 'Biochemistry', sample: 'Fasting Serum', fee: 800, range: 'Total Chol: <200 mg/dL, LDL: <100 mg/dL', units: 'mg/dL' },
    { code: 'LAB-TROP', name: 'High-Sensitivity Troponin-I (Cardiac Marker)', cat: 'Biochemistry', sample: 'Plasma (Heparin)', fee: 1200, range: '< 14 ng/L', units: 'ng/L' },
    { code: 'LAB-HBA1C', name: 'Glycated Hemoglobin (HbA1c)', cat: 'Hematology', sample: 'Whole Blood (EDTA)', fee: 550, range: 'Normal: 4.0 - 5.6%', units: '%' }
  ];

  const insertLabTest = db.prepare(`
    INSERT INTO lab_tests (test_code, test_name, category, sample_type, standard_fee, normal_range, units)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const lt of labTests) {
    insertLabTest.run(lt.code, lt.name, lt.cat, lt.sample, lt.fee, lt.range, lt.units);
  }

  const labOrders = [
    { no: 'LBO-2026-0041', pId: 1, dId: 1, tId: 4, status: 'Sample Collected', result: 'Pending Lab Run', flag: 'Normal', notes: 'Patient 12hr fasting confirmed at sample draw' },
    { no: 'LBO-2026-0042', pId: 2, dId: 1, tId: 5, status: 'Completed', result: '42.8 ng/L (Elevated)', flag: 'Critical', notes: 'Emergency stat result phoned directly to CCU attending' },
    { no: 'LBO-2026-0043', pId: 5, dId: 6, tId: 6, status: 'Completed', result: '8.4 %', flag: 'High', notes: 'Poor glycemic control documented over preceding quarter' }
  ];

  const insertLabOrder = db.prepare(`
    INSERT INTO lab_orders (order_no, patient_id, doctor_id, test_id, sample_status, test_result, normal_flag, technician_notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Approved')
  `);
  for (const lo of labOrders) {
    insertLabOrder.run(lo.no, lo.pId, lo.dId, lo.tId, lo.status, lo.result, lo.flag, lo.notes);
  }

  console.log('[EpicHMS Seed] Seeding Radiology & Operation Theatre...');
  const radOrders = [
    { req: 'RAD-2026-101', pId: 1, dId: 1, mod: 'Digital X-Ray', part: 'Chest PA View', ind: 'Rule out cardiomegaly, pulmonary congestion', find: 'Cardiothoracic ratio within normal limits. Clear costophrenic angles.', imp: 'No active cardiopulmonary disease detected.', status: 'Finalized' },
    { req: 'RAD-2026-102', pId: 3, dId: 3, mod: 'MRI 3.0T', part: 'Left Knee Joint', ind: 'Persistent medial pain, suspected meniscus tear', find: 'Complex tear posterior horn medial meniscus with mild joint effusion.', imp: 'Grade III medial meniscus tear. Recommend arthroscopic repair.', status: 'Report Prepared' },
    { req: 'RAD-2026-103', pId: 2, dId: 2, mod: 'CT Scan 128 Slice', part: 'Brain Non-Contrast', ind: 'Acute neurological deficit, rule out hemorrhage', find: 'No intracranial hemorrhage or midline shift. Subtle early ischemic change in right MCA territory.', imp: 'Acute right MCA ischemic stroke.', status: 'Finalized' }
  ];

  const insertRad = db.prepare(`
    INSERT INTO radiology_orders (req_no, patient_id, doctor_id, modality, body_part, clinical_indication, findings, impression, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ro of radOrders) {
    insertRad.run(ro.req, ro.pId, ro.dId, ro.mod, ro.part, ro.ind, ro.find, ro.imp, ro.status);
  }

  // Operation Theatre
  const otList = [
    { code: 'OT-2026-014', pId: 3, surgeonId: 3, anesth: 'Dr. Alan Harper', type: 'Arthroscopic Partial Meniscectomy', room: 'OT-3 (Ortho)', time: '2026-09-18 10:00:00', dur: '90 mins', status: 'Scheduled', notes: 'Pre-op clearance obtained. Spinal anesthesia planned.' },
    { code: 'OT-2026-015', pId: 6, surgeonId: 3, anesth: 'Dr. Alan Harper', type: 'Open Reduction & Internal Fixation (ORIF)', room: 'OT-3 (Ortho)', time: '2026-09-17 08:30:00', dur: '120 mins', status: 'Completed', notes: 'Tibial nail successfully positioned under fluoroscopy. No complications.' }
  ];

  const insertOt = db.prepare(`
    INSERT INTO operation_theatre (ot_code, patient_id, primary_surgeon_id, anesthetist_name, surgery_type, ot_room, scheduled_time, duration_est, status, post_op_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ot of otList) {
    insertOt.run(ot.code, ot.pId, ot.surgeonId, ot.anesth, ot.type, ot.room, ot.time, ot.dur, ot.status, ot.notes);
  }

  console.log('[EpicHMS Seed] Seeding Nursing & Medical Records (EMR)...');
  const nurseRecords = [
    { ipdId: 1, pId: 2, nurse: 'Sarah Jenkins, RN', bp: '122/78', hr: '74', resp: '16', spo2: '99%', temp: '36.8 C', med: 'Atorvastatin 40mg PO, Enoxaparin 40mg SubQ administered', notes: 'Patient resting comfortably. Pain score 1/10. Telemetry rhythm regular sinus.' },
    { ipdId: 2, pId: 5, nurse: 'Alice Cooper, RN', bp: '128/82', hr: '82', resp: '18', spo2: '98%', temp: '37.1 C', med: 'IV Normal Saline + Regular Insulin infusion per sliding scale', notes: 'Urine output 65 ml/hr. Capillary blood glucose 180 mg/dL.' }
  ];

  const insertNurse = db.prepare(`
    INSERT INTO nursing_records (ipd_id, patient_id, nurse_name, bp, heart_rate, resp_rate, spo2, temp_c, medication_given, nursing_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const nr of nurseRecords) {
    insertNurse.run(nr.ipdId, nr.pId, nr.nurse, nr.bp, nr.hr, nr.resp, nr.spo2, nr.temp, nr.med, nr.notes);
  }

  // EMR Records
  const emrList = [
    { emr: 'EMR-2026-0901', pId: 1, dId: 1, type: 'OPD', icd: 'I10', title: 'Essential (primary) Hypertension', notes: 'Stage 1 HTN. Commencing lifestyle intervention and low-dose ACEi therapy. Review in 4 weeks.', alg: 'Penicillin, Shellfish', hist: 'Family history of CAD (father, age 56)' },
    { emr: 'EMR-2026-0902', pId: 2, dId: 1, type: 'IPD', icd: 'I21.4', title: 'Non-ST elevation myocardial infarction', notes: 'Urgent angiography demonstrated 85% proximal LAD stenosis. Successful drug-eluting stent deployed.', alg: 'Sulfa Drugs', hist: 'T2DM for 12 years, hyperlipidemia' }
  ];

  const insertEmr = db.prepare(`
    INSERT INTO medical_records (emr_no, patient_id, doctor_id, encounter_type, icd10_code, diagnosis_title, clinical_notes, allergies_noted, past_history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const em of emrList) {
    insertEmr.run(em.emr, em.pId, em.dId, em.type, em.icd, em.title, em.notes, em.alg, em.hist);
  }

  console.log('[EpicHMS Seed] Seeding Billing, Invoices & Insurance Claims...');
  const invoices = [
    { no: 'INV-2026-1001', pId: 1, tot: 1300.0, disc: 100.0, tax: 60.0, net: 1260.0, paid: 1260.0, due: 0.0, mode: 'Credit Card', status: 'Paid' },
    { no: 'INV-2026-1002', pId: 2, tot: 14500.0, disc: 500.0, tax: 700.0, net: 14700.0, paid: 2000.0, due: 12700.0, mode: 'Insurance', status: 'Partial' },
    { no: 'INV-2026-1003', pId: 3, tot: 850.0, disc: 0.0, tax: 42.50, net: 892.50, paid: 892.50, due: 0.0, mode: 'UPI', status: 'Paid' }
  ];

  const insertInv = db.prepare(`
    INSERT INTO billing_invoices (invoice_no, patient_id, total_amount, discount_amount, tax_amount, net_amount, paid_amount, due_amount, payment_mode, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const inv of invoices) {
    insertInv.run(inv.no, inv.pId, inv.tot, inv.disc, inv.tax, inv.net, inv.paid, inv.due, inv.mode, inv.status);
  }

  // Invoice Items
  const insertBillItem = db.prepare(`
    INSERT INTO billing_items (invoice_id, item_type, description, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertBillItem.run(1, 'Consultation', 'Cardiology Specialist OPD Consultation (Dr. E. Reed)', 1, 850.0, 850.0);
  insertBillItem.run(1, 'Radiology', 'Chest PA Digital Radiograph', 1, 450.0, 450.0);
  insertBillItem.run(2, 'IPD Bed', 'Cardiac Intensive Care Unit (ICU) Room - Day 1 & 2', 2, 4500.0, 9000.0);
  insertBillItem.run(2, 'Surgery', 'Cardiac Catheterization & Coronary Angiogram', 1, 5500.0, 5500.0);
  insertBillItem.run(3, 'Consultation', 'Orthopedics Initial Consultation (Dr. R. Miller)', 1, 700.0, 700.0);
  insertBillItem.run(3, 'Pharmacy', 'Analgesic Gel & Joint Wrap Pack', 1, 150.0, 150.0);

  // Insurance Claims
  const claims = [
    { no: 'CLM-2026-7701', pId: 2, invId: 2, prov: 'Star Health & Allied Insurance', pol: 'SH-IND-994821', preAuth: 'PA-2026-8812', amt: 12700.0, app: 11500.0, status: 'Approved' },
    { no: 'CLM-2026-7702', pId: 5, invId: 2, prov: 'MedSave TPA Corporate Policy', pol: 'MS-CORP-4401', preAuth: 'PA-2026-8845', amt: 8400.0, app: 0.0, status: 'Under Review' }
  ];

  const insertClaim = db.prepare(`
    INSERT INTO insurance_claims (claim_no, patient_id, invoice_id, provider_name, policy_number, pre_auth_code, claim_amount, approved_amount, claim_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const clm of claims) {
    insertClaim.run(clm.no, clm.pId, clm.invId, clm.prov, clm.pol, clm.preAuth, clm.amt, clm.app, clm.status);
  }

  console.log('[EpicHMS Seed] Seeding Blood Bank & Inventory...');
  const bloodUnits = [
    { code: 'BLD-A-POS-01', group: 'A+', rh: 'Positive', comp: 'Packed RBC', donor: 'David Miller', phone: '+1-555-1201', col: '2026-09-01', exp: '2026-10-12', status: 'Available' },
    { code: 'BLD-O-NEG-01', group: 'O-', rh: 'Negative', comp: 'Whole Blood (Universal)', donor: 'Sarah Conner', phone: '+1-555-1202', col: '2026-09-05', exp: '2026-10-16', status: 'Available' },
    { code: 'BLD-B-POS-01', group: 'B+', rh: 'Positive', comp: 'Fresh Frozen Plasma', donor: 'Peter Parker', phone: '+1-555-1203', col: '2026-09-10', exp: '2027-09-10', status: 'Available' },
    { code: 'BLD-AB-POS-01', group: 'AB+', rh: 'Positive', comp: 'Single Donor Platelets', donor: 'Bruce Wayne', phone: '+1-555-1204', col: '2026-09-15', exp: '2026-09-20', status: 'Available' }
  ];

  const insertBlood = db.prepare(`
    INSERT INTO blood_bank_units (unit_code, blood_group, rhesus, component_type, donor_name, donor_phone, collection_date, expiry_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const bu of bloodUnits) {
    insertBlood.run(bu.code, bu.group, bu.rh, bu.comp, bu.donor, bu.phone, bu.col, bu.exp, bu.status);
  }

  // Inventory items
  const inventory = [
    { code: 'INV-SURG-01', name: 'N95 Respirator Masks (Box of 50)', cat: 'PPE & Hygiene', sup: '3M Healthcare Solutions', cost: 35.0, qty: 320, min: 50, rack: 'Aisle 3, Bin B4' },
    { code: 'INV-SURG-02', name: 'Sterile Nitrile Examination Gloves - Medium', cat: 'PPE & Hygiene', sup: 'Ansell Healthcare', cost: 14.50, qty: 580, min: 100, rack: 'Aisle 3, Bin B5' },
    { code: 'INV-DEV-03', name: 'Disposable IV Infusion Sets with Air Filter', cat: 'Medical Disposables', sup: 'Becton Dickinson', cost: 3.20, qty: 1450, min: 200, rack: 'Aisle 1, Rack A2' },
    { code: 'INV-DEV-04', name: 'Electrocardiogram (ECG) Thermal Paper Rolls', cat: 'Diagnostic Accessories', sup: 'GE Healthcare Supplies', cost: 8.50, qty: 110, min: 25, rack: 'Aisle 2, Bin C1' }
  ];

  const insertInvItem = db.prepare(`
    INSERT INTO inventory_items (item_code, item_name, category, supplier_name, unit_cost, quantity_in_stock, min_reorder_qty, location_rack)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const it of inventory) {
    insertInvItem.run(it.code, it.name, it.cat, it.sup, it.cost, it.qty, it.min, it.rack);
  }

  console.log('[EpicHMS Seed] Seeding Ambulance Fleet, Diet, Mortuary & Housekeeping...');
  const ambulances = [
    { no: 'AMB-UNIT-01', type: 'ALS (Advanced Life Support - Ventilator Equipped)', driver: 'Frank Reynolds', phone: '+1-555-8901', loc: 'Hospital North Bay Station', status: 'Available' },
    { no: 'AMB-UNIT-02', type: 'BLS (Basic Life Support)', driver: 'Charlie Kelly', phone: '+1-555-8902', loc: 'Downtown Highway Transit', status: 'Dispatched' },
    { no: 'AMB-UNIT-03', type: 'Neonatal & Pediatric Mobile ICU', driver: 'Dennis Reynolds', phone: '+1-555-8903', loc: 'Pediatric Wing Courtyard', status: 'Available' }
  ];

  const insertAmb = db.prepare(`
    INSERT INTO ambulance_fleet (vehicle_no, vehicle_type, driver_name, driver_phone, current_location, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const amb of ambulances) {
    insertAmb.run(amb.no, amb.type, amb.driver, amb.phone, amb.loc, amb.status);
  }

  // Diet plans
  const diets = [
    { pId: 2, ipdId: 1, type: 'Cardio-Protective (Low Sodium, Low Fat)', cals: 1600, pref: 'Vegetarian', notes: 'Strict sodium restriction (< 2g/day). Small frequent meals.', status: 'Served' },
    { pId: 5, ipdId: 2, type: 'Diabetic Low Glycemic Index (Glucerna Compliant)', cals: 1800, pref: 'Non-Vegetarian (Fish/Poultry)', notes: 'No simple sugars, high fiber, complex carbohydrates.', status: 'Preparing' }
  ];

  const insertDiet = db.prepare(`
    INSERT INTO diet_plans (patient_id, ipd_id, diet_type, calorie_target, meal_preference, special_instructions, delivery_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const dt of diets) {
    insertDiet.run(dt.pId, dt.ipdId, dt.type, dt.cals, dt.pref, dt.notes, dt.status);
  }

  // Mortuary records
  const mortuary = [
    { tag: 'MORT-2026-004', name: 'Jonathan Strange', age: 78, gender: 'Male', death: '2026-09-16 22:45:00', cause: 'End-stage cardiopulmonary failure', cold: 'Unit A-02', doc: 'Dr. Arthur Sterling', handover: 'Family Pending', status: 'In Custody' }
  ];

  const insertMort = db.prepare(`
    INSERT INTO mortuary_records (tag_no, deceased_name, age, gender, date_of_death, cause_of_death, cold_chamber_no, attending_physician, handover_to, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const mr of mortuary) {
    insertMort.run(mr.tag, mr.name, mr.age, mr.gender, mr.death, mr.cause, mr.cold, mr.doc, mr.handover, mr.status);
  }

  // Housekeeping tasks
  const hkTasks = [
    { code: 'HK-TASK-201', area: 'ICU Isolation Room 02', type: 'Terminal Disinfection & Fogging', staff: 'Maria Santos', time: '08:00 AM', prio: 'Urgent', status: 'Inspected & Approved' },
    { code: 'HK-TASK-202', area: 'OT Complex - Surgery Suite 1', type: 'Post-Operative Sterilization', staff: 'Rajesh Kumar', time: '11:30 AM', prio: 'High', status: 'Cleaned' },
    { code: 'HK-TASK-203', area: 'OPD Reception Lobby & Washrooms', type: 'Routine Sanitization & Floor Buffing', staff: 'Elena Rostova', time: '01:00 PM', prio: 'Medium', status: 'Pending' }
  ];

  const insertHk = db.prepare(`
    INSERT INTO housekeeping_tasks (task_code, area_or_room, task_type, assigned_staff, scheduled_time, priority, inspection_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const hk of hkTasks) {
    insertHk.run(hk.code, hk.area, hk.type, hk.staff, hk.time, hk.prio, hk.status);
  }

  console.log('[EpicHMS Seed] Seeding HR Employees, Payroll, Assets & Helpdesk...');
  const employees = [
    { code: 'EMP-001', name: 'Dr. Arthur Sterling', title: 'Chief Medical Officer / Super Admin', deptId: 7, email: 'superadmin@epichms.local', phone: '+1-555-0100', hire: '2018-01-15', shift: 'General Executive', salary: 18500.0 },
    { code: 'EMP-002', name: 'Clara Oswald', title: 'Hospital Operations Director', deptId: 7, email: 'admin@epichms.local', phone: '+1-555-0101', hire: '2020-03-01', shift: 'Day Shift (08:00 - 17:00)', salary: 11000.0 },
    { code: 'EMP-003', name: 'Dr. Evelyn Reed', title: 'Head of Cardiology & Consultant', deptId: 1, email: 'doctor@epichms.local', phone: '+1-555-0102', hire: '2019-06-10', shift: 'Day Shift (09:00 - 17:00)', salary: 16500.0 },
    { code: 'EMP-004', name: 'Sarah Jenkins, RN', title: 'Senior Inpatient Staff Nurse', deptId: 1, email: 'nurse@epichms.local', phone: '+1-555-0103', hire: '2021-08-20', shift: 'Rotational 12h Shift', salary: 6500.0 },
    { code: 'EMP-005', name: 'James Chen, PharmD', title: 'Chief Pharmacist', deptId: 7, email: 'pharmacist@epichms.local', phone: '+1-555-0104', hire: '2021-02-14', shift: 'Day Shift (08:30 - 17:00)', salary: 7800.0 },
    { code: 'EMP-006', name: 'Alice Walker', title: 'Front Desk Lead & Patient Coordinator', deptId: 7, email: 'staff@epichms.local', phone: '+1-555-0106', hire: '2022-05-18', shift: 'Morning Shift (07:30 - 16:00)', salary: 4200.0 }
  ];

  const insertEmp = db.prepare(`
    INSERT INTO employees_hr (emp_code, full_name, role_title, department_id, email, phone, hire_date, shift, salary_base)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const emp of employees) {
    insertEmp.run(emp.code, emp.name, emp.title, emp.deptId, emp.email, emp.phone, emp.hire, emp.shift, emp.salary);
  }

  // Payroll
  const insertPay = db.prepare(`
    INSERT INTO payroll_records (payslip_no, employee_id, month_year, base_pay, allowances, deductions, net_pay, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPay.run('PAY-2026-09-01', 1, 'September 2026', 18500.0, 2500.0, 1800.0, 19200.0, 'Paid');
  insertPay.run('PAY-2026-09-02', 2, 'September 2026', 11000.0, 1500.0, 1100.0, 11400.0, 'Paid');
  insertPay.run('PAY-2026-09-03', 3, 'September 2026', 16500.0, 2000.0, 1600.0, 16900.0, 'Paid');
  insertPay.run('PAY-2026-09-04', 4, 'September 2026', 6500.0, 800.0, 650.0, 6650.0, 'Paid');

  // Assets & Maintenance
  const assets = [
    { tag: 'AST-BIO-001', name: 'GE Optima CT540 128-Slice Scanner', cat: 'Biomedical Diagnostic', model: 'Optima CT540', sn: 'SN-GE-994182', loc: 'Diagnostic Wing, CT Room 1', last: '2026-06-15', next: '2026-12-15', war: 'Active Extended AMC', op: 'Operational' },
    { tag: 'AST-BIO-002', name: 'Mindray BeneHeart D6 Defibrillator', cat: 'Emergency Life Support', model: 'BeneHeart D6', sn: 'SN-MN-44102', loc: 'Crash Cart ER-01', last: '2026-08-01', next: '2026-11-01', war: 'Active Manufacturer', op: 'Operational' },
    { tag: 'AST-FAC-003', name: 'Cummins 500kVA Hospital Backup Generator', cat: 'Facility Infrastructure', model: 'QSK19-G4', sn: 'SN-CM-8812', loc: 'Power Substation Utility Bay', last: '2026-05-20', next: '2026-11-20', war: 'Service Contract', op: 'Operational' }
  ];

  const insertAsset = db.prepare(`
    INSERT INTO assets_maintenance (asset_tag, asset_name, category, model_no, serial_no, location, last_service_date, next_service_due, warranty_status, operational_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const as of assets) {
    insertAsset.run(as.tag, as.name, as.cat, as.model, as.sn, as.loc, as.last, as.next, as.war, as.op);
  }

  // Helpdesk
  const tickets = [
    { no: 'HD-2026-401', req: 'Dr. Evelyn Reed', dept: 'Cardiology', cat: 'Software/EMR', subj: 'PACS DICOM viewer slow response during ECG cine loops', desc: 'Viewing high frame rate angiograms takes 15+ seconds to buffer on workstation A-302.', prio: 'High', status: 'In Progress', notes: 'Network team optimizing DICOM cache server routing.' },
    { no: 'HD-2026-402', req: 'Sarah Jenkins, RN', dept: 'Inpatient Nursing', cat: 'Hardware/Printer', subj: 'Barcode wristband printer jam on Bed Station 2', desc: 'Thermal roll misaligned inside Zebra ZD410 printer.', prio: 'Medium', status: 'Resolved', notes: 'Replaced print head roller and re-calibrated sensor.' }
  ];

  const insertTicket = db.prepare(`
    INSERT INTO helpdesk_tickets (ticket_no, requester_name, department, category, subject, description, priority, status, resolution_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const tk of tickets) {
    insertTicket.run(tk.no, tk.req, tk.dept, tk.cat, tk.subj, tk.desc, tk.prio, tk.status, tk.notes);
  }

  console.log('[EpicHMS Seed] Seeding Documents, Audit Logs & Platform Services...');
  const docs = [
    { code: 'DOC-2026-001', pId: 1, title: 'Informed Consent for Cardiac Catheterization', cat: 'Consent Form', file: 'Consent_JohnathanVance_Signed.pdf', size: '1.4 MB', by: 'Dr. Evelyn Reed' },
    { code: 'DOC-2026-002', pId: 2, title: 'National Identity Proof & Health Insurance Card', cat: 'ID Proof', file: 'EleanorRigby_ID_StarHealth.pdf', size: '2.1 MB', by: 'Alice Walker' }
  ];

  const insertDoc = db.prepare(`
    INSERT INTO document_files (doc_code, patient_id, title, category, file_name, file_size, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const doc of docs) {
    insertDoc.run(doc.code, doc.pId, doc.title, doc.cat, doc.file, doc.size, doc.by);
  }

  // Audit logs
  const auditEntries = [
    { email: 'superadmin@epichms.local', role: 'superadmin', action: 'SYSTEM_BOOT', module: 'Platform Services', entity: 'HOST_LOCAL', det: 'EpicHMS Healthcare Platform initialized successfully.' },
    { email: 'doctor@epichms.local', role: 'doctor', action: 'RECORD_ACCESS', module: 'Medical Records', entity: 'EMR-2026-0901', det: 'Patient clinical notes accessed for consultation.' },
    { email: 'admin@epichms.local', role: 'admin', action: 'SECURITY_AUDIT', module: 'Audit & Compliance', entity: 'HIPAA_CHECK', det: 'Quarterly access privilege review verified 100% compliant.' }
  ];

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_email, user_role, action, module, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const ae of auditEntries) {
    insertAudit.run(ae.email, ae.role, ae.action, ae.module, ae.entity, ae.det);
  }

  console.log('[EpicHMS Seed] Seeding Beds & State Transitions Matrix...');
  const beds = [
    // ICU Ward (Dept 6 - Emergency & Critical)
    { branchId: 1, deptId: 6, ward: 'Intensive Care Unit (ICU)', room: 'ICU-A', code: 'BED-ICU-01', type: 'ICU Hill-Rom Centuris', rate: 4500, status: 'Occupied', pId: 2, since: '2026-09-15 14:20:00', notes: 'Continuous hemodynamic monitoring' },
    { branchId: 1, deptId: 6, ward: 'Intensive Care Unit (ICU)', room: 'ICU-A', code: 'BED-ICU-02', type: 'ICU Hill-Rom Centuris', rate: 4500, status: 'Available', pId: null, since: null, notes: 'Terminal sterilization done' },
    { branchId: 1, deptId: 6, ward: 'Intensive Care Unit (ICU)', room: 'ICU-B', code: 'BED-ICU-03', type: 'ICU Hill-Rom Centuris', rate: 4500, status: 'Cleaning', pId: null, since: null, notes: 'Housekeeping cleaning in progress' },
    { branchId: 1, deptId: 6, ward: 'Intensive Care Unit (ICU)', room: 'ICU-B', code: 'BED-ICU-04', type: 'ICU Isolation Suite', rate: 5500, status: 'Available', pId: null, since: null, notes: 'Negative pressure ventilation' },
    { branchId: 1, deptId: 6, ward: 'Intensive Care Unit (ICU)', room: 'ICU-C', code: 'BED-ICU-05', type: 'ICU Hill-Rom Centuris', rate: 4500, status: 'Maintenance', pId: null, since: null, notes: 'Biomedical sensor calibration' },

    // Cardiology Ward (Dept 1)
    { branchId: 1, deptId: 1, ward: 'Cardiology Step-down Ward', room: 'CARD-301', code: 'BED-CRD-101', type: 'Semi-Private Electric', rate: 2200, status: 'Occupied', pId: 1, since: '2026-09-16 08:30:00', notes: 'Telemetry hooked' },
    { branchId: 1, deptId: 1, ward: 'Cardiology Step-down Ward', room: 'CARD-301', code: 'BED-CRD-102', type: 'Semi-Private Electric', rate: 2200, status: 'Available', pId: null, since: null, notes: 'Cleaned and made' },
    { branchId: 1, deptId: 1, ward: 'Cardiology Step-down Ward', room: 'CARD-302', code: 'BED-CRD-103', type: 'Deluxe Private Suite', rate: 3800, status: 'Reserved', pId: null, since: null, notes: 'Reserved for post-CABG transfer' },
    { branchId: 1, deptId: 1, ward: 'Cardiology Step-down Ward', room: 'CARD-302', code: 'BED-CRD-104', type: 'Deluxe Private Suite', rate: 3800, status: 'Available', pId: null, since: null, notes: 'Available for admission' },

    // General Medicine Ward (Dept 7)
    { branchId: 1, deptId: 7, ward: 'General Medicine Male Ward', room: 'GEN-201', code: 'BED-GEN-201', type: 'Standard Electric', rate: 1200, status: 'Occupied', pId: 3, since: '2026-09-17 07:15:00', notes: 'Post-op observation' },
    { branchId: 1, deptId: 7, ward: 'General Medicine Male Ward', room: 'GEN-201', code: 'BED-GEN-202', type: 'Standard Electric', rate: 1200, status: 'Available', pId: null, since: null, notes: 'Ready' },
    { branchId: 1, deptId: 7, ward: 'General Medicine Female Ward', room: 'GEN-202', code: 'BED-GEN-203', type: 'Standard Electric', rate: 1200, status: 'Cleaning', pId: null, since: null, notes: 'Terminal disinfection' },
    { branchId: 1, deptId: 7, ward: 'General Medicine Female Ward', room: 'GEN-202', code: 'BED-GEN-204', type: 'Standard Electric', rate: 1200, status: 'Blocked', pId: null, since: null, notes: 'Plumbing leak repaired' },

    // Pediatric Ward (Dept 4)
    { branchId: 1, deptId: 4, ward: 'Pediatric Care Ward', room: 'PED-101', code: 'BED-PED-301', type: 'Pediatric Crib Bed', rate: 1800, status: 'Occupied', pId: 4, since: '2026-09-17 11:00:00', notes: 'Asthmatic flare' },
    { branchId: 1, deptId: 4, ward: 'Pediatric Care Ward', room: 'PED-101', code: 'BED-PED-302', type: 'Pediatric Crib Bed', rate: 1800, status: 'Available', pId: null, since: null, notes: 'Ready' },

    // Orthopedic Ward (Dept 3)
    { branchId: 1, deptId: 3, ward: 'Orthopedic Recovery Ward', room: 'ORTH-401', code: 'BED-ORT-401', type: 'Traction Fitted Bed', rate: 2500, status: 'Available', pId: null, since: null, notes: 'Balkan traction frame equipped' },
    { branchId: 1, deptId: 3, ward: 'Orthopedic Recovery Ward', room: 'ORTH-401', code: 'BED-ORT-402', type: 'Traction Fitted Bed', rate: 2500, status: 'Available', pId: null, since: null, notes: 'Ready' }
  ];

  const insertBed = db.prepare(`
    INSERT INTO beds (branch_id, department_id, ward_name, room_no, bed_code, bed_type, daily_rate, status, current_patient_id, occupied_since, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const b of beds) {
    insertBed.run(b.branchId, b.deptId, b.ward, b.room, b.code, b.type, b.rate, b.status, b.pId, b.since, b.notes);
  }

  // Bed Transfers
  const insertTransfer = db.prepare(`
    INSERT INTO bed_transfers (patient_id, from_bed_id, to_bed_id, transfer_reason, requested_by, approved_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertTransfer.run(2, 5, 1, 'Patient vitals stabilized post-infarct, moved from ER Triage to ICU Bed 1', 'Dr. Gregory Chase', 'Dr. Evelyn Reed');

  console.log('[EpicHMS Seed] Seeding Biomedical Waste Compliance Logs...');
  const wasteLogs = [
    { code: 'BMW-2026-Y01', cat: 'Yellow', barcode: 'BC-YEL-9901', weight: 4.8, dept: 'Operation Theatre Complex', by: 'Sarah Jenkins, RN', status: 'Dispatched', vendor: 'BioClean Healthcare Disposal Ltd', veh: 'TS-09-UB-4421', mnf: 'MNF-2026-8801', cert: 'EPA-BMW-CERT-901' },
    { code: 'BMW-2026-R02', cat: 'Red', barcode: 'BC-RED-9902', weight: 6.3, dept: 'Intensive Care Unit (ICU)', by: 'Alice Walker', status: 'Stored', vendor: null, veh: null, mnf: null, cert: null },
    { code: 'BMW-2026-B03', cat: 'Blue', barcode: 'BC-BLU-9903', weight: 3.1, dept: 'Central Diagnostic Laboratory', by: 'Dr. Julian Bashir', status: 'Stored', vendor: null, veh: null, mnf: null, cert: null },
    { code: 'BMW-2026-W04', cat: 'White', barcode: 'BC-WHT-9904', weight: 1.9, dept: 'Emergency & Trauma Bay', by: 'Sarah Jenkins, RN', status: 'Dispatched', vendor: 'BioClean Healthcare Disposal Ltd', veh: 'TS-09-UB-4421', mnf: 'MNF-2026-8802', cert: 'EPA-BMW-CERT-902' },
    { code: 'BMW-2026-Y05', cat: 'Yellow', barcode: 'BC-YEL-9905', weight: 5.2, dept: 'Labor & Delivery Suites', by: 'Alice Walker', status: 'Collected', vendor: null, veh: null, mnf: null, cert: null }
  ];

  const insertWaste = db.prepare(`
    INSERT INTO biomedical_waste (waste_code, category, bag_barcode, weight_kg, department, collected_by, status, disposal_vendor, vehicle_no, manifest_no, compliance_cert)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const w of wasteLogs) {
    insertWaste.run(w.code, w.cat, w.barcode, w.weight, w.dept, w.by, w.status, w.vendor, w.veh, w.mnf, w.cert);
  }

  console.log('[EpicHMS Seed] Seeding Procurement & Traceable Stock Movements...');
  const purchaseOrders = [
    { no: 'PO-2026-001', supplier: 'MedPharma Global Distributions', dept: 'Central Pharmacy', amount: 12500.0, status: 'Approved', by: 'Vikram Patel', delivery: '2026-09-25' },
    { no: 'PO-2026-002', supplier: 'SurgicalTech Healthcare Instruments', dept: 'Central Sterile Supply (CSSD)', amount: 18700.0, status: 'Submitted', by: 'Vikram Patel', delivery: '2026-09-30' }
  ];

  const insertPO = db.prepare(`
    INSERT INTO purchase_orders (po_no, supplier_name, department, total_amount, status, created_by, expected_delivery)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const po of purchaseOrders) {
    insertPO.run(po.no, po.supplier, po.dept, po.amount, po.status, po.by, po.delivery);
  }

  const poItems = [
    { poId: 1, name: 'Ceftriaxone 1g Injectable Vials', code: 'DRG-CEF-1G', qty: 500, price: 12.5, total: 6250.0, rec: 500 },
    { poId: 1, name: 'Enoxaparin Sodium 40mg Syringes', code: 'DRG-ENOX-40', qty: 250, price: 25.0, total: 6250.0, rec: 250 },
    { poId: 2, name: 'Sterile Laparotomy Packs', code: 'MED-LAP-01', qty: 100, price: 95.0, total: 9500.0, rec: 0 },
    { poId: 2, name: 'Disposable Electrosurgical Pencils', code: 'MED-ESU-02', qty: 200, price: 46.0, total: 9200.0, rec: 0 }
  ];

  const insertPOItem = db.prepare(`
    INSERT INTO purchase_order_items (po_id, item_name, item_code, quantity, unit_price, total_price, received_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const poi of poItems) {
    insertPOItem.run(poi.poId, poi.name, poi.code, poi.qty, poi.price, poi.total, poi.rec);
  }

  const insertGRN = db.prepare(`
    INSERT INTO goods_receipts (grn_no, po_id, supplier_name, received_by, invoice_ref, total_items, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertGRN.run('GRN-2026-001', 1, 'MedPharma Global Distributions', 'Vikram Patel', 'INV-MED-88192', 2, 'Quality verified, cold chain integrity intact at 4°C');

  // Stock movements ledger
  const movements = [
    { type: 'Purchase Receipt', itemType: 'Pharmacy', itemId: 1, code: 'DRG-AMO-500', name: 'Amoxicillin + Clavulanate 625mg', batch: 'BT-AMX-2026A', change: 500, after: 1250, cost: 1.25, ref: 'GRN-2026-001', notes: 'New delivery batch received', by: 'Vikram Patel' },
    { type: 'Dispense', itemType: 'Pharmacy', itemId: 1, code: 'DRG-AMO-500', name: 'Amoxicillin + Clavulanate 625mg', batch: 'BT-AMX-2026A', change: -14, after: 1236, cost: 1.25, ref: 'RX-2026-001', notes: 'Dispensed to Patient Johnathan Vance', by: 'James Chen, PharmD' },
    { type: 'Ward Consumption', itemType: 'General', itemId: 2, code: 'INV-GLV-001', name: 'Nitrile Examination Gloves (Box/100)', batch: 'BT-GLV-26', change: -10, after: 190, cost: 8.50, ref: 'REQ-ICU-0917', notes: 'Issued to ICU Floor Ward', by: 'Sarah Jenkins, RN' },
    { type: 'Adjustment', itemType: 'Pharmacy', itemId: 2, code: 'DRG-ATOR-20', name: 'Atorvastatin 20mg Tablets', batch: 'BT-ATV-89', change: -5, after: 445, cost: 0.85, ref: 'AUDIT-PHARM-Q3', notes: 'Packaging damaged during shelf relocation', by: 'James Chen, PharmD' }
  ];

  const insertMove = db.prepare(`
    INSERT INTO stock_movements (movement_type, item_type, item_id, item_code, item_name, batch_no, qty_change, balance_after, unit_cost, reference_no, notes, performed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const m of movements) {
    insertMove.run(m.type, m.itemType, m.itemId, m.code, m.name, m.batch, m.change, m.after, m.cost, m.ref, m.notes, m.by);
  }

  console.log('[EpicHMS Seed] Seeding Billing Advances & Deposits...');
  const advances = [
    { no: 'ADV-2026-001', pId: 1, ipdId: 1, amount: 2500.0, mode: 'Credit Card', purpose: 'IPD Admission Deposit for Angiography', by: 'Marcus Thorne, CPA', status: 'Settled', refund: 0.0 },
    { no: 'ADV-2026-002', pId: 2, ipdId: 2, amount: 5000.0, mode: 'Wire Transfer', purpose: 'ICU Critical Care Deposit', by: 'Marcus Thorne, CPA', status: 'Settled', refund: 0.0 }
  ];

  const insertAdv = db.prepare(`
    INSERT INTO billing_advances (receipt_no, patient_id, ipd_id, amount, payment_mode, purpose, collected_by, status, refund_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of advances) {
    insertAdv.run(a.no, a.pId, a.ipdId, a.amount, a.mode, a.purpose, a.by, a.status, a.refund);
  }

  // Notifications
  const notifications = [
    { title: 'New Lab Alert', msg: 'Critical Troponin-I result ready for Patient Eleanor Rigby (Bed ICU-04)', type: 'alert', role: 'doctor' },
    { title: 'Stock Alert', msg: 'Enoxaparin Sodium 40mg inventory is reaching reorder threshold (85 remaining)', type: 'warning', role: 'pharmacist' },
    { title: 'Scheduled OT Surgery', msg: 'Arthroscopic Meniscectomy scheduled tomorrow at 10:00 AM in OT-3', type: 'info', role: 'all' }
  ];

  const insertNotif = db.prepare(`
    INSERT INTO notifications (title, message, type, target_role)
    VALUES (?, ?, ?, ?)
  `);
  for (const n of notifications) {
    insertNotif.run(n.title, n.msg, n.type, n.role);
  }

  // Communication logs (SMS, WhatsApp, Email)
  const comms = [
    { ch: 'SMS', rec: '+1-555-4321', subj: 'Appointment Confirmation', msg: 'Your appointment APT-2026-001 with Dr. Evelyn Reed is scheduled today at 09:30 AM at EpicHMS Block A.', stat: 'Delivered' },
    { ch: 'WhatsApp', rec: '+1-555-4321', subj: 'Lab Report Ready', msg: 'Dear Johnathan, your test report LAB-LIPID is now ready for view in your Patient Portal.', stat: 'Delivered' },
    { ch: 'Email', rec: 'patient@epichms.local', subj: 'EpicHMS Patient Portal Access', msg: 'Welcome to EpicHMS. Your secure patient medical records portal is now active.', stat: 'Delivered' }
  ];

  const insertComm = db.prepare(`
    INSERT INTO communication_logs (channel, recipient, subject, message_body, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const c of comms) {
    insertComm.run(c.ch, c.rec, c.subj, c.msg, c.stat);
  }

  // System Settings
  const settings = [
    { k: 'HOSPITAL_NAME', v: 'EpicHMS Multi-Speciality Medical Center & Research Institute', d: 'Primary Institution Name' },
    { k: 'LICENSE_KEY', v: 'EPIC-ENT-2035-TESTING-SUITE', d: 'Enterprise License Status (Valid until 2035)' },
    { k: 'AUTOMATION_TESTING_MODE', v: 'ENABLED', d: 'Enables deterministic data-testids and rapid database reset hooks' },
    { k: 'DEFAULT_CURRENCY', v: 'USD ($)', d: 'Billing & Invoicing Currency' },
    { k: 'EMERGENCY_HOTLINE', v: '+1-800-EPIC-911', d: '24/7 Emergency and Trauma Response Number' }
  ];

  const insertSet = db.prepare(`
    INSERT INTO system_settings (key, value, description)
    VALUES (?, ?, ?)
  `);
  for (const s of settings) {
    insertSet.run(s.k, s.v, s.d);
  }

  console.log('[EpicHMS Seed] Database seeded completely and successfully!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = {
  seedDatabase,
  hashPassword
};
