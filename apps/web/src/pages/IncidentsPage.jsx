import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EntityCommentsPanel from '../components/EntityCommentsPanel';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { api } from '../services/api';

const TeamViewerImportedCasesPage = lazy(() => import('./TeamViewerImportedCasesPage'));

function nowForDatetimeInput() {
  const date = new Date();
  date.setSeconds(0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildInitialForm(prefillLocationId, prefillDeviceId) {
  return {
    location_id: prefillLocationId || '',
    device_id: prefillDeviceId || '',
    incident_date: nowForDatetimeInput(),
    problem: '',
    solution: '',
    time_spent_minutes: ''
  };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR');
}

function IncidentsPage() {
  const [searchParams] = useSearchParams();
  const prefillLocationId = Number(searchParams.get('location_id')) || '';
  const prefillDeviceId = Number(searchParams.get('device_id')) || '';
  const preselectIncidentId = Number(searchParams.get('incident_id')) || null;
  const initialView = searchParams.get('view') === 'teamviewer' ? 'teamviewer' : 'incidents';

  const [activeView, setActiveView] = useState(initialView);
  const [loading, setLoading] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingIncidentId, setDeletingIncidentId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [form, setForm] = useState(buildInitialForm(prefillLocationId, prefillDeviceId));

  const selectedLocationId = useMemo(() => Number(form.location_id) || null, [form.location_id]);

  const loadRecentIncidents = async (locationId) => {
    setLoadingRecent(true);
    try {
      const incidentsData = await api.getIncidents({
        location_id: locationId || undefined,
        limit: 20
      });
      setRecentIncidents(incidentsData);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [locationsData, incidentsData] = await Promise.all([
          api.getLocations(),
          api.getIncidents({
            location_id: prefillLocationId || undefined,
            limit: 20
          })
        ]);
        setLocations(locationsData);
        setRecentIncidents(incidentsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [prefillLocationId]);

  useEffect(() => {
    const loadDevices = async () => {
      if (!selectedLocationId) {
        setDevices([]);
        return;
      }

      setLoadingDevices(true);
      setError('');

      try {
        const devicesData = await api.getDevices({ location_id: selectedLocationId });
        setDevices(devicesData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingDevices(false);
      }
    };

    loadDevices();
  }, [selectedLocationId]);

  useEffect(() => {
    if (activeView !== 'incidents') return;

    loadRecentIncidents(selectedLocationId || prefillLocationId || null).catch((err) => {
      setError(err.message);
    });
  }, [activeView, selectedLocationId, prefillLocationId]);

  useEffect(() => {
    if (!preselectIncidentId) return;
    if (!recentIncidents.some((incident) => incident.id === preselectIncidentId)) return;
    setSelectedIncidentId(preselectIncidentId);
  }, [preselectIncidentId, recentIncidents]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.createIncident({
        location_id: Number(form.location_id),
        device_id: form.device_id ? Number(form.device_id) : null,
        incident_date: form.incident_date,
        title: form.problem,
        description: form.problem,
        solution: form.solution,
        category: 'other',
        status: 'open',
        time_spent_minutes: Number(form.time_spent_minutes || 0)
      });

      setForm(buildInitialForm(prefillLocationId, prefillDeviceId));
      setSuccess('Incidente creado.');
      setSelectedIncidentId(null);
      await loadRecentIncidents(selectedLocationId || prefillLocationId || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteIncident = async (incident) => {
    const ok = window.confirm(`Eliminar incidente #${incident.id}?`);
    if (!ok) return;

    setDeletingIncidentId(incident.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteIncident(incident.id);
      if (selectedIncidentId === incident.id) {
        setSelectedIncidentId(null);
      }
      setSuccess(`Incidente #${incident.id} eliminado.`);
      await loadRecentIncidents(selectedLocationId || prefillLocationId || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingIncidentId(null);
    }
  };

  if (loading) return <LoadingBlock label="Cargando incidentes..." />;

  return (
    <div>
      <section className="section-card">
        <div className="section-head">
          <h2>Incidentes</h2>
          <div className="form-actions">
            <button
              type="button"
              className={activeView === 'incidents' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveView('incidents')}
            >
              Registro operativo
            </button>
            <button
              type="button"
              className={activeView === 'teamviewer' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveView('teamviewer')}
            >
              Casos TeamViewer
            </button>
          </div>
        </div>
      </section>

      <InlineError message={error} />
      <InlineSuccess message={success} />

      {activeView === 'incidents' ? (
        <div className="grid-two-columns">
          <div>
            <section className="section-card">
            <h2>Registro operativo de incidente</h2>

            <form onSubmit={onSubmit} className="form-grid">
              <label>
                Local
                <select
                  className="input"
                  value={form.location_id}
                  onChange={(event) => setForm({ ...form, location_id: event.target.value, device_id: '' })}
                  required
                  disabled={Boolean(prefillLocationId)}
                >
                  <option value="">Seleccionar</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Dispositivo
                <select
                  className="input"
                  value={form.device_id}
                  onChange={(event) => setForm({ ...form, device_id: event.target.value })}
                  disabled={Boolean(prefillDeviceId) || !form.location_id || loadingDevices}
                >
                  <option value="">{loadingDevices ? 'Cargando...' : 'Sin dispositivo'}</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Fecha y hora
                <input
                  className="input"
                  type="datetime-local"
                  value={form.incident_date}
                  onChange={(event) => setForm({ ...form, incident_date: event.target.value })}
                  required
                />
              </label>

              <label className="full-row">
                Problema *
                <textarea
                  className="input"
                  rows="4"
                  value={form.problem}
                  onChange={(event) => setForm({ ...form, problem: event.target.value })}
                  required
                />
              </label>

              <label className="full-row">
                Solucion *
                <textarea
                  className="input"
                  rows="3"
                  value={form.solution}
                  onChange={(event) => setForm({ ...form, solution: event.target.value })}
                  required
                />
              </label>

              <label>
                Tiempo (minutos) *
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.time_spent_minutes}
                  onChange={(event) => setForm({ ...form, time_spent_minutes: event.target.value })}
                  required
                />
              </label>

              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Crear incidente'}
              </button>
            </form>
          </section>

            <section className="section-card">
              <div className="section-head">
                <h2>Incidentes recientes</h2>
                <small>{recentIncidents.length} cargados</small>
              </div>

              {loadingRecent ? (
                <LoadingBlock label="Actualizando incidentes recientes..." />
              ) : (
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Local</th>
                      <th>Problema</th>
                      <th>Solucion</th>
                      <th>Minutos</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentIncidents.map((incident) => {
                      const location = locations.find((item) => item.id === incident.location_id);
                      return (
                        <tr key={incident.id}>
                          <td className={selectedIncidentId === incident.id ? 'row-highlighted' : ''}>
                            {formatDateTime(incident.incident_date)}
                          </td>
                          <td className={selectedIncidentId === incident.id ? 'row-highlighted' : ''}>
                            {location?.name || `Local #${incident.location_id}`}
                          </td>
                          <td className={selectedIncidentId === incident.id ? 'row-highlighted' : ''}>
                            {incident.description || incident.title}
                          </td>
                          <td className={selectedIncidentId === incident.id ? 'row-highlighted' : ''}>
                            {incident.solution || '-'}
                          </td>
                          <td className={selectedIncidentId === incident.id ? 'row-highlighted' : ''}>
                            {incident.time_spent_minutes || 0}
                          </td>
                          <td className={selectedIncidentId === incident.id ? 'row-highlighted' : ''}>
                            <div className="form-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setSelectedIncidentId(incident.id)}
                              >
                                Comentarios
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => onDeleteIncident(incident)}
                                disabled={deletingIncidentId === incident.id}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {recentIncidents.length === 0 && (
                      <tr>
                        <td colSpan="6" className="empty-row">No hay incidentes para el alcance actual.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <EntityCommentsPanel
            entityId={selectedIncidentId}
            entityLabel={selectedIncidentId ? `del incidente #${selectedIncidentId}` : 'de incidente'}
            loadComments={api.getIncidentComments}
            createComment={api.createIncidentComment}
          />
        </div>
      ) : (
        <Suspense fallback={<LoadingBlock label="Cargando modulo TeamViewer..." />}>
          <TeamViewerImportedCasesPage />
        </Suspense>
      )}
    </div>
  );
}

export default IncidentsPage;
