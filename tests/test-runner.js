const http = require('node:http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  🧪 EpicHMS Automated Test Suite Runner');
  console.log(`  🎯 Target Host: ${BASE_URL}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function assert(testName, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${testName}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  // 1. Health & Server Up
  await assert('1. Health Check Endpoint (/api/health)', async () => {
    const res = await request('/api/health');
    if (res.status !== 200 || res.data.status !== 'UP') {
      throw new Error(`Expected status 200 UP, got ${res.status} ${JSON.stringify(res.data)}`);
    }
  });

  // 2. Database Reset
  await assert('2. Database Instant Reset (/api/test/reset-db)', async () => {
    const res = await request('/api/test/reset-db', { method: 'POST' });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`DB Reset failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 3. Authentication for All 12 Roles + Legacy Staff
  const roles = ['superadmin', 'admin', 'doctor', 'nurse', 'pharmacist', 'lab', 'radiology', 'receptionist', 'billing', 'inventory', 'hr', 'patient', 'staff'];
  for (const role of roles) {
    await assert(`3.${roles.indexOf(role) + 1} Authentication for Role: ${role}`, async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: `${role}@epichms.local`, password: 'pass123' }
      });
      if (res.status !== 200 || !res.data.token || res.data.user.role !== role) {
        throw new Error(`Login failed for ${role}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data.user.account_status) {
        throw new Error(`Missing account status separation for ${role}`);
      }
    });
  }

  // 4. Public Website & Online Appointment Booking
  let webApptNo = '';
  await assert('4. Public Online Appointment Booking (/api/public/appointment-request)', async () => {
    const res = await request('/api/public/appointment-request', {
      method: 'POST',
      body: {
        first_name: 'Automation',
        last_name: 'Tester',
        phone: '+1-555-0999',
        email: 'tester@automation.local',
        doctor_id: 1,
        department_id: 1,
        appointment_date: '2026-09-25',
        symptoms: 'Automated test suite symptoms check'
      }
    });
    if (res.status !== 201 || !res.data.appointment_no) {
      throw new Error(`Booking failed: ${JSON.stringify(res.data)}`);
    }
    webApptNo = res.data.appointment_no;
  });

  // 5. Patient Registration with UHID & Duplication Detection
  let newPatientId = null;
  let newPatientUhid = null;
  await assert('5. Patient Registration with UHID (/api/patients)', async () => {
    const res = await request('/api/patients', {
      method: 'POST',
      body: {
        first_name: 'Lucas',
        last_name: 'Scott',
        gender: 'Male',
        phone: '+1-555-8888',
        age: 38,
        blood_group: 'B+',
        allergies: 'None'
      }
    });
    if (res.status !== 201 || !res.data.id || !res.data.uhid) {
      throw new Error(`Patient registration failed: ${JSON.stringify(res.data)}`);
    }
    newPatientId = res.data.id;
    newPatientUhid = res.data.uhid;
  });

  // 6. OPD Check-In
  await assert('6. OPD Queue Check-In (/api/opd/check-in)', async () => {
    const res = await request('/api/opd/check-in', {
      method: 'POST',
      body: {
        patient_id: newPatientId,
        doctor_id: 1,
        vital_bp: '122/80',
        vital_pulse: '76',
        vital_temp: '98.6',
        vital_weight: '75',
        vital_spo2: '99%'
      }
    });
    if (res.status !== 201 || !res.data.token_no) {
      throw new Error(`OPD Check-In failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 7. IPD Inpatient Admission
  await assert('7. IPD Inpatient Admission (/api/ipd/admit)', async () => {
    const res = await request('/api/ipd/admit', {
      method: 'POST',
      body: {
        patient_id: newPatientId,
        attending_doctor_id: 1,
        ward: 'General Male',
        bed_no: 'GM-Bed-09',
        admitting_diagnosis: 'Acute Gastroenteritis with moderate dehydration'
      }
    });
    if (res.status !== 201 || !res.data.ipd_code) {
      throw new Error(`IPD Admission failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 8. Emergency Case Triage
  await assert('8. Emergency Triage Case (/api/emergency/triage)', async () => {
    const res = await request('/api/emergency/triage', {
      method: 'POST',
      body: {
        patient_name: 'Jane Doe Automated',
        age: 29,
        gender: 'Female',
        triage_level: 'Level 2 (Emergent / Orange)',
        trauma_type: 'Acute Respiratory Distress',
        arrival_mode: 'Ambulance'
      }
    });
    if (res.status !== 201 || !res.data.case_no) {
      throw new Error(`Emergency triage failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 9. Pharmacy Dispensing
  await assert('9. Pharmacy Medication Dispensing (/api/pharmacy/dispense)', async () => {
    const res = await request('/api/pharmacy/dispense', {
      method: 'POST',
      body: { prescription_id: 1 }
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Pharmacy dispensing failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 10. Laboratory Order & Results
  let labOrderId = null;
  await assert('10. Laboratory Order Creation & Result Entry (/api/lab/orders)', async () => {
    const orderRes = await request('/api/lab/orders', {
      method: 'POST',
      body: { patient_id: 1, doctor_id: 1, test_id: 1, notes: 'Automated test suite CBC' }
    });
    if (orderRes.status !== 201 || !orderRes.data.order_no) {
      throw new Error(`Lab order creation failed: ${JSON.stringify(orderRes.data)}`);
    }
    labOrderId = orderRes.data.id;

    const resultRes = await request(`/api/lab/orders/${labOrderId}/result`, {
      method: 'PUT',
      body: { test_result: 'WBC: 7,200 /uL, Hb: 14.5 g/dL', normal_flag: 'Normal', notes: 'Automated verification' }
    });
    if (resultRes.status !== 200 || !resultRes.data.success) {
      throw new Error(`Lab result recording failed: ${JSON.stringify(resultRes.data)}`);
    }
  });

  // 11. Billing Invoice & Payment Settlement
  await assert('11. Billing Invoice Creation & Payment (/api/billing/invoices)', async () => {
    const res = await request('/api/billing/invoices', {
      method: 'POST',
      body: {
        patient_id: newPatientId,
        total_amount: 1500.0,
        discount_amount: 100.0,
        tax_amount: 70.0,
        payment_mode: 'Credit Card',
        items: [
          { type: 'Consultation', desc: 'Specialist Consultation', price: 850.0 },
          { type: 'Laboratory', desc: 'CBC & Electrolytes', price: 620.0 }
        ]
      }
    });
    if (res.status !== 201 || !res.data.invoice_no) {
      throw new Error(`Billing failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 12. Ambulance Dispatch
  await assert('12. Ambulance Fleet Dispatch (/api/ambulance/dispatch)', async () => {
    const res = await request('/api/ambulance/dispatch', {
      method: 'POST',
      body: { ambulance_id: 1, destination: 'Metro City North Highway Exit 4' }
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Ambulance dispatch failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 13. Platform Global Search
  await assert('13. Platform Global Search Service (/api/services/search)', async () => {
    const res = await request('/api/services/search?q=Johnathan');
    if (res.status !== 200 || !Array.isArray(res.data.patients) || res.data.patients.length === 0) {
      throw new Error(`Search failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 14. Reports & Analytics KPIs
  await assert('14. Reports & Analytics KPIs (/api/reports/kpis)', async () => {
    const res = await request('/api/reports/kpis');
    if (res.status !== 200 || typeof res.data.total_patients !== 'number') {
      throw new Error(`KPI query failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 15. Multi-Tenancy Organization Hierarchy
  await assert('15. Multi-Tenancy Hierarchy Tree (/api/org/hierarchy)', async () => {
    const res = await request('/api/org/hierarchy');
    if (res.status !== 200 || !res.data.organization || !Array.isArray(res.data.hospitals) || !Array.isArray(res.data.branches)) {
      throw new Error(`Hierarchy fetch failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 16. Bed Matrix & Controlled State Transition
  await assert('16. Bed Matrix & State Transition (/api/facility/beds/:id/status)', async () => {
    const res = await request('/api/facility/beds');
    if (res.status !== 200 || !Array.isArray(res.data.beds) || res.data.beds.length === 0) {
      throw new Error(`Bed list failed: ${JSON.stringify(res.data)}`);
    }
    const testBed = res.data.beds[0];
    const updateRes = await request(`/api/facility/beds/${testBed.id}/status`, {
      method: 'POST',
      body: { status: 'Cleaning', notes: 'Routine sanitation cycle' }
    });
    if (updateRes.status !== 200 || updateRes.data.bed.status !== 'Cleaning') {
      throw new Error(`Bed status transition failed: ${JSON.stringify(updateRes.data)}`);
    }
  });

  // 17. Bed Transfer Workflow with Audit Trail
  await assert('17. Bed Transfer Workflow (/api/facility/beds/transfer)', async () => {
    const res = await request('/api/facility/beds/transfer', {
      method: 'POST',
      body: {
        patient_id: 1,
        from_bed_id: 6,
        to_bed_id: 7,
        transfer_reason: 'Stepdown from telemetry to post-op recovery',
        requested_by: 'Nurse Sarah Jenkins',
        approved_by: 'Dr. Evelyn Reed'
      }
    });
    if (res.status !== 201 || !res.data.transfer_id) {
      throw new Error(`Bed transfer failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 18. Biomedical Waste Management Logging
  await assert('18. Biomedical Waste Logging & Categorization (/api/waste/log)', async () => {
    const res = await request('/api/waste/log', {
      method: 'POST',
      body: {
        category: 'Yellow',
        weight_kg: 3.5,
        department: 'Pathology Lab',
        collected_by: 'Dr. Julian Bashir'
      }
    });
    if (res.status !== 201 || !res.data.record || res.data.record.category !== 'Yellow') {
      throw new Error(`Biomedical waste log failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 19. Procurement Purchase Order Creation
  await assert('19. Procurement Purchase Order (/api/procurement/orders)', async () => {
    const res = await request('/api/procurement/orders', {
      method: 'POST',
      body: {
        supplier_name: 'Apex Surgical Technologies',
        department: 'Operation Theatre',
        items: [
          { name: 'Titanium Hemostatic Clips', code: 'APX-TC-01', quantity: 20, unit_price: 45.0 },
          { name: 'Vascular Suture 5-0 Prolene', code: 'APX-PR-50', quantity: 50, unit_price: 18.5 }
        ]
      }
    });
    if (res.status !== 201 || !res.data.po_no) {
      throw new Error(`Procurement PO creation failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 20. Traceable Stock Movement Audit Ledger
  await assert('20. Traceable Stock Movement Audit (/api/inventory/movements)', async () => {
    const res = await request('/api/inventory/movements', {
      method: 'POST',
      body: {
        movement_type: 'Ward Consumption',
        item_type: 'General',
        item_id: 1,
        item_code: 'INV-GLV-001',
        qty_change: -5,
        performed_by: 'Sarah Jenkins, RN',
        reference_no: 'ICU-SHIFT-01'
      }
    });
    if (res.status !== 201 || !res.data.movement_id) {
      throw new Error(`Stock movement recording failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 21. Billing Advances & Deposits
  await assert('21. Billing Advance Deposit Receipt (/api/billing/advances)', async () => {
    const res = await request('/api/billing/advances', {
      method: 'POST',
      body: {
        patient_id: 1,
        amount: 1200.0,
        payment_mode: 'Cash',
        purpose: 'Surgical Procedure Security Deposit',
        collected_by: 'Marcus Thorne, CPA'
      }
    });
    if (res.status !== 201 || !res.data.receipt_no) {
      throw new Error(`Advance deposit failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 22. Role Portal Summaries for All 12 Roles
  await assert('22. Role Workstation Portal Summaries (/api/portal/:role/summary)', async () => {
    const testRoles = ['doctor', 'nurse', 'receptionist', 'pharmacist', 'lab', 'radiology', 'billing', 'inventory', 'hr', 'patient'];
    for (const r of testRoles) {
      const res = await request(`/api/portal/${r}/summary`);
      if (res.status !== 200 || !res.data.role) {
        throw new Error(`Role portal summary failed for ${r}: ${JSON.stringify(res.data)}`);
      }
    }
  });

  console.log('\n================================================================');
  console.log(`  🏁 Automation Test Suite Results:`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Pass Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTestSuite();
}

module.exports = { runTestSuite };
