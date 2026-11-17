/**
 * Frontend API Service Layer
 */

const TOKEN_KEY = 'mms_auth_token';
const USER_KEY = 'mms_current_user';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  
  getUser: () => {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clearUser: () => localStorage.removeItem(USER_KEY),

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

async function apiFetch(endpoint, options = {}) {
  const token = authStorage.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      authStorage.logout();
    }
    const error = new Error(data.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication & RBAC
  login: async (email, password) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      authStorage.setToken(data.token);
      authStorage.setUser(data.user);
    }
    return data;
  },

  getMe: async () => {
    return apiFetch('/api/auth/me');
  },

  getDemoAccounts: async () => {
    return apiFetch('/api/auth/demo-accounts');
  },

  logout: async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      authStorage.logout();
    }
  },

  // Wards
  getWards: async () => {
    return apiFetch('/api/wards');
  },

  // Patients (Module 2)
  getPatients: async ({ ward_id, my_patients, search, status = 'ADMITTED' } = {}) => {
    const params = new URLSearchParams();
    if (ward_id && ward_id !== 'all') params.append('ward_id', ward_id);
    if (my_patients) params.append('my_patients', 'true');
    if (search && search.trim()) params.append('search', search.trim());
    if (status) params.append('status', status);

    return apiFetch(`/api/patients?${params.toString()}`);
  },

  getPatientById: async (id) => {
    return apiFetch(`/api/patients/${id}`);
  },

  admitPatient: async (patientData) => {
    return apiFetch('/api/patients', {
      method: 'POST',
      body: JSON.stringify(patientData)
    });
  },

  updatePatient: async (id, data) => {
    return apiFetch(`/api/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  dischargePatient: async (id) => {
    return apiFetch(`/api/patients/${id}/discharge`, {
      method: 'POST'
    });
  },

  // Pharmacy & Medications (Module 3)
  getMedications: async (search) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiFetch(`/api/medications${query}`);
  },

  createMedication: async (data) => {
    return apiFetch('/api/medications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getPrescriptions: async ({ patient_id, status } = {}) => {
    const params = new URLSearchParams();
    if (patient_id) params.append('patient_id', patient_id);
    if (status) params.append('status', status);
    return apiFetch(`/api/prescriptions?${params.toString()}`);
  },

  assignPrescription: async (prescriptionData) => {
    return apiFetch('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(prescriptionData)
    });
  },

  discontinuePrescription: async (id) => {
    return apiFetch(`/api/prescriptions/${id}/discontinue`, {
      method: 'PATCH'
    });
  },

  // Daily Schedule & Clinical Guidance (Module 4)
  getDailySchedule: async ({ date, ward_id, my_patients, slot, status } = {}) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (ward_id && ward_id !== 'all') params.append('ward_id', ward_id);
    if (my_patients) params.append('my_patients', 'true');
    if (slot && slot !== 'ALL') params.append('slot', slot);
    if (status && status !== 'ALL') params.append('status', status);

    return apiFetch(`/api/schedules/today?${params.toString()}`);
  },

  getPatientSchedule: async (patientId, date) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return apiFetch(`/api/schedules/patient/${patientId}${query}`);
  },

  // Nurse Administration & Safe Dispensing (Module 5)
  recordAdministration: async ({ dose_schedule_id, status, notes, vitals }) => {
    return apiFetch('/api/administration/record', {
      method: 'POST',
      body: JSON.stringify({ dose_schedule_id, status, notes, vitals })
    });
  },

  getAdministrationHistory: async (patientId) => {
    return apiFetch(`/api/administration/history/${patientId}`);
  },

  getShiftReconciliation: async (wardId) => {
    const query = wardId && wardId !== 'all' ? `?ward_id=${wardId}` : '';
    return apiFetch(`/api/administration/reconciliation${query}`);
  }
};

export default api;
