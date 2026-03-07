const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Error de API');
  }

  return data;
}

export const enums = {
  locationStatus: ['active', 'inactive'],
  deviceTypes: ['server', 'pos_terminal', 'fiscal_printer', 'kitchen_printer', 'pinpad', 'router', 'switch', 'other'],
  incidentCategories: ['network', 'sql', 'aloha', 'printer', 'fiscal', 'hardware', 'other'],
  incidentStatus: ['open', 'closed'],
  taskPriority: ['low', 'medium', 'high', 'urgent'],
  taskStatus: ['todo', 'in_progress', 'blocked', 'done']
};

export const api = {
  getLocations: () => request('/locations'),
  getLocationById: (id) => request(`/locations/${id}`),
  createLocation: (payload) => request('/locations', { method: 'POST', body: JSON.stringify(payload) }),
  updateLocation: (id, payload) => request(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getDevices: () => request('/devices'),
  createDevice: (payload) => request('/devices', { method: 'POST', body: JSON.stringify(payload) }),

  getIncidents: () => request('/incidents'),
  createIncident: (payload) => request('/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  updateIncident: (id, payload) => request(`/incidents/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getWeeklyTasks: () => request('/weekly-tasks'),
  createWeeklyTask: (payload) => request('/weekly-tasks', { method: 'POST', body: JSON.stringify(payload) }),
  updateWeeklyTask: (id, payload) => request(`/weekly-tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getLocationNotes: () => request('/location-notes'),
  createLocationNote: (payload) => request('/location-notes', { method: 'POST', body: JSON.stringify(payload) })
};
