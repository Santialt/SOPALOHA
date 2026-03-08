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

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export const enums = {
  locationStatus: ['active', 'inactive'],
  deviceTypes: ['server', 'pos_terminal', 'fiscal_printer', 'kitchen_printer', 'pinpad', 'router', 'switch', 'other'],
  deviceRoles: ['server', 'pos', 'kitchen_display', 'kitchen_printer', 'fiscal_printer', 'router', 'switch', 'other'],
  incidentCategories: ['network', 'sql', 'aloha', 'printer', 'fiscal', 'hardware', 'other'],
  incidentStatus: ['open', 'closed'],
  taskPriority: ['low', 'medium', 'high', 'urgent'],
  taskStatus: ['todo', 'in_progress', 'blocked', 'done'],
  operationalTaskPriority: ['low', 'medium', 'high', 'critical'],
  operationalTaskStatus: ['pending', 'in_progress', 'blocked', 'done', 'cancelled']
};

export const api = {
  getLocations: () => request('/locations'),
  getLocationById: (id) => request(`/locations/${id}`),
  createLocation: (payload) => request('/locations', { method: 'POST', body: JSON.stringify(payload) }),
  updateLocation: (id, payload) => request(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getLocationIntegrations: (id) => request(`/locations/${id}/integrations`),
  replaceLocationIntegrations: (id, integrations) =>
    request(`/locations/${id}/integrations`, {
      method: 'PUT',
      body: JSON.stringify({ integrations })
    }),
  deleteLocation: (id) => request(`/locations/${id}`, { method: 'DELETE' }),

  getDevices: () => request('/devices'),
  createDevice: (payload) => request('/devices', { method: 'POST', body: JSON.stringify(payload) }),
  updateDevice: (id, payload) => request(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDevice: (id) => request(`/devices/${id}`, { method: 'DELETE' }),

  getIncidents: () => request('/incidents'),
  createIncident: (payload) => request('/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  updateIncident: (id, payload) => request(`/incidents/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteIncident: (id) => request(`/incidents/${id}`, { method: 'DELETE' }),

  getWeeklyTasks: () => request('/weekly-tasks'),
  createWeeklyTask: (payload) => request('/weekly-tasks', { method: 'POST', body: JSON.stringify(payload) }),
  updateWeeklyTask: (id, payload) => request(`/weekly-tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteWeeklyTask: (id) => request(`/weekly-tasks/${id}`, { method: 'DELETE' }),

  getTasks: (filters = {}) => request(`/tasks${buildQuery(filters)}`),
  getTaskById: (id) => request(`/tasks/${id}`),
  createTask: (payload) => request('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  updateTask: (id, payload) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  getLocationNotes: () => request('/location-notes'),
  createLocationNote: (payload) => request('/location-notes', { method: 'POST', body: JSON.stringify(payload) }),
  deleteLocationNote: (id) => request(`/location-notes/${id}`, { method: 'DELETE' }),

  pingDeviceIp: (ip) =>
    request('/support-actions/ping', {
      method: 'POST',
      body: JSON.stringify({ ip })
    }),
  openTeamviewer: (teamviewerId) =>
    request('/support-actions/teamviewer/open', {
      method: 'POST',
      body: JSON.stringify({ teamviewer_id: teamviewerId })
    }),

  getTeamviewerImportPreview: () => request('/teamviewer/import-preview'),
  runTeamviewerImport: () =>
    request('/teamviewer/import', {
      method: 'POST'
    }),
  importTeamviewerCases: (payload) =>
    request('/teamviewer/import-cases', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getTeamviewerImportedCases: (filters = {}) => request(`/teamviewer/imported-cases${buildQuery(filters)}`),
  getTeamviewerImportedCaseById: (id) => request(`/teamviewer/imported-cases/${id}`),
  createTeamviewerImportedCase: (payload) =>
    request('/teamviewer/imported-cases', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteTeamviewerImportedCase: (id) => request(`/teamviewer/imported-cases/${id}`, { method: 'DELETE' }),
  getTeamviewerExplorer: () => request('/teamviewer/explorer'),
  getTeamviewerGroup: (groupId) => request(`/teamviewer/groups/${groupId}`),
  getTeamviewerDevice: (teamviewerId) => request(`/teamviewer/devices/${teamviewerId}`),

  getOnCallShifts: () => request('/on-call-shifts'),
  getOnCallShiftById: (id) => request(`/on-call-shifts/${id}`),
  getCurrentOnCallShift: () => request('/on-call-shifts/current'),
  createOnCallShift: (payload) => request('/on-call-shifts', { method: 'POST', body: JSON.stringify(payload) }),
  updateOnCallShift: (id, payload) => request(`/on-call-shifts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteOnCallShift: (id) => request(`/on-call-shifts/${id}`, { method: 'DELETE' }),

  getOnCallTemplates: () => request('/on-call-templates'),
  getOnCallTemplateById: (id) => request(`/on-call-templates/${id}`),
  createOnCallTemplate: (payload) =>
    request('/on-call-templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateOnCallTemplate: (id, payload) =>
    request(`/on-call-templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getOnCallTechnicians: () => request('/on-call-technicians'),
  getOnCallTechnicianById: (id) => request(`/on-call-technicians/${id}`),
  createOnCallTechnician: (payload) =>
    request('/on-call-technicians', { method: 'POST', body: JSON.stringify(payload) }),
  updateOnCallTechnician: (id, payload) =>
    request(`/on-call-technicians/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
};
