import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API_BASE = `${BACKEND_URL}/api`;

// Create axios instance with credentials
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth APIs
export const authAPI = {
  login: (credential) => api.post('/auth/login', { credential }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  switchOrganization: (organizationId) => api.post('/auth/switch-organization', { organization_id: organizationId }),
};

export const organizationAPI = {
  getCurrent: () => api.get('/organizations/current'),
  updateCurrent: (data) => api.put('/organizations/current', data),
  getMembers: () => api.get('/organizations/current/members'),
  updateMemberRole: (membershipId, role) => api.patch(`/organizations/current/members/${membershipId}`, { role }),
  removeMember: (membershipId) => api.delete(`/organizations/current/members/${membershipId}`),
  getInvitations: () => api.get('/organizations/current/invitations'),
  invite: (email, role) => api.post('/organizations/current/invitations', { email, role }),
  revokeInvitation: (invitationId) => api.delete(`/organizations/current/invitations/${invitationId}`),
};

// Vehicle APIs
export const vehicleAPI = {
  getAll: () => api.get('/vehicles'),
  getById: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post('/vehicles', data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
  updateStatus: (id, status) => api.patch(`/vehicles/${id}/status?status=${status}`),
};

// Driver APIs
export const driverAPI = {
  getAll: () => api.get('/drivers'),
  getById: (id) => api.get(`/drivers/${id}`),
  create: (data) => api.post('/drivers', data),
  update: (id, data) => api.put(`/drivers/${id}`, data),
  delete: (id) => api.delete(`/drivers/${id}`),
  updateStatus: (id, status) => api.patch(`/drivers/${id}/status?status=${status}`),
  invite: (id, email) => api.post(`/drivers/${id}/invite`, { email }),
};

// Trip APIs
export const tripAPI = {
  getAll: (status) => api.get('/trips', { params: status ? { status } : {} }),
  getById: (id) => api.get(`/trips/${id}`),
  create: (data) => api.post('/trips', data),
  update: (id, data) => api.put(`/trips/${id}`, data),
  delete: (id) => api.delete(`/trips/${id}`),
  updateStatus: (id, status) => api.patch(`/trips/${id}/status?status=${status}`),
  assign: (tripId, driverId, vehicleId) => 
    api.post(`/trips/${tripId}/assign?driver_id=${driverId}&vehicle_id=${vehicleId}`),
};

export const customerAPI = {
  getAll: () => api.get('/customers'),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  addLocation: (id, data) => api.post(`/customers/${id}/locations`, data),
};

export const transporterAPI = {
  getAll: () => api.get('/transporters'),
  create: (data) => api.post('/transporters', data),
  update: (id, data) => api.put(`/transporters/${id}`, data),
  delete: (id) => api.delete(`/transporters/${id}`),
};

export const loadAPI = {
  getAll: (status) => api.get('/loads', { params: status && status !== 'all' ? { status } : {} }),
  getById: (id) => api.get(`/loads/${id}`),
  create: (data) => api.post('/loads', data),
  update: (id, data) => api.put(`/loads/${id}`, data),
  delete: (id) => api.delete(`/loads/${id}`),
  updateStatus: (id, status) => api.patch(`/loads/${id}/status`, null, { params: { status } }),
  allocate: (id, driverId, vehicleId) => api.post(`/loads/${id}/allocate`, { driver_id: driverId, vehicle_id: vehicleId }),
};

export const commercialAPI = {
  getQuotations: () => api.get('/commercial/quotations'),
  createQuotation: (data) => api.post('/commercial/quotations', data),
  updateQuotation: (id, data) => api.put(`/commercial/quotations/${id}`, data),
  updateQuotationStatus: (id, status) => api.patch(`/commercial/quotations/${id}/status`, null, { params: { status } }),
  getInvoices: () => api.get('/commercial/invoices'),
  createInvoice: (data) => api.post('/commercial/invoices', data),
  issueInvoice: (id) => api.patch(`/commercial/invoices/${id}/issue`),
  recordPayment: (id, data) => api.post(`/commercial/invoices/${id}/payments`, data),
};

export const expenseAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  submit: (id) => api.patch(`/expenses/${id}/submit`),
  review: (id, status, notes) => api.patch(`/expenses/${id}/review`, { status, notes }),
  getReceipt: (id) => api.get(`/expenses/${id}/receipt`),
  delete: (id) => api.delete(`/expenses/${id}`),
  profitability: () => api.get('/profitability/trips'),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getTripSummary: () => api.get('/analytics/trip-summary'),
};

// AI APIs
export const aiAPI = {
  getInsights: (query) => api.post('/ai/insights', { query }),
};

// Compliance APIs
export const complianceAPI = {
  createPreTripCheck: (data) => api.post('/compliance/pre-trip-check', data),
  getPreTripChecks: (tripId) => api.get(`/compliance/pre-trip-checks/${tripId}`),
  getSummary: () => api.get('/compliance/summary'),
  getDocuments: (params) => api.get('/compliance/documents', { params }),
  uploadDocument: (data) => api.post('/compliance/documents', data),
  getFile: (id) => api.get(`/compliance/documents/${id}/file`),
  verifyDocument: (id, status, notes) => api.patch(`/compliance/documents/${id}/verify`, { status, notes }),
  deleteDocument: (id) => api.delete(`/compliance/documents/${id}`),
};

export const reportsAPI = {
  overview: (params) => api.get('/reports/overview', { params }),
  exportCsv: (reportType, params) => api.get('/reports/export.csv', { params: { ...params, report_type: reportType }, responseType: 'blob' }),
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

export const emailAPI = {
  getSettings: () => api.get('/email/settings'),
  updateSettings: (data) => api.put('/email/settings', data),
  getOutbox: () => api.get('/email/outbox'),
  sendTest: () => api.post('/email/test'),
  runReminders: () => api.post('/email/reminders/run'),
};

export const driverPortalAPI = {
  getTrips: () => api.get('/driver/me/trips'),
  addEvent: (tripId, data) => api.post(`/driver/me/trips/${tripId}/events`, data),
  startTrip: (tripId) => api.post(`/driver/me/trips/${tripId}/start`),
  completeTrip: (tripId, data) => api.post(`/driver/me/trips/${tripId}/proof-of-delivery`, data),
  updateLocation: (tripId, data) => api.post(`/driver/me/trips/${tripId}/location`, data),
};

export const trackingAPI = {
  getActive: () => api.get('/tracking/active'),
  getHistory: (tripId) => api.get(`/tracking/trips/${tripId}/history`),
};

export const geocodingAPI = {
  search: (query) => api.get('/geocoding/search', { params: { q: query } }),
  reverse: (lat, lng) => api.post('/geocoding/reverse', { lat, lng }),
};

export default api;
