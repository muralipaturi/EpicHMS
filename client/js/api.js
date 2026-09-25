// EpicHMS - Client API Communication Library
const API = {
  baseUrl: '',
  token: localStorage.getItem('epichms_token') || '',

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(endpoint, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth & Roles
  async login(identifier, password) {
    const res = await this.request('/api/auth/login', { method: 'POST', body: { email: identifier, username: identifier, password } });
    if (res.token) {
      this.token = res.token;
      localStorage.setItem('epichms_token', res.token);
      localStorage.setItem('epichms_user', JSON.stringify(res.user));
    }
    return res;
  },

  async switchRole(role) {
    const res = await this.request('/api/auth/switch-role', { method: 'POST', body: { role } });
    if (res.token) {
      this.token = res.token;
      localStorage.setItem('epichms_token', res.token);
      localStorage.setItem('epichms_user', JSON.stringify(res.user));
    }
    return res;
  },

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('epichms_user')) || {
        username: 'superadmin',
        full_name: 'Dr. Arthur Sterling',
        role: 'superadmin'
      };
    } catch (e) {
      return { username: 'superadmin', full_name: 'Dr. Arthur Sterling', role: 'superadmin' };
    }
  },

  // Test Automation
  async resetDatabase() {
    return this.request('/api/test/reset-db', { method: 'POST' });
  },

  async getTestSummary() {
    return this.request('/api/test/summary');
  },

  // Public
  async getPublicInfo() { return this.request('/api/public/hospital-info'); },
  async getPublicDoctors() { return this.request('/api/public/doctors'); },
  async getPublicDepartments() { return this.request('/api/public/departments'); },
  async bookPublicAppointment(data) { return this.request('/api/public/appointment-request', { method: 'POST', body: data }); },

  // Clinical & Patient Care
  async getPatients(search = '') { return this.request(`/api/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`); },
  async createPatient(data) { return this.request('/api/patients', { method: 'POST', body: data }); },
  async getPatient(id) { return this.request(`/api/patients/${id}`); },

  async getAppointments() { return this.request('/api/appointments'); },
  async createAppointment(data) { return this.request('/api/appointments', { method: 'POST', body: data }); },
  async updateAppointmentStatus(id, status) { return this.request(`/api/appointments/${id}/status`, { method: 'PUT', body: { status } }); },

  async getOpdQueue() { return this.request('/api/opd/queue'); },
  async checkInOpd(data) { return this.request('/api/opd/check-in', { method: 'POST', body: data }); },

  async getIpdAdmissions() { return this.request('/api/ipd/admissions'); },
  async admitIpd(data) { return this.request('/api/ipd/admit', { method: 'POST', body: data }); },

  async getEmergencyCases() { return this.request('/api/emergency/cases'); },
  async createEmergencyCase(data) { return this.request('/api/emergency/triage', { method: 'POST', body: data }); },

  async getDoctors() { return this.request('/api/doctors'); },
  async createDoctor(data) { return this.request('/api/doctors', { method: 'POST', body: data }); },
  async getDepartments() { return this.request('/api/departments'); },

  async getOtSchedules() { return this.request('/api/ot/schedules'); },
  async getNursingRecords() { return this.request('/api/nursing/records'); },
  async createNursingVitals(data) { return this.request('/api/nursing/vitals', { method: 'POST', body: data }); },

  async getEmrRecords() { return this.request('/api/emr/records'); },
  async getDischargeSummaries() { return this.request('/api/discharge/summaries'); },
  async getDietPlans() { return this.request('/api/diet/plans'); },

  // Diagnostics & Pharmacy
  async getPharmacyInventory() { return this.request('/api/pharmacy/inventory'); },
  async getPrescriptions() { return this.request('/api/pharmacy/prescriptions'); },
  async dispensePrescription(prescription_id) { return this.request('/api/pharmacy/dispense', { method: 'POST', body: { prescription_id } }); },

  async getLabTests() { return this.request('/api/lab/tests'); },
  async getLabOrders() { return this.request('/api/lab/orders'); },
  async createLabOrder(data) { return this.request('/api/lab/orders', { method: 'POST', body: data }); },
  async updateLabResult(id, data) { return this.request(`/api/lab/orders/${id}/result`, { method: 'PUT', body: data }); },

  async getRadiologyOrders() { return this.request('/api/radiology/orders'); },
  async createRadiologyOrder(data) { return this.request('/api/radiology/orders', { method: 'POST', body: data }); },

  async getBloodBankUnits() { return this.request('/api/blood-bank/units'); },

  // Finance & Logistics
  async getInvoices() { return this.request('/api/billing/invoices'); },
  async createInvoice(data) { return this.request('/api/billing/invoices', { method: 'POST', body: data }); },
  async getInsuranceClaims() { return this.request('/api/insurance/claims'); },
  async getInventoryItems() { return this.request('/api/inventory/items'); },
  async restockInventory(item_id, quantity) { return this.request('/api/inventory/restock', { method: 'POST', body: { item_id, quantity } }); },

  async getAmbulances() { return this.request('/api/ambulance/fleet'); },
  async dispatchAmbulance(ambulance_id, destination) { return this.request('/api/ambulance/dispatch', { method: 'POST', body: { ambulance_id, destination } }); },

  async getHousekeepingTasks() { return this.request('/api/housekeeping/tasks'); },
  async updateHousekeepingStatus(id, status) { return this.request(`/api/housekeeping/tasks/${id}/status`, { method: 'PUT', body: { status } }); },

  async getMortuaryRecords() { return this.request('/api/mortuary/records'); },
  async getAssets() { return this.request('/api/assets/items'); },
  async getHelpdeskTickets() { return this.request('/api/helpdesk/tickets'); },
  async createHelpdeskTicket(data) { return this.request('/api/helpdesk/tickets', { method: 'POST', body: data }); },

  // Governance & Admin
  async getEmployees() { return this.request('/api/hr/employees'); },
  async getPayrollRecords() { return this.request('/api/payroll/records'); },
  async getReportsKpis() { return this.request('/api/reports/kpis'); },
  async getAuditLogs() { return this.request('/api/audit/logs'); },
  async getDocuments() { return this.request('/api/documents'); },

  // Platform Services
  async getNotifications() { return this.request('/api/services/notifications'); },
  async markAllNotificationsRead() { return this.request('/api/services/notifications/read-all', { method: 'POST' }); },
  async getCommunications() { return this.request('/api/services/comms'); },
  async globalSearch(q) { return this.request(`/api/services/search?q=${encodeURIComponent(q)}`); },

  // CRD Advanced Modules
  async getOrgHierarchy() { return this.request('/api/org/hierarchy'); },
  async getFacilityBeds(status = 'All', ward = 'All') { return this.request(`/api/facility/beds?status=${encodeURIComponent(status)}&ward=${encodeURIComponent(ward)}`); },
  async updateBedStatus(id, status, notes, patient_id) { return this.request(`/api/facility/beds/${id}/status`, { method: 'POST', body: { status, notes, patient_id } }); },
  async transferBed(data) { return this.request('/api/facility/beds/transfer', { method: 'POST', body: data }); },

  async getBiomedicalWaste() { return this.request('/api/waste/records'); },
  async logBiomedicalWaste(data) { return this.request('/api/waste/log', { method: 'POST', body: data }); },
  async dispatchBiomedicalWaste(data = {}) { return this.request('/api/waste/dispatch', { method: 'POST', body: data }); },

  async getProcurementOrders() { return this.request('/api/procurement/orders'); },
  async createProcurementOrder(data) { return this.request('/api/procurement/orders', { method: 'POST', body: data }); },
  async getStockMovements() { return this.request('/api/inventory/movements'); },
  async logStockMovement(data) { return this.request('/api/inventory/movements', { method: 'POST', body: data }); },

  async getBillingAdvances() { return this.request('/api/billing/advances'); },
  async createBillingAdvance(data) { return this.request('/api/billing/advances', { method: 'POST', body: data }); },

  async getRoleSummary(role) { return this.request(`/api/portal/${encodeURIComponent(role)}/summary`); }
};

window.api = API;
