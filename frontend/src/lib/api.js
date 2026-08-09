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
  login: (credentials = {}) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
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
};

export default api;
