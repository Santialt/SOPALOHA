import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api, enums } from '../services/api';

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

function IncidentsPage() {
  const [searchParams] = useSearchParams();
  const prefillLocationId = Number(searchParams.get('location_id')) || '';
  const prefillDeviceId = Number(searchParams.get('device_id')) || '';

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const [filters, setFilters] = useState({ status: '', category: '' });
  const [form, setForm] = useState(buildInitialForm(prefillLocationId, prefillDeviceId));
  const [updatingIncidentId, setUpdatingIncidentId] = useState(null);
  const [deletingIncidentId, setDeletingIncidentId] = useState(null);

  const { load, loading, error, setError } = useDataLoader(async () => {
    const [incidentsData, locationsData, devicesData] = await Promise.all([
      api.getIncidents(),
      api.getLocations(),
      api.getDevices()
    ]);
    setIncidents(incidentsData);
    setLocations(locationsData);
    setDevices(devicesData);
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const statusOk = !filters.status || incident.status === filters.status;
      const categoryOk = !filters.category || incident.category === filters.category;
      return statusOk && categoryOk;
    });
  }, [incidents, filters]);

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
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onChangeStatus = async (incident, status) => {
    setUpdatingIncidentId(incident.id);
    setError('');
    setSuccess('');

    try {
      await api.updateIncident(incident.id, {
        ...incident,
        status
      });
      setSuccess(`Estado del incidente #${incident.id} actualizado.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingIncidentId(null);
    }
  };

  const onDelete = async (incident) => {
    const ok = window.confirm(`Eliminar el incidente "${incident.title}"?`);
    if (!ok) return;

    setDeletingIncidentId(incident.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteIncident(incident.id);
      setSuccess(`Incidente #${incident.id} eliminado.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingIncidentId(null);
    }
  };

  if (loading) return <LoadingBlock label="Cargando incidentes..." />;

  return (
    <div className="grid-two-columns">
      <section className="section-card">
        <h2>Registro operativo de incidente</h2>
        <InlineError message={error} />
        <InlineSuccess message={success} />

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
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>

          <label>
            Dispositivo
            <select
              className="input"
              value={form.device_id}
              onChange={(event) => setForm({ ...form, device_id: event.target.value })}
              disabled={Boolean(prefillDeviceId)}
            >
              <option value="">Sin dispositivo</option>
              {devices
                .filter((device) => !form.location_id || device.location_id === Number(form.location_id))
                .map((device) => (
                  <option key={device.id} value={device.id}>{device.name}</option>
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
        <div className="section-head wrap">
          <h2>Listado de incidentes</h2>
          <div className="filter-row">
            <select
              className="input"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">Todos los estados</option>
              {enums.incidentStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              className="input"
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
            >
              <option value="">Todas las categorias</option>
              {enums.incidentCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        <table className="table compact">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Local</th>
              <th>Titulo</th>
              <th>Categoria</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.map((incident) => {
              const location = locations.find((item) => item.id === incident.location_id);
              return (
                <tr key={incident.id}>
                  <td>{incident.incident_date}</td>
                  <td>{location?.name || `#${incident.location_id}`}</td>
                  <td>{incident.title}</td>
                  <td>{incident.category}</td>
                  <td>
                    <select
                      className="input status-select"
                      value={incident.status}
                      onChange={(event) => onChangeStatus(incident, event.target.value)}
                      disabled={updatingIncidentId === incident.id}
                    >
                      {enums.incidentStatus.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn-danger"
                      onClick={() => onDelete(incident)}
                      disabled={deletingIncidentId === incident.id}
                    >
                      {deletingIncidentId === incident.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredIncidents.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-row">Sin incidentes</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default IncidentsPage;
