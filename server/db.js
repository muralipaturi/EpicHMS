const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, 'epichms.db');

let db = null;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
  }
  return db;
}

function ensureColumn(database, table, column, definition) {
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch (e) {
    // Column may already exist
  }
}

function initSchema() {
  const database = getDb();

  database.exec(`
    -- 1. Multi-Tenancy Hierarchy: Organization -> Hospital -> Branch -> Building/Floor
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tax_id TEXT,
      address TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id INTEGER NOT NULL,
      hospital_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'Multi-Specialty Tertiary Hospital',
      license_no TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL,
      branch_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT,
      is_main INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS buildings_floors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL,
      building_name TEXT NOT NULL,
      floor_number INTEGER NOT NULL,
      floor_name TEXT NOT NULL,
      description TEXT,
      FOREIGN KEY (branch_id) REFERENCES branches(id)
    );

    -- 2. Identity, Users, and Roles (12 Discrete Business Roles)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL, -- superadmin, admin, doctor, nurse, pharmacist, lab, radiology, receptionist, billing, inventory, hr, patient
      full_name TEXT NOT NULL,
      phone TEXT,
      department TEXT,
      avatar TEXT,
      mfa_enabled INTEGER DEFAULT 0,
      account_status TEXT DEFAULT 'Active', -- Pending, Active, Inactive, Suspended, Locked, Archived
      employment_status TEXT DEFAULT 'Full-Time', -- Full-Time, Part-Time, Contract, On-Leave, Resigned
      clinical_status TEXT DEFAULT 'Available', -- Available, In-Consultation, In-Surgery, Off-Duty
      branch_id INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Departments & Facilities
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      head_doctor_name TEXT,
      location TEXT,
      phone TEXT,
      total_beds INTEGER DEFAULT 20,
      status TEXT DEFAULT 'Active'
    );

    -- 4. Beds and Controlled State Transitions (Available, Occupied, Reserved, Cleaning, Maintenance, Blocked)
    CREATE TABLE IF NOT EXISTS beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER DEFAULT 1,
      department_id INTEGER,
      ward_name TEXT NOT NULL,
      room_no TEXT NOT NULL,
      bed_code TEXT UNIQUE NOT NULL,
      bed_type TEXT DEFAULT 'Standard Electric', -- ICU, General, Semi-Private, Deluxe Suite, Pediatric, Isolation
      daily_rate REAL DEFAULT 1500.0,
      status TEXT DEFAULT 'Available', -- Available, Occupied, Reserved, Cleaning, Maintenance, Blocked
      current_patient_id INTEGER,
      occupied_since DATETIME,
      notes TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (current_patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS bed_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      from_bed_id INTEGER NOT NULL,
      to_bed_id INTEGER NOT NULL,
      transfer_reason TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      approved_by TEXT,
      transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (from_bed_id) REFERENCES beds(id),
      FOREIGN KEY (to_bed_id) REFERENCES beds(id)
    );

    -- 5. Doctors & Medical Practitioners
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      doctor_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      department_id INTEGER,
      specialization TEXT NOT NULL,
      qualification TEXT NOT NULL,
      room_no TEXT,
      consultation_fee REAL DEFAULT 500.0,
      available_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      shift_hours TEXT DEFAULT '09:00 - 17:00',
      status TEXT DEFAULT 'Active',
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    -- 6. Patients & UHID
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_code TEXT UNIQUE NOT NULL,
      uhid TEXT UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT NOT NULL,
      dob DATE NOT NULL,
      age INTEGER,
      blood_group TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      emergency_contact TEXT,
      allergies TEXT,
      duplicate_check_flag INTEGER DEFAULT 0,
      branch_id INTEGER DEFAULT 1,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Appointments & OPD Queue
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      department_id INTEGER,
      appointment_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      visit_type TEXT DEFAULT 'Consultation',
      symptoms TEXT,
      status TEXT DEFAULT 'Scheduled',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS opd_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_no INTEGER NOT NULL,
      appointment_id INTEGER,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      queue_date DATE DEFAULT (DATE('now')),
      check_in_time TEXT,
      vital_bp TEXT,
      vital_pulse TEXT,
      vital_temp TEXT,
      vital_weight TEXT,
      vital_spo2 TEXT,
      doctor_notes TEXT,
      status TEXT DEFAULT 'Waiting',
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    -- 8. IPD Inpatient Admissions
    CREATE TABLE IF NOT EXISTS ipd_admissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipd_code TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      attending_doctor_id INTEGER NOT NULL,
      department_id INTEGER,
      ward TEXT NOT NULL,
      bed_no TEXT NOT NULL,
      admission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      discharge_date DATETIME,
      admitting_diagnosis TEXT NOT NULL,
      current_condition TEXT DEFAULT 'Stable',
      status TEXT DEFAULT 'Admitted',
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (attending_doctor_id) REFERENCES doctors(id)
    );

    -- 9. Emergency & Triage
    CREATE TABLE IF NOT EXISTS emergency_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_no TEXT UNIQUE NOT NULL,
      patient_name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      triage_level TEXT NOT NULL, -- Red, Orange, Yellow, Green
      trauma_type TEXT,
      arrival_mode TEXT,
      vitals_summary TEXT,
      attending_doctor TEXT,
      status TEXT DEFAULT 'Under Treatment',
      time_in DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Pharmacy & Medications
    CREATE TABLE IF NOT EXISTS pharmacy_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT UNIQUE NOT NULL,
      drug_name TEXT NOT NULL,
      generic_name TEXT NOT NULL,
      category TEXT NOT NULL,
      dosage_form TEXT NOT NULL,
      unit_price REAL NOT NULL,
      stock_qty INTEGER NOT NULL,
      reorder_level INTEGER DEFAULT 50,
      expiry_date DATE NOT NULL,
      batch_no TEXT NOT NULL,
      manufacturer TEXT
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rx_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      encounter_type TEXT DEFAULT 'OPD',
      encounter_id INTEGER,
      diagnosis TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'Pending Dispense',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL,
      drug_id INTEGER NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      dispensed_status TEXT DEFAULT 'Pending',
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
      FOREIGN KEY (drug_id) REFERENCES pharmacy_items(id)
    );

    -- 11. Laboratory Diagnostic Testing
    CREATE TABLE IF NOT EXISTS lab_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_code TEXT UNIQUE NOT NULL,
      test_name TEXT NOT NULL,
      category TEXT NOT NULL,
      sample_type TEXT NOT NULL,
      standard_fee REAL NOT NULL,
      normal_range TEXT,
      units TEXT
    );

    CREATE TABLE IF NOT EXISTS lab_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      test_id INTEGER NOT NULL,
      sample_status TEXT DEFAULT 'Sample Collected',
      test_result TEXT,
      normal_flag TEXT DEFAULT 'Normal',
      technician_notes TEXT,
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      FOREIGN KEY (test_id) REFERENCES lab_tests(id)
    );

    -- 12. Radiology & Diagnostic Imaging
    CREATE TABLE IF NOT EXISTS radiology_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      req_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      modality TEXT NOT NULL,
      body_part TEXT NOT NULL,
      clinical_indication TEXT NOT NULL,
      findings TEXT,
      impression TEXT,
      status TEXT DEFAULT 'Scheduled',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    -- 13. Operation Theatre & Surgery
    CREATE TABLE IF NOT EXISTS operation_theatre (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ot_code TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      primary_surgeon_id INTEGER NOT NULL,
      anesthetist_name TEXT NOT NULL,
      surgery_type TEXT NOT NULL,
      ot_room TEXT NOT NULL,
      scheduled_time DATETIME NOT NULL,
      duration_est TEXT DEFAULT '2 hours',
      status TEXT DEFAULT 'Scheduled',
      post_op_notes TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (primary_surgeon_id) REFERENCES doctors(id)
    );

    -- 14. Nursing & Clinical Care Plans
    CREATE TABLE IF NOT EXISTS nursing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipd_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      nurse_name TEXT NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      bp TEXT,
      heart_rate TEXT,
      resp_rate TEXT,
      spo2 TEXT,
      temp_c TEXT,
      medication_given TEXT,
      nursing_notes TEXT,
      FOREIGN KEY (ipd_id) REFERENCES ipd_admissions(id),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    -- 15. Billing, Invoices, Advances & Insurance
    CREATE TABLE IF NOT EXISTS billing_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      discount_amount REAL DEFAULT 0.0,
      tax_amount REAL DEFAULT 0.0,
      net_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0.0,
      due_amount REAL DEFAULT 0.0,
      payment_mode TEXT DEFAULT 'Cash',
      payment_status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS billing_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id)
    );

    CREATE TABLE IF NOT EXISTS billing_advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      ipd_id INTEGER,
      amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'Cash',
      purpose TEXT DEFAULT 'IPD Admission Deposit',
      collected_by TEXT NOT NULL,
      status TEXT DEFAULT 'Settled',
      refund_amount REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (ipd_id) REFERENCES ipd_admissions(id)
    );

    CREATE TABLE IF NOT EXISTS insurance_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      provider_name TEXT NOT NULL,
      policy_number TEXT NOT NULL,
      pre_auth_code TEXT,
      claim_amount REAL NOT NULL,
      approved_amount REAL DEFAULT 0.0,
      claim_status TEXT DEFAULT 'Submitted',
      submission_date DATE DEFAULT (DATE('now')),
      settlement_date DATE,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id)
    );

    -- 16. Inventory, Procurement & Traceable Stock Movements
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT UNIQUE NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      unit_cost REAL NOT NULL,
      quantity_in_stock INTEGER NOT NULL,
      min_reorder_qty INTEGER DEFAULT 20,
      location_rack TEXT,
      last_restocked DATE DEFAULT (DATE('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_type TEXT NOT NULL, -- Purchase Receipt, Dispense, Ward Consumption, Transfer, Return, Adjustment, Disposal
      item_type TEXT NOT NULL, -- Pharmacy, General
      item_id INTEGER NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      batch_no TEXT,
      qty_change INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      unit_cost REAL,
      reference_no TEXT,
      notes TEXT,
      performed_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_no TEXT UNIQUE NOT NULL,
      supplier_name TEXT NOT NULL,
      department TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'Approved', -- Draft, Submitted, Approved, Partially Received, Completed, Cancelled
      created_by TEXT NOT NULL,
      order_date DATE DEFAULT (DATE('now')),
      expected_delivery DATE
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_code TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      received_qty INTEGER DEFAULT 0,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
    );

    CREATE TABLE IF NOT EXISTS goods_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_no TEXT UNIQUE NOT NULL,
      po_id INTEGER,
      supplier_name TEXT NOT NULL,
      received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      received_by TEXT NOT NULL,
      invoice_ref TEXT,
      total_items INTEGER DEFAULT 1,
      remarks TEXT,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
    );

    -- 17. Biomedical Waste Management (Color Segregation, Barcodes, Compliance)
    CREATE TABLE IF NOT EXISTS biomedical_waste (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      waste_code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL, -- Yellow, Red, Blue, White
      bag_barcode TEXT UNIQUE NOT NULL,
      weight_kg REAL NOT NULL,
      department TEXT NOT NULL,
      collected_by TEXT NOT NULL,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      storage_room TEXT DEFAULT 'Central Waste Holding A',
      status TEXT DEFAULT 'Stored', -- Collected, Stored, Dispatched, Incinerated, Recycled
      disposal_vendor TEXT,
      vehicle_no TEXT,
      manifest_no TEXT,
      compliance_cert TEXT,
      dispatched_at DATETIME
    );

    -- 18. Blood Bank
    CREATE TABLE IF NOT EXISTS blood_bank_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_code TEXT UNIQUE NOT NULL,
      blood_group TEXT NOT NULL,
      rhesus TEXT NOT NULL,
      component_type TEXT DEFAULT 'Whole Blood',
      donor_name TEXT NOT NULL,
      donor_phone TEXT,
      collection_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      status TEXT DEFAULT 'Available'
    );

    -- 19. Discharge Summaries & Medical Records EMR
    CREATE TABLE IF NOT EXISTS discharge_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discharge_no TEXT UNIQUE NOT NULL,
      ipd_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      admission_date DATETIME NOT NULL,
      discharge_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      final_diagnosis TEXT NOT NULL,
      course_in_hospital TEXT,
      discharge_condition TEXT DEFAULT 'Recovered / Stable',
      medications_on_discharge TEXT,
      follow_up_advice TEXT,
      doctor_signature TEXT,
      FOREIGN KEY (ipd_id) REFERENCES ipd_admissions(id),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emr_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      encounter_type TEXT NOT NULL,
      icd10_code TEXT,
      diagnosis_title TEXT NOT NULL,
      clinical_notes TEXT NOT NULL,
      allergies_noted TEXT,
      past_history TEXT,
      date_recorded DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    -- 20. Ambulance Fleet & Emergency Logistics
    CREATE TABLE IF NOT EXISTS ambulance_fleet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_no TEXT UNIQUE NOT NULL,
      vehicle_type TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      driver_phone TEXT NOT NULL,
      current_location TEXT NOT NULL,
      odometer_km INTEGER DEFAULT 14200,
      status TEXT DEFAULT 'Available'
    );

    -- 21. Dietary & Nutrition
    CREATE TABLE IF NOT EXISTS diet_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      ipd_id INTEGER,
      diet_type TEXT NOT NULL,
      calorie_target INTEGER DEFAULT 1800,
      meal_preference TEXT DEFAULT 'Vegetarian',
      special_instructions TEXT,
      delivery_status TEXT DEFAULT 'Served',
      date_scheduled DATE DEFAULT (DATE('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    -- 22. Mortuary Care
    CREATE TABLE IF NOT EXISTS mortuary_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_no TEXT UNIQUE NOT NULL,
      deceased_name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      date_of_death DATETIME NOT NULL,
      cause_of_death TEXT NOT NULL,
      cold_chamber_no TEXT NOT NULL,
      attending_physician TEXT NOT NULL,
      handover_to TEXT,
      status TEXT DEFAULT 'In Custody'
    );

    -- 23. Housekeeping & Facilities Sanitation
    CREATE TABLE IF NOT EXISTS housekeeping_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_code TEXT UNIQUE NOT NULL,
      area_or_room TEXT NOT NULL,
      task_type TEXT NOT NULL,
      assigned_staff TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      inspection_status TEXT DEFAULT 'Pending'
    );

    -- 24. HR, Staff & Payroll Management
    CREATE TABLE IF NOT EXISTS employees_hr (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      department_id INTEGER,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      hire_date DATE NOT NULL,
      shift TEXT DEFAULT 'Day Shift (08:00 - 16:30)',
      salary_base REAL NOT NULL,
      status TEXT DEFAULT 'Active',
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS payroll_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payslip_no TEXT UNIQUE NOT NULL,
      employee_id INTEGER NOT NULL,
      month_year TEXT NOT NULL,
      base_pay REAL NOT NULL,
      allowances REAL DEFAULT 0.0,
      deductions REAL DEFAULT 0.0,
      net_pay REAL NOT NULL,
      payment_status TEXT DEFAULT 'Paid',
      processed_date DATE DEFAULT (DATE('now')),
      FOREIGN KEY (employee_id) REFERENCES employees_hr(id)
    );

    -- 25. Assets & Biomedical Engineering Maintenance
    CREATE TABLE IF NOT EXISTS assets_maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT UNIQUE NOT NULL,
      asset_name TEXT NOT NULL,
      category TEXT NOT NULL,
      model_no TEXT NOT NULL,
      serial_no TEXT NOT NULL,
      location TEXT NOT NULL,
      last_service_date DATE NOT NULL,
      next_service_due DATE NOT NULL,
      warranty_status TEXT DEFAULT 'Active Warranty',
      operational_status TEXT DEFAULT 'Operational'
    );

    -- 26. Helpdesk & IT Support
    CREATE TABLE IF NOT EXISTS helpdesk_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT UNIQUE NOT NULL,
      requester_name TEXT NOT NULL,
      department TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Open',
      resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 27. Security, Auditing & Compliance
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT DEFAULT '127.0.0.1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 28. Document Management & Consents
    CREATE TABLE IF NOT EXISTS document_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_code TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size TEXT DEFAULT '1.2 MB',
      uploaded_by TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    -- 29. Notifications & Communications Engine
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      target_role TEXT DEFAULT 'all',
      read_status INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS communication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT,
      message_body TEXT NOT NULL,
      status TEXT DEFAULT 'Delivered',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 30. System Configuration
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    );
  `);

  // Ensure newly added columns on existing tables
  ensureColumn(database, 'users', 'account_status', "TEXT DEFAULT 'Active'");
  ensureColumn(database, 'users', 'employment_status', "TEXT DEFAULT 'Full-Time'");
  ensureColumn(database, 'users', 'clinical_status', "TEXT DEFAULT 'Available'");
  ensureColumn(database, 'users', 'branch_id', 'INTEGER DEFAULT 1');

  ensureColumn(database, 'patients', 'uhid', 'TEXT');
  ensureColumn(database, 'patients', 'duplicate_check_flag', 'INTEGER DEFAULT 0');
  ensureColumn(database, 'patients', 'branch_id', 'INTEGER DEFAULT 1');

  console.log('[EpicHMS DB] Schema initialized successfully with full CRD entities.');
}

function queryAll(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  return stmt.all(...params);
}

function queryOne(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  return stmt.get(...params);
}

function execute(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  return stmt.run(...params);
}

module.exports = {
  getDb,
  initSchema,
  queryAll,
  queryOne,
  execute,
  DB_PATH
};
